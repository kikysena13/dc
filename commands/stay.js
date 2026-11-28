const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const voice = require("@discordjs/voice");

const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    StreamType
} = voice;

const AudioPlayerStatus = voice.AudioPlayerStatus || {
    Idle: "idle",
    Buffering: "buffering",
    Paused: "paused",
    Playing: "playing",
    AutoPaused: "autopaused"
};

const STATUS_READY = VoiceConnectionStatus.Ready || "ready";
const STATUS_DISCONNECTED = VoiceConnectionStatus.Disconnected || "disconnected";
const STATUS_DESTROYED = VoiceConnectionStatus.Destroyed || "destroyed";
const STATUS_SIGNALLING = VoiceConnectionStatus.Signalling || "signalling";
const STATUS_CONNECTING = VoiceConnectionStatus.Connecting || "connecting";

const DEFAULT_DATA_FILE = path.join(__dirname, "..", "data", "voice-stay.json");
const activeStayChannels = new Map();
const monitoredConnections = new WeakMap();

const BASE_RECONNECT_DELAY_MS = 2_500;
const DESTROY_SETTLE_DELAY_MS = 400;
const MEMBER_LEAVE_VERIFY_DELAY_MS = 4_000;
const REJOIN_TIMEOUT_MS = 8_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const WATCHDOG_INTERVAL_MS = 3_000;
const STUCK_HANDSHAKE_TIMEOUT_MS = 15_000;
const SILENCE_RESTART_DELAY_MS = 1_000;
const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

let githubSyncQueue = Promise.resolve();

function getDataFilePath(customFilePath) {
    return customFilePath || process.env.STAY_DATA_FILE || DEFAULT_DATA_FILE;
}

class SilenceStream extends Readable {
    constructor() {
        super({ objectMode: true, highWaterMark: 2 });
    }

    _read() {
        if (this.destroyed) return;
        this.push(SILENCE_FRAME);
    }
}

function readStayStore(filePath = getDataFilePath()) {
    try {
        if (!fs.existsSync(filePath)) return {};
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        return parsed;
    } catch (error) {
        console.error("[Stay] Failed to read voice-stay store:", error.message);
        return {};
    }
}

function queueStayGitHubPersistence(serializedData) {
    // Only push voice-stay.json to GitHub when explicitly enabled so !stay does not
    // unexpectedly trigger a Railway auto-redeploy from a commit to main.
    if (!process.env.GITHUB_TOKEN || process.env.STAY_GITHUB_SYNC !== "true") {
        return Promise.resolve(false);
    }

    githubSyncQueue = githubSyncQueue
        .then(async () => {
            const repository = process.env.GITHUB_REPOSITORY || "kikysena13/dc";
            const branch = process.env.GITHUB_BRANCH || "main";
            const remotePath = process.env.GITHUB_STAY_DATA_PATH || "data/voice-stay.json";
            const endpoint = `https://api.github.com/repos/${repository}/contents/${remotePath}`;
            const headers = {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                "X-GitHub-Api-Version": "2022-11-28"
            };

            let sha;
            const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
            if (currentResponse.ok) {
                const currentFile = await currentResponse.json();
                sha = currentFile.sha;
            } else if (currentResponse.status !== 404) {
                const errorBody = await currentResponse.text();
                throw new Error(`GitHub stay read failed (${currentResponse.status}): ${errorBody.slice(0, 240)}`);
            }

            const payload = {
                message: "Sync 24/7 voice stay state from Discord",
                content: Buffer.from(serializedData, "utf8").toString("base64"),
                branch
            };
            if (sha) payload.sha = sha;

            const updateResponse = await fetch(endpoint, {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!updateResponse.ok) {
                const errorBody = await updateResponse.text();
                throw new Error(`GitHub stay write failed (${updateResponse.status}): ${errorBody.slice(0, 240)}`);
            }
            return true;
        })
        .catch(error => {
            console.error("[Stay] GitHub persistence sync failed:", error.message);
            return false;
        });

    return githubSyncQueue;
}

function writeStayStore(store, filePath = getDataFilePath()) {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const serialized = `${JSON.stringify(store, null, 2)}\n`;
        fs.writeFileSync(filePath, serialized, "utf8");
        if (filePath === getDataFilePath()) {
            queueStayGitHubPersistence(serialized);
        }
    } catch (error) {
        console.error("[Stay] Failed to write voice-stay store:", error.message);
    }
}

function saveStayTarget(guildId, entry, filePath = getDataFilePath()) {
    const store = readStayStore(filePath);
    const existing = store[guildId] || {};
    store[guildId] = {
        channelId: entry.channelId,
        channelName: entry.channelName || existing.channelName || "",
        requestedBy: entry.requestedBy || existing.requestedBy || null,
        enabledAt: entry.enabledAt || existing.enabledAt || new Date().toISOString()
    };
    writeStayStore(store, filePath);
}

