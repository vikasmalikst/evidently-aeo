
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_SOURCE = 'insidersports.com.au';

async function verify() {
    console.log('--- Verification Started (Optimized Schema + Date Check) ---');

    // 1. Get Brand
    const { data: brands } = await supabase.from('brands')
        .select('id, name, customer_id')
        .ilike('name', '%InsiderSports%')
        .limit(1);

    if (!brands || brands.length === 0) {
        throw new Error('Brand InsiderSports not found');
    }
    const brand = brands[0];
    console.log(`Brand: ${brand.name} (${brand.id})`);

    // 2. Determine Period
    const { data: latestGen } = await supabase
        .from('recommendations')
        .select('created_at')
        .eq('brand_id', brand.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!latestGen) throw new Error('No generations found');

    const endDate = new Date(latestGen.created_at);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7);

    console.log(`Current Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const prevEndDate = new Date(startDate);
    const prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);

    console.log(`Previous Period: ${prevStartDate.toISOString()} to ${prevEndDate.toISOString()}`);

    await analyzePeriod(brand.id, brand.customer_id, startDate, endDate, 'CURRENT');
    await analyzePeriod(brand.id, brand.customer_id, prevStartDate, prevEndDate, 'PREVIOUS');
}

async function analyzePeriod(brandId: string, customerId: string, start: Date, end: Date, label: string) {
    console.log(`\n--- Analyzing ${label} Period ---`);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // 1. Fetch Citations
    const { data: citations } = await supabase
        .from('citations')
        .select('*')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .ilike('domain', `%${TARGET_SOURCE}%`);

    if (!citations || citations.length === 0) {
        console.log(`No citations found for ${TARGET_SOURCE}`);
        return;
    }

    console.log(`Found ${citations.length} citations for ${TARGET_SOURCE}`);

    // 2. Get Metrics from Optimized Tables with PROCESSED_AT
    const collectorResultIds = [...new Set(citations.map(c => c.collector_result_id).filter(id => id !== null))];
    console.log(`Unique Collector Result IDs: ${collectorResultIds.length}`);

    if (collectorResultIds.length === 0) {
        console.log('No valid collector result IDs');
        return;
    }

    const { data: metrics, error: metricError } = await supabase
        .from('metric_facts')
        .select(`
          collector_result_id,
          processed_at,
          brand_metrics!inner(
            share_of_answers,
            visibility_index,
            brand_positions,
            brand_first_position
          ),
          brand_sentiment(
            sentiment_score
          )
        `)
        .in('collector_result_id', collectorResultIds)
        .eq('brand_id', brandId);

    if (metricError) {
        console.error("Error fetching metrics:", metricError);
        return;
    }

    if (!metrics) {
        console.log('No metrics found');
        return;
    }
    console.log(`Found ${metrics.length} metric rows`);

    // 3. Aggregate and Date Check
    let totalVisibility = 0;
    let totalSOA = 0;
    let totalSentiment = 0;
    let totalPosition = 0;
    let count = 0;

    const processedCRs = new Set();

    // Debug first row
    let inRangeCount = 0;
    const startObj = new Date(startIso);
    const endObj = new Date(endIso);

    metrics.forEach(m => {
        const pDate = new Date(m.processed_at);
        if (pDate >= startObj && pDate <= endObj) {
            inRangeCount++;
        }
    });

    console.log(`Metrics Processed_At Validity: ${inRangeCount}/${metrics.length} are in range [${startIso} - ${endIso}]`);

    if (metrics.length > 0) {
        console.log('Sample Metric Row:', JSON.stringify(metrics[0], null, 2));
    }

    citations.forEach(cit => {
        if (!cit.collector_result_id) return;
        if (processedCRs.has(cit.collector_result_id)) return;

        const row: any = metrics.find(m => m.collector_result_id === cit.collector_result_id);
        if (row) {
            const bm = Array.isArray(row.brand_metrics) ? row.brand_metrics[0] : row.brand_metrics;
            const bs = Array.isArray(row.brand_sentiment) ? row.brand_sentiment[0] : row.brand_sentiment;

            if (bm) {
                const vis = (bm.visibility_index || 0) * 100;
                const soa = bm.share_of_answers || 0;
                const sent = bs ? (bs.sentiment_score || 0) : 0;

                let avgPos = 0;
                if (bm.brand_positions && bm.brand_positions.length > 0) {
                    avgPos = bm.brand_positions.reduce((a: any, b: any) => a + Number(b), 0) / bm.brand_positions.length;
                } else if (bm.brand_first_position) {
                    avgPos = bm.brand_first_position;
                }

                totalVisibility += vis;
                totalSOA += soa;
                totalSentiment += sent;
                totalPosition += avgPos;
                count++;

                processedCRs.add(cit.collector_result_id);
            }
        }
    });

    const avgVis = count > 0 ? totalVisibility / count : 0;
    const avgSOA = count > 0 ? totalSOA / count : 0;
    const avgSent = count > 0 ? totalSentiment / count : 0;
    const avgPos = count > 0 ? totalPosition / count : 0;

    console.log(`Avg Visibility: ${avgVis.toFixed(2)}`);
    return { avgVis, avgSOA, avgSent, avgPos };
}

verify().catch(console.error);
