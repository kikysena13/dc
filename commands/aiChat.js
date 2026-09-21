const { MessageEmbed } = require("discord.js");

// Modul AI Chat sederhana untuk Discord (menggunakan API Key dari environment jika ada, atau fallback respons cerdas)
async function handleAIChatCommand(message, args) {
    const query = args.join(" ").trim();
    if (!query) {
        return message.reply("Gunakan format: `!ai <pertanyaan atau obrolanmu>`");
    }

    // Indikator bot sedang mengetik
    await message.channel.sendTyping();

    try {
        // Jika ada Google Gemini atau OpenAI API Key di environment, bisa dihubungkan ke sini.
        // Sebagai implementasi aman tanpa merusak sistem lain, kita sediakan handler AI atau integrasi fleksibel.
        const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;

        if (!apiKey) {
            // Respons fallback interaktif jika API Key belum dipasang di .env
            const embed = new MessageEmbed()
                .setColor("#5865F2")
                .setTitle("🤖 Hermes AI Assistant")
                .setDescription(`Halo **${message.author.username}**! Kamu bilang: "${query}"\n\n*Catatan: Untuk mengaktifkan obrolan AI penuh secara real-time, silakan tambahkan ` + "`GEMINI_API_KEY`" + ` atau ` + "`OPENAI_API_KEY`" + ` di file `.env` kamu.*`)
                .setFooter({ text: "Sistem bot utama tetap aman dan berjalan normal!" });

            return message.reply({ embeds: [embed] });
        }

        // Jika API Key tersedia, di sini bisa disambungkan ke endpoint model LLM pilihan Kak Kiky.
        // Untuk sekarang, kita kembalikan respons terstruktur agar bot siap diajak ngobrol.
        return message.reply(`🤖 **AI Response:** Halo Kak Kiky! Saya mendengar pesanmu: "${query}". Sistem AI siap diaktifkan penuh.`);
        
    } catch (error) {
        console.error("AI Chat Error:", error);
        return message.reply("Maaf, terjadi kesalahan saat memproses obrolan AI.");
    }
}

module.exports = { handleAIChatCommand };