function removeStayTarget(guildId, filePath = getDataFilePath()) {
    const store = readStayStore(filePath);
    if (!(guildId in store)) return;
    delete store[guildId];
    writeStayStore(store, filePath);
}

function isActiveStayTarget(guildId, target) {
    return activeStayChannels.get(guildId) === target;
}

function isStayActive(guildId) {
    return activeStayChannels.has(guildId);
}

function getStayTarget(guildId) {
    return activeStayChannels.get(guildId) || null;
}

function getReconnectDelayMs(attempts) {
    if (attempts <= 0) return BASE_RECONNECT_DELAY_MS;
    const backoff = BASE_RECONNECT_DELAY_MS * Math.pow(2, Math.min(attempts, 4));
    return Math.min(backoff, MAX_RECONNECT_DELAY_MS);
}

function scheduleReconnect(guildId, target, force = false) {
    if (force) target.forceReconnect = true;
    if (!isActiveStayTarget(guildId, target) || target.reconnecting || target.reconnectTimer) {
        return;
    }

    const delay = force ? BASE_RECONNECT_DELAY_MS : getReconnectDelayMs(target.reconnectAttempts);
    target.reconnectTimer = setTimeout(() => {
        target.reconnectTimer = null;
        const reconnect = target.forceReconnect ? reconnectStay : ensureStayConnection;
        target.forceReconnect = false;
        reconnect(guildId, target).catch(error => {
            console.error("[Stay] Failed to reconnect voice connection:", error);
        });
    }, delay);
}

function monitorConnection(guildId, target, connection) {
    monitoredConnections.set(connection, target);
    if (connection.__stayMonitored) return;
    connection.__stayMonitored = true;

    connection.on("stateChange", (oldState, newState) => {
        const currentTarget = monitoredConnections.get(connection);
        if (!currentTarget || !isActiveStayTarget(guildId, currentTarget)) return;

        if (oldState.status !== newState.status) {
            const detail = newState.status === STATUS_DISCONNECTED
                ? ` (reason=${newState.reason ?? "unknown"}, closeCode=${newState.closeCode ?? "none"})`
                : "";
            console.info(`[Stay] Guild ${guildId}: voice ${oldState.status} -> ${newState.status}${detail}.`);
        }

        if (newState.status === STATUS_READY) {
            currentTarget.unhealthySince = null;
            currentTarget.reconnectAttempts = 0;
        } else if (!currentTarget.unhealthySince) {
            currentTarget.unhealthySince = Date.now();
        }
    });

    connection.on(STATUS_DISCONNECTED, (oldState, newState) => {
        const currentTarget = monitoredConnections.get(connection);
        if (!currentTarget || !isActiveStayTarget(guildId, currentTarget)) return;
        if (currentTarget.reconnecting) return;

        const reason = newState?.reason ?? connection.state?.reason ?? "unknown";
        const closeCode = newState?.closeCode ?? connection.state?.closeCode ?? "none";
        currentTarget.lastDisconnectReason = `disconnected (reason=${reason}, closeCode=${closeCode})`;
        console.warn(`[Stay] Voice disconnected for guild ${guildId} (${currentTarget.lastDisconnectReason}); scheduling reconnect.`);
        scheduleReconnect(guildId, currentTarget);
    });

    if (STATUS_DESTROYED && STATUS_DESTROYED !== STATUS_DISCONNECTED) {
        connection.on(STATUS_DESTROYED, () => {
            const currentTarget = monitoredConnections.get(connection);
            if (!currentTarget || !isActiveStayTarget(guildId, currentTarget)) return;
            if (currentTarget.reconnecting) return;

            currentTarget.lastDisconnectReason = "connection destroyed unexpectedly";
            console.warn(`[Stay] Voice connection unexpectedly destroyed for guild ${guildId}; rejoining.`);
            scheduleReconnect(guildId, currentTarget, true);
        });
    }

    connection.on("error", error => {
        const currentTarget = monitoredConnections.get(connection);
        currentTarget && (currentTarget.lastError = error.message || String(error));
        console.error(`[Stay] Voice connection error in guild ${guildId}:`, error.message || error);
        if (currentTarget && isActiveStayTarget(guildId, currentTarget)) {
            scheduleReconnect(guildId, currentTarget);
        }
    });
}

