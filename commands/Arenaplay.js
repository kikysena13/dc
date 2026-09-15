const Discord = require("discord.js");
const https = require("https");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const ARENA_EVENT_VIDEO = "https://assets.huaxu.app/spines/spinelogin/4-7/render/_default.vp9.webm";

// Edit rules server di fungsi createRulesEmbed() di bawah.
// Ubah teks, judul, footer, dan role mention sesuai kebutuhan servermu.
function createRulesEmbed(mentionLines, channelMentions) {
    return new Discord.MessageEmbed()
        .setColor("#6a0dad")
        .setTitle("📜 RULES SERVER")
        .setDescription("🌙 Selamat datang di Midnight Lounge\n\nTempat untuk bermain, berkembang, dan bersenang-senang bersama. Hormati sesama dan nikmati prosesnya ✨")
        .addFields(
            {
                name: "━━━━━━━━━━━━━━",
                value: "1. Hormati Semua Member 🤝\nJangan toxic, menghina, memancing konflik, atau menyerang pribadi.\n\n2. Dilarang Spam 🚫\nJangan spam chat, emoji, mention, command bot, atau kirim pesan berulang.\n\n3. Gunakan Channel Sesuai Fungsi 📂\nGunakan channel sesuai kategori agar server tetap rapi.\n\n4. Konten Aman & Nyaman 🛡️\nDilarang mengirim konten NSFW, gore, atau hal yang membuat member lain tidak nyaman.\n\n5. Tidak Boleh Cheat / Scam ❌\nSegala bentuk penipuan, exploit, atau aktivitas merugikan member lain tidak diperbolehkan.\n\n6. Jaga Suasana Voice Chat 🎧\nHindari mic berisik, soundboard berlebihan, dan gangguan ke pengguna lain.\n\n7. Hormati Staff 👑\nIkuti arahan staff. Jika ada masalah gunakan report atau ticket.\n\n8. Dilarang Iklan Tanpa Izin 📢\nPromosi server, akun, atau link luar harus izin staff.\n\n9. Bermain dengan Santai 🐾\nMenang kalah biasa — tujuan utama adalah berkembang dan menikmati komunitas.\n\n10. Gunakan Akal Sehat ⭐\nKalau sesuatu terasa mengganggu atau merugikan orang lain, jangan dilakukan."            },
            {
                name: "━━━━━━━━━━━━━━",
                value: "🎁 MEMBER YANG AKTIF AKAN MENDAPAT:\n\n✨ Event seru\n🎉 Giveaway\n🏆 Reward komunitas\n💎 Kesempatan naik role"
            },
            {
                name: "━━━━━━━━━━━━━━",
                value: `Dm jika ada drama\n\n${mentionLines.join("\n")}`
            },
            {
                name: "━━━━━━━━━━━━━━",
                value: `Atau laporkan\n\n${channelMentions.join("\n")}`
            }
        )
        .setImage("https://media.discordapp.net/attachments/939724276519534632/941479400690552862/IMG_2941.gif?ex=6a6b38c4&is=6a69e744&hm=84bafcd007d6bd88ce548219ce2e02d713119854d36b3a93a105798a24a6b3fc&=&width=1860&height=744")
        .setFooter({ text: "Dengan bergabung, kamu dianggap setuju dengan semua peraturan di atas. 🌙 Grow Together • Win Together • Respect Everyone" })
        .setTimestamp();
}

function createRulesHelpEmbed() {
    return new Discord.MessageEmbed()
        .setColor("#3498db")
        .setTitle("📖 Rules Command Help")
        .setDescription("Gunakan command rules untuk menampilkan informasi rules/guild requirements di server.")
        .addFields(
            {
                name: "📌 Penggunaan",
                value: "`!rules` - Tampilkan embed rules default\n`!rules help` - Tampilkan bantuan command",
            },
            {
                name: "⚙️ Contoh",
                value: "`!rules`",
            }
        )
        .setFooter({ text: "Command: !rules" });
}

