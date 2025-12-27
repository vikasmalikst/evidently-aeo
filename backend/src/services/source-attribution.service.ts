import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'
import { normalizeDateRange, round, toNumber, average } from './brand-dashboard/utils'
import { sourceAttributionCacheService } from './source-attribution-cache.service'
import { optimizedMetricsHelper } from './query-helpers/optimized-metrics.helper'

export interface SourceAttributionData {
  name: string
  url: string
  type: 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional'
  mentionRate: number
  mentionChange: number
  soa: number
  soaChange: number
  sentiment: number
  sentimentChange: number
  citations: number
  topics: string[]
  prompts: string[]
  pages: string[]
  value?: number // Composite score based on Visibility, SOA, Sentiment, Citations and Topics
  visibility?: number // Visibility index (0-100)
}

export interface SourceAttributionResponse {
  sources: SourceAttributionData[]
  overallMentionRate: number
  overallMentionChange: number
  avgSentiment: number
  avgSentimentChange: number
  totalSources: number
  dateRange: { start: string; end: string }
}


const sourceTypeMapping: Record<string, 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional'> = {
  'brand': 'brand',
  'corporate': 'corporate',
  'editorial': 'editorial',
  'reference': 'reference',
  'ugc': 'ugc',
  'user-generated': 'ugc',
  'institutional': 'institutional',
  'other': 'editorial'
}

const getSourceType = (category: string | null, domain: string | null): 'brand' | 'editorial' | 'corporate' | 'reference' | 'ugc' | 'institutional' => {
  if (!category) {
    // Infer from domain
    if (domain) {
      const lowerDomain = domain.toLowerCase()
      if (lowerDomain.includes('wikipedia') || lowerDomain.includes('britannica') || lowerDomain.includes('dictionary')) {
        return 'reference'
      }
      if (lowerDomain.includes('edu') || lowerDomain.includes('gov')) {
        return 'institutional'
      }
      if (lowerDomain.includes('reddit') || lowerDomain.includes('twitter') || lowerDomain.includes('medium') || lowerDomain.includes('github')) {
        return 'ugc'
      }
    }
    return 'editorial'
  }
  
  const normalizedCategory = category.toLowerCase().trim()
  return sourceTypeMapping[normalizedCategory] || 'editorial'
}

