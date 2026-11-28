const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const { EventEmitter } = require("events");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reysie-voice-stay-"));
const stayDataFile = path.join(tempDirectory, "voice-stay.json");
process.env.STAY_DATA_FILE = stayDataFile;

let joinOptions = null;
let currentConnection = null;
let joinCount = 0;
let destroyCount = 0;
let createdPlayers = [];
let failNextJoinCount = 0;

const voiceStatesByGuild = new Map();
const guildVoiceStates = new Map();
const guildChannels = new Map();

const guild = {
    id: "guild-1",
    me: {},
    voiceAdapterCreator: "adapter",
    voiceStates: { cache: guildVoiceStates },
    channels: {
        cache: guildChannels,
        async fetch(channelId) {
            return guildChannels.get(channelId) || null;
        }
    }
};
voiceStatesByGuild.set(guild.id, guildVoiceStates);

const voiceChannel1 = {
    id: "111111111111111111",
    name: "Lobby 24/7",
    type: "GUILD_VOICE",
    permissionsFor() {
        return { has: permission => ["CONNECT", "SPEAK"].includes(permission) };
    }
};
const voiceChannel2 = {
    id: "222222222222222222",
    name: "VIP Lounge",
    type: "GUILD_VOICE",
    permissionsFor() {
        return { has: permission => ["CONNECT", "SPEAK"].includes(permission) };
    }
};
const textChannel = {
    id: "333333333333333333",
    name: "general-chat",
    type: "GUILD_TEXT",
    permissionsFor() {
        return { has: () => true };
    }
};
guildChannels.set(voiceChannel1.id, voiceChannel1);
guildChannels.set(voiceChannel2.id, voiceChannel2);
guildChannels.set(textChannel.id, textChannel);

function createMockConnection(channelId) {
    const conn = new EventEmitter();
    conn.joinConfig = { channelId };
    conn.state = { status: "ready", subscription: null };
    conn.subscribe = function subscribe(player) {
        this.subscriber = player;
        this.state.subscription = { player };
        return { player };
    };
    conn.destroy = function destroy() {
        destroyCount += 1;
        this.state.status = "destroyed";
        this.state.subscription = null;
        if (currentConnection === this) {
            currentConnection = null;
        }
        this.emit("destroyed");
    };
    return conn;
}

const mockVoice = {
    joinVoiceChannel(options) {
        joinOptions = options;
        joinCount += 1;
        const conn = createMockConnection(options.channelId);
        currentConnection = conn;
        voiceStatesByGuild.get(options.guildId)?.set("bot-1", { channelId: options.channelId });
        return conn;
    },
    VoiceConnectionStatus: {
        Ready: "ready",
        Disconnected: "disconnected",
        Destroyed: "destroyed",
        Signalling: "signalling",
        Connecting: "connecting"
    },
    AudioPlayerStatus: {
        Idle: "idle",
        Playing: "playing",
        Paused: "paused"
    },
    NoSubscriberBehavior: { Play: "play", Pause: "pause" },
    StreamType: { Opus: "opus" },
    createAudioPlayer() {
        const player = new EventEmitter();
        player.stopped = false;
        player.play = function play(resource) {
            this.resource = resource;
        };
        player.stop = function stop() {
            this.stopped = true;
        };
        createdPlayers.push(player);
        return player;
    },
    createAudioResource(stream, options) {
        return { stream, ...options };
    },
    async entersState(actualConnection, status, timeout) {
        assert.strictEqual(status, "ready");
        assert.strictEqual(timeout, 30_000);
        if (failNextJoinCount > 0) {
            failNextJoinCount -= 1;
            throw new Error("Simulated transient voice handshake timeout");
        }
        assert.strictEqual(actualConnection, currentConnection);
    },
    getVoiceConnection() {
        return currentConnection;
    }
};

