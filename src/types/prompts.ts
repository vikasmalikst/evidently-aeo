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
  highlights: PromptHighlights
}

export interface PromptTopic {
  id: string
  name: string
  promptCount: number
  volumeCount: number
  visibilityScore: number | null
  sentimentScore: number | null
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

