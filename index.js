require('dotenv').config();

const fs = require("fs");
const http = require("http");
const path = require("path");
const Discord = require("discord.js");
const { handleStudyScheduleCommand } = require("./commands/studySchedule");
const { handleMusicCommand } = require("./commands/music");
const { handleRandomCodeCommand } = require("./commands/buatcoderrandom");
const { handlePlayMusicCommand } = require("./commands/playmusic");
const { handleRulesCommand } = require("./commands/rules");
const { handleRoleInfoCommand } = require("./commands/Roleinfo");
const { handleAnnouncementCommand } = require("./commands/announcment");
const { handleTaskCommand } = require("./commands/tasks");
const { handleWebCommand } = require("./commands/web");
const { handleWhellLeviCommand } = require("./commands/whellevi");
const spendingPoints = require("./commands/whellevi");
const { getMemberActivity, recordChatMessage, recordVoiceStateChange } = require("./commands/activity");

// ===== GLOBAL ERROR HANDLERS =====
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Bot akan continue running instead of crashing
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Bot akan continue running instead of crashing
});

const client = new Discord.Client({
    intents: [
        "GUILDS", 
        "GUILD_MESSAGES", 
        "GUILD_MEMBERS", 
        "MESSAGE_CONTENT",
        "GUILD_VOICE_STATES"
    ],
    partials: ["CHANNEL", "MESSAGE"]
});

// Add manual members here. You can set IGN manually in each object.
const MANUAL_MEMBERS = [
    

    { name: "PersiaX (Iran)", ign: "Persia" }
];
const token = process.env.DISCORD_TOKEN;

function getDashboardMembers() {
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    const guild = configuredGuildId
        ? client.guilds.cache.get(configuredGuildId)
        : client.guilds.cache.first();

    if (!guild) {
        throw new Error("Bot is not connected to the configured Discord server.");
    }

    const points = spendingPoints.getPoints();
    return guild.members.cache
        .filter(member => !member.user.bot)
        .map(member => {
            const activity = getMemberActivity(member.id);
            const chatXp = activity.chatMessages || 0;
            const voiceXp = activity.voiceMinutes || 0;
            return {
                id: member.id,
                username: member.user.username,
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL({ dynamic: false, size: 64 }),
                status: member.presence?.status || "offline",
                joinedAt: member.joinedAt,
                roles: member.roles.cache
                    .filter(role => role.name !== "@everyone")
                    .map(role => role.name),
                whellRp: points[member.id]?.whellRp || 0,
                leviaRp: points[member.id]?.leviaRp || 0,
                level: Math.floor((chatXp + voiceXp) / 100),
                xp: chatXp + voiceXp,
                chatXp,
                voiceXp,
                monthlyXp: 0,
                progress: (chatXp + voiceXp) % 100
            };
        });

}

function startDashboardServer() {
    const dashboardFile = path.join(__dirname, "index.html");
    const server = http.createServer((request, response) => {
        const requestPath = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;

        if (requestPath === "/health") {
            response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
            response.end(JSON.stringify({ status: "ok" }));
            return;
        }

        if (requestPath === "/api/leaderboard") {
            try {
                const members = getDashboardMembers();
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store",
                    "Access-Control-Allow-Origin": "*"
                });
                response.end(JSON.stringify({ members, totalMembers: members.length }));
            } catch (error) {
                response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (requestPath === "/" || requestPath === "/index.html") {
            response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            response.end(fs.readFileSync(dashboardFile));
            return;
        }

        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
    });

    const port = Number(process.env.PORT || 3000);
    server.listen(port, () => console.log(`Dashboard available at http://localhost:${port}`));
}

client.on('voiceStateUpdate', (oldState, newState) => {
    recordVoiceStateChange(oldState, newState);
});

client.on('ready', async () => {
    console.log(`Client has been logged into! ${client.user.username}`);
    const guild = process.env.DISCORD_GUILD_ID
        ? client.guilds.cache.get(process.env.DISCORD_GUILD_ID)
        : client.guilds.cache.first();
    if (guild) await guild.members.fetch();
    startDashboardServer();
});

function extractIgn(memberName) {
    const nameWithoutCountry = memberName.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (!nameWithoutCountry) return "-";

    return nameWithoutCountry.split(/\s+/)[0];
}

function createListEmbed(memberList, page, perPage) {
    const totalPages = Math.max(1, Math.ceil(memberList.length / perPage));
    const start = page * perPage;
    const pageMembers = memberList.slice(start, start + perPage);

    const description = pageMembers.length
        ? pageMembers.map((member, index) => `${start + index + 1}. ${member.name}\nign= ${member.ign || extractIgn(member.name)}`).join("\n\n")
        : "No members available to display.";

    return new Discord.MessageEmbed()
        .setColor("#ff0000")
        .setTitle("Global Competitors")
        .setDescription(description)
        .setFooter({ text: `Page ${page + 1}/${totalPages} • Total ${memberList.length} members` });
}

