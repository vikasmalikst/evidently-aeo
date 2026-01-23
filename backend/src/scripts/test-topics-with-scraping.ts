/**
 * Test script for unified topics + trending generation with website scraping
 * 
 * Usage: npx ts-node src/scripts/test-topics-with-scraping.ts [website_url] [brand_name]
 * Example: npx ts-node src/scripts/test-topics-with-scraping.ts agicap.com Agicap
 */

import { config } from 'dotenv';
config();

import { websiteScraperService } from '../services/website-scraper.service';
import { topicsQueryGenerationService } from '../services/topics-query-generation.service';

async function main() {
  const websiteUrl = process.argv[2] || 'https://agicap.com';
  const brandName = process.argv[3] || 'Agicap';
  const industry = process.argv[4] || 'Financial Software';
  const competitors = ['Float', 'Xero', 'QuickBooks'];

  console.log('🧪 Testing unified topics + trending generation:');
  console.log(`   Website: ${websiteUrl}`);
  console.log(`   Brand: ${brandName}`);
  console.log(`   Industry: ${industry}`);
  console.log(`   Competitors: ${competitors.join(', ')}`);
  console.log('');

  // Step 1: Scrape website for keywords
  let scrapeResult = null;
  try {
    console.log('🕸️ Step 1: Scraping website for keywords...');
    scrapeResult = await websiteScraperService.scrapeHomepage(websiteUrl, {
      brandName,
      timeoutMs: 8000,
      maxKeywords: 15
    });
    console.log('✅ Scrape result:');
    console.log(`   Brand keywords: ${scrapeResult.brandKeywords.join(', ')}`);
    console.log(`   Industry keywords: ${scrapeResult.industryKeywords.slice(0, 10).join(', ')}...`);
    console.log(`   Website content: ${scrapeResult.websiteContent.substring(0, 100)}...`);
    console.log('');
  } catch (error) {
    console.warn('⚠️ Scraping failed:', error);
  }

  // Step 2: Generate unified topics + trending
  try {
    console.log('🤖 Step 2: Generating unified topics + trending (single LLM call)...');
    const result = await topicsQueryGenerationService.generateTopicsAndQueries({
      brandName,
      industry,
      competitors,
      websiteContent: scrapeResult?.websiteContent,
      brandKeywords: scrapeResult?.brandKeywords,
      industryKeywords: scrapeResult?.industryKeywords,
      maxTopics: 20
    });

    console.log('');
    console.log('✅ RESULTS:');
    console.log('');
    console.log(`📌 Primary Domain: ${result.primaryDomain}`);
    console.log('');
    
    console.log(`📋 AI Topics (${result.topics.length} total):`);
    const byCategory: Record<string, string[]> = {};
    for (const t of result.topics) {
      const cat = t.intentArchetype;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(t.topic);
    }
    for (const [cat, topics] of Object.entries(byCategory)) {
      console.log(`   [${cat}]: ${topics.join(', ')}`);
    }
    console.log('');

    console.log(`📈 Trending Keywords (${result.trending.length} total):`);
    for (const tr of result.trending) {
      console.log(`   - ${tr.keyword} (${tr.category})`);
    }

  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);
