// Test script untuk cari alternatif play-dl methods
const play = require('play-dl');

async function testAlternativeMethods() {
    console.log('🧪 Testing alternative play-dl methods...\n');
    
    const url = 'https://www.youtube.com/watch?v=kJQP7kiw5Fk';
    
    try {
        // Test 1: validate
        console.log('1️⃣ Testing play.validate()...');
        const validated = play.yt_validate(url);
        console.log(`✅ Validated as: ${validated}`);
        
        // Test 2: video_info
        console.log('\n2️⃣ Testing play.video_info()...');
        const videoInfo = await play.video_info(url);
        console.log(`✅ Got video info: ${videoInfo.video_details.title}`);
        console.log(`   ID: ${videoInfo.video_details.id}`);
        
        // Test 3: Try using play.stream() with validate check
        console.log('\n3️⃣ Testing play.stream() with validated URL...');
        if (validated === 'video') {
            try {
                const stream = await play.stream(url, { discordPlayerCompatibility: true });
                console.log(`✅ Stream works!`);
            } catch (e) {
                console.log(`❌ Stream failed: ${e.message}`);
                
                // Test 4: Alternative - try getting stream from video info
                console.log('\n4️⃣ Trying alternative: getting stream from video info...');
                try {
                    // Some versions of play-dl might have this
                    if (videoInfo.streaming) {
                        console.log(`✅ Has streaming info`);
                    }
                    
                    // Try extracting download URL
                    console.log(`Video formats available: ${videoInfo.format?.length || 0}`);
                    
                } catch (e2) {
                    console.log(`Method not available: ${e2.message}`);
                }
            }
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        console.error(error);
    }
}

testAlternativeMethods().catch(console.error);
