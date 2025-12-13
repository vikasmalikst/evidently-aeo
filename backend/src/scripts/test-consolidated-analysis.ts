/**
 * Test Script for Consolidated Analysis Service
 * 
 * Tests the consolidated analysis service with real collector results from the database.
 * Validates accuracy and correctness of results.
 */

import dotenv from 'dotenv';
import { consolidatedAnalysisService } from '../services/scoring/consolidated-analysis.service';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

interface TestResult {
  collectorResultId: number;
  brandName: string;
  competitorNames: string[];
  citationCount: number;
  success: boolean;
  errors: string[];
  products: {
    brandCount: number;
    competitorCount: number;
  };
  citations: {
    categorized: number;
    total: number;
  };
  sentiment: {
    brandLabel: string;
    brandScore: number;
    competitorCount: number;
  };
  tokenUsage?: {
    input?: number;
    output?: number;
    total?: number;
  };
}

async function testConsolidatedAnalysis() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🧪 Consolidated Analysis Service Test Suite               ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Fetch test collector results
  console.log('📊 Fetching test collector results from database...\n');
  
  const { data: collectorResults, error } = await supabase
    .from('collector_results')
    .select(`
      id,
      brand_id,
      raw_answer,
      citations,
      urls,
      brand,
      competitors,
      collector_type
    `)
    .not('raw_answer', 'is', null)
    .limit(5)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch collector results: ${error.message}`);
  }

  if (!collectorResults || collectorResults.length === 0) {
    console.log('⚠️ No collector results found. Please ensure there are results in the database.');
    return;
  }

  console.log(`✅ Found ${collectorResults.length} collector results to test\n`);

  const testResults: TestResult[] = [];

  for (let i = 0; i < collectorResults.length; i++) {
    const result = collectorResults[i];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Test ${i + 1}/${collectorResults.length}: Collector Result ID ${result.id}`);
    console.log(`${'='.repeat(70)}`);

    try {
      // Fetch brand data
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name, metadata')
        .eq('id', result.brand_id)
        .single();

      if (!brand) {
        console.log(`⚠️ Brand not found for brand_id ${result.brand_id}, skipping...`);
        continue;
      }

      // Parse competitors
      let competitorNames: string[] = [];
      if (Array.isArray(result.competitors)) {
        competitorNames = result.competitors.map(c => 
          typeof c === 'string' ? c : (c.competitor_name || c.name || String(c))
        ).filter(Boolean);
      }

      // Fetch competitor metadata
      const { data: competitorRows } = await supabase
        .from('brand_competitors')
        .select('competitor_name, metadata')
        .eq('brand_id', result.brand_id);

      const competitorMetadata = new Map<string, any>();
      (competitorRows || []).forEach(row => {
        competitorMetadata.set(row.competitor_name.toLowerCase(), row.metadata);
      });

      // Parse citations
      let citations: string[] = [];
      if (Array.isArray(result.citations)) {
        citations = result.citations
          .map(c => typeof c === 'string' ? c : (c.url || c))
          .filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
      } else if (Array.isArray(result.urls)) {
        citations = result.urls.filter((url): url is string => typeof url === 'string' && url.startsWith('http'));
      }

      console.log(`📝 Brand: ${brand.name}`);
      console.log(`👥 Competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None'}`);
      console.log(`🔗 Citations: ${citations.length}`);
      console.log(`📄 Answer length: ${result.raw_answer?.length || 0} characters`);

      // Run consolidated analysis
      const startTime = Date.now();
      const analysis = await consolidatedAnalysisService.analyze({
        brandName: brand.name,
        brandMetadata: brand.metadata,
        competitorNames,
        competitorMetadata,
        rawAnswer: result.raw_answer || '',
        citations,
        collectorResultId: result.id
      });
      const duration = Date.now() - startTime;

      console.log(`\n✅ Analysis completed in ${duration}ms`);

      // Validate results
      const errors: string[] = [];

      // Validate products
      if (!Array.isArray(analysis.products.brand)) {
        errors.push('Brand products is not an array');
      }
      if (typeof analysis.products.competitors !== 'object') {
        errors.push('Competitor products is not an object');
      }

      // Validate citations
      for (const url of citations) {
        if (!analysis.citations[url]) {
          errors.push(`Citation ${url} not categorized`);
        } else {
          const validCategories = ['Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional'];
          if (!validCategories.includes(analysis.citations[url].category)) {
            errors.push(`Invalid category for ${url}: ${analysis.citations[url].category}`);
          }
        }
      }

      // Validate sentiment
      const validLabels = ['POSITIVE', 'NEGATIVE', 'NEUTRAL'];
      if (!validLabels.includes(analysis.sentiment.brand.label)) {
        errors.push(`Invalid brand sentiment label: ${analysis.sentiment.brand.label}`);
      }
      if (analysis.sentiment.brand.score < -1 || analysis.sentiment.brand.score > 1) {
        errors.push(`Brand sentiment score out of range: ${analysis.sentiment.brand.score}`);
      }

      // Display results
      console.log(`\n📦 Products:`);
      console.log(`   Brand: ${analysis.products.brand.length} products`);
      if (analysis.products.brand.length > 0) {
        console.log(`   - ${analysis.products.brand.slice(0, 5).join(', ')}${analysis.products.brand.length > 5 ? '...' : ''}`);
      }
      console.log(`   Competitors: ${Object.keys(analysis.products.competitors).length} competitors with products`);
      for (const compName in analysis.products.competitors) {
        const products = analysis.products.competitors[compName];
        if (products.length > 0) {
          console.log(`   - ${compName}: ${products.slice(0, 3).join(', ')}${products.length > 3 ? '...' : ''}`);
        }
      }

      console.log(`\n🔗 Citations:`);
      for (const url in analysis.citations) {
        const cat = analysis.citations[url];
        console.log(`   ${url.substring(0, 50)}... → ${cat.category}`);
      }

      console.log(`\n💭 Sentiment:`);
      console.log(`   Brand: ${analysis.sentiment.brand.label} (${analysis.sentiment.brand.score.toFixed(2)})`);
      // Note: positiveSentences and negativeSentences are not part of the ConsolidatedAnalysisResult type
      // They may be available in other sentiment analysis results but not in consolidated analysis
      if (Object.keys(analysis.sentiment.competitors).length > 0) {
        console.log(`   Competitors:`);
        for (const compName in analysis.sentiment.competitors) {
          const compSent = analysis.sentiment.competitors[compName];
          console.log(`   - ${compName}: ${compSent.label} (${compSent.score.toFixed(2)})`);
        }
      }

      testResults.push({
        collectorResultId: result.id,
        brandName: brand.name,
        competitorNames,
        citationCount: citations.length,
        success: errors.length === 0,
        errors,
        products: {
          brandCount: analysis.products.brand.length,
          competitorCount: Object.keys(analysis.products.competitors).length
        },
        citations: {
          categorized: Object.keys(analysis.citations).length,
          total: citations.length
        },
        sentiment: {
          brandLabel: analysis.sentiment.brand.label,
          brandScore: analysis.sentiment.brand.score,
          competitorCount: Object.keys(analysis.sentiment.competitors).length
        }
      });

      if (errors.length > 0) {
        console.log(`\n⚠️ Validation errors:`);
        errors.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log(`\n✅ All validations passed!`);
      }

    } catch (error) {
      console.error(`\n❌ Error processing collector result ${result.id}:`, error instanceof Error ? error.message : error);
      testResults.push({
        collectorResultId: result.id,
        brandName: 'Unknown',
        competitorNames: [],
        citationCount: 0,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
        products: { brandCount: 0, competitorCount: 0 },
        citations: { categorized: 0, total: 0 },
        sentiment: { brandLabel: 'NEUTRAL', brandScore: 0, competitorCount: 0 }
      });
    }
  }

  // Summary
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}\n`);

  const successful = testResults.filter(r => r.success).length;
  const failed = testResults.filter(r => !r.success).length;

  console.log(`Total tests: ${testResults.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((successful / testResults.length) * 100).toFixed(1)}%\n`);

  if (successful > 0) {
    const avgBrandProducts = testResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.products.brandCount, 0) / successful;
    const avgCompetitorProducts = testResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.products.competitorCount, 0) / successful;
    const avgCitations = testResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.citations.categorized, 0) / successful;

    console.log(`📦 Average products extracted:`);
    console.log(`   Brand: ${avgBrandProducts.toFixed(1)}`);
    console.log(`   Competitors: ${avgCompetitorProducts.toFixed(1)}`);
    console.log(`🔗 Average citations categorized: ${avgCitations.toFixed(1)}`);
  }

  if (failed > 0) {
    console.log(`\n❌ Failed tests:`);
    testResults
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`   - Collector Result ${r.collectorResultId}:`);
        r.errors.forEach(err => console.log(`     • ${err}`));
      });
  }

  console.log(`\n${'='.repeat(70)}\n`);
}

// Run tests
testConsolidatedAnalysis()
  .then(() => {
    console.log('✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
