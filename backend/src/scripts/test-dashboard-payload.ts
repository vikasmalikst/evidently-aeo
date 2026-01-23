import { supabaseAdmin } from '../config/database'
import { buildDashboardPayload } from '../services/brand-dashboard/payload-builder'
import { normalizeDateRange } from '../services/brand-dashboard/utils'

/**
 * Test dashboard payload generation to see time-series output
 */

async function testDashboardPayload() {
    const brandId = '5ce3fc1c-24c6-4434-a76e-72ad159030e9'

    // Get brand info
    const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('id, name, slug, customer_id')
        .eq('id', brandId)
        .single()

    if (!brand) {
        console.error('Brand not found')
        return
    }

    console.log(`Testing dashboard for brand: ${brand.name}`)
    console.log(`Customer ID: ${brand.customer_id}`)
    console.log('')

    // Test with Jan 1-22 date range
    const dateRange = {
        start: '2026-01-01',
        end: '2026-01-22'
    }

    const normalizedRange = normalizeDateRange(dateRange)
    console.log(`Date range: ${normalizedRange.startIso} to ${normalizedRange.endIso}`)
    console.log('')

    try {
        const payload = await buildDashboardPayload(
            brand,
            brand.customer_id,
            normalizedRange,
            { timezoneOffset: 0 }
        )

        console.log('='.repeat(80))
        console.log('COMPETITOR VISIBILITY OUTPUT:')
        console.log('='.repeat(80))

        if (!payload.competitorVisibility || payload.competitorVisibility.length === 0) {
            console.log('❌ NO COMPETITOR VISIBILITY DATA IN PAYLOAD!')
        } else {
            payload.competitorVisibility.forEach((comp, index) => {
                console.log(`\n[${index + 1}] ${comp.competitor}`)
                console.log(`   Share: ${comp.share}`)
                console.log(`   Visibility: ${comp.visibility}`)
                console.log(`   Mentions: ${comp.mentions}`)

                if (comp.timeSeries) {
                    console.log(`   Time Series:`)
                    console.log(`      Dates: ${comp.timeSeries.dates.length} dates`)
                    console.log(`      First date: ${comp.timeSeries.dates[0]}`)
                    console.log(`      Last date: ${comp.timeSeries.dates[comp.timeSeries.dates.length - 1]}`)
                    console.log(`      Share values: [${comp.timeSeries.share.slice(0, 10).join(', ')}...]`)
                    console.log(`      Visibility values: [${comp.timeSeries.visibility.slice(0, 10).join(', ')}...]`)

                    // Count real vs interpolated data
                    if (comp.timeSeries.isRealData) {
                        const realCount = comp.timeSeries.isRealData.filter(r => r).length
                        const interpolatedCount = comp.timeSeries.isRealData.filter(r => !r).length
                        console.log(`      Real data points: ${realCount}`)
                        console.log(`      Interpolated points: ${interpolatedCount}`)
                    }
                } else {
                    console.log(`   ❌ NO TIME SERIES DATA`)
                }
            })
        }

        console.log('\n' + '='.repeat(80))
        console.log('LLM VISIBILITY (BRAND) OUTPUT:')
        console.log('='.repeat(80))

        if (!payload.llmVisibility || payload.llmVisibility.length === 0) {
            console.log('❌ NO LLM VISIBILITY DATA IN PAYLOAD!')
        } else {
            payload.llmVisibility.slice(0, 2).forEach((llm, index) => {
                console.log(`\n[${index + 1}] ${llm.provider}`)
                console.log(`   Share: ${llm.share}`)
                console.log(`   Visibility: ${llm.visibility}`)

                if (llm.timeSeries) {
                    console.log(`   Time Series:`)
                    console.log(`      Dates: ${llm.timeSeries.dates.length} dates`)
                    console.log(`      Share values: [${llm.timeSeries.share.slice(0, 10).join(', ')}...]`)
                    console.log(`      Visibility values: [${llm.timeSeries.visibility.slice(0, 10).join(', ')}...]`)

                    if (llm.timeSeries.isRealData) {
                        const realCount = llm.timeSeries.isRealData.filter(r => r).length
                        const interpolatedCount = llm.timeSeries.isRealData.filter(r => !r).length
                        console.log(`      Real data points: ${realCount}`)
                        console.log(`      Interpolated points: ${interpolatedCount}`)
                    }
                }
            })
        }

    } catch (error) {
        console.error('Error:', error)
    }
}

testDashboardPayload()
    .then(() => {
        console.log('\nDone!')
        process.exit(0)
    })
    .catch(error => {
        console.error('Error:', error)
        process.exit(1)
    })
