import { supabaseAdmin } from '../config/database'

/**
 * Diagnostic script to investigate missing competitor data
 * Run with: npx ts-node -r dotenv/config src/scripts/diagnose-competitor-data.ts
 */

async function diagnoseCompetitorData() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
    const startDate = '2026-01-01T00:00:00.000Z'
    const endDate = '2026-01-22T23:59:59.999Z'

    console.log('='.repeat(80))
    console.log('DIAGNOSING COMPETITOR DATA')
    console.log('='.repeat(80))
    console.log(`Brand ID: ${brandId}`)
    console.log(`Date Range: ${startDate} to ${endDate}`)
    console.log('')

    // 1. Get all metric_facts for this brand
    const { data: metricFacts, error: mfError } = await supabaseAdmin
        .from('metric_facts')
        .select('id, created_at, processed_at, collector_type')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

    if (mfError) {
        console.error('Error fetching metric_facts:', mfError)
        return
    }

    console.log(`Total metric_facts found: ${metricFacts?.length || 0}`)
    console.log('')

    if (!metricFacts || metricFacts.length === 0) {
        console.log('No metric_facts found for this brand in this date range!')
        return
    }

    // 2. Get brand_metrics for these metric_facts
    const metricFactIds = metricFacts.map(mf => mf.id)
    const { data: brandMetrics, error: bmError } = await supabaseAdmin
        .from('brand_metrics')
        .select('metric_fact_id, visibility_index, share_of_answers, has_brand_presence')
        .in('metric_fact_id', metricFactIds)

    console.log(`Total brand_metrics found: ${brandMetrics?.length || 0}`)
    console.log('')

    // 3. Get competitor_metrics for these metric_facts
    const { data: competitorMetrics, error: cmError } = await supabaseAdmin
        .from('competitor_metrics')
        .select(`
      metric_fact_id,
      competitor_id,
      visibility_index,
      share_of_answers,
      competitor_mentions,
      brand_competitors!inner(competitor_name)
    `)
        .in('metric_fact_id', metricFactIds)

    console.log(`Total competitor_metrics found: ${competitorMetrics?.length || 0}`)
    console.log('')

    if (!competitorMetrics || competitorMetrics.length === 0) {
        console.log('❌ NO COMPETITOR_METRICS FOUND!')
        console.log('This explains why competitor data is missing.')
        return
    }

    // 4. Group by date to see distribution
    const brandDataByDate = new Map<string, number>()
    const competitorDataByDate = new Map<string, number>()

    const brandMetricsMap = new Map(brandMetrics?.map(bm => [bm.metric_fact_id, bm]) || [])
    const competitorMetricsMap = new Map<string, any[]>()

    competitorMetrics?.forEach(cm => {
        if (!competitorMetricsMap.has(cm.metric_fact_id)) {
            competitorMetricsMap.set(cm.metric_fact_id, [])
        }
        competitorMetricsMap.get(cm.metric_fact_id)!.push(cm)
    })

    metricFacts.forEach(mf => {
        const date = mf.created_at.split('T')[0]

        // Count brand metrics
        if (brandMetricsMap.has(mf.id)) {
            brandDataByDate.set(date, (brandDataByDate.get(date) || 0) + 1)
        }

        // Count competitor metrics
        const competitorMetricsForFact = competitorMetricsMap.get(mf.id) || []
        if (competitorMetricsForFact.length > 0) {
            competitorDataByDate.set(date, (competitorDataByDate.get(date) || 0) + competitorMetricsForFact.length)
        }
    })

    // 5. Print comparison
    console.log('DATE-BY-DATE COMPARISON:')
    console.log('-'.repeat(80))
    console.log('Date       | Brand Metrics | Competitor Metrics')
    console.log('-'.repeat(80))

    const allDates = new Set([...brandDataByDate.keys(), ...competitorDataByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    sortedDates.forEach(date => {
        const brandCount = brandDataByDate.get(date) || 0
        const competitorCount = competitorDataByDate.get(date) || 0
        const status = competitorCount === 0 ? '❌' : '✅'
        console.log(`${date} | ${String(brandCount).padStart(13)} | ${String(competitorCount).padStart(18)} ${status}`)
    })

    console.log('')
    console.log('='.repeat(80))
    console.log('SUMMARY')
    console.log('='.repeat(80))
    console.log(`Total days with brand data: ${brandDataByDate.size}`)
    console.log(`Total days with competitor data: ${competitorDataByDate.size}`)
    console.log(`Days missing competitor data: ${brandDataByDate.size - competitorDataByDate.size}`)
    console.log('')

    // 6. Show sample competitor data
    if (competitorMetrics && competitorMetrics.length > 0) {
        console.log('SAMPLE COMPETITOR METRICS (first 5):')
        console.log('-'.repeat(80))
        competitorMetrics.slice(0, 5).forEach(cm => {
            const mf = metricFacts.find(m => m.id === cm.metric_fact_id)
            const competitorName = (cm.brand_competitors as any)?.competitor_name || 'Unknown'
            console.log(`Date: ${mf?.created_at.split('T')[0]} | Competitor: ${competitorName} | Share: ${cm.share_of_answers} | Visibility: ${cm.visibility_index}`)
        })
    }
}

diagnoseCompetitorData()
    .then(() => {
        console.log('\nDiagnostic complete!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Error:', error)
        process.exit(1)
    })
