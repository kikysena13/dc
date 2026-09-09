// Test script untuk debug play-dl stream issues
const play = require('play-dl');

async function testPlayDlStream() {
    console.log('🧪 Testing play-dl stream...\n');
    
    const testUrls = [
        'https://www.youtube.com/watch?v=kJQP7kiw5Fk',  // Despacito
        'https://youtu.be/kJQP7kiw5Fk',  // Short URL
        'kJQP7kiw5Fk'  // Just ID
    ];
    
    for (const url of testUrls) {
        console.log(`\n📌 Testing URL: ${url}`);
        try {
            // Try to get video info first
            console.log(`📥 Getting video info...`);
            const videoInfo = await play.video_info(url);
            console.log(`✅ Video info obtained: ${videoInfo.video_details.title}`);
            
            // Try to get stream
            console.log(`📡 Getting stream...`);
            const stream = await play.stream(url, {
                discordPlayerCompatibility: true
            });
            console.log(`✅ Stream obtained!`);
            console.log(`   - Type: ${stream.type}`);
            console.log(`   - Has stream: ${!!stream.stream}`);
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
            }
        }
    }
}

testPlayDlStream().catch(console.error);
