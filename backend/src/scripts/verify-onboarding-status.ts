
import { brandService } from '../services/brand.service';
import { supabaseAdmin } from '../config/database';

async function verify() {
    console.log('🔍 Finding a brand to test...');

    const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id, name')
        .limit(1);

    if (!brands || brands.length === 0) {
        console.log('❌ No brands found to test.');
        return;
    }

    const brand = brands[0];
    console.log(`✅ Found brand: ${brand.name} (${brand.id})`);

    console.log('🔄 Checking onboarding status...');
    const status = await brandService.getOnboardingStatus(brand.id);

    console.log('📊 Status Result:', JSON.stringify(status, null, 2));
}

verify().catch(console.error).finally(() => process.exit(0));
