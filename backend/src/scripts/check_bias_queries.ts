
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkBias() {
    console.log('Connecting to database...');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is not set in environment variables.');
        return;
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected!');

        const sql = `
            WITH tagged_queries AS (
                SELECT 
                    gq.query_text,
                    gq.brand_id,
                    CASE 
                        WHEN EXISTS (
                            SELECT 1 
                            FROM brand_products bp
                            CROSS JOIN jsonb_array_elements_text(
                                COALESCE(to_jsonb(bp.brand_synonyms), '[]'::jsonb) || 
                                COALESCE(to_jsonb(bp.brand_products), '[]'::jsonb)
                            ) AS terms(term)
                            WHERE bp.brand_id = gq.brand_id 
                              AND LENGTH(TRIM(terms.term)) > 0
                              AND gq.query_text ILIKE '%' || TRIM(terms.term) || '%'
                        ) THEN 'bias'
                        ELSE 'blind'
                    END AS query_tag
                FROM generated_queries gq
            )
            SELECT query_text, query_tag 
            FROM tagged_queries 
            WHERE query_tag = 'bias';
        `;

        console.log('Running query...');
        const res = await client.query(sql);
        
        console.log(`\nFound ${res.rows.length} biased queries:\n`);
        
        res.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.query_text}`);
        });

    } catch (err: any) {
        console.error('❌ Query failed:', err.message);
    } finally {
        await client.end();
    }
}

checkBias();
