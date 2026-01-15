import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findBrandsWithRecs() {
    const { data, error } = await supabase
        .from('recommendations')
        .select('brand_id')
        .limit(100);

    if (error) {
        console.error(error);
        return;
    }

    const counts: Record<string, number> = {};
    data.forEach(r => {
        counts[r.brand_id] = (counts[r.brand_id] || 0) + 1;
    });

    console.log('Brands with recommendation counts:');
    console.log(JSON.stringify(counts, null, 2));
}

findBrandsWithRecs();
