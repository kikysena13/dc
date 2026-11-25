const fs = require("fs");
const path = require("path");

const DATA_FILE = process.env.ACTIVITY_DATA_FILE || path.join(__dirname, "..", "data", "activity-points.json");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_MS = 31 * DAY_MS;

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
            voiceSessions: activity.voiceSessions && typeof activity.voiceSessions === "object" ? activity.voiceSessions : {},
            hourlyMessages: activity.hourlyMessages && typeof activity.hourlyMessages === "object" ? activity.hourlyMessages : {},
            events: Array.isArray(activity.events) ? activity.events : []
        };
    } catch (error) {
        if (error.code === "ENOENT") return { members: {}, voiceSessions: {}, hourlyMessages: {}, events: [] };
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

function addDashboardEvent(activity, category, summary, timestamp = Date.now()) {
    activity.events.unshift({
        id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
        category,
        summary,
        createdAt: new Date(timestamp).toISOString()
    });
    activity.events = activity.events.slice(0, 50);
}

function recordChatMessage(user, channelName = null) {
    const activity = readActivity();
    const now = Date.now();
    const existingMember = activity.members[user.id] || {};
    const member = {
        ...existingMember,
        username: user.username,
        chatMessages: normalizeCounter(existingMember.chatMessages) + 1,
        voiceMinutes: normalizeCounter(existingMember.voiceMinutes)
    };
    member.lastChatAt = new Date(now).toISOString();
    activity.members[user.id] = member;
    const hourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
    const hourKey = new Date(hourStart).toISOString();
    activity.hourlyMessages[hourKey] = normalizeCounter(activity.hourlyMessages[hourKey]) + 1;
    for (const key of Object.keys(activity.hourlyMessages)) {
        if (Date.parse(key) < now - HISTORY_MS) delete activity.hourlyMessages[key];
    }
    addDashboardEvent(
        activity,
        "message",
        channelName ? `Message in #${channelName}` : "A new server message",
        now,
    );
    writeActivity(activity);
}

function getMessageActivity(range, now = Date.now()) {
    const activity = readActivity();
    const sumBetween = (start, end) => Object.entries(activity.hourlyMessages).reduce((total, [key, value]) => {
        const timestamp = Date.parse(key);
        return timestamp >= start && timestamp < end ? total + normalizeCounter(value) : total;
    }, 0);

    if (range === "24h") {
        const currentBlock = Math.floor(now / (4 * HOUR_MS)) * 4 * HOUR_MS;
        const start = currentBlock - 5 * 4 * HOUR_MS;
        return Array.from({ length: 6 }, (_, index) => {
            const bucketStart = start + index * 4 * HOUR_MS;
            return {
                label: String(new Date(bucketStart).getUTCHours()).padStart(2, "0"),
                value: sumBetween(bucketStart, bucketStart + 4 * HOUR_MS)
            };
        });
    }

    if (range === "7d") {
        const today = Math.floor(now / DAY_MS) * DAY_MS;
        const start = today - 6 * DAY_MS;
        return Array.from({ length: 7 }, (_, index) => {
            const bucketStart = start + index * DAY_MS;
            const label = new Date(bucketStart).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
            return { label, value: sumBetween(bucketStart, bucketStart + DAY_MS) };
        });
    }

    if (range === "30d") {
        const today = Math.floor(now / DAY_MS) * DAY_MS;
        const start = today - 29 * DAY_MS;
        return Array.from({ length: 5 }, (_, index) => {
            const bucketStart = start + index * 6 * DAY_MS;
            const bucketEnd = Math.min(bucketStart + 6 * DAY_MS, today + DAY_MS);
            const firstDay = Math.floor((bucketStart - start) / DAY_MS) + 1;
            const lastDay = Math.floor((bucketEnd - start - 1) / DAY_MS) + 1;
            return {
                label: `${firstDay}-${lastDay}`,
                value: sumBetween(bucketStart, bucketEnd)
            };
        });
    }

    return [];
}

function getRecentDashboardActivity(limit = 20) {
    const activity = readActivity();
    const safeLimit = Math.max(0, Math.min(50, Number(limit) || 0));
    return activity.events.slice(0, safeLimit);
}

function recordGuildMemberJoin(member) {
    const activity = readActivity();
    const name = member.displayName || member.user?.globalName || member.user?.username || "A member";
    addDashboardEvent(activity, "member", `${name} joined the server`);
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
    const oldChannelName = oldState.channel?.name || "a voice channel";
    const newChannelName = newState.channel?.name || "a voice channel";
    closeVoiceSession(activity, user.id, now);
    if (newState.channelId) activity.voiceSessions[user.id] = new Date(now).toISOString();
    addDashboardEvent(
        activity,
        "voice",
        newState.channelId
            ? oldState.channelId
                ? `Moved to ${newChannelName}`
                : `Joined ${newChannelName}`
            : `Left ${oldChannelName}`,
        now,
    );
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
    recordGuildMemberJoin,
    getMessageActivity,
    getRecentDashboardActivity,
    recordVoiceStateChange,
    initializeVoiceSessions,
    finalizeVoiceSessions
};
