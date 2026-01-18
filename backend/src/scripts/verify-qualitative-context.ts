
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { contextBuilderService } from '../services/recommendations/recommendation-v3/context-builder.service';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('🔍 Finding a test brand...');

    // Get a brand that has recent collector results
    const { data: results } = await supabase
        .from('collector_results')
        .select('brand_id, brand:brands(name, customer_id)')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!results || results.length === 0) {
        console.error('❌ No collector results found to test with.');
        return;
    }

    const result = results[0];
    const brandId = result.brand_id;
    // @ts-ignore
    const brandName = result.brand?.name;
    // @ts-ignore
    const customerId = result.brand?.customer_id;

    console.log(`✅ Testing with Brand: ${brandName} (${brandId})`);

    // Call ContextBuilder
    console.log('🧠 Gathering Brand Context...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days
    const startDateIso = startDate.toISOString();

    const context = await contextBuilderService.gatherBrandContext(
        brandId,
        customerId
    );

    if (!context) {
        console.error('❌ Context gathering failed (returned null).');
        return;
    }

    console.log('\n--- Qualitative Context Results ---');
    console.log('Top Keywords:', context.topKeywords || 'None');
    console.log('Strategic Narrative:', context.strategicNarrative || 'None');
    console.log('Key Quotes:', context.keyQuotes || 'None');

    console.log('\n--- Verification ---');
    if (context.topKeywords && context.topKeywords.length > 0) {
        console.log('✅ Keywords present');
    } else {
        console.warn('⚠️ Keywords missing (Expected if no analysis has run with new code yet)');
    }

    if (context.strategicNarrative) {
        console.log('✅ Narrative present');
    } else {
        console.warn('⚠️ Narrative missing (Expected if no analysis has run with new code yet)');
    }

    process.exit(0);
}

main().catch(console.error);
