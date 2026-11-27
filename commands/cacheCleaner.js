const { cleanupAIChatCache } = require("./aiChat");
const { cleanupMusicCache } = require("./playmusic");

const DEFAULT_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_MESSAGE_MAX_AGE_MS = 15 * 60 * 1000;

let cleanupIntervalHandle = null;

function formatMB(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sweepChannelMessages(channel, options = {}) {
    const { maxAgeMs = DEFAULT_MESSAGE_MAX_AGE_MS, forceAll = false, now = Date.now() } = options;
    const messageCache = channel?.messages?.cache;
    if (!messageCache) return 0;

    if (typeof messageCache.sweep === "function") {
        return messageCache.sweep((msg) => {
            if (forceAll) return true;
            const timestamp = Number(msg?.createdTimestamp || 0);
            return timestamp > 0 ? (now - timestamp) > maxAgeMs : true;
        });
    }

    if (typeof messageCache.entries === "function" && typeof messageCache.delete === "function") {
        let removed = 0;
        for (const [id, msg] of [...messageCache.entries()]) {
            const timestamp = Number(msg?.createdTimestamp || 0);
            if (forceAll || !timestamp || (now - timestamp) > maxAgeMs) {
                messageCache.delete(id);
                removed += 1;
            }
        }
        return removed;
    }

    return 0;
}

function sweepDiscordMessageCaches(client, options = {}) {
    if (!client) return 0;

    const visitedChannels = new Set();
    let clearedMessages = 0;

    const processChannel = (channel) => {
        if (!channel) return;
        const key = channel.id || channel;
        if (visitedChannels.has(key)) return;
        visitedChannels.add(key);
        clearedMessages += sweepChannelMessages(channel, options);
    };

    if (client.channels?.cache && typeof client.channels.cache.values === "function") {
        for (const channel of client.channels.cache.values()) {
            processChannel(channel);
        }
    }

    if (client.guilds?.cache && typeof client.guilds.cache.values === "function") {
        for (const guild of client.guilds.cache.values()) {
            if (guild?.channels?.cache && typeof guild.channels.cache.values === "function") {
                for (const channel of guild.channels.cache.values()) {
                    processChannel(channel);
                }
            }
        }
    }

    return clearedMessages;
}

function runCacheCleanup(client, options = {}) {
    const {
        forceAll = false,
        clearAllMessages = forceAll,
        maxAgeMs = DEFAULT_MESSAGE_MAX_AGE_MS,
        now = Date.now(),
        cleanupProcessedMessages = null
    } = options;

    const memoryBefore = process.memoryUsage();
    const clearedMessages = sweepDiscordMessageCaches(client, {
        maxAgeMs,
        forceAll: clearAllMessages,
        now
    });
    const clearedAIChats = cleanupAIChatCache({ forceAll, now });
    const musicResult = cleanupMusicCache({ resetSpotifyAuth: forceAll, now });
    const clearedProcessedIds = typeof cleanupProcessedMessages === "function"
        ? Number(cleanupProcessedMessages(forceAll, now) || 0)
        : 0;

    let gcTriggered = false;
    if (typeof global.gc === "function") {
        try {
            global.gc();
            gcTriggered = true;
        } catch (error) {
            // Ignore GC errors.
        }
    }

    const memoryAfter = process.memoryUsage();
    return {
        clearedMessages,
        clearedAIChats,
        clearedMusicQueues: musicResult.clearedQueues,
        clearedSpotifyToken: musicResult.clearedSpotifyToken,
        clearedProcessedIds,
        gcTriggered,
        memoryBefore,
        memoryAfter
    };
}

function startCacheCleanupScheduler(client, options = {}) {
    stopCacheCleanupScheduler();

    const intervalMs = Number(options.intervalMs) > 0
        ? Number(options.intervalMs)
        : DEFAULT_CLEANUP_INTERVAL_MS;

    cleanupIntervalHandle = setInterval(() => {
        try {
            const report = runCacheCleanup(client, {
                forceAll: false,
                clearAllMessages: false,
                cleanupProcessedMessages: options.cleanupProcessedMessages
            });
            const totalCleared = report.clearedMessages
                + report.clearedAIChats
                + report.clearedMusicQueues
                + report.clearedProcessedIds;

            if (totalCleared > 0) {
                console.info(
                    `[CacheCleaner] Swept ${report.clearedMessages} msg, ${report.clearedAIChats} AI chat, ${report.clearedMusicQueues} music queue | Heap: ${formatMB(report.memoryAfter.heapUsed)} | RSS: ${formatMB(report.memoryAfter.rss)}`
                );
            }
        } catch (error) {
            console.error("[CacheCleaner] Scheduled cache cleanup failed:", error.message || error);
        }
    }, intervalMs);

    if (typeof cleanupIntervalHandle.unref === "function") {
        cleanupIntervalHandle.unref();
    }

    return cleanupIntervalHandle;
}

function stopCacheCleanupScheduler() {
    if (!cleanupIntervalHandle) return;
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
}

async function handleClearCacheCommand(message, options = {}) {
    const parts = String(message.content || "").trim().toLowerCase().split(/\s+/);
    const command = parts[0];
    if (!["!clearcache", "!cleancache"].includes(command)) {
        return false;
    }

    if (!message.guild || !message.member) {
        await message.reply("❌ Command ini hanya bisa digunakan di server Discord.");
        return true;
    }

    if (!message.member.permissions?.has("MANAGE_GUILD")) {
        await message.reply("❌ Kamu memerlukan izin **Manage Server** untuk membersihkan cache bot.");
        return true;
    }

    const forceAll = parts[1] === "all";
    const report = runCacheCleanup(message.client, {
        forceAll,
        clearAllMessages: true,
        cleanupProcessedMessages: options.cleanupProcessedMessages
    });

    await message.reply([
        `🧹 **Cache bot berhasil dibersihkan!**${forceAll ? " (Mode: `all`)" : ""}`,
        `• Cache pesan Discord: **${report.clearedMessages}** dihapus`,
        `• Cache sesi AI Chat: **${report.clearedAIChats}** dihapus${forceAll ? " (semua riwayat)" : " (yang sudah kadaluarsa)"}`,
        `• Queue musik idle: **${report.clearedMusicQueues}** dihapus`,
        `• Cache ID pesan: **${report.clearedProcessedIds}** dihapus`,
        `• Memori RAM (Heap): **${formatMB(report.memoryBefore.heapUsed)}** → **${formatMB(report.memoryAfter.heapUsed)}** (RSS: ${formatMB(report.memoryAfter.rss)})`,
        forceAll ? "• Mode stay voice 24/7 & data tersimpan tetap aman." : "• Tip: gunakan `!clearcache all` jika ingin mereset semua riwayat AI Chat juga."
    ].join("\n"));

    return true;
}

module.exports = {
    DEFAULT_CLEANUP_INTERVAL_MS,
    DEFAULT_MESSAGE_MAX_AGE_MS,
    sweepDiscordMessageCaches,
    runCacheCleanup,
    startCacheCleanupScheduler,
    stopCacheCleanupScheduler,
    handleClearCacheCommand
};
