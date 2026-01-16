
import { supabaseAdmin } from '../config/database';

async function checkSanDiskKPIs() {
    console.log('🔍 Checking SanDisk KPI data...');

    // 1. Find SanDisk brand
    const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .ilike('name', '%SanDisk%')
        .single();

    if (brandError || !brand) {
        console.error('❌ SanDisk brand not found');
        return;
    }

    console.log(`✅ Found Brand: ${brand.name} (${brand.id})`);

    // 2. Find latest generation for this brand
    const { data: generation, error: genError } = await supabaseAdmin
        .from('recommendation_generations')
        .select('*')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (genError || !generation) {
        console.error('❌ No generation found for SanDisk');
        return;
    }

    console.log(`✅ Found Latest Generation: ${generation.id} (${generation.created_at})`);

    // 3. Check KPIs for this generation
    const { data: kpis, error: kpisError } = await supabaseAdmin
        .from('recommendation_v3_kpis')
        .select('*')
        .eq('generation_id', generation.id);

    if (kpisError) {
        console.error('❌ Error fetching KPIs:', kpisError);
    } else {
        console.log(`📊 Found ${kpis?.length || 0} KPIs:`);
        kpis?.forEach(k => {
            console.log(`   - [${k.id}] ${k.kpi_name}: Current=${k.current_value}, Target=${k.target_value}`);
        });
    }

    // 4. Check Recommendations for this generation
    const { data: recs, error: recsError } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, review_status, visibility_score, soa, sentiment, is_completed')
        .eq('generation_id', generation.id);

    if (recsError) {
        console.error('❌ Error fetching recommendations:', recsError);
    } else {
        console.log(`📝 Found ${recs?.length || 0} Recommendations:`);
        recs?.forEach(r => {
            console.log(`   - [${r.id}] ${r.action.substring(0, 50)}...`);
            console.log(`     Status: ${r.review_status}, Completed: ${r.is_completed}`);
            console.log(`     Metrics: Visibility=${r.visibility_score}, SOA=${r.soa}, Sentiment=${r.sentiment}`);
        });
    }
}

checkSanDiskKPIs().catch(console.error);
