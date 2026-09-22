require('dotenv').config();

const fs = require("fs");
const http = require("http");
const path = require("path");
const Discord = require("discord.js");
const { handleStudyScheduleCommand } = require("./commands/studySchedule");
const { handleAIChatCommand, handleAIChatReply, handleAIMention } = require("./commands/aiChat");

const LOCK_FILE = path.join(__dirname, ".bot.lock");

function cleanupLock() {
    try {
        const currentPid = fs.readFileSync(LOCK_FILE, "utf8").trim();
        if (currentPid === String(process.pid)) {
            fs.rmSync(LOCK_FILE, { force: true });
        }
    } catch (error) {
        // Ignore cleanup errors when lock file is already absent.
    }
}

function ensureSingleInstance() {
    try {
        if (fs.existsSync(LOCK_FILE)) {
            const existingPid = Number(fs.readFileSync(LOCK_FILE, "utf8").trim());
            if (existingPid && existingPid !== process.pid) {
                try {
                    process.kill(existingPid, 0);
                    console.error(`⚠️ Bot instance already running with PID ${existingPid}. Refusing duplicate startup.`);
                    process.exit(1);
                } catch (error) {
                    fs.rmSync(LOCK_FILE, { force: true });
                }
            }
        }

        fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
    } catch (error) {
        console.error("Failed to initialize bot lock file:", error);
    }
}

process.on("exit", cleanupLock);
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
ensureSingleInstance();
const { handleMusicCommand } = require("./commands/music");
const { handleRandomCodeCommand } = require("./commands/buatcoderrandom");
const { handlePlayMusicCommand } = require("./commands/playmusic");
const { handleRulesCommand } = require("./commands/rules");
const { handleArenaEventCommand } = require("./commands/Arenaplay");
const { handleRoleInfoCommand } = require("./commands/Roleinfo");
const { handleAnnouncementCommand } = require("./commands/announcment");
const { handleTaskCommand } = require("./commands/tasks");
const { handleWebCommand } = require("./commands/web");
const { handleWhellLeviCommand } = require("./commands/whellevi");
const spendingPoints = require("./commands/whellevi");
const { handleInputCommand } = require("./commands/input");
const { getMemberActivity, recordChatMessage, recordVoiceStateChange } = require("./commands/activity");
const ARENA_PARTICIPANT_ROLE = "Punishing";

const processedMessageIds = new Map();
const recentCommandSignatures = new Map();

function markMessageProcessed(message) {
    const now = Date.now();
    processedMessageIds.set(message.id, now);

    setTimeout(() => {
        if (processedMessageIds.get(message.id) === now) {
            processedMessageIds.delete(message.id);
        }
    }, 3000);
}

function getCommandSignature(message) {
    return `${message.author.id}:${message.content.trim().toLowerCase()}`;
}

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
            const memberPoints = points[member.id] || {};
            const roleNames = member.roles.cache
                .filter(role => role.name !== "@everyone")
                .map(role => role.name.toUpperCase());
            const inferredRole = roleNames.includes("WHELL")
                ? "WHELL"
                : roleNames.includes("LEVIA") || roleNames.includes("LEVIATHAN")
                    ? "LEVIA"
                    : null;
            return {
                id: member.id,
                username: member.user.username,
                displayName: member.displayName,
                avatar: member.user.displayAvatarURL({ dynamic: false, size: 64 }),
                status: member.presence?.status || "offline",
                joinedAt: member.joinedAt,
                roles: roleNames,
                role: inferredRole,
                whellRp: memberPoints.whellRp || 0,
                leviaRp: memberPoints.leviaRp || 0,
                whellCurrency: memberPoints.whellCurrency || "$",
                leviaCurrency: memberPoints.leviaCurrency || "$",
                spendingRole: memberPoints.role || inferredRole,
                bio: memberPoints.bio || "",
                whellTheme: spendingPoints.getRoleSpending(memberPoints || {}, roleNames, "WHELL"),
                leviaTheme: spendingPoints.getRoleSpending(memberPoints || {}, roleNames, "LEVIA"),
                level: Math.floor((chatXp + voiceXp) / 100),
                xp: chatXp + voiceXp,
                chatXp,
                voiceXp,
                monthlyXp: 0,
                progress: (chatXp + voiceXp) % 100
            };
        });

}

