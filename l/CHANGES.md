# 🎵 Perubahan Bot - Integrasi Spotify API

## 📝 Summary
Bot Discord Anda sekarang support **Spotify** sebagai alternatif untuk memutar musik, selain YouTube yang sudah ada.

## 🔄 File yang Diubah

### 1. `package.json` ✅
- Ditambahkan dependency: `spotify-web-api-node` (^5.0.2)
- Ini library untuk berinteraksi dengan Spotify API

### 2. `commands/playmusic.js` ✅
**Perubahan Major:**

#### A. Added Spotify Configuration (Baris awal)
```javascript
const SpotifyWebApi = require("spotify-web-api-node");
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});
```

#### B. New Spotify Helper Functions
- `authenticateSpotify()` - Authenticate dengan Spotify API
- `parseSpotifyUrl()` - Parse Spotify URL/URI format
- `isSpotifyUrl()` - Check apakah query adalah Spotify
- `getSpotifyTrackInfo()` - Get track info dari Spotify
- `getSpotifyPlaylistInfo()` - Get playlist info dari Spotify  
- `searchSpotify()` - Search musik di Spotify
- `getYouTubeStreamForSpotify()` - Find YouTube stream untuk track Spotify

#### C. Updated searchAndPlay() Function
Sekarang function ini:
- Detect Spotify URL/URI
- Support Spotify links (track & playlist)
- Search di Spotify terlebih dahulu sebelum YouTube
- Fallback ke YouTube jika Spotify tidak ditemukan
- Menambahkan property `source` ke song object (Spotify/YouTube)

#### D. Updated Embed Functions
- `createNowPlayingEmbed()` - Sekarang menampilkan source musik (Spotify/YouTube)

#### E. Updated Help Message
- `createMusicHelpEmbed()` - Menambahkan info tentang Spotify support

## 📁 File Baru

### 1. `.env` (Configuration)
```
SPOTIFY_CLIENT_ID=your_id
SPOTIFY_CLIENT_SECRET=your_secret
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
DISCORD_TOKEN=your_token
```
> ⚠️ INI HARUS DIISI DULU SEBELUM BOT BISA GUNAKAN SPOTIFY!

### 2. `SPOTIFY_SETUP.md` (Documentation)
Panduan lengkap setup Spotify API untuk bot.

### 3. `CHANGES.md` (This file)
Dokumentasi perubahan yang dilakukan.

## 🎯 Fitur Baru

### ✨ Spotify Support
1. **Search Spotify** - `!play <judul lagu>` akan search di Spotify dulu
2. **Spotify Direct Link** - `!play https://open.spotify.com/track/{id}`
3. **Spotify URI** - `!play spotify:track:{id}`
4. **Spotify Playlist** - Tambahkan seluruh playlist ke queue
5. **Auto YouTube Stream** - Spotify metadata digunakan, streaming dari YouTube

### 📊 Improved Display
- Now Playing embed sekarang menampilkan source musik (🎵 Spotify atau 📺 YouTube)
- Help command menunjukkan cara gunakan Spotify

## 🚀 Cara Mulai

### 1. Setup Spotify Credentials
```bash
# Edit .env file
SPOTIFY_CLIENT_ID=paste_your_id
SPOTIFY_CLIENT_SECRET=paste_your_secret
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Restart Bot & Test
```bash
!play despacito
# Bot akan search di Spotify & play dari YouTube
```

## 🔄 Backward Compatibility
✅ **Semua fitur YouTube tetap bekerja!**
- YouTube links masih bisa dipakai
- YouTube search masih support
- YouTube playlist masih bisa ditambah

## ⚙️ How It Works

```
User: !play despacito
         ↓
    Is it Spotify URL? No
         ↓
    Search Spotify → Found: "Despacito - Luis Fonsi"
         ↓
    Get info: title, artist, duration, thumbnail
         ↓
    Find YouTube stream → Found
         ↓
    Play dari YouTube dengan metadata dari Spotify
         ↓
    Display: 🎵 Despacito | 📻 Source: Spotify
```

## ⚠️ Penting

1. **credentials harus di .env** - Copy Client ID & Secret dari Spotify Developer Dashboard
2. **YouTube fallback** - Jika Spotify track tidak ada di YouTube, bot akan cari versi lain atau fail
3. **Rate limiting** - Spotify API punya rate limit, tapi cukup untuk bot kecil

## 🐛 Debugging

Jika ada error:
1. Cek `.env` file - credentials correct?
2. Cek console log - ada error message?
3. Baca `SPOTIFY_SETUP.md` - ada solusi troubleshooting

## 📚 References
- Spotify Web API: https://developer.spotify.com/documentation/web-api
- spotify-web-api-node: https://github.com/thelinmichael/spotify-web-api-node

---

**Version:** 1.1 (Spotify Integration)  
**Date:** 2026-04-14  
**Status:** ✅ Ready to use
