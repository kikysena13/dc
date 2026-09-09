const Discord = require("discord.js");

async function handleMusicCommand(message) {
    const normalized = message.content.toLowerCase().trim();
    if (!["music", "!music"].includes(normalized)) {
        return false;
    }

    // Data musik
    const musicData = [
        ['1', 'Bohemian Rhapsody', 'Queen', '5:55'],
        ['2', 'Imagine', 'John Lennon', '3:03'],
        ['3', 'Hotel California', 'Eagles', '6:30'],
        ['4', 'Stairway to Heaven', 'Led Zeppelin', '8:02'],
        ['5', 'Like a Rolling Stone', 'Bob Dylan', '6:13'],
    ];

    // Buat tabel dengan format ASCII
    const headers = ['No', 'Judul', 'Artis', 'Durasi'];
    const columnWidths = headers.map((header, index) => {
        return Math.max(
            header.length,
            Math.max(...musicData.map(row => String(row[index] || '').length))
        );
    });

    const separator = '+' + columnWidths.map(width => '-'.repeat(width + 2)).join('+') + '+';

    let table = separator + '\n';
    table += '| ' + headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ') + ' |\n';
    table += separator + '\n';

    musicData.forEach(row => {
        table += '| ' + row.map((cell, i) => String(cell).padEnd(columnWidths[i])).join(' | ') + ' |\n';
    });
    table += separator;

    // Kirim tabel dalam code block
    try {
        await message.reply({
            content: '```\n' + table + '\n```'
        });
    } catch (err) {
        console.error(err);
        await message.reply("Gagal menampilkan musik list.").catch(error => console.error(error));
    }

    return true;
}

module.exports = {
    handleMusicCommand
};
