const { MessageEmbed } = require("discord.js");

const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_LENGTH = 3900;
const MAX_HISTORY_MESSAGES = 12;
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";

// Riwayat disimpan per user dan channel supaya percakapan antar-user tidak tercampur.
const conversations = new Map();
const pendingConversations = new Map();

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

async function requestGemini(config, contents) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents
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

function getConversationKey(message) {
    return [message.guildId || "dm", message.channelId, message.author.id].join(":");
}

function isAIResponseMessage(message) {
    return Boolean(message?.author?.bot && message.embeds?.some((embed) => embed.title === "Reysie-Chan"));
}

async function generateAIResponse(message, query) {
    const config = getAIConfig();
    if (!config) {
        await message.reply("AI belum aktif. Tambahkan `GEMINI_API_KEY` di environment Railway.");
        return;
    }

    const conversationKey = getConversationKey(message);
    const previousRequest = pendingConversations.get(conversationKey) || Promise.resolve();
    const currentRequest = previousRequest.then(async () => {
        await message.channel.sendTyping();

        const history = conversations.get(conversationKey) || [];
        const prompt = query.slice(0, MAX_PROMPT_LENGTH);
        const contents = [
            ...history,
            { role: "user", parts: [{ text: prompt }] }
        ];
        const response = formatMathForDiscord(await requestGemini(config, contents));

        // Simpan pesan user dan jawaban AI hanya setelah request berhasil.
        conversations.set(conversationKey, [
            ...contents,
            { role: "model", parts: [{ text: response }] }
        ].slice(-MAX_HISTORY_MESSAGES));

        const chunks = splitReply(response);
        await message.reply({ embeds: [createResponseEmbed(chunks.shift())] });
        for (const chunk of chunks) {
            await message.channel.send({ embeds: [createResponseEmbed(chunk)] });
        }
    });

    pendingConversations.set(conversationKey, currentRequest);
    try {
        await currentRequest;
    } catch (error) {
        console.error("AI Chat Error:", error);
        await message.reply("Maaf, AI sedang mengalami kendala. Periksa API key dan log Railway.");
    } finally {
        if (pendingConversations.get(conversationKey) === currentRequest) {
            pendingConversations.delete(conversationKey);
        }
    }
}

async function handleAIChatCommand(message, args) {
    const query = args.join(" ").trim();
    if (!query) {
        await message.reply("Gunakan format: `!ai <pertanyaan atau obrolanmu>`");
        return true;
    }

    await generateAIResponse(message, query);
    return true;
}

async function handleAIChatReply(message) {
    const referencedMessageId = message.reference?.messageId || message.reference?.messageID;
    if (!referencedMessageId) return false;

    try {
        const referencedMessage = await message.channel.messages.fetch(referencedMessageId);
        if (!isAIResponseMessage(referencedMessage)) return false;
    } catch (error) {
        console.error("Failed to read AI reply reference:", error.message);
        return false;
    }

    const query = message.content.trim();
    if (!query) return true;

    await generateAIResponse(message, query);
    return true;
}

async function handleAIMention(message, clientUser) {
    if (!clientUser || !message.mentions.has(clientUser)) return false;

    const query = message.content.replace(new RegExp(`<@!?${clientUser.id}>`, "g"), "").trim();
    if (!query) return false;

    await generateAIResponse(message, query);
    return true;
}

module.exports = { handleAIChatCommand, handleAIChatReply, handleAIMention };
