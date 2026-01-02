import * as dotenv from 'dotenv';
import { siteSearchService } from './src/services/data-collection/brightdata/site-search.service';
import { webUnlockerService } from './src/services/data-collection/brightdata/web-unlocker.service';

dotenv.config();

async function testBrightData() {
    console.log('Starting BrightData Real Integration Test (via SiteSearchService)...');

    const brand = 'Nike';

    // Test 1: Reddit
    const redditDomain = 'reddit.com';
    console.log(`\nTest 1: Site Search for ${brand} on ${redditDomain}`);
    try {
        const result = await siteSearchService.searchAndScrape(redditDomain, brand);
        if (result.error) {
            console.error('❌ Reddit Search Failed:', result.error);
        } else {
            console.log('✅ Reddit Search Success. Content length:', result.content?.length);
            console.log('Preview:', result.content?.substring(0, 200));
        }
    } catch (error: any) {
        console.error('❌ Reddit Test Error:', error.message);
    }

    // Test 2: YouTube
    const youtubeDomain = 'youtube.com';
    console.log(`\nTest 2: Site Search for ${brand} on ${youtubeDomain}`);
    try {
        const result = await siteSearchService.searchAndScrape(youtubeDomain, brand);
        if (result.error) {
            console.error('❌ YouTube Search Failed:', result.error);
        } else {
            console.log('✅ YouTube Search Success. Content length:', result.content?.length);
            console.log('Preview:', result.content?.substring(0, 200));
        }
    } catch (error: any) {
        console.error('❌ YouTube Test Error:', error.message);
    }

    // Test 3: Generic Site
    const genericDomain = 'techradar.com';
    console.log(`\nTest 3: Site Search for ${brand} on ${genericDomain}`);
    try {
        const result = await siteSearchService.searchAndScrape(genericDomain, brand);
        if (result.error) {
            console.error('❌ TechRadar Search Failed:', result.error);
        } else {
            console.log('✅ TechRadar Search Success. Content length:', result.content?.length);
            console.log('Preview:', result.content?.substring(0, 200));
        }
    } catch (error: any) {
        console.error('❌ TechRadar Test Error:', error.message);
    }

    const directUrl = 'https://example.com';
    console.log(`\nTest 4: Direct unlock for ${directUrl}`);
    try {
        const content = await webUnlockerService.scrapeUrl(directUrl, 'markdown');
        console.log('✅ Direct unlock success. Content length:', content.length);
        console.log('Preview:', content.substring(0, 120));
    } catch (error: any) {
        console.error('❌ Direct unlock failed:', error.message);
    }
}

testBrightData().catch(console.error);
