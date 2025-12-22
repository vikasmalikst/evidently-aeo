import { supabaseAdmin } from '../config/database';

/**
 * Check actual visibility and share values for ChatGPT on Dec 22
 */
async function checkChatGPTValues() {
  const brandId = '5a57c430-6940-4198-a1f5-a443cbd044dc';
  const date = '2025-12-22';
  
  console.log(`\n🔍 Checking position values for ChatGPT, Google AIO, Bing Copilot, Gemini on ${date}\n`);
  
  const collectors = ['ChatGPT', 'Google AIO', 'Bing Copilot', 'Gemini'];
  
  for (const collector of collectors) {
    const { data, error } = await supabaseAdmin
      .from('extracted_positions')
      .select('collector_type, visibility_index, share_of_answers_brand, has_brand_presence, processed_at, competitor_name')
      .eq('brand_id', brandId)
      .eq('collector_type', collector)
      .gte('processed_at', date)
      .lte('processed_at', date + 'T23:59:59.999Z')
      .is('competitor_name', null)  // Brand rows only
      .limit(10);
    
    if (error) {
      console.error(`❌ Error for ${collector}:`, error);
      continue;
    }
    
    if (!data || data.length === 0) {
      console.log(`❌ ${collector}: No brand position rows found for ${date}`);
      continue;
    }
    
    console.log(`\n📊 ${collector} (${data.length} brand rows):`);
    data.forEach((row, idx) => {
      console.log(`   Row ${idx + 1}:`);
      console.log(`      visibility_index: ${row.visibility_index}`);
      console.log(`      share_of_answers_brand: ${row.share_of_answers_brand}`);
      console.log(`      has_brand_presence: ${row.has_brand_presence}`);
      console.log(`      processed_at: ${row.processed_at}`);
    });
    
    // Calculate averages
    const avgVisibility = data.reduce((sum, r) => sum + (r.visibility_index || 0), 0) / data.length;
    const avgShare = data.reduce((sum, r) => sum + (r.share_of_answers_brand || 0), 0) / data.length;
    const brandPresenceCount = data.filter(r => r.has_brand_presence).length;
    
    console.log(`   Averages:`);
    console.log(`      visibility: ${avgVisibility.toFixed(2)}`);
    console.log(`      share: ${avgShare.toFixed(2)}`);
    console.log(`      brand_presence: ${brandPresenceCount}/${data.length}`);
  }
  
  console.log('\n');
  process.exit(0);
}

checkChatGPTValues().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

