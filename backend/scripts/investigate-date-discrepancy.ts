/**
 * Investigate date discrepancy: collector_results.created_at vs UI display
 * 
 * Issue: Database shows Dec 20, but UI shows Dec 19
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simulate the extractDate function from payload-builder.ts
function extractDate(timestamp: string | null): string | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
  } catch {
    return null;
  }
}

// Simulate the UI formatDateLabel function from SearchVisibility.tsx
function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();
    return `${dayName} ${dayNum}`;
  } catch {
    return dateStr;
  }
}

async function investigateDateDiscrepancy() {
  console.log('🔍 Investigating Date Discrepancy (Dec 20 in DB → Dec 19 in UI)\n');
  console.log('='.repeat(70));

  // Step 1: Get sample collector_results with created_at = Dec 20
  console.log('📊 Step 1: Fetching collector_results from Dec 20, 2025...\n');
  
  const { data: collectorResults, error: crError } = await supabase
    .from('collector_results')
    .select('id, created_at, brand, collector_type')
    .gte('created_at', '2025-12-20T00:00:00Z')
    .lt('created_at', '2025-12-21T00:00:00Z')
    .eq('brand', 'CAVA')
    .limit(5)
    .order('created_at', { ascending: true });

  if (crError) {
    console.error('❌ Error:', crError);
    return;
  }

  if (!collectorResults || collectorResults.length === 0) {
    console.log('⚠️  No collector_results found for CAVA on Dec 20');
    return;
  }

  console.log(`✅ Found ${collectorResults.length} collector_results\n`);

  // Step 2: Analyze each date conversion
  collectorResults.forEach((cr, idx) => {
    console.log(`\n📅 Sample ${idx + 1}:`);
    console.log(`   Database created_at: ${cr.created_at}`);
    console.log(`   Raw timestamp: ${JSON.stringify(cr.created_at)}`);
    
    // Step 2a: What extractDate returns (backend)
    const extractedDate = extractDate(cr.created_at);
    console.log(`   Backend extractDate(): ${extractedDate}`);
    
    // Step 2b: What UI formatDateLabel returns
    if (extractedDate) {
      const uiLabel = formatDateLabel(extractedDate);
      console.log(`   UI formatDateLabel(): ${uiLabel}`);
      
      // Step 2c: Detailed analysis
      const dbDate = new Date(cr.created_at);
      const extractedDateObj = new Date(extractedDate + 'T00:00:00Z');
      const uiDateObj = new Date(extractedDate + 'T00:00:00Z');
      
      console.log(`\n   🔍 Detailed Analysis:`);
      console.log(`      DB Date (UTC): ${dbDate.toISOString()}`);
      console.log(`      DB Date (Local): ${dbDate.toString()}`);
      console.log(`      DB Date UTC Hours: ${dbDate.getUTCHours()}`);
      console.log(`      DB Date Local Hours: ${dbDate.getHours()}`);
      console.log(`      DB Date UTC Day: ${dbDate.getUTCDate()}`);
      console.log(`      DB Date Local Day: ${dbDate.getDate()}`);
      
      console.log(`\n      Extracted Date String: ${extractedDate}`);
      console.log(`      Extracted Date Object (UTC): ${extractedDateObj.toISOString()}`);
      console.log(`      Extracted Date Object (Local): ${extractedDateObj.toString()}`);
      console.log(`      Extracted Date UTC Day: ${extractedDateObj.getUTCDate()}`);
      console.log(`      Extracted Date Local Day: ${extractedDateObj.getDate()}`);
      
      console.log(`\n      UI Date Object (UTC): ${uiDateObj.toISOString()}`);
      console.log(`      UI Date Object (Local): ${uiDateObj.toString()}`);
      console.log(`      UI Date UTC Day: ${uiDateObj.getUTCDate()}`);
      console.log(`      UI Date Local Day: ${uiDateObj.getDate()}`);
      console.log(`      UI getDate() result: ${uiDateObj.getDate()}`);
      
      // Check timezone
      const timezoneOffset = dbDate.getTimezoneOffset();
      const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log(`\n      System Timezone: ${timezoneName}`);
      console.log(`      Timezone Offset (minutes): ${timezoneOffset}`);
      console.log(`      Timezone Offset (hours): ${timezoneOffset / 60}`);
      
      // The issue: if DB has Dec 20 00:00 UTC, and system is PST (UTC-8)
      // new Date('2025-12-20T00:00:00Z') in PST = Dec 19 16:00 PST
      // getDate() returns 19 (local day)
      
      if (dbDate.getUTCDate() !== uiDateObj.getDate()) {
        console.log(`\n      ⚠️  DISCREPANCY DETECTED!`);
        console.log(`      UTC Day: ${dbDate.getUTCDate()}, Local Day: ${uiDateObj.getDate()}`);
        console.log(`      This is the root cause!`);
      }
    }
  });

  // Step 3: Check metric_facts processed_at
  console.log(`\n\n📊 Step 2: Checking metric_facts processed_at...\n`);
  
  const collectorResultIds = collectorResults.map(cr => cr.id);
  const { data: metricFacts, error: mfError } = await supabase
    .from('metric_facts')
    .select('id, collector_result_id, processed_at, created_at')
    .in('collector_result_id', collectorResultIds);

  if (!mfError && metricFacts) {
    console.log(`✅ Found ${metricFacts.length} metric_facts\n`);
    metricFacts.forEach((mf, idx) => {
      const cr = collectorResults.find(c => c.id === mf.collector_result_id);
      console.log(`\n   Metric Fact ${idx + 1}:`);
      console.log(`      collector_result_id: ${mf.collector_result_id}`);
      console.log(`      collector_result.created_at: ${cr?.created_at}`);
      console.log(`      metric_fact.processed_at: ${mf.processed_at}`);
      console.log(`      metric_fact.created_at: ${mf.created_at}`);
      
      const crDate = extractDate(cr?.created_at || null);
      const mfProcessedDate = extractDate(mf.processed_at);
      const mfCreatedDate = extractDate(mf.created_at);
      
      console.log(`      Extracted from CR created_at: ${crDate}`);
      console.log(`      Extracted from MF processed_at: ${mfProcessedDate}`);
      console.log(`      Extracted from MF created_at: ${mfCreatedDate}`);
      
      if (crDate !== mfProcessedDate) {
        console.log(`      ⚠️  Date mismatch between collector_result and metric_fact!`);
      }
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('📋 ROOT CAUSE ANALYSIS');
  console.log('='.repeat(70));
  console.log(`
The issue is in the date extraction and formatting chain:

1. Database stores: created_at = '2025-12-20T17:54:14+00:00' (UTC)
2. Backend extractDate():
   - new Date('2025-12-20T17:54:14+00:00') → Date object
   - toISOString() → '2025-12-20T17:54:14.000Z'
   - split('T')[0] → '2025-12-20' ✅ CORRECT

3. UI formatDateLabel('2025-12-20'):
   - new Date('2025-12-20T00:00:00Z') → Dec 20 00:00 UTC
   - BUT if server/browser is in PST (UTC-8):
     - Dec 20 00:00 UTC = Dec 19 16:00 PST
   - toLocaleDateString() uses LOCAL timezone
   - getDate() returns LOCAL day → 19 ❌ WRONG

ROOT CAUSE: formatDateLabel uses getDate() which returns LOCAL day,
but the date string represents UTC day. Timezone conversion causes
the day to shift backward in timezones west of UTC.
  `);
  console.log('='.repeat(70));
}

investigateDateDiscrepancy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });

