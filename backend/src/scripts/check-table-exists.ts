
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('backfill_history')
        .select('count', { count: 'exact', head: true });

    if (error) {
        if (error.code === '42P01') { // undefined_table
            console.log('TABLE_MISSING');
        } else {
            console.error('ERROR:', error);
        }
    } else {
        console.log('TABLE_EXISTS');
    }
}

main();
