/**
 * Topics Page Data Comparison Script
 * 
 * Compares data from legacy (extracted_positions) vs new schema (metric_facts + metrics tables)
 * for Topics page to verify migration correctness.
 * 
 * Usage:
 *   npx ts-node src/scripts/test-topics-comparison.ts
 */

import { supabaseAdmin } from '../config/database';

// Test parameters
const BRAND_ID = '5a57c430-6940-4198-a1f5-a443cbd044dc';
const CUSTOMER_ID = '157c845c-9e87-4146-8479-cb8d045212bf';

interface TopicMetrics {
  topic: string;
  brandSOA: number | null;
  brandVisibility: number | null;
  brandSentiment: number | null;
  competitorAvgSOA: number | null;
  competitorAvgVisibility: number | null;
  competitorAvgSentiment: number | null;
  competitorCount: number;
  dataPointCount: number;
}

interface ComparisonResult {
  topic: string;
  legacy: TopicMetrics;
  optimized: TopicMetrics;
  match: {
    brandSOA: boolean;
    brandVisibility: boolean;
    brandSentiment: boolean;
    competitorSOA: boolean;
    competitorVisibility: boolean;
    competitorSentiment: boolean;
  };
}

/**
 * Extract metrics from LEGACY schema (extracted_positions)
 */
async function extractFromLegacySchema(): Promise<Map<string, TopicMetrics>> {
  console.log('\n📋 [LEGACY] Querying extracted_positions table...\n');

  const { data, error } = await supabaseAdmin
    .from('extracted_positions')
    .select(`
      topic,
      share_of_answers_brand,
      visibility_index,
      sentiment_score,
      share_of_answers_competitor,
      visibility_index_competitor,
      sentiment_score_competitor,
      competitor_name,
      has_brand_presence
    `)
    .eq('brand_id', BRAND_ID)
    .eq('customer_id', CUSTOMER_ID)
    .not('topic', 'is', null);

  if (error) {
    console.error('❌ Error querying legacy schema:', error);
    throw error;
  }

  console.log(`✅ Found ${data?.length || 0} rows in extracted_positions\n`);

  // Group by topic
  const topicMap = new Map<string, {
    brandSOA: number[];
    brandVisibility: number[];
    brandSentiment: number[];
    competitorSOA: number[];
    competitorVisibility: number[];
    competitorSentiment: number[];
    competitorNames: Set<string>;
  }>();

  (data || []).forEach((row: any) => {
    const topic = row.topic?.toLowerCase().trim();
    if (!topic) return;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        brandSOA: [],
        brandVisibility: [],
        brandSentiment: [],
        competitorSOA: [],
        competitorVisibility: [],
        competitorSentiment: [],
        competitorNames: new Set(),
      });
    }

    const topicData = topicMap.get(topic)!;

    // Brand metrics (when competitor_name is null)
    const isBrandRow = !row.competitor_name || row.competitor_name.trim().length === 0;
    if (isBrandRow) {
      if (typeof row.share_of_answers_brand === 'number' && isFinite(row.share_of_answers_brand)) {
        topicData.brandSOA.push(row.share_of_answers_brand);
      }
      if (typeof row.visibility_index === 'number' && isFinite(row.visibility_index)) {
        // Normalize visibility to 0-100 if it's in 0-1 range
        const vis = row.visibility_index < 2 ? row.visibility_index * 100 : row.visibility_index;
        topicData.brandVisibility.push(vis);
      }
      if (typeof row.sentiment_score === 'number' && isFinite(row.sentiment_score)) {
        topicData.brandSentiment.push(row.sentiment_score);
      }
    } else {
      // Competitor metrics
      if (typeof row.share_of_answers_competitor === 'number' && isFinite(row.share_of_answers_competitor)) {
        topicData.competitorSOA.push(row.share_of_answers_competitor);
      }
      if (typeof row.visibility_index_competitor === 'number' && isFinite(row.visibility_index_competitor)) {
        const vis = row.visibility_index_competitor < 2 ? row.visibility_index_competitor * 100 : row.visibility_index_competitor;
        topicData.competitorVisibility.push(vis);
      }
      if (typeof row.sentiment_score_competitor === 'number' && isFinite(row.sentiment_score_competitor)) {
        topicData.competitorSentiment.push(row.sentiment_score_competitor);
      }
      if (row.competitor_name) {
        topicData.competitorNames.add(row.competitor_name.toLowerCase().trim());
      }
    }
  });

  // Calculate averages
  const result = new Map<string, TopicMetrics>();
  topicMap.forEach((data, topic) => {
    const avgSOA = data.brandSOA.length > 0
      ? data.brandSOA.reduce((sum, v) => sum + v, 0) / data.brandSOA.length
      : null;
    const avgVisibility = data.brandVisibility.length > 0
      ? data.brandVisibility.reduce((sum, v) => sum + v, 0) / data.brandVisibility.length
      : null;
    const avgSentiment = data.brandSentiment.length > 0
      ? data.brandSentiment.reduce((sum, v) => sum + v, 0) / data.brandSentiment.length
      : null;

    const competitorAvgSOA = data.competitorSOA.length > 0
      ? data.competitorSOA.reduce((sum, v) => sum + v, 0) / data.competitorSOA.length
      : null;
    const competitorAvgVisibility = data.competitorVisibility.length > 0
      ? data.competitorVisibility.reduce((sum, v) => sum + v, 0) / data.competitorVisibility.length
      : null;
    const competitorAvgSentiment = data.competitorSentiment.length > 0
      ? data.competitorSentiment.reduce((sum, v) => sum + v, 0) / data.competitorSentiment.length
      : null;

    result.set(topic, {
      topic,
      brandSOA: avgSOA,
      brandVisibility: avgVisibility,
      brandSentiment: avgSentiment,
      competitorAvgSOA,
      competitorAvgVisibility,
      competitorAvgSentiment,
      competitorCount: data.competitorNames.size,
      dataPointCount: data.brandSOA.length + data.competitorSOA.length,
    });
  });

  return result;
}

