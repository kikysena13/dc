const MAX_PROMPT_LENGTH = 2000;
const MAX_REPLY_LENGTH = 1900;
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function getAIConfig() {
    const geminiKey = process.env.GEMINI_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    if (geminiKey) {
        return {
            provider: "gemini",
            apiKey: geminiKey,
            model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
        };
    }

    if (openAIKey) {
        return {
            provider: "openai",
            apiKey: openAIKey,
            model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
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

async function requestOpenAI(config, query) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: query }]
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || `OpenAI API returned HTTP ${response.status}`);
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
        throw new Error("OpenAI API returned an empty response");
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

async function handleAIChatCommand(message, args) {
    const query = args.join(" ").trim();
    if (!query) {
        await message.reply("Gunakan format: `!ai <pertanyaan atau obrolanmu>`");
        return true;
    }

    const config = getAIConfig();
    if (!config) {
        await message.reply("AI belum aktif. Tambahkan `GEMINI_API_KEY` atau `OPENAI_API_KEY` di environment Railway.");
        return true;
    }

    await message.channel.sendTyping();

    try {
        const prompt = query.slice(0, MAX_PROMPT_LENGTH);
        const response = config.provider === "gemini"
            ? await requestGemini(config, prompt)
            : await requestOpenAI(config, prompt);

        const chunks = splitReply(response);
        await message.reply(`🤖 ${chunks.shift()}`);
        for (const chunk of chunks) {
            await message.channel.send(chunk);
        }
    } catch (error) {
        console.error("AI Chat Error:", error);
        await message.reply("Maaf, AI sedang mengalami kendala. Periksa API key dan log Railway.");
    }

    return true;
}

module.exports = { handleAIChatCommand };
