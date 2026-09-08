const Discord = require("discord.js");

const STUDY_SCHEDULE = [
    { day: "Monday", time: "19:00 - 20:30", topic: "Math" },
    { day: "Tuesday", time: "19:00 - 20:30", topic: "English" },
    { day: "Wednesday", time: "19:00 - 20:30", topic: "Science" },
    { day: "Thursday", time: "19:00 - 20:30", topic: "Programming" },
    { day: "Friday", time: "19:00 - 20:30", topic: "Review" }
];

function createStudyScheduleEmbed() {
    const description = STUDY_SCHEDULE
        .map((item, index) => `${index + 1}. ${item.day}\n${item.time} | ${item.topic}`)
        .join("\n\n");

    return new Discord.MessageEmbed()
        .setColor("#2ecc71")
        .setTitle("Study Schedule")
        .setDescription(description)
        .setFooter({ text: `Total sessions: ${STUDY_SCHEDULE.length}` });
}

async function handleStudyScheduleCommand(message) {
    const normalized = message.content.toLowerCase().trim();
    const commands = ["jadwal", "!jadwal", "schedule", "!schedule"];

    if (!commands.includes(normalized)) {
        return false;
    }

    try {
        await message.reply({ embeds: [createStudyScheduleEmbed()] });
    } catch (err) {
        console.error(err);
        message.reply("Failed to load study schedule.").catch(error => console.error(error));
    }

    return true;
}

module.exports = {
    STUDY_SCHEDULE,
    handleStudyScheduleCommand
};
