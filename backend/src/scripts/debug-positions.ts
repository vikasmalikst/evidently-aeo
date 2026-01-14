
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPositions() {
    console.log('--- Checking Brand Metrics Positions ---');
    const { data: brandMetrics, error: brandError } = await supabase
        .from('brand_metrics')
        .select('brand_positions')
        .not('brand_positions', 'is', null)
        .limit(5);

    if (brandError) console.error('Brand Error:', brandError);
    else {
        brandMetrics.forEach((m, i) => {
            console.log(`Row ${i}:`, m.brand_positions, typeof m.brand_positions, Array.isArray(m.brand_positions) ? 'is Array' : 'not Array');
        });
    }

    console.log('\n--- Checking Competitor Metrics Positions ---');
    const { data: compMetrics, error: compError } = await supabase
        .from('competitor_metrics')
        .select('competitor_positions')
        .not('competitor_positions', 'is', null)
        .limit(5);

    if (compError) console.error('Comp Error:', compError);
    else {
        compMetrics.forEach((m, i) => {
            console.log(`Row ${i}:`, m.competitor_positions, typeof m.competitor_positions, Array.isArray(m.competitor_positions) ? 'is Array' : 'not Array');
        });
    }
}

checkPositions();