function getArenaGuild() {
    const configuredGuildId = process.env.DISCORD_GUILD_ID;
    return configuredGuildId
        ? client.guilds.cache.get(configuredGuildId)
        : client.guilds.cache.first();
}

function getArenaParticipants(guild) {
    return guild.members.cache
        .filter(member => !member.user.bot && member.roles.cache.some(role => role.name.toLowerCase() === ARENA_PARTICIPANT_ROLE.toLowerCase()))
        .map(member => ({
            discordId: member.id,
            name: member.displayName,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ dynamic: false, size: 96 })
        }))
        .sort((first, second) => first.name.localeCompare(second.name));
}

function buildArenaRoundOne(arenaData, participants) {
    const existingPlayers = new Map();
    const currentRound = arenaData.rounds?.[0];

    for (const match of currentRound?.matches || []) {
        for (const player of [match.player1, match.player2]) {
            if (player?.discordId) existingPlayers.set(String(player.discordId), player);
        }
    }

    const matches = [];
    for (let index = 0; index < participants.length; index += 2) {
        const firstParticipant = participants[index];
        const secondParticipant = participants[index + 1];
        const firstPrevious = existingPlayers.get(firstParticipant.discordId) || {};
        const secondPrevious = secondParticipant ? existingPlayers.get(secondParticipant.discordId) || {} : null;

        matches.push({
            player1: { ...firstParticipant, score: firstPrevious.score || 0 },
            player2: secondParticipant
                ? { ...secondParticipant, score: secondPrevious.score || 0 }
                : { name: "Menunggu", score: 0 },
            winner: null
        });
    }

    return {
        ...(currentRound || { name: "Round 1" }),
        name: "Round 1",
        matches
    };
}

function syncArenaParticipants(guild, arenaData = null) {
    if (!guild) return [];

    const arenaFile = path.join(__dirname, "data", "dataarena.json");
    const currentArenaData = arenaData || JSON.parse(fs.readFileSync(arenaFile, "utf8"));
    const participants = getArenaParticipants(guild);

    const previousState = JSON.stringify({
        participants: currentArenaData.participants || [],
        roundOne: currentArenaData.rounds?.[0]?.matches || []
    });
    currentArenaData.participants = participants;
    currentArenaData.rounds = currentArenaData.rounds || [];
    currentArenaData.rounds[0] = buildArenaRoundOne(currentArenaData, participants);
    const nextState = JSON.stringify({
        participants,
        roundOne: currentArenaData.rounds[0].matches
    });
    if (previousState === nextState) return participants;

    const serializedArena = `${JSON.stringify(currentArenaData, null, 2)}\n`;
    fs.writeFileSync(arenaFile, serializedArena, "utf8");
    queueArenaGitHubPersistence(serializedArena);
    console.log(`Arena participants synced: ${participants.length} member(s) with role ${ARENA_PARTICIPANT_ROLE}.`);
    return participants;
}

let arenaGitHubSyncQueue = Promise.resolve();

