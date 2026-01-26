
/**
 * Disable Ollama Script
 * 
 * Disables Ollama for a specific brand in the database.
 * 
 * Usage:
 *   npx ts-node backend/src/scripts/disable-ollama.ts [BRAND_ID]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function disableOllama(brandId: string) {
    console.log(`\n🚫 Disabling Ollama for Brand ID: ${brandId}\n`);

    const { data: brand, error: fetchError } = await supabase
        .from('brands')
        .select('local_llm')
        .eq('id', brandId)
        .single();

    if (fetchError) {
        console.error('❌ Error fetching brand:', fetchError.message);
        return;
    }

    const currentConfig = brand.local_llm || {};
    console.log('Current Config:', JSON.stringify(currentConfig, null, 2));

    if (!currentConfig.useOllama) {
        console.log('✅ Ollama is already disabled.');
        return;
    }

    const newConfig = { ...currentConfig, useOllama: false };

    const { error: updateError } = await supabase
        .from('brands')
        .update({ local_llm: newConfig })
        .eq('id', brandId);

    if (updateError) {
        console.error('❌ Error updating brand:', updateError.message);
    } else {
        console.log('✅ Successfully disabled Ollama.');
    }
}

const targetBrandId = process.argv[2] || '5a57c430-6940-4198-a1f5-a443cbd044dc';
disableOllama(targetBrandId);