function createPaginationRow(page, totalPages, disabled = false) {
    return new Discord.MessageActionRow().addComponents(
        new Discord.MessageButton()
            .setCustomId("list_prev")
            .setLabel("Prev")
            .setStyle("SECONDARY")
            .setDisabled(disabled || page <= 0),
        new Discord.MessageButton()
            .setCustomId("list_next")
            .setLabel("Next")
            .setStyle("PRIMARY")
            .setDisabled(disabled || page >= totalPages - 1)
    );
}

function createInputExampleEmbed() {
    const sample = [
        "{ name: \"Zenaya Zafreyda (Japan)\", ign: \"Zenaya\" },",
        "{ name: \"Alectrass (United States)\", ign: \"Alectrass\" },",
        "{ name: \"Luneth (Canada)\", ign: \"Luneth\" }"
    ].join(",\n");

    const preview = MANUAL_MEMBERS.slice(0, 5).map((member, index) => `${index + 1}. ${member.name} | ign= ${member.ign || "-"}`).join("\n") || "No current input data.";

    return new Discord.MessageEmbed()
        .setColor("#0099ff")
        .setTitle("Manual Input Format")
        .setDescription(
            [
                "Fill the MANUAL_MEMBERS array in index.js with this format:",
                "```js",
                "const MANUAL_MEMBERS = [",
                sample,
                "];",
                "```",
                "Current input preview:"
            ].join("\n")
        )
        .addField("Current Entries", preview)
        .setFooter({ text: `Total current input: ${MANUAL_MEMBERS.length}` });
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    recordChatMessage(message.author);

    if (await handleStudyScheduleCommand(message)) return;
    if (await handleMusicCommand(message)) return;
    if (await handleRandomCodeCommand(message)) return;
    if (await handlePlayMusicCommand(message)) return;
    if (await handleRulesCommand(message)) return;
    if (await handleRoleInfoCommand(message)) return;
    if (await handleAnnouncementCommand(message)) return;
    if (await handleTaskCommand(message)) return;
    if (await handleWebCommand(message)) return;
    if (await handleWhellLeviCommand(message)) return;

    if (message.content.toLowerCase() === "test") {
        message.reply("Test successful!").catch(err => console.error(err));
    }

    if (["input", "!input", "format", "!format"].includes(message.content.toLowerCase().trim())) {
        message.reply({ embeds: [createInputExampleEmbed()] }).catch(err => console.error(err));
        return;
    }

    if (["list", "!list"].includes(message.content.toLowerCase().trim())) {
        try {
            const members = MANUAL_MEMBERS
                .filter(member => member && typeof member.name === "string" && member.name.trim() !== "")
                .map(member => ({
                    name: member.name.trim(),
                    ign: typeof member.ign === "string" && member.ign.trim() !== "" ? member.ign.trim() : extractIgn(member.name.trim())
                }));

            if (!members.length) {
                message.reply("The list is empty. Please fill MANUAL_MEMBERS in index.js first.").catch(err => console.error(err));
                return;
            }

            const perPage = 5;
            const totalPages = Math.max(1, Math.ceil(members.length / perPage));
            let currentPage = 0;

            const sentMessage = await message.reply({
                embeds: [createListEmbed(members, currentPage, perPage)],
                components: [createPaginationRow(currentPage, totalPages)]
            });

            const collector = sentMessage.createMessageComponentCollector({
                componentType: "BUTTON",
                time: 120000,
                filter: (interaction) => interaction.user.id === message.author.id
            });

            collector.on("collect", async (interaction) => {
                if (interaction.customId === "list_prev") {
                    currentPage = Math.max(0, currentPage - 1);
                }

                if (interaction.customId === "list_next") {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                }

                await interaction.update({
                    embeds: [createListEmbed(members, currentPage, perPage)],
                    components: [createPaginationRow(currentPage, totalPages)]
                });
            });

            collector.on("end", async () => {
                try {
                    await sentMessage.edit({
                        components: [createPaginationRow(currentPage, totalPages, true)]
                    });
                } catch (err) {
                    console.error(err);
                }
            });
        } catch (err) {
            console.error(err);
            message.reply("Failed to load the member list.").catch(error => console.error(error));
        }
    }
});

if (!token) {
    throw new Error("DISCORD_TOKEN is missing from .env");
}

client.login(token);