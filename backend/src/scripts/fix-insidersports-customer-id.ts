
import { supabaseAdmin } from '../config/database';

const BRAND_NAME = 'inSiderSports';

async function migrateCustomerData() {
    console.log(`Starting data migration for brand: ${BRAND_NAME}`);

    try {
        // 1. Get Correct Brand and Customer ID
        const { data: brands, error: brandError } = await supabaseAdmin
            .from('brands')
            .select('id, name, customer_id')
            .ilike('name', `%${BRAND_NAME}%`);

        if (brandError) {
            console.error('Error fetching brands:', brandError);
            return;
        }

        if (!brands || brands.length === 0) {
            console.error(`Brand '${BRAND_NAME}' not found.`);
            return;
        }

        const brand = brands[0];
        const brandId = brand.id;
        const correctCustomerId = brand.customer_id;

        console.log(`Target Brand: ${brand.name}`);
        console.log(`Brand ID: ${brandId}`);
        console.log(`Correct Customer ID: ${correctCustomerId}`);

        // 2. Find Recommendation Generations with WRONG Customer ID
        const { data: generations, error: genError } = await supabaseAdmin
            .from('recommendation_generations')
            .select('id, customer_id, generated_at')
            .eq('brand_id', brandId)
            .neq('customer_id', correctCustomerId);

        if (genError) {
            console.error('Error fetching generations:', genError);
            return;
        }

        if (!generations || generations.length === 0) {
            console.log('No generations found with incorrect customer_id. Migration might have already run or is not needed.');
            return;
        }

        console.log(`Found ${generations.length} generations with incorrect customer_id.`);
        const generationIds = generations.map(g => g.id);

        // 3. Update TABLE: recommendation_generations
        console.log(`Updating ${generationIds.length} generations...`);
        const { error: updateGenError } = await supabaseAdmin
            .from('recommendation_generations')
            .update({ customer_id: correctCustomerId })
            .in('id', generationIds);

        if (updateGenError) {
            console.error('Failed to update recommendation_generations:', updateGenError);
            return;
        }
        console.log('✅ Updated recommendation_generations');

        // 4. Update TABLE: recommendations
        console.log('Updating recommendations linked to these generations...');
        const { error: updateRecError } = await supabaseAdmin
            .from('recommendations')
            .update({ customer_id: correctCustomerId })
            .in('generation_id', generationIds);

        if (updateRecError) {
            console.error('Failed to update recommendations:', updateRecError);
            return;
        }
        console.log('✅ Updated recommendations');

        // 5. Update TABLE: recommendation_v3_kpis
        console.log('Updating KPIs linked to these generations...');
        const { error: updateKpiError } = await supabaseAdmin
            .from('recommendation_v3_kpis')
            .update({ customer_id: correctCustomerId })
            .in('generation_id', generationIds);

        if (updateKpiError) {
            console.error('Failed to update recommendation_v3_kpis:', updateKpiError);
            // Continue, as this might be empty
        } else {
            console.log('✅ Updated recommendation_v3_kpis');
        }

        // 6. Update TABLE: recommendation_generated_contents
        console.log('Updating generated content linked to these generations...');
        const { error: updateContentError } = await supabaseAdmin
            .from('recommendation_generated_contents')
            .update({ customer_id: correctCustomerId })
            .in('generation_id', generationIds);

        if (updateContentError) {
            console.error('Failed to update recommendation_generated_contents:', updateContentError);
            // Continue
        } else {
            console.log('✅ Updated recommendation_generated_contents');
        }

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('Unexpected error during migration:', error);
    }
}

migrateCustomerData();
