
import { supabaseAdmin } from '../config/supabase';

async function verifyDatabase() {
    console.log('Verifying database schema...');

    // 1. Check if column exists
    // Since we can't easily query information_schema via supabase-js without direct SQL, we'll try a select
    console.log('Test 1: Selecting audit_date column...');
    const { data: selectData, error: selectError } = await supabaseAdmin
        .from('domain_readiness_audits')
        .select('audit_date')
        .limit(1);

    if (selectError) {
        console.error('❌ Failed to select audit_date:', selectError.message);
    } else {
        console.log('✅ audit_date column exists.');
    }

    // 2. Test Upsert Logic
    console.log('\nTest 2: Testing Daily Upsert...');
    const testBrandId = '00000000-0000-0000-0000-000000000000'; // Dummy UUID
    const today = new Date().toISOString().split('T')[0];

    // First Insert
    console.log('Inserting record 1...');
    const { error: insert1 } = await supabaseAdmin
        .from('domain_readiness_audits')
        .upsert({
            brand_id: testBrandId,
            audit_date: today,
            domain: 'test-upsert.com',
            overall_score: 50,
            scores: {},
            results: {},
            bot_access: [],
            metadata: { test: 1 }
        }, { onConflict: 'brand_id,audit_date' });

    if (insert1) {
        console.error('❌ Insert 1 failed:', insert1.message);
        return;
    }
    console.log('✅ Insert 1 successful');

    // Second Insert (Should Update)
    console.log('Inserting record 2 (Same Day) - Should Update...');
    const { error: insert2 } = await supabaseAdmin
        .from('domain_readiness_audits')
        .upsert({
            brand_id: testBrandId,
            audit_date: today,
            domain: 'test-upsert.com',
            overall_score: 99, // Changed score
            scores: {},
            results: {},
            bot_access: [],
            metadata: { test: 2 }
        }, { onConflict: 'brand_id,audit_date' });

    if (insert2) {
        console.error('❌ Insert 2 failed:', insert2.message);
        return;
    }
    console.log('✅ Insert 2 successful');

    // Verify only one record exists and has score 99
    const { data: verifyData } = await supabaseAdmin
        .from('domain_readiness_audits')
        .select('overall_score')
        .eq('brand_id', testBrandId)
        .eq('audit_date', today);

    if (verifyData && verifyData.length === 1 && verifyData[0].overall_score === 99) {
        console.log('✅ Upsert confirmed! Record updated correctly.');
    } else {
        console.error('❌ Upsert failed. Data:', verifyData);
    }

    // Cleanup
    console.log('\nCleaning up...');
    await supabaseAdmin
        .from('domain_readiness_audits')
        .delete()
        .eq('brand_id', testBrandId);

    console.log('✅ Cleanup done.');
}

if (require.main === module) {
    verifyDatabase()
        .then(() => process.exit(0))
        .catch((e) => {
            console.error(e);
            process.exit(1);
        });
}
