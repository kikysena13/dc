'use strict';

const fs   = require('fs');
const path = require('path');

const NEW_ROLE_NAME  = 'New';
const DAYS_THRESHOLD = 30;
const CHECK_INTERVAL = 10 * 60 * 1000;
const DATA_FILE      = path.join(__dirname, '..', 'data', 'new-member-roles.json');

function readData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('[NewMemberRole] Gagal menyimpan data:', err.message);
    }
}

function recordNewMember(userId) {
    const data = readData();
    if (!data[userId]) {
        data[userId] = Date.now();
        saveData(data);
    }
}

function removeFromData(userId) {
    const data = readData();
    delete data[userId];
    saveData(data);
}

async function handleGuildMemberAdd(member) {
    if (member.user.bot) return;

    const newRole = member.guild.roles.cache.find(
        r => r.name.toLowerCase() === NEW_ROLE_NAME.toLowerCase()
    );

    if (!newRole) {
        console.warn(`[NewMemberRole] Role "${NEW_ROLE_NAME}" tidak ditemukan di server ${member.guild.name}.`);
        return;
    }

    try {
        await member.roles.add(newRole, 'Member baru bergabung');
        recordNewMember(member.id);
        console.log(`[NewMemberRole] Role "${NEW_ROLE_NAME}" diberikan ke ${member.user.tag}`);
    } catch (err) {
        console.error(`[NewMemberRole] Gagal kasih role ke ${member.user.tag}:`, err.message);
    }
}

async function checkAndRemoveExpiredRoles(guild) {
    if (!guild) return;

    const data    = readData();
    const now     = Date.now();
    const limitMs = DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

    try {
        await guild.members.fetch();
    } catch (err) {
        console.error('[NewMemberRole] Gagal fetch members:', err.message);
        return;
    }

    const newRole = guild.roles.cache.find(
        r => r.name.toLowerCase() === NEW_ROLE_NAME.toLowerCase()
    );

    if (!newRole) return;

    for (const [userId, joinedAt] of Object.entries(data)) {
        const elapsed = now - joinedAt;
        if (elapsed < limitMs) continue;

        const member = guild.members.cache.get(userId);

        if (!member) {
            removeFromData(userId);
            continue;
        }

        if (!member.roles.cache.has(newRole.id)) {
            removeFromData(userId);
            continue;
        }

        try {
            await member.roles.remove(newRole, `Role "${NEW_ROLE_NAME}" expired setelah ${DAYS_THRESHOLD} hari`);
            removeFromData(userId);
            console.log(`[NewMemberRole] Role "${NEW_ROLE_NAME}" dihapus dari ${member.user.tag} (sudah ${Math.floor(elapsed / 86400000)} hari)`);
        } catch (err) {
            console.error(`[NewMemberRole] Gagal hapus role dari ${member.user.tag}:`, err.message);
        }
    }
}

function startNewMemberRoleScheduler(getGuildFn) {
    setTimeout(() => checkAndRemoveExpiredRoles(getGuildFn()), 5000);
    setInterval(() => checkAndRemoveExpiredRoles(getGuildFn()), CHECK_INTERVAL);
}

module.exports = {
    handleGuildMemberAdd,
    startNewMemberRoleScheduler,
    checkAndRemoveExpiredRoles
};
