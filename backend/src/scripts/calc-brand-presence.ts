import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Construct path to .env file
const envPath = '/Users/avayasharma/evidently-aeo/backend/.env';
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function calculateBrandPresence(brandId: string) {
    console.log(`\n📊 Calculating Brand Presence for Brand ID: ${brandId}\n`);

    // 1. Get Total Count (Denominator)
    const { count: totalCount, error: totalError } = await supabase
        .from('metric_facts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId);

    if (totalError) {
        console.error('Error fetching total count:', totalError);
        return;
    }

    // 2. Get Presence Count (Numerator)
    // Join metric_facts -> brand_metrics and filter by has_brand_presence = true
    const { count: presenceCount, error: presenceError } = await supabase
        .from('metric_facts')
        .select('brand_metrics!inner(has_brand_presence)', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('brand_metrics.has_brand_presence', true);

    if (presenceError) {
        console.error('Error fetching presence count:', presenceError);
        // Try alternative query if the inner join syntax is tricky with head:true
        // But typically supabase supports this.
        return;
    }

    console.log(`--------------------------------------------------`);
    console.log(`Total Scored Results (Denominator):    ${totalCount}`);
    console.log(`Results with Brand Presence (Numerator): ${presenceCount}`);
    console.log(`--------------------------------------------------`);

    if (totalCount === 0) {
        console.log(`Brand Presence: 0% (No data)`);
    } else {
        const presencePercentage = ((presenceCount || 0) / totalCount) * 100;
        console.log(`Brand Presence: ${presencePercentage.toFixed(2)}%`);
    }
    console.log(`--------------------------------------------------`);

    // Optional: Last 7 Days Calculation
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isoDate = sevenDaysAgo.toISOString();

    const { count: totalCount7d } = await supabase
        .from('metric_facts')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('processed_at', isoDate);

    const { count: presenceCount7d } = await supabase
        .from('metric_facts')
        .select('brand_metrics!inner(has_brand_presence)', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('brand_metrics.has_brand_presence', true)
        .gte('processed_at', isoDate);

    if (totalCount7d !== null && presenceCount7d !== null) {
        const pct7d = totalCount7d > 0 ? (presenceCount7d / totalCount7d) * 100 : 0;
        console.log(`\n📅 Last 7 Days:`);
        console.log(`Total: ${totalCount7d}, Present: ${presenceCount7d}`);
        console.log(`Brand Presence (7d): ${pct7d.toFixed(2)}%`);
    }

    // 3. Query-Level Brand Presence (Dashboard Logic)
    console.log(`\n📊 Dashboard Logic (Query-Level Presence):`);

    // Get all unique queries for this brand
    const { data: allQueries, error: queriesError } = await supabase
        .from('metric_facts')
        .select('query_id')
        .eq('brand_id', brandId);

    if (queriesError || !allQueries) {
        console.error('Error fetching queries:', queriesError);
        return;
    }

    const totalUniqueQueries = new Set(allQueries.map(q => q.query_id)).size;

    // Get unique queries where brand presence is true
    const { data: presenceQueries, error: presenceQueriesError } = await supabase
        .from('metric_facts')
        .select('query_id, brand_metrics!inner(has_brand_presence)')
        .eq('brand_id', brandId)
        .eq('brand_metrics.has_brand_presence', true);

    if (presenceQueriesError || !presenceQueries) {
        console.error('Error fetching presence queries:', presenceQueriesError);
        return;
    }

    const uniqueQueriesWithPresence = new Set(presenceQueries.map(q => q.query_id)).size;

    console.log(`Total Unique Queries: ${totalUniqueQueries}`);
    console.log(`Unique Queries with Presence: ${uniqueQueriesWithPresence}`);

    if (totalUniqueQueries > 0) {
        const queryPresencePct = (uniqueQueriesWithPresence / totalUniqueQueries) * 100;
        console.log(`Query-Level Brand Presence: ${queryPresencePct.toFixed(2)}%`);
    } else {
        console.log(`Query-Level Brand Presence: 0%`);
    }

    // 4. Last 7 Days Query-Level
    console.log(`\n📅 Last 7 Days (Query-Level):`);

    const { data: allQueries7d } = await supabase
        .from('metric_facts')
        .select('query_id')
        .eq('brand_id', brandId)
        .gte('processed_at', isoDate);

    const { data: presenceQueries7d } = await supabase
        .from('metric_facts')
        .select('query_id, brand_metrics!inner(has_brand_presence)')
        .eq('brand_id', brandId)
        .eq('brand_metrics.has_brand_presence', true)
        .gte('processed_at', isoDate);

    if (allQueries7d && presenceQueries7d) {
        const totalUniqueQueries7d = new Set(allQueries7d.map(q => q.query_id)).size;
        const uniqueQueriesWithPresence7d = new Set(presenceQueries7d.map(q => q.query_id)).size;

        console.log(`Total Unique Queries (7d): ${totalUniqueQueries7d}`);
        console.log(`Unique Queries with Presence (7d): ${uniqueQueriesWithPresence7d}`);

        if (totalUniqueQueries7d > 0) {
            const queryPresencePct7d = (uniqueQueriesWithPresence7d / totalUniqueQueries7d) * 100;
            console.log(`Query-Level Brand Presence (7d): ${queryPresencePct7d.toFixed(2)}%`);
        }
    }
}

calculateBrandPresence('5ce3fc1c-24c6-4434-a76e-72ad159030e9');
