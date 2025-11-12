import { createClient } from '@supabase/supabase-js';
import { config } from './environment';

// Create Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Create Supabase client for admin operations
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
