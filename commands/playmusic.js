const Discord = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    getVoiceConnection,
    StreamType,
    NoSubscriberBehavior
} = require("@discordjs/voice");
const play = require("play-dl");
const SpotifyWebApi = require("spotify-web-api-node");

// ===== SPOTIFY CONFIGURATION =====
// Ganti dengan Spotify Client ID dan Secret Anda dari https://developer.spotify.com
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "58f3d7add2bd49bcac0f5e2f9270285c";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "3dcc37bfa8c340d094ee2fb58e21c81b";
const SPOTIFY_ENABLED = process.env.SPOTIFY_ENABLED !== "false"; // Set ke "false" di .env untuk disable

const spotifyApi = new SpotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://127.0.0.1:8000/callback"
});

// Variable untuk menyimpan access token Spotify
let spotifyAccessToken = null;
let spotifyTokenExpiresAt = null;
let spotifyAuthFailed = false; // Flag jika auth gagal

// Queue per server (guild)
const queues = new Map();

// ===== SPOTIFY HELPER FUNCTIONS =====

// Authenticate dengan Spotify API menggunakan Client Credentials (Fixed)
async function authenticateSpotify() {
    try {
        // Jika Spotify disabled atau auth sudah failed, jangan coba lagi
        if (!SPOTIFY_ENABLED || spotifyAuthFailed) {
            return false;
        }
        
        // Cek apakah token masih valid
        if (spotifyTokenExpiresAt && Date.now() < spotifyTokenExpiresAt) {
            spotifyApi.setAccessToken(spotifyAccessToken);
            return true;
        }

        console.log("🔐 Authenticating with Spotify...");
        
        // Validate credentials
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
            console.error("❌ Spotify credentials not set!");
            spotifyAuthFailed = true;
            return false;
        }
        
        // Get new token dari Spotify OAuth endpoint
        const authString = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });

        if (!response.ok) {
            const status = response.status;
            const errorBody = await response.text();
            console.error(`❌ Spotify OAuth failed (${status}):`, errorBody.substring(0, 100));
            
            // Mark as failed jika 403 (Invalid credentials)
            if (status === 403) {
                console.error("⚠️ Spotify credentials appear to be invalid. Disabling Spotify search.");
                console.error("   To fix: Update credentials di .env atau set SPOTIFY_ENABLED=false");
                spotifyAuthFailed = true;
            }
            
            return false;
        }

        const data = await response.json();
        spotifyApi.setAccessToken(data.access_token);
        spotifyAccessToken = data.access_token;
        spotifyTokenExpiresAt = Date.now() + (data.expires_in * 1000);
        console.log("✅ Spotify authentication successful");
        return true;
    } catch (error) {
        console.error("Spotify authentication error:", error.message);
        return false;
    }
}

// Parse Spotify URL/URI
function parseSpotifyUrl(url) {
    // Format: https://open.spotify.com/track/{id} atau spotify:track:{id}
    const trackMatch = url.match(/(?:spotify:track:|open\.spotify\.com\/track\/)([a-zA-Z0-9]+)/);
    const playlistMatch = url.match(/(?:spotify:playlist:|open\.spotify\.com\/playlist\/)([a-zA-Z0-9]+)/);
    
    if (trackMatch) return { type: 'track', id: trackMatch[1] };
    if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };
    return null;
}

// Validasi apakah URL adalah Spotify
function isSpotifyUrl(query) {
    return /spotify:|(open\.spotify\.com)/.test(query);
}

// Dapatkan info track dari Spotify - IMPROVED
async function getSpotifyTrackInfo(trackId) {
    try {
        if (!await authenticateSpotify()) return null;
        
        console.log(`📥 Getting Spotify track info: ${trackId}`);
        const data = await spotifyApi.getTrack(trackId);
        
        if (!data.body) {
            console.error("No track data received from Spotify");
            return null;
        }
        
        const track = data.body;
        
        return {
            title: `${track.name} - ${track.artists[0].name}`,
            artist: track.artists[0].name,
            duration: Math.floor(track.duration_ms / 1000),
            url: track.external_urls.spotify,
            thumbnail: track.album.images[0]?.url || "",
            channel: track.artists[0].name
        };
    } catch (error) {
        console.error("Error getting Spotify track info:", error.message || error);
        return null;
    }
}

