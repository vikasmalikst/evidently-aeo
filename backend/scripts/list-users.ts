
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, role, customer_id')
    .limit(10);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log('Users found:', users);
}

listUsers();