function stopSilenceKeepAlive(target) {
    if (target.silenceRestartTimer) {
        clearTimeout(target.silenceRestartTimer);
        target.silenceRestartTimer = null;
    }
    if (target.silenceStream) {
        try {
            target.silenceStream.destroy();
        } catch (error) {
            // Ignore stream cleanup errors.
        }
        target.silenceStream = null;
    }
    if (target.silencePlayer) {
        try {
            target.silencePlayer.stop(true);
        } catch (error) {
            // Ignore player stop errors.
        }
        target.silencePlayer = null;
    }
}

function playSilenceResource(target, player) {
    if (target.silenceStream) {
        try {
            target.silenceStream.destroy();
        } catch (error) {
            // Ignore cleanup errors.
        }
    }
    const stream = new SilenceStream();
    stream.on("error", error => {
        console.error(`[Stay] Silent keepalive stream error in guild ${target.guild.id}:`, error.message || error);
    });
    target.silenceStream = stream;
    player.play(createAudioResource(stream, {
        inputType: StreamType.Opus
    }));
}

function scheduleSilenceRestart(guildId, target) {
    if (
        !isActiveStayTarget(guildId, target)
        || target.musicActive
        || target.reconnecting
        || target.silenceRestartTimer
    ) {
        return;
    }

    target.silenceRestartTimer = setTimeout(() => {
        target.silenceRestartTimer = null;
        if (!isActiveStayTarget(guildId, target) || target.musicActive || target.reconnecting) {
            return;
        }
        const connection = getVoiceConnection(guildId);
        if (connection && connection.state.status === STATUS_READY && connection.joinConfig.channelId === target.channelId) {
            startSilenceKeepAlive(target, connection);
        }
    }, SILENCE_RESTART_DELAY_MS);
}

function startSilenceKeepAlive(target, connection) {
    if (target.musicActive) return;
    stopSilenceKeepAlive(target);

    const guildId = target.guild.id;
    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });
    player.on("error", error => {
        console.error(`[Stay] Silent keepalive audio failed in guild ${guildId}:`, error.message || error);
        if (target.silencePlayer === player) {
            scheduleSilenceRestart(guildId, target);
        }
    });
    if (AudioPlayerStatus.Idle) {
        player.on(AudioPlayerStatus.Idle, () => {
            if (target.silencePlayer === player && isActiveStayTarget(guildId, target) && !target.musicActive) {
                scheduleSilenceRestart(guildId, target);
            }
        });
    }

    playSilenceResource(target, player);
    connection.subscribe(player);
    target.silencePlayer = player;
}

function pauseStayForMusic(guildId) {
    const target = activeStayChannels.get(guildId);
    if (!target) return false;
    target.musicActive = true;
    stopSilenceKeepAlive(target);
    return true;
}

function resumeStayAfterMusic(guildId) {
    const target = activeStayChannels.get(guildId);
    if (!target) return false;

    target.musicActive = false;
    const connection = getVoiceConnection(guildId);
    if (
        connection
        && connection.joinConfig.channelId === target.channelId
        && connection.state.status === STATUS_READY
    ) {
        target.connection = connection;
        monitorConnection(guildId, target, connection);
        startSilenceKeepAlive(target, connection);
        return true;
    }

    scheduleReconnect(guildId, target, true);
    return true;
}

function isConnectionHealthy(guildId, target) {
    const connection = getVoiceConnection(guildId);
    if (!connection) return false;
    if (connection.joinConfig.channelId !== target.channelId) return false;

    const status = connection.state.status;
    if (status === STATUS_READY) {
        const cachedVoiceState = target.guild.voiceStates?.cache?.get(target.botUserId);
        if (cachedVoiceState && cachedVoiceState.channelId !== target.channelId) {
            return false;
        }
        return true;
    }

    if (status === STATUS_SIGNALLING || status === STATUS_CONNECTING) {
        if (!target.unhealthySince) {
            target.unhealthySince = Date.now();
            return true;
        }
        return (Date.now() - target.unhealthySince) < STUCK_HANDSHAKE_TIMEOUT_MS;
    }

    return false;
}

async function ensureStayConnection(guildId, target) {
    if (!isActiveStayTarget(guildId, target) || target.reconnecting || target.reconnectTimer) {
        return;
    }

    if (!isConnectionHealthy(guildId, target)) {
        await reconnectStay(guildId, target);
        return;
    }

    if (!target.musicActive) {
        const connection = getVoiceConnection(guildId);
        if (connection && connection.state.status === STATUS_READY) {
            const hasSubscription = Boolean(connection.state?.subscription || connection.subscriber);
            if (!target.silencePlayer || !hasSubscription) {
                startSilenceKeepAlive(target, connection);
            }
        }
    }
}

