const { MessageEmbed } = require("discord.js");

const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_LENGTH = 3900;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

function isConfiguredKey(value) {
    return typeof value === "string"
        && value.trim() !== ""
        && !value.trim().toLowerCase().startsWith("isi_api_key_");
}

function getAIConfig() {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (isConfiguredKey(geminiKey)) {
        return {
            provider: "gemini",
            apiKey: geminiKey,
            model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
        };
    }

    return null;
}

async function requestGemini(config, query) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: query }] }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini API returned HTTP ${response.status}`);
    }

    const text = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!text) {
        throw new Error("Gemini API returned an empty response");
    }

    return text;
}

function splitReply(text) {
    const chunks = [];
    for (let index = 0; index < text.length; index += MAX_REPLY_LENGTH) {
        chunks.push(text.slice(index, index + MAX_REPLY_LENGTH));
    }
    return chunks;
}

function formatMathForDiscord(text) {
    return text
        .replace(/\$\$([\s\S]*?)\$\$/g, (_match, formula) => `\n\`\`\`\n${formula.trim()}\n\`\`\`\n`)
        .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => `\n\`\`\`\n${formula.trim()}\n\`\`\`\n`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => `\`${formula.trim()}\``)
        .replace(/\$([^$\n]+)\$/g, (_match, formula) => `\`${formula.trim()}\``);
}

function createResponseEmbed(description) {
    return new MessageEmbed()
        .setColor("#5865F2")
        .setTitle("Reysie-Chan")
        .setDescription(description);
}

async function handleAIChatCommand(message, args) {
    const query = args.join(" ").trim();
    if (!query) {
        await message.reply("Gunakan format: `!ai <pertanyaan atau obrolanmu>`");
        return true;
    }

    const config = getAIConfig();
    if (!config) {
        await message.reply("AI belum aktif. Tambahkan `GEMINI_API_KEY` di environment Railway.");
        return true;
    }

    await message.channel.sendTyping();

    try {
        const prompt = query.slice(0, MAX_PROMPT_LENGTH);
        const response = formatMathForDiscord(await requestGemini(config, prompt));

        const chunks = splitReply(response);
        await message.reply({ embeds: [createResponseEmbed(chunks.shift())] });
        for (const chunk of chunks) {
            await message.channel.send({ embeds: [createResponseEmbed(chunk)] });
        }
    } catch (error) {
        console.error("AI Chat Error:", error);
        await message.reply("Maaf, AI sedang mengalami kendala. Periksa API key dan log Railway.");
    }

    return true;
}

module.exports = { handleAIChatCommand };
