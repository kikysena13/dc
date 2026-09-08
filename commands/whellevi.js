const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "whellevi-points.json");
const ROLE_NAMES = {
	WHELL: "whellRp",
	LEVIA: "leviaRp",
	LEVIATHAN: "leviaRp"
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

function normalizeRole(value) {
	return value?.trim().toUpperCase();
}

function formatRp(value) {
	return new Intl.NumberFormat("id-ID").format(value);
}

function getHelpMessage() {
	return [
		"**Pencatatan spending WHELL/LEVIA**",
		"`!whellevi add @member 150000 WHELL` - tambah spending",
		"`!whellevi set @member 150000 LEVIA` - atur total spending",
		"`!whellevi reset @member WHELL` - hapus poin role tersebut",
		"`!whellevi cek @member` - lihat total spending"
	].join("\n");
}

async function handleWhellLeviCommand(message) {
	const parts = message.content.trim().split(/\s+/);
	const command = parts[0]?.toLowerCase();
	if (!["!whellevi", "whellevi", "!spending", "spending"].includes(command)) return false;

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
		await message.reply(`${target} — WHELL: **$${formatRp(points.whellRp || 0)}**, LEVIA: **$${formatRp(points.leviaRp || 0)}**`);
		return true;
	}

	if (!["add", "set", "reset"].includes(action)) {
		await message.reply(getHelpMessage());
		return true;
	}

	const roleName = normalizeRole(parts[action === "reset" ? 3 : 4]);
	const pointsKey = ROLE_NAMES[roleName];
	if (!target || !pointsKey) {
		await message.reply(getHelpMessage());
		return true;
	}

	const points = readPoints();
	const memberPoints = points[target.id] || { username: target.user.username, whellRp: 0, leviaRp: 0 };
	if (action === "reset") {
		memberPoints[pointsKey] = 0;
	} else {
		const amount = Number(parts[3]?.replace(/[^0-9]/g, ""));
		if (!Number.isSafeInteger(amount) || amount < 0) {
			await message.reply("Nominal spending harus berupa angka bulat positif.");
			return true;
		}
		memberPoints[pointsKey] = action === "add" ? (memberPoints[pointsKey] || 0) + amount : amount;
	}

	memberPoints.username = target.user.username;
	points[target.id] = memberPoints;
	writePoints(points);
	await message.reply(`${target} sekarang memiliki **$${formatRp(memberPoints[pointsKey])}** untuk role ${roleName}.`);
	return true;
}

module.exports = { handleWhellLeviCommand, getPoints };
