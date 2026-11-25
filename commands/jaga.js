const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");

const activeJagaChannels = new Map();
const RECONNECT_DELAY_MS = 3000;
const WATCHDOG_INTERVAL_MS = 3000;

function isActiveJaga(guildId, target) {
    return activeJagaChannels.get(guildId) === target;
}

function scheduleReconnect(guildId, target, force = false) {
    if (force) target.forceReconnect = true;
    if (!isActiveJaga(guildId, target) || target.reconnecting || target.reconnectTimer) {
        return;
    }

    target.reconnectTimer = setTimeout(() => {
        target.reconnectTimer = null;
        const reconnect = target.forceReconnect ? reconnectJaga : ensureJagaConnection;
        target.forceReconnect = false;
        reconnect(guildId, target).catch(error => {
            console.error("Failed to reconnect !jaga voice connection:", error);
        });
    }, RECONNECT_DELAY_MS);
}

function monitorConnection(guildId, target, connection) {
    connection.on("stateChange", (oldState, newState) => {
        if (oldState.status !== newState.status) {
            console.info(`[Jaga] Guild ${guildId}: voice ${oldState.status} -> ${newState.status}.`);
        }
    });
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        console.warn(`[Jaga] Voice disconnected for guild ${guildId}; retrying.`);
        scheduleReconnect(guildId, target);
    });
}

function isConnectionHealthy(guildId, target) {
    const connection = getVoiceConnection(guildId);
    return Boolean(
        connection
        && connection.joinConfig.channelId === target.channelId
        && connection.state.status === VoiceConnectionStatus.Ready
    );
}

async function ensureJagaConnection(guildId, target) {
    if (
        isActiveJaga(guildId, target)
        && !target.reconnecting
        && !target.reconnectTimer
        && !isConnectionHealthy(guildId, target)
    ) {
        await reconnectJaga(guildId, target);
    }
}

function startWatchdog(guildId, target) {
    if (target.watchdog) clearInterval(target.watchdog);

    target.watchdog = setInterval(() => {
        if (!isActiveJaga(guildId, target) || target.reconnecting) {
            return;
        }

        ensureJagaConnection(guildId, target).catch(error => {
            console.error("Failed to maintain !jaga voice connection:", error);
        });
    }, WATCHDOG_INTERVAL_MS);
}

async function reconnectJaga(guildId, target) {
    if (!isActiveJaga(guildId, target) || target.reconnecting) {
        return;
    }

    target.reconnecting = true;
    let shouldRetry = false;
    try {
        const existingConnection = getVoiceConnection(guildId);
        if (existingConnection) {
            existingConnection.destroy();
        }

        const connection = joinVoiceChannel({
            channelId: target.channelId,
            guildId,
            adapterCreator: target.adapterCreator,
            selfDeaf: true
        });
        target.connection = connection;
        monitorConnection(guildId, target, connection);
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        console.info(`[Jaga] Reconnected to channel ${target.channelId} in guild ${guildId}.`);
    } catch (error) {
        if (target.connection) {
            target.connection.destroy();
            target.connection = null;
        }
        console.error("Failed to restore !jaga voice connection:", error);
        shouldRetry = true;
    } finally {
        target.reconnecting = false;
        if (shouldRetry || target.forceReconnect) scheduleReconnect(guildId, target);
    }
}

function stopJaga(guildId) {
    const target = activeJagaChannels.get(guildId);
    if (!target) return;

    activeJagaChannels.delete(guildId);
    if (target.reconnectTimer) clearTimeout(target.reconnectTimer);
    if (target.watchdog) clearInterval(target.watchdog);
}

async function handleJagaVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild.id;
    const target = activeJagaChannels.get(guildId);
    if (!target) return false;

    const botLeftTarget = newState.id === target.botUserId && newState.channelId !== target.channelId;
    if (!botLeftTarget) return false;

    console.warn(`[Jaga] Bot left protected channel ${target.channelId} in guild ${guildId}.`);
    scheduleReconnect(guildId, target, true);
    return true;
}

async function startJaga(guild, voiceChannel, botUserId) {
    const existingConnection = getVoiceConnection(guild.id);
    const activeTarget = activeJagaChannels.get(guild.id);
    if (
        existingConnection?.joinConfig.channelId === voiceChannel.id
        && activeTarget?.connection === existingConnection
        && activeTarget.channelId === voiceChannel.id
    ) {
        return false;
    }

    stopJaga(guild.id);
    const target = {
        channelId: voiceChannel.id,
        adapterCreator: guild.voiceAdapterCreator,
        guild,
        botUserId,
        connection: existingConnection,
        reconnectTimer: null,
        reconnecting: false,
        forceReconnect: false
    };
    activeJagaChannels.set(guild.id, target);

    if (existingConnection?.joinConfig.channelId === voiceChannel.id) {
        monitorConnection(guild.id, target, existingConnection);
        startWatchdog(guild.id, target);
        console.info(`[Jaga] Protecting channel ${voiceChannel.id} in guild ${guild.id}.`);
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
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        startWatchdog(guild.id, target);
        console.info(`[Jaga] Connected to channel ${voiceChannel.id} in guild ${guild.id}.`);
        return true;
    } catch (error) {
        if (connection && connection !== existingConnection) {
            connection.destroy();
        }
        stopJaga(guild.id);
        throw error;
    }
}

async function startConfiguredJaga(client) {
    const channelId = process.env.JAGA_CHANNEL_ID;
    if (!channelId) return false;

    const guildId = process.env.JAGA_GUILD_ID
        || process.env.DISCORD_GUILD_ID
        || client.guilds.cache.first()?.id;
    if (!guildId) {
        throw new Error("Set JAGA_GUILD_ID or DISCORD_GUILD_ID to use JAGA_CHANNEL_ID.");
    }

    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const voiceChannel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId);
    if (!voiceChannel || voiceChannel.type !== "GUILD_VOICE") {
        throw new Error(`JAGA_CHANNEL_ID ${channelId} is not a voice channel in guild ${guildId}.`);
    }

    const permissions = voiceChannel.permissionsFor(guild.me || client.user);
    if (!permissions?.has("CONNECT")) {
        throw new Error(`Bot does not have CONNECT permission for JAGA_CHANNEL_ID ${channelId}.`);
    }

    await startJaga(guild, voiceChannel, client.user.id);
    return true;
}

async function handleJagaCommand(message) {
    if (message.content.trim().toLowerCase() !== "!jaga") {
        return false;
    }

    if (!message.guild) {
        await message.reply("❌ Command ini hanya bisa digunakan di server.");
        return true;
    }

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
        await message.reply("❌ Kamu harus masuk ke voice channel dulu.");
        return true;
    }

    const permissions = voiceChannel.permissionsFor(message.guild.me || message.client.user);
    if (!permissions?.has("CONNECT")) {
        await message.reply("❌ Bot tidak punya izin untuk masuk ke voice channel tersebut.");
        return true;
    }

    try {
        const connected = await startJaga(message.guild, voiceChannel, message.client.user.id);
        await message.reply(connected
            ? `✅ Bot masuk ke **${voiceChannel.name}** dan akan tetap di sana meskipun semua member keluar.`
            : "✅ Bot sudah berada di voice channel dan akan tetap di sana.");
    } catch (error) {
        console.error("Failed to join voice channel for !jaga:", error);
        await message.reply("❌ Bot gagal masuk ke voice channel. Coba lagi sebentar.");
    }

    return true;
}

module.exports = {
    handleJagaCommand,
    handleJagaVoiceStateUpdate,
    startConfiguredJaga,
    stopJaga
};