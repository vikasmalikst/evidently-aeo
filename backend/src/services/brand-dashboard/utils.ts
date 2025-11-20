export const DISTRIBUTION_COLORS = ['#6366f1', '#0ea5e9', '#22d3ee', '#f97316', '#a855f7', '#10b981', '#facc15']

export const COLLECTOR_COLORS: Record<string, string> = {
  chatgpt: '#0ea5e9',
  'openai-chatgpt': '#0ea5e9',
  claude: '#6366f1',
  anthropic: '#6366f1',
  gemini: '#a855f7',
  perplexity: '#f97316',
  deepseek: '#10b981',
  'bing copilot': '#4b5563',
  bing_copilot: '#4b5563',
  'google aio': '#06b6d4',
  google_aio: '#06b6d4',
  grok: '#f43f5e',
  dataforseo: '#facc15',
  brightdata: '#ec4899',
  oxylabs: '#14b8a6',
  default: '#64748b'
}

export const round = (value: number, precision = 1): number => {
  const factor = Math.pow(10, precision)
  return Math.round(value * factor) / factor
}

export const toNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const sanitized = value.replace(/[,%\s]/g, '')
  const parsed = Number(sanitized)
  return Number.isFinite(parsed) ? parsed : 0
}

export const average = (values: number[]): number => {
  if (!values.length) {
    return 0
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return sum / values.length
}

/**
 * @deprecated Use raw sentiment values (-1 to 1 scale) instead. This normalization loses original sentiment information.
 * Use: average(sentimentValues) instead of normalizeSentiment(sentimentValues)
 */
export const normalizeSentiment = (values: number[]): number => {
  if (!values.length) {
    return 50
  }
  const avgRaw = average(values)
  const normalized = ((avgRaw + 1) / 2) * 100
  return Math.min(100, Math.max(0, normalized))
}

export const truncateLabel = (label: string, maxLength = 52): string => {
  if (label.length <= maxLength) {
    return label
  }
  return `${label.slice(0, maxLength - 1)}…`
}

export const clampPercentage = (value: number): number => Math.min(100, Math.max(0, value))

/**
 * @deprecated SOA values are already stored as 0-100 percentage format. 
 * This function incorrectly assumes values <= 1 are decimals and multiplies by 100.
 * Use raw values directly: avgShare (already 0-100) instead of toPercentage(avgShare)
 */
export const toPercentage = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0
  }
  if (value <= 1) {
    return clampPercentage(value * 100)
  }
  return clampPercentage(value)
}

export const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_RANGE_DAYS = 30

export const normalizeDateRange = (dateRange?: { start: string; end: string }): {
  startDate: Date
  endDate: Date
  startIso: string
  endIso: string
} => {
  const now = new Date()
  const defaultStart = new Date(now.getTime() - DEFAULT_RANGE_DAYS * DAY_MS)
  const defaultEnd = now

  let start = dateRange?.start ? new Date(dateRange.start) : defaultStart
  let end = dateRange?.end ? new Date(dateRange.end) : defaultEnd

  if (Number.isNaN(start.getTime())) {
    start = defaultStart
  }

  if (Number.isNaN(end.getTime())) {
    end = defaultEnd
  }

  if (start.getTime() > end.getTime()) {
    const temp = start
    start = end
    end = temp
  }

  start.setUTCHours(0, 0, 0, 0)
  end.setUTCHours(23, 59, 59, 999)

  return {
    startDate: start,
    endDate: end,
    startIso: start.toISOString(),
    endIso: end.toISOString()
  }
}

