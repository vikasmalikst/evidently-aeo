/**
 * Verify competitor_metrics gap for dates after Jan 18
 */

import { supabaseAdmin } from '../src/config/database'

async function verifyGap() {
  const brandId = '583be119-67da-47bb-8a29-2950eb4da3ea'
  const customerId = 'ecb3163d-960a-4d99-9402-38d1845ea663'

  console.log('\n🔍 Verifying competitor_metrics gap\n')

  // Get metric_facts for Jan 21-25
  const { data: metricFacts, error: mfError } = await supabaseAdmin
    .from('metric_facts')
    .select('id, created_at')
    .eq('brand_id', brandId)
    .eq('customer_id', customerId)
    .gte('created_at', '2026-01-21T00:00:00Z')
    .lte('created_at', '2026-01-25T23:59:59Z')
    .order('created_at', { ascending: true })

  if (mfError) {
    console.error('❌ Error:', mfError)
    process.exit(1)
  }

  console.log(`📊 Metric Facts for Jan 21-25: ${metricFacts?.length || 0} rows\n`)

  if (!metricFacts || metricFacts.length === 0) {
    console.log('⚠️  No metric_facts found for Jan 21-25')
    process.exit(0)
  }

  // Group by date
  const byDate = new Map<string, number[]>()
  metricFacts.forEach(mf => {
    const date = new Date(mf.created_at).toISOString().split('T')[0]
    if (!byDate.has(date)) {
      byDate.set(date, [])
    }
    byDate.get(date)!.push(mf.id)
  })

  console.log('📅 Metric Facts by Date:')
  Array.from(byDate.entries()).sort().forEach(([date, ids]) => {
    console.log(`   ${date}: ${ids.length} metric_facts`)
  })

  // Check competitor_metrics for these metric_facts
  const allMetricFactIds = metricFacts.map(mf => mf.id)
  console.log(`\n🔍 Checking competitor_metrics for ${allMetricFactIds.length} metric_facts...`)

  const chunkSize = 500
  let totalCompetitorMetrics = 0
  const byMetricFact = new Map<number, number>()

  for (let i = 0; i < allMetricFactIds.length; i += chunkSize) {
    const chunk = allMetricFactIds.slice(i, i + chunkSize)
    const { data: cmData, error: cmError } = await supabaseAdmin
      .from('competitor_metrics')
      .select('metric_fact_id')
      .in('metric_fact_id', chunk)

    if (cmError) {
      console.error(`❌ Error fetching chunk:`, cmError)
      continue
    }

    if (cmData) {
      totalCompetitorMetrics += cmData.length
      cmData.forEach((cm: any) => {
        const mfId = cm.metric_fact_id
        byMetricFact.set(mfId, (byMetricFact.get(mfId) || 0) + 1)
      })
    }
  }

  console.log(`\n📊 Competitor Metrics Found: ${totalCompetitorMetrics} rows`)

  // Check which metric_facts have competitor_metrics
  const metricFactsWithCompetitors = new Set(byMetricFact.keys())
  const metricFactsWithoutCompetitors = allMetricFactIds.filter(id => !metricFactsWithCompetitors.has(id))

  console.log(`\n✅ Metric Facts WITH competitor_metrics: ${metricFactsWithCompetitors.size}`)
  console.log(`❌ Metric Facts WITHOUT competitor_metrics: ${metricFactsWithoutCompetitors.length}`)

  if (metricFactsWithoutCompetitors.length > 0) {
    console.log(`\n⚠️  ISSUE FOUND: ${metricFactsWithoutCompetitors.length} metric_facts are missing competitor_metrics!`)
    
    // Group by date
    const missingByDate = new Map<string, number>()
    metricFactsWithoutCompetitors.forEach(mfId => {
      const mf = metricFacts.find(m => m.id === mfId)
      if (mf) {
        const date = new Date(mf.created_at).toISOString().split('T')[0]
        missingByDate.set(date, (missingByDate.get(date) || 0) + 1)
      }
    })

    console.log(`\n📅 Missing competitor_metrics by date:`)
    Array.from(missingByDate.entries()).sort().forEach(([date, count]) => {
      console.log(`   ${date}: ${count} metric_facts missing competitor_metrics`)
    })

    // Sample a few metric_fact_ids to check
    console.log(`\n🔍 Sample metric_fact_ids missing competitor_metrics:`)
    metricFactsWithoutCompetitors.slice(0, 5).forEach(mfId => {
      const mf = metricFacts.find(m => m.id === mfId)
      if (mf) {
        const date = new Date(mf.created_at).toISOString().split('T')[0]
        console.log(`   - ${mfId} (${date})`)
      }
    })
  } else {
    console.log(`\n✅ All metric_facts have competitor_metrics`)
  }

  console.log()
}

verifyGap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