export class SourceAttributionService {
  async getSourceAttribution(
    brandId: string,
    customerId: string,
    dateRange?: { start: string; end: string }
  ): Promise<SourceAttributionResponse> {
    const serviceStartTime = Date.now();
    const stepTimings: Record<string, number> = {};
    
    try {
      // Step 1: Resolve brand
      const brandStartTime = Date.now();
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, slug')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .maybeSingle()
      stepTimings['brand_resolution'] = Date.now() - brandStartTime;

      if (brandError) {
        throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
      }

      if (!brand) {
        throw new DatabaseError('Brand not found for current customer')
      }

      const normalizedRange = normalizeDateRange(dateRange)
      const startIso = normalizedRange.startIso
      const endIso = normalizedRange.endIso

      // Step 2: Try Supabase cache first
      const cacheStartTime = Date.now();
      const cached = await sourceAttributionCacheService.getCachedSourceAttribution(
        brandId,
        customerId,
        startIso,
        endIso
      )
      stepTimings['cache_lookup'] = Date.now() - cacheStartTime;
      
      if (cached) {
        return cached.payload
      }

      // Step 3: Get brand domain for comparison
      const brandDomainStartTime = Date.now();
      const { data: brandData } = await supabaseAdmin
        .from('brands')
        .select('website_url')
        .eq('id', brandId)
        .single()
      stepTimings['brand_domain'] = Date.now() - brandDomainStartTime;

      const brandDomain = brandData?.website_url ? new URL(brandData.website_url).hostname.replace(/^www\./, '') : null

      // Step 4: Fetch citations - this is the main source of data
      const citationsStartTime = Date.now();
      const { data: citationsData, error: citationsError } = await supabaseAdmin
        .from('citations')
        .select(`
          domain,
          page_name,
          url,
          category,
          usage_count,
          collector_result_id,
          query_id,
          created_at
        `)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
      stepTimings['citations_query'] = Date.now() - citationsStartTime;

      if (citationsError) {
        console.error('[SourceAttribution] Citations query error:', citationsError)
        throw new DatabaseError(`Failed to fetch citations: ${citationsError.message}`)
      }

      if (!citationsData || citationsData.length === 0) {
        // Return empty response if no citations found
        return {
          sources: [],
          overallMentionRate: 0,
          overallMentionChange: 0,
          avgSentiment: 0,
          avgSentimentChange: 0,
          totalSources: 0,
          dateRange: { start: startIso, end: endIso }
        }
      }

      // Step 5: Extract IDs
      const idsExtractionStartTime = Date.now();
      const queryIdsFromCitations = Array.from(new Set(
        (citationsData || [])
          .map(c => c.query_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ))

      const collectorResultIds = Array.from(new Set(
        (citationsData || [])
          .map(c => c.collector_result_id)
          .filter((id): id is number => typeof id === 'number')
      ))
      stepTimings['ids_extraction'] = Date.now() - idsExtractionStartTime;

      // Step 6: Fetch queries for prompts and topics
      const queriesStartTime = Date.now();
      let queries: Array<{ id: string; query_text: string; topic?: string | null; metadata?: any }> = []
      if (queryIdsFromCitations.length > 0) {
        const { data: queriesData, error: queriesError } = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text, topic, metadata')
          .in('id', queryIdsFromCitations)

        if (queriesError) {
          console.warn('[SourceAttribution] Failed to fetch queries:', queriesError)
        } else {
          queries = queriesData || []
        }
      }
      stepTimings['queries_query'] = Date.now() - queriesStartTime;

      // Step 7: Fetch collector results
      const collectorResultsStartTime = Date.now();
      let collectorResults: Array<{
        id: number;
        query_id: string | null;
        question: string | null;
      }> = []

      if (collectorResultIds.length > 0) {
        const { data: collectorResultsData, error: collectorError } = await supabaseAdmin
          .from('collector_results')
          .select(`
            id,
            query_id,
            question
          `)
          .in('id', collectorResultIds)
          .eq('brand_id', brandId)

        if (collectorError) {
          console.warn('[SourceAttribution] Failed to fetch collector results:', collectorError)
        } else {
          collectorResults = collectorResultsData || []
          stepTimings['collector_results_query'] = Date.now() - collectorResultsStartTime;
        }
      }

      // Helper function to extract topic name (priority: row.topic column, then metadata)
      const extractTopicName = (row: any, metadata?: any): string | null => {
        // Priority: 1) row.topic column, 2) metadata
        if (row?.topic && typeof row.topic === 'string' && row.topic.trim().length > 0) {
          return row.topic.trim()
        }
        const meta = metadata || row?.metadata
        if (!meta) {
          return null
        }
        let parsed: any = meta
        if (typeof meta === 'string') {
          try {
            parsed = JSON.parse(meta)
          } catch {
            return null
          }
        }
        if (typeof parsed !== 'object' || parsed === null) {
          return null
        }
        const topicName =
          typeof parsed.topic_name === 'string' && parsed.topic_name.trim().length > 0
            ? parsed.topic_name.trim()
            : typeof parsed.topic === 'string' && parsed.topic.trim().length > 0
              ? parsed.topic.trim()
              : null
        return topicName
      }

      // Step 8: Fetch SoA, mention counts, topics, and sentiment from extracted_positions
      const positionsStartTime = Date.now();
      
      let extractedPositions: Array<{
        collector_result_id: number | null;
        share_of_answers_brand: number | null;
        total_brand_mentions: number | null;
        sentiment_score?: number | null;
        visibility_index?: number | null;
        competitor_name?: string | null;
        topic?: string | null;
        metadata?: any;
      }> = []

      if (collectorResultIds.length > 0) {
        // Feature flag: Use optimized query (new schema) vs legacy (extracted_positions)
        const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION === 'true';

        if (USE_OPTIMIZED_SOURCE_ATTRIBUTION) {
          console.log('   ⚡ [Source Attribution] Using optimized query (metric_facts + brand_metrics + brand_sentiment)');
          const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
            collectorResultIds,
            brandId,
            startDate: startIso,
            endDate: endIso,
          });

          if (result.error) {
            console.warn('[SourceAttribution] Failed to fetch optimized positions:', result.error);
          } else {
            extractedPositions = result.data.map(row => ({
              collector_result_id: row.collector_result_id,
              share_of_answers_brand: row.share_of_answers_brand,
              total_brand_mentions: row.total_brand_mentions,
              sentiment_score: row.sentiment_score,
              visibility_index: row.visibility_index,
              competitor_name: row.competitor_name,
              topic: row.topic || null,
              metadata: row.metadata,
            }));
            stepTimings['extracted_positions_query'] = result.duration_ms;
            console.log(`   ⚡ [Source Attribution] Optimized query completed in ${result.duration_ms}ms (${extractedPositions.length} rows)`);
            
            // Debug: Count brand vs competitor rows
            const brandRows = extractedPositions.filter(p => !p.competitor_name || p.competitor_name.trim() === '');
            const compRows = extractedPositions.filter(p => p.competitor_name && p.competitor_name.trim() !== '');
            const withSOA = brandRows.filter(p => p.share_of_answers_brand !== null && p.share_of_answers_brand !== undefined);
            const withSentiment = brandRows.filter(p => p.sentiment_score !== null && p.sentiment_score !== undefined);
            console.log(`   📊 [Source Attribution] Row breakdown: ${brandRows.length} brand rows, ${compRows.length} competitor rows`);
            console.log(`   📊 [Source Attribution] Data quality: ${withSOA.length} with SOA, ${withSentiment.length} with sentiment`);
            console.log(`   📊 [Source Attribution] Requested ${collectorResultIds.length} collector_result_ids, got data for ${new Set(extractedPositions.map(p => p.collector_result_id)).size} unique IDs`);
          }
        } else {
          console.log('   📋 [Source Attribution] Using legacy query (extracted_positions)');
          const { data: positionsData, error: positionsError } = await supabaseAdmin
            .from('extracted_positions')
            .select(`
              collector_result_id,
              share_of_answers_brand,
              total_brand_mentions,
              sentiment_score,
              visibility_index,
              competitor_name,
              topic,
              metadata
            `)
            .in('collector_result_id', collectorResultIds)
            .eq('brand_id', brandId)

          if (positionsError) {
            console.warn('[SourceAttribution] Failed to fetch extracted positions:', positionsError)
          } else {
            extractedPositions = positionsData || []
            stepTimings['extracted_positions_query'] = Date.now() - positionsStartTime;
          }
        }
      }

      // Create maps for quick lookup
      const collectorResultMap = new Map(
        collectorResults.map(cr => [cr.id, cr])
      )
      const queryMap = new Map(
        queries.map(q => [q.id, q])
      )
      
      // Create maps for share of answer, mention counts, and visibility by collector_result_id
      // Multiple positions can exist per collector_result_id, so we'll average them
      // Note: sentiment is now stored directly in collector_results (already fetched above)
      const shareOfAnswerByCollectorResult = new Map<number, number[]>()
      const mentionCountsByCollectorResult = new Map<number, number[]>()
      const visibilityByCollectorResult = new Map<number, number[]>()
      
      for (const position of extractedPositions) {
        if (position.collector_result_id) {
          const collectorId = position.collector_result_id
          
          // Collect share of answer values
          if (position.share_of_answers_brand !== null) {
            if (!shareOfAnswerByCollectorResult.has(collectorId)) {
              shareOfAnswerByCollectorResult.set(collectorId, [])
            }
            shareOfAnswerByCollectorResult.get(collectorId)!.push(toNumber(position.share_of_answers_brand))
          }
          
          // Collect mention counts (from extracted_positions, not collector_results)
          if (position.total_brand_mentions !== null && position.total_brand_mentions !== undefined) {
            if (!mentionCountsByCollectorResult.has(collectorId)) {
              mentionCountsByCollectorResult.set(collectorId, [])
            }
            mentionCountsByCollectorResult.get(collectorId)!.push(toNumber(position.total_brand_mentions))
          }

          // Collect visibility values (brand rows only, visibility_index is 0-1, convert to 0-100)
          const isBrandRow =
            !position.competitor_name ||
            (typeof position.competitor_name === 'string' && position.competitor_name.trim().length === 0)
          if (isBrandRow && position.visibility_index !== null && position.visibility_index !== undefined) {
            if (!visibilityByCollectorResult.has(collectorId)) {
              visibilityByCollectorResult.set(collectorId, [])
            }
            // visibility_index is 0-1 scale, convert to 0-100 for consistency
            visibilityByCollectorResult.get(collectorId)!.push(toNumber(position.visibility_index) * 100)
          }
        }
      }
      
      // Calculate average share of answer per collector result
      const avgShareByCollectorResult = new Map<number, number>()
      for (const [collectorId, shareValues] of shareOfAnswerByCollectorResult.entries()) {
        avgShareByCollectorResult.set(collectorId, average(shareValues))
      }

      // Calculate average visibility per collector result
      const avgVisibilityByCollectorResult = new Map<number, number>()
      for (const [collectorId, visibilityValues] of visibilityByCollectorResult.entries()) {
        avgVisibilityByCollectorResult.set(collectorId, average(visibilityValues))
      }
      
      // Collect sentiment values (brand rows only) from extracted_positions
      const sentimentValuesByCollectorResult = new Map<number, number[]>()
      
      // Create map from collector_result_id to topic name (from extracted_positions topic column or metadata)
      const collectorResultTopicMap = new Map<number, string>()
      for (const position of extractedPositions) {
        if (position.collector_result_id) {
          const topicName = extractTopicName(position, position.metadata)
          if (topicName && !collectorResultTopicMap.has(position.collector_result_id)) {
            collectorResultTopicMap.set(position.collector_result_id, topicName)
          }
        }
        
        // Sentiment: only use brand rows (no competitor_name) to match other pages
        const collectorId = position.collector_result_id
        const isBrandRow =
          !position.competitor_name ||
          (typeof position.competitor_name === 'string' && position.competitor_name.trim().length === 0)
        if (collectorId && isBrandRow && position.sentiment_score !== null && position.sentiment_score !== undefined) {
          const score = toNumber(position.sentiment_score)
          if (Number.isFinite(score)) {
            if (!sentimentValuesByCollectorResult.has(collectorId)) {
              sentimentValuesByCollectorResult.set(collectorId, [])
            }
            sentimentValuesByCollectorResult.get(collectorId)!.push(score)
          }
        }
      }
      
      const calculationsStartTime = Date.now();
      
      // Calculate average sentiment per collector result (from extracted_positions)
      const avgSentimentByCollectorResult = new Map<number, number>()
      for (const [collectorId, sentimentValues] of sentimentValuesByCollectorResult.entries()) {
        avgSentimentByCollectorResult.set(collectorId, average(sentimentValues))
      }
      stepTimings['calculations'] = Date.now() - calculationsStartTime;

      // Step 9: Aggregate sources by domain
      const aggregationStartTime = Date.now();
      const sourceAggregates = new Map<
        string,
        {
          domain: string
          url: string
          pageName: string
          category: string | null
          citations: number
          collectorResultIds: Set<number>
          shareValues: number[]
          sentimentValues: number[]
          visibilityValues: number[]
          mentionCounts: number[]
          topics: Set<string>
          queryIds: Set<string>
          pages: Set<string>
          prompts: Set<string> // Questions from collector_results
          processedCollectorResultIds: Set<number> // Track which collector_result_ids we've already processed for sentiment
        }
      >()

      for (const citation of citationsData) {
        // Use domain from citations table (it's already there)
        const domain = citation.domain || (citation.url ? (() => {
          try {
            return new URL(citation.url.startsWith('http') ? citation.url : `https://${citation.url}`).hostname.replace(/^www\./, '')
          } catch {
            return 'unknown'
          }
        })() : 'unknown')
        
        const sourceKey = domain.toLowerCase().trim()

        if (!sourceKey || sourceKey === 'unknown') {
          continue // Skip invalid domains
        }

        if (!sourceAggregates.has(sourceKey)) {
          sourceAggregates.set(sourceKey, {
            domain,
            url: citation.url || `https://${domain}`,
            pageName: citation.page_name || '',
            category: citation.category,
            citations: 0,
            collectorResultIds: new Set(),
            shareValues: [],
            sentimentValues: [],
            visibilityValues: [],
            mentionCounts: [],
            topics: new Set<string>(),
            queryIds: new Set<string>(),
            pages: new Set<string>(),
            prompts: new Set<string>(),
            processedCollectorResultIds: new Set<number>() // Track which collector_result_ids we've already processed for sentiment
          })
        }

        const aggregate = sourceAggregates.get(sourceKey)!
        aggregate.citations += citation.usage_count || 1

        // Add query_id from citation (citations table has query_id directly)
        if (citation.query_id) {
          aggregate.queryIds.add(citation.query_id)
          
          // Also get topic from query_id directly (in case collector_result doesn't have it)
          const query = queryMap.get(citation.query_id)
          if (query) {
            // Priority: 1) query.topic column, 2) query.metadata->>'topic_name', 3) query.metadata->>'topic'
            const queryTopic = query.topic || 
              (query.metadata?.topic_name || query.metadata?.topic || null)
            if (queryTopic) {
              aggregate.topics.add(queryTopic)
            }
          }
        }

        // Add collector result data if available
        if (citation.collector_result_id) {
          aggregate.collectorResultIds.add(citation.collector_result_id)
          const collectorResult = collectorResultMap.get(citation.collector_result_id)
          
          // Get topic from collector_result_id mapping (extracted from extracted_positions metadata)
          const topicName = collectorResultTopicMap.get(citation.collector_result_id)
          if (topicName) {
            aggregate.topics.add(topicName)
          }
          
          if (!collectorResult) {
            // Log missing collector result (only once per source to avoid spam)
            if (aggregate.collectorResultIds.size === 1) {
              console.warn(`[SourceAttribution] Collector result ${citation.collector_result_id} not found in map for source ${sourceKey}`)
            }
          }
          
          // Get share of answer from extracted_positions (this is the correct source)
          const avgShare = avgShareByCollectorResult.get(citation.collector_result_id)
          if (avgShare !== undefined) {
            aggregate.shareValues.push(avgShare)
          }

          // Collect all raw sentiment values for this source (not averages) for simple average calculation
          // Only add sentiment values once per collector_result_id to avoid duplicates
          if (!aggregate.processedCollectorResultIds.has(citation.collector_result_id)) {
            const rawSentimentValues = sentimentValuesByCollectorResult.get(citation.collector_result_id)
            if (rawSentimentValues && rawSentimentValues.length > 0) {
              // Add all raw sentiment values, not the average
              aggregate.sentimentValues.push(...rawSentimentValues)
              aggregate.processedCollectorResultIds.add(citation.collector_result_id)
            }
          }

          // Add visibility from extracted_positions
          const avgVisibility = avgVisibilityByCollectorResult.get(citation.collector_result_id)
          if (avgVisibility !== undefined) {
            aggregate.visibilityValues.push(avgVisibility)
          }
          
          // Get mention counts from extracted_positions (average if multiple)
          const mentionCounts = mentionCountsByCollectorResult.get(citation.collector_result_id)
          if (mentionCounts && mentionCounts.length > 0) {
            const avgMentions = average(mentionCounts)
            aggregate.mentionCounts.push(Math.round(avgMentions))
          }
          
          if (collectorResult) {
            // Add question/prompt from collector_results
            if (collectorResult.question) {
              aggregate.prompts.add(collectorResult.question)
            } else {
              // Only log if we have collector result but no question (to avoid spam)
              if (aggregate.collectorResultIds.size === 1) {
                console.warn(`[SourceAttribution] Collector result ${citation.collector_result_id} found but has no question field`)
              }
            }
            
            // Also add query_id from collector result if citation doesn't have it
            if (!citation.query_id && collectorResult.query_id) {
              aggregate.queryIds.add(collectorResult.query_id)
            }
          }
        }

        if (citation.page_name) {
          aggregate.pages.add(citation.page_name)
        }
      }

      stepTimings['aggregation'] = Date.now() - aggregationStartTime;
      
      // Debug: Check prompts per source
      for (const [sourceKey, aggregate] of sourceAggregates.entries()) {
        if (aggregate.prompts.size === 0) {
        }
      }
      
      // Debug: Log aggregation results (first 3 sources)
      const sourceKeys = Array.from(sourceAggregates.keys()).slice(0, 3);
      console.log(`   📊 [Source Attribution] Sample aggregation results (first 3 sources):`);
      for (const key of sourceKeys) {
        const agg = sourceAggregates.get(key)!;
        console.log(`      ${key}: citations=${agg.citations}, collectorResults=${agg.collectorResultIds.size}, shareValues=[${agg.shareValues.length} values: ${agg.shareValues.slice(0,3).join(', ')}...], sentimentValues=[${agg.sentimentValues.length} values]`);
      }

      // Step 10: Calculate previous period for change metrics
      // Compare the most recent day in the current period to the previous day
      // Example: If viewing Dec 1-2, compare Dec 2 (most recent) to Dec 1 (previous day)
      const previousPeriodStartTime = Date.now();
      
      // Use the end date of the current period as the "current day" to compare
      const currentDay = new Date(normalizedRange.endDate)
      currentDay.setUTCHours(0, 0, 0, 0) // Start of the most recent day
      
      // Previous day is one day before the current day
      const previousDay = new Date(currentDay)
      previousDay.setUTCDate(previousDay.getUTCDate() - 1)
      
      // Previous period is just the previous day (00:00:00 to 23:59:59)
      const previousStart = new Date(previousDay)
      previousStart.setUTCHours(0, 0, 0, 0)
      const previousEnd = new Date(previousDay)
      previousEnd.setUTCHours(23, 59, 59, 999)

      const { data: previousCitations } = await supabaseAdmin
        .from('citations')
        .select('domain, usage_count, collector_result_id')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      // Calculate previous period aggregates
      const previousSourceAggregates = new Map<string, { citations: number; mentionRate: number; soa: number; soaArray?: number[]; sentiment: number }>()
      
      if (previousCitations && previousCitations.length > 0) {
        const previousCollectorIds = Array.from(new Set(
          previousCitations.map(c => c.collector_result_id).filter((id): id is number => typeof id === 'number')
        ))
        
        // Fetch previous period share of answer and sentiment from extracted_positions
        const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION === 'true';
        let previousPositions: Array<{
          collector_result_id: number | null;
          share_of_answers_brand: number | null;
          sentiment_score?: number | null;
          competitor_name?: string | null;
        }> = [];

        if (USE_OPTIMIZED_SOURCE_ATTRIBUTION && previousCollectorIds.length > 0) {
          const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
            collectorResultIds: previousCollectorIds,
            brandId,
            startDate: previousStart.toISOString(),
            endDate: previousEnd.toISOString(),
          });

          if (!result.error && result.data) {
            previousPositions = result.data.map(row => ({
              collector_result_id: row.collector_result_id,
              share_of_answers_brand: row.share_of_answers_brand,
              sentiment_score: row.sentiment_score,
              competitor_name: row.competitor_name,
            }));
          }
        } else {
          const { data } = await supabaseAdmin
            .from('extracted_positions')
            .select('collector_result_id, share_of_answers_brand, sentiment_score, competitor_name')
            .in('collector_result_id', previousCollectorIds)
            .eq('brand_id', brandId)
            .gte('processed_at', previousStart.toISOString())
            .lte('processed_at', previousEnd.toISOString());
          previousPositions = data || [];
        }

