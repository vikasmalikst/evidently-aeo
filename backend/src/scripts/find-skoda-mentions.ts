
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
    const brandId = 'b25e2d4f-c1ed-4ddd-b007-18a816619d96'; // Skoda
    const searchTerm = 'Skoda';

    // Date range from user request
    const start = '2026-01-13T00:00:00Z';
    const end = '2026-01-15T23:59:59Z';

    console.log(`\n🔎 Searching for '${searchTerm}' in collector_results for brand ${brandId}`);
    console.log(`   Range: ${start} to ${end}`);

    const { data: results, error } = await supabase
        .from('collector_results')
        .select('id, created_at, raw_answer')
        .eq('brand_id', brandId)
        .gte('created_at', start)
        .lte('created_at', end);

    if (error) {
        console.error('Error fetching results:', error);
        return;
    }

    console.log(`   Found ${results?.length || 0} total results.`);

    let foundCount = 0;
    if (results) {
        for (const res of results) {
            if (res.raw_answer && res.raw_answer.toLowerCase().includes(searchTerm.toLowerCase())) {
                console.log(`   ✅ Found '${searchTerm}' in ID: ${res.id} (Created: ${res.created_at})`);
                foundCount++;
            }
        }
    }

    console.log(`\n   Summary: ${foundCount} out of ${results?.length} results contain '${searchTerm}'.`);
}

main();
