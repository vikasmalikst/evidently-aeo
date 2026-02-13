
import { supabaseAdmin } from './config/supabase';

async function getTestData() {
    const brandId = 'ab920a2d-26bc-4ca0-a58f-17bfc96ce349';

    console.log(`Looking up data for Brand ID: ${brandId}`);

    // 1. Get Customer ID
    const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('customer_id, name')
        .eq('id', brandId)
        .single();

    if (brandError) {
        console.error('Error fetching brand:', brandError);
        return;
    }

    console.log(`Found Brand: ${brand.name} (Customer: ${brand.customer_id})`);

    // 2. Get a Recommendation
    const { data: recs, error: recError } = await supabaseAdmin
        .from('recommendations')
        .select('id, action')
        .eq('brand_id', brandId)
        .limit(1);

    if (recError || !recs || recs.length === 0) {
        console.error('Error fetching recommendations:', recError);
        return;
    }

    console.log(`Found Recommendation: ${recs[0].id} ("${recs[0].action}")`);
    console.log('\n--- DATA FOR TEST ---');
    console.log(`export const TEST_CUSTOMER_ID = '${brand.customer_id}';`);
    console.log(`export const TEST_REC_ID = '${recs[0].id}';`);
}

getTestData();
