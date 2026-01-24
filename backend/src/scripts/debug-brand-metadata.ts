
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBrandMetadata() {
    console.log('Fetching brand metadata for "Atlassian Jira"...');

    const { data: brands, error } = await supabase
        .from('brands')
        .select('id, name, metadata, customer_id')
        .ilike('name', '%Atlassian Jira%');

    if (error) {
        console.error('Error fetching brands:', error);
        return;
    }

    if (!brands || brands.length === 0) {
        console.log('No brand found matching "Atlassian Jira"');
        return;
    }

    for (const brand of brands) {
        console.log(`\nBrand: ${brand.name} (${brand.id})`);
        console.log('Metadata:', JSON.stringify(brand.metadata, null, 2));

        const metadata = brand.metadata as any;
        if (metadata?.ai_models) {
            console.log('ai_models type:', typeof metadata.ai_models);
            console.log('ai_models value:', metadata.ai_models);
        } else {
            console.log('ai_models is undefined or null');
        }

        if (brand.customer_id) {
            console.log(`\nFetching entitlements for customer ${brand.customer_id}...`);
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('settings')
                .eq('id', brand.customer_id)
                .single();

            if (customerError) {
                console.error('Error fetching customer:', customerError);
                // If error is code PGRST116 (0 rows), user might not exist or be deleted?
            } else {
                console.log('Customer Settings:', JSON.stringify(customer.settings, null, 2));
                const entitlements = (customer.settings as any)?.entitlements;
                console.log('Enabled Collectors:', entitlements?.enabled_collectors);
            }
        } else {
            console.log('Brand has no customer_id!');
        }
    }
}

checkBrandMetadata();
