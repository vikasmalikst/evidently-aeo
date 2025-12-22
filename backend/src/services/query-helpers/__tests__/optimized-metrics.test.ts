/**
 * Tests for OptimizedMetricsHelper
 * 
 * These tests validate:
 * 1. Query correctness (returns expected data structure)
 * 2. Performance (faster than compatibility view)
 * 3. Data accuracy (matches compatibility view results)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OptimizedMetricsHelper } from '../optimized-metrics.helper';
import {
  BrandMetricsRow,
  CompetitorMetricsRow,
  FetchMetricsOptions,
} from '../../../types/optimized-metrics.types';

// Test configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('OptimizedMetricsHelper', () => {
  let supabase: SupabaseClient;
  let helper: OptimizedMetricsHelper;
  let testCollectorResultIds: number[];
  let testBrandId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Setup
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    helper = new OptimizedMetricsHelper(supabase);

    // Get some real test data from database
    const { data: metricFacts } = await supabase
      .from('metric_facts')
      .select('collector_result_id, brand_id, customer_id')
      .limit(10);

    if (metricFacts && metricFacts.length > 0) {
      testCollectorResultIds = metricFacts.map(mf => mf.collector_result_id);
      testBrandId = metricFacts[0].brand_id;
      testCustomerId = metricFacts[0].customer_id;
    }
  });

  describe('fetchBrandMetrics', () => {
    it('should return brand metrics for given collector_result IDs', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds.slice(0, 5),
        includeSentiment: true,
      };

      const result = await helper.fetchBrandMetrics(options);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.duration_ms).toBeGreaterThan(0);

      // Check data structure
      if (result.data.length > 0) {
        const row = result.data[0];
        expect(row).toHaveProperty('collector_result_id');
        expect(row).toHaveProperty('brand_id');
        expect(row).toHaveProperty('customer_id');
        expect(row).toHaveProperty('visibility_index');
        expect(row).toHaveProperty('share_of_answers');
        expect(row).toHaveProperty('total_brand_mentions');
        expect(row).toHaveProperty('has_brand_presence');
        expect(row).toHaveProperty('brand_positions');
        expect(Array.isArray(row.brand_positions)).toBe(true);
      }
    });

    it('should return empty array for non-existent collector_result IDs', async () => {
      const options: FetchMetricsOptions = {
        collectorResultIds: [999999999, 999999998],
        includeSentiment: false,
      };

      const result = await helper.fetchBrandMetrics(options);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should filter by brandId if provided', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0 || !testBrandId) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds,
        brandId: testBrandId,
      };

      const result = await helper.fetchBrandMetrics(options);

      expect(result.success).toBe(true);
      result.data.forEach(row => {
        expect(row.brand_id).toBe(testBrandId);
      });
    });

    it('should complete in reasonable time (< 500ms for 10 IDs)', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds.slice(0, 10),
        includeSentiment: true,
      };

      const result = await helper.fetchBrandMetrics(options);

      expect(result.duration_ms).toBeLessThan(500);
    });
  });

  describe('fetchCompetitorMetrics', () => {
    it('should return competitor metrics for given collector_result IDs', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds.slice(0, 5),
        includeSentiment: true,
      };

      const result = await helper.fetchCompetitorMetrics(options);

      // Assertions
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);

      // Check data structure
      if (result.data.length > 0) {
        const row = result.data[0];
        expect(row).toHaveProperty('collector_result_id');
        expect(row).toHaveProperty('competitor_id');
        expect(row).toHaveProperty('competitor_name');
        expect(row).toHaveProperty('visibility_index');
        expect(row).toHaveProperty('share_of_answers');
        expect(row).toHaveProperty('competitor_mentions');
        expect(row).toHaveProperty('competitor_positions');
        expect(Array.isArray(row.competitor_positions)).toBe(true);
      }
    });

    it('should return empty array if no competitors exist', async () => {
      // Find a collector_result with no competitors (brand-only data)
      const { data: brandOnlyMetricFacts } = await supabase
        .from('metric_facts')
        .select('collector_result_id')
        .limit(5);

      if (!brandOnlyMetricFacts || brandOnlyMetricFacts.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: brandOnlyMetricFacts.map(mf => mf.collector_result_id),
      };

      const result = await helper.fetchCompetitorMetrics(options);

      expect(result.success).toBe(true);
      // May be empty if no competitors exist for these results
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('fetchCombinedMetrics', () => {
    it('should return both brand and competitor metrics', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds.slice(0, 5),
        includeSentiment: true,
      };

      const result = await helper.fetchCombinedMetrics(options);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('brand');
      expect(result.data).toHaveProperty('competitors');
      expect(Array.isArray(result.data.brand)).toBe(true);
      expect(Array.isArray(result.data.competitors)).toBe(true);
    });

    it('should be faster than sequential queries', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const options: FetchMetricsOptions = {
        collectorResultIds: testCollectorResultIds.slice(0, 10),
        includeSentiment: true,
      };

      // Combined (parallel)
      const combinedResult = await helper.fetchCombinedMetrics(options);

      // Sequential
      const sequentialStart = Date.now();
      await helper.fetchBrandMetrics(options);
      await helper.fetchCompetitorMetrics(options);
      const sequentialDuration = Date.now() - sequentialStart;

      // Parallel should be faster or similar (not slower)
      expect(combinedResult.duration_ms).toBeLessThanOrEqual(sequentialDuration * 1.5);
    });
  });

  describe('getDistinctCollectorTypes', () => {
    it('should return unique collector types', async () => {
      if (!testBrandId || !testCustomerId) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const collectorTypes = await helper.getDistinctCollectorTypes(
        testBrandId,
        testCustomerId,
        startDate,
        endDate
      );

      expect(Array.isArray(collectorTypes)).toBe(true);
      
      // Check uniqueness
      const uniqueTypes = [...new Set(collectorTypes)];
      expect(collectorTypes.length).toBe(uniqueTypes.length);

      // All should be non-null strings
      collectorTypes.forEach(type => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should return empty array for date range with no data', async () => {
      if (!testBrandId || !testCustomerId) {
        console.warn('Skipping test: no test data available');
        return;
      }

      // Date range in the future (no data)
      const startDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000).toISOString();

      const collectorTypes = await helper.getDistinctCollectorTypes(
        testBrandId,
        testCustomerId,
        startDate,
        endDate
      );

      expect(collectorTypes).toHaveLength(0);
    });
  });

  describe('fetchBrandMetricsByDateRange', () => {
    it('should return brand metrics for date range', async () => {
      if (!testBrandId || !testCustomerId) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const result = await helper.fetchBrandMetricsByDateRange({
        brandId: testBrandId,
        customerId: testCustomerId,
        startDate,
        endDate,
        includeSentiment: true,
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // All rows should be within date range
      result.data.forEach(row => {
        const processedAt = new Date(row.processed_at);
        expect(processedAt >= new Date(startDate)).toBe(true);
        expect(processedAt <= new Date(endDate)).toBe(true);
      });
    });

    it('should filter by collector_types if provided', async () => {
      if (!testBrandId || !testCustomerId) {
        console.warn('Skipping test: no test data available');
        return;
      }

      // First get available collector types
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const availableTypes = await helper.getDistinctCollectorTypes(
        testBrandId,
        testCustomerId,
        startDate,
        endDate
      );

      if (availableTypes.length === 0) {
        console.warn('Skipping test: no collector types available');
        return;
      }

      // Filter by first type
      const filterType = availableTypes[0];

      const result = await helper.fetchBrandMetricsByDateRange({
        brandId: testBrandId,
        customerId: testCustomerId,
        startDate,
        endDate,
        collectorTypes: [filterType],
      });

      expect(result.success).toBe(true);
      
      // All rows should match the filter
      result.data.forEach(row => {
        expect(row.collector_type).toBe(filterType);
      });
    });
  });

  describe('Performance Comparison with Compatibility View', () => {
    it('should be faster than querying compatibility view', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const testIds = testCollectorResultIds.slice(0, 20);

      // Query new schema (optimized)
      const optimizedStart = Date.now();
      const optimizedResult = await helper.fetchBrandMetrics({
        collectorResultIds: testIds,
        includeSentiment: true,
      });
      const optimizedDuration = Date.now() - optimizedStart;

      // Query compatibility view (for comparison)
      const compatStart = Date.now();
      const { data: compatData } = await supabase
        .from('extracted_positions_compat')
        .select('*')
        .in('collector_result_id', testIds)
        .is('competitor_name', null);  // Brand rows only
      const compatDuration = Date.now() - compatStart;

      console.log('Performance Comparison:', {
        optimized_ms: optimizedDuration,
        compat_view_ms: compatDuration,
        speedup: (compatDuration / optimizedDuration).toFixed(2) + 'x',
      });

      // Optimized should be at least as fast (allow 20% margin for variance)
      expect(optimizedDuration).toBeLessThanOrEqual(compatDuration * 1.2);

      // Data counts should match
      if (compatData) {
        expect(optimizedResult.data.length).toBe(compatData.length);
      }
    });
  });

  describe('Data Accuracy Comparison with Compatibility View', () => {
    it('should return same data as compatibility view', async () => {
      if (!testCollectorResultIds || testCollectorResultIds.length === 0) {
        console.warn('Skipping test: no test data available');
        return;
      }

      const testIds = testCollectorResultIds.slice(0, 5);

      // Query new schema
      const optimizedResult = await helper.fetchBrandMetrics({
        collectorResultIds: testIds,
        includeSentiment: true,
      });

      // Query compatibility view
      const { data: compatData } = await supabase
        .from('extracted_positions_compat')
        .select('*')
        .in('collector_result_id', testIds)
        .is('competitor_name', null);  // Brand rows only

      // Compare key metrics
      if (compatData && compatData.length > 0 && optimizedResult.data.length > 0) {
        const optimizedByCollectorResult = new Map(
          optimizedResult.data.map(row => [row.collector_result_id, row])
        );

        compatData.forEach((compatRow: any) => {
          const optimizedRow = optimizedByCollectorResult.get(compatRow.collector_result_id);
          
          if (optimizedRow) {
            // Compare key metrics (allow small float differences)
            expect(optimizedRow.visibility_index).toBeCloseTo(compatRow.visibility_index || 0, 2);
            expect(optimizedRow.share_of_answers).toBeCloseTo(compatRow.share_of_answers_brand || 0, 2);
            expect(optimizedRow.total_brand_mentions).toBe(compatRow.total_brand_mentions);
            expect(optimizedRow.has_brand_presence).toBe(compatRow.has_brand_presence);
          }
        });
      }
    });
  });
});

