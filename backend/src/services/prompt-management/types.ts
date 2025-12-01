/**
 * Shared Types for Prompt Management Services
 */

export interface ManagedPrompt {
  id: string
  queryId: string
  text: string
  topic: string
  response: string | null
  lastUpdated: string | null
  createdAt: string
  
  // Metrics
  sentiment: number | null
  visibilityScore: number | null
  volumeCount: number
  
  // Highlights
  keywords: {
    brand: string[]
    products: string[]
    keywords: string[]
    competitors: string[]
  }
  
  // Metadata
  source: 'generated' | 'custom'
  isActive: boolean
  collectorTypes: string[]
  
  // Version info
  includedInVersions: number[]
  firstVersionIncluded: number | null
}

export interface PromptTopic {
  id: string
  name: string
  promptCount: number
  prompts: ManagedPrompt[]
  category?: string | null
}

export interface PromptConfiguration {
  id: string
  brandId: string
  customerId: string
  version: number
  isActive: boolean
  changeType: ChangeType
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
  metadata: Record<string, unknown>
}

export type ChangeType = 
  | 'initial_setup'
  | 'prompt_added'
  | 'prompt_removed'
  | 'prompt_edited'
  | 'bulk_update'
  | 'version_revert'

export interface PromptConfigurationSnapshot {
  id: string
  configurationId: string
  queryId: string
  topic: string
  queryText: string
  isIncluded: boolean
  sortOrder: number | null
  createdAt: string
}

export interface PromptChangeLog {
  id: string
  configurationId: string
  queryId: string | null
  changeType: 'added' | 'removed' | 'edited' | 'topic_changed'
  oldValue: string | null
  newValue: string | null
  changedBy: string | null
  changedAt: string
}

export interface PromptMetricsSnapshot {
  id: string
  configurationId: string
  totalPrompts: number
  totalTopics: number
  coverageScore: number | null
  avgVisibilityScore: number | null
  avgSentimentScore: number | null
  analysesCount: number
  calculatedAt: string
  metricsData: Record<string, unknown>
}

export interface PendingChanges {
  added: Array<{ text: string; topic: string }>
  removed: Array<{ id: string; text: string }>
  edited: Array<{ id: string; oldText: string; newText: string }>
}

export interface PromptImpact {
  coverage: {
    current: number
    projected: number
    change: number
    changePercent: number
  }
  visibilityScore: {
    current: number
    projected: number | null
    change: number | null
    changePercent: number | null
  }
  topicCoverage: {
    increased: string[]
    decreased: string[]
    unchanged: string[]
  }
  affectedAnalyses: number
  warnings: string[]
}

export interface VersionComparison {
  version1: number
  version2: number
  changes: {
    added: Array<{ id: string; text: string; topic: string }>
    removed: Array<{ id: string; text: string; topic: string }>
    edited: Array<{ id: string; oldText: string; newText: string; topic: string }>
    topicChanges: {
      added: string[]
      removed: string[]
    }
  }
  metricsComparison: {
    prompts: { v1: number; v2: number; diff: number }
    topics: { v1: number; v2: number; diff: number }
    coverage: { v1: number; v2: number; diff: number }
  }
}

export interface ManagePromptsResponse {
  brandId: string
  brandName: string
  currentVersion: number
  topics: PromptTopic[]
  summary: {
    totalPrompts: number
    totalTopics: number
    coverage: number
    avgVisibility: number
    avgSentiment: number
  }
}

export interface VersionHistoryResponse {
  currentVersion: number
  versions: Array<{
    id: string
    version: number
    isActive: boolean
    changeType: ChangeType
    changeSummary: string | null
    createdAt: string
    createdBy: string | null
    metrics: {
      totalPrompts: number
      totalTopics: number
      coverage: number | null
      analysesCount: number
    }
  }>
}