        // Calculate average share of answer per collector result for previous period
        const previousShareByCollectorResult = new Map<number, number[]>()
        const previousSentimentValuesByCollectorResult = new Map<number, number[]>()
        
        if (previousPositions) {
          for (const position of previousPositions) {
            if (position.collector_result_id) {
              const collectorId = position.collector_result_id
              
              // Collect share of answer values
              if (position.share_of_answers_brand !== null) {
                if (!previousShareByCollectorResult.has(collectorId)) {
                  previousShareByCollectorResult.set(collectorId, [])
                }
                previousShareByCollectorResult.get(collectorId)!.push(toNumber(position.share_of_answers_brand))
              }

              const isBrandRow =
                !position.competitor_name ||
                (typeof position.competitor_name === 'string' && position.competitor_name.trim().length === 0)
              if (isBrandRow && position.sentiment_score !== null && position.sentiment_score !== undefined) {
                const score = toNumber(position.sentiment_score)
                if (Number.isFinite(score)) {
                  if (!previousSentimentValuesByCollectorResult.has(collectorId)) {
                    previousSentimentValuesByCollectorResult.set(collectorId, [])
                  }
                  previousSentimentValuesByCollectorResult.get(collectorId)!.push(score)
                }
              }
            }
          }
        }
        
        const previousAvgShareByCollectorResult = new Map<number, number>()
        for (const [collectorId, shareValues] of previousShareByCollectorResult.entries()) {
          previousAvgShareByCollectorResult.set(collectorId, average(shareValues))
        }
        