// Dapatkan info playlist dari Spotify
async function getSpotifyPlaylistInfo(playlistId) {
    try {
        if (!await authenticateSpotify()) return null;
        
        const data = await spotifyApi.getPlaylistTracks(playlistId, { limit: 50 });
        const playlist = await spotifyApi.getPlaylist(playlistId);
        
        const tracks = [];
        for (const item of data.body.items) {
            if (item.track) {
                tracks.push({
                    title: `${item.track.name} - ${item.track.artists[0].name}`,
                    artist: item.track.artists[0].name,
                    duration: Math.floor(item.track.duration_ms / 1000),
                    url: item.track.external_urls.spotify,
                    thumbnail: item.track.album.images[0]?.url || "",
                    channel: item.track.artists[0].name
                });
            }
        }
        
        return { name: playlist.body.name, tracks };
    } catch (error) {
        console.error("Error getting Spotify playlist:", error.message);
        return null;
    }
}

// Search di Spotify - DENGAN BETTER ERROR HANDLING & LOGGING
async function searchSpotify(query) {
    // Skip jika Spotify disabled atau auth failed
    if (!SPOTIFY_ENABLED || spotifyAuthFailed) {
        return null;
    }
    
    try {
        if (!await authenticateSpotify()) {
            console.log("🔄 Spotify auth failed, falling back to YouTube search");
            return null;
        }
        
        console.log(`🔍 Searching Spotify for: ${query}`);
        
        try {
            const data = await spotifyApi.searchTracks(query, { limit: 1 });
            
            if (!data || !data.body || !data.body.tracks) {
                console.log("Invalid response from Spotify search");
                return null;
            }
            
            if (!data.body.tracks.items || data.body.tracks.items.length === 0) {
                console.log(`No Spotify results found for: ${query}`);
                return null;
            }
            
            const track = data.body.tracks.items[0];
            console.log(`✅ Found on Spotify: ${track.name} - ${track.artists[0].name}`);
            
            return {
                title: `${track.name} - ${track.artists[0].name}`,
                artist: track.artists[0].name,
                duration: Math.floor(track.duration_ms / 1000),
                url: track.external_urls.spotify,
                thumbnail: track.album.images[0]?.url || "",
                channel: track.artists[0].name,
                spotifyId: track.id
            };
        } catch (spotifyError) {
            console.error("Spotify search API error:", spotifyError.message);
            return null;
        }
    } catch (error) {
        console.error("searchSpotify error:", error.message || error);
        return null;
    }
}

// Try to get YouTube stream dari Spotify track info - IMPROVED
async function getYouTubeStreamForSpotify(trackTitle) {
    try {
        console.log(`🔍 Searching YouTube for: ${trackTitle}`);
        const searched = await play.search(trackTitle, { limit: 1 });
        
        if (!searched || searched.length === 0) {
            console.log(`❌ No YouTube results found for: ${trackTitle}`);
            return null;
        }
        
        const video = searched[0];
        console.log(`✅ Found: ${video.title} | URL: ${video.url}`);
        
        return {
            youtubeUrl: video.url,
            youtubeTitle: video.title
        };
    } catch (error) {
        console.error("Error finding YouTube stream for Spotify track:", error.message);
        return null;
    }
}
function getQueue(guildId) {
    if (!queues.has(guildId)) {
        queues.set(guildId, {
            songs: [],
            player: null,
            connection: null,
            textChannel: null,
            playing: false,
            loop: false,
            loopQueue: false,
            volume: 100
        });
    }
    return queues.get(guildId);
}

