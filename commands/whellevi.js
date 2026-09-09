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
	const serializedPoints = JSON.stringify(points, null, 2) + "\n";
	fs.writeFileSync(DATA_FILE, serializedPoints);
	return queueGitHubPersistence(serializedPoints);
}

let githubSyncQueue = Promise.resolve();

function queueGitHubPersistence(serializedPoints) {
	if (!process.env.GITHUB_TOKEN) return Promise.resolve();

	githubSyncQueue = githubSyncQueue
		.then(async () => {
			const repository = process.env.GITHUB_REPOSITORY || "kikysena13/dc";
			const branch = process.env.GITHUB_BRANCH || "main";
			const filePath = process.env.GITHUB_DATA_PATH || "data/whellevi-points.json";
			const endpoint = `https://api.github.com/repos/${repository}/contents/${filePath}`;
			const headers = {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
				"X-GitHub-Api-Version": "2022-11-28"
			};

			const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
			if (!currentResponse.ok) throw new Error(`GitHub read failed with ${currentResponse.status}`);
			const currentFile = await currentResponse.json();
			const updateResponse = await fetch(endpoint, {
				method: "PUT",
				headers: { ...headers, "Content-Type": "application/json" },
				body: JSON.stringify({
					message: "Update profile data from Discord",
					content: Buffer.from(serializedPoints, "utf8").toString("base64"),
					branch,
					sha: currentFile.sha
				})
			});
			if (!updateResponse.ok) throw new Error(`GitHub write failed with ${updateResponse.status}`);
		})
		.catch(error => console.error("GitHub profile data sync failed:", error.message));
}

function getPoints() {
	return readPoints();
}

