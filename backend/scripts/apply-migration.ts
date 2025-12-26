
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20251226000000_add_scoring_tracking_columns.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Reading migration file: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration...');
  
  // Split by semicolon to run statements individually if needed, 
  // but Supabase RPC/SQL interface usually handles blocks.
  // However, supabase-js doesn't have a direct "query" method for raw SQL unless we use an RPC that executes SQL 
  // or if we use the postgres connection directly.
  // Since we don't have direct postgres access easily configured here (maybe), 
  // let's try to see if there is a 'exec_sql' rpc or similar, OR just use the pg driver if installed.
  
  // Checking package.json would be good, but let's try to assume we might not have 'pg' configured with connection string.
  // Wait, the project usually has a way to run migrations.
  // Let's look for existing migration scripts or database connection setup.
  
  // Actually, the user might have the `supabase` CLI installed.
  // Let's try running the SQL via a custom RPC if it exists, or check if we can use the `pg` library.
  
  // Let's try to use the `pg` library which is likely installed in a backend project.
  try {
    const { Client } = require('pg');
    
    // We need the connection string. It's usually in DATABASE_URL in .env
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL not found in .env. Cannot run migration via pg client.');
        process.exit(1);
    }
    
    const client = new Client({
        connectionString: connectionString,
    });
    
    await client.connect();
    console.log('Connected to database via pg client.');
    
    await client.query(sql);
    console.log('Migration executed successfully.');
    
    await client.end();
    
  } catch (err) {
      console.error('Failed to run migration:', err);
      process.exit(1);
  }
}

applyMigration();
