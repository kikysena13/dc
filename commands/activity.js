const fs = require("fs");
const path = require("path");

const DATA_FILE = process.env.ACTIVITY_DATA_FILE || path.join(__dirname, "..", "data", "activity-points.json");

function normalizeCounter(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function readActivity() {
    try {
        const activity = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        return {
            ...activity,
            members: activity.members && typeof activity.members === "object" ? activity.members : {},
            voiceSessions: activity.voiceSessions && typeof activity.voiceSessions === "object" ? activity.voiceSessions : {}
        };
    } catch (error) {
        if (error.code === "ENOENT") return { members: {}, voiceSessions: {} };
        throw error;
    }
}

function writeActivity(activity) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(activity, null, 2) + "\n");
}

function getMemberActivityFromData(activity, userId, now) {
    const storedMember = activity.members[userId] || {};
    const member = {
        ...storedMember,
        chatMessages: normalizeCounter(storedMember.chatMessages),
        voiceMinutes: normalizeCounter(storedMember.voiceMinutes)
    };
    const startedAt = Date.parse(activity.voiceSessions[userId]);
    if (Number.isFinite(startedAt) && now > startedAt) {
        member.voiceMinutes += Math.floor((now - startedAt) / 60000);
    }
    return member;
}

function getMemberActivity(userId, now = Date.now()) {
    return getMemberActivityFromData(readActivity(), userId, now);
}

function getAllMemberActivities(now = Date.now()) {
    const activity = readActivity();
    const userIds = new Set([
        ...Object.keys(activity.members),
        ...Object.keys(activity.voiceSessions)
    ]);
    return new Map([...userIds].map(userId => [
        userId,
        getMemberActivityFromData(activity, userId, now)
    ]));
}

function recordChatMessage(user) {
    const activity = readActivity();
    const existingMember = activity.members[user.id] || {};
    const member = {
        ...existingMember,
        username: user.username,
        chatMessages: normalizeCounter(existingMember.chatMessages) + 1,
        voiceMinutes: normalizeCounter(existingMember.voiceMinutes)
    };
    member.lastChatAt = new Date().toISOString();
    activity.members[user.id] = member;
    writeActivity(activity);
}

function closeVoiceSession(activity, userId, endedAt) {
    const startedAt = Date.parse(activity.voiceSessions[userId]);
    if (!Number.isFinite(startedAt)) {
        delete activity.voiceSessions[userId];
        return;
    }

    const minutes = Math.max(0, Math.floor((endedAt - startedAt) / 60000));
    const existingMember = activity.members[userId] || {};
    const member = {
        ...existingMember,
        chatMessages: normalizeCounter(existingMember.chatMessages),
        voiceMinutes: normalizeCounter(existingMember.voiceMinutes) + minutes
    };
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

function initializeVoiceSessions(activeUserIds, startedAt = Date.now()) {
    const activity = readActivity();
    activity.voiceSessions = {};
    for (const userId of activeUserIds) {
        if (userId) activity.voiceSessions[String(userId)] = new Date(startedAt).toISOString();
    }
    writeActivity(activity);
}

function finalizeVoiceSessions(endedAt = Date.now()) {
    const activity = readActivity();
    const userIds = Object.keys(activity.voiceSessions);
    if (!userIds.length) return;
    for (const userId of userIds) closeVoiceSession(activity, userId, endedAt);
    writeActivity(activity);
}

module.exports = {
    getMemberActivity,
    getAllMemberActivities,
    recordChatMessage,
    recordVoiceStateChange,
    initializeVoiceSessions,
    finalizeVoiceSessions
};
