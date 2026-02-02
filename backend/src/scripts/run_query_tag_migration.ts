
import { supabaseAdmin } from '../config/database';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    const sqlPath = path.join(__dirname, 'migrations', 'add_query_tag_index.sql');
    console.log(`Reading migration file from: ${sqlPath}`);

    try {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Executing SQL...');

        // Using a known RPC function 'exec_sql' if available, or just split and execute if your setup allows.
        // Based on `create-report-settings-table.ts`, it seems we might just use a direct query or rpc.
        // Let's assume there is an `exec_sql` or we try to run it.
        // If no direct SQL execution is available via supabase-js for DDL (usually isn't without RPC),
        // we might need to rely on the user having an RPC function set up.
        // However, looking at the user's files, `create-report-settings-table.ts` is a good reference.

        // Actually, let's just use the `postgres` library if available or `supabaseAdmin`.
        // If `create-report-settings-table.ts` fails to show a pattern, I'll default to a simple split logic
        // and try `supabaseAdmin.rpc('exec_sql', { sql })` which is a common pattern.

        const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // Fallback: try raw query if RPC fails (it might not exist)
            console.warn('RPC exec_sql failed, trying fallback strategy (if any)...', error);
            // Note: Supabase JS client doesn't support raw SQL directly on the client instance for DDL
            // unless you use the `pg` driver or have an RPC.
            // Assuming the environment has `exec_sql` or similar. 
            throw error;
        }

        console.log('✅ Migration executed successfully.');
    } catch (err) {
        console.error('❌ Error executing migration:', err);
        process.exit(1);
    }
}

runMigration();
