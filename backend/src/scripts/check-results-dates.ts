
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

async function main() {
    const brandId = 'b25e2d4f-c1ed-4ddd-b007-18a816619d96';

    // Date range from command
    const start = new Date('2026-01-13T00:00:00Z');
    const end = new Date('2026-01-15T23:59:59Z');

    console.log(`\n🔎 Checking collector_results for brand ${brandId}`);
    console.log(`   Query Range: ${start.toISOString()} to ${end.toISOString()}`);

    const { data: results, error } = await supabase
        .from('collector_results')
        .select('id, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`\n   Found ${results?.length} total results for this brand (ALL TIME).`);
    console.log('   --------------------------------------------------');
    console.log('   ID       | Created At (UTC)             | In Range?');
    console.log('   --------------------------------------------------');

    let inRangeCount = 0;
    if (results) {
        for (const res of results) {
            const created = new Date(res.created_at);
            const inRange = created >= start && created <= end;
            if (inRange) inRangeCount++;

            console.log(`   ${res.id.toString().padEnd(8)} | ${res.created_at} | ${inRange ? '✅ YES' : '❌ NO'}`);
        }
    }
    console.log('   --------------------------------------------------');
    console.log(`   Total in range: ${inRangeCount}`);
}

main();
