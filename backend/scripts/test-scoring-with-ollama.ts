/**
 * Test Script: Scoring with Ollama (llama3:8b)
 * 
 * Tests the optimized scoring process with:
 * - Local Ollama using llama3:8b model
 * - 5 collector results from specified brand_id
 * - Validates the optimization improvements
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { globalSettingsService } from '../src/services/global-settings.service';
import { positionExtractionService } from '../src/services/scoring/position-extraction.service';
import { consolidatedScoringService } from '../src/services/scoring/consolidated-scoring.service';

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

// Test configuration
const TEST_BRAND_ID = 'af7ab809-862c-4b5c-9485-89ebccd9846d';
const OLLAMA_MODEL = 'llama3:8b';
const OLLAMA_URL = 'http://localhost:11434';
const COLLECTOR_RESULTS_LIMIT = 5;

async function configureOllama() {
  console.log('🔧 Configuring Ollama...');
  console.log(`   Model: ${OLLAMA_MODEL}`);
  console.log(`   URL: ${OLLAMA_URL}\n`);

  try {
    // Get existing consolidated_analysis setting or create new one
    const existing = await globalSettingsService.getGlobalSetting('consolidated_analysis');
    const existingMetadata = existing?.metadata || {};

    // Update with Ollama configuration
    const updatedMetadata = {
      ...existingMetadata,
      useOllama: true,
      ollamaUrl: OLLAMA_URL,
      ollamaModel: OLLAMA_MODEL,
    };

    await globalSettingsService.updateGlobalSetting('consolidated_analysis', {
      metadata: updatedMetadata,
    });

    console.log('✅ Ollama configured successfully\n');
    return true;
  } catch (error) {
    console.error('❌ Failed to configure Ollama:', error);
    throw error;
  }
}

async function fetchCollectorResults() {
  console.log(`📊 Fetching ${COLLECTOR_RESULTS_LIMIT} collector results for brand_id: ${TEST_BRAND_ID}...\n`);

  const { data: collectorResults, error } = await supabase
    .from('collector_results')
    .select(`
      id,
      brand_id,
      customer_id,
      query_id,
      collector_type,
      raw_answer,
      created_at
    `)
    .eq('brand_id', TEST_BRAND_ID)
    .not('raw_answer', 'is', null)
    .limit(COLLECTOR_RESULTS_LIMIT)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch collector results: ${error.message}`);
  }

  if (!collectorResults || collectorResults.length === 0) {
    throw new Error(`No collector results found for brand_id: ${TEST_BRAND_ID}`);
  }

  console.log(`✅ Found ${collectorResults.length} collector results:`);
  collectorResults.forEach((result, index) => {
    console.log(`   ${index + 1}. ID: ${result.id}, Type: ${result.collector_type}, Answer length: ${result.raw_answer?.length || 0} chars`);
  });
  console.log('');

  return collectorResults;
}

async function getBrandInfo(brandId: string) {
  const { data: brand, error } = await supabase
    .from('brands')
    .select('id, name, customer_id')
    .eq('id', brandId)
    .single();

  if (error || !brand) {
    throw new Error(`Brand not found: ${brandId}`);
  }

  return brand;
}

async function runScoringTest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     🧪 Scoring Test with Ollama (llama3:8b)                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Configure Ollama
    await configureOllama();

    // Step 2: Fetch collector results
    const collectorResults = await fetchCollectorResults();
    const collectorResultIds = collectorResults.map(r => r.id);

    // Step 3: Get brand info
    const brand = await getBrandInfo(TEST_BRAND_ID);
    console.log(`📦 Brand: ${brand.name} (${brand.id})`);
    console.log(`👤 Customer ID: ${brand.customer_id}\n`);

    // Step 4: Run position extraction for specific collector results
    console.log('🚀 Starting position extraction...\n');
    console.log(`   Processing ${collectorResultIds.length} collector results: ${collectorResultIds.join(', ')}\n`);
    
    const startTime = Date.now();

    // Step 4a: Extract positions (this will use Ollama if configured)
    const positionResult = await positionExtractionService.extractPositionsForNewResults({
      customerId: brand.customer_id,
      brandIds: [TEST_BRAND_ID],
      collectorResultIds: collectorResultIds, // Process only these 5 results
      limit: COLLECTOR_RESULTS_LIMIT,
    });

    console.log(`\n✅ Position extraction completed: ${positionResult.count} results processed`);

    // Step 4b: Run consolidated scoring which will process sentiment
    // Since Ollama is enabled, it will use incremental processing automatically
    console.log('\n🚀 Starting consolidated scoring (will use Ollama incremental processing)...\n');
    
    const scoringResult = await consolidatedScoringService.scoreBrand({
      brandId: TEST_BRAND_ID,
      customerId: brand.customer_id,
      limit: COLLECTOR_RESULTS_LIMIT, // Limit to prevent processing too many
    });

    const duration = Date.now() - startTime;

    // Step 5: Display results
    console.log('\n' + '='.repeat(70));
    console.log('📊 SCORING RESULTS');
    console.log('='.repeat(70));
    console.log(`⏱️  Total Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
    console.log(`✅ Positions processed: ${scoringResult.positionsProcessed}`);
    console.log(`✅ Sentiments processed: ${scoringResult.sentimentsProcessed}`);
    console.log(`✅ Citations processed: ${scoringResult.citationsProcessed}`);
    console.log(`❌ Errors: ${scoringResult.errors.length}`);

    if (scoringResult.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      scoringResult.errors.forEach((err, index) => {
        console.log(`   ${index + 1}. Collector Result ${err.collectorResultId}: ${err.error}`);
      });
    }

    // Step 6: Verify data was saved
    console.log('\n' + '='.repeat(70));
    console.log('🔍 VERIFICATION: Checking saved data...');
    console.log('='.repeat(70));

    // Check metric_facts
    const { data: metricFacts, error: mfError } = await supabase
      .from('metric_facts')
      .select('id, collector_result_id')
      .in('collector_result_id', collectorResultIds);

    if (!mfError && metricFacts) {
      console.log(`✅ Metric facts created: ${metricFacts.length}/${collectorResultIds.length}`);
      metricFacts.forEach(mf => {
        console.log(`   - Collector Result ${mf.collector_result_id} → Metric Fact ${mf.id}`);
      });
    }

    // Check brand_metrics
    if (metricFacts && metricFacts.length > 0) {
      const metricFactIds = metricFacts.map(mf => mf.id);
      const { data: brandMetrics, error: bmError } = await supabase
        .from('brand_metrics')
        .select('metric_fact_id, visibility_index, share_of_answers')
        .in('metric_fact_id', metricFactIds);

      if (!bmError && brandMetrics) {
        console.log(`✅ Brand metrics saved: ${brandMetrics.length}`);
        brandMetrics.forEach(bm => {
          console.log(`   - Metric Fact ${bm.metric_fact_id}: Visibility=${bm.visibility_index}, SOA=${bm.share_of_answers}`);
        });
      }
    }

    // Check competitor_metrics
    if (metricFacts && metricFacts.length > 0) {
      const metricFactIds = metricFacts.map(mf => mf.id);
      const { count: compMetricsCount, error: cmError } = await supabase
        .from('competitor_metrics')
        .select('*', { count: 'exact', head: true })
        .in('metric_fact_id', metricFactIds);

      if (!cmError) {
        console.log(`✅ Competitor metrics saved: ${compMetricsCount || 0} rows`);
      }
    }

    // Check sentiment
    if (metricFacts && metricFacts.length > 0) {
      const metricFactIds = metricFacts.map(mf => mf.id);
      const { data: brandSentiment, error: bsError } = await supabase
        .from('brand_sentiment')
        .select('metric_fact_id, sentiment_label, sentiment_score')
        .in('metric_fact_id', metricFactIds);

      if (!bsError && brandSentiment) {
        console.log(`✅ Brand sentiment saved: ${brandSentiment.length}`);
        brandSentiment.forEach(bs => {
          console.log(`   - Metric Fact ${bs.metric_fact_id}: ${bs.sentiment_label} (${bs.sentiment_score})`);
        });
      }

      const { count: compSentimentCount, error: csError } = await supabase
        .from('competitor_sentiment')
        .select('*', { count: 'exact', head: true })
        .in('metric_fact_id', metricFactIds);

      if (!csError) {
        console.log(`✅ Competitor sentiment saved: ${compSentimentCount || 0} rows`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log(`\n📈 Performance Metrics:`);
    console.log(`   - Average time per collector_result: ${(duration / collectorResultIds.length).toFixed(0)}ms`);
    console.log(`   - Throughput: ${((collectorResultIds.length / duration) * 1000).toFixed(2)} results/second`);
    console.log('');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
runScoringTest()
  .then(() => {
    console.log('✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

