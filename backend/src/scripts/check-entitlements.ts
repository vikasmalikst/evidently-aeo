import { supabaseAdmin } from '../config/database';

async function checkEntitlements(customerId: string) {
    console.log(`Checking entitlements for customer: ${customerId}`);

    const { data: customer, error } = await supabaseAdmin
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

    if (error) {
        console.error('Error fetching customer:', error);
        return;
    }

    if (!customer) {
        console.log('Customer not found');
        return;
    }

    console.log('Customer Name:', customer.name);
    console.log('Settings:', JSON.stringify(customer.settings, null, 2));

    if (customer.settings?.entitlements) {
        console.log('Entitlements:', JSON.stringify(customer.settings.entitlements, null, 2));
        console.log('Enabled Collectors:', customer.settings.entitlements.enabled_collectors);
    } else {
        console.log('No entitlements found in settings');
    }
}

const customerId = '7f4635ff-2b2f-498f-a201-1a0c5540d660';
checkEntitlements(customerId).catch(console.error);