const mockDiscord = {
    MessageEmbed: class MessageEmbed {
        setColor() { return this; }
        setTitle() { return this; }
        setDescription() { return this; }
        setThumbnail() { return this; }
        addFields() { return this; }
        setFooter() { return this; }
    }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "@discordjs/voice") return mockVoice;
    if (request === "discord.js") return mockDiscord;
    if (request === "play-dl") return {};
    if (request === "spotify-web-api-node") {
        return class SpotifyWebApi {
            setAccessToken() {}
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const {
    handleStayCommand,
    handleStayVoiceStateUpdate,
    restoreStayConnections,
    reconcileStayConnections,
    stopStay,
    isStayActive,
    getStayTarget,
    readStayStore
} = require("../commands/stay");
const { handlePlayMusicCommand, getQueue } = require("../commands/playmusic");

function createMessage(content, voiceChannel, replyError = null) {
    const replies = [];
    return {
        content,
        guild,
        author: { id: "user-1" },
        channel: { async send() {} },
        client: {
            user: { id: "bot-1" },
            guilds: {
                cache: {
                    get: guildId => (guildId === guild.id ? guild : null),
                    first: () => guild
                }
            }
        },
        member: { voice: { channel: voiceChannel } },
        replies,
        async reply(text) {
            replies.push(text);
            if (replyError) throw replyError;
        }
    };
}

async function run() {
    // 1. Unrelated chat messages containing "stay" must NOT trigger the command.
    for (const text of ["stay safe guys", "stay tune ya", "hello", "!stay something random"]) {
        const msg = createMessage(text, voiceChannel1);
        assert.strictEqual(await handleStayCommand(msg), false, `"${text}" should not trigger stay`);
        assert.deepStrictEqual(msg.replies, []);
    }

    // 2. !stay without being in voice prompts clearly.
    const noVoice = createMessage("!stay", null);
    assert.strictEqual(await handleStayCommand(noVoice), true);
    assert.match(noVoice.replies[0], /harus masuk ke voice channel/);

    // 3. !stay help works.
    const helpMsg = createMessage("!stay help", null);
    assert.strictEqual(await handleStayCommand(helpMsg), true);
    assert.match(helpMsg.replies[0], /Stay 24\/7/);

    // 4. Bare `!stay` uses the member's current voice channel and persists it.
    const stayMsg = createMessage("!stay", voiceChannel1);
    assert.strictEqual(await handleStayCommand(stayMsg), true);
    assert.strictEqual(joinCount, 1);
    assert.deepStrictEqual(joinOptions, {
        channelId: voiceChannel1.id,
        guildId: guild.id,
        adapterCreator: "adapter",
        selfDeaf: true
    });
    assert.strictEqual(isStayActive(guild.id), true);
    assert.strictEqual(createdPlayers.length, 1);
    assert.deepStrictEqual(createdPlayers[0].resource.stream.read(), Buffer.from([0xF8, 0xFF, 0xFE]));
    assert.strictEqual(createdPlayers[0].resource.inputType, "opus");
    assert.strictEqual(readStayStore()[guild.id].channelId, voiceChannel1.id);
    assert.match(stayMsg.replies[0], /Stay 24\/7 selamanya/);

    // 5. Rejects non-voice channel target.
    const badChannelMsg = createMessage(`!stay <#${textChannel.id}>`, null);
    assert.strictEqual(await handleStayCommand(badChannelMsg), true);
    assert.match(badChannelMsg.replies[0], /bukan voice channel/);

    // 6. !stay <#channelId> moves stay target to voiceChannel2 and updates persistence.
    const moveMsg = createMessage(`!stay <#${voiceChannel2.id}>`, null);
    assert.strictEqual(await handleStayCommand(moveMsg), true);
    assert.strictEqual(joinCount, 2);
    assert.strictEqual(getStayTarget(guild.id).channelId, voiceChannel2.id);
    assert.strictEqual(readStayStore()[guild.id].channelId, voiceChannel2.id);
    assert.match(moveMsg.replies[0], /pindah ke \*\*VIP Lounge\*\*/);

    // 7. !stay status reports active state.
    const statusMsg = createMessage("!stay status", null);
    assert.strictEqual(await handleStayCommand(statusMsg), true);
    assert.match(statusMsg.replies[0], /AKTIF/);
    assert.match(statusMsg.replies[0], /VIP Lounge/);

    // 8. Silence player auto-restarts if it unexpectedly goes Idle.
    const playersBeforeIdle = createdPlayers.length;
    const activePlayer = createdPlayers[createdPlayers.length - 1];
    activePlayer.emit("idle");
    await new Promise(resolve => setTimeout(resolve, 1150));
    assert.strictEqual(createdPlayers.length, playersBeforeIdle + 1, "silence keepalive should auto-restart after Idle");

    // 9. Music coexistence: !play from another channel is blocked while staying.
    const wrongChannelPlay = createMessage("!play lofi", voiceChannel1);
    assert.strictEqual(await handlePlayMusicCommand(wrongChannelPlay), true);
    assert.match(wrongChannelPlay.replies[0], /Stay 24\/7/);

    // 10. Music coexistence: !stop while staying must NOT destroy connection and must resume silence keepalive.
    const queue = getQueue(guild.id);
    queue.connection = currentConnection;
    queue.player = { stop() { this.stopped = true; } };
    queue.songs = [{ title: "Test Song" }];
    const destroysBeforeStop = destroyCount;
    const stopMusicMsg = createMessage("!stop", voiceChannel2);
    assert.strictEqual(await handlePlayMusicCommand(stopMusicMsg), true);
    assert.strictEqual(destroyCount, destroysBeforeStop, "!stop must not destroy voice connection while stay is active");
    assert.strictEqual(isStayActive(guild.id), true);
    assert.match(stopMusicMsg.replies[0], /tetap stay 24\/7/);

    // 11. Unexpected connection destruction while staying triggers auto-reconnect.
    const joinsBeforeDestroy = joinCount;
    currentConnection.destroy();
    await new Promise(resolve => setTimeout(resolve, 3150));
    assert.strictEqual(joinCount, joinsBeforeDestroy + 1, "bot must auto-rejoin if connection is unexpectedly destroyed");

    // 12. Bot moved out of channel triggers auto-reconnect right back to stay channel.
    assert.strictEqual(
        await handleStayVoiceStateUpdate(
            { channelId: voiceChannel1.id },
            { id: "bot-1", guild: { id: guild.id }, channelId: null }
        ),
        false,
        "a stale voice update from a different channel must not trigger stay reconnect"
    );
    const joinsBeforeMove = joinCount;
    guildVoiceStates.set("bot-1", { channelId: voiceChannel1.id });
    assert.strictEqual(
        await handleStayVoiceStateUpdate(
            { channelId: voiceChannel2.id },
            { id: "bot-1", guild: { id: guild.id }, channelId: voiceChannel1.id }
        ),
        true
    );
    await new Promise(resolve => setTimeout(resolve, 750));
    assert.strictEqual(joinCount, joinsBeforeMove + 1, "bot must snap back when moved out of stay channel");
    assert.strictEqual(currentConnection.joinConfig.channelId, voiceChannel2.id);

    // 13. Startup auto-restore from persisted JSON (even if initial voice handshake fails once!).
    stopStay(guild.id, { persist: false });
    if (currentConnection) currentConnection.destroy();
    assert.strictEqual(isStayActive(guild.id), false);
    assert.strictEqual(readStayStore()[guild.id].channelId, voiceChannel2.id, "persist:false should keep saved store");

    failNextJoinCount = 1;
    const joinsBeforeRestore = joinCount;
    const client = {
        user: { id: "bot-1" },
        guilds: {
            cache: {
                get: guildId => (guildId === guild.id ? guild : null),
                first: () => guild
            }
        }
    };
    assert.strictEqual(await restoreStayConnections(client), true);
    assert.strictEqual(isStayActive(guild.id), true, "stay must remain active and retry after transient boot failure");
    await new Promise(resolve => setTimeout(resolve, 3200));
    assert.strictEqual(joinCount, joinsBeforeRestore + 2, "startup restore must automatically retry after failure");
    assert.strictEqual(currentConnection.joinConfig.channelId, voiceChannel2.id);

    // 14. Explicit Railway config overrides a stale persisted channel for its guild.
    stopStay(guild.id, { persist: false });
    if (currentConnection) currentConnection.destroy();
    const previousStayChannelId = process.env.STAY_CHANNEL_ID;
    const previousStayGuildId = process.env.STAY_GUILD_ID;
    process.env.STAY_CHANNEL_ID = voiceChannel1.id;
    process.env.STAY_GUILD_ID = guild.id;
    assert.strictEqual(await restoreStayConnections(client), true);
    assert.strictEqual(getStayTarget(guild.id).channelId, voiceChannel1.id);
    assert.strictEqual(currentConnection.joinConfig.channelId, voiceChannel1.id);
    if (previousStayChannelId === undefined) delete process.env.STAY_CHANNEL_ID;
    else process.env.STAY_CHANNEL_ID = previousStayChannelId;
    if (previousStayGuildId === undefined) delete process.env.STAY_GUILD_ID;
    else process.env.STAY_GUILD_ID = previousStayGuildId;

    // 15. Gateway reconcile heals dropped connections.
    currentConnection = null;
    const joinsBeforeReconcile = joinCount;
    reconcileStayConnections(client);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(joinCount, joinsBeforeReconcile + 1, "reconcileStayConnections should heal missing voice connection");

    // 16. !stay off disables stay, removes persisted entry, and disconnects.
    const offMsg = createMessage("!stay off", null);
    assert.strictEqual(await handleStayCommand(offMsg), true);
    assert.strictEqual(isStayActive(guild.id), false);
    assert.strictEqual(currentConnection, null);
    assert.deepStrictEqual(readStayStore(), {});
    assert.match(offMsg.replies[0], /dimatikan/);

    // 17. !stay status now shows inactive.
    const inactiveStatus = createMessage("!stay status", null);
    assert.strictEqual(await handleStayCommand(inactiveStatus), true);
    assert.match(inactiveStatus.replies[0], /NONAKTIF/);

    // 18. A failed voice join must not become an unhandled rejection if its reply fails.
    failNextJoinCount = 1;
    const replyFailure = new Error("Channel is not cached");
    const failedJoinMsg = createMessage(`!stay <#${voiceChannel1.id}>`, null, replyFailure);
    assert.strictEqual(await handleStayCommand(failedJoinMsg), true);
    assert.strictEqual(isStayActive(guild.id), false);

    console.log("Stay 24/7 command tests passed.");
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        stopStay(guild.id, { persist: false });
        Module._load = originalLoad;
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });
