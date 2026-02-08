import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearPlanCache(recommendationId: string) {
    console.log(`🗑️  Deleting cached plan for recommendation: ${recommendationId}`);

    const { data, error } = await supabase
        .from('recommendation_generated_contents')
        .delete()
        .eq('recommendation_id', recommendationId)
        .eq('content_type', 'template_plan')
        .select();

    if (error) {
        console.error('❌ Error deleting cached plan:', error);
        process.exit(1);
    }

    console.log(`✅ Deleted ${data?.length || 0} cached plan(s)`);
    console.log('   Next "Generate Strategy" will create a fresh plan with all fields');
}

// Get recommendation ID from command line or use default
const recommendationId = process.argv[2] || '23d305ca-c17d-4561-85f6-86323b7a3e40';

clearPlanCache(recommendationId).then(() => {
    console.log('✨ Done!');
    process.exit(0);
});
