const Discord = require("discord.js");

function getWebsiteUrl() {
	return process.env.WEBSITE_URL || "https://kikysena13.github.io/dc/";
}

function createWebsiteEmbed() {
	return new Discord.MessageEmbed()
		.setColor("#45d9d0")
		.setTitle("Good Time Game Leaderboard")
		.setDescription(
			"Lihat peringkat keaktifan member, statistik XP, aktivitas chat, dan aktivitas voice di dashboard komunitas Good Time Game."
		)
		.addFields(
			{
				name: "Fitur dashboard",
				value: "Leaderboard overall, chat, voice, bulanan, statistik member, dan periode musim aktif."
			},
			{
				name: "Akses",
				value: "Website bersifat view-only dan tidak mengubah data Discord."
			}
		)
		.setFooter({ text: "Good Time Game • Pantau kontribusimu" })
		.setTimestamp();
}

async function handleWebCommand(message) {
	const content = message.content.toLowerCase().trim();
	const command = content.split(/\s+/)[0];
	const validCommands = ["!website", "!web", "!rank", "website", "web", "rank"];

	if (!validCommands.includes(command)) {
		return false;
	}

	const websiteUrl = getWebsiteUrl();
	const button = new Discord.MessageButton()
		.setLabel("Buka Leaderboard")
		.setStyle("LINK")
		.setURL(websiteUrl);

	await message.reply({
		embeds: [createWebsiteEmbed()],
		components: [new Discord.MessageActionRow().addComponents(button)]
	}).catch(error => console.error("Gagal mengirim link website:", error));

	return true;
}

module.exports = {
	handleWebCommand
};