// Format durasi ke mm:ss
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Embed untuk Now Playing - DENGAN SOURCE MUSIC
function createNowPlayingEmbed(song) {
    return new Discord.MessageEmbed()
        .setColor("#e91e63")
        .setTitle("🎵 Now Playing")
        .setDescription(`**[${song.title}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
            { name: "👤 Channel", value: song.channel || "Unknown", inline: true },
            { name: "⏱️ Duration", value: song.duration, inline: true },
            { name: "📻 Source", value: song.source || "Unknown", inline: true },
            { name: "🎧 Requested by", value: `<@${song.requestedBy}>`, inline: true }
        )
        .setFooter({ text: "Use !musichelp untuk melihat semua commands" });
}

// Embed untuk Added to Queue
function createAddedEmbed(song, position) {
    return new Discord.MessageEmbed()
        .setColor("#2ecc71")
        .setTitle("✅ Added to Queue")
        .setDescription(`**[${song.title}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
            { name: "⏱️ Duration", value: song.duration, inline: true },
            { name: "📍 Position", value: `#${position}`, inline: true }
        );
}

// Embed untuk Queue
function createQueueEmbed(queue, page = 0) {
    const songsPerPage = 10;
    const totalPages = Math.ceil(queue.songs.length / songsPerPage) || 1;
    const start = page * songsPerPage;
    const current = queue.songs[0];
    
    let description = "";
    
    if (current) {
        description += `**Now Playing:**\n🎵 [${current.title}](${current.url}) \`${current.duration}\`\n\n`;
    }
    
    if (queue.songs.length > 1) {
        description += "**Up Next:**\n";
        const upcoming = queue.songs.slice(1).slice(start, start + songsPerPage);
        description += upcoming.map((song, i) => 
            `\`${start + i + 1}.\` [${song.title}](${song.url}) \`${song.duration}\``
        ).join("\n");
    } else if (queue.songs.length === 1) {
        description += "\n*No more songs in queue*";
    } else {
        description = "*Queue is empty*";
    }
    
    const embed = new Discord.MessageEmbed()
        .setColor("#3498db")
        .setTitle("📋 Music Queue")
        .setDescription(description)
        .setFooter({ 
            text: `Page ${page + 1}/${totalPages} • ${queue.songs.length} songs • Loop: ${queue.loop ? '🔂 Song' : queue.loopQueue ? '🔁 Queue' : '❌ Off'}` 
        });
    
    return embed;
}

// Play song - DENGAN BETTER ERROR HANDLING & ALTERNATIF METHODS
async function playSong(guildId, song) {
    const queue = getQueue(guildId);
    
    if (!song) {
        if (queue.connection) {
            queue.connection.destroy();
        }
        queues.delete(guildId);
        return;
    }
    
    try {
        // Validasi URL
        if (!song.url) {
            console.error("Song URL is missing:", song.title);
            if (queue.textChannel) {
                await queue.textChannel.send(`❌ Error: URL untuk lagu "${song.title}" tidak ada!`).catch(() => {});
            }
            queue.songs.shift();
            if (queue.songs.length > 0) {
                playSong(guildId, queue.songs[0]);
            } else {
                queue.playing = false;
            }
            return;
        }

        console.log(`▶️ Playing: ${song.title} | URL: ${song.url} | Source: ${song.source}`);
        
        // Try multiple methods to get stream
        let stream = null;
        let lastError = null;
        
        // Method 1: Try play.stream() dengan discordPlayerCompatibility
        try {
            console.log(`📡 Method 1: Trying play.stream()...`);
            stream = await play.stream(song.url, {
                discordPlayerCompatibility: true,
                quality: 2
            });
            console.log(`✅ Method 1 successful`);
        } catch (error1) {
            console.log(`❌ Method 1 failed: ${error1.message}`);
            lastError = error1;
            
            // Method 2: Try play.download()
            try {
                console.log(`📡 Method 2: Trying play.download()...`);
                stream = await play.download(song.url);
                console.log(`✅ Method 2 successful`);
            } catch (error2) {
                console.log(`❌ Method 2 failed: ${error2.message}`);
                lastError = error2;
            }
        }
        
        if (!stream || !stream.stream) {
            console.error("Failed to get stream with all methods:", lastError?.message);
            
            // Fallback: Skip to next song
            console.log("Stream unavailable, skipping to next song...");
            if (queue.textChannel) {
                await queue.textChannel.send(`⚠️ Tidak bisa play "${song.title}". Melanjutkan ke lagu berikutnya...`).catch(() => {});
            }
            
            queue.songs.shift();
            if (queue.songs.length > 0) {
                playSong(guildId, queue.songs[0]);
            } else {
                queue.playing = false;
                if (queue.textChannel) {
                    await queue.textChannel.send("✅ Queue habis!").catch(() => {});
                }
            }
            return;
        }
        
        const resource = createAudioResource(stream.stream, {
            inputType: stream.type,
            inlineVolume: true
        });
        
        resource.volume?.setVolume(queue.volume / 100);
        
        queue.player.play(resource);
        queue.playing = true;
        
        if (queue.textChannel) {
            await queue.textChannel.send({ embeds: [createNowPlayingEmbed(song)] }).catch(() => {});
        }
        
    } catch (error) {
        console.error("Error playing song:", error.message);
        if (queue.textChannel) {
            await queue.textChannel.send(`❌ Error playing: ${song.title}\n(${error.message})`).catch(() => {});
        }
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guildId, queue.songs[0]);
        } else {
            queue.playing = false;
        }
    }
}

