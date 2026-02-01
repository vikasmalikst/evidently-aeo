
import { supabaseAdmin } from '../config/database';

async function checkCounts() {
    console.log('Checking table counts...');
    
    const { count: queriesCount, error: error1 } = await supabaseAdmin
        .from('generated_queries')
        .select('*', { count: 'exact', head: true });
        
    if (error1) console.error('Error fetching generated_queries count:', error1);
    else console.log(`generated_queries count: ${queriesCount}`);

    const { count: brandsCount, error: error2 } = await supabaseAdmin
        .from('brand_products')
        .select('*', { count: 'exact', head: true });

    if (error2) console.error('Error fetching brand_products count:', error2);
    else console.log(`brand_products count: ${brandsCount}`);
}

checkCounts();
