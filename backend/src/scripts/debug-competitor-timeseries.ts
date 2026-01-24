import { supabaseAdmin } from '../config/database'

/**
 * Debug script to check what's in timeSeriesByCompetitor Map
 */

async function debugCompetitorTimeSeries() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
    const startDate = '2026-01-01T00:00:00.000Z'
    const endDate = '2026-01-22T23:59:59.999Z'

    // Get position rows just like the dashboard does
    const { data: positionRows, error } = await supabaseAdmin
        .from('metric_facts')
        .select(`
      id,
      collector_result_id,
      created_at,
      processed_at,
      brand_metrics(visibility_index, share_of_answers),
      competitor_metrics(
        id,
        competitor_id,
        visibility_index,
        share_of_answers,
        brand_competitors!inner(competitor_name)
      )
    `)
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(`Total metric_facts: ${positionRows?.length || 0}`)

    // Group competitor data by date
    const competitorDataByDate = new Map<string, {
        count: number
        competitors: Set<string>
    }>()

    positionRows?.forEach(mf => {
        const date = mf.created_at.split('T')[0]
        const compMetrics = Array.isArray(mf.competitor_metrics) ? mf.competitor_metrics : []

        if (compMetrics.length > 0) {
            if (!competitorDataByDate.has(date)) {
                competitorDataByDate.set(date, { count: 0, competitors: new Set() })
            }
            const stats = competitorDataByDate.get(date)!

            compMetrics.forEach(cm => {
                stats.count++
                const competitorName = (cm.brand_competitors as any)?.competitor_name
                if (competitorName) {
                    stats.competitors.add(competitorName)
                }
            })
        }
    })

    console.log('\nCOMPETITOR DATA BY DATE:')
    console.log('-'.repeat(80))
    Array.from(competitorDataByDate.keys()).sort().forEach(date => {
        const stats = competitorDataByDate.get(date)!
        console.log(`${date}: ${stats.count} competitor_metrics, ${stats.competitors.size} unique competitors`)
        console.log(`  Competitors: ${Array.from(stats.competitors).join(', ')}`)
    })
}

debugCompetitorTimeSeries()
    .then(() => {
        console.log('\nDone!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Error:', error)
        process.exit(1)
    })
