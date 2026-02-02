
import { supabaseAdmin } from '../config/database';

async function checkCompetitorsTarget() {
    console.log('Checking latest recommendations for competitors_target field...');

    const { data: recommendations, error } = await supabaseAdmin
        .from('recommendations')
        .select('id, action, competitors_target, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching recommendations:', error);
        return;
    }

    console.log(`Found ${recommendations?.length} recommendations.`);
    recommendations?.forEach(rec => {
        console.log(`\nID: ${rec.id}`);
        console.log(`Action: ${rec.action.substring(0, 50)}...`);
        console.log(`Created At: ${rec.created_at}`);
        console.log(`Competitors Target:`, rec.competitors_target);
    });
}

checkCompetitorsTarget().catch(console.error);
