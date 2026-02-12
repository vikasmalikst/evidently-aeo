
import { mcpSearchService } from './services/data-collection/mcp-search.service';

/**
 * Measure Latency Script
 * 
 * Benchmarks:
 * 1. Quick Search (SearXNG via VPS)
 * 2. Deep Research (Cheerio Scrape)
 */

async function measure() {
    console.log('⏱️ Starting Latency Benchmark...');
    console.log('Target URL:', process.env.MCP_SEARCH_URL || 'http://localhost:8082');

    // --- Test 1: Quick Search Latency ---
    console.log('\n--- 1. Quick Search (5 iterations) ---');
    let quickTimes: number[] = [];
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await mcpSearchService.quickSearch(`test query ${i}`, 1);
        const duration = Date.now() - start;
        quickTimes.push(duration);
        process.stdout.write(`Run ${i + 1}: ${duration}ms | `);
    }
    const quickAvg = quickTimes.reduce((a, b) => a + b, 0) / quickTimes.length;
    console.log(`\n✅ Avg Quick Search: ${Math.round(quickAvg)}ms`);

    // --- Test 2: Deep Research Latency ---
    console.log('\n--- 2. Deep Research (3 iterations) ---');
    // Use a lightweight, reliable site for testing scraping
    const targetUrl = 'https://example.com';
    let deepTimes: number[] = [];
    for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await mcpSearchService.deepResearch(targetUrl);
        const duration = Date.now() - start;
        deepTimes.push(duration);
        process.stdout.write(`Run ${i + 1}: ${duration}ms | `);
    }
    const deepAvg = deepTimes.reduce((a, b) => a + b, 0) / deepTimes.length;
    console.log(`\n✅ Avg Deep Research: ${Math.round(deepAvg)}ms`);
}

measure();
