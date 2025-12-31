import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function check() {
  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, name, customer_id')
    .eq('customer_id', '123e4567-e89b-12d3-a456-426614174001');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Brands for Dev Customer:', JSON.stringify(brands, null, 2));
  }
  process.exit(0);
}
check();
