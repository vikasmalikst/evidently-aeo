// Main exports for brand dashboard services
export { dashboardService, DashboardService } from './dashboard.service'
export { dashboardCacheService, DashboardCacheService } from './cache.service'
export { visibilityService, VisibilityService } from './visibility.service'
export * from './types'
export * from './utils'

// Re-export for backward compatibility
export { dashboardService as brandDashboardService } from './dashboard.service'
export type { DashboardDateRange, BrandDashboardPayload } from './types'

