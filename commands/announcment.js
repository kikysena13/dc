const Discord = require("discord.js");

function createAnnouncementEmbed(text, author, title, color) {
	return new Discord.MessageEmbed()
		.setColor(color)
		.setTitle(title)
		.setDescription(text)
		.setFooter({ text: `Announcement by ${author.tag}` })
		.setTimestamp();
}

async function handleAnnouncementCommand(message) {
	const commandMatch = message.content.match(/^(!annoucnment|!arenaannouncmnet)(?:\s|$)/i);
	const command = commandMatch?.[1]?.toLowerCase();

	if (command !== "!annoucnment" && command !== "!arenaannouncmnet") {
		return false;
	}

	if (!message.member?.permissions.has("MANAGE_MESSAGES")) {
		await message.reply("Kamu tidak memiliki izin untuk membuat pengumuman.");
		return true;
	}

	const announcement = message.content.slice(commandMatch[0].length).trim();
	if (!announcement) {
		const usage = command === "!arenaannouncmnet"
			? "!arenaannouncmnet isi pengumuman arena"
			: "!annoucnment isi pengumuman update";
		await message.reply(`Gunakan: \`${usage}\``);
		return true;
	}

	const isArenaAnnouncement = command === "!arenaannouncmnet";
	await message.channel.send({
		content: "@everyone",
		embeds: [createAnnouncementEmbed(
			announcement,
			message.author,
			isArenaAnnouncement ? "⚔️ ARENA UPDATE" : "📢 SERVER UPDATE",
			isArenaAnnouncement ? "#e74c3c" : "#f1c40f"
		)],
		allowedMentions: { parse: ["everyone"] }
	}).catch(error => console.error(error));

	return true;
    
}

module.exports = {
	handleAnnouncementCommand
};  
