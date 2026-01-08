/**
 * Prompt Management API Routes
 * Handles all endpoints for managing prompts and versions
 */

import express, { Request, Response } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  promptCrudService,
  promptVersioningService,
  promptImpactService,
  promptComparisonService,
  PendingChanges
} from '../services/prompt-management'

const router = express.Router()

// Apply authentication to all routes
router.use(authenticateToken)

router.get('/brightdata/countries', async (_req: Request, res: Response) => {
  try {
    const apiKey = process.env.BRIGHTDATA_API_KEY || ''
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'BrightData API key not configured'
      })
    }

    const response = await fetch('https://api.brightdata.com/countrieslist', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      // IMPORTANT:
      // BrightData may return 401/403 for *their* credentials. That is not the same as
      // our app session being invalid. If we forward 401, the frontend will treat it
      // as "session expired" and log the user out. Map upstream auth failures to 502.
      const upstreamStatus = response.status
      const statusToReturn = upstreamStatus === 401 || upstreamStatus === 403 ? 502 : upstreamStatus
      return res.status(statusToReturn).json({
        success: false,
        error: `Failed to load BrightData countries: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      })
    }

    const responseText = await response.text()
    const normalizedText = responseText.trim().replace(/^\uFEFF/, '')
    let payload: unknown
    try {
      payload = JSON.parse(normalizedText)
    } catch {
      payload = normalizedText
    }

    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
    const normalizedByCode = new Map<string, { code: string; name: string }>()

    const isIso2 = (value: string) => /^[A-Za-z]{2}$/.test(value.trim())

    const addCountry = (codeRaw: unknown, nameRaw?: unknown) => {
      const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : ''
      if (!code) return
      const name =
        typeof nameRaw === 'string' && nameRaw.trim().length > 0
          ? nameRaw.trim()
          : displayNames.of(code) || code
      normalizedByCode.set(code, { code, name })
    }

    const tryAddFromObject = (obj: Record<string, unknown>) => {
      const codeRaw =
        obj.code ??
        obj.country_code ??
        obj.alpha2 ??
        obj.alpha_2 ??
        obj.iso2 ??
        obj.iso_2 ??
        obj.iso ??
        obj.id ??
        obj.value

      const nameRaw = obj.name ?? obj.country_name ?? obj.country ?? obj.label ?? obj.title

      if (typeof codeRaw === 'string' && isIso2(codeRaw)) {
        addCountry(codeRaw, typeof nameRaw === 'string' ? nameRaw : undefined)
        return true
      }

      if (typeof nameRaw === 'string') {
        for (const v of Object.values(obj)) {
          if (typeof v === 'string' && isIso2(v)) {
            addCountry(v, nameRaw)
            return true
          }
        }
      }

      return false
    }

    const normalizeArray = (arr: unknown[]) => {
      for (const item of arr) {
        if (typeof item === 'string') {
          const trimmed = item.trim()
          if (isIso2(trimmed)) {
            addCountry(trimmed)
            continue
          }

          const match =
            trimmed.match(/^([A-Za-z]{2})\s*[-:|]\s*(.+)$/) ||
            trimmed.match(/^(.+)\s*[-:|]\s*([A-Za-z]{2})$/)
          if (match) {
            const a = match[1]?.trim()
            const b = match[2]?.trim()
            if (/^[A-Za-z]{2}$/.test(a)) addCountry(a, b)
            else if (/^[A-Za-z]{2}$/.test(b)) addCountry(b, a)
            continue
          }

          if (/^[A-Za-z]{2},/.test(trimmed)) {
            addCountry(trimmed.slice(0, 2))
            continue
          }

          continue
        }
        if (Array.isArray(item)) {
          const a = item[0]
          const b = item[1]
          if (typeof a === 'string' && typeof b === 'string') {
            if (isIso2(a)) addCountry(a, b)
            else if (isIso2(b)) addCountry(b, a)
          } else {
            normalizeArray(item)
          }
          continue
        }
        if (item && typeof item === 'object') {
          tryAddFromObject(item as Record<string, unknown>)
        }
      }
    }

    const visit = (node: unknown, depth: number) => {
      if (depth > 6 || node === null || node === undefined) return
      if (typeof node === 'string') {
        const text = node.trim()
        if (isIso2(text)) addCountry(text)
        return
      }
      if (Array.isArray(node)) {
        normalizeArray(node)
        for (const item of node) visit(item, depth + 1)
        return
      }
      if (typeof node === 'object') {
        const obj = node as Record<string, unknown>
        tryAddFromObject(obj)

        for (const [k, v] of Object.entries(obj)) {
          if (isIso2(k)) {
            if (typeof v === 'string') addCountry(k, v)
            else if (v && typeof v === 'object') {
              const nestedName =
                (v as Record<string, unknown>).name ??
                (v as Record<string, unknown>).country_name ??
                (v as Record<string, unknown>).country ??
                (v as Record<string, unknown>).label ??
                (v as Record<string, unknown>).title
              addCountry(k, typeof nestedName === 'string' ? nestedName : undefined)
            }
          }
          visit(v, depth + 1)
        }
      }
    }

    if (typeof payload === 'string') {
      const lines = payload.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        const token = line.split(/[\s,;|]+/)[0]?.trim()
        if (token && isIso2(token)) addCountry(token)
      }

      if (normalizedByCode.size === 0) {
        const tokens = payload.split(/[\s,;|]+/).map(t => t.trim()).filter(Boolean)
        for (const token of tokens) {
          if (isIso2(token)) addCountry(token)
        }
      }
    } else if (Array.isArray(payload)) {
      visit(payload, 0)
    } else if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      const nested =
        obj.countries && Array.isArray(obj.countries)
          ? obj.countries
          : obj.data && Array.isArray(obj.data)
            ? obj.data
            : obj.result && Array.isArray(obj.result)
              ? obj.result
              : obj.items && Array.isArray(obj.items)
                ? obj.items
                : obj.list && Array.isArray(obj.list)
                  ? obj.list
                  : obj.values && Array.isArray(obj.values)
                    ? obj.values
                    : obj.countrieslist && Array.isArray(obj.countrieslist)
                      ? obj.countrieslist
                      : obj.countriesList && Array.isArray(obj.countriesList)
                        ? obj.countriesList
            : null

      if (nested) {
        visit(nested, 0)
      } else if (obj.countries && obj.countries && typeof obj.countries === 'object' && !Array.isArray(obj.countries)) {
        visit(obj.countries, 0)
      } else {
        visit(obj, 0)
      }
    }

    if (normalizedByCode.size === 0) {
      const contentType = response.headers.get('content-type') || ''
      const topLevel =
        payload === null
          ? 'null'
          : Array.isArray(payload)
            ? 'array'
            : typeof payload
      const keys =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? Object.keys(payload as Record<string, unknown>).slice(0, 30)
          : []
      return res.status(502).json({
        success: false,
        error: `BrightData countries response could not be parsed (content-type: ${contentType || 'unknown'})`,
        data: {
          topLevel,
          keys,
          preview: normalizedText.slice(0, 800)
        }
      })
    }

    const countries = Array.from(normalizedByCode.values()).sort((a, b) => a.name.localeCompare(b.name))

    return res.json({
      success: true,
      data: { countries }
    })
  } catch (error) {
    console.error('Error fetching BrightData countries:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch BrightData countries'
    })
  }
})

/**
 * GET /api/brands/:brandId/prompts/manage
 * Get all active prompts for management UI
 */
router.get('/brands/:brandId/prompts/manage', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const result = await promptCrudService.getActivePrompts(brandId, customerId)

    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error fetching prompts for management:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch prompts'
    })
  }
})

router.get('/brands/:brandId/prompts/config-v2', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const rows = await promptCrudService.getConfigV2Rows(brandId, customerId)

    return res.json({
      success: true,
      data: { rows }
    })
  } catch (error) {
    console.error('Error fetching config v2 rows:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch config rows'
    })
  }
})

router.get('/brands/:brandId/prompts/config-v2/archived', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const versions = await promptCrudService.getArchivedVersions(brandId)
    res.json({ success: true, data: versions })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/brands/:brandId/prompts/config-v2', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const customerId = req.user?.customer_id
    const { rows, deleteIds } = req.body

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (!Array.isArray(rows)) {
      return res.status(400).json({
        success: false,
        error: 'Rows are required'
      })
    }

    if (deleteIds !== undefined && !Array.isArray(deleteIds)) {
      return res.status(400).json({
        success: false,
        error: 'deleteIds must be an array'
      })
    }

    const result = await promptCrudService.saveConfigV2Rows(
      brandId,
      customerId,
      rows,
      Array.isArray(deleteIds) ? deleteIds : []
    )

    return res.json({
      success: true,
      data: result,
      message: 'Saved successfully'
    })
  } catch (error) {
    console.error('Error saving config v2 rows:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save config rows'
    })
  }
})

router.get('/brands/:brandId/prompts/history-v2', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const history = await promptCrudService.getHistory(brandId)

    return res.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('Error fetching history v2:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch history'
    })
  }
})

/**
 * POST /api/brands/:brandId/prompts
 * Add a new prompt
 */
router.post('/brands/:brandId/prompts', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const { text, topic, metadata } = req.body
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt text is required'
      })
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      })
    }

    const result = await promptCrudService.addPrompt(
      brandId,
      customerId,
      text.trim(),
      topic.trim(),
      metadata
    )

    return res.json({
      success: true,
      data: result,
      message: 'Prompt added successfully'
    })
  } catch (error) {
    console.error('Error adding prompt:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add prompt'
    })
  }
})

/**
 * PUT /api/brands/:brandId/prompts/:promptId
 * Update an existing prompt
 */
router.put('/brands/:brandId/prompts/:promptId', async (req: Request, res: Response) => {
  try {
    const { brandId, promptId } = req.params
    const { text, topic } = req.body
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const updates: { text?: string; topic?: string } = {}

    if (text !== undefined) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid prompt text'
        })
      }
      updates.text = text.trim()
    }

    if (topic !== undefined) {
      if (typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid topic'
        })
      }
      updates.topic = topic.trim()
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      })
    }

    await promptCrudService.updatePrompt(promptId, brandId, customerId, updates)

    return res.json({
      success: true,
      message: 'Prompt updated successfully'
    })
  } catch (error) {
    console.error('Error updating prompt:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update prompt'
    })
  }
})

/**
 * DELETE /api/brands/:brandId/prompts/:promptId
 * Archive or delete a prompt
 */
router.delete('/brands/:brandId/prompts/:promptId', async (req: Request, res: Response) => {
  try {
    const { brandId, promptId } = req.params
    const { permanent } = req.query
    const customerId = req.user?.customer_id
    const userId = req.user?.id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (permanent === 'true') {
      // Permanent deletion
      await promptCrudService.deletePrompt(promptId, brandId, customerId)
    } else {
      // Soft delete (archive)
      await promptCrudService.archivePrompt(promptId, brandId, customerId, userId)
    }

    return res.json({
      success: true,
      message: permanent === 'true' ? 'Prompt deleted permanently' : 'Prompt archived successfully'
    })
  } catch (error) {
    console.error('Error deleting prompt:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete prompt'
    })
  }
})

/**
 * POST /api/brands/:brandId/prompts/batch
 * Apply multiple changes and create a new version
 */
router.post('/brands/:brandId/prompts/batch', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const { changes, changeSummary } = req.body
    const customerId = req.user?.customer_id
    const userId = req.user?.id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Changes are required'
      })
    }

    const pendingChanges: PendingChanges = {
      added: Array.isArray(changes.added) ? changes.added : [],
      removed: Array.isArray(changes.removed) ? changes.removed : [],
      edited: Array.isArray(changes.edited) ? changes.edited : []
    }

    // Create new version with changes
    const newVersion = await promptVersioningService.createNewVersion(
      brandId,
      customerId,
      pendingChanges,
      changeSummary,
      userId
    )

    return res.json({
      success: true,
      data: {
        newVersion: newVersion.version,
        configurationId: newVersion.id
      },
      message: 'Changes applied successfully'
    })
  } catch (error) {
    console.error('Error applying batch changes:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply changes'
    })
  }
})

/**
 * POST /api/brands/:brandId/prompts/calculate-impact
 * Calculate estimated impact of pending changes
 */
router.post('/brands/:brandId/prompts/calculate-impact', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const { changes } = req.body
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Changes are required'
      })
    }

    const pendingChanges: PendingChanges = {
      added: Array.isArray(changes.added) ? changes.added : [],
      removed: Array.isArray(changes.removed) ? changes.removed : [],
      edited: Array.isArray(changes.edited) ? changes.edited : []
    }

    const impact = await promptImpactService.calculateImpact(brandId, customerId, pendingChanges)

    return res.json({
      success: true,
      data: {
        estimatedImpact: impact,
        calculatedAt: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Error calculating impact:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate impact'
    })
  }
})

/**
 * GET /api/brands/:brandId/prompts/versions
 * Get version history
 */
router.get('/brands/:brandId/prompts/versions', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    let history = await promptVersioningService.getVersionHistory(brandId, customerId)

    if (!history.versions.length) {
      await promptVersioningService.createInitialVersion(brandId, customerId, req.user?.id)
      history = await promptVersioningService.getVersionHistory(brandId, customerId)
    }

    return res.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('Error fetching version history:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch version history'
    })
  }
})

/**
 * GET /api/brands/:brandId/prompts/versions/:version
 * Get specific version details
 */
router.get('/brands/:brandId/prompts/versions/:version', async (req: Request, res: Response) => {
  try {
    const { brandId, version } = req.params
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const versionNumber = parseInt(version, 10)
    if (isNaN(versionNumber) || versionNumber < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version number'
      })
    }

    const versionDetails = await promptVersioningService.getVersionDetails(
      brandId,
      customerId,
      versionNumber
    )

    return res.json({
      success: true,
      data: versionDetails
    })
  } catch (error) {
    console.error('Error fetching version details:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch version details'
    })
  }
})

/**
 * POST /api/brands/:brandId/prompts/versions/:version/revert
 * Revert to a specific version
 */
router.post('/brands/:brandId/prompts/versions/:version/revert', async (req: Request, res: Response) => {
  try {
    const { brandId, version } = req.params
    const { reason } = req.body
    const customerId = req.user?.customer_id
    const userId = req.user?.id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const versionNumber = parseInt(version, 10)
    if (isNaN(versionNumber) || versionNumber < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version number'
      })
    }

    const newVersion = await promptVersioningService.revertToVersion(
      brandId,
      customerId,
      versionNumber,
      userId
    )

    return res.json({
      success: true,
      data: {
        newVersion: newVersion.version,
        configurationId: newVersion.id,
        revertedTo: versionNumber
      },
      message: `Successfully reverted to version ${versionNumber}`
    })
  } catch (error) {
    console.error('Error reverting version:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revert version'
    })
  }
})

/**
 * GET /api/brands/:brandId/prompts/versions/compare
 * Compare two versions
 */
router.get('/brands/:brandId/prompts/versions/compare', async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params
    const { version1, version2 } = req.query
    const customerId = req.user?.customer_id

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      })
    }

    const v1 = parseInt(version1 as string, 10)
    const v2 = parseInt(version2 as string, 10)

    if (isNaN(v1) || isNaN(v2) || v1 < 1 || v2 < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version numbers'
      })
    }

    const comparison = await promptComparisonService.compareVersions(
      brandId,
      customerId,
      v1,
      v2
    )

    return res.json({
      success: true,
      data: comparison
    })
  } catch (error) {
    console.error('Error comparing versions:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to compare versions'
    })
  }
})

export default router
