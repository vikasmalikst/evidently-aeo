
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { consolidatedScoringService } from '../src/services/scoring/consolidated-scoring.service';
import { supabaseAdmin } from '../src/config/database';

const COLLECTOR_RESULT_ID = 5648;

async function verifyFixes() {
  console.log('🚀 Starting verification for fixes...');
  console.log(`🎯 Target Collector Result ID: ${COLLECTOR_RESULT_ID}`);

  try {
    // 1. Check if collector result exists
    const { data: collectorResult, error: checkError } = await supabaseAdmin
      .from('collector_results')
      .select('*')
      .eq('id', COLLECTOR_RESULT_ID)
      .single();

    if (checkError || !collectorResult) {
      console.error(`❌ Collector result ${COLLECTOR_RESULT_ID} not found!`, checkError);
      process.exit(1);
    }

    console.log(`✅ Found collector result for Brand ID: ${collectorResult.brand_id}`);

    // 2. Clean up previous test data (Keywords & Scoring Artifacts)
    console.log('🧹 Cleaning up previous keywords and scoring artifacts...');
    
    // Delete generated keywords
    const { error: deleteKwError } = await supabaseAdmin
      .from('generated_keywords')
      .delete()
      .eq('collector_result_id', COLLECTOR_RESULT_ID);

    if (deleteKwError) console.error('⚠️ Error cleaning up keywords:', deleteKwError.message);

    // Delete metric_facts to force reprocessing (cascades to brand_sentiment, etc.)
    const { error: deleteMfError } = await supabaseAdmin
      .from('metric_facts')
      .delete()
      .eq('collector_result_id', COLLECTOR_RESULT_ID);

    if (deleteMfError) console.error('⚠️ Error cleaning up metric_facts:', deleteMfError.message);

    // Also try to delete from extracted_positions (legacy) just in case
    const { error: deleteEpError } = await supabaseAdmin
      .from('extracted_positions')
      .delete()
      .eq('collector_result_id', COLLECTOR_RESULT_ID);
      
    if (deleteEpError) console.error('⚠️ Error cleaning up extracted_positions:', deleteEpError.message);

    // Clear consolidated_analysis_cache to ensure we run fresh analysis (and get keywords)
    const { error: deleteCacheError } = await supabaseAdmin
      .from('consolidated_analysis_cache')
      .delete()
      .eq('collector_result_id', COLLECTOR_RESULT_ID);

    if (deleteCacheError) console.error('⚠️ Error cleaning up analysis cache:', deleteCacheError.message);

    console.log('✅ Cleanup completed');

    // 3. Reset status to pending to force processing
    console.log('🔄 Resetting scoring status to pending...');
    const { error: resetError } = await supabaseAdmin
      .from('collector_results')
      .update({ 
        scoring_status: 'pending',
        scoring_error: null,
        keywords: null // Clear existing keywords in the column too
      })
      .eq('id', COLLECTOR_RESULT_ID);

    if (resetError) {
      console.error('❌ Failed to reset status:', resetError);
      process.exit(1);
    }
    console.log('✅ Status reset to pending');

    // 4. Run the scoring process
    console.log('\n🏃 Running Consolidated Scoring Process...');
    console.log('--------------------------------------------------');
    
    // Update created_at to ensure it's picked up first by scoreBrand (which orders by created_at desc)
    await supabaseAdmin
      .from('collector_results')
      .update({ created_at: new Date().toISOString() })
      .eq('id', COLLECTOR_RESULT_ID);

    await consolidatedScoringService.scoreBrand({
      brandId: collectorResult.brand_id,
      customerId: collectorResult.customer_id,
      limit: 1
    });
    
    console.log('--------------------------------------------------');
    console.log('✅ Scoring process completed');

    // 5. Verify Results
    console.log('\n🔍 Verifying Results...');

    // 5a. Verify Keywords
    const { data: keywords, error: kwError } = await supabaseAdmin
      .from('generated_keywords')
      .select('*')
      .eq('collector_result_id', COLLECTOR_RESULT_ID);

    if (kwError) {
      console.error('❌ Error fetching generated keywords:', kwError);
    } else {
      console.log(`📝 Generated Keywords Count: ${keywords?.length || 0}`);
      if (keywords && keywords.length > 0) {
        console.log('✅ Keywords detected and stored successfully!');
        console.log('Sample keywords:', keywords.slice(0, 3).map(k => k.keyword));
      } else {
        console.error('❌ No keywords were generated!');
      }
    }

    // 5b. Verify Collector Result Keywords Column
    const { data: updatedResult, error: updatedError } = await supabaseAdmin
      .from('collector_results')
      .select('keywords')
      .eq('id', COLLECTOR_RESULT_ID)
      .single();

    if (updatedError) {
        console.error('❌ Error fetching updated collector result:', updatedError);
    } else {
        if (updatedResult.keywords && updatedResult.keywords.length > 0) {
            console.log('✅ Collector Result "keywords" column populated');
        } else {
            console.error('❌ Collector Result "keywords" column is empty!');
        }
    }

    // 5c. Verify Competitor Sentiment (Indirectly check logs for errors, but can query if needed)
    console.log('\n👀 Check the logs above for "Competitor ... not found" warnings.');
    console.log('If no such warnings appear and "Successfully batch saved" is seen, the capitalization fix is working.');

  } catch (error) {
    console.error('❌ Verification script failed:', error);
  } finally {
    process.exit(0);
  }
}

verifyFixes();
