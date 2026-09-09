const Discord = require("discord.js");

function createAnnouncementEmbed(text, author) {
	return new Discord.MessageEmbed()
		.setColor("#f1c40f")
		.setTitle("📢 SERVER UPDATE")
		.setDescription(text)
		.setFooter({ text: `Announcement by ${author.tag}` })
		.setTimestamp();
}

async function handleAnnouncementCommand(message) {
	const commandMatch = message.content.match(/^(!annoucnment)(?:\s|$)/i);
	const command = commandMatch?.[1]?.toLowerCase();

	if (command !== "!annoucnment") {
		return false;
	}

	if (!message.member?.permissions.has("MANAGE_MESSAGES")) {
		await message.reply("Kamu tidak memiliki izin untuk membuat pengumuman.");
		return true;
	}

	const announcement = message.content.slice(commandMatch[0].length).trim();
	if (!announcement) {
		await message.reply("Gunakan: `!annoucnment isi pengumuman update`");
		return true;
	}

	await message.channel.send({
		content: "@everyone",
		embeds: [createAnnouncementEmbed(announcement, message.author)],
		allowedMentions: { parse: ["everyone"] }
	}).catch(error => console.error(error));

	return true;
    
}

module.exports = {
	handleAnnouncementCommand
};  
