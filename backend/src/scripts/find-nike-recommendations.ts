
import { supabaseAdmin } from '../config/database';

async function main() {
    console.log('Searching for Nike...');
    const { data: brands, error } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .ilike('name', '%Nike%');

    if (error) {
        console.error('Error fetching brands:', error);
        return;
    }

    if (!brands || brands.length === 0) {
        console.log('No brand found matching "Nike".');
        return;
    }

    const nike = brands[0];
    console.log(`Found Brand: ${nike.name} (ID: ${nike.id})`);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startIso = sevenDaysAgo.toISOString();

    console.log(`Checking recommendations created since ${startIso}...`);

    const { data: recs, error: recError } = await supabaseAdmin
        .from('recommendations')
        .select('id, created_at, action, review_status, is_approved, is_content_generated, is_completed')
        .eq('brand_id', nike.id)
        .gte('created_at', startIso);

    if (recError) {
        console.error('Error fetching recommendations:', recError);
        return;
    }

    console.log(`Found ${recs?.length || 0} recommendations created in the last 7 days.`);

    if (recs && recs.length > 0) {
        console.log('Sample recommendations:');
        recs.slice(0, 3).forEach(r => console.log(`- [${r.created_at}] ${r.action} (Status: ${r.review_status}, Approved: ${r.is_approved})`));

        // Count distribution
        const approved = recs.filter(r => r.is_approved).length;
        const generated = recs.length;
        console.log(`Breakdown (Last 7 Days):`);
        console.log(`- Generated: ${generated}`);
        console.log(`- Approved: ${approved}`);
    } else {
        console.log('Checking TOTAL recommendations (all time) to verify existence...');
        const { count, error: countError } = await supabaseAdmin
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', nike.id);

        console.log(`Total recommendations in DB for Nike: ${count} (Error: ${countError?.message})`);
    }
}

main().catch(console.error);
