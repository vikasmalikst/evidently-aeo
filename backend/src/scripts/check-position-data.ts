import { supabaseAdmin } from '../config/database';

/**
 * Check which collectors have position data for recent dates
 * This helps diagnose why some LLMs show data and others don't
 */
async function checkPositionData() {
  const brandId = '5a57c430-6940-4198-a1f5-a443cbd044dc';
  const startDate = '2025-12-16';
  const endDate = '2025-12-22';
  
  console.log(`\n🔍 Checking position data for brand ${brandId}`);
  console.log(`📅 Date range: ${startDate} to ${endDate}\n`);
  
  // Query to get position counts by collector and date
  const { data, error } = await supabaseAdmin
    .from('extracted_positions')
    .select('collector_type, processed_at, created_at')
    .eq('brand_id', brandId)
    .gte('processed_at', startDate)
    .lte('processed_at', endDate + 'T23:59:59.999Z')
    .not('competitor_name', 'is', null)  // Get brand rows only (competitor_name is null for brand rows)
    .order('processed_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error querying positions:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('⚠️  No position rows found for this date range');
    return;
  }
  
  console.log(`✅ Found ${data.length} brand position rows\n`);
  
  // Group by collector_type and date
  const collectorDateCounts = new Map<string, Map<string, number>>();
  
  data.forEach(row => {
    const collectorType = row.collector_type || 'unknown';
    const timestamp = row.processed_at || row.created_at;
    const date = timestamp ? timestamp.split('T')[0] : 'unknown';
    
    if (!collectorDateCounts.has(collectorType)) {
      collectorDateCounts.set(collectorType, new Map());
    }
    
    const dateCounts = collectorDateCounts.get(collectorType)!;
    dateCounts.set(date, (dateCounts.get(date) || 0) + 1);
  });
  
  // Print results
  console.log('📊 Position counts by collector and date:\n');
  
  const collectors = Array.from(collectorDateCounts.keys()).sort();
  
  collectors.forEach(collector => {
    const dateCounts = collectorDateCounts.get(collector)!;
    const dates = Array.from(dateCounts.keys()).sort();
    const totalCount = Array.from(dateCounts.values()).reduce((sum, count) => sum + count, 0);
    
    console.log(`\n${collector} (${totalCount} total):`);
    dates.forEach(date => {
      const count = dateCounts.get(date)!;
      console.log(`   ${date}: ${count} rows`);
    });
  });
  
  console.log('\n');
  
  // Check for missing dates
  const allDates = ['2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19', '2025-12-20', '2025-12-21', '2025-12-22'];
  console.log('🔍 Checking for missing dates per collector:\n');
  
  collectors.forEach(collector => {
    const dateCounts = collectorDateCounts.get(collector)!;
    const collectorDates = Array.from(dateCounts.keys());
    const missingDates = allDates.filter(date => !collectorDates.includes(date));
    
    if (missingDates.length > 0) {
      console.log(`❌ ${collector}: Missing ${missingDates.length} dates - ${missingDates.join(', ')}`);
    } else {
      console.log(`✅ ${collector}: Has data for all 7 dates`);
    }
  });
  
  console.log('\n');
  process.exit(0);
}

checkPositionData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

