const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "grind-game-activity-"));
process.env.ACTIVITY_DATA_FILE = path.join(tempDirectory, "activity-points.json");

const {
    getMemberActivity,
    getAllMemberActivities,
    recordChatMessage,
    recordVoiceStateChange,
    initializeVoiceSessions,
    finalizeVoiceSessions
} = require("../commands/activity");

const dataFile = process.env.ACTIVITY_DATA_FILE;

function writeData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function readData() {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

try {
    const now = Date.parse("2026-09-20T12:00:00.000Z");
    writeData({
        members: { user1: { username: "member", chatMessages: 4, voiceMinutes: 10 } },
        voiceSessions: { user1: "2026-09-20T11:57:30.000Z" }
    });

    const currentActivity = getMemberActivity("user1", now);
    assert.strictEqual(currentActivity.chatMessages, 4);
    assert.strictEqual(currentActivity.voiceMinutes, 12);
    assert.strictEqual(readData().members.user1.voiceMinutes, 10, "live reads must not persist the current session twice");

    const allActivities = getAllMemberActivities(now);
    assert.strictEqual(allActivities.get("user1").voiceMinutes, 12);

    recordChatMessage({ id: "user1", username: "member" });
    recordChatMessage({ id: "user1", username: "member" });
    assert.strictEqual(readData().members.user1.chatMessages, 6, "identical chat messages must each count once");

    initializeVoiceSessions(["user2"], now - 5 * 60_000);
    let data = readData();
    assert.deepStrictEqual(data.voiceSessions, { user2: new Date(now - 5 * 60_000).toISOString() });
    assert.strictEqual(data.members.user1.voiceMinutes, 10, "reconciliation must discard stale open sessions");

    finalizeVoiceSessions(now);
    data = readData();
    assert.strictEqual(data.members.user2.voiceMinutes, 5);
    assert.deepStrictEqual(data.voiceSessions, {});

    const voiceTransitionStartedAt = Date.now() - 61_000;
    const voiceMinutesBeforeLeave = readData().members.user1.voiceMinutes;
    initializeVoiceSessions(["user1"], voiceTransitionStartedAt);
    recordVoiceStateChange(
        { channelId: "voice-a", member: { user: { id: "user1", username: "member", bot: false } } },
        { channelId: null, member: { user: { id: "user1", username: "member", bot: false } } }
    );
    assert.deepStrictEqual(readData().voiceSessions, {});
    assert.strictEqual(readData().members.user1.voiceMinutes, voiceMinutesBeforeLeave + 1);

    writeData({ members: { broken: { chatMessages: "bad", voiceMinutes: null } }, voiceSessions: {} });
    assert.strictEqual(getMemberActivity("broken", now).chatMessages, 0);
    recordChatMessage({ id: "broken", username: "legacy member" });
    assert.strictEqual(readData().members.broken.chatMessages, 1);

    console.log("Activity tracking tests passed.");
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
}