const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reysie-jaga-test-"));
process.env.STAY_DATA_FILE = path.join(tempDirectory, "voice-stay.json");

let voiceModulePath = null;
let originalVoiceModule = null;
try {
    voiceModulePath = require.resolve("@discordjs/voice");
    originalVoiceModule = require.cache[voiceModulePath];
} catch (error) {
    // Allow tests to run even when node_modules is not installed locally.
}
const originalModuleLoad = Module._load;
let joinOptions;
let currentConnection;
let joinCount = 0;
let destroyCount = 0;
let createdPlayers = [];
const voiceStatesByGuild = new Map();
const guildVoiceStates = new Map();
const guildChannels = new Map();
const guild = {
    id: "guild-1",
    me: {},
    voiceAdapterCreator: "adapter",
    voiceStates: { cache: guildVoiceStates },
    channels: {
        cache: guildChannels,
        async fetch(channelId) {
            return guildChannels.get(channelId);
        }
    }
};
voiceStatesByGuild.set(guild.id, guildVoiceStates);
const channel = {
    id: "voice-1",
    name: "General",
    type: "GUILD_VOICE",
    permissionsFor() {
        return { has: permission => ["CONNECT", "SPEAK"].includes(permission) };
    }
};
guildChannels.set(channel.id, channel);
const connection = {
    joinConfig: { channelId: "voice-1" },
    state: { status: "ready" },
    on() {
        return this;
    },
    subscribe(player) {
        this.subscriber = player;
        return { player };
    },
    destroy() {
        destroyCount += 1;
        this.state.status = "destroyed";
        currentConnection = null;
    }
};

const mockedVoiceExports = {
    joinVoiceChannel(options) {
        joinOptions = options;
        joinCount += 1;
        connection.joinConfig = { channelId: options.channelId };
        connection.state.status = "ready";
        currentConnection = connection;
        voiceStatesByGuild.get(options.guildId)?.set("bot-1", { channelId: options.channelId });
        return connection;
    },
    VoiceConnectionStatus: { Ready: "ready", Disconnected: "disconnected" },
    NoSubscriberBehavior: { Play: "play" },
    StreamType: { Opus: "opus" },
    createAudioPlayer() {
        const player = {
            stopped: false,
            on() {
                return this;
            },
            play(resource) {
                this.resource = resource;
            },
            stop() {
                this.stopped = true;
            }
        };
        createdPlayers.push(player);
        return player;
    },
    createAudioResource(stream, options) {
        return { stream, ...options };
    },
    async entersState(actualConnection, status, timeout) {
        assert.strictEqual(actualConnection, connection);
        assert.strictEqual(status, "ready");
        assert.strictEqual(timeout, 30_000);
    },
    getVoiceConnection() {
        return currentConnection;
    }
};

if (voiceModulePath) {
    require.cache[voiceModulePath] = {
        id: voiceModulePath,
        filename: voiceModulePath,
        loaded: true,
        exports: mockedVoiceExports
    };
} else {
    Module._load = function patchedLoad(request, parent, isMain) {
        if (request === "@discordjs/voice") return mockedVoiceExports;
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
        if (request === "play-dl") return {};
        if (request === "spotify-web-api-node") {
            return class SpotifyWebApi {
                setAccessToken() {}
            };
        }
        return originalModuleLoad.call(this, request, parent, isMain);
    };
}

const {
    handleJagaCommand,
    handleJagaVoiceStateUpdate,
    startConfiguredJaga
} = require("../commands/jaga");
const { handlePlayMusicCommand } = require("../commands/playmusic");

function createMessage(content, voiceChannel) {
    const replies = [];
    return {
        content,
        guild,
        client: { user: { id: "bot-1" } },
        member: { voice: { channel: voiceChannel } },
        replies,
        async reply(text) {
            replies.push(text);
        }
    };
}

