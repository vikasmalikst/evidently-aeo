
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
    console.log('--- Diagnostic Start ---');

    // 1. Find the admin user vmalik9
    const { data: admin, error: adminError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', 'vmalik9@gmail.com')
        .single();

    if (adminError) console.error('Error finding admin:', adminError);
    else console.log('Admin User:', { id: admin.id, email: admin.email, access_level: admin.access_level, role: admin.role });

    // 2. Find the target customer
    const targetEmail = 'insidersports@evidentlyaeo.com';
    const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('email', targetEmail) // Try exact match first
        .single();

    if (customerError) {
        console.error(`Error finding customer ${targetEmail}:`, customerError);
        // Try LIKE query
        const { data: potentialMatches } = await supabase
            .from('customers')
            .select('id, email, name')
            .ilike('email', '%insidersports%');
        console.log('Potential matches:', potentialMatches);
        return;
    }

    console.log('Found Customer:', { id: customer.id, name: customer.name, email: customer.email });

    // 3. Find brands for this customer
    const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('customer_id', customer.id);

    if (brandsError) {
        console.error('Error fetching brands:', brandsError);
    } else {
        console.log(`Brands found (${brands.length}):`);
        brands.forEach(b => console.log(` - ${b.name} (ID: ${b.id}, Status: ${b.status})`));
    }

    // 4. Check if brands exist for ANY customer with similar name?
    if (brands.length === 0) {
        console.log('Checking if any brands exist with vaguely similar customer IDs?');
    }

    console.log('--- Diagnostic End ---');
}

diagnose();
