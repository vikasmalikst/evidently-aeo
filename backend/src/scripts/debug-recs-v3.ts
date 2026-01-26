
import { supabaseAdmin } from '../config/database';

async function main() {
    console.log('Scanning brands for generations with Visibility data...');
    const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .limit(20);

    if (!brands) return;

    for (const brand of brands) {
        const { data: gen } = await supabaseAdmin
            .from('recommendation_generations')
            .select('id, generated_at')
            .eq('brand_id', brand.id)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

        if (!gen) continue;

        // Check for visibility_score NOT null
        const { data: recs } = await supabaseAdmin
            .from('recommendations')
            .select('sentiment, visibility_score')
            .eq('generation_id', gen.id)
            .not('visibility_score', 'is', null)
            .limit(1);

        if (recs && recs.length > 0) {
            console.log(`\nFOUND Visibility Data for Brand: ${brand.name} (${brand.id})`);
            console.log(`Generation ID: ${gen.id}`);
            console.log('Sample Visibility:', recs[0].visibility_score);
            console.log('Sample Sentiment:', recs[0].sentiment);

            await checkBrand(gen.id);
            return;
        }
    }
    console.log('No brands found with populated visibility data.');
}

async function checkBrand(genId: string) {
    // Fetch KPIs
    const { data: kpis } = await supabaseAdmin
        .from('recommendation_v3_kpis')
        .select('*')
        .eq('generation_id', genId);

    console.log('\n--- KPI Definitions ---');
    console.table(kpis?.map(k => ({
        name: k.kpi_name,
        current: k.current_value,
    })));

    // Check Recommendations with source
    const { data: allRecs } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, citation_source, sentiment, visibility_score, soa')
        .eq('generation_id', genId)
        .not('citation_source', 'is', null)
        .not('visibility_score', 'is', null)
        .limit(20);

    console.log('\n--- Sample of Recommendations with Visibility ---');
    console.table(allRecs?.map(r => ({
        action: r.action.substring(0, 30),
        source: r.citation_source,
        sentiment: r.sentiment,
        vis: r.visibility_score,
        soa: r.soa
    })));
}

main().catch(console.error);
