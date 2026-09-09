const { setProfileBackground, setProfileBio, getPoints, getRoleSpending } = require("./whellevi");

const URL_PATTERN = /^https?:\/\/\S+$/i;
const VALID_CROP_POSITIONS = new Set([
    "center",
    "top",
    "bottom",
    "left",
    "right",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "center-left",
    "center-right",
    "center left",
    "center right",
    "top left",
    "top right",
    "bottom left",
    "bottom right"
]);

function parseCropPosition(value) {
    if (!value) return null;

    const normalized = value.trim().toLowerCase().replace(/^crop\s*[:=]?\s*/i, "");
    const words = normalized.split(/\s+/).filter(Boolean);
    if (!words.length) return null;

    if (words.length === 1) {
        return VALID_CROP_POSITIONS.has(words[0]) ? words[0] : null;
    }

    if (words.length === 2) {
        const combinedHyphen = `${words[0]}-${words[1]}`;
        if (VALID_CROP_POSITIONS.has(combinedHyphen)) return combinedHyphen;

        const combinedSpace = `${words[0]} ${words[1]}`;
        if (VALID_CROP_POSITIONS.has(combinedSpace)) return combinedSpace;
    }

    return null;
}

function extractBackgroundUrl(input) {
    if (!input) return { url: null, crop: null };

    const trimmed = input.trim();
    const markdownMatch = trimmed.match(/^\[[^\]]+\]\((https?:\/\/[^\s)]+)\)(.*)$/i);
    if (markdownMatch) {
        return { url: markdownMatch[1], crop: parseCropPosition(markdownMatch[2]) };
    }

    const rawUrlMatch = trimmed.match(/^(https?:\/\/\S+)(.*)$/i);
    if (rawUrlMatch) {
        return { url: rawUrlMatch[1], crop: parseCropPosition(rawUrlMatch[2]) };
    }

    return { url: null, crop: null };
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
        const synced = await setProfileBio(message.author.id, message.author.username, bio);
        await message.reply(synced
            ? "Bio profil berhasil disimpan permanen ke GitHub."
            : "Bio profil tersimpan di server, tetapi belum tersinkron ke GitHub. Pastikan GITHUB_TOKEN sudah diatur di Railway.");
        return true;
    }

    const memberRoles = message.member?.roles.cache.map(role => role.name) || [];
    const points = getPoints()[message.author.id] || {};
    const theme = getRoleSpending(points, memberRoles);
    if (!theme || theme.normalizedAmount < 10000000) {
        await message.reply("Background GIF/foto hanya bisa diinput setelah mencapai tema 3 dengan spending minimal 10.000.000.");
        return true;
    }

    const { url: backgroundUrl, crop } = extractBackgroundUrl(parts.slice(1).join(" "));
    if (!backgroundUrl || !URL_PATTERN.test(backgroundUrl)) {
        return true;
    }

    const synced = await setProfileBackground(message.author.id, message.author.username, backgroundUrl, crop);
    await message.reply(synced
        ? `Background profil berhasil disimpan permanen${crop ? ` dengan crop ${crop}` : ""}. Tema akan tampil di leaderboard setelah refresh.`
        : "Background profil tersimpan di server, tetapi belum tersinkron ke GitHub. Pastikan GITHUB_TOKEN sudah diatur di Railway.");
    return true;
}

module.exports = { handleInputCommand };