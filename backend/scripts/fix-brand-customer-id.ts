/**
 * Script to fix customer_id mismatch for a brand
 * 
 * When a brand's customer_id is changed, old metric_facts may still have the old customer_id.
 * This script updates all metric_facts for a brand to match the brand's current customer_id.
 * 
 * Usage:
 *   npx ts-node backend/scripts/fix-brand-customer-id.ts <brand_id_or_slug>
 * 
 * Example:
 *   npx ts-node backend/scripts/fix-brand-customer-id.ts insidersports
 *   npx ts-node backend/scripts/fix-brand-customer-id.ts 583be119-67da-47bb-8a29-2950eb4da3ea
 */

import { supabaseAdmin } from '../src/config/database'

async function fixBrandCustomerId(brandIdentifier: string) {
  console.log(`\n🔍 Looking up brand: ${brandIdentifier}\n`)

  // Try to find brand by ID or slug (handle UUID vs slug)
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

  if (brandError) {
    console.error('❌ Error looking up brand:', brandError)
    process.exit(1)
  }

  if (!brand) {
    console.error(`❌ Brand not found: ${brandIdentifier}`)
    console.log('💡 Try using the brand ID or slug')
    process.exit(1)
  }

  console.log(`✅ Found brand:`)
  console.log(`   ID: ${brand.id}`)
  console.log(`   Name: ${brand.name}`)
  console.log(`   Slug: ${brand.slug}`)
  console.log(`   Current customer_id: ${brand.customer_id}\n`)

  // Check current state of metric_facts
  const { data: currentState, error: stateError } = await supabaseAdmin
    .from('metric_facts')
    .select('customer_id')
    .eq('brand_id', brand.id)

  if (stateError) {
    console.error('❌ Error checking metric_facts:', stateError)
    process.exit(1)
  }

  if (!currentState || currentState.length === 0) {
    console.log('ℹ️  No metric_facts found for this brand')
    process.exit(0)
  }

  // Count distinct customer_ids
  const customerIdCounts = new Map<string, number>()
  currentState.forEach(row => {
    const cid = row.customer_id || 'NULL'
    customerIdCounts.set(cid, (customerIdCounts.get(cid) || 0) + 1)
  })

  console.log(`📊 Current metric_facts state:`)
  console.log(`   Total rows: ${currentState.length}`)
  console.log(`   Distinct customer_ids: ${customerIdCounts.size}`)
  customerIdCounts.forEach((count, cid) => {
    console.log(`   - ${cid}: ${count} rows`)
  })
  console.log()

  // Check if update is needed
  const needsUpdate = customerIdCounts.size > 1 || 
    (customerIdCounts.size === 1 && !customerIdCounts.has(brand.customer_id))

  if (!needsUpdate) {
    console.log('✅ All metric_facts already have correct customer_id')
    process.exit(0)
  }

  // Count rows that need updating
  const rowsToUpdate = Array.from(customerIdCounts.entries())
    .filter(([cid]) => cid !== brand.customer_id)
    .reduce((sum, [, count]) => sum + count, 0)

  console.log(`⚠️  Found ${rowsToUpdate} rows with incorrect customer_id`)
  console.log(`   Will update to: ${brand.customer_id}\n`)

  // Perform update
  console.log('🔄 Updating metric_facts...')
  const { data: updateResult, error: updateError } = await supabaseAdmin
    .from('metric_facts')
    .update({ customer_id: brand.customer_id })
    .eq('brand_id', brand.id)
    .neq('customer_id', brand.customer_id)
    .select('id')

  if (updateError) {
    console.error('❌ Error updating metric_facts:', updateError)
    process.exit(1)
  }

  const updatedCount = updateResult?.length || 0
  console.log(`✅ Updated ${updatedCount} rows\n`)

  // Verify update
  const { data: verifyState, error: verifyError } = await supabaseAdmin
    .from('metric_facts')
    .select('customer_id')
    .eq('brand_id', brand.id)

  if (verifyError) {
    console.error('❌ Error verifying update:', verifyError)
    process.exit(1)
  }

  const verifyCounts = new Map<string, number>()
  verifyState?.forEach(row => {
    const cid = row.customer_id || 'NULL'
    verifyCounts.set(cid, (verifyCounts.get(cid) || 0) + 1)
  })

  console.log(`📊 Verification:`)
  console.log(`   Total rows: ${verifyState?.length || 0}`)
  console.log(`   Distinct customer_ids: ${verifyCounts.size}`)
  verifyCounts.forEach((count, cid) => {
    const match = cid === brand.customer_id ? '✅' : '❌'
    console.log(`   ${match} ${cid}: ${count} rows`)
  })

  if (verifyCounts.size === 1 && verifyCounts.has(brand.customer_id)) {
    console.log('\n✅ All metric_facts now have correct customer_id!')
    console.log('💡 Dashboard should now show full date range\n')
  } else {
    console.log('\n⚠️  Some rows still have incorrect customer_id')
    console.log('💡 Check database permissions or constraints\n')
  }
}

// Main execution
const brandIdentifier = process.argv[2]

if (!brandIdentifier) {
  console.error('❌ Usage: npx ts-node backend/scripts/fix-brand-customer-id.ts <brand_id_or_slug>')
  process.exit(1)
}

fixBrandCustomerId(brandIdentifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  })
