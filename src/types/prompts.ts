export interface PromptHighlights {
  brand: string[]
  products: string[]
  keywords: string[]
  competitors: string[]
}

export interface CollectorResponse {
  collectorResultId: number
  collectorType: string
  response: string
  lastUpdated: string
  brandMentions: number | null
  productMentions: number | null
  competitorMentions: number | null
  keywordCount: number | null
  brandPositions?: number[]
  competitorPositions?: number[]
  mentions: number
  averagePosition: number | null
  soaScore?: number | null
}

export interface PromptEntry {
  id: string
  queryId: string | null
  collectorResultId: number | null
  question: string
  topic: string
  collectorTypes: string[]
  latestCollectorType: string | null
  lastUpdated: string | null
  response: string | null
  responses?: CollectorResponse[] // All responses from all collectors
  volumePercentage: number
  volumeCount: number
  sentimentScore: number | null
  visibilityScore: number | null
  mentions: number
  averagePosition: number | null
  soaScore?: number | null
  competitorVisibilityMap: Record<string, number>
  competitorSentimentMap: Record<string, number>
  competitorMentionsMap: Record<string, number>
  competitorPositionMap: Record<string, number | null>
  competitorSoaMap?: Record<string, number>
  highlights: PromptHighlights
}

export interface PromptTopic {
  id: string
  name: string
  promptCount: number
  volumeCount: number
  visibilityScore: number | null
  sentimentScore: number | null
  mentions: number
  averagePosition: number | null
  soaScore?: number | null
  competitorVisibilityMap: Record<string, number>
  competitorSentimentMap: Record<string, number>
  competitorMentionsMap: Record<string, number>
  competitorPositionMap: Record<string, number | null>
  competitorSoaMap?: Record<string, number>
  prompts: PromptEntry[]
}

export interface PromptAnalyticsPayload {
  brandId: string
  brandName: string
  dateRange: {
    start: string
    end: string
  }
  collectors: string[]
  totalPrompts: number
  totalResponses: number
  topics: PromptTopic[]
}

