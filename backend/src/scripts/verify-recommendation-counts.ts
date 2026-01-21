
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Calculate path to .env file relative to this script
const envPath = '/Users/vikas/Documents/evidently/backend/.env';
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyCounts() {
    const brandName = 'inSiderSports';
    console.log(`🔍 Searching for brand: ${brandName}`);

    // 1. Find Brand
    const { data: brands, error: brandError } = await supabase
        .from('brands')
        .select('id, name')
        .ilike('name', `%${brandName}%`);

    if (brandError) {
        console.error('Error finding brand:', brandError);
        return;
    }

    if (!brands || brands.length === 0) {
        console.error('Brand not found');
        return;
    }

    const brand = brands[0];
    console.log(`✅ Found brand: ${brand.name} (${brand.id})`);

    // 2. Fetch all recommendations
    console.log('🔍 Fetching all recommendations...');
    const { data: recs, error: recError } = await supabase
        .from('recommendations')
        .select('id, review_status, is_approved, is_content_generated, is_completed, created_at, generation_id')
        .eq('brand_id', brand.id);

    if (recError) {
        console.error('Error fetching recommendations:', recError);
        return;
    }

    if (!recs) {
        console.log('No recommendations found.');
        return;
    }

    console.log(`📊 Total Recommendations found: ${recs.length}`);

    // 3. Apply Logic from Executive Report (Snapshot)
    const generated = recs.length;

    const pending = recs.filter(r =>
        (r.review_status === 'pending_review' || !r.review_status) &&
        !r.is_completed &&
        !r.is_approved &&
        !r.is_content_generated
    ).length;

    const approved = recs.filter(r =>
        (r.is_approved === true || r.review_status === 'approved') &&
        !r.is_content_generated &&
        !r.is_completed
    ).length;

    const content_generated = recs.filter(r =>
        r.is_content_generated === true &&
        !r.is_completed
    ).length;

    const implemented = recs.filter(r =>
        r.is_completed === true
    ).length;

    const rejected = recs.filter(r =>
        r.review_status === 'rejected'
    ).length;

    console.log('\n--- 📋 Executive Report Counts (Current Snapshot Logic) ---');
    console.log(`Generated: ${generated}`);
    console.log(`Pending:   ${pending}`);
    console.log(`Approved:  ${approved}`);
    console.log(`Content:   ${content_generated}`);
    console.log(`Implem.:   ${implemented}`);
    console.log(`Rejected:  ${rejected}`);


    // 4. Breakdown by Generation
    console.log('\n--- 🧬 Breakdown by Generation ID ---');
    const generations: Record<string, number> = {};
    const genDetails: Record<string, any> = {};

    recs.forEach(r => {
        const genId = r.generation_id || 'null';
        generations[genId] = (generations[genId] || 0) + 1;

        if (!genDetails[genId]) {
            genDetails[genId] = {
                created_at: r.created_at,
                pending: 0,
                approved: 0,
                content: 0,
                implemented: 0
            };
        }

        if ((r.review_status === 'pending_review' || !r.review_status) && !r.is_completed && !r.is_approved && !r.is_content_generated) genDetails[genId].pending++;
        if ((r.is_approved === true || r.review_status === 'approved') && !r.is_content_generated && !r.is_completed) genDetails[genId].approved++;
        if (r.is_content_generated === true && !r.is_completed) genDetails[genId].content++;
        if (r.is_completed === true) genDetails[genId].implemented++;
    });

    // Sort generations by date
    const sortedGenIds = Object.keys(genDetails).sort((a, b) =>
        new Date(genDetails[b].created_at).getTime() - new Date(genDetails[a].created_at).getTime()
    );

    for (const genId of sortedGenIds) {
        console.log(`Gen ID: ${genId} (Date: ${genDetails[genId].created_at})`);
        console.log(`  Total: ${generations[genId]}`);
        console.log(`  Pending: ${genDetails[genId].pending}, Approved: ${genDetails[genId].approved}, Content: ${genDetails[genId].content}, Implemented: ${genDetails[genId].implemented}`);
    }

}

verifyCounts().catch(console.error);
