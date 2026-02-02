import { supabaseAdmin } from '../config/database';

async function backfillOnboardingFlag() {
    console.log('🚀 Starting backfill of onboarding_active flag...');

    try {
        // 1. Fetch all brands
        const { data: brands, error: fetchError } = await supabaseAdmin
            .from('brands')
            .select('id, metadata');

        if (fetchError) {
            throw fetchError;
        }

        if (!brands || brands.length === 0) {
            console.log('ℹ️ No brands found to backfill.');
            return;
        }

        console.log(`🔎 Found ${brands.length} brands to process.`);

        let updatedCount = 0;
        for (const brand of brands) {
            const metadata = brand.metadata || {};

            // We only need to set it to false if it's not already false (or missing)
            // Actually, setting it to false for everyone is safe.
            if (metadata.onboarding_active !== false) {
                const updatedMetadata = {
                    ...metadata,
                    onboarding_active: false
                };

                const { error: updateError } = await supabaseAdmin
                    .from('brands')
                    .update({ metadata: updatedMetadata })
                    .eq('id', brand.id);

                if (updateError) {
                    console.error(`❌ Failed to update brand ${brand.id}:`, updateError.message);
                } else {
                    updatedCount++;
                }
            }
        }

        console.log(`✅ Backfill complete. Updated ${updatedCount} brands.`);
    } catch (error) {
        console.error('❌ Backfill failed:', error);
    }
}

backfillOnboardingFlag();
