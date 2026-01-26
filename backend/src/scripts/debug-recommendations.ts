
import { supabaseAdmin } from '../config/database';
import { brandService } from '../services/brand.service';

const BRAND_NAME = 'inSiderSports';

async function verifyRecommendations() {
    console.log(`Starting verification for brand: ${BRAND_NAME}`);

    try {
        // 1. Get Brand ID
        const { data: brands, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('id, name, customer_id') // Added customer_id
            .ilike('name', `%${BRAND_NAME}%`);

        if (brandError) {
            console.error('Error fetching brands:', brandError);
            return;
        }

        if (!brands || brands.length === 0) {
            console.error(`Brand '${BRAND_NAME}' not found.`);
            return;
        }

        console.log(`found brands: ${JSON.stringify(brands, null, 2)}`);
        const brand = brands[0];
        const brandId = brand.id;
        console.log(`Using Brand ID: ${brandId}`);
        console.log(`Brand Customer ID: ${brand.customer_id}`); // Log it

        // 2. Get Latest Generation
        const { data: generations, error: genError } = await supabaseAdmin
            .from('recommendation_generations')
            .select('*')
            .eq('brand_id', brandId)
            .order('generated_at', { ascending: false })
            .limit(1);

        if (genError) {
            console.error('Error fetching generations:', genError);
            return;
        }

        if (!generations || generations.length === 0) {
            console.error(`No generations found for brand ${brandId}.`);
            return;
        }

        const generation = generations[0];
        console.log(`Latest Generation found: ${JSON.stringify(generation, null, 2)}`);
        const generationId = generation.id;

        // 3. Get Recommendations for this generation
        const { data: recommendations, error: recError } = await supabaseAdmin
            .from('recommendations')
            .select('id, action, review_status, is_completed, is_approved, is_content_generated, customer_id') // Added customer_id
            .eq('generation_id', generationId);

        if (recError) {
            console.error('Error fetching recommendations:', recError);
            return;
        }

        console.log(`Found ${recommendations?.length || 0} recommendations for generation ${generationId}.`);

        if (recommendations && recommendations.length > 0) {
            console.log('Sample recommendations:');
            recommendations.slice(0, 3).forEach(rec => {
                console.log(rec);
                if (rec.customer_id !== brand.customer_id) {
                    console.warn(`⚠️ MISMATCH: Recommendation customer_id (${rec.customer_id}) != Brand customer_id (${brand.customer_id})`);
                }
            });

            // Analyze counts by status (Step 1 logic)
            // Step 1: All non-completed recommendations (is_completed = false)
            const step1Recs = recommendations.filter(r => !r.is_completed);
            console.log(`Step 1 Recommendations (is_completed=false): ${step1Recs.length}`);

            // Check filtering scenarios
            const pending = step1Recs.filter(r => r.review_status === 'pending_review');
            const approved = step1Recs.filter(r => r.review_status === 'approved');
            const rejected = step1Recs.filter(r => r.review_status === 'rejected');

            console.log(`Breakdown: Pending=${pending.length}, Approved=${approved.length}, Rejected=${rejected.length}`);
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

verifyRecommendations();
