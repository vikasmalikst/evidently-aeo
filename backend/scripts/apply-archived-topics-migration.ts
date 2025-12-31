import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;

async function applyMigration() {
  const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20251230000000_create_archived_topics_prompts.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  console.log(`Reading migration file: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  if (!dbUrl) {
      console.error('DATABASE_URL not found. Cannot apply migration via pg.');
      process.exit(1);
  }

  console.log('Applying migration via pg client...');
  const client = new Client({
      connectionString: dbUrl,
  });

  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration executed successfully.');
  } catch (err) {
      console.error('Failed to run migration:', err);
      process.exit(1);
  } finally {
      await client.end();
  }
}

applyMigration();
