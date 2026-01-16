
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkMetadata() {
    console.log('Checking brand_competitors metadata...');

    const { data, error } = await supabase
        .from('brand_competitors')
        .select('id, brand_id, competitor_name, metadata')
        .limit(10);

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    console.log('Found', data.length, 'rows');
    data.forEach(row => {
        console.log(`Competitor: ${row.competitor_name}`);
        console.log(`Metadata:`, row.metadata);
        console.log('---');
    });
}

checkMetadata();