// Search dan play - DIPERBARUI DENGAN SPOTIFY SUPPORT
async function searchAndPlay(message, query) {
    const queue = getQueue(message.guild.id);
    const voiceChannel = message.member.voice.channel;
    
    // ===== SET TEXT CHANNEL EARLY (BEFORE ANY OPERATIONS) =====
    queue.textChannel = message.channel;
    
    if (!voiceChannel) {
        return message.reply("❌ Kamu harus join voice channel dulu!");
    }
    
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.reply("❌ Bot tidak punya permission untuk join dan berbicara di voice channel!");
    }
    
    const loadingMsg = await message.reply("🔍 Mencari musik...");
    
    try {
        let songInfo;
        
        // ===== CEK SPOTIFY URL/QUERY =====
        if (isSpotifyUrl(query)) {
            const parsed = parseSpotifyUrl(query);
            
            if (parsed && parsed.type === 'track') {
                // Spotify track
                const spotifyInfo = await getSpotifyTrackInfo(parsed.id);
                if (!spotifyInfo) {
                    return loadingMsg.edit("❌ Gagal mendapatkan info dari Spotify. Cek Spotify credentials Anda!");
                }
                
                // Cari YouTube stream untuk track Spotify ini
                const youtubeInfo = await getYouTubeStreamForSpotify(spotifyInfo.title);
                if (!youtubeInfo) {
                    return loadingMsg.edit("❌ Tidak dapat menemukan stream untuk track ini. Coba cari yang lain!");
                }
                
                songInfo = {
                    title: spotifyInfo.title,
                    url: youtubeInfo.youtubeUrl,
                    duration: formatDuration(spotifyInfo.duration),
                    thumbnail: spotifyInfo.thumbnail,
                    channel: spotifyInfo.channel,
                    requestedBy: message.author.id,
                    source: "Spotify"
                };
                
            } else if (parsed && parsed.type === 'playlist') {
                // Spotify playlist
                const playlistInfo = await getSpotifyPlaylistInfo(parsed.id);
                if (!playlistInfo) {
                    return loadingMsg.edit("❌ Gagal mendapatkan playlist dari Spotify!");
                }
                
                let addedCount = 0;
                for (const track of playlistInfo.tracks) {
                    const youtubeInfo = await getYouTubeStreamForSpotify(track.title);
                    if (youtubeInfo) {
                        queue.songs.push({
                            title: track.title,
                            url: youtubeInfo.youtubeUrl,
                            duration: formatDuration(track.duration),
                            thumbnail: track.thumbnail,
                            channel: track.channel,
                            requestedBy: message.author.id,
                            source: "Spotify"
                        });
                        addedCount++;
                    }
                }
                
                await loadingMsg.edit(`✅ Added **${addedCount}** lagu dari playlist Spotify **${playlistInfo.name}**`);
                
                if (!queue.playing) {
                    try {
                        await setupConnection(message, voiceChannel);
                        playSong(message.guild.id, queue.songs[0]);
                    } catch (err) {
                        console.error("Playlist connection error:", err.message);
                        await message.channel.send(`❌ Gagal connect ke voice: ${err.message}`).catch(() => {});
                    }
                }
                return;
            }
            
        } else if (play.yt_validate(query) === "video") {
            // YouTube URL
            const info = await play.video_info(query);
            songInfo = {
                title: info.video_details.title,
                url: info.video_details.url,
                duration: formatDuration(info.video_details.durationInSec),
                thumbnail: info.video_details.thumbnails[0]?.url || "",
                channel: info.video_details.channel?.name || "Unknown",
                requestedBy: message.author.id,
                source: "YouTube"
            };
            
        } else if (play.yt_validate(query) === "playlist") {
            // YouTube playlist
            const playlist = await play.playlist_info(query, { incomplete: true });
            const videos = await playlist.all_videos();
            
            for (const video of videos) {
                queue.songs.push({
                    title: video.title,
                    url: video.url,
                    duration: formatDuration(video.durationInSec),
                    thumbnail: video.thumbnails[0]?.url || "",
                    channel: video.channel?.name || "Unknown",
                    requestedBy: message.author.id,
                    source: "YouTube"
                });
            }
            
            await loadingMsg.edit(`✅ Added **${videos.length}** songs from playlist **${playlist.title}**`);
            
            if (!queue.playing) {
                try {
                    await setupConnection(message, voiceChannel);
                    playSong(message.guild.id, queue.songs[0]);
                } catch (err) {
                    console.error("Playlist connection error:", err.message);
                    await message.channel.send(`❌ Gagal connect ke voice: ${err.message}`).catch(() => {});
                }
            }
            return;
            
        } else {
            // ===== SEARCH - TRY SPOTIFY FIRST, THEN YOUTUBE =====
            console.log(`🔍 Searching for: ${query}`);
            let spotifyResult = await searchSpotify(query);
            
            if (spotifyResult) {
                const youtubeInfo = await getYouTubeStreamForSpotify(spotifyResult.title);
                if (youtubeInfo) {
                    songInfo = {
                        title: spotifyResult.title,
                        url: youtubeInfo.youtubeUrl,
                        duration: formatDuration(spotifyResult.duration),
                        thumbnail: spotifyResult.thumbnail,
                        channel: spotifyResult.channel,
                        requestedBy: message.author.id,
                        source: "Spotify"
                    };
                } else {
                    // Fallback ke YouTube search
                    console.log("Spotify found but no YouTube stream, searching YouTube...");
                    const searched = await play.search(query, { limit: 1 });
                    if (!searched || searched.length === 0) {
                        return loadingMsg.edit("❌ Tidak ditemukan hasil untuk pencarian tersebut.");
                    }
                    
                    const video = searched[0];
                    songInfo = {
                        title: video.title,
                        url: video.url,
                        duration: formatDuration(video.durationInSec),
                        thumbnail: video.thumbnails[0]?.url || "",
                        channel: video.channel?.name || "Unknown",
                        requestedBy: message.author.id,
                        source: "YouTube"
                    };
                }
            } else {
                // Search YouTube jika Spotify gagal
                console.log("Spotify search failed, searching YouTube...");
                const searched = await play.search(query, { limit: 1 });
                if (!searched || searched.length === 0) {
                    return loadingMsg.edit("❌ Tidak ditemukan hasil untuk pencarian tersebut.");
                }
                
                const video = searched[0];
                songInfo = {
                    title: video.title,
                    url: video.url,
                    duration: formatDuration(video.durationInSec),
                    thumbnail: video.thumbnails[0]?.url || "",
                    channel: video.channel?.name || "Unknown",
                    requestedBy: message.author.id,
                    source: "YouTube"
                };
            }
        }
        
        queue.songs.push(songInfo);
        
        if (!queue.playing) {
            try {
                console.log(`✅ About to setup connection for guild: ${message.guild.id}`);
                await setupConnection(message, voiceChannel);
                console.log(`✅ Connection setup successful, playing song...`);
                await loadingMsg.delete().catch(() => {});
                playSong(message.guild.id, queue.songs[0]);
            } catch (connectionError) {
                console.error("Connection error:", connectionError.message);
                queue.songs.shift(); // Remove lagu yang tidak bisa diplay
                const errorMsg = connectionError.message.includes('abort') 
                    ? "❌ Koneksi ke Discord voice server failed! Coba lagi atau hubungi support Discord."
                    : `❌ Gagal connect ke voice channel: ${connectionError.message}`;
                await loadingMsg.edit(errorMsg).catch(() => {});
            }
        } else {
            await loadingMsg.edit({ 
                content: null,
                embeds: [createAddedEmbed(songInfo, queue.songs.length)] 
            });
        }
        
    } catch (error) {
        console.error("Search error:", error.message || error);
        const errorMsg = error.message.includes('socket') 
            ? "❌ Network error! Firewall UDP mungkin diblok."
            : "❌ Gagal mencari atau memutar musik. Coba lagi nanti.";
        await loadingMsg.edit(errorMsg).catch(() => {});
    }
}