        // Average sentiment per collector result for previous period
        const previousAvgSentimentByCollectorResult = new Map<number, number>()
        for (const [collectorId, sentimentValues] of previousSentimentValuesByCollectorResult.entries()) {
          previousAvgSentimentByCollectorResult.set(collectorId, average(sentimentValues))
        }

        for (const citation of previousCitations) {
          const domain = citation.domain || 'unknown'
          const sourceKey = domain.toLowerCase().trim()

          if (!sourceKey || sourceKey === 'unknown') {
            continue
          }

          if (!previousSourceAggregates.has(sourceKey)) {
            previousSourceAggregates.set(sourceKey, { citations: 0, mentionRate: 0, soa: 0, soaArray: [], sentiment: 0 })
          }

          const prev = previousSourceAggregates.get(sourceKey)!
          prev.citations += citation.usage_count || 1

          if (citation.collector_result_id) {
            // Get share of answer from extracted_positions
            const avgShare = previousAvgShareByCollectorResult.get(citation.collector_result_id)
            if (avgShare !== undefined) {
              // Store as array to calculate average later
              if (!prev.soaArray) prev.soaArray = []
              prev.soaArray.push(avgShare)
            }
            
            // Get sentiment from collector_results
            const avgSentiment = previousAvgSentimentByCollectorResult.get(citation.collector_result_id)
            if (avgSentiment !== undefined) {
              prev.sentiment += avgSentiment
            }
          }
        }
      }

      stepTimings['previous_period'] = Date.now() - previousPeriodStartTime;

      // Step 11: Get total responses count for mention rate calculation
      const totalResponsesStartTime = Date.now();
      const { count: totalResponses } = await supabaseAdmin
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      const totalResponsesCount = totalResponses || 1 // Avoid division by zero
      stepTimings['total_responses'] = Date.now() - totalResponsesStartTime;

      // Step 12: Convert aggregates to source data
      const conversionStartTime = Date.now();
      const sources: SourceAttributionData[] = []
      // Calculate max values for normalization in Value score
      const maxCitations = Math.max(...Array.from(sourceAggregates.values()).map(a => a.citations), 1)
      const maxTopics = Math.max(...Array.from(sourceAggregates.values()).map(a => a.topics.size), 1)
      // Calculate max sentiment from all sentiment values (use new sentiment range without fixed normalization)
      const allSentimentValues = Array.from(sourceAggregates.values())
        .flatMap(a => a.sentimentValues.length > 0 ? [average(a.sentimentValues)] : [])
      const maxSentiment = allSentimentValues.length > 0 ? Math.max(...allSentimentValues, 1) : 1

      for (const [sourceKey, aggregate] of sourceAggregates.entries()) {
        // Share of Answer: Average across all collector results where this source is cited
        // share_of_answers_brand is stored as 0-100 percentage format (confirmed in position-extraction.service.ts:736)
        const avgShareRaw = aggregate.shareValues.length > 0 ? average(aggregate.shareValues) : 0
        const avgShare = avgShareRaw // Already in 0-100 format, no normalization needed
        
        const avgSentiment = aggregate.sentimentValues.length > 0 ? average(aggregate.sentimentValues) : 0
        const avgVisibility = aggregate.visibilityValues.length > 0 ? average(aggregate.visibilityValues) : 0
        const totalMentions = aggregate.mentionCounts.reduce((sum, count) => sum + count, 0)
        
        // Mention Rate: percentage of total collector results where this source is cited
        // Formula: (Number of unique collector results citing this source / Total collector results) * 100
        // Example: If learn.microsoft.com is cited in 8 out of 23 total responses, mention rate = (8/23) * 100 = 34.8%
        const uniqueCollectorResults = aggregate.collectorResultIds.size
        const mentionRate = totalResponsesCount > 0 ? (uniqueCollectorResults / totalResponsesCount) * 100 : 0

        // Calculate Value: Composite score based on Visibility, SOA, Sentiment, Citations and Topics
        // Normalize all components to 0-100 scale, then weight them
        // Visibility (0-100): avgVisibility is already 0-100
        // SOA (0-100): avgShare is already 0-100
        // Sentiment: Use new sentiment range - normalize relative to max sentiment in dataset (no fixed range normalization)
        // Citations: normalize to 0-100: (citations / maxCitations) * 100
        // Topics: normalize to 0-100: (topics.size / maxTopics) * 100
        // Equal weighting: 20% each
        const normalizedVisibility = Math.min(100, Math.max(0, avgVisibility))
        const normalizedSOA = Math.min(100, Math.max(0, avgShare))
        // Use raw sentiment value, normalize relative to max sentiment in dataset (no fixed -1 to 1 normalization)
        const normalizedSentiment = maxSentiment > 0 ? Math.min(100, Math.max(0, (avgSentiment / maxSentiment) * 100)) : 0
        const normalizedCitations = maxCitations > 0 ? Math.min(100, (aggregate.citations / maxCitations) * 100) : 0
        const normalizedTopics = maxTopics > 0 ? Math.min(100, (aggregate.topics.size / maxTopics) * 100) : 0
        
        const value = round(
          (normalizedVisibility * 0.2) +
          (normalizedSOA * 0.2) +
          (normalizedSentiment * 0.2) +
          (normalizedCitations * 0.2) +
          (normalizedTopics * 0.2),
          1
        )

        // Calculate changes from previous period
        const previous = previousSourceAggregates.get(sourceKey)
        // For previous period, we need to calculate mention rate similarly
        // Since we don't have the previous period's total responses, we'll use a simple comparison
        const previousMentionRate = previous ? (previous.citations / Math.max(totalResponsesCount, 1)) * 100 : 0
        // Previous SoA: average the share values if available, otherwise use the old summed value
        const previousSoaRaw = previous && previous.soaArray && previous.soaArray.length > 0
          ? average(previous.soaArray)
          : (previous ? previous.soa : 0)
        const previousSoa = previousSoaRaw // Already in 0-100 format, no normalization needed
        const previousSentiment = previous ? previous.sentiment : 0

        const mentionChange = mentionRate - previousMentionRate
        const soaChange = avgShare - previousSoa
        const sentimentChange = avgSentiment - previousSentiment

        // Determine if this is the brand's own domain
        const isBrandDomain = brandDomain && (
          aggregate.domain.toLowerCase() === brandDomain.toLowerCase() ||
          aggregate.domain.toLowerCase().includes(brandDomain.toLowerCase()) ||
          brandDomain.toLowerCase().includes(aggregate.domain.toLowerCase())
        )
        const sourceType = isBrandDomain ? 'brand' : getSourceType(aggregate.category, aggregate.domain)

        sources.push({
          name: aggregate.domain,
          url: aggregate.url,
          type: sourceType,
          mentionRate: round(mentionRate, 1),
          mentionChange: round(mentionChange, 1),
          soa: round(avgShare, 1), // This is now a percentage (0-100)
          soaChange: round(soaChange, 1),
          sentiment: round(avgSentiment, 2),
          sentimentChange: round(sentimentChange, 2),
          citations: aggregate.citations,
          topics: Array.from(aggregate.topics),
          visibility: round(avgVisibility, 1),
          value: value,
          // Use prompts from collector_results.question, fallback to query_text from generated_queries
          prompts: (() => {
            const promptsFromCollector = Array.from(aggregate.prompts)
            if (promptsFromCollector.length > 0) {
              return promptsFromCollector
            }
            const promptsFromQueries = Array.from(aggregate.queryIds).map(qId => {
              const query = queryMap.get(qId)
              return query?.query_text || ''
            }).filter(Boolean)
            if (promptsFromQueries.length > 0) {
              return promptsFromQueries
            }
            return []
          })(),
          pages: Array.from(aggregate.pages)
        })
      }

      // Sort by Value descending (composite score), then by mention rate as tiebreaker
      sources.sort((a, b) => (b.value || 0) - (a.value || 0) || b.mentionRate - a.mentionRate)
      
      stepTimings['conversion'] = Date.now() - conversionStartTime;

      // Calculate overall metrics
      const overallMentionRate = sources.length > 0
        ? round(average(sources.map(s => s.mentionRate)), 1)
        : 0

      const avgSentiment = sources.length > 0
        ? round(average(sources.map(s => s.sentiment)), 2)
        : 0

      // Calculate previous period overall metrics
      const previousOverallMentionRate = previousSourceAggregates.size > 0
        ? round(average(Array.from(previousSourceAggregates.values()).map(p => (p.citations / (totalResponsesCount || 1)) * 100)), 1)
        : 0

      const previousAvgSentiment = previousSourceAggregates.size > 0
        ? round(average(Array.from(previousSourceAggregates.values()).map(p => p.sentiment)), 2)
        : 0

      const payload: SourceAttributionResponse = {
        sources,
        overallMentionRate,
        overallMentionChange: round(overallMentionRate - previousOverallMentionRate, 1),
        avgSentiment,
        avgSentimentChange: round(avgSentiment - previousAvgSentiment, 2),
        totalSources: sources.length,
        dateRange: { start: startIso, end: endIso }
      }

      // Step 13: Cache the computed payload in Supabase (async, don't await to avoid blocking response)
      const cacheSaveStartTime = Date.now();
      sourceAttributionCacheService.upsertSourceAttributionSnapshot(
        brandId,
        customerId,
        payload,
        startIso,
        endIso
      ).catch(err => {
        console.warn('[SourceAttribution] Failed to cache snapshot (non-blocking):', err)
      })
      stepTimings['cache_save'] = Date.now() - cacheSaveStartTime;

      // Final summary
      const totalTime = Date.now() - serviceStartTime;
      console.log(`\n[SourceAttribution] ⏱️  PERFORMANCE SUMMARY:`)
      console.log(`[SourceAttribution]    Total time: ${totalTime}ms`)
      console.log(`[SourceAttribution]    Step timings:`)
      Object.entries(stepTimings).forEach(([step, time]) => {
        const percentage = ((time / totalTime) * 100).toFixed(1)
        console.log(`[SourceAttribution]      - ${step}: ${time}ms (${percentage}%)`)
      })
      console.log(`[SourceAttribution] ✅ Service completed successfully\n`)

      return payload
    } catch (error) {
      console.error('[SourceAttribution] Error:', error)
      throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error in source attribution')
    }
  }

  /**
   * Get source attribution for a competitor brand
   */
  async getCompetitorSourceAttribution(
    brandId: string,
    customerId: string,
    competitorName: string,
    dateRange?: { start: string; end: string }
  ): Promise<SourceAttributionResponse> {
    const serviceStartTime = Date.now();
    const stepTimings: Record<string, number> = {};
    
    try {
      // Step 1: Resolve brand
      const brandStartTime = Date.now();
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, slug')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .maybeSingle()
      stepTimings['brand_resolution'] = Date.now() - brandStartTime;

      if (brandError) {
        throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
      }

      if (!brand) {
        throw new DatabaseError('Brand not found for current customer')
      }

      // Verify competitor exists for this brand
      const { data: competitorData, error: competitorError } = await supabaseAdmin
        .from('brand_competitors')
        .select('competitor_name')
        .eq('brand_id', brandId)
        .eq('competitor_name', competitorName)
        .maybeSingle()

      if (competitorError || !competitorData) {
        throw new DatabaseError(`Competitor "${competitorName}" not found for this brand`)
      }

      const normalizedRange = normalizeDateRange(dateRange)
      const startIso = normalizedRange.startIso
      const endIso = normalizedRange.endIso


      // Step 2: Fetch extracted_positions for this competitor
      const positionsStartTime = Date.now();
      const { data: positionsData, error: positionsError } = await supabaseAdmin
        .from('extracted_positions')
        .select(`
          collector_result_id,
          competitor_name,
          competitor_mentions,
          share_of_answers_competitor,
          sentiment_score_competitor,
          visibility_index_competitor,
          topic,
          metadata,
          processed_at
        `)
        .eq('brand_id', brandId)
        .eq('competitor_name', competitorName)
        .gte('processed_at', startIso)
        .lte('processed_at', endIso)
      stepTimings['positions_query'] = Date.now() - positionsStartTime;

      if (positionsError) {
        console.error('[CompetitorSourceAttribution] Positions query error:', positionsError)
        throw new DatabaseError(`Failed to fetch positions: ${positionsError.message}`)
      }


      if (!positionsData || positionsData.length === 0) {
        // Return empty response if no positions found
        return {
          sources: [],
          overallMentionRate: 0,
          overallMentionChange: 0,
          avgSentiment: 0,
          avgSentimentChange: 0,
          totalSources: 0,
          dateRange: { start: startIso, end: endIso }
        }
      }

      // Step 3: Get collector_result_ids from positions
      const collectorResultIds = Array.from(new Set(
        positionsData.map(p => p.collector_result_id).filter((id): id is number => typeof id === 'number')
      ))


      // Step 4: Fetch citations for these collector results
      const citationsStartTime = Date.now();
      const { data: citationsData, error: citationsError } = await supabaseAdmin
        .from('citations')
        .select(`
          domain,
          page_name,
          url,
          category,
          usage_count,
          collector_result_id,
          query_id,
          created_at
        `)
        .eq('brand_id', brandId)
        .in('collector_result_id', collectorResultIds)
      stepTimings['citations_query'] = Date.now() - citationsStartTime;

      if (citationsError) {
        console.error('[CompetitorSourceAttribution] Citations query error:', citationsError)
        throw new DatabaseError(`Failed to fetch citations: ${citationsError.message}`)
      }


      if (!citationsData || citationsData.length === 0) {
        return {
          sources: [],
          overallMentionRate: 0,
          overallMentionChange: 0,
          avgSentiment: 0,
          avgSentimentChange: 0,
          totalSources: 0,
          dateRange: { start: startIso, end: endIso }
        }
      }

      // Step 5: Fetch queries and collector results for prompts
      const queryIdsFromCitations = Array.from(new Set(
        citationsData.map(c => c.query_id).filter((id): id is string => typeof id === 'string')
      ))

      const queriesStartTime = Date.now();
      let queries: Array<{ id: string; query_text: string; topic?: string | null }> = []
      if (queryIdsFromCitations.length > 0) {
        const { data: queriesData } = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text, topic')
          .in('id', queryIdsFromCitations)
        queries = queriesData || []
      }
      stepTimings['queries_query'] = Date.now() - queriesStartTime;

      const collectorResultsStartTime = Date.now();
      let collectorResults: Array<{ id: number; query_id: string | null; question: string | null }> = []
      if (collectorResultIds.length > 0) {
        const { data: collectorResultsData } = await supabaseAdmin
          .from('collector_results')
          .select('id, query_id, question')
          .in('id', collectorResultIds)
        collectorResults = collectorResultsData || []
      }
      stepTimings['collector_results_query'] = Date.now() - collectorResultsStartTime;


      // Create lookup maps
      const queryMap = new Map(queries.map(q => [q.id, q]))
      const collectorResultMap = new Map(collectorResults.map(cr => [cr.id, cr]))
      
      // Create maps for metrics by collector_result_id
      const shareByCollectorResult = new Map<number, number[]>()
      const sentimentByCollectorResult = new Map<number, number[]>()
      const mentionsByCollectorResult = new Map<number, number>()
      
      for (const position of positionsData) {
        const collectorId = position.collector_result_id
        if (!collectorId) continue
        
        if (position.share_of_answers_competitor !== null) {
          if (!shareByCollectorResult.has(collectorId)) {
            shareByCollectorResult.set(collectorId, [])
          }
          shareByCollectorResult.get(collectorId)!.push(toNumber(position.share_of_answers_competitor))
        }
        
        if (position.sentiment_score_competitor !== null) {
          if (!sentimentByCollectorResult.has(collectorId)) {
            sentimentByCollectorResult.set(collectorId, [])
          }
          sentimentByCollectorResult.get(collectorId)!.push(toNumber(position.sentiment_score_competitor))
        }
        
        if (position.competitor_mentions !== null) {
          mentionsByCollectorResult.set(collectorId, toNumber(position.competitor_mentions))
        }
      }

      // Calculate averages
      const avgShareByCollectorResult = new Map<number, number>()
      for (const [collectorId, shareValues] of shareByCollectorResult.entries()) {
        avgShareByCollectorResult.set(collectorId, average(shareValues))
      }
      
      const avgSentimentByCollectorResult = new Map<number, number>()
      for (const [collectorId, sentimentValues] of sentimentByCollectorResult.entries()) {
        avgSentimentByCollectorResult.set(collectorId, average(sentimentValues))
      }


      // Step 6: Aggregate sources by domain
      const aggregationStartTime = Date.now();
      const sourceAggregates = new Map<
        string,
        {
          domain: string
          url: string
          pageName: string
          category: string | null
          citations: number
          collectorResultIds: Set<number>
          shareValues: number[]
          sentimentValues: number[]
          visibilityValues: number[]
          mentionCounts: number[]
          topics: Set<string>
          queryIds: Set<string>
          pages: Set<string>
          prompts: Set<string>
        }
      >()

      for (const citation of citationsData) {
        const domain = citation.domain || (citation.url ? (() => {
          try {
            return new URL(citation.url.startsWith('http') ? citation.url : `https://${citation.url}`).hostname.replace(/^www\./, '')
          } catch {
            return 'unknown'
          }
        })() : 'unknown')
        
        const sourceKey = domain.toLowerCase().trim()
        if (!sourceKey || sourceKey === 'unknown') continue

        if (!sourceAggregates.has(sourceKey)) {
          sourceAggregates.set(sourceKey, {
            domain,
            url: citation.url || `https://${domain}`,
            pageName: citation.page_name || '',
            category: citation.category,
            citations: 0,
            collectorResultIds: new Set(),
            shareValues: [],
            sentimentValues: [],
            visibilityValues: [],
            mentionCounts: [],
            topics: new Set<string>(),
            queryIds: new Set<string>(),
            pages: new Set<string>(),
            prompts: new Set<string>()
          })
        }

        const aggregate = sourceAggregates.get(sourceKey)!
        aggregate.citations += citation.usage_count || 1

        if (citation.query_id) {
          aggregate.queryIds.add(citation.query_id)
          const query = queryMap.get(citation.query_id)
          if (query?.topic) {
            aggregate.topics.add(query.topic)
          }
        }

        if (citation.collector_result_id) {
          aggregate.collectorResultIds.add(citation.collector_result_id)
          
          const avgShare = avgShareByCollectorResult.get(citation.collector_result_id)
          if (avgShare !== undefined) {
            aggregate.shareValues.push(avgShare)
          }

          const avgSentiment = avgSentimentByCollectorResult.get(citation.collector_result_id)
          if (avgSentiment !== undefined) {
            aggregate.sentimentValues.push(avgSentiment)
          }
          
          const mentions = mentionsByCollectorResult.get(citation.collector_result_id)
          if (mentions !== undefined) {
            aggregate.mentionCounts.push(mentions)
          }
          
          const collectorResult = collectorResultMap.get(citation.collector_result_id)
          if (collectorResult?.question) {
            aggregate.prompts.add(collectorResult.question)
          }
        }

        if (citation.page_name) {
          aggregate.pages.add(citation.page_name)
        }
      }

      stepTimings['aggregation'] = Date.now() - aggregationStartTime;

      // Step 7: Get total responses count for mention rate
      const totalResponsesStartTime = Date.now();
      const { count: totalResponses } = await supabaseAdmin
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      const totalResponsesCount = totalResponses || 1
      stepTimings['total_responses'] = Date.now() - totalResponsesStartTime;

      // Step 8: Convert aggregates to source data
      const sources: SourceAttributionData[] = []
      
      for (const [sourceKey, aggregate] of sourceAggregates.entries()) {
        const avgShare = aggregate.shareValues.length > 0 ? average(aggregate.shareValues) : 0
        const avgSentiment = aggregate.sentimentValues.length > 0 ? average(aggregate.sentimentValues) : 0
        
        const uniqueCollectorResults = aggregate.collectorResultIds.size
        const mentionRate = totalResponsesCount > 0 ? (uniqueCollectorResults / totalResponsesCount) * 100 : 0

        const sourceType = getSourceType(aggregate.category, aggregate.domain)

        sources.push({
          name: aggregate.domain,
          url: aggregate.url,
          type: sourceType,
          mentionRate: round(mentionRate, 1),
          mentionChange: 0, // TODO: Calculate from previous period if needed
          soa: round(avgShare, 1),
          soaChange: 0, // TODO: Calculate from previous period if needed
          sentiment: round(avgSentiment, 2),
          sentimentChange: 0, // TODO: Calculate from previous period if needed
          citations: aggregate.citations,
          topics: Array.from(aggregate.topics),
          prompts: Array.from(aggregate.prompts).length > 0 
            ? Array.from(aggregate.prompts)
            : Array.from(aggregate.queryIds).map(qId => queryMap.get(qId)?.query_text || '').filter(Boolean),
          pages: Array.from(aggregate.pages)
        })
      }

      // Sort by mention rate descending
      sources.sort((a, b) => b.mentionRate - a.mentionRate)

      // Calculate overall metrics
      const overallMentionRate = sources.length > 0
        ? round(average(sources.map(s => s.mentionRate)), 1)
        : 0

      const avgSentiment = sources.length > 0
        ? round(average(sources.map(s => s.sentiment)), 2)
        : 0

      const payload: SourceAttributionResponse = {
        sources,
        overallMentionRate,
        overallMentionChange: 0, // TODO: Calculate from previous period if needed
        avgSentiment,
        avgSentimentChange: 0, // TODO: Calculate from previous period if needed
        totalSources: sources.length,
        dateRange: { start: startIso, end: endIso }
      }

      const totalTime = Date.now() - serviceStartTime;

      return payload
    } catch (error) {
      console.error('[CompetitorSourceAttribution] Error:', error)
      throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error in competitor source attribution')
    }
  }

  /**
   * Get daily Impact Score trends for top sources over the last 7 days
   */
  async getImpactScoreTrends(
    brandId: string,
    customerId: string,
    days: number = 7,
    selectedSources?: string[],
    metric: 'impactScore' | 'mentionRate' | 'soa' | 'sentiment' | 'citations' = 'impactScore',
    dateRange?: { start: string; end: string }
  ): Promise<{
    dates: string[]
    sources: Array<{
      name: string
      data: number[]
    }>
  }> {
    try {
      const selectedSet =
        selectedSources && selectedSources.length
          ? new Set(selectedSources.map((s) => s.toLowerCase().trim()).filter((s) => s.length > 0))
          : null

      // Calculate date range (last N days) or use provided range
      let startDate: Date
      let endDate: Date

      if (dateRange && dateRange.start && dateRange.end) {
        startDate = new Date(dateRange.start)
        endDate = new Date(dateRange.end)
        // Ensure times
        startDate.setUTCHours(0, 0, 0, 0)
        endDate.setUTCHours(23, 59, 59, 999)
      } else {
        endDate = new Date()
        endDate.setUTCHours(23, 59, 59, 999)
        startDate = new Date(endDate)
        startDate.setUTCDate(startDate.getUTCDate() - (days - 1))
        startDate.setUTCHours(0, 0, 0, 0)
      }

      const startIso = startDate.toISOString()
      const endIso = endDate.toISOString()

      // Fetch citations grouped by day and domain
      const { data: citationsData, error: citationsError } = await supabaseAdmin
        .from('citations')
        .select(`
          domain,
          usage_count,
          collector_result_id,
          query_id,
          created_at
        `)
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      if (citationsError) {
        throw new DatabaseError(`Failed to fetch citations: ${citationsError.message}`)
      }

      if (!citationsData || citationsData.length === 0) {
        return { dates: [], sources: [] }
      }

      // Get collector result IDs
      const collectorResultIds = Array.from(new Set(
        citationsData.map(c => c.collector_result_id).filter((id): id is number => typeof id === 'number')
      ))

      // Fetch extracted_positions for share, sentiment, visibility
      const USE_OPTIMIZED_SOURCE_ATTRIBUTION = process.env.USE_OPTIMIZED_SOURCE_ATTRIBUTION === 'true';
      let positionsData: Array<{
        collector_result_id: number | null;
        share_of_answers_brand: number | null;
        total_brand_mentions: number | null;
        sentiment_score?: number | null;
        visibility_index?: number | null;
        competitor_name?: string | null;
        processed_at: string;
      }> = [];

      if (USE_OPTIMIZED_SOURCE_ATTRIBUTION && collectorResultIds.length > 0) {
        const result = await optimizedMetricsHelper.fetchSourceAttributionMetrics({
          collectorResultIds,
          brandId,
          startDate: startIso,
          endDate: endIso,
        });

        if (!result.error && result.data) {
          positionsData = result.data.map(row => ({
            collector_result_id: row.collector_result_id,
            share_of_answers_brand: row.share_of_answers_brand,
            total_brand_mentions: row.total_brand_mentions,
            sentiment_score: row.sentiment_score,
            visibility_index: row.visibility_index,
            competitor_name: row.competitor_name,
            processed_at: row.processed_at,
          }));
        }
      } else {
        const { data } = await supabaseAdmin
          .from('extracted_positions')
          .select(`
            collector_result_id,
            share_of_answers_brand,
            total_brand_mentions,
            sentiment_score,
            visibility_index,
            competitor_name,
            processed_at
          `)
          .in('collector_result_id', collectorResultIds)
          .eq('brand_id', brandId)
          .gte('processed_at', startIso)
          .lte('processed_at', endIso);
        positionsData = data || [];
      }

      // Fetch queries for topics
      const queryIds = Array.from(new Set(
        citationsData.map(c => c.query_id).filter((id): id is string => typeof id === 'string')
      ))

      const { data: queriesData } = await supabaseAdmin
        .from('generated_queries')
        .select('id, topic, metadata')
        .in('id', queryIds)

      // Create maps for quick lookup
      const queryMap = new Map(queriesData?.map(q => [q.id, q]) || [])

      // Group positions by collector_result_id and date
      const positionsByCollectorAndDate = new Map<string, Array<typeof positionsData[0]>>()
      if (positionsData) {
        for (const pos of positionsData) {
          if (!pos.collector_result_id || !pos.processed_at) continue
          const date = new Date(pos.processed_at).toISOString().split('T')[0]
          const key = `${pos.collector_result_id}_${date}`
          if (!positionsByCollectorAndDate.has(key)) {
            positionsByCollectorAndDate.set(key, [])
          }
          positionsByCollectorAndDate.get(key)!.push(pos)
        }
      }

      // Generate date labels
      const dates: string[] = []
      const current = new Date(startDate)
      while (current <= endDate) {
        dates.push(current.toISOString().split('T')[0])
        current.setUTCDate(current.getUTCDate() + 1)
      }

      // Group citations by domain and date
      const citationsByDomainAndDate = new Map<string, Map<string, typeof citationsData>>()
      
      for (const citation of citationsData) {
        if (!citation.domain || !citation.created_at) continue
        const domain = citation.domain.toLowerCase().trim()
        if (selectedSet && !selectedSet.has(domain)) continue
        const date = new Date(citation.created_at).toISOString().split('T')[0]
        
        if (!citationsByDomainAndDate.has(domain)) {
          citationsByDomainAndDate.set(domain, new Map())
        }
        const domainMap = citationsByDomainAndDate.get(domain)!
        if (!domainMap.has(date)) {
          domainMap.set(date, [])
        }
        domainMap.get(date)!.push(citation)
      }

      // Total citations per day across ALL domains (not just selected)
      const totalCitationsByDate = new Map<string, number>()
      for (const citation of citationsData) {
        if (!citation.created_at) continue
        const date = new Date(citation.created_at).toISOString().split('T')[0]
        const prev = totalCitationsByDate.get(date) || 0
        totalCitationsByDate.set(date, prev + (citation.usage_count || 1))
      }

      // Fetch daily total responses for Mention Rate calculation
      const { data: dailyResponsesData } = await supabaseAdmin
        .from('collector_results')
        .select('created_at')
        .eq('brand_id', brandId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
      
      const totalResponsesByDate = new Map<string, number>()
      if (dailyResponsesData) {
        for (const r of dailyResponsesData) {
          const date = new Date(r.created_at).toISOString().split('T')[0]
          totalResponsesByDate.set(date, (totalResponsesByDate.get(date) || 0) + 1)
        }
      }

      // Calculate Impact Score for each domain and date
      const impactScoresByDomain = new Map<string, number[]>()
      
      // Calculate daily aggregates to find max values for normalization
      let globalMaxDailyCitations = 1
      let globalMaxDailyTopics = 1
      // Use fixed max sentiment of 1.0 (assuming 0-1 scale) or calculate from data if needed
      // But to match "no normalization" request better, let's use the actual max found
      let globalMaxDailySentiment = 1

      const dailyAggregates = new Map<string, {
        totalCitations: number,
        uniqueTopics: Set<string>,
        avgSentiment: number,
        uniqueCollectorResults: Set<number>
      }>()

      // First pass: Calculate daily aggregates and find max values
      for (const date of dates) {
        for (const [domain, dateMap] of citationsByDomainAndDate.entries()) {
          const dayCitations = dateMap.get(date) || []
          if (dayCitations.length === 0) continue

          let totalCitations = 0
          const dayTopics = new Set<string>()
          const sentimentValues: number[] = []
          const dayCollectorResults = new Set<number>()

          for (const citation of dayCitations) {
            totalCitations += citation.usage_count || 1
            if (citation.collector_result_id) {
              dayCollectorResults.add(citation.collector_result_id)
            }
            
            if (citation.query_id) {
              const query = queryMap.get(citation.query_id)
              if (query?.topic) {
                dayTopics.add(query.topic)
              }
            }

            if (citation.collector_result_id) {
              const key = `${citation.collector_result_id}_${date}`
              const positions = positionsByCollectorAndDate.get(key) || []
              for (const pos of positions) {
                const isBrandRow = !pos.competitor_name || 
                  (typeof pos.competitor_name === 'string' && pos.competitor_name.trim().length === 0)
                if (isBrandRow && pos.sentiment_score !== null) {
                  sentimentValues.push(toNumber(pos.sentiment_score))
                }
              }
            }
          }

          const avgSentiment = sentimentValues.length > 0 ? average(sentimentValues) : 0
          
          globalMaxDailyCitations = Math.max(globalMaxDailyCitations, totalCitations)
          globalMaxDailyTopics = Math.max(globalMaxDailyTopics, dayTopics.size)
          globalMaxDailySentiment = Math.max(globalMaxDailySentiment, avgSentiment)

          dailyAggregates.set(`${domain}_${date}`, {
            totalCitations,
            uniqueTopics: dayTopics,
            avgSentiment,
            uniqueCollectorResults: dayCollectorResults
          })
        }
      }

      // Ensure sentiment max is at least 1 to avoid division by zero or tiny numbers
      globalMaxDailySentiment = Math.max(globalMaxDailySentiment, 1)

      // Second pass: Calculate scores
      for (const date of dates) {
        for (const [domain, dateMap] of citationsByDomainAndDate.entries()) {
          const dayCitations = dateMap.get(date) || []
          
          if (dayCitations.length === 0) {
            // No data for this day - RETURN 0 (No fill-forward)
            if (!impactScoresByDomain.has(domain)) {
              impactScoresByDomain.set(domain, [])
            }
            impactScoresByDomain.get(domain)!.push(0)
            continue
          }

          const agg = dailyAggregates.get(`${domain}_${date}`)!
          
          // Re-calculate averages for SOA and Visibility (we didn't cache them in first pass)
          const shareValues: number[] = []
          const visibilityValues: number[] = []

          for (const citation of dayCitations) {
            if (citation.collector_result_id) {
              const key = `${citation.collector_result_id}_${date}`
              const positions = positionsByCollectorAndDate.get(key) || []
              for (const pos of positions) {
                const isBrandRow = !pos.competitor_name || 
                  (typeof pos.competitor_name === 'string' && pos.competitor_name.trim().length === 0)
                if (isBrandRow) {
                  if (pos.share_of_answers_brand !== null) shareValues.push(toNumber(pos.share_of_answers_brand))
                  if (pos.visibility_index !== null) visibilityValues.push(toNumber(pos.visibility_index) * 100)
                }
              }
            }
          }

          const avgShare = shareValues.length > 0 ? average(shareValues) : 0
          // const avgVisibility = visibilityValues.length > 0 ? average(visibilityValues) : 0

          // Calculate normalized metrics for Impact Score
          // const normalizedVisibility = Math.min(100, Math.max(0, avgVisibility))
          const normalizedSOA = Math.min(100, Math.max(0, avgShare))
          
          // Normalize relative to global max daily values
          const normalizedSentiment = (agg.avgSentiment / globalMaxDailySentiment) * 100
          const normalizedCitations = (agg.totalCitations / globalMaxDailyCitations) * 100
          const normalizedTopics = (agg.uniqueTopics.size / globalMaxDailyTopics) * 100

          // Calculate Mention Rate (percentage of total responses)
          const totalResponses = totalResponsesByDate.get(date) || 1
          const mentionRate = Math.min(100, (agg.uniqueCollectorResults.size / totalResponses) * 100)

          // Weights matching Frontend (SearchSourcesR2.tsx):
          // Mention: 0.3
          // SOA: 0.3
          // Sentiment: 0.2
          // Citations: 0.1
          // Topics: 0.1
          const impactScore = round(
            (mentionRate * 0.3) +
            (normalizedSOA * 0.3) +
            (normalizedSentiment * 0.2) +
            (normalizedCitations * 0.1) +
            (normalizedTopics * 0.1),
            1
          )

          const metricValue = (() => {

            switch (metric) {
              case 'mentionRate':
                return round(mentionRate, 1)
              case 'soa':
                return round(avgShare, 1) // Raw SOA
              case 'sentiment':
                return round(agg.avgSentiment, 2) // Raw Sentiment
              case 'citations':
                return agg.totalCitations // Raw Citations
              case 'impactScore':
              default:
                return impactScore
            }
          })()

          if (!impactScoresByDomain.has(domain)) {
            impactScoresByDomain.set(domain, [])
          }
          impactScoresByDomain.get(domain)!.push(metricValue)
        }
      }

      let sources: Array<{ name: string; data: number[] }> = []
      if (selectedSet && selectedSources && selectedSources.length) {
        // Preserve requested order (max 10) and fill missing with zeros.
        const requested = selectedSources
          .map((s) => s.toLowerCase().trim())
          .filter((s) => s.length > 0)
          .slice(0, 10)

        sources = requested.map((domain) => ({
          name: domain,
          data: impactScoresByDomain.get(domain) ?? Array(dates.length).fill(0)
        }))
      } else {
        // Default: top 10 domains by average Impact Score
      const domainAverages = Array.from(impactScoresByDomain.entries())
        .map(([domain, scores]) => ({
          domain,
          scores,
          average: scores.length > 0 ? average(scores) : 0
        }))
        .sort((a, b) => b.average - a.average)
        .slice(0, 10)

        sources = domainAverages.map(({ domain, scores }) => ({
        name: domain,
        data: scores
      }))
      }

      // Format dates for display
      const formattedDates = dates.map(date => {
        const d = new Date(date)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })

      return {
        dates: formattedDates,
        sources
      }
    } catch (error) {
      console.error('[ImpactScoreTrends] Error:', error)
      throw new DatabaseError(error instanceof Error ? error.message : 'Unknown error in Impact Score trends')
    }
  }
}

export const sourceAttributionService = new SourceAttributionService()