function queueArenaGitHubPersistence(serializedArena) {
    if (!process.env.GITHUB_TOKEN) return;

    arenaGitHubSyncQueue = arenaGitHubSyncQueue
        .then(async () => {
            const repository = process.env.GITHUB_REPOSITORY || "kikysena13/dc";
            const branch = process.env.GITHUB_BRANCH || "main";
            const filePath = process.env.GITHUB_ARENA_DATA_PATH || "data/dataarena.json";
            const endpoint = `https://api.github.com/repos/${repository}/contents/${filePath}`;
            const headers = {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                "X-GitHub-Api-Version": "2022-11-28"
            };

            const currentResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(branch)}`, { headers });
            if (!currentResponse.ok) {
                throw new Error(`GitHub arena read failed with ${currentResponse.status}: ${(await currentResponse.text()).slice(0, 240)}`);
            }

            const currentFile = await currentResponse.json();
            const updateResponse = await fetch(endpoint, {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Sync arena participants from Discord",
                    content: Buffer.from(serializedArena, "utf8").toString("base64"),
                    branch,
                    sha: currentFile.sha
                })
            });
            if (!updateResponse.ok) {
                throw new Error(`GitHub arena write failed with ${updateResponse.status}: ${(await updateResponse.text()).slice(0, 240)}`);
            }
        })
        .catch(error => console.error("GitHub arena data sync failed:", error.message));
}

function getArenaData() {
    const arenaFile = path.join(__dirname, "data", "dataarena.json");
    const arenaData = JSON.parse(fs.readFileSync(arenaFile, "utf8"));
    const guild = getArenaGuild();

    if (!guild) return arenaData;

    arenaData.participants = syncArenaParticipants(guild, arenaData);

    const findMember = (player) => {
        if (!player || typeof player !== "object") return null;
        if (player.discordId) return guild.members.cache.get(String(player.discordId)) || null;

        const searchName = String(player.name || "").trim().toLowerCase();
        if (!searchName || searchName === "menunggu") return null;
        return guild.members.cache.find((member) => [
            member.user.username,
            member.displayName,
            member.user.globalName
        ].filter(Boolean).some((name) => name.toLowerCase() === searchName)) || null;
    };

    const enrichPlayer = (player) => {
        if (!player || typeof player !== "object") return player;
        const member = findMember(player);
        if (!member) return player;
        return {
            ...player,
            name: player.name || member.displayName,
            avatar: member.user.displayAvatarURL({ dynamic: false, size: 96 })
        };
    };

    arenaData.rounds = (arenaData.rounds || []).map((round) => ({
        ...round,
        matches: (round.matches || []).map((match) => ({
            ...match,
            player1: enrichPlayer(match.player1),
            player2: enrichPlayer(match.player2)
        }))
    }));
    arenaData.winner = enrichPlayer(arenaData.winner);
    return arenaData;
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

        if (requestPath === "/dataarena.json" || requestPath === "/data/dataarena.json") {
            try {
                const arenaData = getArenaData();
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store",
                    "Access-Control-Allow-Origin": "*"
                });
                response.end(JSON.stringify(arenaData));
            } catch (error) {
                response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify({ error: "Data arena tidak ditemukan." }));
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

    if (processedMessageIds.has(message.id)) {
        return;
    }

    const commandSignature = getCommandSignature(message);
    const previousTimestamp = recentCommandSignatures.get(commandSignature);
    if (previousTimestamp && Date.now() - previousTimestamp < 3000) {
        return;
    }
    recentCommandSignatures.set(commandSignature, Date.now());
    setTimeout(() => recentCommandSignatures.delete(commandSignature), 3000);

    markMessageProcessed(message);

    recordChatMessage(message.author);

    if (/^!ai(?:\s|$)/i.test(message.content.trim())) {
        const args = message.content.trim().split(/\s+/).slice(1);
        if (await handleAIChatCommand(message, args)) return;
    }

    // Balas pesan AI untuk melanjutkan percakapan dengan konteks sebelumnya.
    if (await handleAIChatReply(message)) return;
    if (await handleAIMention(message, client.user)) return;

    if (await handleStudyScheduleCommand(message)) return;
    if (await handleMusicCommand(message)) return;
    if (await handleRandomCodeCommand(message)) return;
    if (await handlePlayMusicCommand(message)) return;
    if (await handleRulesCommand(message)) return;
    if (await handleRoleInfoCommand(message)) return;
    if (await handleAnnouncementCommand(message)) return;
    if (await handleArenaEventCommand(message)) return;
    if (await handleTaskCommand(message)) return;
    if (await handleWebCommand(message)) return;
    if (await handleWhellLeviCommand(message)) return;
    if (await handleInputCommand(message)) return;

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

client.once("ready", async () => {
    const guild = getArenaGuild();
    if (!guild) return;

    try {
        await guild.members.fetch();
        syncArenaParticipants(guild);
    } catch (error) {
        console.error("Failed to sync arena participants:", error);
    }
});

client.on("guildMemberUpdate", (oldMember, newMember) => {
    if (oldMember.roles.cache.equals(newMember.roles.cache)) return;
    syncArenaParticipants(newMember.guild);
});

if (!token) {
    throw new Error("DISCORD_TOKEN is missing from .env");
}

client.login(token);