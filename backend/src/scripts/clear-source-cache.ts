
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

async function clearCache() {
    console.log('🧹 Clearing Source Attribution Cache for Nike (Aggressive Mode)...');

    // 1. Get Brand
    // Search for any brand matching "Nike"
    const { data: brands } = await supabase.from('brands').select('id, name').ilike('name', '%Nike%');

    // Check all matching brands
    if (!brands || brands.length === 0) {
        console.error('Brand "Nike" not found.');
        return;
    }

    // 2. Clear Cache for ALL matching Nike brands (just to be safe)
    // Deleting anything with range_start likely to be in Jan 2026
    const START_DATE = '2026-01-01T00:00:00Z';

    for (const brand of brands) {
        console.log(`Checking brand: ${brand.name} (${brand.id})`);

        const { data: snapshots, error: fetchError } = await supabase
            .from('source_attribution_snapshots')
            .select('*')
            .eq('brand_id', brand.id)
            .gte('range_start', START_DATE);

        if (fetchError) {
            console.error(`Error fetching for ${brand.name}:`, fetchError);
            continue;
        }

        if (!snapshots || snapshots.length === 0) {
            console.log(`  Target valid: No cache entries found since ${START_DATE}.`);
        } else {
            console.log(`  Found ${snapshots.length} cache entries. Deleting...`);

            const { error: deleteError } = await supabase
                .from('source_attribution_snapshots')
                .delete()
                .eq('brand_id', brand.id)
                .gte('range_start', START_DATE);

            if (deleteError) {
                console.error('  ❌ Error deleting cache:', deleteError);
            } else {
                console.log('  ✅ Successfully deleted entries.');
            }
        }
    }
}

clearCache().catch(console.error);
