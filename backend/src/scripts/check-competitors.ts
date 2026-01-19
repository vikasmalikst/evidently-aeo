
import { supabaseAdmin } from '../config/database';

async function checkCompetitors(brandId: string) {
    console.log(`Checking competitors for brand: ${brandId}`);

    const { data, error } = await supabaseAdmin
        .from('brand_competitors')
        .select('*')
        .eq('brand_id', brandId);

    if (error) {
        console.error('Error fetching competitors:', error);
        return;
    }

    console.log('Competitors found:', data?.length);
    if (data && data.length > 0) {
        data.forEach(c => console.log(`- ${c.competitor_name}`));
    } else {
        console.log('No competitors defined for this brand.');
    }
}

// Brand ID provided by user
checkCompetitors('583be119-67da-47bb-8a29-2950eb4da3ea');
