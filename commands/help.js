const { MessageEmbed } = require("discord.js");

const HELP_PAGES = [
	{
		title: "🤖 AI Chat",
		description: [
			"`!ai <pertanyaan>` — Bertanya atau mengobrol dengan AI.",
			"Reply ke pesan **Reysie-Chan** untuk melanjutkan percakapan.",
			"Mention bot + pesan untuk memulai obrolan."
		].join("\n")
	},
	{
		title: "🎵 Musik",
		description: [
			"`!play <judul/url>` / `!p <judul/url>` — Putar lagu, YouTube/Spotify, atau playlist.",
			"`!pause`, `!resume`, `!skip` / `!s`, `!stop` — Kontrol playback.",
			"`!queue` / `!q`, `!nowplaying` / `!np` — Lihat queue atau lagu aktif.",
			"`!loop`, `!loopqueue` / `!lq` — Atur loop lagu atau seluruh queue.",
			"`!shuffle`, `!remove <nomor>`, `!clear` — Atur isi queue.",
			"`!leave` / `!dc` / `!disconnect` — Keluar dari voice channel.",
			"`!musichelp` / `!help music` — Bantuan musik lebih lengkap."
		].join("\n")
	},
	{
		title: "🧰 Informasi & Utility",
		description: [
			"`!help` / `!commands` — Tampilkan daftar semua command bot.",
			"`music` / `!music` — Daftar lagu.",
			"`!randomcode [panjang] [jumlah] [tipe]` — Membuat kode acak; panjang 1–50, jumlah 1–10. Tipe: `alphanumeric`, `uppercase`, `lowercase`, `numbers`, `hex`.",
			"`!randomcode help` — Bantuan generator kode. Alias: `!code`, `!gencode`, `!buatcode` (juga tersedia tanpa `!`).",
			"`!rules` / `!rule` — Peraturan server. `!rules help` — Bantuan rules.",
			"`!roleml` — Informasi role server.",
			"`!task` / `!tasks` / `!todo` — Daftar tugas dan informasi profil.",
			"`!website` / `!web` / `!rank` — Link dashboard leaderboard.",
			"`!spenderlb` — Link Top WHELL & LEVIA. `!arenalb` — Link Arena.",
			"`input` / `!input` / `format` / `!format` — Contoh format member manual.",
			"`list` / `!list` — Daftar member manual dengan pagination.",
			"`test` — Tes respons bot."
		].join("\n")
	},
	{
		title: "📢 Pengumuman & Arena",
		description: [
			"`!annoucnment <isi>` — Pengumuman SERVER UPDATE.",
			"`!arenaannouncmnet <isi>` — Pengumuman ARENA UPDATE.",
			"`!arenaevent <detail event>` — Umumkan event Arena dimulai.",
			"Ketiga command ini menyebut `@everyone` dan memerlukan izin **Manage Messages**."
		].join("\n")
	},
	{
		title: "💰 Spending WHELL / LEVIA",
		description: [
			"`!whellevi add @member <nominal> [RP/$] <WHELL/LEVIA>` — Tambahkan spending.",
			"`!whellevi set @member <nominal> [RP/$] <WHELL/LEVIA>` — Atur total spending.",
			"`!whellevi cek @member` — Lihat spending.",
			"`!whellevi reset @member <WHELL/LEVIA>` — Reset salah satu role.",
			"`!whellevi resetall @member` — Reset kedua role.",
			"Alias: `whellevi`, `!whelevi`, `whelevi`, `!spending`, `spending`.",
			"Memerlukan izin **Manage Server**."
		].join("\n")
	},
	{
		title: "🖼️ Profil Member",
		description: [
			"`!addinputbio <bio>` — Simpan bio (1–120 karakter). Alias: `addinputbio`.",
			"`!addinput <url> [crop=posisi]` — Atur background profil. Alias: `addinput`.",
			"Crop: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center-left`, `center-right`.",
			"Background memerlukan spending minimal 10.000.000."
		].join("\n")
	}
];

async function handleHelpCommand(message) {
	const parts = message.content.trim().toLowerCase().split(/\s+/);
	const command = parts[0];

	if (!["!help", "help", "!commands", "commands"].includes(command)) {
		return false;
	}

	// The music handler provides its own detailed help for this subcommand.
	if ((command === "!help" || command === "help") && parts[1] === "music") {
		return false;
	}

	const embeds = HELP_PAGES.map((page) => new MessageEmbed()
		.setColor("#5865F2")
		.setTitle(page.title)
		.setDescription(page.description));

	await message.reply({
		content: "📚 **Daftar command bot yang tersedia** (bantuan musik: `!help music`)",
		embeds
	});
	return true;
}

module.exports = { handleHelpCommand };
