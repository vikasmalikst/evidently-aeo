
import { supabaseAdmin } from '../config/database';

async function main() {
    const brandId = '0fa491bf-3b62-45a3-b498-8241b6bf689d';
    console.log(`Checking pipeline consistency for Brand ID: ${brandId}`);

    const { data: recs, error } = await supabaseAdmin
        .from('recommendations')
        .select('*')
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!recs || recs.length === 0) {
        console.log('No recommendations found.');
        return;
    }

    const total = recs.length;
    const approved = recs.filter(r => r.is_approved === true || r.review_status === 'approved').length;
    const content = recs.filter(r => r.is_content_generated === true).length;
    const implemented = recs.filter(r => r.is_completed === true).length;

    // Check consistency
    const inconsistentContent = recs.filter(r => r.is_content_generated && !r.is_approved);
    const inconsistentCompleted = recs.filter(r => r.is_completed && !r.is_content_generated);

    console.log(`\nPipeline Counts:`);
    console.log(`- Generated (Total): ${total}`);
    console.log(`- Approved: ${approved} (${(approved / total * 100).toFixed(1)}%)`);
    console.log(`- Content Generated: ${content}`);
    console.log(`- Implemented: ${implemented}`);

    console.log(`\nConsistency Checks:`);
    console.log(`- Content generated but NOT approved: ${inconsistentContent.length}`);
    if (inconsistentContent.length > 0) {
        inconsistentContent.forEach(r => console.log(`  > ID: ${r.id} (${r.action.substring(0, 20)}...)`));
    }

    console.log(`- Completed but NO content generated: ${inconsistentCompleted.length}`);
    if (inconsistentCompleted.length > 0) {
        inconsistentCompleted.forEach(r => console.log(`  > ID: ${r.id} (${r.action.substring(0, 20)}...)`));
    }
}

main().catch(console.error);
