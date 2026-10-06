# 🤖 Reysie Discord Bot

Bot Discord untuk komunitas dengan fitur musik, AI chat, leaderboard aktivitas dan spending, profil member, serta pengumuman Arena.

> Gunakan `!help` atau `/help` di Discord untuk melihat bantuan command. Prefix command teks: `!` (beberapa command juga menerima alias tanpa prefix).

## Daftar Isi

- [Fitur](#fitur)
- [Command](#command)
	- [Bantuan dan AI](#-bantuan-dan-ai)
	- [Musik](#-musik)
	- [Informasi dan utility](#-informasi-dan-utility)
	- [Pengumuman dan Arena](#-pengumuman-dan-arena)
	- [Spending WHELL dan LEVIA](#-spending-whell-dan-levia)
	- [Profil member](#-profil-member)
- [Contoh penggunaan](#contoh-penggunaan)
- [Konfigurasi sinkronisasi GitHub](#konfigurasi-sinkronisasi-github)
- [Data dan dashboard](#data-dan-dashboard)
- [Menjalankan bot](#menjalankan-bot)

## Fitur

- 🎵 Memutar musik dari pencarian YouTube, link YouTube, dan Spotify.
- 🤖 AI chat dengan konteks percakapan per user dan channel.
- 📊 Leaderboard aktivitas serta Top WHELL dan Top LEVIA.
- 🏟️ Informasi dan pengumuman event Arena.
- 🖼️ Bio dan background profil member dengan opsi crop.
- 🧰 Command utility untuk rules, role, task, dan kode acak.

## Command

### 🤖 Bantuan dan AI

| Command | Fungsi |
|---|---|
| `!help`, `!commands`, `/help` | Menampilkan panduan command bot. |
| `!help music`, `!musichelp` | Menampilkan panduan command musik. |
| `!ai <pertanyaan>` | Bertanya atau mengobrol dengan AI. Membutuhkan `GEMINI_API_KEY`. |
| Reply ke pesan AI atau mention bot | Melanjutkan percakapan atau memulai chat dengan AI. |

### 🎵 Musik

| Command | Fungsi |
|---|---|
| `!play <judul atau URL>`, `!p <judul atau URL>` | Memutar lagu dari pencarian, YouTube, Spotify, atau playlist. |
| `!pause`, `!resume` | Menjeda atau melanjutkan musik. |
| `!skip`, `!s` | Melewati lagu yang sedang diputar. |
| `!stop` | Menghentikan musik dan menghapus antrean. |
| `!queue`, `!q` | Menampilkan antrean lagu. |
| `!nowplaying`, `!np` | Menampilkan lagu yang sedang diputar. |
| `!loop` | Mengaktifkan atau menonaktifkan loop lagu saat ini. |
| `!loopqueue`, `!lq` | Mengaktifkan atau menonaktifkan loop antrean. |
| `!shuffle` | Mengacak antrean (minimal 3 lagu). |
| `!remove <nomor>` | Menghapus lagu dari antrean, kecuali lagu yang sedang diputar. |
| `!clear` | Menghapus lagu berikutnya dan mempertahankan lagu yang sedang diputar. |
| `!leave`, `!dc`, `!disconnect` | Membuat bot keluar dari voice channel. |

Bot dan pengguna harus berada di voice channel yang sama. Untuk pencarian judul, bot mencoba Spotify terlebih dahulu lalu menggunakan YouTube jika tersedia.

### 🧰 Informasi dan utility

| Command | Fungsi |
|---|---|
| `!website`, `!web`, `!rank` | Mengirim tombol menuju dashboard leaderboard. |
| `!spenderlb` | Mengirim tombol menuju leaderboard Top WHELL dan LEVIA. |
| `!arenalb` | Mengirim tombol menuju halaman bracket Arena. |
| `!randomcode [panjang] [jumlah] [tipe]` | Membuat kode acak. Alias: `!code`, `!gencode`, `!buatcode` (tersedia juga tanpa `!`). |
| `!randomcode help` | Menampilkan bantuan generator kode. Tipe: `alphanumeric`, `uppercase`, `lowercase`, `numbers`, `hex`. |
| `!rules`, `!rule` | Menampilkan peraturan server. `!rules help` menampilkan bantuan. |
| `!roleml` | Menampilkan daftar role server dan deskripsinya. |
| `!task`, `!tasks`, `!todo` | Menampilkan daftar tugas dan informasi profil. |
| `music`, `!music` | Menampilkan daftar lagu. |
| `input`, `!input`, `format`, `!format` | Menampilkan contoh format data member manual. |
| `list`, `!list` | Menampilkan daftar member manual dengan pagination. |
| `test` | Mengirim balasan untuk menguji respons bot. |

Alias tambahan untuk `!task`: `task`, `tasks`, dan `todo`. Panjang kode acak 1–50 karakter dan jumlah 1–10 kode.

### 📢 Pengumuman dan Arena

| Command | Fungsi |
|---|---|
| `!annoucnment <isi>` | Mengirim pengumuman **SERVER UPDATE** dan mention `@everyone`. |
| `!arenaannouncmnet <isi>` | Mengirim pengumuman **ARENA UPDATE** dan mention `@everyone`. |
| `!arenaevent <detail event>` | Mengumumkan dimulainya event Arena, mencoba membuat banner GIF, dan mention `@everyone`. |

Semua command pengumuman membutuhkan izin **Manage Messages**. Ejaan command mengikuti nama yang saat ini digunakan bot.

### 💰 Spending WHELL dan LEVIA

| Command | Fungsi |
|---|---|
| `!whellevi add @member <nominal> [RP/$] <WHELL/LEVIA>` | Menambahkan spending member. |
| `!whellevi set @member <nominal> [RP/$] <WHELL/LEVIA>` | Mengatur total spending member. |
| `!whellevi cek @member` | Melihat total spending WHELL dan LEVIA. |
| `!whellevi reset @member <WHELL/LEVIA>` | Mereset spending untuk salah satu kategori. |
| `!whellevi resetall @member` | Mereset spending WHELL dan LEVIA sekaligus. |

Semua command spending membutuhkan izin **Manage Server** dan hanya dapat digunakan di server Discord. Alias command: `whellevi`, `!whelevi`, `whelevi`, `!spending`, dan `spending`. Nominal dapat ditulis seperti `150000`, `150.000`, atau `$150000`.

Leaderboard Top WHELL dan Top LEVIA diurutkan berdasarkan total RP spending, bukan XP umum.

### 🖼️ Profil member

| Command | Fungsi |
|---|---|
| `!addinputbio <bio>` | Menyimpan bio profil (1–120 karakter). Alias: `addinputbio`. |
| `!addinput <url> [crop=posisi]` | Menyimpan background GIF/foto profil. Alias: `addinput`. Membutuhkan spending minimal 10.000.000. |

Posisi crop yang didukung: `center`, `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center-left`, dan `center-right`. Format `center left` dan `center right` juga dapat digunakan.

## Contoh penggunaan

### Mengelola spending

```text
!whellevi add @member 150000 WHELL
!whellevi add @member $250000 LEVIA
!whellevi set @member 500000 RP WHELL
!whellevi cek @member
!whellevi reset @member WHELL
!whellevi resetall @member
```

### Mengatur profil dan crop background

```text
!addinputbio Bio saya
!addinput https://contoh.com/gambar.gif crop=top-left
!addinput https://contoh.com/gambar.gif crop=center-right
```

## Konfigurasi sinkronisasi GitHub

Bio dan background akan disinkronkan ke GitHub setelah command berhasil jika variabel berikut dikonfigurasi pada environment deployment (misalnya Railway):

| Variabel | Contoh nilai |
|---|---|
| `GITHUB_TOKEN` | Token GitHub dengan izin **Contents: Read and write**. Simpan sebagai secret; jangan masukkan token asli ke README atau commit. |
| `GITHUB_REPOSITORY` | `kikysena13/dc` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_DATA_PATH` | `data/whellevi-points.json` |

## Data dan dashboard

| Lokasi/Fitur | Keterangan |
|---|---|
| `data/whellevi-points.json` | Data spending WHELL/LEVIA dan profil member. |
| `data/activity-points.json` | Data XP aktivitas chat dan voice. |
| `/` dan `/index.html` | Halaman dashboard. |
| `/health` | Endpoint pemeriksaan status. |
| `/api/leaderboard` | Data leaderboard. |
| `/dataarena.json` | Data peserta Arena. |

Chat XP dan Voice XP dicatat otomatis. Level naik setiap 100 XP; sesi voice direkonsiliasi saat bot dimulai ulang agar waktu bot offline tidak dihitung.

## Menjalankan bot

Pastikan Node.js sudah terpasang, lalu jalankan dari folder proyek:

```bash
npm install
npm start
```

Untuk setup Spotify API, lihat [`SPOTIFY_SETUP.md`](SPOTIFY_SETUP.md). Jangan pernah commit token bot, API key, atau secret ke repository.