/**
 * Shared Types for Competitor Management Services
 */

export interface ManagedCompetitor {
  id?: string
  name: string
  url?: string
  domain?: string
  relevance?: string
  industry?: string
  logo?: string
  source?: string
  priority?: number
  metadata?: Record<string, unknown>
  
  // Version info
  includedInVersions?: number[]
  firstVersionIncluded?: number | null
}

export interface CompetitorConfiguration {
  id: string
  brandId: string
  customerId: string
  version: number
  isActive: boolean
  changeType: CompetitorChangeType
  changeSummary: string | null
  createdAt: string
  createdBy: string | null
  metadata: Record<string, unknown>
}

export type CompetitorChangeType = 
  | 'initial_setup'
  | 'competitor_added'
  | 'competitor_removed'
  | 'competitor_updated'
  | 'bulk_update'
  | 'version_revert'

export interface CompetitorConfigurationSnapshot {
  id: string
  configurationId: string
  competitorName: string
  competitorUrl?: string
  domain?: string
  relevance?: string
  industry?: string
  logo?: string
  source?: string
  priority?: number
  metadata: Record<string, unknown>
  createdAt: string
}

export interface CompetitorChangeLog {
  id: string
  configurationId: string
  competitorName: string | null
  changeType: 'added' | 'removed' | 'updated'
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  changedBy: string | null
  changedAt: string
}

export interface CompetitorDiff {
  added: ManagedCompetitor[]
  removed: ManagedCompetitor[]
  updated: ManagedCompetitor[]
}

export interface VersionHistoryResponse {
  currentVersion: number
  versions: Array<{
    id: string
    version: number
    isActive: boolean
    changeType: CompetitorChangeType
    changeSummary: string | null
    createdAt: string
    createdBy: string | null
    competitorCount: number
  }>
}

export interface ManageCompetitorsResponse {
  brandId: string
  brandName: string
  currentVersion: number
  competitors: ManagedCompetitor[]
  summary: {
    totalCompetitors: number
  }
}

