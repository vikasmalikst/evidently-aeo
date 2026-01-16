
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

async function checkSanDisk() {
    const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .ilike('name', '%SanDisk%')
        .single();

    if (!brand) {
        console.error('SanDisk brand not found');
        return;
    }

    console.log(`Brand: ${brand.name} (${brand.id})`);

    const { data: recommendations } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, is_completed, completed_at, visibility_score, soa, sentiment, kpi_before_value')
        .eq('brand_id', brand.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false });

    console.log('\nCompleted Recommendations:');
    recommendations?.forEach(rec => {
        console.log(`- ${rec.action.substring(0, 50)}...`);
        console.log(`  Completed: ${rec.completed_at}`);
        console.log(`  Benchmarked: V:${rec.visibility_score}, SOA:${rec.soa}, S:${rec.sentiment}, KPI_Before:${rec.kpi_before_value}`);
    });

    const { data: kpis } = await supabaseAdmin
        .from('recommendation_v3_kpis')
        .select('*')
        .eq('brand_id', brand.id)
        .order('display_order');

    console.log('\nStored KPIs for SanDisk:');
    kpis?.forEach(kpi => {
        console.log(`- ${kpi.kpi_name}: Current=${kpi.current_value}, Target=${kpi.target_value}`);
    });
}

checkSanDisk();