// Setup voice connection - DENGAN RETRY LOGIC
async function setupConnection(message, voiceChannel) {
    const queue = getQueue(message.guild.id);
    
    try {
        console.log(`🎤 Attempting to connect to voice channel: ${voiceChannel.name}`);
        
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: true
        });
        
        // Wait for connection to be ready dengan timeout
        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
            console.log('✅ Connected to voice channel');
        } catch (error) {
            console.error("Connection state error:", error.message);
            connection.destroy();
            
            // Send error message safely
            if (queue.textChannel) {
                await queue.textChannel.send("❌ Gagal connect ke voice channel! Error: " + error.message).catch(() => {});
            }
            throw new Error("Failed to connect to voice channel: " + error.message);
        }
        
        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: 'pause'
            }
        });
        
        player.on(AudioPlayerStatus.Idle, () => {
            if (queue.loop) {
                playSong(message.guild.id, queue.songs[0]);
            } else {
                if (queue.loopQueue && queue.songs.length > 0) {
                    queue.songs.push(queue.songs.shift());
                } else {
                    queue.songs.shift();
                }
                playSong(message.guild.id, queue.songs[0]);
            }
        });
        
        player.on('error', error => {
            console.error('Player error:', error.message);
            if (queue.textChannel) {
                queue.textChannel.send(`❌ Audio player error: ${error.message}`).catch(() => {});
            }
        });
        
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            console.warn('⚠️ Voice connection disconnected, attempting to reconnect...');
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                console.error('Reconnection failed:', error.message);
                connection.destroy();
                queues.delete(message.guild.id);
                if (queue.textChannel) {
                    await queue.textChannel.send("❌ Bot terputus dari voice channel dan tidak bisa reconnect.").catch(() => {});
                }
            }
        });

        connection.on(VoiceConnectionStatus.Destroyed, () => {
            console.log('🔴 Voice connection destroyed');
            queues.delete(message.guild.id);
        });
        
        connection.subscribe(player);
        
        queue.connection = connection;
        queue.player = player;
        // textChannel already set in searchAndPlay
        
    } catch (error) {
        console.error("setupConnection error:", error.message);
        throw error;
    }
}

