
import { mcpSearchService } from './services/data-collection/mcp-search.service';

/**
 * Test Script for MCP Search
 * 
 * Usage:
 * 1. Ensure SSH Tunnel is open (if running locally): ssh -L 8082:localhost:8082 dev@evidentlyaeo.com -N
 * 2. Run: npx ts-node src/test-mcp-search.ts
 */

async function main() {
    console.log('🚀 Starting MCP Search Test...');
    console.log('Target URL:', process.env.MCP_SEARCH_URL || 'http://localhost:8082');

    try {
        // Test 1: Quick Search (SearXNG)
        console.log('\n--- Test 1: Quick Search (Nike sustainability) ---');
        const quick = await mcpSearchService.quickSearch('Nike sustainability', 2);
        console.log(`✅ Success! Found ${quick.results.length} results.`);
        quick.results.forEach(r => {
            console.log(`- [${r.title}](${r.url})`);
        });

        // Test 2: Deep Research (Cheerio Fallback)
        if (quick.results.length > 0) {
            console.log('\n--- Test 2: Deep Research (Scraping first result) ---');
            const url = quick.results[0].url;
            console.log(`Scraping: ${url}`);

            const content = await mcpSearchService.deepResearch(url);
            console.log('✅ Content Extracted:');
            console.log(content.substring(0, 300) + '...');
        }

    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 TIP: Make sure your SSH tunnel is running! (ssh -L 8082:localhost:8082 ...)')
        }
    }
}

main();
