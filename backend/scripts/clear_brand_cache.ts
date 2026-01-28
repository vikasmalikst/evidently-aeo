
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const clearCache = async () => {
    const brandId = '5a5c6aa7-1e1b-41c6-bd6c-f36e1c96a699'; // Medable

    console.log(`Clearing cache for Brand: ${brandId}...`);

    const { error } = await supabase
        .from('source_attribution_snapshots')
        .delete()
        .eq('brand_id', brandId);

    if (error) {
        console.error('❌ Failed to clear cache:', error);
    } else {
        console.log('✅ Cache cleared successfully for brand.');
    }
};

clearCache();
