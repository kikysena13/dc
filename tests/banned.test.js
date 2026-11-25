const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "grind-game-voice-ban-"));
const dataFile = path.join(tempDirectory, "voice-bans.json");
const { handleVoiceBanCommand, handleBannedVoiceStateUpdate } = require("../commands/banned");

function createMessage(content, canManageGuild = true) {
    const replies = [];
    return {
        content,
        guild: { id: "guild-1" },
        member: { permissions: { has: () => canManageGuild } },
        replies,
        async reply(text) {
            replies.push(text);
        }
    };
}

async function run() {
    const unauthorized = createMessage("!ban <@123>", false);
    assert.strictEqual(await handleVoiceBanCommand(unauthorized, dataFile), true);
    assert.match(unauthorized.replies[0], /Manage Server/);
    assert.strictEqual(fs.existsSync(dataFile), false);

    const banMessage = createMessage("!ban<@!123>");
    assert.strictEqual(await handleVoiceBanCommand(banMessage, dataFile), true);
    assert.match(banMessage.replies[0], /diblokir dari voice/);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(dataFile, "utf8")), { "guild-1": ["123"] });

    let disconnectedWith;
    const voiceState = {
        id: "123",
        guild: { id: "guild-1" },
        channelId: "voice-1",
        member: { voice: { async disconnect(reason) { disconnectedWith = reason; } } }
    };
    assert.strictEqual(await handleBannedVoiceStateUpdate({ channelId: null }, voiceState, dataFile), true);
    assert.match(disconnectedWith, /diblokir/);
    assert.strictEqual(await handleBannedVoiceStateUpdate({ channelId: "voice-1" }, voiceState, dataFile), false);

    const otherGuildState = { ...voiceState, guild: { id: "guild-2" } };
    assert.strictEqual(await handleBannedVoiceStateUpdate({ channelId: null }, otherGuildState, dataFile), false);

    const unbanMessage = createMessage("!unban <@123>");
    assert.strictEqual(await handleVoiceBanCommand(unbanMessage, dataFile), true);
    assert.match(unbanMessage.replies[0], /diizinkan masuk voice/);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(dataFile, "utf8")), {});
    assert.strictEqual(await handleBannedVoiceStateUpdate({ channelId: null }, voiceState, dataFile), false);

    console.log("Voice-ban tests passed.");
}

run()
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => fs.rmSync(tempDirectory, { recursive: true, force: true }));