function startWatchdog(guildId, target) {
    if (target.watchdog) clearInterval(target.watchdog);

    target.watchdog = setInterval(() => {
        if (!isActiveStayTarget(guildId, target) || target.reconnecting) {
            return;
        }

        ensureStayConnection(guildId, target).catch(error => {
            console.error("[Stay] Failed to maintain voice connection:", error);
        });
    }, WATCHDOG_INTERVAL_MS);
}

async function resolveFreshGuildAndChannel(target) {
    let guild = target.guild;
    if (target.client?.guilds) {
        guild = target.client.guilds.cache?.get(guild.id) || guild;
    }
    let channel = guild.channels?.cache?.get(target.channelId) || null;
    if (!channel && typeof guild.channels?.fetch === "function") {
        channel = await guild.channels.fetch(target.channelId).catch(() => null);
    }
    if (channel && channel.name) {
        target.channelName = channel.name;
    }
    target.guild = guild;
    if (guild.voiceAdapterCreator) {
        target.adapterCreator = guild.voiceAdapterCreator;
    }
    return { guild, channel };
}

async function reconnectStay(guildId, target) {
    if (!isActiveStayTarget(guildId, target) || target.reconnecting) {
        return;
    }

    target.reconnecting = true;
    let shouldRetry = false;
    try {
        stopSilenceKeepAlive(target);
        await resolveFreshGuildAndChannel(target);

        const existingConnection = getVoiceConnection(guildId);
        let connection = null;

        // First try in-place rejoin() when available so we avoid sending a gateway
        // channel_id: null packet that can race with an immediate joinVoiceChannel().
        if (
            existingConnection
            && existingConnection.joinConfig.channelId === target.channelId
            && existingConnection.state.status !== STATUS_DESTROYED
            && typeof existingConnection.rejoin === "function"
        ) {
            try {
                const rejoined = existingConnection.rejoin({
                    channelId: target.channelId,
                    selfDeaf: true,
                    selfMute: false
                });
                if (rejoined !== false) {
                    monitorConnection(guildId, target, existingConnection);
                    await entersState(existingConnection, STATUS_READY, REJOIN_TIMEOUT_MS);
                    connection = existingConnection;
                }
            } catch (rejoinError) {
                console.warn(`[Stay] In-place rejoin failed in guild ${guildId}; falling back to fresh join:`, rejoinError.message || rejoinError);
            }
        }

        if (!connection) {
            if (existingConnection && existingConnection.state.status !== STATUS_DESTROYED) {
                monitoredConnections.delete(existingConnection);
                existingConnection.destroy();
                await new Promise(resolve => setTimeout(resolve, DESTROY_SETTLE_DELAY_MS));
                if (!isActiveStayTarget(guildId, target)) {
                    return;
                }
            }

            connection = joinVoiceChannel({
                channelId: target.channelId,
                guildId,
                adapterCreator: target.adapterCreator,
                selfDeaf: true
            });
            target.connection = connection;
            monitorConnection(guildId, target, connection);
            await entersState(connection, STATUS_READY, 30_000);
        }

        target.connection = connection;
        target.unhealthySince = null;
        target.reconnectAttempts = 0;
        target.lastError = null;
        target.reconnectCount = (target.reconnectCount || 0) + 1;
        target.lastConnectedAt = new Date().toISOString();
        if (!target.musicActive) {
            startSilenceKeepAlive(target, connection);
        }
        console.info(`[Stay] Reconnected to channel ${target.channelId} in guild ${guildId}.`);
    } catch (error) {
        target.reconnectAttempts = (target.reconnectAttempts || 0) + 1;
        target.lastError = error.message || String(error);
        if (target.connection) {
            try {
                monitoredConnections.delete(target.connection);
                target.connection.destroy();
            } catch (destroyError) {
                // Ignore destroy errors.
            }
            target.connection = null;
        }
        console.error(`[Stay] Failed to restore voice connection in guild ${guildId} (attempt ${target.reconnectAttempts}):`, error.message || error);
        shouldRetry = true;
    } finally {
        target.reconnecting = false;
        if (shouldRetry || target.forceReconnect) {
            scheduleReconnect(guildId, target);
        }
    }
}

function stopStay(guildId, options = {}) {
    const { persist = true } = options;
    const target = activeStayChannels.get(guildId);
    if (target) {
        activeStayChannels.delete(guildId);
        if (target.reconnectTimer) clearTimeout(target.reconnectTimer);
        if (target.memberLeaveVerifyTimer) clearTimeout(target.memberLeaveVerifyTimer);
        if (target.watchdog) clearInterval(target.watchdog);
        stopSilenceKeepAlive(target);
    }

    if (persist) {
        removeStayTarget(guildId);
    }
    return Boolean(target);
}

