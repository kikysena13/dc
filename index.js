require('dotenv').config();

const fs = require("fs");
const http = require("http");
const path = require("path");
const Discord = require("discord.js");
const { handleStudyScheduleCommand } = require("./commands/studySchedule");
const { handleGuildMemberAdd, startNewMemberRoleScheduler } = require("./commands/newMemberRole");
const { handleAIChatCommand, handleAIChatReply, handleAIMention } = require("./commands/aiChat");
const { handleHelpCommand, handleHelpInteraction, registerHelpSlashCommand } = require("./commands/help");
const {
    getAllMemberActivities,
    recordChatMessage,
    recordVoiceStateChange,
    recordGuildMemberJoin,
    getMessageActivity,
    getRecentDashboardActivity,
    initializeVoiceSessions,
    finalizeVoiceSessions
} = require("./commands/activity");

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

process.on("exit", () => {
    try {
        finalizeVoiceSessions();
    } catch (error) {
        console.error("Failed to save voice activity during shutdown:", error);
    }
    cleanupLock();
});
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
const ARENA_PARTICIPANT_ROLE = "Punishing";
const CHAT_XP_PER_MESSAGE = 1;
const VOICE_XP_PER_MINUTE = 1;

const processedMessageIds = new Map();
function markMessageProcessed(message) {
    const now = Date.now();
    processedMessageIds.set(message.id, now);

    setTimeout(() => {
        if (processedMessageIds.get(message.id) === now) {
            processedMessageIds.delete(message.id);
        }
    }, 3000);
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
        "GUILD_VOICE_STATES",
        ...(process.env.DISCORD_PRESENCE_ENABLED === "true" ? ["GUILD_PRESENCES"] : [])
    ],
    partials: ["CHANNEL", "MESSAGE"]
});

// Add manual members here. You can set IGN manually in each object.
const MANUAL_MEMBERS = [
    

    { name: "PersiaX (Iran)", ign: "Persia" }
];
const token = process.env.DISCORD_TOKEN;

function getDashboardGuildId() {
    return process.env.DISCORD_GUILD_ID || client.guilds.cache.first()?.id || null;
}

function isDashboardGuild(guildId) {
    return Boolean(guildId && guildId === getDashboardGuildId());
}

function getDashboardMembers() {
    const guildId = getDashboardGuildId();
    const guild = guildId ? client.guilds.cache.get(guildId) : null;

    if (!guild) {
        throw new Error("Bot is not connected to the configured Discord server.");
    }

    const points = spendingPoints.getPoints();
    const activities = getAllMemberActivities();
    return guild.members.cache
        .filter(member => !member.user.bot)
        .map(member => {
            const activity = activities.get(member.id) || { chatMessages: 0, voiceMinutes: 0 };
            const chatXp = activity.chatMessages * CHAT_XP_PER_MESSAGE;
            const voiceXp = activity.voiceMinutes * VOICE_XP_PER_MINUTE;
            const totalXp = chatXp + voiceXp;
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
                level: Math.floor(totalXp / 100),
                xp: totalXp,
                chatXp,
                voiceXp,
                progress: totalXp % 100
            };
        });

}

