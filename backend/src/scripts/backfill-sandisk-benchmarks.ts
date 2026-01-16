
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function backfillSanDisk() {
    const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .ilike('name', '%SanDisk%')
        .single();

    if (!brand) {
        console.error('SanDisk brand not found');
        return;
    }

    console.log(`Fixing recommendations for Brand: ${brand.name} (${brand.id})`);

    // Specific values from the dashboard/KPIs for SanDisk
    const VIZ_FALLBACK = "29.2";
    const SOA_FALLBACK = "49.7";
    const SENT_FALLBACK = "75.1";

    const { data: recommendations } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, visibility_score, soa, sentiment, kpi_before_value')
        .eq('brand_id', brand.id)
        .eq('is_completed', true);

    if (!recommendations) return;

    for (const rec of recommendations) {
        let needsUpdate = false;
        const update: any = {};

        if (rec.visibility_score === "0" || rec.visibility_score === "0.00" || !rec.visibility_score) {
            update.visibility_score = rec.kpi_before_value ? String(rec.kpi_before_value) : VIZ_FALLBACK;
            needsUpdate = true;
        }
        if (rec.soa === "0" || rec.soa === "0.00" || !rec.soa) {
            update.soa = SOA_FALLBACK;
            needsUpdate = true;
        }
        if (rec.sentiment === "0" || rec.sentiment === "0.00" || !rec.sentiment) {
            update.sentiment = SENT_FALLBACK;
            needsUpdate = true;
        }

        if (needsUpdate) {
            console.log(`Updating rec: ${rec.action.substring(0, 30)}...`);
            console.log(`  New values: V:${update.visibility_score}, SOA:${update.soa}, S:${update.sentiment}`);
            const { error } = await supabaseAdmin
                .from('recommendations')
                .update(update)
                .eq('id', rec.id);

            if (error) console.error(`Error updating ${rec.id}:`, error);
        }
    }

    console.log('Backfill complete.');
}

backfillSanDisk();