/**
 * Extract metrics from NEW schema (metric_facts + brand_metrics + competitor_metrics)
 */
async function extractFromNewSchema(): Promise<Map<string, TopicMetrics>> {
  console.log('\n⚡ [OPTIMIZED] Querying new schema (metric_facts + metrics tables)...\n');

  // Query brand metrics
  const { data: brandData, error: brandError } = await supabaseAdmin
    .from('metric_facts')
    .select(`
      topic,
      brand_metrics!inner(
        share_of_answers,
        visibility_index,
        has_brand_presence
      ),
      brand_sentiment(
        sentiment_score
      )
    `)
    .eq('brand_id', BRAND_ID)
    .eq('customer_id', CUSTOMER_ID)
    .not('topic', 'is', null);

  if (brandError) {
    console.error('❌ Error querying brand metrics:', brandError);
    throw brandError;
  }

  console.log(`✅ Found ${brandData?.length || 0} brand metric rows\n`);

  // Query competitor metrics
  const { data: competitorData, error: competitorError } = await supabaseAdmin
    .from('metric_facts')
    .select(`
      topic,
      competitor_metrics!inner(
        competitor_id,
        share_of_answers,
        visibility_index,
        brand_competitors!inner(
          competitor_name
        )
      ),
      competitor_sentiment(
        competitor_id,
        sentiment_score
      )
    `)
    .eq('brand_id', BRAND_ID)
    .eq('customer_id', CUSTOMER_ID)
    .not('topic', 'is', null);

  if (competitorError) {
    console.error('❌ Error querying competitor metrics:', competitorError);
    throw competitorError;
  }

  console.log(`✅ Found ${competitorData?.length || 0} competitor metric rows\n`);

  // Group by topic
  const topicMap = new Map<string, {
    brandSOA: number[];
    brandVisibility: number[];
    brandSentiment: number[];
    competitorSOA: number[];
    competitorVisibility: number[];
    competitorSentiment: number[];
    competitorNames: Set<string>;
  }>();

  // Process brand metrics
  (brandData || []).forEach((row: any) => {
    const topic = row.topic?.toLowerCase().trim();
    if (!topic) return;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        brandSOA: [],
        brandVisibility: [],
        brandSentiment: [],
        competitorSOA: [],
        competitorVisibility: [],
        competitorSentiment: [],
        competitorNames: new Set(),
      });
    }

    const topicData = topicMap.get(topic)!;
    const bm = Array.isArray(row.brand_metrics) ? row.brand_metrics[0] : row.brand_metrics;
    const bs = Array.isArray(row.brand_sentiment) ? row.brand_sentiment[0] : row.brand_sentiment;

    if (bm?.share_of_answers !== null && bm?.share_of_answers !== undefined) {
      topicData.brandSOA.push(bm.share_of_answers);
    }
    if (bm?.visibility_index !== null && bm?.visibility_index !== undefined) {
      // Normalize visibility to 0-100 if it's in 0-1 range
      const vis = bm.visibility_index < 2 ? bm.visibility_index * 100 : bm.visibility_index;
      topicData.brandVisibility.push(vis);
    }
    if (bs?.sentiment_score !== null && bs?.sentiment_score !== undefined) {
      topicData.brandSentiment.push(bs.sentiment_score);
    }
  });

  // Process competitor metrics
  (competitorData || []).forEach((row: any) => {
    const topic = row.topic?.toLowerCase().trim();
    if (!topic) return;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        brandSOA: [],
        brandVisibility: [],
        brandSentiment: [],
        competitorSOA: [],
        competitorVisibility: [],
        competitorSentiment: [],
        competitorNames: new Set(),
      });
    }

    const topicData = topicMap.get(topic)!;
    const cms = Array.isArray(row.competitor_metrics) ? row.competitor_metrics : [row.competitor_metrics];
    const css = Array.isArray(row.competitor_sentiment) ? row.competitor_sentiment : [row.competitor_sentiment];

    cms.forEach((cm: any) => {
      if (!cm) return;

      if (cm.share_of_answers !== null && cm.share_of_answers !== undefined) {
        topicData.competitorSOA.push(cm.share_of_answers);
      }
      if (cm.visibility_index !== null && cm.visibility_index !== undefined) {
        const vis = cm.visibility_index < 2 ? cm.visibility_index * 100 : cm.visibility_index;
        topicData.competitorVisibility.push(vis);
      }

      // Get competitor name
      const bc = Array.isArray(cm.brand_competitors) ? cm.brand_competitors[0] : cm.brand_competitors;
      if (bc?.competitor_name) {
        topicData.competitorNames.add(bc.competitor_name.toLowerCase().trim());
      }

      // Find matching sentiment
      const competitorId = cm.competitor_id;
      const matchingSentiment = css.find((s: any) => s?.competitor_id === competitorId);
      if (matchingSentiment?.sentiment_score !== null && matchingSentiment?.sentiment_score !== undefined) {
        topicData.competitorSentiment.push(matchingSentiment.sentiment_score);
      }
    });
  });

  // Calculate averages
  const result = new Map<string, TopicMetrics>();
  topicMap.forEach((data, topic) => {
    const avgSOA = data.brandSOA.length > 0
      ? data.brandSOA.reduce((sum, v) => sum + v, 0) / data.brandSOA.length
      : null;
    const avgVisibility = data.brandVisibility.length > 0
      ? data.brandVisibility.reduce((sum, v) => sum + v, 0) / data.brandVisibility.length
      : null;
    const avgSentiment = data.brandSentiment.length > 0
      ? data.brandSentiment.reduce((sum, v) => sum + v, 0) / data.brandSentiment.length
      : null;

    const competitorAvgSOA = data.competitorSOA.length > 0
      ? data.competitorSOA.reduce((sum, v) => sum + v, 0) / data.competitorSOA.length
      : null;
    const competitorAvgVisibility = data.competitorVisibility.length > 0
      ? data.competitorVisibility.reduce((sum, v) => sum + v, 0) / data.competitorVisibility.length
      : null;
    const competitorAvgSentiment = data.competitorSentiment.length > 0
      ? data.competitorSentiment.reduce((sum, v) => sum + v, 0) / data.competitorSentiment.length
      : null;

    result.set(topic, {
      topic,
      brandSOA: avgSOA,
      brandVisibility: avgVisibility,
      brandSentiment: avgSentiment,
      competitorAvgSOA,
      competitorAvgVisibility,
      competitorAvgSentiment,
      competitorCount: data.competitorNames.size,
      dataPointCount: data.brandSOA.length + data.competitorSOA.length,
    });
  });

  return result;
}

