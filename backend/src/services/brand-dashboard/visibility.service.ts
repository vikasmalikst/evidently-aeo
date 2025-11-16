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
    totalCollectorShareSum: number
  ): LlmVisibilitySlice[] {
    const llmVisibility: LlmVisibilitySlice[] = Array.from(collectorAggregates.entries())
      .map(([collectorType, aggregate]) => {
        const averageVisibilityRaw =
          aggregate.visibilityValues.length > 0 ? average(aggregate.visibilityValues) : 0
        const clampedVisibility = Math.min(1, Math.max(0, averageVisibilityRaw))
        const visibilityPercentage = round(clampedVisibility * 100)

        const shareValueSum = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
        const shareFromValues =
          totalCollectorShareSum > 0 ? round((shareValueSum / totalCollectorShareSum) * 100) : 0
        const shareFromMentions =
          totalCollectorMentions > 0 ? round((aggregate.mentions / totalCollectorMentions) * 100) : 0
        const shareOfSearch =
          shareFromValues > 0
            ? shareFromValues
            : shareFromMentions > 0
              ? shareFromMentions
              : visibilityPercentage

        const normalizedCollectorType = collectorType.toLowerCase().trim()
        const color =
          COLLECTOR_COLORS[normalizedCollectorType] ??
          COLLECTOR_COLORS[(normalizedCollectorType.split(/[._-]/)[0]) || 'default'] ??
          COLLECTOR_COLORS.default

        const topicEntries = Array.from(aggregate.topics.entries()).map(([topic, stats]) => {
          const occurrences = stats.occurrences
          const share =
            occurrences > 0 ? round(stats.shareSum / occurrences) : 0
          const visibility =
            occurrences > 0 ? round(stats.visibilitySum / occurrences) : 0
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
            (a, b) =>
              b.occurrences - a.occurrences ||
              b.share - a.share ||
              b.visibility - a.visibility ||
              b.mentions - a.mentions
          )
          .slice(0, 5)

        return {
          provider: collectorType,
          share: shareOfSearch,
          shareOfSearch,
          visibility: visibilityPercentage,
          delta: 0,
          brandPresenceCount: aggregate.brandPresenceCount,
          totalQueries: aggregate.uniqueQueryIds.size,
          color,
          topTopic: sortedTopics[0]?.topic ?? null,
          topTopics: sortedTopics
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
    }>,
    totalShareUniverse: number,
    knownCompetitors: string[]
  ): CompetitorVisibility[] {
    let competitorVisibility: CompetitorVisibility[] = Array.from(competitorAggregates.entries())
      .map(([competitorName, aggregate]) => {
        const competitorShare = aggregate.shareValues.reduce((sum, value) => sum + value, 0)
        const share = totalShareUniverse > 0 ? round((competitorShare / totalShareUniverse) * 100) : round(average(aggregate.shareValues) * 100)
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

        return {
          competitor: competitorName,
          mentions: aggregate.mentions || aggregate.shareValues.length,
          share,
          visibility,
          collectors: topSignals
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
      const brandSentiment =
        brandSentimentArray.length > 0 ? round(normalizeSentiment(brandSentimentArray)) : null

      const competitors = Array.from(competitorAggregates.entries())
        .map(([competitorName, aggregate]) => {
          const stats = aggregate.queries.get(queryId)
          if (!stats) {
            return null
          }
          const avgShare = stats.shareSum / Math.max(1, stats.count)
          const avgVisibility = stats.visibilitySum / Math.max(1, stats.count)
          const sentiment =
            stats.sentimentValues.length > 0 ? round(normalizeSentiment(stats.sentimentValues)) : null
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
    const visibilityComparison = [
      {
        entity: brandName,
        isBrand: true,
        mentions: totalResponses,
        share: totalShareUniverse > 0 ? round((brandShareSum / totalShareUniverse) * 100) : round(average(brandShareValues))
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

