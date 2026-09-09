const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "activity-points.json");

function readActivity() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (error) {
        if (error.code === "ENOENT") return { members: {}, voiceSessions: {} };
        throw error;
    }
}

function writeActivity(activity) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(activity, null, 2) + "\n");
}

function getMemberActivity(userId) {
    const activity = readActivity();
    const member = activity.members[userId] || { chatMessages: 0, voiceMinutes: 0 };
    const startedAt = activity.voiceSessions[userId];
    if (startedAt) {
        member.voiceMinutes = (member.voiceMinutes || 0) + Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    }
    return member;
}

function recordChatMessage(user) {
    const activity = readActivity();
    const member = activity.members[user.id] || { username: user.username, chatMessages: 0, voiceMinutes: 0 };
    member.username = user.username;
    member.chatMessages += 1;
    member.lastChatAt = new Date().toISOString();
    activity.members[user.id] = member;
    writeActivity(activity);
}

function closeVoiceSession(activity, userId, endedAt) {
    const startedAt = activity.voiceSessions[userId];
    if (!startedAt) return;

    const minutes = Math.max(0, Math.floor((endedAt - new Date(startedAt).getTime()) / 60000));
    const member = activity.members[userId] || { chatMessages: 0, voiceMinutes: 0 };
    member.voiceMinutes = (member.voiceMinutes || 0) + minutes;
    activity.members[userId] = member;
    delete activity.voiceSessions[userId];
}

function recordVoiceStateChange(oldState, newState) {
    const user = newState.member?.user || oldState.member?.user;
    if (!user || user.bot || oldState.channelId === newState.channelId) return;

    const activity = readActivity();
    const now = Date.now();
    closeVoiceSession(activity, user.id, now);
    if (newState.channelId) activity.voiceSessions[user.id] = new Date(now).toISOString();
    writeActivity(activity);
}

module.exports = { getMemberActivity, recordChatMessage, recordVoiceStateChange };