function getServerHubDashboard() {
    const guildId = getDashboardGuildId();
    const guild = guildId ? client.guilds.cache.get(guildId) : null;
    if (!guild) throw new Error("Bot is not connected to the configured Discord server.");

    const members = getDashboardMembers()
        .map(member => ({
            id: member.id,
            username: member.username,
            displayName: member.displayName,
            avatar: member.avatar,
            xp: member.xp,
            messages: member.chatXp,
            voiceMinutes: member.voiceXp
        }))
        .sort((first, second) => second.xp - first.xp);

    const voiceCounts = new Map();
    for (const voiceState of guild.voiceStates.cache.values()) {
        if (!voiceState.channelId || voiceState.member?.user.bot) continue;
        const channelName = voiceState.channel?.name || "Voice channel";
        voiceCounts.set(channelName, (voiceCounts.get(channelName) || 0) + 1);
    }

    const metrics = {
        memberCount: guild.memberCount || members.length,
        onlineCount: process.env.DISCORD_PRESENCE_ENABLED === "true"
            ? guild.members.cache.filter(member => !member.user.bot && member.presence && member.presence.status !== "offline").size
            : null,
        messageCount: members.reduce((total, member) => total + member.messages, 0),
        voiceCount: [...voiceCounts.values()].reduce((total, count) => total + count, 0)
    };

    return {
        server: { id: guild.id, name: guild.name },
        metrics,
        messageActivity: {
            "24h": getMessageActivity("24h"),
            "7d": getMessageActivity("7d"),
            "30d": getMessageActivity("30d")
        },
        voiceChannels: [...voiceCounts.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((first, second) => second.count - first.count),
        leaderboard: members.slice(0, 100),
        recentActivity: getRecentDashboardActivity(20)
    };
}

function getArenaGuild() {
    const guildId = getDashboardGuildId();
    return guildId ? client.guilds.cache.get(guildId) : null;
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

function getDashboardApiConfig() {
    const configuredOrigins = (process.env.DASHBOARD_ALLOWED_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return {
        apiToken: process.env.DASHBOARD_API_TOKEN || "",
        allowedOrigins: configuredOrigins,
        serverHost: (process.env.DASHBOARD_HOST || process.env.PUBLIC_URL || "").replace(/\/$/, "")
    };
}

function setDashboardCorsHeaders(response, request) {
    const origin = request.headers.origin || "";
    const requestHost = request.headers.host ? `http://${request.headers.host}` : "";
    const { allowedOrigins, serverHost } = getDashboardApiConfig();
    const isSameOrigin = !origin || origin === requestHost || (serverHost && origin === serverHost);
    const isAllowedOrigin = !origin || isSameOrigin || allowedOrigins.includes(origin);

    if (isAllowedOrigin) {
        response.setHeader("Access-Control-Allow-Origin", origin || requestHost || "null");
        response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function requireDashboardAuth(request, response) {
    const origin = request.headers.origin || "";
    const requestHost = request.headers.host ? `http://${request.headers.host}` : "";
    const { apiToken, allowedOrigins, serverHost } = getDashboardApiConfig();
    const isSameOrigin = !origin || origin === requestHost || (serverHost && origin === serverHost);
    const isAllowedOrigin = !origin || isSameOrigin || allowedOrigins.includes(origin);

    if (origin && !isAllowedOrigin) {
        response.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Origin not allowed" }));
        return false;
    }

    if (request.method === "OPTIONS") {
        setDashboardCorsHeaders(response, request);
        response.writeHead(204);
        response.end();
        return false;
    }

    if (!apiToken) {
        setDashboardCorsHeaders(response, request);
        response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Dashboard API authentication is not configured." }));
        return false;
    }

    const authHeader = request.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (token !== apiToken) {
        setDashboardCorsHeaders(response, request);
        response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Unauthorized" }));
        return false;
    }

    setDashboardCorsHeaders(response, request);
    return true;
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
            if (!requireDashboardAuth(request, response)) return;

            try {
                const members = getDashboardMembers();
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
                });
                response.end(JSON.stringify({ members, totalMembers: members.length }));
            } catch (error) {
                response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (requestPath === "/api/serverhub/dashboard") {
            if (!requireDashboardAuth(request, response)) return;

            try {
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
                });
                response.end(JSON.stringify(getServerHubDashboard()));
            } catch (error) {
                response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
                response.end(JSON.stringify({ error: error.message }));
            }
            return;
        }

        if (requestPath === "/dataarena.json" || requestPath === "/data/dataarena.json") {
            if (!requireDashboardAuth(request, response)) return;

            try {
                const arenaData = getArenaData();
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store"
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
    if (isDashboardGuild(newState.guild.id)) {
        recordVoiceStateChange(oldState, newState);
    }
});

client.on("interactionCreate", async (interaction) => {
    try {
        await handleHelpInteraction(interaction);
    } catch (error) {
        console.error("Failed to respond to /help:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "Gagal menampilkan daftar command. Coba lagi sebentar.",
                ephemeral: true
            }).catch(replyError => console.error("Failed to send /help error reply:", replyError));
        }
    }
});

client.once('ready', () => {
    console.log(`Client has been logged into! ${client.user.username}`);
    registerHelpSlashCommand(client).catch(error => {
        console.error("Failed to register /help slash command:", error.message);
    });

    const guild = getArenaGuild();
    if (!guild) return;

    const activeVoiceUserIds = [...guild.voiceStates.cache.values()]
        .filter(voiceState => voiceState.channelId && !voiceState.member?.user.bot)
        .map(voiceState => voiceState.id);
    initializeVoiceSessions(activeVoiceUserIds);

    guild.members.fetch()
        .then(() => syncArenaParticipants(guild))
        .catch(error => console.error("Failed to fetch guild members or sync arena:", error));

    // Mulai scheduler auto-remove role "New" setelah 3 hari
    startNewMemberRoleScheduler(() => getArenaGuild());
});

// ── Auto-assign role "New" saat member bergabung ─────────────────────────────
client.on('guildMemberAdd', async (member) => {
    if (isDashboardGuild(member.guild.id)) recordGuildMemberJoin(member);
    await handleGuildMemberAdd(member);
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

    markMessageProcessed(message);

    if (message.guild && isDashboardGuild(message.guild.id)) {
        recordChatMessage(message.author, message.channel?.name);
    }

    if (/^!ai(?:\s|$)/i.test(message.content.trim())) {
        const args = message.content.trim().split(/\s+/).slice(1);
        if (await handleAIChatCommand(message, args)) return;
    }

    // Balas pesan AI untuk melanjutkan percakapan dengan konteks sebelumnya.
    if (await handleAIChatReply(message)) return;
    if (await handleAIMention(message, client.user)) return;

    if (await handleStudyScheduleCommand(message)) return;
    if (await handleHelpCommand(message)) return;
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

client.on("guildMemberUpdate", (oldMember, newMember) => {
    if (oldMember.roles.cache.equals(newMember.roles.cache)) return;
    syncArenaParticipants(newMember.guild);
});

if (!token) {
    throw new Error("DISCORD_TOKEN is missing from .env");
}

// Start the HTTP listener before connecting to Discord so Railway can pass its healthcheck.
startDashboardServer();
client.login(token);