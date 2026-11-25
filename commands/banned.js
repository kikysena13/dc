const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "voice-bans.json");

function readBans(filePath = DATA_FILE) {
    if (!fs.existsSync(filePath)) return {};

    const bans = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!bans || typeof bans !== "object" || Array.isArray(bans)) {
        throw new Error("Format data voice-ban tidak valid.");
    }

    return bans;
}

function writeBans(bans, filePath = DATA_FILE) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(bans, null, 2), "utf8");
}

async function handleVoiceBanCommand(message, filePath = DATA_FILE) {
    const commandMatch = message.content.match(/^!(ban|unban)(?=\s|<@|$)/i);
    if (!commandMatch) return false;

    if (!message.guild || !message.member) {
        await message.reply("Command ini hanya bisa digunakan di server Discord.");
        return true;
    }

    if (!message.member.permissions.has("MANAGE_GUILD")) {
        await message.reply("Kamu memerlukan izin Manage Server untuk menggunakan command ini.");
        return true;
    }

    const targetMatch = message.content.slice(commandMatch[0].length).match(/<@!?(\d+)>/);
    if (!targetMatch) {
        const usage = commandMatch[1].toLowerCase() === "ban" ? "!ban @member" : "!unban @member";
        await message.reply(`Gunakan: \`${usage}\``);
        return true;
    }

    const userId = targetMatch[1];
    const guildId = message.guild.id;

    try {
        const bans = readBans(filePath);
        const guildBans = Array.isArray(bans[guildId]) ? bans[guildId] : [];
        const isBanCommand = commandMatch[1].toLowerCase() === "ban";

        if (isBanCommand && guildBans.includes(userId)) {
            await message.reply(`<@${userId}> sudah diblokir dari voice.`);
            return true;
        }

        if (!isBanCommand && !guildBans.includes(userId)) {
            await message.reply(`<@${userId}> tidak ada dalam daftar blokir voice.`);
            return true;
        }

        bans[guildId] = isBanCommand
            ? [...guildBans, userId]
            : guildBans.filter(id => id !== userId);
        if (bans[guildId].length === 0) delete bans[guildId];
        writeBans(bans, filePath);

        await message.reply(isBanCommand
            ? `<@${userId}> sekarang diblokir dari voice dan akan dikeluarkan jika masuk.`
            : `<@${userId}> sudah diizinkan masuk voice kembali.`);
    } catch (error) {
        console.error("[VoiceBan] Gagal memperbarui daftar blokir:", error);
        await message.reply("Gagal menyimpan daftar blokir voice. Coba lagi nanti.");
    }

    return true;
}

async function handleBannedVoiceStateUpdate(oldState, newState, filePath = DATA_FILE) {
    if (!newState.guild || !newState.channelId || oldState.channelId === newState.channelId) {
        return false;
    }

    const bans = readBans(filePath);
    const userId = newState.id;
    if (!Array.isArray(bans[newState.guild.id]) || !bans[newState.guild.id].includes(userId)) {
        return false;
    }

    if (!newState.member?.voice) {
        throw new Error(`Voice state member ${userId} tidak tersedia untuk dikeluarkan.`);
    }

    await newState.member.voice.disconnect("User diblokir dari voice oleh moderator");
    console.info(`[VoiceBan] Mengeluarkan user ${userId} dari voice di server ${newState.guild.id}.`);
    return true;
}

module.exports = {
    handleVoiceBanCommand,
    handleBannedVoiceStateUpdate
};