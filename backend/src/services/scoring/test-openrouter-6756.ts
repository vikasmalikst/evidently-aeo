import { ConsolidatedScoringService } from './consolidated-scoring.service';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testOpenRouter6756() {
  console.log('🚀 Starting OpenRouter test for collector_result 6756...');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const scoringService = new ConsolidatedScoringService();

  const collectorResultId = 6756;

  try {
    // 1. Fetch the collector_result to get brand_id and customer_id
    console.log(`\n🔍 Fetching collector_result ${collectorResultId}...`);
    const { data: collectorResult, error: fetchError } = await supabase
      .from('collector_results')
      .select('*')
      .eq('id', collectorResultId)
      .single();

    if (fetchError || !collectorResult) {
      console.error(`❌ Failed to fetch collector_result ${collectorResultId}:`, fetchError?.message);
      return;
    }

    console.log(`✅ Found result: Brand ID: ${collectorResult.brand_id}, Customer ID: ${collectorResult.customer_id}`);

    // 2. Reset status if needed to allow reprocessing
    console.log(`\n🔄 Resetting status for ${collectorResultId} to allow reprocessing...`);
    await supabase
      .from('collector_results')
      .update({ scoring_status: 'pending' })
      .eq('id', collectorResultId);

    // 3. Clear analysis cache to force a new OpenRouter call
    console.log(`\n🧹 Clearing analysis cache for ${collectorResultId} to force new LLM call...`);
    await supabase
      .from('consolidated_analysis_cache')
      .delete()
      .eq('collector_result_id', collectorResultId);

    // 4. Ensure Ollama is disabled for this brand to force OpenRouter
    console.log(`\n🌐 Ensuring Ollama is disabled for brand ${collectorResult.brand_id} to force OpenRouter...`);
    const { data: brand } = await supabase
      .from('brands')
      .select('local_llm')
      .eq('id', collectorResult.brand_id)
      .single();
    
    const currentConfig = (brand?.local_llm as any) || {};
    await supabase
      .from('brands')
      .update({ local_llm: { ...currentConfig, useOllama: false } })
      .eq('id', collectorResult.brand_id);

    // 5. Run scoring for ONLY this ID
    console.log(`\n📊 Running consolidated scoring for ${collectorResultId}...`);
    // Create a modified version of scoreBrand logic or just call runConsolidatedAnalysis directly
    const analysis = await (scoringService as any).runConsolidatedAnalysis(
      collectorResult,
      collectorResult.brand_id,
      collectorResult.customer_id
    );

    console.log('\n✨ Analysis result for 6756:');
    console.log(JSON.stringify(analysis, null, 2));

    if (!analysis) {
      console.error(`\n❌ Test FAILED for ${collectorResultId}`);
    } else {
      console.log(`\n✅ Test SUCCEEDED for ${collectorResultId}`);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error);
  }
}

testOpenRouter6756();
