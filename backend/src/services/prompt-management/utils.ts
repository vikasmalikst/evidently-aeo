/**
 * Shared Utility Functions for Prompt Management Services
 */

import { ChangeType, PendingChanges } from './types'

/**
 * Determine the change type based on pending changes
 */
export function determineChangeType(changes: PendingChanges): ChangeType {
  const hasAdded = changes.added.length > 0
  const hasRemoved = changes.removed.length > 0
  const hasEdited = changes.edited.length > 0
  
  const totalChanges = changes.added.length + changes.removed.length + changes.edited.length
  
  // If multiple types of changes or many changes, it's a bulk update
  if (totalChanges > 5 || (hasAdded && hasRemoved) || (hasAdded && hasEdited) || (hasRemoved && hasEdited)) {
    return 'bulk_update'
  }
  
  // Single type of change
  if (hasAdded && !hasRemoved && !hasEdited) {
    return 'prompt_added'
  }
  if (hasRemoved && !hasAdded && !hasEdited) {
    return 'prompt_removed'
  }
  if (hasEdited && !hasAdded && !hasRemoved) {
    return 'prompt_edited'
  }
  
  // Default to bulk update for edge cases
  return 'bulk_update'
}

/**
 * Generate a change summary from pending changes
 */
export function generateChangeSummary(changes: PendingChanges): string {
  const parts: string[] = []
  
  if (changes.added.length > 0) {
    parts.push(`Added ${changes.added.length} prompt${changes.added.length > 1 ? 's' : ''}`)
  }
  if (changes.removed.length > 0) {
    parts.push(`Removed ${changes.removed.length} prompt${changes.removed.length > 1 ? 's' : ''}`)
  }
  if (changes.edited.length > 0) {
    parts.push(`Edited ${changes.edited.length} prompt${changes.edited.length > 1 ? 's' : ''}`)
  }
  
  if (parts.length === 0) {
    return 'No changes'
  }
  
  return parts.join(', ')
}

/**
 * Round a number to specified precision
 */
export function roundToPrecision(value: number, precision: number = 1): number {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0
  }
  return roundToPrecision(((newValue - oldValue) / oldValue) * 100, 1)
}

/**
 * Parse metadata from unknown type
 */
export function parseMetadata(metadata: unknown): Record<string, unknown> | null {
  if (metadata === null || metadata === undefined) {
    return null
  }
  if (typeof metadata === 'object') {
    return metadata as Record<string, unknown>
  }
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Extract topic name from metadata
 */
export function extractTopicName(...candidates: Array<Record<string, unknown> | null | undefined>): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue
    const topicValue = candidate['topic_name'] ?? candidate['topic'] ?? candidate['category']
    if (typeof topicValue === 'string' && topicValue.trim().length > 0) {
      return topicValue.trim()
    }
  }
  return null
}

/**
 * Slugify a string for use as an ID
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

/**
 * Group items by a key function
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  
  for (const item of items) {
    const key = keyFn(item)
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }
  
  return groups
}

/**
 * Get unique items from array
 */
export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

/**
 * Check if two arrays have the same elements (order-independent)
 */
export function arraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false
  
  const set1 = new Set(arr1)
  const set2 = new Set(arr2)
  
  if (set1.size !== set2.size) return false
  
  for (const item of set1) {
    if (!set2.has(item)) return false
  }
  
  return true
}

/**
 * Safely convert to array
 */
export function toArray(value: unknown): string[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : null))
      .filter((item): item is string => Boolean(item && item.trim().length > 0))
      .map((item) => item.trim())
  }
  if (typeof value === 'string') {
    return value
      .split(/[,;]|(?:\s{2,})/u)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
  }
  return []
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Calculate coverage score (placeholder - implement based on business logic)
 */
export function calculateCoverageScore(promptCount: number, topicCount: number): number {
  // Simple calculation: More prompts and topics = higher coverage
  // This is a placeholder - adjust based on actual requirements
  const baseScore = Math.min((promptCount / 50) * 60, 60) // Max 60 points for prompt count
  const topicScore = Math.min((topicCount / 10) * 40, 40) // Max 40 points for topic diversity
  return roundToPrecision(baseScore + topicScore, 1)
}

