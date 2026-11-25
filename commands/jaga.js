const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection
} = require("@discordjs/voice");

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
    if (existingConnection?.joinConfig.channelId === voiceChannel.id) {
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
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
        if (connection && connection !== existingConnection) {
            connection.destroy();
        }
        console.error("Failed to join voice channel for !jaga:", error);
        await message.reply("❌ Bot gagal masuk ke voice channel. Coba lagi sebentar.");
        return true;
    }

    await message.reply(`✅ Bot masuk ke **${voiceChannel.name}** dan akan tetap di sana meskipun semua member keluar.`);
    return true;
}

module.exports = { handleJagaCommand };