const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");

const activeJagaChannels = new Map();
const RECONNECT_DELAY_MS = 3000;

function isActiveJaga(guildId, target) {
    return activeJagaChannels.get(guildId) === target;
}

function scheduleReconnect(guildId, target) {
    if (!isActiveJaga(guildId, target) || target.reconnecting || target.reconnectTimer) {
        return;
    }

    target.reconnectTimer = setTimeout(() => {
        target.reconnectTimer = null;
        reconnectJaga(guildId, target).catch(error => {
            console.error("Failed to reconnect !jaga voice connection:", error);
        });
    }, RECONNECT_DELAY_MS);
}

function monitorConnection(guildId, target, connection) {
    connection.on(VoiceConnectionStatus.Disconnected, () => {
        scheduleReconnect(guildId, target);
    });
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
    } catch (error) {
        if (target.connection) {
            target.connection.destroy();
            target.connection = null;
        }
        console.error("Failed to restore !jaga voice connection:", error);
        shouldRetry = true;
    } finally {
        target.reconnecting = false;
        if (shouldRetry) scheduleReconnect(guildId, target);
    }
}

function stopJaga(guildId) {
    const target = activeJagaChannels.get(guildId);
    if (!target) return;

    activeJagaChannels.delete(guildId);
    if (target.reconnectTimer) clearTimeout(target.reconnectTimer);
}

async function handleJagaVoiceStateUpdate(oldState, newState) {
    const guildId = newState.guild.id;
    const target = activeJagaChannels.get(guildId);
    if (!target || newState.id !== target.botUserId || newState.channelId === target.channelId) {
        return false;
    }

    await reconnectJaga(guildId, target);
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

    const existingConnection = getVoiceConnection(message.guild.id);
    const activeTarget = activeJagaChannels.get(message.guild.id);
    if (
        existingConnection?.joinConfig.channelId === voiceChannel.id
        && activeTarget?.connection === existingConnection
        && activeTarget.channelId === voiceChannel.id
    ) {
        await message.reply("✅ Bot sudah berada di voice channel dan akan tetap di sana.");
        return true;
    }

    stopJaga(message.guild.id);
    const target = {
        channelId: voiceChannel.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        botUserId: message.client.user.id,
        connection: existingConnection,
        reconnectTimer: null,
        reconnecting: false
    };
    activeJagaChannels.set(message.guild.id, target);

    if (existingConnection?.joinConfig.channelId === voiceChannel.id) {
        monitorConnection(message.guild.id, target, existingConnection);
        await message.reply("✅ Bot sudah berada di voice channel dan akan tetap di sana.");
        return true;
    }

    let connection;
    try {
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: true
        });
        target.connection = connection;
        monitorConnection(message.guild.id, target, connection);
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
        if (connection && connection !== existingConnection) {
            connection.destroy();
        }
        stopJaga(message.guild.id);
        console.error("Failed to join voice channel for !jaga:", error);
        await message.reply("❌ Bot gagal masuk ke voice channel. Coba lagi sebentar.");
        return true;
    }

    await message.reply(`✅ Bot masuk ke **${voiceChannel.name}** dan akan tetap di sana meskipun semua member keluar.`);
    return true;
}

module.exports = {
    handleJagaCommand,
    handleJagaVoiceStateUpdate,
    stopJaga
};