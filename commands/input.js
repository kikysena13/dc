const { setProfileBackground, setProfileBio, getPoints, getRoleSpending } = require("./whellevi");

const URL_PATTERN = /^https?:\/\/\S+$/i;

function extractBackgroundUrl(input) {
    if (!input) return null;

    const trimmed = input.trim();
    const markdownMatch = trimmed.match(/^\[[^\]]+\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownMatch) {
        return markdownMatch[1];
    }

    const rawMatch = trimmed.match(/^https?:\/\/\S+$/i);
    if (rawMatch) {
        return trimmed;
    }

    return null;
}

async function handleInputCommand(message) {
    const parts = message.content.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const isBioCommand = ["!addinputbio", "addinputbio"].includes(command);
    const isBackgroundCommand = ["!addinput", "addinput"].includes(command);
    if (!isBioCommand && !isBackgroundCommand) return false;

    if (isBioCommand) {
        const bio = parts.slice(1).join(" ").trim();
        if (!bio || bio.length > 120) {
            await message.reply("Bio harus berisi 1-120 karakter. Gunakan: `!addinputbio bio kamu`");
            return true;
        }
        setProfileBio(message.author.id, message.author.username, bio);
        await message.reply("Bio profil berhasil disimpan.");
        return true;
    }

    const memberRoles = message.member?.roles.cache.map(role => role.name) || [];
    const points = getPoints()[message.author.id] || {};
    const theme = getRoleSpending(points, memberRoles);
    if (!theme || theme.normalizedAmount < 10000000) {
        await message.reply("Background GIF/foto hanya bisa diinput setelah mencapai tema 3 dengan spending minimal 10.000.000.");
        return true;
    }

    const backgroundUrl = extractBackgroundUrl(parts.slice(1).join(" "));
    if (!backgroundUrl || !URL_PATTERN.test(backgroundUrl)) {
        await message.reply("Gunakan: `!addinput https://domain.com/gambar-atau-gif`.");
        return true;
    }

    setProfileBackground(message.author.id, message.author.username, backgroundUrl);
    await message.reply("Background profil berhasil disimpan. Tema akan tampil di leaderboard setelah refresh.");
    return true;
}

module.exports = { handleInputCommand };