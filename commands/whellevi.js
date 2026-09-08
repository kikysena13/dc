const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "whellevi-points.json");
const ROLE_NAMES = {
	WHELL: "whellRp",
	LEVIA: "leviaRp",
	LEVIATHAN: "leviaRp"
};
const CURRENCY_NAMES = new Set(["RP", "$"]);
const USD_TO_RP = 50000000 / 3000;
const THEME_THRESHOLDS = {
	exclusive: 30000000,
	custom: 15000000,
	silver: 10000000
};

function readPoints() {
	try {
		return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw error;
	}
}

function writePoints(points) {
	fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
	fs.writeFileSync(DATA_FILE, JSON.stringify(points, null, 2) + "\n");
}

function getPoints() {
	return readPoints();
}

function setProfileBackground(userId, username, backgroundUrl) {
	const points = readPoints();
	const memberPoints = points[userId] || { username, whellRp: 0, leviaRp: 0 };
	memberPoints.username = username;
	memberPoints.profileBackground = backgroundUrl;
	points[userId] = memberPoints;
	writePoints(points);
}

function setProfileBio(userId, username, bio) {
	const points = readPoints();
	const memberPoints = points[userId] || { username, whellRp: 0, leviaRp: 0 };
	memberPoints.username = username;
	memberPoints.bio = bio;
	points[userId] = memberPoints;
	writePoints(points);
}

function getRoleSpending(points, roles, preferredRole = null) {
	const normalizedPreferredRole = normalizeRole(preferredRole);
	const role = normalizedPreferredRole
		? roles.find(name => normalizeRole(name) === normalizedPreferredRole || (normalizedPreferredRole === "LEVIA" && normalizeRole(name) === "LEVIATHAN"))
		: roles.find(name => ["WHELL", "LEVIA", "LEVIATHAN"].includes(normalizeRole(name)));
	if (!role) return null;
	const isWhell = normalizeRole(role) === "WHELL";
	const amount = isWhell ? points.whellRp || 0 : points.leviaRp || 0;
	const currency = isWhell ? points.whellCurrency || "$" : points.leviaCurrency || "$";
	const normalizedAmount = currency === "RP" ? amount : amount * USD_TO_RP;
	if (normalizedAmount < THEME_THRESHOLDS.silver) return null;
	let tier = "silver";
	if (normalizedAmount >= THEME_THRESHOLDS.exclusive) tier = "exclusive";
	else if (normalizedAmount >= THEME_THRESHOLDS.custom) tier = "custom";
	return { role: normalizeRole(role), amount, normalizedAmount, currency, tier, background: points.profileBackground || "" };
}

function normalizeRole(value) {
	return value?.trim().toUpperCase();
}

function formatRp(value) {
	return new Intl.NumberFormat("id-ID").format(value);
}

function formatSpending(value, currency = "$") {
	return currency === "RP" ? `Rp ${formatRp(value)}` : `$${formatRp(value)}`;
}

function getHelpMessage() {
	return [
		"**Pencatatan spending WHELL/LEVIA**",
		"`!whellevi add @member 150000 RP WHELL` - tambah spending",
		"`!whellevi set @member $150000 LEVIA` - atur total spending",
		"`!whellevi reset @member WHELL` - hapus poin role tersebut",
		"`!whellevi resetall @member` - hapus total WHELL dan LEVIA",
		"`!whellevi cek @member` - lihat total spending"
	].join("\n");
}

async function handleWhellLeviCommand(message) {
	const parts = message.content.trim().split(/\s+/);
	const command = parts[0]?.toLowerCase();
	if (!["!whellevi", "whellevi", "!whelevi", "whelevi", "!spending", "spending"].includes(command)) return false;

	if (!message.guild) {
		await message.reply("Command ini hanya bisa digunakan di dalam server.");
		return true;
	}

	if (!message.member.permissions.has("MANAGE_GUILD")) {
		await message.reply("Hanya moderator dengan izin Manage Server yang dapat mengubah spending.");
		return true;
	}

	const action = parts[1]?.toLowerCase();
	const target = message.mentions.members.first() || message.guild.members.cache.get(parts[2]);
	if (action === "cek") {
		const points = readPoints()[target?.id];
		if (!target || !points) {
			await message.reply("Member tidak ditemukan atau belum memiliki catatan spending.");
			return true;
		}
		await message.reply(`${target} — WHELL: **${formatSpending(points.whellRp || 0, points.whellCurrency)}**, LEVIA: **${formatSpending(points.leviaRp || 0, points.leviaCurrency)}**`);
		return true;
	}
	if (action === "resetall") {
		if (!target) {
			await message.reply(getHelpMessage());
			return true;
		}
		const points = readPoints();
		const memberPoints = points[target.id] || { username: target.user.username };
		memberPoints.whellRp = 0;
		memberPoints.leviaRp = 0;
		memberPoints.whellCurrency = "$";
		memberPoints.leviaCurrency = "$";
		memberPoints.role = null;
		memberPoints.username = target.user.username;
		points[target.id] = memberPoints;
		writePoints(points);
		await message.reply(`${target} total spending WHELL dan LEVIA berhasil direset.`);
		return true;
	}

	if (!["add", "set", "reset"].includes(action)) {
		await message.reply(getHelpMessage());
		return true;
	}

	const argumentStart = action === "reset" ? 3 : 3;
	const amountInput = parts[argumentStart] || "";
	const possibleCurrency = normalizeRole(parts[argumentStart + 1]);
	const currency = CURRENCY_NAMES.has(possibleCurrency)
		? possibleCurrency
		: amountInput.trim().startsWith("$") ? "$" : "$";
	const roleIndex = CURRENCY_NAMES.has(possibleCurrency) ? argumentStart + 2 : argumentStart + 1;
	const roleName = normalizeRole(parts[action === "reset" ? 3 : roleIndex]);
	const pointsKey = ROLE_NAMES[roleName];
	if (!target || !pointsKey) {
		await message.reply(getHelpMessage());
		return true;
	}

	const points = readPoints();
	const memberPoints = points[target.id] || { username: target.user.username, whellRp: 0, leviaRp: 0 };
	if (action === "reset") {
		memberPoints[pointsKey] = 0;
		memberPoints[`${roleName === "WHELL" ? "whell" : "levia"}Currency`] = currency;
	} else {
		const amount = Number(amountInput.replace(/[^0-9]/g, ""));
		if (!Number.isSafeInteger(amount) || amount < 0) {
			await message.reply("Nominal spending harus berupa angka bulat positif.");
			return true;
		}
		memberPoints[pointsKey] = action === "add" ? (memberPoints[pointsKey] || 0) + amount : amount;
		memberPoints[`${roleName === "WHELL" ? "whell" : "levia"}Currency`] = currency;
	}

	memberPoints.role = roleName;
	memberPoints.username = target.user.username;
	points[target.id] = memberPoints;
	writePoints(points);
	await message.reply(`${target} sekarang memiliki **${formatSpending(memberPoints[pointsKey], currency)}** untuk role ${roleName}.`);
	return true;
}

module.exports = { handleWhellLeviCommand, getPoints, setProfileBackground, setProfileBio, getRoleSpending, THEME_THRESHOLDS };
