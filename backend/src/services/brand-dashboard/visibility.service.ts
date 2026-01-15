import {
  LlmVisibilitySlice,
  CompetitorVisibility,
  QueryVisibilityRow,
  CollectorAggregate
} from './types'
import {
  COLLECTOR_COLORS,
  round,
  average,
  truncateLabel,
  normalizeSentiment
} from './utils'

export interface VisibilityCalculationInputs {
  collectorAggregates: Map<string, CollectorAggregate>
  competitorAggregates: Map<string, {
    shareValues: number[]
    visibilityValues: number[]
    sentimentValues: number[]
    mentions: number
    queries: Map<string, {
      text: string
      shareSum: number
      visibilitySum: number
      sentimentValues: number[]
      mentionSum: number
      count: number
    }>
  }>
  queryAggregates: Map<string, { text: string; share: number }>
  brandShareByQuery: Map<string, number[]>
  brandVisibilityByQuery: Map<string, number[]>
  brandSentimentByQuery: Map<string, number[]>
  totalShareUniverse: number
  knownCompetitors: string[]
  brandName: string
  totalResponses: number
  brandShareSum: number
  brandShareValues: number[]
}

export interface VisibilityCalculationResults {
  llmVisibility: LlmVisibilitySlice[]
  competitorVisibility: CompetitorVisibility[]
  queryVisibility: QueryVisibilityRow[]
  visibilityComparison: Array<{
    entity: string
    isBrand: boolean
    mentions: number
    share: number
  }>
}

export class VisibilityService {
  calculateLlmVisibility(
    collectorAggregates: Map<string, CollectorAggregate>,
    totalCollectorMentions: number,
    totalCollectorShareSum: number,
    timeSeriesData?: Map<string, {
      dates: string[]
      visibility: number[]
      share: number[]
      sentiment: (number | null)[]
      brandPresence: number[]
      isRealData: boolean[] // NEW: true if data from DB, false if interpolated
    }>,
    filtersActive: boolean = false
  ): LlmVisibilitySlice[] {
    const llmVisibility: LlmVisibilitySlice[] = Array.from(collectorAggregates.entries())
      .map(([collectorType, aggregate]) => {
        const averageVisibilityRaw =
          aggregate.visibilityValues.length > 0 ? average(aggregate.visibilityValues) : 0
        const clampedVisibility = Math.min(1, Math.max(0, averageVisibilityRaw))
        const visibilityPercentage = round(clampedVisibility * 100)

        // Calculate Share of Answers per LLM
        // When no filters: use simple average of all share_of_answers_brand values for this collector_type
        // When filters applied: use simple average of filtered values
        // IMPORTANT: Only use shareValues array (which excludes NULLs) - never fallback to visibility
        let shareOfSearch = 0
        if (aggregate.shareValues.length > 0) {
          // Simple average: average all share values for this collector type (NULLs already excluded)
          shareOfSearch = round(average(aggregate.shareValues))
        }
        // Do NOT fallback to visibility - if there are no share values, SOA should be 0
        // This ensures SOA only reflects actual share_of_answers_brand data, not visibility

        const normalizedCollectorType = collectorType.toLowerCase().trim()
        const color =
          COLLECTOR_COLORS[normalizedCollectorType] ??
          COLLECTOR_COLORS[(normalizedCollectorType.split(/[._-]/)[0]) || 'default'] ??
          COLLECTOR_COLORS.default

        const topicEntries = Array.from(aggregate.topics.entries()).map(([topic, stats]) => {
          const occurrences = stats.occurrences
          const share =
            occurrences > 0 ? round(stats.shareSum / occurrences) : 0
          // Visibility values are stored in 0-1 scale, convert to 0-100 for consistency
          const avgVisibilityRaw =
            occurrences > 0 ? stats.visibilitySum / occurrences : 0
          const visibility = round(avgVisibilityRaw * 100, 1)
          return {
            topic: truncateLabel(topic, 64),
            occurrences,
            share,
            visibility,
            mentions: stats.mentions
          }
        })

        const sortedTopics = topicEntries
          .filter((entry) => entry.topic.trim().length > 0)
          .sort(
            (a, b) => {
              // Primary: visibility score (descending) - matches dashboard ranking
              // Secondary: share (average share of answers)
              // Tertiary: occurrences (how many times this topic appears)
              // Quaternary: mentions
              return b.visibility - a.visibility ||
                b.share - a.share ||
                b.occurrences - a.occurrences ||
                b.mentions - a.mentions
            }
          )
          .slice(0, 5)

        // Calculate average sentiment for this collector
        // All scores are now in 1-100 format, simple average - return in 1-100 range
        const sentimentValues = aggregate.sentimentValues || []
        const avgSentiment = sentimentValues.length > 0 ? average(sentimentValues) : 0
        const sentiment = avgSentiment > 0 ? round(avgSentiment, 2) : null

        // Get time-series data for this collector
        const timeSeries = timeSeriesData?.get(collectorType)

        // Calculate brand presence count correctly: count unique collector results with brand presence
        // NOT row count (which can be multiple rows per collector result)
        const totalCollectorResults = aggregate.uniqueCollectorResults?.size ?? 0
        const collectorResultsWithPresence = aggregate.collectorResultsWithBrandPresence?.size ?? 0
        // Use unique collector results count for brand presence, fallback to old row count for backward compatibility
        const brandPresenceCount = totalCollectorResults > 0
          ? collectorResultsWithPresence
          : aggregate.brandPresenceCount

        return {
          provider: collectorType,
          share: shareOfSearch,
          shareOfSearch,
          visibility: visibilityPercentage,
          sentiment,
          delta: 0,
          brandPresenceCount,
          totalQueries: aggregate.uniqueQueryIds.size,
          // Also send total collector results for accurate percentage calculation in frontend
          totalCollectorResults: totalCollectorResults > 0 ? totalCollectorResults : undefined,
          color,
          topTopic: sortedTopics[0]?.topic ?? null,
          topTopics: sortedTopics,
          timeSeries: timeSeries ? {
            dates: timeSeries.dates,
            visibility: timeSeries.visibility,
            share: timeSeries.share,
            sentiment: timeSeries.sentiment,
            brandPresence: timeSeries.brandPresence, // Pass through brand presence time series
            isRealData: timeSeries.isRealData // Pass through isRealData flags
          } : undefined
        }
      })
      .sort((a, b) => b.share - a.share)

    return llmVisibility
  }

