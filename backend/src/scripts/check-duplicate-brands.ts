
import { supabaseAdmin } from '../config/database';

async function main() {
    console.log('Searching for ALL brands matching "Nike"...');
    const { data: brands, error } = await supabaseAdmin
        .from('brands')
        .select('id, name, created_at')
        .ilike('name', '%Nike%');

    if (error) {
        console.error('Error fetching brands:', error);
        return;
    }

    console.log(`Found ${brands?.length} brands matching "Nike":`);
    brands?.forEach(b => console.log(`- ${b.name} (ID: ${b.id}, Created: ${b.created_at})`));

    // For each found brand, check recommendation count
    for (const b of brands || []) {
        const { count } = await supabaseAdmin
            .from('recommendations')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', b.id);
        console.log(`  > Recommendations for ID ${b.id}: ${count}`);
    }
}

main().catch(console.error);
