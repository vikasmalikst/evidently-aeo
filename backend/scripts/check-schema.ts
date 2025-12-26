
import * as dotenv from 'dotenv';
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

console.log(`🔌 Supabase URL: ${supabaseUrl}`);

async function checkSchema() {
  console.log('🔍 Checking collector_results schema...');

  const columnsToCheck = [
    'scoring_status',
    'scoring_started_at',
    'scoring_completed_at',
    'scoring_error'
  ];

  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('collector_results')
      .select(col)
      .limit(1);

    if (error) {
      console.log(`❌ Column '${col}' is MISSING or inaccessible: ${error.message}`);
    } else {
      console.log(`✅ Column '${col}' exists (SELECT works).`);
    }
  }

  console.log('\n🔍 Testing UPDATE permission on scoring_status...');
  const { error: updateError } = await supabase
    .from('collector_results')
    .update({ scoring_status: 'pending' })
    .eq('id', 0) // Non-existent ID, just checking if query compiles
    .select();

  if (updateError) {
    console.log(`❌ UPDATE failed: ${updateError.message}`);
    console.log(`   Details: ${updateError.details}`);
    console.log(`   Hint: ${updateError.hint}`);
  } else {
    console.log('✅ UPDATE query compiled successfully (columns exist and are writable).');
  }

  console.log('\n🔍 Testing EXACT claim query...');
  const { error: claimError } = await supabase
    .from('collector_results')
    .update({
      scoring_status: 'processing',
      scoring_started_at: new Date().toISOString(),
    })
    .eq('id', 5666)
    .or('scoring_status.is.null,scoring_status.eq.pending,scoring_status.eq.error')
    .select('id')
    .single();

  if (claimError) {
      console.log(`❌ CLAIM query failed: ${claimError.message}`);
      console.log(`   Details: ${claimError.details}`);
  } else {
      console.log('✅ CLAIM query succeeded (or would have).');
  }

  console.log('\n🔍 Testing CLAIM query with simple filter...');
  const { error: simpleError } = await supabase
    .from('collector_results')
    .update({
      scoring_status: 'processing',
    })
    .eq('id', 5666)
    .eq('scoring_status', 'pending')
    .select('id')
    .single();
    
  if (simpleError) {
      console.log(`❌ SIMPLE query failed: ${simpleError.message}`);
  } else {
      console.log('✅ SIMPLE query succeeded.');
  }

  console.log('\n🔍 Testing CLAIM query with alternative OR syntax...');
  const { error: altError } = await supabase
    .from('collector_results')
    .update({
      scoring_status: 'processing',
    })
    .eq('id', 5666)
    .or('scoring_status.is.null,scoring_status.in.(pending,error)')
    .select('id')
    .single();

  if (altError) {
      console.log(`❌ ALT query failed: ${altError.message}`);
  } else {
      console.log('✅ ALT query succeeded.');
  }

  console.log('\n🔍 Testing CLAIM query with NEQ syntax...');
  const { error: neqError } = await supabase
    .from('collector_results')
    .update({
      scoring_status: 'processing',
    })
    .eq('id', 5666)
    .neq('scoring_status', 'processing')
    .neq('scoring_status', 'completed')
    .select('id')
    .single();

  if (neqError) {
      console.log(`❌ NEQ query failed: ${neqError.message}`);
  } else {
      console.log('✅ NEQ query succeeded (or would have returned no rows).');
  }

  console.log('\n🔍 Testing CLAIM query with OR but no NULL...');
  const { error: orNoNullError } = await supabase
    .from('collector_results')
    .update({ scoring_status: 'processing' })
    .eq('id', 5666)
    .or('scoring_status.eq.pending,scoring_status.eq.error')
    .select('id')
    .single();

  if (orNoNullError) {
      console.log(`❌ OR-NO-NULL query failed: ${orNoNullError.message}`);
  } else {
      console.log('✅ OR-NO-NULL query succeeded.');
  }

  console.log('\n🔍 Testing CLAIM query for NULL only...');
  const { error: nullError } = await supabase
    .from('collector_results')
    .update({ scoring_status: 'processing' })
    .eq('id', 5666)
    .is('scoring_status', null)
    .select('id')
    .single();

  if (nullError) {
      console.log(`❌ NULL query failed: ${nullError.message}`);
  } else {
      console.log('✅ NULL query succeeded.');
  }
}

checkSchema().catch(console.error);