  calculateCompetitorVisibility(
    competitorAggregates: Map<string, {
      shareValues: number[]
      visibilityValues: number[]
      sentimentValues: number[]
      mentions: number
      queries: Map<string, {
        text: string
        shareSum: number
        visibilitySum: number
        sentimentValues: number[]
        mentionSum: number
        count: number
      }>
      topics: Map<string, {
        occurrences: number
        shareSum: number
        visibilitySum: number
        mentions: number
        queryIds: Set<string>
      }>
      queryIds: Set<string>
    }>,
    totalShareUniverse: number,
    totalQueries: number,
    totalResponses: number,
    knownCompetitors: string[],
    competitorTimeSeriesData?: Map<string, {
      dates: string[]
      visibility: number[]
      share: number[]
      sentiment: (number | null)[]
      brandPresencePercentage: number[]
      isRealData: boolean[] // NEW: true if data from DB, false if interpolated
    }>
  ): CompetitorVisibility[] {
    let competitorVisibility: CompetitorVisibility[] = Array.from(competitorAggregates.entries())
      .map(([competitorName, aggregate]) => {
        // Use simple average for competitor SOA (consistent with Topics page and brand SOA calculation)
        // Filter out invalid values (null, undefined, NaN, Infinity) to match SQL AVG behavior
        const validShareValues = aggregate.shareValues.filter(
          val => val !== null && val !== undefined && Number.isFinite(val) && val >= 0
        )
        const share = validShareValues.length > 0
          ? round(average(validShareValues))
          : 0


        const avgVisibilityRaw = aggregate.visibilityValues.length > 0 ? average(aggregate.visibilityValues) : 0
        const visibility = round(Math.min(1, Math.max(0, avgVisibilityRaw)) * 100)

        const topSignals = Array.from(aggregate.queries.values())
          .map((query) => ({
            collectorType: truncateLabel(query.text, 36),
            mentions: query.mentionSum > 0
              ? Math.round(query.mentionSum / Math.max(1, query.count))
              : Math.round(query.shareSum / Math.max(1, query.count))
          }))
          .sort((a, b) => b.mentions - a.mentions)
          .slice(0, 3)

        // Calculate brand presence percentage - Answer Frequency
        // Calculate total answers where competitor appeared by summing count across all queries
        const totalCompetitorAppearances = Array.from(aggregate.queries.values())
          .reduce((sum, query) => sum + query.count, 0)

        // Direct percentage: (answers with competitor / total answers) * 100
        const brandPresencePercentage = totalResponses > 0
          ? round((totalCompetitorAppearances / totalResponses) * 100, 1)
          : 0

        // Extract top topics - only include topics where competitor has meaningful data
        // Ranked by visibility score (matching dashboard ranking - using avg visibility per topic)
        // Visibility values are stored in 0-1 scale, convert to 0-100 for consistency
        const topTopics = Array.from(aggregate.topics.entries())
          .map(([topicName, topicStats]) => {
            // Calculate average visibility per topic (0-1 scale from database)
            const avgVisibilityRaw = topicStats.occurrences > 0
              ? topicStats.visibilitySum / topicStats.occurrences
              : 0
            // Convert to 0-100 scale to match brand summary calculation
            const avgVisibility = round(avgVisibilityRaw * 100, 1)

            return {
              topic: truncateLabel(topicName, 64),
              occurrences: topicStats.occurrences,
              share: topicStats.occurrences > 0
                ? round(topicStats.shareSum / topicStats.occurrences, 1)
                : 0,
              visibility: avgVisibility,
              mentions: topicStats.mentions
            }
          })
          .filter((topic) =>
            topic.topic.trim().length > 0 &&
            (topic.share > 0 || topic.visibility > 0 || topic.mentions > 0)
          )
          .sort((a, b) => {
            // Primary: visibility score (descending) - matches dashboard ranking
            // Secondary: share (average share of answers)
            // Tertiary: occurrences (how many times this topic appears)
            return b.visibility - a.visibility || b.share - a.share || b.occurrences - a.occurrences
          })
          .slice(0, 5)

        // Calculate average sentiment for this competitor
        // All scores are now in 1-100 format, simple average - return in 1-100 range
        const sentimentValues = aggregate.sentimentValues || []
        const avgSentiment = sentimentValues.length > 0 ? average(sentimentValues) : 0
        const sentiment = avgSentiment > 0 ? round(avgSentiment, 2) : null

        // Get time-series data for this competitor
        const timeSeries = competitorTimeSeriesData?.get(competitorName)

        return {
          competitor: competitorName,
          mentions: aggregate.mentions || aggregate.shareValues.length,
          share,
          visibility,
          sentiment,
          brandPresencePercentage,
          topTopics,
          collectors: topSignals,
          timeSeries: timeSeries ? {
            dates: timeSeries.dates,
            visibility: timeSeries.visibility,
            share: timeSeries.share,
            sentiment: timeSeries.sentiment,
            brandPresencePercentage: timeSeries.brandPresencePercentage, // Pass through brand presence percentage time series
            isRealData: timeSeries.isRealData // Pass through isRealData flags
          } : undefined
        }
      })
      .sort((a, b) => b.share - a.share)
      .slice(0, 5)

    const competitorNamesSeen = new Set(competitorVisibility.map((entry) => entry.competitor.toLowerCase()))
    knownCompetitors.forEach((competitorName) => {
      if (!competitorNamesSeen.has(competitorName.toLowerCase())) {
        competitorVisibility.push({
          competitor: competitorName,
          mentions: 0,
          share: 0,
          visibility: 0,
          sentiment: null,
          brandPresencePercentage: 0,
          topTopics: [],
          collectors: []
        })
      }
    })

    competitorVisibility = competitorVisibility.sort((a, b) => b.share - a.share).slice(0, 5)

    return competitorVisibility
  }

