
import { supabaseAdmin } from '../config/database';

async function main() {
    const brandId = '0fa491bf-3b62-45a3-b498-8241b6bf689d';
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startIso = sevenDaysAgo.toISOString();

    console.log(`Checking activity for Brand ID: ${brandId}`);
    console.log(`Since: ${startIso}`);

    // 1. Check Recommendations
    const { count: recCount, error: recError } = await supabaseAdmin
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startIso);

    if (recError) console.error('Error fetching recs:', recError);
    else console.log(`Recommendations created in last 7 days: ${recCount}`);

    // 2. Check Generations (in case recs weren't created but generation was attempted)
    const { count: genCount, error: genError } = await supabaseAdmin
        .from('recommendation_generations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startIso);

    if (genError) console.error('Error fetching generations:', genError);
    else console.log(`Recommendation GENERATIONS created in last 7 days: ${genCount}`);

    // 3. Get total rec count
    const { count: totalRecs } = await supabaseAdmin
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId);
    console.log(`Total active recommendations in DB: ${totalRecs}`);
}

main().catch(console.error);
