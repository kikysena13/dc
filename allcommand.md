# Daftar Semua Command Bot

Dokumentasi ini mengikuti command yang aktif di `index.js` dan folder `commands/`.

## 🤖 AI Chat

| Command | Fungsi |
|---|---|
| `!ai <pertanyaan>` | Bertanya atau mengobrol dengan AI Gemini. Riwayat percakapan disimpan per user dan channel. |
| Reply ke pesan AI | Membalas pesan embed **Reysie-Chan** untuk melanjutkan konteks percakapan. |
| Mention bot + pesan | Mention bot lalu tulis pertanyaan untuk memulai respons AI. |

> Membutuhkan environment variable `GEMINI_API_KEY`.

## 🎵 Musik

| Command | Fungsi |
|---|---|
| `!play <judul/url>` / `!p <judul/url>` | Memutar lagu dari pencarian YouTube, URL YouTube, URL/URI Spotify, atau playlist. |
| `!pause` | Menjeda musik. |
| `!resume` | Melanjutkan musik. |
| `!skip` / `!s` | Melewati lagu yang sedang diputar. |
| `!stop` | Menghentikan musik dan menghapus queue. |
| `!queue` / `!q` | Menampilkan daftar queue. |
| `!nowplaying` / `!np` | Menampilkan lagu yang sedang diputar. |
| `!loop` | Mengaktifkan atau menonaktifkan loop lagu saat ini. |
| `!loopqueue` / `!lq` | Mengaktifkan atau menonaktifkan loop seluruh queue. |
| `!shuffle` | Mengacak queue; membutuhkan minimal 3 lagu. |
| `!remove <nomor>` | Menghapus lagu tertentu dari queue. Lagu yang sedang diputar tidak dapat dihapus dengan command ini. |
| `!clear` | Menghapus semua lagu berikutnya dan mempertahankan lagu yang sedang diputar. |
| `!leave` / `!dc` / `!disconnect` | Membuat bot keluar dari voice channel. |
| `!musichelp` / `!help music` | Menampilkan bantuan command musik. |

Bot harus berada di voice channel yang sama dengan pengguna untuk memutar lagu. Pencarian judul mencoba Spotify terlebih dahulu lalu fallback ke YouTube jika tersedia.

## 🧠 Command Informasi dan Utility

| Command | Alias | Fungsi |
|---|---|---|
| `jadwal` | `!jadwal`, `schedule`, `!schedule` | Menampilkan jadwal belajar mingguan. |
| `music` | `!music` | Menampilkan daftar lagu statis dalam format tabel. |
| `!randomcode` | `!code`, `!gencode`, `!buatcode`, serta versi tanpa `!` | Membuat kode acak. Format: `!randomcode [panjang] [jumlah] [tipe]`. Panjang 1–50, jumlah 1–10. |
| `!randomcode help` | `?`, `bantuan` | Menampilkan bantuan random code. |
| `!rules` | `!rule`, `rules`, `rule` | Menampilkan peraturan server dan mention role/channel bantuan. |
| `!rules help` | `!rules ?` | Menampilkan bantuan command rules. |
| `!roleml` | `roleml` | Menampilkan daftar role server dan deskripsinya. |
| `!task` | `task`, `!tasks`, `tasks`, `!todo`, `todo` | Menampilkan daftar tugas dan informasi profil pengguna. |
| `!website` | `!web`, `!rank`, `website`, `web`, `rank` | Mengirim tombol menuju dashboard leaderboard. |
| `!spenderlb` | — | Mengirim tombol menuju leaderboard Top WHELL & LEVIA. |
| `!arenalb` | — | Mengirim tombol menuju halaman bracket Arena. |
| `test` | — | Mengirim balasan pengujian `Test successful!`. |
| `input` | `!input`, `format`, `!format` | Menampilkan contoh format data member manual. |
| `list` | `!list` | Menampilkan daftar member manual dengan tombol pagination. |

`!randomcode` mendukung tipe karakter `alphanumeric`, `uppercase`, `lowercase`, `numbers`, dan `hex`.

## 📢 Pengumuman dan Arena

| Command | Fungsi dan akses |
|---|---|
| `!annoucnment <isi>` | Mengirim pengumuman **SERVER UPDATE** dengan mention `@everyone`. Membutuhkan izin Manage Messages. |
| `!arenaannouncmnet <isi>` | Mengirim pengumuman **ARENA UPDATE** dengan mention `@everyone`. Membutuhkan izin Manage Messages. |
| `!arenaevent <detail event>` | Mengumumkan dimulainya event Arena, mencoba membuat banner GIF, dan mention `@everyone`. Membutuhkan izin Manage Messages. |

> Ejaan `annoucnment` dan `arenaannouncmnet` memang mengikuti command yang saat ini dipakai bot.

## 💰 Spending WHELL / LEVIA

Semua command berikut membutuhkan izin **Manage Server** dan hanya dapat dipakai di dalam server Discord.

| Command | Fungsi |
|---|---|
| `!whellevi add @member <nominal> [RP/$] <WHELL/LEVIA>` | Menambahkan spending member. |
| `!whellevi set @member <nominal> [RP/$] <WHELL/LEVIA>` | Mengatur total spending role member. |
| `!whellevi cek @member` | Melihat total spending WHELL dan LEVIA. |
| `!whellevi reset @member <WHELL/LEVIA>` | Mereset spending salah satu role. |
| `!whellevi resetall @member` | Mereset spending WHELL dan LEVIA sekaligus. |

Alias utama: `whellevi`, `!whelevi`, `whelevi`, `!spending`, dan `spending`.

Nominal dapat menggunakan format angka dengan pemisah umum, misalnya `150000`, `$150000`, atau `150.000`.

## 🖼️ Profil Member

| Command | Fungsi |
|---|---|
| `!addinputbio <bio>` / `addinputbio <bio>` | Menyimpan bio profil sepanjang 1–120 karakter. |
| `!addinput <url> [crop=posisi]` / `addinput <url> [crop=posisi]` | Menyimpan background GIF/foto profil. Membutuhkan tema spending minimal 10.000.000. |

Posisi crop yang didukung: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center-left`, dan `center-right`.

## ⚙️ Fitur Otomatis Non-Command

- Aktivitas chat dan voice dicatat otomatis ke `data/activity-points.json`.
- Data spending dan profil disimpan ke `data/whellevi-points.json`.
- Peserta Arena disinkronkan otomatis berdasarkan role `Punishing`.
- Dashboard tersedia melalui `/`, `/index.html`, `/health`, `/api/leaderboard`, dan `/dataarena.json`.
