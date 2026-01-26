/**
 * QA Script: Compare competitor data in DB vs what API returns
 * 
 * This script simulates the dashboard API query to see what data is returned
 * and compares it with what exists in the database.
 * 
 * Usage:
 *   npx ts-node backend/scripts/qa-competitor-ui-vs-db.ts insidersports
 */

import { supabaseAdmin } from '../src/config/database'

async function qaCompetitorUIvsDB(brandIdentifier: string) {
  console.log(`\n🔍 QA: Comparing competitor data (DB vs API response)\n`)

  // 1. Find brand
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandIdentifier)
  
  let brandQuery
  if (isUUID) {
    brandQuery = supabaseAdmin
      .from('brands')
      .select('id, name, slug, customer_id')
      .eq('id', brandIdentifier)
      .maybeSingle()
  } else {
    brandQuery = supabaseAdmin
      .from('brands')
      .select('id, name, slug, customer_id')
      .ilike('slug', brandIdentifier.toLowerCase())
      .maybeSingle()
  }

  const { data: brand, error: brandError } = await brandQuery

  if (brandError || !brand) {
    console.error('❌ Brand not found:', brandError || 'Not found')
    process.exit(1)
  }

  console.log(`✅ Brand: ${brand.name} (${brand.id})`)
  console.log(`   Customer ID: ${brand.customer_id}\n`)

  // 2. Simulate dashboard query - get date range (last 30 days)
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  
  const startIsoBound = startDate.toISOString()
  const endIsoBound = endDate.toISOString()

  console.log(`📅 Date Range: ${startIsoBound.split('T')[0]} to ${endIsoBound.split('T')[0]}\n`)

  // 3. Query metric_facts (same as dashboard does)
  const { data: metricFacts, error: mfError } = await supabaseAdmin
    .from('metric_facts')
    .select(`
      id,
      created_at,
      processed_at,
      customer_id,
      collector_type
    `)
    .eq('brand_id', brand.id)
    .eq('customer_id', brand.customer_id)
    .gte('created_at', startIsoBound)
    .lte('created_at', endIsoBound)
    .order('created_at', { ascending: true })

  if (mfError) {
    console.error('❌ Error fetching metric_facts:', mfError)
    process.exit(1)
  }

  console.log(`📊 Metric Facts in Date Range:`)
  console.log(`   Total rows: ${metricFacts?.length || 0}\n`)

  if (!metricFacts || metricFacts.length === 0) {
    console.log('⚠️  No metric_facts found in date range')
    process.exit(0)
  }

  // 4. Get metric_fact_ids
  const metricFactIds = metricFacts.map(mf => mf.id)

  // 5. Query competitor_metrics for these metric_facts (same as dashboard does)
  const chunkSize = 500
  const competitorMetricsRows: any[] = []
  
  for (let i = 0; i < metricFactIds.length; i += chunkSize) {
    const chunk = metricFactIds.slice(i, i + chunkSize)
    const { data: chunkData, error: chunkError } = await supabaseAdmin
      .from('competitor_metrics')
      .select(`
        metric_fact_id,
        competitor_id,
        visibility_index,
        share_of_answers,
        competitor_mentions,
        brand_competitors!inner(competitor_name)
      `)
      .in('metric_fact_id', chunk)

    if (chunkError) {
      console.error(`❌ Error fetching competitor_metrics chunk:`, chunkError)
      continue
    }

    if (chunkData) {
      competitorMetricsRows.push(...chunkData)
    }
  }

  console.log(`📊 Competitor Metrics Found:`)
  console.log(`   Total rows: ${competitorMetricsRows.length}\n`)

  if (competitorMetricsRows.length === 0) {
    console.log('⚠️  No competitor_metrics found for these metric_facts')
    console.log('💡 This means competitor data exists in metric_facts but competitor_metrics table is empty')
    process.exit(0)
  }

  // 6. Map metric_facts to dates
  const metricFactToDate = new Map<number, string>()
  metricFacts.forEach(mf => {
    if (mf.created_at) {
      const date = new Date(mf.created_at).toISOString().split('T')[0]
      metricFactToDate.set(mf.id, date)
    }
  })

  // 7. Group competitor data by date
  const dateMap = new Map<string, Map<string, number>>() // date -> competitor_name -> count

  competitorMetricsRows.forEach((cm: any) => {
    const metricFactId = cm.metric_fact_id
    const date = metricFactToDate.get(metricFactId)
    if (!date) return

    const competitorName = cm.brand_competitors?.competitor_name || 'Unknown'

    if (!dateMap.has(date)) {
      dateMap.set(date, new Map())
    }
    const competitorMap = dateMap.get(date)!
    competitorMap.set(competitorName, (competitorMap.get(competitorName) || 0) + 1)
  })

  // 8. Show data by date
  const sortedDates = Array.from(dateMap.keys()).sort()
  console.log(`📅 Competitor Data by Date (API Response - ${sortedDates.length} dates):\n`)

  if (sortedDates.length === 0) {
    console.log('⚠️  No date data found')
    process.exit(0)
  }

  sortedDates.forEach(date => {
    const competitorMap = dateMap.get(date)!
    const competitorNames = Array.from(competitorMap.keys()).sort()
    const totalRows = Array.from(competitorMap.values()).reduce((a, b) => a + b, 0)
    
    console.log(`   ${date}: ${totalRows} rows across ${competitorNames.length} competitors`)
    competitorNames.forEach(name => {
      const count = competitorMap.get(name)!
      console.log(`      - ${name}: ${count} rows`)
    })
  })

  console.log()
  console.log(`📊 Summary:`)
  console.log(`   Earliest date: ${sortedDates[0]}`)
  console.log(`   Latest date: ${sortedDates[sortedDates.length - 1]}`)
  console.log(`   Total dates with data: ${sortedDates.length}`)
  console.log(`   Total metric_facts: ${metricFacts.length}`)
  console.log(`   Total competitor_metrics rows: ${competitorMetricsRows.length}`)

  // 9. Check specifically for Jan 18, 2026 and after
  const jan18 = '2026-01-18'
  const jan18Index = sortedDates.indexOf(jan18)
  const datesAfterJan18 = sortedDates.filter(d => d > jan18)
  
  console.log(`\n🔍 Checking Jan 18, 2026 and after:`)
  console.log(`   Jan 18 exists: ${jan18Index >= 0 ? '✅' : '❌'}`)
  console.log(`   Dates after Jan 18: ${datesAfterJan18.length}`)
  if (datesAfterJan18.length > 0) {
    console.log(`   Dates after Jan 18: ${datesAfterJan18.join(', ')}`)
  }

  // 10. Check if there are metric_facts for dates but no competitor_metrics
  const datesWithMetricFacts = new Set<string>()
  metricFacts.forEach(mf => {
    if (mf.created_at) {
      const date = new Date(mf.created_at).toISOString().split('T')[0]
      datesWithMetricFacts.add(date)
    }
  })

  const datesWithCompetitorData = new Set(sortedDates)
  const datesWithoutCompetitorData = Array.from(datesWithMetricFacts).filter(d => !datesWithCompetitorData.has(d)).sort()

  if (datesWithoutCompetitorData.length > 0) {
    console.log(`\n⚠️  Dates with metric_facts but NO competitor_metrics:`)
    console.log(`   ${datesWithoutCompetitorData.join(', ')}`)
    console.log(`   This could indicate missing competitor_metrics data`)
  } else {
    console.log(`\n✅ All dates with metric_facts have competitor_metrics`)
  }

  // 11. Check competitor_metrics that don't match any metric_facts in range
  const metricFactIdsSet = new Set(metricFactIds)
  const orphanedCompetitorMetrics = competitorMetricsRows.filter((cm: any) => !metricFactIdsSet.has(cm.metric_fact_id))
  
  if (orphanedCompetitorMetrics.length > 0) {
    console.log(`\n⚠️  Found ${orphanedCompetitorMetrics.length} competitor_metrics rows that don't match metric_facts in date range`)
    console.log(`   This shouldn't happen - investigating...`)
  }

  console.log()
}

const brandIdentifier = process.argv[2]

if (!brandIdentifier) {
  console.error('❌ Usage: npx ts-node backend/scripts/qa-competitor-ui-vs-db.ts <brand_id_or_slug>')
  process.exit(1)
}

qaCompetitorUIvsDB(brandIdentifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
