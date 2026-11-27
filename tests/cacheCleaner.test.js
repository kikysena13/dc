const assert = require("assert");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "discord.js") {
        return {
            MessageEmbed: class MessageEmbed {
                setColor() { return this; }
                setTitle() { return this; }
                setDescription() { return this; }
                setThumbnail() { return this; }
                addFields() { return this; }
                setFooter() { return this; }
            }
        };
    }
    if (request === "@discordjs/voice") {
        return {
            joinVoiceChannel() {},
            createAudioPlayer() {},
            createAudioResource() {},
            AudioPlayerStatus: { Idle: "idle" },
            VoiceConnectionStatus: { Ready: "ready", Disconnected: "disconnected", Destroyed: "destroyed" },
            entersState: async () => {},
            getVoiceConnection: () => null,
            StreamType: { Opus: "opus" },
            NoSubscriberBehavior: { Play: "play" }
        };
    }
    if (request === "play-dl") return {};
    if (request === "spotify-web-api-node") {
        return class SpotifyWebApi {
            setAccessToken() {}
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const {
    runCacheCleanup,
    handleClearCacheCommand,
    startCacheCleanupScheduler,
    stopCacheCleanupScheduler
} = require("../commands/cacheCleaner");
const { getQueue } = require("../commands/playmusic");

function createFakeMessageCache(entries) {
    const map = new Map(entries);
    map.sweep = function sweep(predicate) {
        let removed = 0;
        for (const [key, value] of [...this.entries()]) {
            if (predicate(value, key, this)) {
                this.delete(key);
                removed += 1;
            }
        }
        return removed;
    };
    return map;
}

async function run() {
    const now = Date.now();
    const channel1 = {
        id: "ch-1",
        messages: {
            cache: createFakeMessageCache([
                ["m-old", { id: "m-old", createdTimestamp: now - 30 * 60 * 1000 }],
                ["m-new", { id: "m-new", createdTimestamp: now - 2 * 60 * 1000 }]
            ])
        }
    };
    const fakeClient = {
        channels: { cache: new Map([[channel1.id, channel1]]) },
        guilds: { cache: new Map() }
    };

    // Create an idle empty queue and an active queue.
    const idleQueue = getQueue("guild-idle");
    idleQueue.playing = false;
    idleQueue.songs = [];
    idleQueue.connection = null;

    const activeQueue = getQueue("guild-active");
    activeQueue.playing = true;
    activeQueue.songs = [{ title: "Playing Song" }];

    // 1. Periodic (non-force) cleanup only sweeps old messages & idle queues.
    let processedClearedCount = 0;
    const periodicReport = runCacheCleanup(fakeClient, {
        forceAll: false,
        now,
        cleanupProcessedMessages(forceAll) {
            processedClearedCount = forceAll ? 5 : 2;
            return processedClearedCount;
        }
    });
    assert.strictEqual(periodicReport.clearedMessages, 1, "should sweep only expired messages");
    assert.strictEqual(channel1.messages.cache.has("m-new"), true, "recent message should stay cached");
    assert.strictEqual(periodicReport.clearedMusicQueues, 1, "should sweep idle empty queue");
    assert.strictEqual(periodicReport.clearedProcessedIds, 2);
    assert.strictEqual(getQueue("guild-active").songs.length, 1, "active music queue must not be cleared");

    // 2. Unauthorized user cannot run !clearcache.
    const unauthReplies = [];
    const unauthMsg = {
        content: "!clearcache",
        guild: { id: "guild-1" },
        member: { permissions: { has: () => false } },
        client: fakeClient,
        async reply(text) { unauthReplies.push(text); }
    };
    assert.strictEqual(await handleClearCacheCommand(unauthMsg), true);
    assert.match(unauthReplies[0], /Manage Server/);

    // 3. Unrelated message returns false.
    assert.strictEqual(await handleClearCacheCommand({ content: "hello" }), false);

    // 4. Authorized admin can run !clearcache all and clear remaining cached messages.
    const adminReplies = [];
    const adminMsg = {
        content: "!clearcache all",
        guild: { id: "guild-1" },
        member: { permissions: { has: perm => perm === "MANAGE_GUILD" } },
        client: fakeClient,
        async reply(text) { adminReplies.push(text); }
    };
    assert.strictEqual(await handleClearCacheCommand(adminMsg, {
        cleanupProcessedMessages: (forceAll) => (forceAll ? 3 : 0)
    }), true);
    assert.strictEqual(channel1.messages.cache.size, 0, "manual !clearcache should clear all cached messages");
    assert.match(adminReplies[0], /Cache bot berhasil dibersihkan/);
    assert.match(adminReplies[0], /Mode: `all`/);

    // 5. Scheduler starts and stops cleanly.
    const handle = startCacheCleanupScheduler(fakeClient, { intervalMs: 60_000 });
    assert.ok(handle);
    stopCacheCleanupScheduler();

    console.log("Cache cleaner tests passed.");
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        stopCacheCleanupScheduler();
        Module._load = originalLoad;
    });
