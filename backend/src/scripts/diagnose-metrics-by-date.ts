import { supabaseAdmin } from '../config/database'

/**
 * Refined diagnostic script to check which dates have metrics vs which don't
 */

async function diagnoseMetricsByDate() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
    const startDate = '2026-01-01T00:00:00.000Z'
    const endDate = '2026-01-22T23:59:59.999Z'

    console.log('='.repeat(80))
    console.log('DIAGNOSING METRICS BY DATE')
    console.log('='.repeat(80))
    console.log(`Brand ID: ${brandId}`)
    console.log(`Date Range: ${startDate} to ${endDate}`)
    console.log('')

    // Step 1: Get all metric_facts WITH their corresponding brand_metrics and competitor_metrics
    const { data: metricFacts, error: mfError } = await supabaseAdmin
        .from('metric_facts')
        .select(`
      id,
      created_at,
      collector_result_id,
      collector_type,
      brand_metrics(id, visibility_index, share_of_answers),
      competitor_metrics(id, competitor_id, visibility_index, share_of_answers)
    `)
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

    if (mfError) {
        console.error('Error:', mfError)
        return
    }

    console.log(`Total metric_facts: ${metricFacts?.length || 0}`)
    console.log('')

    if (!metricFacts || metricFacts.length === 0) {
        console.log('No metric_facts found!')
        return
    }

    // Group by date
    const dateMap = new Map<string, {
        metricFactCount: number
        withBrandMetrics: number
        withCompetitorMetrics: number
        competitorMetricsCount: number
    }>()

    metricFacts.forEach(mf => {
        const date = mf.created_at.split('T')[0]

        if (!dateMap.has(date)) {
            dateMap.set(date, {
                metricFactCount: 0,
                withBrandMetrics: 0,
                withCompetitorMetrics: 0,
                competitorMetricsCount: 0
            })
        }

        const stats = dateMap.get(date)!
        stats.metricFactCount++

        // Check if this metric_fact has brand_metrics
        const brandMetrics = Array.isArray(mf.brand_metrics) ? mf.brand_metrics : (mf.brand_metrics ? [mf.brand_metrics] : [])
        if (brandMetrics.length > 0) {
            stats.withBrandMetrics++
        }

        // Check if this metric_fact has competitor_metrics
        const competitorMetrics = Array.isArray(mf.competitor_metrics) ? mf.competitor_metrics : (mf.competitor_metrics ? [mf.competitor_metrics] : [])
        if (competitorMetrics.length > 0) {
            stats.withCompetitorMetrics++
            stats.competitorMetricsCount += competitorMetrics.length
        }
    })

    // Print results
    console.log('DATE-BY-DATE BREAKDOWN:')
    console.log('-'.repeat(120))
    console.log('Date       | Metric Facts | With Brand Metrics | With Competitor Metrics | Total Comp Metrics')
    console.log('-'.repeat(120))

    const sortedDates = Array.from(dateMap.keys()).sort()
    sortedDates.forEach(date => {
        const stats = dateMap.get(date)!
        const brandStatus = stats.withBrandMetrics === stats.metricFactCount ? '✅' : '⚠️ '
        const compStatus = stats.withCompetitorMetrics > 0 ? '✅' : '❌'

        console.log(
            `${date} | ${String(stats.metricFactCount).padStart(12)} | ` +
            `${brandStatus} ${String(stats.withBrandMetrics).padStart(15)} | ` +
            `${compStatus} ${String(stats.withCompetitorMetrics).padStart(20)} | ` +
            `${String(stats.competitorMetricsCount).padStart(17)}`
        )
    })

    console.log('')
    console.log('SUMMARY:')
    console.log('-'.repeat(80))
    const totalDates = dateMap.size
    const datesWithBrandMetrics = Array.from(dateMap.values()).filter(s => s.withBrandMetrics > 0).length
    const datesWithCompetitorMetrics = Array.from(dateMap.values()).filter(s => s.withCompetitorMetrics > 0).length

    console.log(`Total dates with metric_facts: ${totalDates}`)
    console.log(`Dates with brand metrics: ${datesWithBrandMetrics}`)
    console.log(`Dates with competitor metrics: ${datesWithCompetitorMetrics}`)
    console.log(`Dates MISSING competitor metrics: ${totalDates - datesWithCompetitorMetrics}`)
}

diagnoseMetricsByDate()
    .then(() => {
        console.log('\nDone!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Error:', error)
        process.exit(1)
    })
