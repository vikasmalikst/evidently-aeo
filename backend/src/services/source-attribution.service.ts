import { supabaseAdmin } from '../config/database'
import { DatabaseError } from '../types/auth'
import { normalizeDateRange, round, toNumber, average, toPercentage } from './brand-dashboard/utils'

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
    try {
      // Resolve brand
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, slug')
        .eq('id', brandId)
        .eq('customer_id', customerId)
        .maybeSingle()

      if (brandError) {
        throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
      }

      if (!brand) {
        throw new DatabaseError('Brand not found for current customer')
      }

      const normalizedRange = normalizeDateRange(dateRange)
      const startIso = normalizedRange.startIso
      const endIso = normalizedRange.endIso

      // Get brand domain for comparison
      const { data: brandData } = await supabaseAdmin
        .from('brands')
        .select('website_url')
        .eq('id', brandId)
        .single()

      const brandDomain = brandData?.website_url ? new URL(brandData.website_url).hostname.replace(/^www\./, '') : null

      // Fetch citations - this is the main source of data
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

      if (citationsError) {
        console.error('[SourceAttribution] Citations query error:', citationsError)
        throw new DatabaseError(`Failed to fetch citations: ${citationsError.message}`)
      }

      console.log(`[SourceAttribution] Found ${citationsData?.length || 0} citations for brand ${brandId}`)

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

      // Get unique query IDs from citations (citations table has query_id directly)
      const queryIdsFromCitations = Array.from(new Set(
        (citationsData || [])
          .map(c => c.query_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ))

      // Also get collector result IDs for share of answer and sentiment
      const collectorResultIds = Array.from(new Set(
        (citationsData || [])
          .map(c => c.collector_result_id)
          .filter((id): id is number => typeof id === 'number')
      ))

      console.log(`[SourceAttribution] Found ${queryIdsFromCitations.length} unique queries and ${collectorResultIds.length} collector results`)

      // Fetch queries for prompts (generated_queries doesn't have topic_name column)
      let queries: Array<{ id: string; query_text: string }> = []
      if (queryIdsFromCitations.length > 0) {
        const { data: queriesData, error: queriesError } = await supabaseAdmin
          .from('generated_queries')
          .select('id, query_text')
          .in('id', queryIdsFromCitations)

        if (queriesError) {
          console.warn('[SourceAttribution] Failed to fetch queries:', queriesError)
        } else {
          queries = queriesData || []
        }
      }

      // Fetch collector results for query_id and question (prompt)
      // Note: sentiment_score is in extracted_positions, not collector_results
      let collectorResults: Array<{
        id: number;
        query_id: string | null;
        question: string | null;
        total_brand_mentions: number | null;
        has_brand_presence: boolean | null;
      }> = []

      if (collectorResultIds.length > 0) {
        const { data: collectorResultsData, error: collectorError } = await supabaseAdmin
          .from('collector_results')
          .select(`
            id,
            query_id,
            question,
            total_brand_mentions,
            has_brand_presence
          `)
          .in('id', collectorResultIds)
          .eq('brand_id', brandId)

        if (collectorError) {
          console.warn('[SourceAttribution] Failed to fetch collector results:', collectorError)
        } else {
          collectorResults = collectorResultsData || []
          const resultsWithQuestions = collectorResults.filter(cr => cr.question).length
          console.log(`[SourceAttribution] Fetched ${collectorResults.length} collector results, ${resultsWithQuestions} have questions`)
          if (resultsWithQuestions > 0) {
            console.log('[SourceAttribution] Sample collector result with question:', {
              id: collectorResults.find(cr => cr.question)?.id,
              question: collectorResults.find(cr => cr.question)?.question?.substring(0, 100)
            })
          }
        }
      }

      // Fetch share of answer and sentiment from extracted_positions table
      let extractedPositions: Array<{
        collector_result_id: number | null;
        share_of_answers_brand: number | null;
        sentiment_score: number | null;
      }> = []

      if (collectorResultIds.length > 0) {
        const { data: positionsData, error: positionsError } = await supabaseAdmin
          .from('extracted_positions')
          .select(`
            collector_result_id,
            share_of_answers_brand,
            sentiment_score
          `)
          .in('collector_result_id', collectorResultIds)
          .eq('brand_id', brandId)

        if (positionsError) {
          console.warn('[SourceAttribution] Failed to fetch extracted positions:', positionsError)
        } else {
          extractedPositions = positionsData || []
          const withSentiment = extractedPositions.filter(ep => ep.sentiment_score !== null).length
          console.log(`[SourceAttribution] Found ${extractedPositions.length} extracted positions (SoA may be null), ${withSentiment} have sentiment scores`)
        }
      }

      // Create maps for quick lookup
      const collectorResultMap = new Map(
        collectorResults.map(cr => [cr.id, cr])
      )
      console.log(`[SourceAttribution] Created collectorResultMap with ${collectorResultMap.size} entries`)
      const queryMap = new Map(
        queries.map(q => [q.id, q])
      )
      console.log(`[SourceAttribution] Created queryMap with ${queryMap.size} entries`)
      
      // Create maps for share of answer and sentiment by collector_result_id
      // Multiple positions can exist per collector_result_id, so we'll average them
      const shareOfAnswerByCollectorResult = new Map<number, number[]>()
      const sentimentByCollectorResult = new Map<number, number[]>()
      
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
          
          // Collect sentiment scores
          if (position.sentiment_score !== null) {
            if (!sentimentByCollectorResult.has(collectorId)) {
              sentimentByCollectorResult.set(collectorId, [])
            }
            sentimentByCollectorResult.get(collectorId)!.push(toNumber(position.sentiment_score))
          }
        }
      }
      
      // Calculate average share of answer per collector result
      const avgShareByCollectorResult = new Map<number, number>()
      for (const [collectorId, shareValues] of shareOfAnswerByCollectorResult.entries()) {
        avgShareByCollectorResult.set(collectorId, average(shareValues))
      }
      
      // Calculate average sentiment per collector result
      const avgSentimentByCollectorResult = new Map<number, number>()
      for (const [collectorId, sentimentValues] of sentimentByCollectorResult.entries()) {
        avgSentimentByCollectorResult.set(collectorId, average(sentimentValues))
      }
      
      console.log(`[SourceAttribution] Calculated average share of answer for ${avgShareByCollectorResult.size} collector results`)
      console.log(`[SourceAttribution] Calculated average sentiment for ${avgSentimentByCollectorResult.size} collector results`)

      // Aggregate sources by domain
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
          mentionCounts: number[]
          topics: Set<string>
          queryIds: Set<string>
          pages: Set<string>
          prompts: Set<string> // Questions from collector_results
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
            mentionCounts: [],
            topics: new Set<string>(),
            queryIds: new Set<string>(),
            pages: new Set<string>(),
            prompts: new Set<string>()
          })
        }

        const aggregate = sourceAggregates.get(sourceKey)!
        aggregate.citations += citation.usage_count || 1

        // Use citation category as a topic for coverage analytics (fallback when query topics are unavailable)
        if (citation.category) {
          aggregate.topics.add(String(citation.category))
        }

        // Add query_id from citation (citations table has query_id directly)
        if (citation.query_id) {
          aggregate.queryIds.add(citation.query_id)
          // Note: generated_queries doesn't have topic_name, topics would need to come from brand_topics or metadata
        }

        // Add collector result data if available
        if (citation.collector_result_id) {
          aggregate.collectorResultIds.add(citation.collector_result_id)
          const collectorResult = collectorResultMap.get(citation.collector_result_id)
          
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

          // Always add sentiment if we have it from extracted_positions, even if collector_results row is missing
          const avgSentiment = avgSentimentByCollectorResult.get(citation.collector_result_id)
          if (avgSentiment !== undefined) {
            aggregate.sentimentValues.push(avgSentiment)
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
            
            if (collectorResult.total_brand_mentions !== null && collectorResult.total_brand_mentions !== undefined) {
              aggregate.mentionCounts.push(collectorResult.total_brand_mentions)
            }
            // Also add query_id from collector result if citation doesn't have it
            if (!citation.query_id && collectorResult.query_id) {
              aggregate.queryIds.add(collectorResult.query_id)
              // Note: topics would need to come from brand_topics or metadata
            }
          }
        }

        if (citation.page_name) {
          aggregate.pages.add(citation.page_name)
        }
      }

      console.log(`[SourceAttribution] Aggregated ${sourceAggregates.size} unique sources`)
      
      // Debug: Check prompts per source
      for (const [sourceKey, aggregate] of sourceAggregates.entries()) {
        if (aggregate.prompts.size === 0) {
          console.warn(`[SourceAttribution] Source ${sourceKey} has NO prompts (collectorResultIds: ${aggregate.collectorResultIds.size})`)
        } else {
          console.log(`[SourceAttribution] Source ${sourceKey} has ${aggregate.prompts.size} prompts`)
        }
      }

      // Calculate previous period for change metrics
      const periodDays = Math.ceil((normalizedRange.endDate.getTime() - normalizedRange.startDate.getTime()) / (1000 * 60 * 60 * 24))
      const previousStart = new Date(normalizedRange.startDate)
      previousStart.setUTCDate(previousStart.getUTCDate() - periodDays)
      const previousEnd = normalizedRange.startDate

      const { data: previousCitations } = await supabaseAdmin
        .from('citations')
        .select('domain, usage_count, collector_result_id')
        .eq('brand_id', brandId)
        .eq('customer_id', customerId)
        .gte('created_at', previousStart.toISOString())
        .lt('created_at', previousEnd.toISOString())

      // Calculate previous period aggregates
      const previousSourceAggregates = new Map<string, { citations: number; mentionRate: number; soa: number; soaArray?: number[]; sentiment: number }>()
      
      if (previousCitations && previousCitations.length > 0) {
        const previousCollectorIds = Array.from(new Set(
          previousCitations.map(c => c.collector_result_id).filter((id): id is number => typeof id === 'number')
        ))
        
        // Fetch previous period share of answer and sentiment from extracted_positions
        const { data: previousPositions } = await supabaseAdmin
          .from('extracted_positions')
          .select('collector_result_id, share_of_answers_brand, sentiment_score')
          .in('collector_result_id', previousCollectorIds)
          .eq('brand_id', brandId)
          .gte('processed_at', previousStart.toISOString())
          .lt('processed_at', previousEnd.toISOString())

        // Calculate average share of answer and sentiment per collector result for previous period
        const previousShareByCollectorResult = new Map<number, number[]>()
        const previousSentimentByCollectorResult = new Map<number, number[]>()
        
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
              
              // Collect sentiment scores
              if (position.sentiment_score !== null) {
                if (!previousSentimentByCollectorResult.has(collectorId)) {
                  previousSentimentByCollectorResult.set(collectorId, [])
                }
                previousSentimentByCollectorResult.get(collectorId)!.push(toNumber(position.sentiment_score))
              }
            }
          }
        }
        
        const previousAvgShareByCollectorResult = new Map<number, number>()
        for (const [collectorId, shareValues] of previousShareByCollectorResult.entries()) {
          previousAvgShareByCollectorResult.set(collectorId, average(shareValues))
        }
        
        const previousAvgSentimentByCollectorResult = new Map<number, number>()
        for (const [collectorId, sentimentValues] of previousSentimentByCollectorResult.entries()) {
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
            
            // Get sentiment from extracted_positions
            const avgSentiment = previousAvgSentimentByCollectorResult.get(citation.collector_result_id)
            if (avgSentiment !== undefined) {
              prev.sentiment += avgSentiment
            }
          }
        }
      }

      // Get total responses count for mention rate calculation
      // This should be the total number of collector results in the date range
      const { count: totalResponses } = await supabaseAdmin
        .from('collector_results')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      const totalResponsesCount = totalResponses || 1 // Avoid division by zero
      console.log(`[SourceAttribution] Total collector results: ${totalResponsesCount}`)

      // Convert aggregates to source data
      const sources: SourceAttributionData[] = []
      
      for (const [sourceKey, aggregate] of sourceAggregates.entries()) {
        // Share of Answer: Average across all collector results where this source is cited
        // share_of_answers_brand is stored as a decimal (0.0-1.0) or percentage (0-100)
        // We normalize it to a percentage using toPercentage which handles both cases
        const avgShareRaw = aggregate.shareValues.length > 0 ? average(aggregate.shareValues) : 0
        const avgShare = toPercentage(avgShareRaw) // Convert to percentage if needed (handles both 0-1 and 0-100)
        
        const avgSentiment = aggregate.sentimentValues.length > 0 ? average(aggregate.sentimentValues) : 0
        const totalMentions = aggregate.mentionCounts.reduce((sum, count) => sum + count, 0)
        
        // Mention Rate: percentage of total collector results where this source is cited
        // Formula: (Number of unique collector results citing this source / Total collector results) * 100
        // Example: If learn.microsoft.com is cited in 8 out of 23 total responses, mention rate = (8/23) * 100 = 34.8%
        const uniqueCollectorResults = aggregate.collectorResultIds.size
        const mentionRate = totalResponsesCount > 0 ? (uniqueCollectorResults / totalResponsesCount) * 100 : 0

        // Calculate changes from previous period
        const previous = previousSourceAggregates.get(sourceKey)
        // For previous period, we need to calculate mention rate similarly
        // Since we don't have the previous period's total responses, we'll use a simple comparison
        const previousMentionRate = previous ? (previous.citations / Math.max(totalResponsesCount, 1)) * 100 : 0
        // Previous SoA: average the share values if available, otherwise use the old summed value
        const previousSoaRaw = previous && previous.soaArray && previous.soaArray.length > 0
          ? average(previous.soaArray)
          : (previous ? previous.soa : 0)
        const previousSoa = toPercentage(previousSoaRaw)
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
          // Use prompts from collector_results.question, fallback to query_text from generated_queries
          prompts: (() => {
            const promptsFromCollector = Array.from(aggregate.prompts)
            if (promptsFromCollector.length > 0) {
              console.log(`[SourceAttribution] Using ${promptsFromCollector.length} prompts from collector_results for ${aggregate.domain}`)
              return promptsFromCollector
            }
            const promptsFromQueries = Array.from(aggregate.queryIds).map(qId => {
              const query = queryMap.get(qId)
              return query?.query_text || ''
            }).filter(Boolean)
            if (promptsFromQueries.length > 0) {
              console.log(`[SourceAttribution] Using ${promptsFromQueries.length} prompts from generated_queries for ${aggregate.domain}`)
              return promptsFromQueries
            }
            console.warn(`[SourceAttribution] No prompts found for ${aggregate.domain} (collectorResultIds: ${aggregate.collectorResultIds.size}, queryIds: ${aggregate.queryIds.size})`)
            return []
          })(),
          pages: Array.from(aggregate.pages)
        })
      }

      // Sort by mention rate descending
      sources.sort((a, b) => b.mentionRate - a.mentionRate)
      
      console.log(`[SourceAttribution] Returning ${sources.length} sources`)

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

      return {
        sources,
        overallMentionRate,
        overallMentionChange: round(overallMentionRate - previousOverallMentionRate, 1),
        avgSentiment,
        avgSentimentChange: round(avgSentiment - previousAvgSentiment, 2),
        totalSources: sources.length,
        dateRange: { start: startIso, end: endIso }
      }
    } catch (error) {
      console.error('[SourceAttribution] Error:', error)
      throw error
    }
  }
}

export const sourceAttributionService = new SourceAttributionService()