function createArenaEventEmbed(eventDetails, author) {
    return new Discord.MessageEmbed()
        .setColor("#e74c3c")
        .setTitle("⚔️ ARENA EVENT DIMULAI")
        .setDescription(`Event arena resmi dimulai!\n\n${eventDetails}`)
        .setImage("attachment://arena-event-banner.png")
        .setFooter({ text: `Event diumumkan oleh ${author.tag}` })
        .setTimestamp();
}

function createArenaEventBanner() {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
            "-i", "pipe:0",
            "-frames:v", "1",
            "-f", "image2",
            "pipe:1"
        ]);
        const chunks = [];
        let errorOutput = "";

        ffmpeg.stdout.on("data", chunk => chunks.push(chunk));
        ffmpeg.stderr.on("data", chunk => {
            errorOutput += chunk.toString();
        });
        ffmpeg.stdin.on("error", () => {});
        ffmpeg.on("error", reject);
        ffmpeg.on("close", code => {
            if (code === 0 && chunks.length > 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(new Error(`Failed to create arena banner: ${errorOutput}`));
            }
        });

        https.get(ARENA_EVENT_VIDEO, response => {
            if (response.statusCode !== 200) {
                ffmpeg.kill();
                reject(new Error(`Arena video returned HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(ffmpeg.stdin);
        }).on("error", error => {
            ffmpeg.kill();
            reject(error);
        });
    });
}

async function handleArenaEventCommand(message) {
    const commandMatch = message.content.match(/^(!arenaevent)(?:\s|$)/i);

    if (!commandMatch) {
        return false;
    }

    if (!message.member?.permissions.has("MANAGE_MESSAGES")) {
        await message.reply("Kamu tidak memiliki izin untuk mengumumkan dimulainya event.");
        return true;
    }

    const eventDetails = message.content.slice(commandMatch[0].length).trim();
    if (!eventDetails) {
        await message.reply("Gunakan: `!arenaevent nama event | jadwal atau informasi event`");
        return true;
    }

    let banner;
    try {
        banner = await createArenaEventBanner();
    } catch (error) {
        console.error(error);
    }

    await message.channel.send({
        content: "@everyone",
        embeds: [createArenaEventEmbed(eventDetails, message.author)],
        files: banner ? [new Discord.MessageAttachment(banner, "arena-event-banner.png")] : [],
        allowedMentions: { parse: ["everyone"] }
    }).catch(error => console.error(error));

    return true;
}

async function handleRulesCommand(message) {
    const content = message.content.toLowerCase().trim();
    const args = content.split(/\s+/);
    const command = args[0];
    const validCommands = ["!rules", "!rule", "rules", "rule"];

    if (!validCommands.includes(command)) {
        return false;
    }

    if (args[1] === "help" || args[1] === "?") {
        await message.reply({ embeds: [createRulesHelpEmbed()] });
        return true;
    }

    const roleNames = ["OWNER ✪", "Admin"];
    const channelNames = [
        "╭・🚨｜help-staff",
        "├・📢｜bantuan-tiket",
        "╰・📜｜ticket-logs"
    ];
    const roleMentions = [];
    const allowedRoles = [];
    const channelMentions = [];

    for (const roleName of roleNames) {
        const role = message.guild?.roles.cache.find(r => r.name === roleName);
        if (role) {
            roleMentions.push(`<@&${role.id}>`);
            allowedRoles.push(role.id);
        } else {
            roleMentions.push(`@${roleName}`);
        }
    }

    for (const channelName of channelNames) {
        const channel = message.guild?.channels.cache.find(c =>
            c.name === channelName ||
            c.name.endsWith(channelName) ||
            c.name.includes(channelName)
        );
        if (channel) {
            channelMentions.push(`<#${channel.id}>`);
        } else {
            channelMentions.push(`#${channelName}`);
        }
    }

    await message.reply({
        content: "@everyone",
        embeds: [createRulesEmbed(roleMentions, channelMentions)],
        allowedMentions: {
            parse: ["everyone"],
            roles: allowedRoles
        }
    }).catch(err => console.error(err));
    return true;
}

module.exports = {
    handleArenaEventCommand,
    handleRulesCommand
};
