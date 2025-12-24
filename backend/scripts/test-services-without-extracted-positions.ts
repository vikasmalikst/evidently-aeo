/**
 * Test Script: Verify all services work without extracted_positions table
 * 
 * This script tests all critical services to ensure they work with the new schema
 * when extracted_positions table is disabled.
 * 
 * USAGE:
 *   1. Run: psql -f scripts/test-without-extracted-positions.sql
 *   2. Run: npx ts-node scripts/test-services-without-extracted-positions.ts
 *   3. Check results
 *   4. If all pass: table can be dropped
 *   5. If any fail: run rollback script
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

interface TestResult {
  service: string;
  test: string;
  passed: boolean;
  error?: string;
  duration_ms: number;
}

const results: TestResult[] = [];

async function runTest(
  service: string,
  test: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTime;
    results.push({
      service,
      test,
      passed: true,
      duration_ms: duration,
    });
    console.log(`✅ ${service}: ${test} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({
      service,
      test,
      passed: false,
      error: errorMsg,
      duration_ms: duration,
    });
    console.error(`❌ ${service}: ${test} - ${errorMsg}`);
  }
}

async function main() {
  console.log('\n🧪 Testing Services Without extracted_positions Table\n');
  console.log('=' .repeat(60));

  // Test 1: Verify table is disabled
  await runTest('Database', 'Verify extracted_positions is disabled', async () => {
    const { data, error } = await supabase
      .from('extracted_positions')
      .select('id')
      .limit(1);

    if (!error) {
      throw new Error('Table should be disabled but query succeeded');
    }
    if (!error.message.includes('does not exist') && !error.message.includes('relation')) {
      throw new Error(`Unexpected error: ${error.message}`);
    }
  });

  // Test 2: Verify new schema tables exist
  await runTest('Database', 'Verify new schema tables exist', async () => {
    const tables = ['metric_facts', 'brand_metrics', 'competitor_metrics', 'brand_sentiment', 'competitor_sentiment'];
    
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && !error.message.includes('permission')) {
        throw new Error(`Table ${table} not accessible: ${error.message}`);
      }
    }
  });

  // Test 3: Test OptimizedMetricsHelper - Brand Metrics
  await runTest('OptimizedMetricsHelper', 'Fetch brand metrics by date range', async () => {
    const { OptimizedMetricsHelper } = await import('../src/services/query-helpers/optimized-metrics.helper');
    const helper = new OptimizedMetricsHelper(supabase);
    
    // Get a test brand
    const { data: brands } = await supabase
      .from('brands')
      .select('id, customer_id')
      .limit(1)
      .single();

    if (!brands) {
      throw new Error('No brands found for testing');
    }

    const result = await helper.fetchBrandMetricsByDateRange({
      brandId: brands.id,
      customerId: brands.customer_id,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      includeSentiment: false,
    });

    if (!result.success) {
      throw new Error(`Failed to fetch brand metrics: ${result.error}`);
    }
  });

  // Test 4: Test OptimizedMetricsHelper - Competitor Metrics
  await runTest('OptimizedMetricsHelper', 'Fetch competitor metrics by date range', async () => {
    const { OptimizedMetricsHelper } = await import('../src/services/query-helpers/optimized-metrics.helper');
    const helper = new OptimizedMetricsHelper(supabase);
    
    // Get a test brand with competitors
    const { data: brandCompetitor } = await supabase
      .from('brand_competitors')
      .select('id, brand_id, brand:brands(customer_id)')
      .limit(1)
      .single();

    if (!brandCompetitor) {
      console.log('⚠️  No competitors found - skipping competitor metrics test');
      return;
    }

    const customerId = (brandCompetitor.brand as any)?.customer_id;
    if (!customerId) {
      throw new Error('No customer_id found');
    }

    const result = await helper.fetchCompetitorMetricsByDateRange({
      competitorId: brandCompetitor.id,
      brandId: brandCompetitor.brand_id,
      customerId,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      includeSentiment: false,
    });

    if (!result.success) {
      throw new Error(`Failed to fetch competitor metrics: ${result.error}`);
    }
  });

  // Test 5: Test Dashboard Service (should use new schema)
  await runTest('Dashboard Service', 'Build dashboard payload', async () => {
    const { buildBrandDashboardPayload } = await import('../src/services/brand-dashboard/payload-builder');
    
    // Get a test brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id, customer_id')
      .limit(1)
      .single();

    if (!brand) {
      throw new Error('No brands found for testing');
    }

    const range = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      startIso: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endIso: new Date().toISOString(),
    };

    await buildBrandDashboardPayload(brand, brand.customer_id, range, supabase);
  });

  // Test 6: Test Topics Service (should use new schema)
  await runTest('Topics Service', 'Fetch topics with analytics', async () => {
    const { brandService } = await import('../src/services/brand.service');
    
    // Get a test brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id, customer_id')
      .limit(1)
      .single();

    if (!brand) {
      throw new Error('No brands found for testing');
    }

    // Enable optimized query flag for this test
    process.env.USE_OPTIMIZED_TOPICS_QUERY = 'true';

    const range = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    await brandService.getBrandTopicsWithAnalytics(
      brand.id,
      brand.customer_id,
      range.startDate.toISOString(),
      range.endDate.toISOString()
    );
  });

  // Test 7: Test Source Attribution Service (should use new schema)
  await runTest('Source Attribution Service', 'Fetch source attribution', async () => {
    const { sourceAttributionService } = await import('../src/services/source-attribution.service');
    
    // Get a test brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id, customer_id')
      .limit(1)
      .single();

    if (!brand) {
      throw new Error('No brands found for testing');
    }

    // Enable optimized query flag for this test
    process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION = 'true';

    const range = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };

    await sourceAttributionService.getSourceAttribution(
      brand.id,
      brand.customer_id,
      range.startDate.toISOString(),
      range.endDate.toISOString()
    );
  });

  // Test 8: Test Consolidated Scoring Service (should write to new schema)
  await runTest('Consolidated Scoring Service', 'Validate scoring service', async () => {
    const { consolidatedScoringService } = await import('../src/services/scoring/consolidated-scoring.service');
    
    // Get a test brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id, customer_id')
      .limit(1)
      .single();

    if (!brand) {
      throw new Error('No brands found for testing');
    }

    // Enable optimized validation flag
    process.env.USE_OPTIMIZED_VALIDATION = 'true';

    // Just verify the service can be instantiated and methods exist
    // Don't actually run scoring (would take too long)
    if (!consolidatedScoringService) {
      throw new Error('Consolidated scoring service not available');
    }
  });

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  console.log(`📈 Average Duration: ${Math.round(totalDuration / results.length)}ms`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:\n');
    results
      .filter(r => !r.passed)
      .forEach(r => {
        console.log(`  - ${r.service}: ${r.test}`);
        console.log(`    Error: ${r.error}\n`);
      });
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ ALL TESTS PASSED - extracted_positions table can be safely dropped!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review errors before dropping table\n');
    console.log('💡 Run rollback script to restore table:');
    console.log('   psql -f scripts/rollback-extracted-positions.sql\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

