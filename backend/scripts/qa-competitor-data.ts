/**
 * QA Script: Check competitor_metrics data vs UI display
 * 
 * This script queries the database to see what competitor data exists
 * and compares it with what should be displayed in the UI.
 * 
 * Usage:
 *   npx ts-node backend/scripts/qa-competitor-data.ts insidersports
 */

import { supabaseAdmin } from '../src/config/database'

async function qaCompetitorData(brandIdentifier: string) {
  console.log(`\n🔍 QA: Checking competitor data for brand: ${brandIdentifier}\n`)

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

  // 2. Get all competitors for this brand
  const { data: competitors, error: compError } = await supabaseAdmin
    .from('brand_competitors')
    .select('id, competitor_name')
    .eq('brand_id', brand.id)

  if (compError) {
    console.error('❌ Error fetching competitors:', compError)
    process.exit(1)
  }

  console.log(`📊 Found ${competitors?.length || 0} competitors:`)
  competitors?.forEach(c => {
    console.log(`   - ${c.competitor_name} (${c.id})`)
  })
  console.log()

  if (!competitors || competitors.length === 0) {
    console.log('⚠️  No competitors found for this brand')
    process.exit(0)
  }

  const competitorIds = competitors.map(c => c.id)

  // 3. Check competitor_metrics data via metric_facts
  // This is how the dashboard queries it
  const { data: metricFactsWithCompetitors, error: mfError } = await supabaseAdmin
    .from('metric_facts')
    .select(`
      id,
      created_at,
      processed_at,
      customer_id,
      collector_type,
      competitor_metrics!inner(
        competitor_id,
        visibility_index,
        share_of_answers,
        competitor_mentions
      )
    `)
    .eq('brand_id', brand.id)
    .eq('customer_id', brand.customer_id)
    .in('competitor_metrics.competitor_id', competitorIds)
    .order('created_at', { ascending: false })

  if (mfError) {
    console.error('❌ Error fetching metric_facts with competitors:', mfError)
    process.exit(1)
  }

  console.log(`📊 Metric Facts with Competitor Data:`)
  console.log(`   Total rows: ${metricFactsWithCompetitors?.length || 0}\n`)

  if (!metricFactsWithCompetitors || metricFactsWithCompetitors.length === 0) {
    console.log('⚠️  No competitor data found in metric_facts')
    console.log('💡 This could mean:')
    console.log('   - No competitor data has been collected')
    console.log('   - customer_id mismatch (but we just fixed this)')
    console.log('   - Data exists but with different customer_id')
    process.exit(0)
  }

  // 4. Group by date and competitor
  const dateMap = new Map<string, Map<string, number>>() // date -> competitor_name -> count

  metricFactsWithCompetitors.forEach((mf: any) => {
    const createdDate = mf.created_at ? new Date(mf.created_at).toISOString().split('T')[0] : null
    if (!createdDate) return

    const competitorMetrics = Array.isArray(mf.competitor_metrics) 
      ? mf.competitor_metrics 
      : [mf.competitor_metrics]

    competitorMetrics.forEach((cm: any) => {
      const competitor = competitors.find(c => c.id === cm.competitor_id)
      const competitorName = competitor?.competitor_name || 'Unknown'

      if (!dateMap.has(createdDate)) {
        dateMap.set(createdDate, new Map())
      }
      const competitorMap = dateMap.get(createdDate)!
      competitorMap.set(competitorName, (competitorMap.get(competitorName) || 0) + 1)
    })
  })

  // 5. Show data by date
  const sortedDates = Array.from(dateMap.keys()).sort()
  console.log(`📅 Competitor Data by Date (${sortedDates.length} dates):\n`)

  if (sortedDates.length === 0) {
    console.log('⚠️  No date data found')
    process.exit(0)
  }

  // Show first 10 and last 10 dates
  const showDates = sortedDates.length <= 20 
    ? sortedDates 
    : [...sortedDates.slice(0, 10), '...', ...sortedDates.slice(-10)]

  showDates.forEach(date => {
    if (date === '...') {
      console.log(`   ... (${sortedDates.length - 20} more dates) ...`)
      return
    }

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
  console.log(`   Total metric_facts rows: ${metricFactsWithCompetitors.length}`)

  // 6. Check for gaps around Jan 18
  const jan18 = '2025-01-18'
  const jan18Index = sortedDates.indexOf(jan18)
  
  if (jan18Index >= 0) {
    console.log(`\n🔍 Checking data around Jan 18, 2025:`)
    const beforeJan18 = sortedDates.filter(d => d < jan18)
    const onOrAfterJan18 = sortedDates.filter(d => d >= jan18)
    
    console.log(`   Dates before Jan 18: ${beforeJan18.length}`)
    console.log(`   Dates on/after Jan 18: ${onOrAfterJan18.length}`)
    
    if (beforeJan18.length > 0 && onOrAfterJan18.length === 0) {
      console.log(`   ⚠️  ISSUE: Data exists before Jan 18 but NOT after!`)
    } else if (beforeJan18.length === 0 && onOrAfterJan18.length > 0) {
      console.log(`   ✅ Data only exists after Jan 18 (expected)`)
    } else if (beforeJan18.length > 0 && onOrAfterJan18.length > 0) {
      console.log(`   ✅ Data exists both before and after Jan 18`)
    }
  } else {
    console.log(`\n⚠️  No data found for Jan 18, 2025`)
    const closestBefore = sortedDates.filter(d => d < jan18).pop()
    const closestAfter = sortedDates.filter(d => d >= jan18).shift()
    console.log(`   Closest date before: ${closestBefore || 'none'}`)
    console.log(`   Closest date after: ${closestAfter || 'none'}`)
  }

  // 7. Check customer_id consistency
  const customerIds = new Set(metricFactsWithCompetitors.map((mf: any) => mf.customer_id))
  console.log(`\n🔍 Customer ID Check:`)
  console.log(`   Distinct customer_ids in data: ${customerIds.size}`)
  customerIds.forEach(cid => {
    const count = metricFactsWithCompetitors.filter((mf: any) => mf.customer_id === cid).length
    console.log(`   - ${cid}: ${count} rows`)
  })
  
  if (customerIds.size > 1) {
    console.log(`   ⚠️  WARNING: Multiple customer_ids found!`)
  } else if (!customerIds.has(brand.customer_id)) {
    console.log(`   ⚠️  WARNING: Data customer_id doesn't match brand customer_id!`)
  } else {
    console.log(`   ✅ All data has correct customer_id`)
  }

  // 8. Check direct competitor_metrics table (alternative query)
  console.log(`\n🔍 Checking competitor_metrics table directly:`)
  const { data: directCompetitorMetrics, error: directError } = await supabaseAdmin
    .from('competitor_metrics')
    .select(`
      id,
      metric_fact_id,
      competitor_id,
      visibility_index,
      share_of_answers,
      metric_facts!inner(
        id,
        brand_id,
        customer_id,
        created_at,
        processed_at
      )
    `)
    .in('competitor_id', competitorIds)
    .eq('metric_facts.brand_id', brand.id)
    .order('metric_facts.created_at', { ascending: false })
    .limit(100)

  if (directError) {
    console.log(`   ❌ Error: ${directError.message}`)
  } else {
    console.log(`   Found ${directCompetitorMetrics?.length || 0} rows (showing first 100)`)
    
    if (directCompetitorMetrics && directCompetitorMetrics.length > 0) {
      const directDates = new Set<string>()
      directCompetitorMetrics.forEach((cm: any) => {
        const mf = cm.metric_facts
        if (mf?.created_at) {
          const date = new Date(mf.created_at).toISOString().split('T')[0]
          directDates.add(date)
        }
      })
      
      const sortedDirectDates = Array.from(directDates).sort()
      console.log(`   Date range: ${sortedDirectDates[0]} to ${sortedDirectDates[sortedDirectDates.length - 1]}`)
      console.log(`   Total dates: ${sortedDirectDates.length}`)
    }
  }

  console.log()
}

const brandIdentifier = process.argv[2]

if (!brandIdentifier) {
  console.error('❌ Usage: npx ts-node backend/scripts/qa-competitor-data.ts <brand_id_or_slug>')
  process.exit(1)
}

qaCompetitorData(brandIdentifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
