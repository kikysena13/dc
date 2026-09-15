const Discord = require("discord.js");

function getWebsiteUrl() {
	return process.env.WEBSITE_URL || "https://kikysena13.github.io/dc/";
}

function createWebsiteEmbed(title, description, buttonLabel) {
	return new Discord.MessageEmbed()
		.setColor("#45d9d0")
		.setTitle(title)
		.setDescription(description)
		.addFields({
			name: "Akses",
			value: "Website bersifat view-only dan tidak mengubah data Discord."
		})
		.setFooter({ text: "Midnight Lounge • Pantau kontribusimu" })
		.setTimestamp();
}

async function handleWebCommand(message) {
	const content = message.content.toLowerCase().trim();
	const command = content.split(/\s+/)[0];
	const commandSettings = {
		"!spenderlb": {
			view: "spending",
			title: "Top Whell & Levia",
			description: "Lihat leaderboard spending tertinggi untuk role Whell dan Levia.",
			buttonLabel: "Buka Top Whell & Levia"
		},
		"!arenalb": {
			view: "arena",
			title: "Midnight Arena",
			description: "Lihat bracket dan status turnamen Arena yang sedang berlangsung.",
			buttonLabel: "Buka Arena"
		}
	};
	const defaultSettings = {
		view: "dashboard",
		title: "Midnight Lounge Leaderboard",
		description: "Lihat peringkat keaktifan member, statistik XP, aktivitas chat, dan aktivitas voice di dashboard komunitas Good Time Game.",
		buttonLabel: "Buka Leaderboard"
	};
	const settings = commandSettings[command] || defaultSettings;
	const validCommands = ["!website", "!web", "!rank", "website", "web", "rank", ...Object.keys(commandSettings)];

	if (!validCommands.includes(command)) {
		return false;
	}

	const websiteUrl = new URL(getWebsiteUrl());
	if (settings.view !== "dashboard") {
		websiteUrl.searchParams.set("view", settings.view);
	}
	const button = new Discord.MessageButton()
		.setLabel(settings.buttonLabel)
		.setStyle("LINK")
		.setURL(websiteUrl.toString());

	await message.reply({
		embeds: [createWebsiteEmbed(settings.title, settings.description, settings.buttonLabel)],
		components: [new Discord.MessageActionRow().addComponents(button)]
	}).catch(error => console.error("Gagal mengirim link website:", error));

	return true;
}

module.exports = {
	handleWebCommand
};