// Help embed - DIPERBARUI DENGAN SPOTIFY SUPPORT
function createMusicHelpEmbed() {
    return new Discord.MessageEmbed()
        .setColor("#9b59b6")
        .setTitle("🎵 Music Bot Commands")
        .setDescription("Daftar perintah music bot - Support YouTube & Spotify!")
        .addFields(
            { 
                name: "▶️ Play", 
                value: "`!play <judul/url>` - Putar musik dari YouTube/Spotify\n`!p <judul/url>` - Shortcut\n\n**Spotify Support:**\n• Link: `https://open.spotify.com/track/{id}`\n• URI: `spotify:track:{id}`\n• Search: `!play (search query)` - bot akan cari di Spotify dulu" 
            },
            { 
                name: "⏸️ Pause & Resume", 
                value: "`!pause` - Pause musik\n`!resume` - Lanjutkan musik" 
            },
            { 
                name: "⏭️ Skip & Stop", 
                value: "`!skip` / `!s` - Skip lagu saat ini\n`!stop` - Stop dan hapus queue" 
            },
            { 
                name: "📋 Queue", 
                value: "`!queue` / `!q` - Lihat daftar antrian\n`!nowplaying` / `!np` - Lagu yang sedang diputar" 
            },
            { 
                name: "🔁 Loop", 
                value: "`!loop` - Loop lagu saat ini\n`!loopqueue` / `!lq` - Loop seluruh queue" 
            },
            { 
                name: "🔀 Other", 
                value: "`!shuffle` - Acak urutan queue\n`!remove <nomor>` - Hapus lagu dari queue\n`!clear` - Hapus semua queue\n`!leave` / `!dc` - Bot keluar dari voice" 
            }
        )
        .setFooter({ text: "🎧 Enjoy the music! | Support Spotify & YouTube" });
}