  calculateQueryVisibility(
    queryAggregates: Map<string, { text: string; share: number }>,
    brandShareByQuery: Map<string, number[]>,
    brandVisibilityByQuery: Map<string, number[]>,
    brandSentimentByQuery: Map<string, number[]>,
    competitorAggregates: Map<string, {
      shareValues: number[]
      visibilityValues: number[]
      sentimentValues: number[]
      mentions: number
      queries: Map<string, {
        text: string
        shareSum: number
        visibilitySum: number
        sentimentValues: number[]
        mentionSum: number
        count: number
      }>
    }>,
    knownCompetitors: string[]
  ): QueryVisibilityRow[] {
    const queryVisibility: QueryVisibilityRow[] = Array.from(queryAggregates.entries()).map(([queryId, aggregate]) => {
      // Average across collectors
      const brandShareArray = brandShareByQuery.get(queryId) ?? []
      const brandVisibilityArray = brandVisibilityByQuery.get(queryId) ?? []
      const brandSentimentArray = brandSentimentByQuery.get(queryId) ?? []

      const brandShare = brandShareArray.length > 0 ? average(brandShareArray) : 0
      const brandVisibility = brandVisibilityArray.length > 0 ? average(brandVisibilityArray) : 0
      // All scores are now in 1-100 format, simple average - return in 1-100 range
      const avgBrandSentiment = brandSentimentArray.length > 0 ? average(brandSentimentArray) : 0
      const brandSentiment = avgBrandSentiment > 0 ? round(avgBrandSentiment, 2) : null

      const competitors = Array.from(competitorAggregates.entries())
        .map(([competitorName, aggregate]) => {
          const stats = aggregate.queries.get(queryId)
          if (!stats) {
            return null
          }
          const avgShare = stats.shareSum / Math.max(1, stats.count)
          const avgVisibility = stats.visibilitySum / Math.max(1, stats.count)
          // All scores are now in 1-100 format, simple average - return in 1-100 range
          const avgSentiment = stats.sentimentValues.length > 0 ? average(stats.sentimentValues) : 0
          const sentiment = avgSentiment > 0 ? round(avgSentiment, 2) : null
          return {
            competitor: competitorName,
            share: round(avgShare),
            visibility: round(avgVisibility),
            sentiment
          }
        })
        .filter(
          (
            entry
          ): entry is { competitor: string; share: number; visibility: number; sentiment: number | null } =>
            entry !== null
        )

      const competitorLabelsSeen = new Set(competitors.map((entry) => entry.competitor.toLowerCase()))
      knownCompetitors.forEach((name) => {
        if (!competitorLabelsSeen.has(name.toLowerCase())) {
          competitors.push({
            competitor: name,
            share: 0,
            visibility: 0,
            sentiment: null
          })
        }
      })

      competitors.sort((a, b) => b.share - a.share)

      return {
        queryId,
        queryText: aggregate.text,
        brandShare: round(brandShare),
        brandVisibility: round(brandVisibility),
        brandSentiment,
        competitors
      }
    })

    return queryVisibility
  }

  calculateVisibilityComparison(
    brandName: string,
    totalResponses: number,
    brandShareSum: number,
    brandShareValues: number[],
    totalShareUniverse: number,
    competitorVisibility: CompetitorVisibility[]
  ): Array<{
    entity: string
    isBrand: boolean
    mentions: number
    share: number
  }> {
    // Use simple average for brand share (consistent with dashboard SOA calculation)
    const brandShare = brandShareValues.length > 0
      ? round(average(brandShareValues))
      : 0

    const visibilityComparison = [
      {
        entity: brandName,
        isBrand: true,
        mentions: totalResponses,
        share: brandShare
      },
      ...competitorVisibility.map((competitor) => ({
        entity: competitor.competitor,
        isBrand: false,
        mentions: competitor.mentions,
        share: competitor.share
      }))
    ].sort((a, b) => b.share - a.share)

    return visibilityComparison
  }
}

export const visibilityService = new VisibilityService()