async function run() {
    const unrelatedMessage = createMessage("hello", channel);
    assert.strictEqual(await handleJagaCommand(unrelatedMessage), false);
    assert.deepStrictEqual(unrelatedMessage.replies, []);

    const noVoiceMessage = createMessage("!jaga", null);
    assert.strictEqual(await handleJagaCommand(noVoiceMessage), true);
    assert.match(noVoiceMessage.replies[0], /harus masuk ke voice channel/);

    const noSpeakChannel = {
        ...channel,
        permissionsFor() {
            return { has: permission => permission === "CONNECT" };
        }
    };
    const noSpeakMessage = createMessage("!jaga", noSpeakChannel);
    assert.strictEqual(await handleJagaCommand(noSpeakMessage), true);
    assert.match(noSpeakMessage.replies[0], /izin untuk mengirim audio/);

    currentConnection = null;
    joinOptions = null;
    const joinMessage = createMessage("!jaga", channel);
    assert.strictEqual(await handleJagaCommand(joinMessage), true);
    assert.deepStrictEqual(joinOptions, {
        channelId: "voice-1",
        guildId: "guild-1",
        adapterCreator: "adapter",
        selfDeaf: true
    });
    assert.strictEqual(joinCount, 1);
    assert.strictEqual(connection.subscriber, createdPlayers[0], "jaga should stream silent keepalive audio");
    assert.match(joinMessage.replies[0], /akan tetap di sana/);

    currentConnection = connection;
    const alreadyJoinedMessage = createMessage("!jaga", channel);
    assert.strictEqual(await handleJagaCommand(alreadyJoinedMessage), true);
    assert.match(alreadyJoinedMessage.replies[0], /sudah berada di voice channel/);

    joinMessage.guild.voiceStates.cache.set("bot-1", { channelId: null });
    connection.state.status = "disconnected";
    const botLeftVoice = {
        id: "bot-1",
        guild: { id: "guild-1" },
        channelId: null
    };
    assert.strictEqual(await handleJagaVoiceStateUpdate({ channelId: "voice-1" }, botLeftVoice), true);
    await new Promise(resolve => setTimeout(resolve, 3100));
    assert.strictEqual(joinCount, 2, "the bot should reconnect after leaving its protected voice channel");

    const leaveMessage = createMessage("!leave", channel);
    assert.strictEqual(await handlePlayMusicCommand(leaveMessage), true);
    assert.strictEqual(destroyCount, 2, "!leave should disconnect an idle !jaga connection");
    assert.strictEqual(createdPlayers[0].stopped, true, "!leave should stop silent keepalive audio");
    assert.match(leaveMessage.replies[0], /Bot keluar dari voice channel/);

    currentConnection = connection;
    connection.state.status = "ready";
    const healthyMessage = createMessage("!jaga", channel);
    await handleJagaCommand(healthyMessage);
    const joinsBeforeMemberLeaves = joinCount;
    const memberLeftVoice = {
        id: "member-1",
        guild: { id: "guild-1" },
        channelId: null
    };
    guildVoiceStates.delete("bot-1");
    assert.strictEqual(
        await handleJagaVoiceStateUpdate({ channelId: "voice-1" }, memberLeftVoice),
        false
    );
    assert.strictEqual(
        joinCount,
        joinsBeforeMemberLeaves,
        "a healthy voice connection must not be reset just because the bot voice state is uncached"
    );

    await handlePlayMusicCommand(createMessage("!leave", channel));

    const previousJagaChannelId = process.env.JAGA_CHANNEL_ID;
    const previousJagaGuildId = process.env.JAGA_GUILD_ID;
    try {
        process.env.JAGA_CHANNEL_ID = "voice-1";
        process.env.JAGA_GUILD_ID = "guild-1";
        const client = {
            user: { id: "bot-1" },
            guilds: {
                cache: { get: guildId => guildId === guild.id ? guild : null }
            }
        };
        assert.strictEqual(await startConfiguredJaga(client), true);
        assert.strictEqual(joinCount, 3, "configured voice targets should be restored after bot startup");
        assert.strictEqual(currentConnection.joinConfig.channelId, "voice-1");

        const stopConfiguredMessage = createMessage("!leave", channel);
        assert.strictEqual(await handlePlayMusicCommand(stopConfiguredMessage), true);
        assert.strictEqual(destroyCount, 4);
    } finally {
        if (previousJagaChannelId === undefined) delete process.env.JAGA_CHANNEL_ID;
        else process.env.JAGA_CHANNEL_ID = previousJagaChannelId;
        if (previousJagaGuildId === undefined) delete process.env.JAGA_GUILD_ID;
        else process.env.JAGA_GUILD_ID = previousJagaGuildId;
    }

    console.log("Jaga command tests passed.");
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        Module._load = originalModuleLoad;
        if (voiceModulePath) {
            if (originalVoiceModule) {
                require.cache[voiceModulePath] = originalVoiceModule;
            } else {
                delete require.cache[voiceModulePath];
            }
        }
        fs.rmSync(tempDirectory, { recursive: true, force: true });
    });
