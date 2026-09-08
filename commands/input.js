const { setProfileBackground, getPoints } = require("./whellevi");

const URL_PATTERN = /^https?:\/\/\S+$/i;

async function handleInputCommand(message) {
    const parts = message.content.trim().split(/\s+/);
    if (!["!addinput", "addinput"].includes(parts[0]?.toLowerCase())) return false;

    const memberRoles = message.member?.roles.cache.map(role => role.name.toUpperCase()) || [];
    if (!memberRoles.includes("WHELL") && !memberRoles.includes("LEVIA") && !memberRoles.includes("LEVIATHAN")) {
        await message.reply("Command ini khusus member dengan role WHELL atau LEVIA.");
        return true;
    }

    const backgroundUrl = parts[1];
    if (!backgroundUrl || !URL_PATTERN.test(backgroundUrl)) {
        await message.reply("Gunakan: `!addinput https://domain.com/gambar-atau-gif`.");
        return true;
    }

    const points = getPoints()[message.author.id];
    if (!points || (!points.whellRp && !points.leviaRp)) {
        await message.reply("Kamu belum memiliki spending yang tercatat.");
        return true;
    }

    setProfileBackground(message.author.id, message.author.username, backgroundUrl);
    await message.reply("Background profil berhasil disimpan. Tema akan tampil di leaderboard setelah refresh.");
    return true;
}

module.exports = { handleInputCommand };