const Discord = require("discord.js");

const TASK_LIST = [
    { task: "Finish project report", deadline: "2026-08-12" },
    { task: "Review Discord bot code", deadline: "2026-08-14" },
    { task: "Upload college assignment", deadline: "2026-08-16" },
    { task: "Team development meeting", deadline: "2026-08-18" }
];

function formatTaskList(tasks) {
    return tasks
        .map((item, index) => `**${index + 1}.** ${item.task} — Deadline: ${item.deadline}`)
        .join("\n");
}

function createTaskEmbed(member, mention) {
    const joinedAt = member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:d>` : "-";
    const user = member?.user || member;
    const createdAt = user?.createdAt ? `<t:${Math.floor(user.createdAt.getTime() / 1000)}:d>` : "-";

    return new Discord.MessageEmbed()
        .setColor("#ff9900")
        .setAuthor({ name: `${user.tag || user.username}`, iconURL: user.displayAvatarURL ? user.displayAvatarURL({ dynamic: true }) : null })
        .setTitle("Urgent Tasks to Complete")
        .setDescription(formatTaskList(TASK_LIST))
        .addFields(
            { name: "Name", value: `${user.username || "-"}`, inline: true },
            { name: "User ID", value: `${user.id || "-"}`, inline: true },
            { name: "Account Created", value: `${createdAt}`, inline: true },
            { name: "Discriminator", value: `${user.discriminator || "-"}`, inline: true },
            { name: "Joined Server", value: `${joinedAt}`, inline: true },
            { name: "Mention", value: `${mention}`, inline: true },
            { name: "Total Projects", value: `${TASK_LIST.length}`, inline: true },
            { name: "Login", value: "https://huaxu.app/senakiki", inline: false }
        )
        .setFooter({ text: "Yusuf Al Fikri Jayasena-Indonesia" })
        .setTimestamp();
}

async function handleTaskCommand(message) {
    const normalized = message.content.toLowerCase().trim();
    const commands = ["!task", "task", "!tasks", "tasks", "!todo", "todo"];

    if (!commands.includes(normalized)) {
        return false;
    }

    const mention = `<@${message.author.id}>`;
    let member = message.member;

    if (!member && message.guild) {
        member = await message.guild.members.fetch(message.author.id).catch(() => null);
    }

    try {
        await message.reply({ embeds: [createTaskEmbed(member || message.author, mention)] });
    } catch (err) {
        console.error("Task command error:", err);
        const fallbackText = `Task list:\n${formatTaskList(TASK_LIST)}\n\nProfile:\nName: ${message.author.username}\nID: ${message.author.id}\nMention: ${mention}\nTotal Projects: ${TASK_LIST.length}`;
        await message.reply(fallbackText).catch(console.error);
    }

    return true;
}

module.exports = {
    handleTaskCommand,
    TASK_LIST
};
