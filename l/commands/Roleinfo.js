const Discord = require("discord.js");

const ROLE_DESCRIPTIONS = {
    "OWNER": "Pemilik server dengan akses penuh terhadap seluruh fitur dan pengaturan Midnight Lounge.",
    "OWNER ✪": "Pemilik server dengan akses penuh terhadap seluruh fitur dan pengaturan Midnight Lounge.",
    "Admin": "Administrator utama yang bertugas mengelola server, member, serta seluruh sistem komunitas.",
    "IT_server": "Tim pengembang yang bertanggung jawab atas bot, website, sistem, dan fitur teknis server.",
    "MenHub👥": "Staff yang bertugas menjaga ketertiban server serta membantu pengelolaan komunitas.",
    "MEMBER VIP": "Role yang diberikan kepada member yang melakukan Discord Server Boost. Member VIP mendapatkan akses ke channel booster dan benefit eksklusif.",
    "unknown-role": "Role yang diberikan kepada member yang aktif dan berkontribusi dalam mempromosikan server. Member dengan role ini dapat memperoleh akses ke channel khusus, event eksklusif, dan benefit tambahan.",
    "MEMBER": "Role dasar yang diberikan kepada seluruh member setelah bergabung di Midnight Lounge.",
    "WHELL": "Role komunitas khusus yang diberikan kepada member yang melakukan pengeluaran besar dalam game gacha yang tersedia di server dan telah diverifikasi.",
    "LEVIA": "Role komunitas khusus yang diberikan kepada member yang melakukan pengeluaran besar dalam game yang tersedia di server dan telah diverifikasi.",
    "Staff Verify": "Role yang diberikan kepada staff yang telah diverifikasi untuk membantu mengelola server.",
    "Malaikat subuh": "Role yang diberikan kepada member yang ikut mempromosikan server dengan memasang link server di bio.",
};

function getRoleDescription(role) {
	return ROLE_DESCRIPTIONS[role.name] || "Role komunitas dengan akses dan fungsi sesuai pengaturan server.";
}

function getConfiguredRoles(guild) {
	return Object.keys(ROLE_DESCRIPTIONS)
		.map(roleName => guild.roles.cache.find(role =>
			role.name.trim().toLowerCase() === roleName.trim().toLowerCase()
		))
		.filter(Boolean)
		.sort((firstRole, secondRole) => secondRole.position - firstRole.position);
}

function createRoleInfoEmbed(roles) {
	if (!roles.length) {
		return new Discord.MessageEmbed()
			.setColor("#6a0dad")
			.setTitle("📌 ROLE INFORMATION")
			.setDescription("Belum ada role yang tersedia.")
			.setFooter({ text: "Informasi role server" })
			.setTimestamp();
	}

	const roleDescriptions = roles.map(role =>
		`<@&${role.id}>\n> ${getRoleDescription(role)}`
	).join("\n\n");

	return new Discord.MessageEmbed()
		.setColor(roles[0].color || "#6a0dad")
		.setTitle("📌 ROLE INFORMATION")
		.setDescription(`Berikut adalah role yang tersedia di server dan fungsinya.\n\n${roleDescriptions}`)
		.setFooter({ text: "Informasi role server" })
		.setTimestamp();
}

async function handleRoleInfoCommand(message) {
	const command = message.content.trim().toLowerCase().split(/\s+/)[0];
	const validCommands = ["!roleml", "roleml"];

	if (!validCommands.includes(command)) {
		return false;
	}

	if (!message.guild) {
		await message.reply("Command ini hanya bisa digunakan di dalam server.");
		return true;
	}

	const roles = getConfiguredRoles(message.guild);

	if (!roles.length) {
		await message.reply(
			`Role yang ditulis di Roleinfo.js belum ditemukan di server. Pastikan nama role sama persis dengan: ${Object.keys(ROLE_DESCRIPTIONS).join(", ")}`
		);
		return true;
	}

	const embed = createRoleInfoEmbed(roles);
	await message.reply({
		content: "@everyone",
		embeds: [embed],
		allowedMentions: {
			parse: ["everyone"],
			roles: roles.map(role => role.id)
		}
	}).catch(error => console.error(error));

	return true;
}

module.exports = {
	handleRoleInfoCommand
};
