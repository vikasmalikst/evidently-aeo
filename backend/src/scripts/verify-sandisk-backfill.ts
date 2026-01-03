import { consolidatedScoringService } from '../services/scoring/consolidated-scoring.service';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const brandName = 'SanDisk';
  const limit = 500;
  
  console.log(`🚀 Starting SanDisk specific backfill and verification script...`);
  
  try {
    // 1. Run backfill for SanDisk
    const result = await consolidatedScoringService.backfillScoringFromCache(limit, brandName);
    
    console.log('\n✅ Backfill operation completed');
    console.log(`-----------------------------------`);
    console.log(`Processed:           ${result.processed}`);
    console.log(`Errors:              ${result.errors.length}`);

    // 2. Verification: Check ALL SanDisk collector results that have cache entries
    console.log(`\n🔍 Verifying all ${brandName} collector results with cache entries...`);
    
    const { data: results, error } = await supabase
      .from('collector_results')
      .select(`
        id, 
        scoring_status,
        consolidated_analysis_cache!inner(collector_result_id)
      `)
      .eq('brand', brandName);

    if (error) {
      throw new Error(`Verification query failed: ${error.message}`);
    }

    if (!results || results.length === 0) {
      console.log(`ℹ️ No collector results with cache entries found for ${brandName}.`);
    } else {
      const totalWithCache = results.length;
      const completed = results.filter(r => r.scoring_status === 'completed').length;
      const stuck = results.filter(r => r.scoring_status !== 'completed');
      
      console.log(`📊 Verification Summary for ${brandName}:`);
      console.log(`   - Total with cache entries: ${totalWithCache}`);
      console.log(`   - Marked as 'completed':    ${completed}`);
      
      if (stuck.length > 0) {
        console.log(`   - ❌ Still stuck:           ${stuck.length}`);
        console.log(`\nStuck IDs: ${stuck.map(r => `${r.id} (${r.scoring_status})`).join(', ')}`);
        process.exit(1);
      } else {
        console.log(`   - ✅ All items are correctly marked as 'completed'!`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Critical error:');
    console.error(error);
    process.exit(1);
  }
}

main();