async function handleStayVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild.id;
    const target = activeStayChannels.get(guildId);
    if (!target) return false;

    const botLeftTarget = newState.id === target.botUserId
        && oldState?.channelId === target.channelId
        && newState.channelId !== target.channelId;
    if (botLeftTarget) {
        // Ignore gateway echo from our own teardown while reconnectStay is actively running.
        if (target.reconnecting) return false;

        target.lastDisconnectReason = newState.channelId
            ? `moved to channel ${newState.channelId}`
            : "bot voice state cleared (disconnected/kicked)";
        console.warn(`[Stay] Bot left/moved from protected channel ${target.channelId} in guild ${guildId} (${target.lastDisconnectReason}); rejoining.`);
        scheduleReconnect(guildId, target, true);
        return true;
    }

    const memberLeftStayChannel = oldState?.channelId === target.channelId
        && newState.channelId !== target.channelId
        && newState.id !== target.botUserId;
    if (memberLeftStayChannel) {
        // Non-destructive follow-up check after a member leaves so if Discord drops
        // the empty voice session a moment later, the bot recovers promptly.
        if (target.memberLeaveVerifyTimer) {
            clearTimeout(target.memberLeaveVerifyTimer);
        }
        target.memberLeaveVerifyTimer = setTimeout(() => {
            target.memberLeaveVerifyTimer = null;
            if (!isActiveStayTarget(guildId, target) || target.reconnecting) return;
            ensureStayConnection(guildId, target).catch(error => {
                console.error("[Stay] Post-member-leave verification failed:", error);
            });
        }, MEMBER_LEAVE_VERIFY_DELAY_MS);
    }

    return false;
}

function isSupportedVoiceChannel(channel) {
    if (!channel) return false;
    if (typeof channel.isVoice === "function") return channel.isVoice();
    return channel.type === "GUILD_VOICE" || channel.type === "GUILD_STAGE_VOICE";
}

function checkVoicePermissions(voiceChannel, botMemberOrUser) {
    const permissions = voiceChannel.permissionsFor(botMemberOrUser);
    if (!permissions?.has("CONNECT")) {
        return { ok: false, error: "❌ Bot tidak punya izin untuk masuk ke voice channel tersebut." };
    }
    if (!permissions.has("SPEAK")) {
        return { ok: false, error: "❌ Bot tidak punya izin untuk mengirim audio di voice channel tersebut." };
    }
    return { ok: true };
}

async function startStay(guild, voiceChannel, botUserId, options = {}) {
    const {
        client = null,
        requestedBy = null,
        enabledAt = null,
        persist = true,
        retryOnInitialFailure = false
    } = options;

    const existingConnection = getVoiceConnection(guild.id);
    const activeTarget = activeStayChannels.get(guild.id);
    if (
        existingConnection?.joinConfig.channelId === voiceChannel.id
        && activeTarget?.connection === existingConnection
        && activeTarget.channelId === voiceChannel.id
    ) {
        if (persist) {
            saveStayTarget(guild.id, {
                channelId: voiceChannel.id,
                channelName: voiceChannel.name,
                requestedBy: requestedBy || activeTarget.requestedBy,
                enabledAt: activeTarget.enabledAt
            });
        }
        return false;
    }

    stopStay(guild.id, { persist: false });

    const startedAt = enabledAt || new Date().toISOString();
    const target = {
        channelId: voiceChannel.id,
        channelName: voiceChannel.name || "",
        adapterCreator: guild.voiceAdapterCreator,
        guild,
        client,
        botUserId,
        requestedBy,
        enabledAt: startedAt,
        lastConnectedAt: null,
        connection: existingConnection,
        reconnectTimer: null,
        memberLeaveVerifyTimer: null,
        silenceRestartTimer: null,
        silencePlayer: null,
        silenceStream: null,
        watchdog: null,
        reconnecting: false,
        forceReconnect: false,
        musicActive: false,
        unhealthySince: null,
        reconnectAttempts: 0,
        reconnectCount: 0,
        lastDisconnectReason: null,
        lastError: null
    };
    activeStayChannels.set(guild.id, target);

    if (persist) {
        saveStayTarget(guild.id, {
            channelId: voiceChannel.id,
            channelName: voiceChannel.name,
            requestedBy,
            enabledAt: startedAt
        });
    }

    if (existingConnection?.joinConfig.channelId === voiceChannel.id) {
        monitorConnection(guild.id, target, existingConnection);
        target.lastConnectedAt = new Date().toISOString();
        if (!existingConnection.state?.subscription) {
            startSilenceKeepAlive(target, existingConnection);
        }
        startWatchdog(guild.id, target);
        console.info(`[Stay] Protecting channel ${voiceChannel.id} in guild ${guild.id} (24/7).`);
        return false;
    }

    let connection;
    try {
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true
        });
        target.connection = connection;
        monitorConnection(guild.id, target, connection);
        await entersState(connection, STATUS_READY, 30_000);
        target.unhealthySince = null;
        target.reconnectAttempts = 0;
        target.lastConnectedAt = new Date().toISOString();
        startSilenceKeepAlive(target, connection);
        startWatchdog(guild.id, target);
        console.info(`[Stay] Connected to channel ${voiceChannel.id} in guild ${guild.id} (24/7).`);
        return true;
    } catch (error) {
        if (connection && connection !== existingConnection) {
            try {
                monitoredConnections.delete(connection);
                connection.destroy();
            } catch (destroyError) {
                // Ignore destroy errors.
            }
        }
        target.connection = null;

        if (retryOnInitialFailure) {
            target.reconnectAttempts = 1;
            startWatchdog(guild.id, target);
            scheduleReconnect(guild.id, target, true);
            console.warn(`[Stay] Initial restore connect failed for guild ${guild.id}; retrying automatically:`, error.message || error);
            return true;
        }

        stopStay(guild.id, { persist });
        throw error;
    }
}

