export interface PromptHighlights {
  brand: string[]
  products: string[]
  keywords: string[]
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
  volumePercentage: number
  volumeCount: number
  sentimentScore: number | null
  highlights: PromptHighlights
}

export interface PromptTopic {
  id: string
  name: string
  promptCount: number
  volumeCount: number
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

