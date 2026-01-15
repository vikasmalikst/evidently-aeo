
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

// Config
const REFERENCE_DATE = '2026-01-14'; // End of "Current"
// Prior Period: Jan 1 - Jan 7
const PRIOR_START = '2026-01-01T00:00:00Z';
const PRIOR_END = '2026-01-07T23:59:59Z';

async function debugDateMismatch() {
    console.log('🔍 Debugging Date Mismatch for Nike...');

    // 1. Get Brand
    const { data: brands } = await supabase.from('brands').select('id, name').ilike('name', '%Nike%');
    let brand = null;
    let maxCitations = -1;
    for (const b of (brands || [])) {
        const { count } = await supabase.from('citations').select('*', { count: 'exact', head: true }).eq('brand_id', b.id);
        if ((count || 0) > maxCitations) {
            maxCitations = count || 0;
            brand = b;
        }
    }

    if (!brand) { console.error('Brand not found'); return; }
    console.log(`✅ Brand: ${brand.name} (${brand.id})`);

    // 2. Fetch Citations for Prior Period
    const { data: citations } = await supabase
        .from('citations')
        .select('collector_result_id, created_at')
        .eq('brand_id', brand.id)
        .gte('created_at', PRIOR_START)
        .lte('created_at', PRIOR_END);

    if (!citations || citations.length === 0) {
        console.log('❌ No citations found in Prior Period (Jan 1-7). Checks user assumption.');
        return;
    }

    const ids = citations.map(c => c.collector_result_id).filter(id => id);
    const distinctIds = [...new Set(ids)];
    console.log(`✅ Found ${citations.length} citations (${distinctIds.length} unique collector IDs) in Prior Period.`);
    console.log(`Samples: ${JSON.stringify(citations.slice(0, 3))}`);

    // 3. Query Metric Facts WITHOUT Date Filter
    const { data: metricsNoDate, error: err1 } = await supabase
        .from('metric_facts')
        .select('collector_result_id, processed_at')
        .in('collector_result_id', distinctIds)
        .eq('brand_id', brand.id);

    console.log(`\n--- Metric Facts Check ---`);
    if (err1) console.error('Error query 1:', err1);
    const foundNoDate = metricsNoDate?.length || 0;
    console.log(`Query WITHOUT Date Filter found: ${foundNoDate} rows.`);

    // 4. Query Metric Facts WITH Date Filter (Simulating Helper)
    const { data: metricsWithDate, error: err2 } = await supabase
        .from('metric_facts')
        .select('collector_result_id, processed_at')
        .in('collector_result_id', distinctIds)
        .eq('brand_id', brand.id)
        .gte('processed_at', PRIOR_START)
        .lte('processed_at', PRIOR_END);

    if (err2) console.error('Error query 2:', err2);
    const foundWithDate = metricsWithDate?.length || 0;
    console.log(`Query WITH Date Filter found:    ${foundWithDate} rows.`);

    const diff = foundNoDate - foundWithDate;
    console.log(`\n📉 Dropped Rows: ${diff}`);

    if (diff > 0 && metricsNoDate) {
        console.log('Inspecting dropped rows (Processed At dates):');
        const includedIds = new Set(metricsWithDate?.map(m => m.collector_result_id));
        const dropped = metricsNoDate.filter(m => !includedIds.has(m.collector_result_id));

        dropped.slice(0, 5).forEach(m => {
            console.log(` - ID ${m.collector_result_id}: processed_at=${m.processed_at} (Outside ${PRIOR_START} - ${PRIOR_END}?)`);
        });
    }
}

debugDateMismatch().catch(console.error);