// Handle all music commands
async function handlePlayMusicCommand(message) {
    const content = message.content.toLowerCase().trim();
    const args = content.split(/\s+/);
    const command = args[0];
    const query = message.content.slice(command.length).trim();
    
    // Play command
    if (["!play", "!p"].includes(command)) {
        if (!query) {
            return message.reply("❌ Masukkan judul lagu atau URL YouTube!\nContoh: `!play never gonna give you up`");
        }
        await searchAndPlay(message, query);
        return true;
    }
    
    // Pause
    if (command === "!pause") {
        const queue = getQueue(message.guild.id);
        if (!queue.player || !queue.playing) {
            return message.reply("❌ Tidak ada musik yang sedang diputar!");
        }
        queue.player.pause();
        message.reply("⏸️ Musik di-pause!");
        return true;
    }
    
    // Resume
    if (command === "!resume") {
        const queue = getQueue(message.guild.id);
        if (!queue.player) {
            return message.reply("❌ Tidak ada musik yang sedang diputar!");
        }
        queue.player.unpause();
        message.reply("▶️ Musik dilanjutkan!");
        return true;
    }
    
    // Skip
    if (["!skip", "!s"].includes(command)) {
        const queue = getQueue(message.guild.id);
        if (!queue.songs.length) {
            return message.reply("❌ Tidak ada lagu untuk di-skip!");
        }
        const skipped = queue.songs[0];
        queue.player.stop();
        message.reply(`⏭️ Skipped: **${skipped.title}**`);
        return true;
    }
    
    // Stop
    if (command === "!stop") {
        const queue = getQueue(message.guild.id);
        if (queue.connection) {
            queue.songs = [];
            queue.player.stop();
            queue.connection.destroy();
            queues.delete(message.guild.id);
            message.reply("⏹️ Musik dihentikan dan queue dihapus!");
        } else {
            message.reply("❌ Bot tidak sedang di voice channel!");
        }
        return true;
    }
    
    // Queue
    if (["!queue", "!q"].includes(command)) {
        const queue = getQueue(message.guild.id);
        if (!queue.songs.length) {
            return message.reply("📋 Queue kosong! Gunakan `!play` untuk menambah lagu.");
        }
        message.reply({ embeds: [createQueueEmbed(queue)] });
        return true;
    }
    
    // Now Playing
    if (["!nowplaying", "!np"].includes(command)) {
        const queue = getQueue(message.guild.id);
        if (!queue.songs.length || !queue.playing) {
            return message.reply("❌ Tidak ada musik yang sedang diputar!");
        }
        message.reply({ embeds: [createNowPlayingEmbed(queue.songs[0])] });
        return true;
    }
    
    // Loop song
    if (command === "!loop") {
        const queue = getQueue(message.guild.id);
        queue.loop = !queue.loop;
        if (queue.loop) queue.loopQueue = false;
        message.reply(queue.loop ? "🔂 Loop lagu: **ON**" : "🔂 Loop lagu: **OFF**");
        return true;
    }
    
    // Loop queue
    if (["!loopqueue", "!lq"].includes(command)) {
        const queue = getQueue(message.guild.id);
        queue.loopQueue = !queue.loopQueue;
        if (queue.loopQueue) queue.loop = false;
        message.reply(queue.loopQueue ? "🔁 Loop queue: **ON**" : "🔁 Loop queue: **OFF**");
        return true;
    }
    
    // Shuffle
    if (command === "!shuffle") {
        const queue = getQueue(message.guild.id);
        if (queue.songs.length < 3) {
            return message.reply("❌ Butuh minimal 3 lagu untuk shuffle!");
        }
        const current = queue.songs.shift();
        for (let i = queue.songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
        }
        queue.songs.unshift(current);
        message.reply("🔀 Queue telah di-shuffle!");
        return true;
    }
    
    // Remove
    if (command === "!remove") {
        const queue = getQueue(message.guild.id);
        const index = parseInt(args[1]);
        if (isNaN(index) || index < 1 || index >= queue.songs.length) {
            return message.reply("❌ Masukkan nomor lagu yang valid! Gunakan `!queue` untuk melihat daftar.");
        }
        const removed = queue.songs.splice(index, 1)[0];
        message.reply(`🗑️ Removed: **${removed.title}**`);
        return true;
    }
    
    // Clear queue
    if (command === "!clear") {
        const queue = getQueue(message.guild.id);
        if (queue.songs.length <= 1) {
            return message.reply("❌ Queue sudah kosong!");
        }
        const current = queue.songs[0];
        queue.songs = [current];
        message.reply("🗑️ Queue telah dihapus! (lagu yang sedang diputar tetap berjalan)");
        return true;
    }
    
    // Leave
    if (["!leave", "!dc", "!disconnect"].includes(command)) {
        const queue = getQueue(message.guild.id);
        if (queue.connection) {
            queue.connection.destroy();
            queues.delete(message.guild.id);
            message.reply("👋 Bot keluar dari voice channel!");
        } else {
            message.reply("❌ Bot tidak sedang di voice channel!");
        }
        return true;
    }
    
    // Music help
    if (command === "!musichelp" || (command === "!help" && args[1] === "music")) {
        message.reply({ embeds: [createMusicHelpEmbed()] });
        return true;
    }
    
    return false;
}

module.exports = {
    handlePlayMusicCommand,
    getQueue
};
