/**
 * Competitor CRUD Service
 * Handles create, read, update, delete operations for competitors
 */

import { supabaseAdmin } from '../../config/database'
import { DatabaseError } from '../../types/auth'
import { ManagedCompetitor, ManageCompetitorsResponse } from './types'
import { competitorVersioningService } from './competitor-versioning.service'
import { normalizeCompetitorName, normalizeDomain, buildUrlFromDomain } from './utils'

export class CompetitorCrudService {
  /**
   * Get all active competitors for a brand (for management UI)
   */
  async getActiveCompetitors(brandId: string, customerId: string): Promise<ManageCompetitorsResponse> {
    // Fetch brand info
    const { data: brandRow, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .eq('customer_id', customerId)
      .maybeSingle()

    if (brandError) {
      throw new DatabaseError(`Failed to load brand: ${brandError.message}`)
    }

    if (!brandRow) {
      throw new DatabaseError('Brand not found for customer')
    }

    // Get or create active version configuration
    let activeConfig = await competitorVersioningService.getCurrentVersion(brandId, customerId)

    // Fetch active competitors from brand_competitors table
    const { data: competitorRows, error: competitorError } = await supabaseAdmin
      .from('brand_competitors')
      .select('*')
      .eq('brand_id', brandId)
      .order('priority', { ascending: true })

    if (competitorError) {
      throw new DatabaseError(`Failed to load competitors: ${competitorError.message}`)
    }

    // Fetch competitor_data from brand_products table
    const { data: brandProductsData, error: brandProductsError } = await supabaseAdmin
      .from('brand_products')
      .select('competitor_data')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (brandProductsError) {
      console.warn(`[CompetitorCrudService] Failed to load competitor_data from brand_products: ${brandProductsError.message}`)
    }

    const competitorDataMap = brandProductsData?.competitor_data || {}
    console.log(`[CompetitorCrudService] Loaded competitor_data for brand ${brandId}:`, {
      hasData: !!brandProductsData,
      competitorKeys: Object.keys(competitorDataMap),
      competitorCount: Object.keys(competitorDataMap).length
    })

    const competitors: ManagedCompetitor[] = (competitorRows || []).map(row => {
      // Find competitor data from brand_products.competitor_data
      // Try exact match first, then case-insensitive match
      const competitorName = row.competitor_name
      let compData = competitorDataMap[competitorName]
      
      if (!compData) {
        // Try case-insensitive match
        const entry = Object.entries(competitorDataMap).find(
          ([key]) => key.toLowerCase() === competitorName.toLowerCase()
        )
        compData = entry?.[1] || null
      }

      if (compData) {
        console.log(`[CompetitorCrudService] Found data for competitor "${competitorName}":`, {
          synonyms: compData.synonyms?.length || 0,
          products: compData.products?.length || 0
        })
      } else {
        console.log(`[CompetitorCrudService] No data found for competitor "${competitorName}" in competitor_data`)
      }

      return {
        id: row.id,
        name: row.competitor_name,
        url: row.competitor_url,
        domain: row.metadata?.domain || normalizeDomain(row.competitor_url),
        relevance: row.metadata?.relevance || 'Direct Competitor',
        industry: row.metadata?.industry,
        logo: row.metadata?.logo || (row.metadata?.domain ? `https://logo.clearbit.com/${row.metadata.domain}` : undefined),
        source: row.metadata?.source || 'onboarding',
        priority: row.priority,
        metadata: row.metadata || {},
        // Add aliases/synonyms and products from competitor_data
        aliases: compData?.synonyms || [],
        products: compData?.products || []
      }
    })

    // If no active config exists but we have competitors, create initial version
    if (!activeConfig && competitors.length > 0) {
      activeConfig = await competitorVersioningService.createInitialVersion(
        brandId,
        customerId,
        competitors
      )
    }

    return {
      brandId,
      brandName: brandRow.name,
      currentVersion: activeConfig?.version || 0,
      competitors,
      summary: {
        totalCompetitors: competitors.length
      }
    }
  }

  /**
   * Add a new competitor
   */
  async addCompetitor(
    brandId: string,
    customerId: string,
    competitor: Omit<ManagedCompetitor, 'id'>,
    userId?: string
  ): Promise<ManagedCompetitor> {
    // Get current competitors
    const current = await this.getActiveCompetitors(brandId, customerId)
    
    // Check if competitor already exists
    const existing = current.competitors.find(
      c => c.name.toLowerCase().trim() === competitor.name.toLowerCase().trim()
    )
    
    if (existing) {
      throw new DatabaseError(`Competitor "${competitor.name}" already exists`)
    }

    // Check max limit (10 competitors)
    if (current.competitors.length >= 10) {
      throw new DatabaseError('Maximum of 10 competitors allowed')
    }

    // Normalize competitor data
    const normalized: ManagedCompetitor = {
      name: normalizeCompetitorName(competitor.name),
      url: competitor.url || buildUrlFromDomain(competitor.domain),
      domain: competitor.domain || normalizeDomain(competitor.url),
      relevance: competitor.relevance || 'Direct Competitor',
      industry: competitor.industry,
      logo: competitor.logo || (competitor.domain ? `https://logo.clearbit.com/${competitor.domain}` : undefined),
      source: competitor.source || 'custom',
      priority: competitor.priority || (current.competitors.length + 1),
      metadata: competitor.metadata || {}
    }

    // Create new version with added competitor
    const nextCompetitors = [...current.competitors, normalized]
    await competitorVersioningService.createNewVersion(
      brandId,
      customerId,
      current.competitors,
      nextCompetitors,
      `Added competitor: ${normalized.name}`,
      userId
    )

    return normalized
  }

  /**
   * Remove a competitor
   */
  async removeCompetitor(
    brandId: string,
    customerId: string,
    competitorName: string,
    userId?: string
  ): Promise<void> {
    // Get current competitors
    const current = await this.getActiveCompetitors(brandId, customerId)
    
    // Find competitor to remove
    const toRemove = current.competitors.find(
      c => c.name.toLowerCase().trim() === competitorName.toLowerCase().trim()
    )
    
    if (!toRemove) {
      throw new DatabaseError(`Competitor "${competitorName}" not found`)
    }

    // Create new version without removed competitor
    const nextCompetitors = current.competitors.filter(
      c => c.name.toLowerCase().trim() !== competitorName.toLowerCase().trim()
    )

    await competitorVersioningService.createNewVersion(
      brandId,
      customerId,
      current.competitors,
      nextCompetitors,
      `Removed competitor: ${toRemove.name}`,
      userId
    )
  }

  /**
   * Update a competitor
   */
  async updateCompetitor(
    brandId: string,
    customerId: string,
    competitorName: string,
    updates: Partial<Omit<ManagedCompetitor, 'id' | 'name'>>,
    userId?: string
  ): Promise<ManagedCompetitor> {
    // Get current competitors
    const current = await this.getActiveCompetitors(brandId, customerId)
    
    // Find competitor to update
    const index = current.competitors.findIndex(
      c => c.name.toLowerCase().trim() === competitorName.toLowerCase().trim()
    )
    
    if (index === -1) {
      throw new DatabaseError(`Competitor "${competitorName}" not found`)
    }

    const existing = current.competitors[index]
    
    // Apply updates
    const updated: ManagedCompetitor = {
      ...existing,
      ...updates,
      name: existing.name, // Name cannot be changed
      url: updates.url || existing.url || buildUrlFromDomain(updates.domain || existing.domain),
      domain: updates.domain || existing.domain || normalizeDomain(updates.url || existing.url),
      logo: updates.logo || existing.logo || (updates.domain || existing.domain ? `https://logo.clearbit.com/${updates.domain || existing.domain}` : undefined),
      metadata: { ...existing.metadata, ...updates.metadata },
      // Preserve aliases and products if not being updated
      aliases: updates.aliases !== undefined ? updates.aliases : existing.aliases,
      products: updates.products !== undefined ? updates.products : existing.products
    }

    // If aliases or products are being updated, also update brand_products.competitor_data
    if (updates.aliases !== undefined || updates.products !== undefined) {
      try {
        // Fetch current competitor_data from brand_products
        const { data: brandProductsData, error: fetchError } = await supabaseAdmin
          .from('brand_products')
          .select('competitor_data')
          .eq('brand_id', brandId)
          .maybeSingle()

        if (fetchError) {
          console.warn(`[CompetitorCrudService] Failed to fetch competitor_data: ${fetchError.message}`)
        }

        // Get current competitor_data or initialize empty object
        const competitorDataMap = brandProductsData?.competitor_data || {}
        
        // Update the competitor's data in the map
        // Use exact name match first, then try case-insensitive
        const competitorName = existing.name
        let foundKey = competitorName
        
        if (!competitorDataMap[competitorName]) {
          // Try case-insensitive match
          const entry = Object.entries(competitorDataMap).find(
            ([key]) => key.toLowerCase() === competitorName.toLowerCase()
          )
          if (entry) {
            foundKey = entry[0]
          }
        }

        // Update or create competitor entry
        competitorDataMap[foundKey] = {
          synonyms: updated.aliases || [],
          products: updated.products || []
        }

        // Save updated competitor_data back to brand_products
        const { error: updateError } = await supabaseAdmin
          .from('brand_products')
          .upsert({
            brand_id: brandId,
            competitor_data: competitorDataMap,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'brand_id'
          })

        if (updateError) {
          console.error(`[CompetitorCrudService] Failed to update competitor_data: ${updateError.message}`)
          // Don't throw - allow the competitor update to proceed even if competitor_data update fails
        } else {
          console.log(`[CompetitorCrudService] Successfully updated competitor_data for "${competitorName}"`)
        }
      } catch (error) {
        console.error(`[CompetitorCrudService] Error updating competitor_data:`, error)
        // Don't throw - allow the competitor update to proceed
      }
    }

    // Create new version with updated competitor
    const nextCompetitors = [...current.competitors]
    nextCompetitors[index] = updated

    await competitorVersioningService.createNewVersion(
      brandId,
      customerId,
      current.competitors,
      nextCompetitors,
      `Updated competitor: ${updated.name}`,
      userId
    )

    return updated
  }

  /**
   * Bulk update competitors (used for reordering, bulk add/remove)
   */
  async bulkUpdateCompetitors(
    brandId: string,
    customerId: string,
    competitors: ManagedCompetitor[],
    changeSummary?: string,
    userId?: string
  ): Promise<ManageCompetitorsResponse> {
    // Validate max limit
    if (competitors.length > 10) {
      throw new DatabaseError('Maximum of 10 competitors allowed')
    }

    // Get current competitors
    const current = await this.getActiveCompetitors(brandId, customerId)

    // Normalize all competitors
    const normalized = competitors.map((comp, index) => ({
      ...comp,
      name: normalizeCompetitorName(comp.name),
      url: comp.url || buildUrlFromDomain(comp.domain),
      domain: comp.domain || normalizeDomain(comp.url),
      priority: comp.priority || (index + 1),
      logo: comp.logo || (comp.domain ? `https://logo.clearbit.com/${comp.domain}` : undefined)
    }))

    // Create new version
    await competitorVersioningService.createNewVersion(
      brandId,
      customerId,
      current.competitors,
      normalized,
      changeSummary || 'Bulk update of competitors',
      userId
    )

    // Return updated list
    return this.getActiveCompetitors(brandId, customerId)
  }
}

export const competitorCrudService = new CompetitorCrudService()