async function fetchStayStoreFromGitHub() {
    if (!process.env.GITHUB_TOKEN) return {};

    try {
        const repository = process.env.GITHUB_REPOSITORY || "kikysena13/dc";
        const branch = process.env.GITHUB_BRANCH || "main";
        const remotePath = process.env.GITHUB_STAY_DATA_PATH || "data/voice-stay.json";
        const endpoint = `https://api.github.com/repos/${repository}/contents/${remotePath}?ref=${encodeURIComponent(branch)}`;
        const response = await fetch(endpoint, {
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                "X-GitHub-Api-Version": "2022-11-28"
            }
        });
        if (!response.ok) return {};
        const fileData = await response.json();
        if (!fileData?.content) return {};
        const decoded = Buffer.from(fileData.content, "base64").toString("utf8");
        const parsed = JSON.parse(decoded);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        console.error("[Stay] Failed to fetch voice-stay store from GitHub:", error.message);
        return {};
    }
}

async function restoreStayConnections(client) {
    const targetsByGuild = new Map();
    let persistedStore = readStayStore();
    if (Object.keys(persistedStore).length === 0 && process.env.GITHUB_TOKEN) {
        persistedStore = await fetchStayStoreFromGitHub();
    }

    for (const [guildId, entry] of Object.entries(persistedStore)) {
        if (entry && typeof entry.channelId === "string" && entry.channelId.trim()) {
            targetsByGuild.set(guildId, {
                channelId: entry.channelId.trim(),
                requestedBy: entry.requestedBy || null,
                enabledAt: entry.enabledAt || null,
                fromEnv: false
            });
        }
    }

    const envChannelId = (process.env.STAY_CHANNEL_ID || process.env.JAGA_CHANNEL_ID || "").trim();
    if (envChannelId) {
        const envGuildId = (
            process.env.STAY_GUILD_ID
            || process.env.JAGA_GUILD_ID
            || process.env.DISCORD_GUILD_ID
            || client.guilds?.cache?.first?.()?.id
            || ""
        ).trim();

        if (!envGuildId) {
            throw new Error("Set STAY_GUILD_ID, JAGA_GUILD_ID, or DISCORD_GUILD_ID to use STAY_CHANNEL_ID/JAGA_CHANNEL_ID.");
        }

        if (!targetsByGuild.has(envGuildId)) {
            targetsByGuild.set(envGuildId, {
                channelId: envChannelId,
                requestedBy: null,
                enabledAt: null,
                fromEnv: true
            });
        }
    }

    if (targetsByGuild.size === 0) {
        return false;
    }

    let restoredAny = false;
    for (const [guildId, config] of targetsByGuild.entries()) {
        try {
            const guild = client.guilds.cache.get(guildId)
                || (typeof client.guilds.fetch === "function" ? await client.guilds.fetch(guildId) : null);
            if (!guild) {
                console.warn(`[Stay] Guild ${guildId} not available during startup restore.`);
                continue;
            }

            const voiceChannel = guild.channels.cache.get(config.channelId)
                || (typeof guild.channels.fetch === "function" ? await guild.channels.fetch(config.channelId) : null);
            if (!isSupportedVoiceChannel(voiceChannel)) {
                const errMsg = `Channel ${config.channelId} is not a voice channel in guild ${guildId}.`;
                if (config.fromEnv) throw new Error(errMsg);
                console.warn(`[Stay] ${errMsg}`);
                continue;
            }

            const permissions = voiceChannel.permissionsFor(guild.me || client.user);
            if (!permissions?.has("CONNECT")) {
                const errMsg = `Bot does not have CONNECT permission for channel ${config.channelId}.`;
                if (config.fromEnv) throw new Error(errMsg);
                console.warn(`[Stay] ${errMsg}`);
                continue;
            }
            if (!permissions.has("SPEAK")) {
                const errMsg = `Bot does not have SPEAK permission for channel ${config.channelId}.`;
                if (config.fromEnv) throw new Error(errMsg);
                console.warn(`[Stay] ${errMsg}`);
                continue;
            }

            await startStay(guild, voiceChannel, client.user.id, {
                client,
                requestedBy: config.requestedBy,
                enabledAt: config.enabledAt,
                persist: !config.fromEnv,
                retryOnInitialFailure: true
            });
            restoredAny = true;
        } catch (error) {
            if (config.fromEnv) throw error;
            console.error(`[Stay] Failed to restore stay target for guild ${guildId}:`, error.message || error);
        }
    }

    return restoredAny;
}

