
import { supabaseAdmin } from '../config/database';

async function main() {
    const brandId = '0fa491bf-3b62-45a3-b498-8241b6bf689d'; // The one with 79 recs
    console.log(`Checking timestamps for Brand ID: ${brandId}`);

    const { data: recs, error } = await supabaseAdmin
        .from('recommendations')
        .select('id, created_at, action, review_status')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false }) // Newest first
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Most recent recommendations:');
    recs?.forEach(r => console.log(`- ${r.created_at} | ${r.review_status} | ${r.action.substring(0, 30)}...`));

    // Check against 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log(`Target date (7 days ago): ${sevenDaysAgo.toISOString()}`);
}

main().catch(console.error);
