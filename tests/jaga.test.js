const assert = require("assert");

const voiceModulePath = require.resolve("@discordjs/voice");
const originalVoiceModule = require.cache[voiceModulePath];
let joinOptions;
let currentConnection;
let joinCount = 0;
let destroyCount = 0;
const voiceStatesByGuild = new Map();
const guildVoiceStates = new Map();
const guild = {
    id: "guild-1",
    me: {},
    voiceAdapterCreator: "adapter",
    voiceStates: { cache: guildVoiceStates }
};
voiceStatesByGuild.set(guild.id, guildVoiceStates);
const connection = {
    joinConfig: { channelId: "voice-1" },
    state: { status: "ready" },
    on() {
        return this;
    },
    destroy() {
        destroyCount += 1;
        this.state.status = "destroyed";
        currentConnection = null;
    }
};

require.cache[voiceModulePath] = {
    id: voiceModulePath,
    filename: voiceModulePath,
    loaded: true,
    exports: {
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
        async entersState(actualConnection, status, timeout) {
            assert.strictEqual(actualConnection, connection);
            assert.strictEqual(status, "ready");
            assert.strictEqual(timeout, 30_000);
        },
        getVoiceConnection() {
            return currentConnection;
        }
    }
};

const { handleJagaCommand, handleJagaVoiceStateUpdate } = require("../commands/jaga");
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
    const channel = {
        id: "voice-1",
        name: "General",
        permissionsFor() {
            return { has: permission => permission === "CONNECT" };
        }
    };

    const unrelatedMessage = createMessage("hello", channel);
    assert.strictEqual(await handleJagaCommand(unrelatedMessage), false);
    assert.deepStrictEqual(unrelatedMessage.replies, []);

    const noVoiceMessage = createMessage("!jaga", null);
    assert.strictEqual(await handleJagaCommand(noVoiceMessage), true);
    assert.match(noVoiceMessage.replies[0], /harus masuk ke voice channel/);

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
    assert.match(joinMessage.replies[0], /akan tetap di sana/);

    currentConnection = connection;
    const alreadyJoinedMessage = createMessage("!jaga", channel);
    assert.strictEqual(await handleJagaCommand(alreadyJoinedMessage), true);
    assert.match(alreadyJoinedMessage.replies[0], /sudah berada di voice channel/);

    joinMessage.guild.voiceStates.cache.set("bot-1", { channelId: null });
    const botLeftVoice = {
        id: "bot-1",
        guild: { id: "guild-1" },
        channelId: null
    };
    assert.strictEqual(await handleJagaVoiceStateUpdate({}, botLeftVoice), true);
    assert.strictEqual(joinCount, 2, "the bot should rejoin after it leaves its protected voice channel");

    const leaveMessage = createMessage("!leave", channel);
    assert.strictEqual(await handlePlayMusicCommand(leaveMessage), true);
    assert.strictEqual(destroyCount, 2, "!leave should disconnect an idle !jaga connection");
    assert.match(leaveMessage.replies[0], /Bot keluar dari voice channel/);

    console.log("Jaga command tests passed.");
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => {
        if (originalVoiceModule) {
            require.cache[voiceModulePath] = originalVoiceModule;
        } else {
            delete require.cache[voiceModulePath];
        }
    });
