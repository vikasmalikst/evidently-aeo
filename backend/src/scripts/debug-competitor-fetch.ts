import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env')
console.log(`Loading env from: ${envPath}`)
dotenv.config({ path: envPath })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function debugCompetitorFetch() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9' // Brand from previous context

    console.log('Fetching metric_facts for brand:', brandId)

    // 1. Get some metric_fact_ids
    const { data: metricFacts, error: mfError } = await supabaseAdmin
        .from('metric_facts')
        .select('id')
        .eq('brand_id', brandId)
        .limit(10)

    if (mfError) {
        console.error('Error fetching metric_facts:', mfError)
        return
    }

    if (!metricFacts || metricFacts.length === 0) {
        console.log('No metric_facts found for this brand')
        return
    }

    const metricFactIds = metricFacts.map((mf) => mf.id)
    console.log(`Found ${metricFacts.length} metric_facts. IDs:`, metricFactIds)

    // 2. Query competitor_metrics with the join
    console.log('Querying competitor_metrics with join...')
    const { data: competitorMetrics, error: compError } = await supabaseAdmin
        .from('competitor_metrics')
        .select(`
      *,
      brand_competitors!inner(competitor_name),
      metric_fact:metric_facts!inner(id, collector_result_id, query_id)
    `)
        .in('metric_fact_id', metricFactIds)

    if (compError) {
        console.error('Error fetching competitor_metrics:', compError)
        console.error('Hint: Check if relationships actulaly exist or if metric_facts foreign key is named differently in PostgREST')
        return
    }

    console.log(`Retrieved ${competitorMetrics?.length} competitor_metrics rows`)

    if (competitorMetrics && competitorMetrics.length > 0) {
        let positiveCount = 0
        let validIds = 0

        competitorMetrics.forEach((row: any, i) => {
            const vis = Number(row.visibility_index) || 0
            const share = Number(row.share_of_answers) || 0
            const mentions = Number(row.competitor_mentions) || 0

            const isPositive = vis > 0 || share > 0 || mentions > 0
            const hasId = typeof row.metric_fact?.collector_result_id === 'number'

            if (isPositive) {
                positiveCount++
                if (hasId) validIds++
                console.log(`Row ${i} positive: vis=${vis} share=${share} mentions=${mentions} hasId=${hasId} ID=${row.metric_fact?.collector_result_id}`)
            }
        })

        console.log(`\nStatistics:`)
        console.log(`Total Rows: ${competitorMetrics.length}`)
        console.log(`Positive Rows: ${positiveCount}`)
        console.log(`Positive Rows with Valid IDs: ${validIds}`)
    }
}

debugCompetitorFetch()
