
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- CONFIGURATION ---

// 1. BRAND_ID: Set this to the specific Brand ID you want to analyze.
//    If empty, the script will try to find a brand matching "Nike" with the most citations.
const BRAND_ID = process.env.BRAND_ID || '';

// 2. REFERENCE_DATE: The "Current" period will end on this date.
//    Format: YYYY-MM-DD. Defaults to today if not set.
const REFERENCE_DATE = process.env.REFERENCE_DATE || new Date().toISOString().split('T')[0];

// 3. TARGETS: Define which metrics and sources to verify.
//    Format: { 'Metric Name': ['domain1.com', 'domain2.com'] }
const TARGETS: Record<string, string[]> = {
    'Share of Answer': [
        'runrepeat.com', 'reddit.com', 'nike.com',
        'easyreviewhub.com', 'switchbacktravel.com', 'freecultr.com'
    ],
    'Avg Position': [
        'reddit.com', 'thatfitfriend.com', 'theruntesters.com',
        'runrepeat.com', 'nike.com', 'runnersworld.com'
    ]
};

// ---------------------

async function runQA() {
    console.log(`🔍 QA Citation Metrics Script`);
    console.log(`📅 Reference Date: ${REFERENCE_DATE}`);
    console.log(`-------------------------------------------`);

    // 1. Resolve Brand
    let brandId = BRAND_ID;
    let brandName = 'Unknown';

    if (!brandId) {
        console.log(`No BRAND_ID provided. Searching for "Nike" (default)...`);
        const { data: brands, error } = await supabase
            .from('brands')
            .select('id, name')
            .ilike('name', '%Nike%');

        if (error || !brands || brands.length === 0) {
            console.error('❌ Brand "Nike" not found. Please set BRAND_ID env var.');
            return;
        }

        // Find the one with most citations
        let maxCitations = -1;
        let bestBrand = null;

        for (const b of brands) {
            const { count } = await supabase
                .from('citations')
                .select('*', { count: 'exact', head: true })
                .eq('brand_id', b.id);
            const num = count || 0;
            if (num > maxCitations) {
                maxCitations = num;
                bestBrand = b;
            }
        }

        if (bestBrand) {
            brandId = bestBrand.id;
            brandName = bestBrand.name;
            console.log(`✅ Selected Brand: ${brandName} (${brandId}) - ${maxCitations} citations`);
        } else {
            console.error('❌ Could not determine active brand.');
            return;
        }
    } else {
        const { data: brand } = await supabase.from('brands').select('name').eq('id', brandId).single();
        brandName = brand?.name || 'Unknown';
        console.log(`✅ Using Brand ID: ${brandId} (${brandName})`);
    }

    // 2. Calculate Periods
    // Current: [RefDate - 6 days] to [RefDate] (7 days inclusive)
    // Prior:   [RefDate - 13 days] to [RefDate - 7 days] (7 days inclusive)

    const endDate = new Date(REFERENCE_DATE);
    endDate.setUTCHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    startDate.setUTCHours(0, 0, 0, 0);

    const priorEndDate = new Date(startDate);
    priorEndDate.setUTCDate(priorEndDate.getUTCDate() - 1);
    priorEndDate.setUTCHours(23, 59, 59, 999);

    const priorStartDate = new Date(priorEndDate);
    priorStartDate.setUTCDate(priorStartDate.getUTCDate() - 6);
    priorStartDate.setUTCHours(0, 0, 0, 0);

    const periods = [
        {
            name: 'Current',
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            label: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
        },
        {
            name: 'Prior  ',
            start: priorStartDate.toISOString(),
            end: priorEndDate.toISOString(),
            label: `${priorStartDate.toISOString().split('T')[0]} to ${priorEndDate.toISOString().split('T')[0]}`
        }
    ];

    console.log(`\nPeriods:`);
    periods.forEach(p => console.log(` - ${p.name}: ${p.label}`));
    console.log('');

    // 3. Helper Function
    const fetchMetrics = async (source: string, start: string, end: string) => {
        // Find citations (wildcard match)
        const { data: citations, error: citError } = await supabase
            .from('citations')
            .select('collector_result_id')
            .eq('brand_id', brandId)
            .ilike('domain', `%${source}%`)
            .gte('created_at', start)
            .lte('created_at', end);

        if (citError) {
            console.error(`Error fetching citations for ${source}:`, citError.message);
            return null;
        }

        if (!citations || citations.length === 0) return null;

        const ids = citations.map(c => c.collector_result_id).filter(id => id !== null);
        if (ids.length === 0) return null;

        // Fetch Metrics via metric_facts joined with nested relations
        const { data: metrics, error: metError } = await supabase
            .from('metric_facts')
            .select(`
                collector_result_id,
                brand_metrics (
                    visibility_index,
                    share_of_answers,
                    brand_positions
                ),
                brand_sentiment (
                    sentiment_score
                )
            `)
            .in('collector_result_id', ids);

        if (metError || !metrics) return null;

        // Aggregate
        let totalVis = 0;
        let totalSoa = 0;
        let totalSent = 0;
        let totalPos = 0;
        let count = 0;

        metrics.forEach((m: any) => {
            const bm = Array.isArray(m.brand_metrics) ? m.brand_metrics[0] : m.brand_metrics;
            const bs = Array.isArray(m.brand_sentiment) ? m.brand_sentiment[0] : m.brand_sentiment;

            if (bm) {
                totalVis += (bm.visibility_index || 0);
                totalSoa += (bm.share_of_answers || 0);

                const positions = bm.brand_positions || [];
                let rowPos = 0;
                if (positions.length > 0) {
                    rowPos = positions.reduce((a: any, b: any) => a + b, 0) / positions.length;
                }
                totalPos += rowPos;
            }

            if (bs) {
                totalSent += (bs.sentiment_score || 0);
            }

            count++;
        });

        if (count === 0) return null;

        return {
            vis: (totalVis / count),
            soa: (totalSoa / count),     // Raw decimal or value from DB
            sent: (totalSent / count),
            pos: (totalPos / count),
            count
        };
    };

    // 4. Execution & Table Output
    const tableHeader = `| Metric           | Source                 | Period  | Count | Vis   | SOA % | Sent  | Pos   |`;
    const separator = `|------------------|------------------------|---------|-------|-------|-------|-------|-------|`;

    console.log(separator);
    console.log(tableHeader);
    console.log(separator);

    for (const [metric, sources] of Object.entries(TARGETS)) {
        for (const source of sources) {
            for (const period of periods) {
                const res = await fetchMetrics(source, period.start, period.end);

                const countStr = res ? String(res.count).padEnd(5) : '0    ';
                const visStr = res ? res.vis.toFixed(2).padEnd(5) : '-    ';
                const soaStr = res ? (res.soa * 100).toFixed(1).padEnd(5) : '-    '; // Assuming SOA is 0-1 decimal in DB, verify if needed
                // Note: In previous QA we saw raw values ~30-40. If those were %, then *100 is wrong.
                // Let's check previous output: "32.888". That looks like %. 
                // If DB stores 32.888, then no *100.
                // Actually my previous script output just `soa/count`.
                // If I saw 32.88, I will assume it's already %.
                // I will revert the *100 logic and just print raw for safety, or inspect.
                // Re-reading prior logs: "35.130". This is likely %. 

                // Let's assume raw value is what we want.
                const soaDisplay = res ? res.soa.toFixed(2).padEnd(5) : '-    ';

                const sentStr = res ? res.sent.toFixed(2).padEnd(5) : '-    ';
                const posStr = res ? res.pos.toFixed(2).padEnd(5) : '-    ';

                console.log(`| ${metric.padEnd(16)} | ${source.padEnd(22)} | ${period.name.substring(0, 7)} | ${countStr} | ${visStr} | ${soaDisplay} | ${sentStr} | ${posStr} |`);
            }
            // Empty row between sources
            console.log(`|                  |                        |         |       |       |       |       |       |`);
        }
        console.log(separator);
    }
}

runQA().catch(console.error);
