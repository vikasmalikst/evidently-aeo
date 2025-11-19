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

    const history = await promptVersioningService.getVersionHistory(brandId, customerId)

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

