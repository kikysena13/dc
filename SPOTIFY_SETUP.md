# 🎵 Setup Spotify API untuk Bot

Panduan lengkap mengintegrasikan Spotify API ke bot Discord Anda.

## 📋 Prerequisites

- Node.js diinstall
- Discord Bot Token (sudah ada)
- Akun Spotify (gratis atau premium)

## 🔧 Step 1: Dapatkan Spotify Credentials

### 1.1 Buka Spotify Developer Dashboard
- Pergi ke https://developer.spotify.com/dashboard
- Login dengan akun Spotify (atau buat baru jika belum ada)

### 1.2 Buat Aplikasi Baru
- Klik "Create an App"
- Isi nama aplikasi (contoh: "Discord Bot Music")
- Setujui terms dan klik "Create"

### 1.3 Dapatkan Credentials
Setelah membuat aplikasi, Anda akan melihat:
- **Client ID** 
- **Client Secret**

Jangan bagikan credentials ini ke orang lain!

## 📝 Step 2: Setup Environment Variables

### 2.1 Buka file `.env` di root folder project
```
b:\ReysieBotDC\.env
```

### 2.2 Isi dengan Spotify Credentials Anda
```env
SPOTIFY_CLIENT_ID=abc123def456...
SPOTIFY_CLIENT_SECRET=xyz789uvw456...
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
```

### 2.3 Setup di index.js (Optional)
Jika ingin hard-code credentials (tidak direkomendasikan untuk production):

Buka `index.js` dan ubah bagian Spotify config di `commands/playmusic.js`:

```javascript
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID || "paste_here",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "paste_here",
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:8888/callback"
});
```

## 📦 Step 3: Install Dependencies

Jalankan command di terminal:

```bash
npm install
```

Ini akan install package `spotify-web-api-node` yang sudah ditambahkan ke `package.json`.

## ✅ Step 4: Test Bot Anda

1. Start bot Anda (cara yang biasa)
2. Di Discord, gunakan command:
   ```
   !play despacito
   ```
3. Bot akan **cari di Spotify terlebih dahulu**, kemudian stream dari YouTube

## 🎯 Fitur Spotify yang Didukung

### Search
```
!play <judul lagu>
```
Bot akan cari lagu di Spotify, ambil info-nya, kemudian stream dari YouTube.

### Direct Spotify Link
```
!play https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp
```

### Spotify URI
```
!play spotify:track:3n3Ppam7vgaVa1iaRUc9Lp
```

### Playlist
```
!play https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYsB37
```

## 🐛 Troubleshooting

### Error: "Gagal mendapatkan info dari Spotify"
**Solusi:**
- Pastikan Spotify credentials di `.env` atau `playmusic.js` benar
- Cek apakah aplikasi sudah dibuat di Spotify Developer Dashboard

### Bot tidak bisa memutar lagu Spotify
**Solusi:**
- Bot akan cari streaming version dari YouTube
- Jika tidak ditemukan di YouTube, coba lagu lain
- Pastikan YouTube video tidak di-geoblocking

### "Client credentials tidak valid"
**Solusi:**
- Copy-paste Client ID dan Secret lagi dari Spotify Dashboard
- Pastikan tidak ada spasi atau karakter ekstra

## 📚 Resources

- Spotify Web API Docs: https://developer.spotify.com/documentation/web-api
- spotify-web-api-node: https://github.com/thelinmichael/spotify-web-api-node

## 🚀 Cara Gunakan Bot

```
!musichelp              - Lihat semua commands
!play <judul>           - Putar musik (auto-detect Spotify/YouTube)
!play <link spotify>    - Putar dari Spotify link
!queue                  - Lihat antrian
!pause                  - Pause musik
!resume                 - Resume musik
!skip                   - Skip lagu
!stop                   - Stop dan bersihkan queue
!loop                   - Loop satu lagu
!loopqueue              - Loop seluruh queue
```

---

**Selamat! Bot Anda sekarang support Spotify & YouTube! 🎉**