function normalizeBackgroundUrl(backgroundUrl) {
	if (!backgroundUrl) return "";

	const trimmed = backgroundUrl.trim();
	if (/^https?:\/\/media\.tenor\.com\//i.test(trimmed)) {
		return trimmed;
	}

	const legacyTenorMatch = trimmed.match(/^https?:\/\/c\.tenor\.com\/([^/?#]+)\/([^/?#]+)$/i);
	if (legacyTenorMatch) {
		return `https://media.tenor.com/${legacyTenorMatch[1]}/${legacyTenorMatch[2]}`;
	}

	const tenorMatch = trimmed.match(/^https?:\/\/tenor\.com\/(?:view\/)?([^/?#]+)(?:\.[^/?#]+)?(?:[?#].*)?$/i);
	if (tenorMatch) {
		const assetId = tenorMatch[1].replace(/\.(gif|png|jpg|jpeg|webp)$/i, "");
		return `https://media.tenor.com/${assetId}.gif`;
	}

	return trimmed;
}

async function setProfileBackground(userId, username, backgroundUrl, cropPosition = null) {
	const points = readPoints();
	const memberPoints = points[userId] || { username, whellRp: 0, leviaRp: 0 };
	memberPoints.username = username;
	memberPoints.profileBackground = normalizeBackgroundUrl(backgroundUrl);
	memberPoints.profileBackgroundPosition = cropPosition || memberPoints.profileBackgroundPosition || "center";
	points[userId] = memberPoints;
	await writePoints(points);
}

async function setProfileBio(userId, username, bio) {
	const points = readPoints();
	const memberPoints = points[userId] || { username, whellRp: 0, leviaRp: 0 };
	memberPoints.username = username;
	memberPoints.bio = bio;
	points[userId] = memberPoints;
	await writePoints(points);
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
	return {
		role: normalizeRole(role),
		amount,
		normalizedAmount,
		currency,
		tier,
		background: normalizeBackgroundUrl(points.profileBackground),
		backgroundPosition: points.profileBackgroundPosition || "center"
	};
}

function normalizeRole(value) {
	return value?.trim().toUpperCase();
}

function formatRp(value) {
	return new Intl.NumberFormat("id-ID").format(value);
}

function parseAmountInput(value) {
	const trimmed = String(value || "").trim();
	if (!trimmed) return null;

	const normalized = trimmed.replace(/[^0-9,\.\-]/g, "");
	if (!normalized || normalized === "-") return null;

	if (normalized.includes(",") && normalized.includes(".")) {
		if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
			return Number(normalized.replace(/\./g, "").replace(",", "."));
		}
		return Number(normalized.replace(/,/g, ""));
	}

	if (normalized.includes(",")) {
		const parts = normalized.split(",");
		if (parts.length === 2) {
			if (parts[1].length <= 2) {
				return Number(`${parts[0]}.${parts[1]}`);
			}
			return Number(parts.join(""));
		}
		if (parts.length > 2) {
			const lastPart = parts[parts.length - 1];
			if (lastPart.length <= 2) {
				return Number(`${parts.slice(0, -1).join("")}.${lastPart}`);
			}
			return Number(parts.join(""));
		}
	}

	if (normalized.includes(".")) {
		const parts = normalized.split(".");
		if (parts.length === 2) {
			if (parts[1].length <= 2) {
				return Number(normalized);
			}
			return Number(parts.join(""));
		}
		if (parts.length > 2) {
			const lastPart = parts[parts.length - 1];
			if (lastPart.length <= 2) {
				return Number(`${parts.slice(0, -1).join("")}.${lastPart}`);
			}
			return Number(parts.join(""));
		}
	}

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

function formatSpending(value, currency = "$") {
	if (currency === "RP") {
		return `Rp ${formatRp(value)}`;
	}

	return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
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
		await writePoints(points);
		await message.reply(`${target} total spending WHELL dan LEVIA berhasil direset.`);
		return true;
	}

	if (!["add", "set", "reset"].includes(action)) {
		await message.reply(getHelpMessage());
		return true;
	}

	let amountInput = "";
	let currencyToken = "$";
	let roleName = null;

	if (action === "reset") {
		roleName = normalizeRole(parts[3]);
	} else {
		amountInput = parts[3] || "";
		const rawCurrencyToken = normalizeRole(parts[4]);
		const hasCurrencyToken = rawCurrencyToken && ["RP", "$", "DOLLAR", "USD"].includes(rawCurrencyToken);

		if (hasCurrencyToken) {
			currencyToken = rawCurrencyToken === "DOLLAR" || rawCurrencyToken === "USD" ? "$" : rawCurrencyToken;
			roleName = normalizeRole(parts[5]);
		} else {
			roleName = normalizeRole(parts[4]);
		}
	}

	const pointsKey = ROLE_NAMES[roleName];
	if (!target || !pointsKey) {
		await message.reply(getHelpMessage());
		return true;
	}

	const points = readPoints();
	const memberPoints = points[target.id] || { username: target.user.username, whellRp: 0, leviaRp: 0 };
	if (action === "reset") {
		memberPoints[pointsKey] = 0;
		memberPoints[`${roleName === "WHELL" ? "whell" : "levia"}Currency`] = currencyToken;
	} else {
		const amount = parseAmountInput(amountInput);
		if (amount === null || amount < 0 || !Number.isFinite(amount)) {
			await message.reply("Nominal spending harus berupa angka bulat positif.");
			return true;
		}
		memberPoints[pointsKey] = action === "add" ? (memberPoints[pointsKey] || 0) + amount : amount;
		memberPoints[`${roleName === "WHELL" ? "whell" : "levia"}Currency`] = currencyToken;
	}

	memberPoints.role = roleName;
	memberPoints.username = target.user.username;
	points[target.id] = memberPoints;
	await writePoints(points);
	const currentCurrency = memberPoints[roleName === "WHELL" ? "whellCurrency" : "leviaCurrency"] || "$";
	await message.reply(`${target} sekarang memiliki **${formatSpending(memberPoints[pointsKey], currentCurrency)}** untuk role ${roleName}.`);
	return true;
}

module.exports = { handleWhellLeviCommand, getPoints, setProfileBackground, setProfileBio, getRoleSpending, THEME_THRESHOLDS };