/**
 * Compare values with tolerance for floating point differences
 */
function valuesMatch(val1: number | null, val2: number | null, tolerance: number = 0.5): boolean {
  if (val1 === null && val2 === null) return true;
  if (val1 === null || val2 === null) return false;
  return Math.abs(val1 - val2) <= tolerance;
}

/**
 * Format value for display
 */
function formatValue(val: number | null): string {
  if (val === null) return 'null';
  return val.toFixed(2);
}

/**
 * Main comparison function
 */
async function compareSchemas() {
  console.log('\n========================================');
  console.log('   TOPICS PAGE DATA COMPARISON TEST');
  console.log('========================================\n');
  console.log(`Brand ID: ${BRAND_ID}`);
  console.log(`Customer ID: ${CUSTOMER_ID}\n`);

  try {
    // Extract from both schemas
    const legacyMetrics = await extractFromLegacySchema();
    const optimizedMetrics = await extractFromNewSchema();

    // Get all unique topics
    const allTopics = new Set([...legacyMetrics.keys(), ...optimizedMetrics.keys()]);
    console.log(`\n📊 Found ${allTopics.size} unique topics\n`);

    // Compare and build results
    const comparisons: ComparisonResult[] = [];
    let perfectMatches = 0;
    let mismatches = 0;

    allTopics.forEach(topic => {
      const legacy = legacyMetrics.get(topic) || {
        topic,
        brandSOA: null,
        brandVisibility: null,
        brandSentiment: null,
        competitorAvgSOA: null,
        competitorAvgVisibility: null,
        competitorAvgSentiment: null,
        competitorCount: 0,
        dataPointCount: 0,
      };

      const optimized = optimizedMetrics.get(topic) || {
        topic,
        brandSOA: null,
        brandVisibility: null,
        brandSentiment: null,
        competitorAvgSOA: null,
        competitorAvgVisibility: null,
        competitorAvgSentiment: null,
        competitorCount: 0,
        dataPointCount: 0,
      };

      const match = {
        brandSOA: valuesMatch(legacy.brandSOA, optimized.brandSOA),
        brandVisibility: valuesMatch(legacy.brandVisibility, optimized.brandVisibility),
        brandSentiment: valuesMatch(legacy.brandSentiment, optimized.brandSentiment),
        competitorSOA: valuesMatch(legacy.competitorAvgSOA, optimized.competitorAvgSOA),
        competitorVisibility: valuesMatch(legacy.competitorAvgVisibility, optimized.competitorAvgVisibility),
        competitorSentiment: valuesMatch(legacy.competitorAvgSentiment, optimized.competitorAvgSentiment),
      };

      const allMatch = Object.values(match).every(m => m);
      if (allMatch) {
        perfectMatches++;
      } else {
        mismatches++;
      }

      comparisons.push({ topic, legacy, optimized, match });
    });

    // Sort by topic name
    comparisons.sort((a, b) => a.topic.localeCompare(b.topic));

    // Display results
    console.log('\n========================================');
    console.log('           COMPARISON RESULTS');
    console.log('========================================\n');

    comparisons.forEach(comp => {
      const allMatch = Object.values(comp.match).every(m => m);
      const statusIcon = allMatch ? '✅' : '❌';
      
      console.log(`${statusIcon} TOPIC: ${comp.topic.toUpperCase()}`);
      console.log('─'.repeat(80));
      
      // Brand Metrics
      console.log('\n📊 BRAND METRICS:');
      console.log(`  SOA (Share of Answers):`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.brandSOA).padStart(8)}  ${comp.match.brandSOA ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.brandSOA).padStart(8)}`);
      
      console.log(`  Visibility Index:`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.brandVisibility).padStart(8)}  ${comp.match.brandVisibility ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.brandVisibility).padStart(8)}`);
      
      console.log(`  Sentiment Score:`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.brandSentiment).padStart(8)}  ${comp.match.brandSentiment ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.brandSentiment).padStart(8)}`);
      
      // Competitor Metrics
      console.log('\n🏢 COMPETITOR AVERAGE METRICS:');
      console.log(`  SOA (Share of Answers):`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.competitorAvgSOA).padStart(8)}  ${comp.match.competitorSOA ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.competitorAvgSOA).padStart(8)}`);
      
      console.log(`  Visibility Index:`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.competitorAvgVisibility).padStart(8)}  ${comp.match.competitorVisibility ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.competitorAvgVisibility).padStart(8)}`);
      
      console.log(`  Sentiment Score:`);
      console.log(`    Legacy:    ${formatValue(comp.legacy.competitorAvgSentiment).padStart(8)}  ${comp.match.competitorSentiment ? '✅' : '❌'}`);
      console.log(`    Optimized: ${formatValue(comp.optimized.competitorAvgSentiment).padStart(8)}`);
      
      console.log(`\n  Competitor Count: ${comp.legacy.competitorCount} (legacy) vs ${comp.optimized.competitorCount} (optimized)`);
      console.log(`  Data Points: ${comp.legacy.dataPointCount} (legacy) vs ${comp.optimized.dataPointCount} (optimized)`);
      console.log('\n');
    });

    // Summary
    console.log('\n========================================');
    console.log('              SUMMARY');
    console.log('========================================\n');
    console.log(`Total Topics: ${allTopics.size}`);
    console.log(`Perfect Matches: ${perfectMatches} ✅`);
    console.log(`Mismatches: ${mismatches} ❌`);
    
    const matchPercentage = allTopics.size > 0 ? ((perfectMatches / allTopics.size) * 100).toFixed(1) : '0.0';
    console.log(`Match Rate: ${matchPercentage}%`);
    
    if (mismatches === 0) {
      console.log('\n🎉 SUCCESS! All topics match perfectly between schemas!');
    } else {
      console.log(`\n⚠️ WARNING: ${mismatches} topic(s) have discrepancies. Review above for details.`);
    }
    
    console.log('\n');

  } catch (error) {
    console.error('\n❌ ERROR during comparison:', error);
    throw error;
  }
}

// Run the comparison
compareSchemas()
  .then(() => {
    console.log('✅ Comparison complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Comparison failed:', error);
    process.exit(1);
  });

