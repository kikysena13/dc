const Discord = require("discord.js");

// Karakter yang tersedia untuk generate kode
const CHAR_SETS = {
    alphanumeric: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    lowercase: "abcdefghijklmnopqrstuvwxyz0123456789",
    numbers: "0123456789",
    hex: "0123456789ABCDEF"
};

/**
 * Generate kode random
 * @param {number} length - Panjang kode
 * @param {string} charSet - Set karakter yang digunakan
 * @returns {string} Kode random
 */
function generateRandomCode(length = 8, charSet = "alphanumeric") {
    const chars = CHAR_SETS[charSet] || CHAR_SETS.alphanumeric;
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate multiple kode random
 * @param {number} count - Jumlah kode
 * @param {number} length - Panjang setiap kode
 * @param {string} charSet - Set karakter
 * @returns {string[]} Array kode random
 */
function generateMultipleCodes(count = 1, length = 8, charSet = "alphanumeric") {
    const codes = [];
    for (let i = 0; i < count; i++) {
        codes.push(generateRandomCode(length, charSet));
    }
    return codes;
}

function createCodeEmbed(codes, length, charSet) {
    const codeList = codes.map((code, index) => `\`${index + 1}.\` **${code}**`).join("\n");
    
    return new Discord.MessageEmbed()
        .setColor("#9b59b6")
        .setTitle("🎲 Kode Random Generated!")
        .setDescription(codeList)
        .addFields(
            { name: "📏 Panjang", value: `${length} karakter`, inline: true },
            { name: "🔤 Tipe", value: charSet, inline: true },
            { name: "📊 Jumlah", value: `${codes.length} kode`, inline: true }
        )
        .setFooter({ text: "Gunakan !randomcode help untuk melihat opsi lainnya" })
        .setTimestamp();
}

function createHelpEmbed() {
    return new Discord.MessageEmbed()
        .setColor("#3498db")
        .setTitle("📖 Random Code Generator - Help")
        .setDescription("Generate kode random dengan berbagai opsi!")
        .addFields(
            { 
                name: "🎯 Penggunaan Dasar", 
                value: "`!randomcode` - Generate 1 kode (8 karakter)\n`!code` - Alias singkat" 
            },
            { 
                name: "⚙️ Opsi", 
                value: [
                    "`!randomcode [panjang]` - Atur panjang kode (1-50)",
                    "`!randomcode [panjang] [jumlah]` - Generate multiple kode (max 10)",
                    "`!randomcode [panjang] [jumlah] [tipe]` - Pilih tipe karakter"
                ].join("\n")
            },
            { 
                name: "🔤 Tipe Karakter", 
                value: [
                    "`alphanumeric` - A-Z, a-z, 0-9 (default)",
                    "`uppercase` - A-Z, 0-9",
                    "`lowercase` - a-z, 0-9",
                    "`numbers` - 0-9 saja",
                    "`hex` - 0-9, A-F"
                ].join("\n")
            },
            { 
                name: "📝 Contoh", 
                value: [
                    "`!randomcode` → `X7kM2pLq`",
                    "`!randomcode 12` → `Ab3Cd5Ef6Gh7`",
                    "`!randomcode 6 5` → 5 kode, masing-masing 6 karakter",
                    "`!randomcode 8 3 hex` → 3 kode HEX"
                ].join("\n")
            }
        )
        .setFooter({ text: "Alias: !randomcode, !code, !gencode, !buatcode" });
}

async function handleRandomCodeCommand(message) {
    const content = message.content.toLowerCase().trim();
    const args = content.split(/\s+/);
    const command = args[0];
    
    const validCommands = ["!randomcode", "!code", "!gencode", "!buatcode", "randomcode", "code", "gencode", "buatcode"];
    
    if (!validCommands.includes(command)) {
        return false;
    }
    
    try {
        if (args[1] === "help" || args[1] === "?" || args[1] === "bantuan") {
            await message.reply({ embeds: [createHelpEmbed()] });
            return true;
        }
        
        let length = parseInt(args[1]) || 8;
        let count = parseInt(args[2]) || 1;
        let charSet = args[3] || "alphanumeric";
        
        // Validasi
        if (length < 1 || length > 50) {
            await message.reply("⚠️ Panjang kode harus antara 1-50 karakter!");
            return true;
        }
        
        if (count < 1 || count > 10) {
            await message.reply("⚠️ Jumlah kode harus antara 1-10!");
            return true;
        }
        
        if (!CHAR_SETS[charSet]) {
            await message.reply(`⚠️ Tipe karakter tidak valid! Pilih: ${Object.keys(CHAR_SETS).join(", ")}`);
            return true;
        }
        
        // Generate kode
        const codes = generateMultipleCodes(count, length, charSet);
        
        await message.reply({ embeds: [createCodeEmbed(codes, length, charSet)] });
        
    } catch (err) {
        console.error("Error generating random code:", err);
        await message.reply("❌ Gagal generate kode random!").catch(e => console.error(e));
    }
    
    return true;
}

module.exports = {
    generateRandomCode,
    generateMultipleCodes,
    handleRandomCodeCommand
};
