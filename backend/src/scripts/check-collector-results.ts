import { supabaseAdmin } from '../config/database'

/**
 * Check if collector_results have raw_answer data
 */

async function checkCollectorResults() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'
    const startDate = '2026-01-01T00:00:00.000Z'
    const endDate = '2026-01-22T23:59:59.999Z'

    console.log('Checking collector_results for metric_facts...\n')

    // Get a sample metric_fact
    const { data: metricFacts, error } = await supabaseAdmin
        .from('metric_facts')
        .select('id, collector_result_id, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(10)

    if (error || !metricFacts || metricFacts.length === 0) {
        console.log('No metric_facts found')
        return
    }

    console.log(`Found ${metricFacts.length} metric_facts\n`)

    // Get collector_results
    const collectorResultIds = metricFacts
        .map(mf => mf.collector_result_id)
        .filter((id): id is number => typeof id === 'number')

    const { data: collectorResults, error: crError } = await supabaseAdmin
        .from('collector_results')
        .select('id, status, raw_answer, competitors, created_at')
        .in('id', collectorResultIds)

    if (crError) {
        console.error('Error:', crError)
        return
    }

    console.log('COLLECTOR RESULTS STATUS:')
    console.log('-'.repeat(80))
    collectorResults?.forEach(cr => {
        const hasRawAnswer = cr.raw_answer && cr.raw_answer.length > 0
        const hasCompetitors = cr.competitors && (Array.isArray(cr.competitors) ? cr.competitors.length > 0 : true)
        console.log(`ID: ${cr.id} | Status: ${cr.status} | Raw Answer: ${hasRawAnswer ? '✅' : '❌'} | Competitors: ${hasCompetitors ? '✅' : '❌'}`)
    })
}

checkCollectorResults()
    .then(() => {
        console.log('\nDone!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Error:', error)
        process.exit(1)
    })
