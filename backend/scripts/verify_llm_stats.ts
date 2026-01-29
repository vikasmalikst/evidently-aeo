
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
// Assuming script is in backend/scripts/ and .env is in backend/
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const verify = async () => {
    const brandId = '5a5c6aa7-1e1b-41c6-bd6c-f36e1c96a699';
    const startDate = '2026-01-26T00:00:00.000Z'; // Last 2-3 days from 2026-01-28
    const endDate = '2026-01-28T23:59:59.999Z';
    const collectorType = 'chatgpt';

    // 0. Verify Brand Name
    const { data: brand } = await supabase.from('brands').select('name').eq('id', brandId).single();
    console.log(`Verifying for Brand: ${brand?.name} (${brandId})`);
    console.log(`Date Range: ${startDate} - ${endDate}`);
    console.log(`Input Collector: ${collectorType}`);

    // Resolve collector type (Same logic as SourceAttributionService)
    const mapping: Record<string, string[]> = {
        'chatgpt': ['ChatGPT'],
        'perplexity': ['Perplexity'],
        'claude': ['Claude'],
        'google_aio': ['Google AIO', 'Google SGE'],
        'copilot': ['Bing Copilot', 'Copilot'],
        'meta': ['Meta AI', 'Llama'],
        'gemini': ['Gemini'],
        'grok': ['Grok']
    };

    const key = collectorType.toLowerCase().trim();
    const resolvedTypes = mapping[key] || [collectorType];
    console.log(`Resolved Collector Types: ${resolvedTypes.join(', ')}`);

    // 1. Get valid collector result IDs for RESOLVED types
    const { data: facts, error: factsError } = await supabase
        .from('metric_facts')
        .select('collector_result_id')
        .eq('brand_id', brandId)
        .in('collector_type', resolvedTypes)
        .gte('processed_at', startDate)
        .lte('processed_at', endDate);

    if (factsError) {
        console.error('Error fetching facts:', factsError);
        return;
    }

    const validIds = facts.map(f => f.collector_result_id);
    console.log(`Found ${validIds.length} valid collector result IDs for resolved types.`);

    if (validIds.length === 0) {
        console.log('No data found for this period for ANY collector.');
        return;
    }

    // 2. Fetch citations for these valid IDs
    // Citations usually created_at ~ processed_at
    const { data: citations, error: citationsError } = await supabase
        .from('citations')
        .select('domain, usage_count, collector_result_id')
        .eq('brand_id', brandId)
        .in('collector_result_id', validIds)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

    if (citationsError) {
        console.error('Error fetching citations:', citationsError);
        return;
    }

    // 3. Aggregate
    const domainStats = new Map<string, number>();
    let totalCitations = 0;

    citations.forEach(c => {
        const domain = c.domain ? c.domain.toLowerCase().trim() : 'unknown';
        const count = c.usage_count || 1;
        domainStats.set(domain, (domainStats.get(domain) || 0) + count);
        totalCitations += count;
    });

    console.log(`Total Citations: ${totalCitations}`);

    // Sort top 5
    const sorted = Array.from(domainStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    console.log('\nTop 5 Sources (DB Verified):');
    sorted.forEach(([domain, count], i) => {
        console.log(`${i + 1}. ${domain}: ${count}`);
    });

    console.log(`\n✅ VERIFICATION SUCCESS: Data found for mapped collector '${collectorType}' -> '${resolvedTypes.join(', ')}'`);
    console.log(`Top Source: ${sorted[0][0]} (${sorted[0][1]} citations)`);
};

verify();
