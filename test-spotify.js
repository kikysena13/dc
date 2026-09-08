// Test script untuk debug Spotify & YouTube ReysieBotDC
require('dotenv').config();
const SpotifyWebApi = require('spotify-web-api-node');
const play = require('play-dl');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

console.log('=== SPOTIFY CREDENTIALS ===');
console.log(`Client ID: ${SPOTIFY_CLIENT_ID ? SPOTIFY_CLIENT_ID.substring(0, 5) + '...' : 'NOT SET'}`);
console.log(`Client Secret: ${SPOTIFY_CLIENT_SECRET ? SPOTIFY_CLIENT_SECRET.substring(0, 5) + '...' : 'NOT SET'}`);

// Test 1: Spotify Authentication
async function testSpotifyAuth() {
    console.log('\n=== TEST 1: SPOTIFY AUTHENTICATION ===');
    try {
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
            console.error('❌ Spotify auth failed:', response.status, response.statusText);
            return false;
        }

        const data = await response.json();
        console.log('✅ Spotify auth success!');
        console.log(`Token: ${data.access_token.substring(0, 10)}...`);
        return true;
    } catch (error) {
        console.error('❌ Spotify auth error:', error.message);
        return false;
    }
}

async function testYouTubeSearch() {
    console.log('\n=== TEST 2: YOUTUBE SEARCH ===');
    try {
        const results = await play.search('despacito', { limit: 1 });
        if (results.length === 0) {
            console.error('❌ No YouTube results');
            return false;
        }
        
        const video = results[0];
        console.log('✅ YouTube search success!');
        console.log(`Title: ${video.title}`);
        console.log(`URL: ${video.url}`);
        console.log(`Duration: ${video.durationInSec}s`);
        return true;
    } catch (error) {
        console.error('❌ YouTube search error:', error.message);
        return false;
    }
}

// Test 3: Spotify Search (if auth works)
async function testSpotifySearch() {
    console.log('\n=== TEST 3: SPOTIFY SEARCH ===');
    try {
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
            console.error('❌ Spotify auth failed');
            return false;
        }

        const data = await response.json();
        const spotifyApi = new SpotifyWebApi({
            clientId: SPOTIFY_CLIENT_ID,
            clientSecret: SPOTIFY_CLIENT_SECRET
        });
        spotifyApi.setAccessToken(data.access_token);

        const results = await spotifyApi.searchTracks('despacito', { limit: 1 });
        if (results.body.tracks.items.length === 0) {
            console.error('❌ No Spotify results');
            return false;
        }

        const track = results.body.tracks.items[0];
        console.log('✅ Spotify search success!');
        console.log(`Title: ${track.name}`);
        console.log(`Artist: ${track.artists[0].name}`);
        console.log(`URL: ${track.external_urls.spotify}`);
        return true;
    } catch (error) {
        console.error('❌ Spotify search error:', error.message);
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🧪 STARTING TESTS...\n');
    
    const results = {
        spotifyAuth: await testSpotifyAuth(),
        youtubeSearch: await testYouTubeSearch(),
        spotifySearch: await testSpotifySearch()
    };

    console.log('\n=== TEST RESULTS ===');
    console.log(`Spotify Auth: ${results.spotifyAuth ? '✅' : '❌'}`);
    console.log(`YouTube Search: ${results.youtubeSearch ? '✅' : '❌'}`);
    console.log(`Spotify Search: ${results.spotifySearch ? '✅' : '❌'}`);

    if (results.youtubeSearch) {
        console.log('\n✅ Bot can at least play from YouTube!');
    } else {
        console.log('\n❌ Bot cannot play music at all!');
    }
}

runAllTests().catch(console.error);