function reconcileStayConnections(client) {
    for (const [guildId, target] of activeStayChannels.entries()) {
        if (client) target.client = client;
        if (!target.reconnecting) {
            ensureStayConnection(guildId, target).catch(error => {
                console.error(`[Stay] Failed to reconcile voice connection for guild ${guildId}:`, error.message || error);
            });
        }
    }
}

function formatDurationIndonesian(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} hari`);
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0) parts.push(`${minutes} menit`);
    if (parts.length === 0) parts.push(`${seconds} detik`);
    return parts.join(" ");
}

function parseStayCommand(content) {
    const trimmed = String(content || "").trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/\s+/);
    const first = parts[0].toLowerCase();
    const rest = parts.slice(1);

    if (first === "!jaga" && rest.length === 0) {
        return { action: "start", alias: "jaga", channelArg: null };
    }

    if ((first === "!unstay" || first === "unstay") && rest.length === 0) {
        return { action: "off", alias: first };
    }

    if (first !== "!stay" && first !== "stay") {
        return null;
    }

    const sub = (rest[0] || "").toLowerCase();
    if (!sub) {
        return { action: "start", alias: first, channelArg: null };
    }

    if (["off", "stop", "leave", "keluar", "mati", "disable"].includes(sub) && rest.length === 1) {
        return { action: "off", alias: first };
    }

    if (["status", "cek", "info"].includes(sub) && rest.length === 1) {
        return { action: "status", alias: first };
    }

    if (["help", "?"].includes(sub) && rest.length === 1) {
        return { action: "help", alias: first };
    }

    if (first === "!stay" && rest.length === 1) {
        const mentionMatch = rest[0].match(/^<#(\d+)>$|^(\d{15,25})$/);
        if (mentionMatch) {
            return {
                action: "start",
                alias: first,
                channelArg: mentionMatch[1] || mentionMatch[2]
            };
        }
    }

    return null;
}

async function resolveTargetVoiceChannel(message, channelArg) {
    if (!channelArg) {
        return message.member?.voice?.channel || null;
    }

    const cached = message.guild.channels?.cache?.get(channelArg);
    if (cached) return cached;
    if (typeof message.guild.channels?.fetch === "function") {
        return await message.guild.channels.fetch(channelArg).catch(() => null);
    }
    return null;
}

async function handleStayCommand(message) {
    const parsed = parseStayCommand(message.content);
    if (!parsed) return false;

    if (!message.guild) {
        await message.reply("❌ Command ini hanya bisa digunakan di server.");
        return true;
    }

    if (parsed.action === "help") {
        await message.reply([
            "📌 **Panduan Command Stay 24/7 Permanen**",
            "• `!stay` / `stay` — Bot masuk ke voice channel kamu dan stay 24/7 selamanya (auto-reconnect & auto-rejoin setelah restart).",
            "• `!stay <#channel atau ID>` — Bot langsung stay 24/7 di voice channel tertentu.",
            "• `!stay status` — Cek status mode stay 24/7 saat ini.",
            "• `!stay off` / `!unstay` / `!leave` — Matikan mode stay 24/7 dan keluarkan bot dari voice."
        ].join("\n"));
        return true;
    }

    if (parsed.action === "status") {
        const target = getStayTarget(message.guild.id);
        if (!target) {
            await message.reply("ℹ️ Mode **Stay 24/7** sedang **NONAKTIF**. Masuk voice channel lalu ketik `!stay` untuk mengaktifkan.");
            return true;
        }

        const connection = getVoiceConnection(message.guild.id);
        const connStatus = connection?.state?.status || "reconnecting";
        const elapsed = target.enabledAt ? Date.now() - Date.parse(target.enabledAt) : 0;
        const durationText = formatDurationIndonesian(elapsed);
        const channelLabel = target.channelName
            ? `**${target.channelName}** (<#${target.channelId}>)`
            : `<#${target.channelId}>`;

        const lines = [
            "🟢 **Mode Stay 24/7: AKTIF (Selamanya)**",
            `• Voice Channel: ${channelLabel}`,
            `• Status Koneksi: \`${connStatus}\``,
            `• Aktif Selama: **${durationText}**`,
            `• Total Auto-Reconnect: **${target.reconnectCount || 0}x**`
        ];
        if (target.lastDisconnectReason) {
            lines.push(`• Kejadian Putus Terakhir: \`${target.lastDisconnectReason}\``);
        }
        if (target.lastError) {
            lines.push(`• Error Terakhir: \`${target.lastError}\``);
        }
        lines.push("• Ketik `!stay off` atau `!unstay` jika ingin mematikan.");

        await message.reply(lines.join("\n"));
        return true;
    }

    if (parsed.action === "off") {
        const wasActive = stopStay(message.guild.id, { persist: true });
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
        }

        if (wasActive || connection) {
            await message.reply("👋 Mode **Stay 24/7** dimatikan. Bot keluar dari voice channel dan tidak akan auto-rejoin lagi.");
        } else {
            await message.reply("ℹ️ Mode **Stay 24/7** memang sedang tidak aktif dan bot tidak berada di voice channel.");
        }
        return true;
    }

    const voiceChannel = await resolveTargetVoiceChannel(message, parsed.channelArg);
    if (!voiceChannel) {
        await message.reply(parsed.channelArg
            ? "❌ Voice channel tidak ditemukan. Pastikan mention/ID voice channel benar."
            : "❌ Kamu harus masuk ke voice channel dulu (atau ketik `!stay <#channel>`).");
        return true;
    }

    if (!isSupportedVoiceChannel(voiceChannel)) {
        await message.reply("❌ Channel tersebut bukan voice channel.");
        return true;
    }

    const permCheck = checkVoicePermissions(voiceChannel, message.guild.me || message.client.user);
    if (!permCheck.ok) {
        await message.reply(permCheck.error);
        return true;
    }

    const previousTarget = getStayTarget(message.guild.id);
    const wasStayingElsewhere = Boolean(previousTarget && previousTarget.channelId !== voiceChannel.id);

    try {
        const connected = await startStay(message.guild, voiceChannel, message.client.user.id, {
            client: message.client,
            requestedBy: message.author?.id || null,
            persist: true
        });

        if (parsed.alias === "jaga") {
            await message.reply(connected
                ? `✅ Bot masuk ke **${voiceChannel.name}** dan akan tetap di sana selamanya (24/7) meskipun semua member keluar.`
                : "✅ Bot sudah berada di voice channel dan akan tetap di sana selamanya (24/7).");
        } else if (wasStayingElsewhere) {
            await message.reply(
                `✅ Bot pindah ke **${voiceChannel.name}** dan sekarang aktif **Stay 24/7 selamanya**! Bot akan otomatis reconnect jika terputus atau bot restart. Ketik \`!stay off\` untuk berhenti.`
            );
        } else if (connected) {
            await message.reply(
                `✅ Bot masuk ke **${voiceChannel.name}** dan sekarang aktif **Stay 24/7 selamanya**! Bot akan tetap di sana meskipun semua member keluar, otomatis balik jika terputus/dipindahkan, dan otomatis join lagi jika bot restart. Ketik \`!stay off\` untuk berhenti.`
            );
        } else {
            await message.reply(
                `✅ Bot sudah berada di **${voiceChannel.name}** dan aktif **Stay 24/7 selamanya**. Ketik \`!stay off\` jika ingin keluar.`
            );
        }
    } catch (error) {
        console.error("[Stay] Failed to join voice channel:", error);
        try {
            await message.reply("❌ Bot gagal masuk ke voice channel. Coba lagi sebentar.");
        } catch (replyError) {
            console.error("[Stay] Failed to send voice join error reply:", replyError);
        }
    }

    return true;
}

module.exports = {
    handleStayCommand,
    handleStayVoiceStateUpdate,
    restoreStayConnections,
    reconcileStayConnections,
    startStay,
    stopStay,
    isStayActive,
    getStayTarget,
    pauseStayForMusic,
    resumeStayAfterMusic,
    readStayStore,
    // Backward-compatible aliases for commands/jaga.js & existing callers
    handleJagaCommand: handleStayCommand,
    handleJagaVoiceStateUpdate: handleStayVoiceStateUpdate,
    startConfiguredJaga: restoreStayConnections,
    stopJaga: stopStay
};
