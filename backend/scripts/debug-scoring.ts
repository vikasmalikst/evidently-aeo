
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { consolidatedScoringService } from '../src/services/scoring/consolidated-scoring.service';
import { globalSettingsService } from '../src/services/global-settings.service';

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

const TEST_BRAND_ID = '32b3dc03-fe6b-40e6-94ac-9a146ceca60d';
const TEST_CUSTOMER_ID = '157c845c-9e87-4146-8479-cb8d045212bf';

async function runDebug() {
  console.log('Starting debug scoring run...');
  console.log(`Brand: ${TEST_BRAND_ID}`);
  console.log(`Customer: ${TEST_CUSTOMER_ID}`);

  // Check if there are any pending rows
  const { count, error } = await supabase
    .from('collector_results')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', TEST_BRAND_ID)
    .eq('customer_id', TEST_CUSTOMER_ID)
    .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error');

  if (error) {
    console.error('Error checking pending rows:', error);
    return;
  }

  console.log(`Pending rows count: ${count}`);

  // Check for columns existence
  console.log('Checking for scoring columns...');
  const { error: colError } = await supabase
    .from('collector_results')
    .select('scoring_status, scoring_started_at, scoring_completed_at, scoring_error')
    .limit(1);
  
  if (colError) {
    console.error('Column check failed:', colError);
  } else {
    console.log('All scoring columns exist.');
  }

  if (count === 0) {
    console.log('No pending rows found. Resetting some rows for testing...');
    // Optional: Reset some rows if needed, but better to inspect first.
    // Let's see if we can find ANY rows for this brand
    const { count: totalCount } = await supabase
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', TEST_BRAND_ID)
        .eq('customer_id', TEST_CUSTOMER_ID);
    console.log(`Total rows for brand: ${totalCount}`);
  }

  // Run scoring
  try {
    const result = await consolidatedScoringService.scoreBrand({
      brandId: TEST_BRAND_ID,
      customerId: TEST_CUSTOMER_ID,
      limit: 10
    });
    console.log('Scoring result:', result);
  } catch (err) {
    console.error('Scoring failed:', err);
  }
}

runDebug().catch(console.error);
