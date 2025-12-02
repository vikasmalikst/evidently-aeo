/**
 * Utility functions for competitor management
 */

import type { ManagedCompetitor, CompetitorDiff, CompetitorChangeType } from './types'

export function normalizeCompetitorName(name: string): string {
  return name.trim()
}

export function normalizeDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined
  return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
}

export function buildUrlFromDomain(domain: string | undefined): string | undefined {
  if (!domain) return undefined
  const normalized = normalizeDomain(domain)
  return normalized ? `https://${normalized}` : undefined
}

export function diffCompetitors(
  current: ManagedCompetitor[],
  next: ManagedCompetitor[]
): CompetitorDiff {
  const currentByName = new Map(
    current.map(comp => [comp.name.toLowerCase().trim(), comp])
  )
  const nextByName = new Map(
    next.map(comp => [comp.name.toLowerCase().trim(), comp])
  )

  const added = next.filter(
    comp => !currentByName.has(comp.name.toLowerCase().trim())
  )
  
  const removed = current.filter(
    comp => !nextByName.has(comp.name.toLowerCase().trim())
  )
  
  const updated = next.filter(comp => {
    const previous = currentByName.get(comp.name.toLowerCase().trim())
    if (!previous) return false
    
    // Check if any significant fields changed
    return (
      previous.url !== comp.url ||
      previous.domain !== comp.domain ||
      previous.relevance !== comp.relevance ||
      previous.industry !== comp.industry ||
      previous.logo !== comp.logo ||
      previous.priority !== comp.priority
    )
  })

  return { added, removed, updated }
}

export function determineChangeType(diff: CompetitorDiff): CompetitorChangeType {
  if (diff.added.length > 0 && diff.removed.length > 0) {
    return 'bulk_update'
  }
  if (diff.added.length > 0) {
    return 'competitor_added'
  }
  if (diff.removed.length > 0) {
    return 'competitor_removed'
  }
  if (diff.updated.length > 0) {
    return 'competitor_updated'
  }
  return 'competitor_updated'
}

export function generateChangeSummary(diff: CompetitorDiff): string {
  const parts: string[] = []
  
  if (diff.added.length > 0) {
    parts.push(`Added ${diff.added.length} competitor${diff.added.length === 1 ? '' : 's'}`)
  }
  
  if (diff.removed.length > 0) {
    parts.push(`Removed ${diff.removed.length} competitor${diff.removed.length === 1 ? '' : 's'}`)
  }
  
  if (diff.updated.length > 0 && diff.added.length === 0 && diff.removed.length === 0) {
    parts.push(`Updated ${diff.updated.length} competitor${diff.updated.length === 1 ? '' : 's'}`)
  }
  
  return parts.length > 0 ? parts.join(', ') : 'Competitors refreshed'
}

