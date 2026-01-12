
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestRecs() {
    console.log('Searching for "Victoria & Secrets" brand...');

    // 1. Get Brand ID
    const { data: brands, error: brandError } = await supabase
        .from('brands')
        .select('id, name')
        .ilike('name', '%Victoria%Secret%');

    if (brandError || !brands || brands.length === 0) {
        console.error('Brand not found:', brandError);
        return;
    }

    console.log(`Found ${brands.length} brand(s):`);
    brands.forEach(b => console.log(` - ${b.name} (${b.id})`));

    const brand = brands[0]; // Continue with the first one for now

    // 2. Get Latest Generation
    console.log('Fetching latest generation...');
    const { data: gens, error: genError } = await supabase
        .from('recommendation_generations')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(1);

    if (genError) {
        console.error('Error fetching generations:', genError);
        return;
    }

    if (!gens || gens.length === 0) {
        console.log('No generations found for this brand.');
        return;
    }

    const latestGen = gens[0];
    console.log(`Found Generation: ${latestGen.id}`);
    console.log(`  Created At: ${latestGen.created_at}`);
    console.log(`  Recs Count: ${latestGen.recommendations_count}`);

    // 3. Get Recommendations for this Generation
    console.log('Fetching recommendations for this generation...');
    const { data: recs, error: recError } = await supabase
        .from('recommendations')
        .select('*')
        .eq('generation_id', latestGen.id);

    if (recError) {
        console.error('Error fetching recs:', recError);
        return;
    }

    if (!recs || recs.length === 0) {
        console.log('No recommendations found for this generation.');
        return;
    }

    console.log('--- LATEST RECOMMENDATIONS ---');
    recs.forEach((r: any, i) => {
        console.log(`\n[${i + 1}] Action: ${r.action}`);
        console.log(`    Focus Area: ${r.focus_area}`);
        console.log(`    KPI: ${r.kpi}`);
        console.log(`    Rec ID: ${r.id}`);
    });
}

checkLatestRecs();
