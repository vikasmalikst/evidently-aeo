
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugRecommendations() {
    console.log('🔍 Debugging Recommendations...');

    // 1. Target Specific Brand
    const TARGET_BRAND_ID = '0fa491bf-3b62-45a3-b498-8241b6bf689d'; // The active Nike brand

    const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', TARGET_BRAND_ID)
        .single();

    if (brandError || !brand) {
        console.error('Target brand not found:', brandError);
        return;
    }
    console.log(`✅ Selected Brand: ${brand.name} (${brand.id})`);

    // 2. Fetch ALL recommendations for this brand (no date filter)
    // Removed 'status' as it doesn't exist.
    const { data: allRecs, error } = await supabase
        .from('recommendations')
        .select('id, review_status, created_at, is_approved, is_completed')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching recs:', error);
        return;
    }

    console.log(`\nFound ${allRecs?.length || 0} total recommendations.`);
    if (allRecs && allRecs.length > 0) {
        console.log('Sample Recs (Top 5):');
        allRecs.slice(0, 5).forEach(r => {
            console.log(` - ID: ${r.id} | Created: ${r.created_at} | Review: ${r.review_status} | Approved: ${r.is_approved}`);
        });
    }

    // 3. Simulate Query Window (Last 7 Days) - NEW LOGIC
    const startIso = '2026-01-08T00:00:00.000Z';
    const endIso = '2026-01-15T23:59:59.999Z';

    console.log(`\n📅 Query Window: ${startIso} to ${endIso}`);

    // Logic mirror from data-aggregation.service.ts
    const recs = allRecs || [];

    // Generated: Strict Window
    const generated = recs.filter(r => r.created_at >= startIso && r.created_at <= endIso).length;

    // Pipeline: Cumulative (All fetched)
    const approved = recs.filter(r => r.is_approved === true || r.review_status === 'approved').length;
    const pending = recs.filter(r => r.review_status === 'pending_review').length;

    console.log('\n--- Simulated Dashboard Output ---');
    console.log(`Generated (Strict): ${generated}`);
    console.log(`Approved (Cumulative): ${approved}`);
    console.log(`Pending (Cumulative): ${pending}`);

    if (approved > 0 || pending > 0) {
        console.log('✅ SUCCESS: Pipeline metrics show data!');
    } else {
        console.log('❌ FAILURE: Still showing zeros? Check status values.');
    }
}

debugRecommendations().catch(console.error);
