/**
 * Recommendations V3 API Routes
 * 
 * Endpoints for the new Recommendations V3 workflow:
 * - KPI-first approach (identify KPIs, then generate recommendations per KPI)
 * - 4-step workflow (Generate → Approve → Content → Complete)
 * 
 * This is a separate implementation from recommendations.routes.ts
 * to maintain backward compatibility.
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { recommendationV3Service } from '../services/recommendations/recommendation-v3.service';
import { dashboardService } from '../services/brand-dashboard/dashboard.service';
import { recommendationContentService } from '../services/recommendations/recommendation-content.service';
import { supabaseAdmin } from '../config/database';
import { brandService } from '../services/brand.service';
import { brandDashboardService } from '../services/brand-dashboard';
import { regenerateContentService } from '../services/recommendations/regenerate-content.service';
import { graphRecommendationService } from '../services/recommendations/graph-recommendation.service';

const router = express.Router();

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  try {
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    // Fallback: strip path/query and normalize
    const withoutPath = trimmed.split('/')[0] || trimmed;
    return withoutPath.replace(/^www\./i, '').toLowerCase();
  }
}

function getSourceKpiValue(params: {
  focusArea?: string | null;
  kpiName?: string | null;
  source: { visibility?: number; soa: number; sentiment: number; mentionRate: number };
}): number | null {
  const focus = (params.focusArea || '').toLowerCase();
  if (focus === 'visibility') return params.source.visibility ?? null;
  if (focus === 'soa') return params.source.soa ?? null;
  if (focus === 'sentiment') return params.source.sentiment ?? null;
  if (focus === 'mention' || focus === 'mentions') return params.source.mentionRate ?? null;

  const kpiLower = (params.kpiName || '').toLowerCase();
  if (kpiLower.includes('visibility')) return params.source.visibility ?? null;
  if (kpiLower.includes('soa') || kpiLower.includes('share')) return params.source.soa ?? null;
  if (kpiLower.includes('sentiment')) return params.source.sentiment ?? null;
  if (kpiLower.includes('mention')) return params.source.mentionRate ?? null;

  // Unknown KPI mapping
  return null;
}

/**
 * POST /api/recommendations-v3/generate
 * 
 * Generate recommendations using KPI-first approach.
 * 
 * Request body:
 *   - brandId (optional): The brand ID to generate recommendations for.
 *                         If not provided, uses the customer's first brand.
 * 
 * Response:
 *   - success: boolean
 *   - data: {
 *       generationId: string
 *       kpis: IdentifiedKPI[]
 *       recommendations: RecommendationV3[]
 *       generatedAt: string
 *       brandId: string
 *       brandName: string
 *     }
 */
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    let { brandId } = req.body;

    // If no brandId provided, get the customer's first brand
    if (!brandId) {
      console.log('📍 [RecommendationsV3] No brandId provided, fetching first brand for customer');
      const brands = await brandService.getBrandsByCustomer(customerId);

      if (!brands || brands.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No brands found. Please complete brand onboarding first.'
        });
      }

      brandId = brands[0].id;
      console.log(`📍 [RecommendationsV3] Using first brand: ${brandId}`);
    }

    // Generate recommendations
    console.log(`🚀 [RecommendationsV3] Generating recommendations for brand: ${brandId}`);

    try {
      const result = await recommendationV3Service.generateRecommendations(brandId, customerId);

      if (!result.success) {
        return res.json({
          success: true,
          data: {
            generationId: result.generationId || null,
            dataMaturity: result.dataMaturity || null,
            kpis: result.kpis || [],
            recommendations: [],
            message: result.message || 'No recommendations generated at this time.'
          }
        });
      }

      // Return response immediately
      return res.json({
        success: true,
        data: {
          generationId: result.generationId,
          dataMaturity: result.dataMaturity || null,
          kpis: result.kpis,
          recommendations: result.recommendations,
          generatedAt: result.generatedAt,
          brandId: result.brandId,
          brandName: result.brandName
        }
      });
    } catch (genError) {
      console.error('❌ [RecommendationsV3] Error during generation:', genError);
      // Even if generation fails, try to return what we have
      return res.json({
        success: false,
        error: genError instanceof Error ? genError.message : 'Failed to generate recommendations',
        data: {
          generationId: null,
          kpis: [],
          recommendations: []
        }
      });
    }

  } catch (error) {
    console.error('❌ [RecommendationsV3] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations. Please try again later.'
    });
  }
});

/**
 * GET /api/recommendations-v3/:generationId
 * 
 * Get all recommendations for a generation (all steps).
 * 
 * Response:
 *   - success: boolean
 *   - data: {
 *       generationId: string
 *       kpis: IdentifiedKPI[]
 *       recommendations: RecommendationV3[]
 *       generatedAt: string
 *       brandId: string
 *       brandName: string
 *     }
 */
router.get('/:generationId', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { generationId } = req.params;

    // Get generation info
    const { data: generation, error: genError } = await supabaseAdmin
      .from('recommendation_generations')
      .select('id, brand_id, customer_id, generated_at, metadata')
      .eq('id', generationId)
      .eq('customer_id', customerId)
      .single();

    if (genError || !generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    // Get brand info
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('id', generation.brand_id)
      .single();

    // Get KPIs
    const { data: kpisData, error: kpisError } = await supabaseAdmin
      .from('recommendation_v3_kpis')
      .select('*')
      .eq('generation_id', generationId)
      .order('display_order', { ascending: true });

    if (kpisError) {
      console.error('❌ [RecommendationsV3] Error fetching KPIs:', kpisError);
    }

    // Get recommendations
    const { data: recommendationsData, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('*')
      .eq('generation_id', generationId)
      .order('display_order', { ascending: true });

    if (recError) {
      console.error('❌ [RecommendationsV3] Error fetching recommendations:', recError);
      return res.status(500).json({
        success: false,
        error: 'Failed to load recommendations'
      });
    }

    // Transform to API format
    const kpis = (kpisData || []).map(kpi => ({
      id: kpi.id,
      kpiName: kpi.kpi_name,
      kpiDescription: kpi.kpi_description,
      currentValue: kpi.current_value,
      targetValue: kpi.target_value,
      displayOrder: kpi.display_order
    }));

    const recommendations = (recommendationsData || []).map(rec => ({
      id: rec.id,
      action: rec.action,
      citationSource: rec.citation_source,
      focusArea: rec.focus_area,
      priority: rec.priority,
      effort: rec.effort,
      kpiId: rec.kpi_id,
      kpi: rec.kpi,
      reason: rec.reason,
      explanation: rec.explanation,
      impactScore: rec.impact_score,
      mentionRate: rec.mention_rate,
      soa: rec.soa,
      sentiment: rec.sentiment,
      visibilityScore: rec.visibility_score,
      citationCount: rec.citation_count,
      focusSources: rec.focus_sources,
      contentFocus: rec.content_focus,
      expectedBoost: rec.expected_boost,
      timeline: rec.timeline,
      confidence: rec.confidence,
      isApproved: rec.is_approved,
      isContentGenerated: rec.is_content_generated,
      isCompleted: rec.is_completed,
      completedAt: rec.completed_at,
      kpiBeforeValue: rec.kpi_before_value,
      kpiAfterValue: rec.kpi_after_value,
      reviewStatus: (rec.metadata as any)?.is_removed ? 'removed' : (rec.review_status || 'pending_review'),
      metadata: rec.metadata
    }));

    return res.json({
      success: true,
      data: {
        generationId: generation.id,
        dataMaturity: (generation as any)?.metadata?.dataMaturity || null,
        kpis,
        recommendations,
        generatedAt: generation.generated_at,
        brandId: generation.brand_id,
        brandName: brand?.name || 'Unknown Brand'
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 GET] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations. Please try again later.'
    });
  }
});

/**
 * GET /api/recommendations-v3/:generationId/steps/:step
 * 
 * Get recommendations filtered by workflow step.
 * 
 * Step 1: All non-completed recommendations (is_completed = false)
 * Step 2: Approved recommendations (is_approved = true, is_content_generated = false)
 * Step 3: Content generated (is_content_generated = true, is_completed = false)
 * Step 4: Completed and approved (is_completed = true, review_status = 'approved')
 */
router.get('/:generationId/steps/:step', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { generationId, step } = req.params;
    const stepNum = parseInt(step, 10);

    if (isNaN(stepNum) || stepNum < 1 || stepNum > 4) {
      return res.status(400).json({
        success: false,
        error: 'Invalid step number. Must be 1-4.'
      });
    }

    // Verify generation belongs to customer
    const { data: generation } = await supabaseAdmin
      .from('recommendation_generations')
      .select('id, customer_id, metadata')
      .eq('id', generationId)
      .eq('customer_id', customerId)
      .single();

    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    // Build query based on step - IMPORTANT: Always filter by customer_id
    let query = supabaseAdmin
      .from('recommendations')
      .select('*')
      .eq('generation_id', generationId)
      .eq('customer_id', customerId); // CRITICAL: Filter by customer_id

    if (stepNum === 1) {
      // Step 1: All non-completed recommendations - exclude completed ones
      query = query.eq('is_completed', false);
      // Filter by review_status if provided in query params (for specific filtering)
      const reviewStatus = req.query.reviewStatus as string | undefined;
      if (reviewStatus && ['pending_review', 'approved', 'rejected'].includes(reviewStatus)) {
        query = query.eq('review_status', reviewStatus);
      }
    } else if (stepNum === 2) {
      // Step 2: Approved but content not generated
      query = query.eq('is_approved', true).eq('is_content_generated', false);
    } else if (stepNum === 3) {
      // Step 3: Content generated but not completed
      query = query.eq('is_content_generated', true).eq('is_completed', false);
    } else if (stepNum === 4) {
      // Step 4: Completed and approved (exclude rejected/pending recommendations from results)
      query = query.eq('is_completed', true).eq('review_status', 'approved');
    }

    console.log(`📊 [RecommendationsV3 Step ${stepNum}] Query filters: generation_id=${generationId}, customer_id=${customerId}, is_approved=${stepNum === 2 ? 'true' : stepNum === 1 ? 'false' : 'any'}, is_content_generated=${stepNum === 2 ? 'false' : stepNum === 3 ? 'true' : 'any'}`);

    const { data: recommendationsData, error: recError } = await query.order('display_order', { ascending: true });

    if (recError) {
      console.error('❌ [RecommendationsV3] Error fetching recommendations by step:', recError);
      return res.status(500).json({
        success: false,
        error: 'Failed to load recommendations'
      });
    }

    console.log(`📊 [RecommendationsV3 Step ${stepNum}] Found ${(recommendationsData || []).length} recommendations`);
    if (stepNum === 2) {
      console.log(`📊 [RecommendationsV3 Step 2] Approved recommendations:`,
        (recommendationsData || []).map(r => ({ id: r.id, action: r.action?.substring(0, 40), is_approved: r.is_approved })));
    }

    // For Step 4, use stored database values directly (no external API calls for fast loading)
    // Backfill kpiBeforeValue if null for legacy rows
    let kpiCurrentValuesMap: Map<string, number | null> = new Map();
    if (stepNum === 4) {
      // Legacy fallback: if kpi_before_value is null, fall back to KPI table current_value (brand's overall KPI)
      const recommendationsWithNullKpiBefore = (recommendationsData || []).filter(rec => rec.kpi_before_value === null && rec.kpi_id);
      if (recommendationsWithNullKpiBefore.length > 0) {
        const kpiIds = [...new Set(recommendationsWithNullKpiBefore.map(r => r.kpi_id).filter(Boolean))];
        if (kpiIds.length > 0) {
          const { data: kpisData } = await supabaseAdmin
            .from('recommendation_v3_kpis')
            .select('id, current_value')
            .in('id', kpiIds);

          if (kpisData) {
            kpisData.forEach(kpi => {
              kpiCurrentValuesMap.set(kpi.id, kpi.current_value);
            });
          }
        }
      }
    }

    const recommendations = (recommendationsData || []).map(rec => {
      // For Step 4, use stored database values directly (fast, no external API calls)
      let kpiBeforeValue = rec.kpi_before_value;
      let soa = rec.soa;
      let sentiment = rec.sentiment;
      let visibilityScore = rec.visibility_score;
      let mentionRate = rec.mention_rate;

      if (stepNum === 4) {
        // Backfill kpiBeforeValue if null (legacy rows): use brand's overall KPI from KPI table
        if (kpiBeforeValue === null && rec.kpi_id) {
          const currentValue = kpiCurrentValuesMap.get(rec.kpi_id);
          if (currentValue !== undefined) {
            kpiBeforeValue = currentValue;
          }
        }
      }

      return {
        id: rec.id,
        action: rec.action,
        citationSource: rec.citation_source,
        focusArea: rec.focus_area,
        priority: rec.priority,
        effort: rec.effort,
        kpiId: rec.kpi_id,
        kpi: rec.kpi,
        reason: rec.reason,
        explanation: rec.explanation,
        impactScore: rec.impact_score,
        mentionRate: mentionRate,
        soa: soa,
        sentiment: sentiment,
        visibilityScore: visibilityScore,
        citationCount: rec.citation_count,
        focusSources: rec.focus_sources,
        contentFocus: rec.content_focus,
        expectedBoost: rec.expected_boost,
        timeline: rec.timeline,
        confidence: rec.confidence,
        isApproved: rec.is_approved,
        isContentGenerated: rec.is_content_generated,
        isCompleted: rec.is_completed,
        completedAt: rec.completed_at,
        kpiBeforeValue: kpiBeforeValue,
        kpiAfterValue: rec.kpi_after_value,
        reviewStatus: (rec.metadata as any)?.is_removed ? 'removed' : (rec.review_status || 'pending_review'),
        metadata: rec.metadata
      };
    });

    return res.json({
      success: true,
      data: {
        step: stepNum,
        dataMaturity: (generation as any)?.metadata?.dataMaturity || null,
        recommendations
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Step GET] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations. Please try again later.'
    });
  }
});

/**
 * PATCH /api/recommendations-v3/:recommendationId/approve
 * 
 * Approve a recommendation (Step 1 → Step 2).
 * Can approve multiple recommendations by passing an array of IDs.
 * 
 * Request body:
 *   - recommendationIds (optional): Array of recommendation IDs to approve.
 *                                    If not provided, approves the single recommendation from URL.
 */
router.patch('/:recommendationId/approve', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { recommendationId } = req.params;
    const { recommendationIds } = req.body || {};

    // Support both single ID and bulk approve
    const idsToApprove = recommendationIds && Array.isArray(recommendationIds)
      ? recommendationIds.filter(id => id && typeof id === 'string' && id.length > 10)
      : [recommendationId].filter(id => id && typeof id === 'string' && id.length > 10);

    if (idsToApprove.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid recommendation IDs provided'
      });
    }

    console.log(`📝 [RecommendationsV3] Approving ${idsToApprove.length} recommendations:`, idsToApprove);

    // Verify all recommendations belong to customer
    const { data: recommendations, error: verifyError } = await supabaseAdmin
      .from('recommendations')
      .select('id, customer_id, generation_id')
      .in('id', idsToApprove);

    if (verifyError) {
      console.error('❌ [RecommendationsV3] Error verifying recommendations:', verifyError);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify recommendations'
      });
    }

    if (!recommendations || recommendations.length === 0) {
      console.error(`❌ [RecommendationsV3] No recommendations found for IDs:`, idsToApprove);
      return res.status(404).json({
        success: false,
        error: 'One or more recommendations not found'
      });
    }

    // Check if all recommendations belong to this customer
    const invalidRecommendations = recommendations.filter(r => r.customer_id !== customerId);
    if (invalidRecommendations.length > 0) {
      console.error(`❌ [RecommendationsV3] ${invalidRecommendations.length} recommendations don't belong to customer`);
      return res.status(403).json({
        success: false,
        error: 'One or more recommendations do not belong to your account'
      });
    }

    if (recommendations.length !== idsToApprove.length) {
      console.warn(`⚠️ [RecommendationsV3] Found ${recommendations.length} recommendations but ${idsToApprove.length} IDs provided`);
      // Continue anyway - approve what we found
    }

    // Update recommendations using the verified IDs
    const verifiedIds = recommendations.map(r => r.id);
    const { error: updateError } = await supabaseAdmin
      .from('recommendations')
      .update({
        is_approved: true,
        review_status: 'approved' // Also update review_status
      })
      .in('id', verifiedIds)
      .eq('customer_id', customerId);

    if (updateError) {
      console.error('❌ [RecommendationsV3] Error approving recommendations:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to approve recommendations'
      });
    }

    console.log(`✅ [RecommendationsV3] Successfully approved ${verifiedIds.length} recommendations`);

    return res.json({
      success: true,
      data: {
        approvedCount: verifiedIds.length
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Approve] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to approve recommendation(s)'
    });
  }
});

/**
 * PATCH /api/recommendations-v3/:recommendationId/status
 * 
 * Update the review status of a recommendation (Step 1).
 * Status values: 'pending_review', 'approved', 'rejected'
 * 
 * Request body:
 *   - status: 'pending_review' | 'approved' | 'rejected'
 */
router.patch('/:recommendationId/status', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { recommendationId } = req.params;
    const { status } = req.body;

    if (!status || !['pending_review', 'approved', 'rejected', 'removed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: pending_review, approved, rejected, removed'
      });
    }

    // Verify recommendation belongs to customer
    const { data: recommendation, error: verifyError } = await supabaseAdmin
      .from('recommendations')
      .select('id, customer_id, generation_id, metadata')
      .eq('id', recommendationId)
      .eq('customer_id', customerId)
      .single();

    if (verifyError || !recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    // Build update object
    const updateData: any = { review_status: status };

    // Workaround for 'removed' status due to DB constraints
    // If status is 'removed', we store 'rejected' in the DB but set a metadata flag
    if (status === 'removed') {
      updateData.review_status = 'rejected';
      updateData.metadata = {
        ...(recommendation.metadata || {}),
        is_removed: true
      };
    } else {
      // If we are setting to something else, remove the is_removed flag if it exists
      if (recommendation.metadata && (recommendation.metadata as any).is_removed) {
        const newMetadata = { ...((recommendation.metadata || {}) as any) };
        delete newMetadata.is_removed;
        updateData.metadata = newMetadata;
      }
    }

    // If status is 'approved', also set is_approved = true
    // If status is 'rejected' or 'pending_review' or 'removed', set is_approved = false
    if (status === 'approved') {
      updateData.is_approved = true;
    } else {
      updateData.is_approved = false;
    }

    // Update recommendation
    const { error: updateError } = await supabaseAdmin
      .from('recommendations')
      .update(updateData)
      .eq('id', recommendationId)
      .eq('customer_id', customerId);

    if (updateError) {
      console.error('❌ [RecommendationsV3] Error updating review status:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update review status'
      });
    }

    console.log(`✅ [RecommendationsV3] Successfully updated review status for recommendation ${recommendationId} to ${status}`);

    return res.json({
      success: true,
      data: {
        recommendationId,
        status
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Status Update] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update review status'
    });
  }
});

/**
 * POST /api/recommendations-v3/generate-content-bulk
 * 
 * Generate content for all approved recommendations in a generation (Step 2 → Step 3).
 * Uses OpenRouter as primary provider (via recommendationContentService).
 */
router.post('/generate-content-bulk', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { generationId } = req.body;

    if (!generationId) {
      return res.status(400).json({
        success: false,
        error: 'generationId is required'
      });
    }

    // Get all approved recommendations for this generation that don't have content yet
    const { data: recommendations, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('id, action, citation_source, kpi, focus_area, priority, effort, timeline, expected_boost, impact_score, mention_rate, visibility_score, soa, sentiment, citation_count, focus_sources, content_focus, reason, explanation, brand_id, generation_id')
      .eq('generation_id', generationId)
      .eq('customer_id', customerId)
      .eq('is_approved', true)
      .eq('is_content_generated', false);

    if (recError) {
      console.error('❌ [RecommendationsV3 Bulk Content] Error fetching recommendations:', recError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch recommendations'
      });
    }

    if (!recommendations || recommendations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No approved recommendations found that need content generation'
      });
    }

    console.log(`📝 [RecommendationsV3 Bulk Content] Generating content for ${recommendations.length} recommendations using OpenRouter`);

    // Generate content for all recommendations in parallel
    const contentPromises = recommendations.map(async (rec) => {
      try {
        const result = await recommendationContentService.generateContent(
          rec.id,
          customerId,
          { contentType: 'draft' }
        );

        if (result?.record) {
          // Mark recommendation as content generated
          await supabaseAdmin
            .from('recommendations')
            .update({ is_content_generated: true })
            .eq('id', rec.id)
            .eq('customer_id', customerId);

          // Parse content if it's a JSON string, otherwise return as-is
          let contentData = result.record;
          try {
            if (typeof result.record.content === 'string') {
              // Try to parse JSON content
              try {
                const parsed = JSON.parse(result.record.content);
                contentData = {
                  ...result.record,
                  content: parsed
                };
              } catch {
                // Not JSON, keep as string
                contentData = result.record;
              }
            }
          } catch (err) {
            console.warn(`⚠️ [RecommendationsV3 Bulk Content] Could not parse content for ${rec.id}, using raw:`, err);
            // Use raw content
            contentData = result.record;
          }

          return {
            recommendationId: rec.id,
            success: true,
            content: contentData,
            providerUsed: result.providerUsed,
            modelUsed: result.modelUsed
          };
        } else {
          console.error(`❌ [RecommendationsV3 Bulk Content] No record returned for ${rec.id}`);
          return {
            recommendationId: rec.id,
            success: false,
            error: 'Failed to generate content - no record returned'
          };
        }
      } catch (error: any) {
        console.error(`❌ [RecommendationsV3 Bulk Content] Error generating content for ${rec.id}:`, error);
        return {
          recommendationId: rec.id,
          success: false,
          error: error.message || 'Failed to generate content'
        };
      }
    });

    const results = await Promise.all(contentPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ [RecommendationsV3 Bulk Content] Generated content for ${successful.length}/${recommendations.length} recommendations`);

    return res.json({
      success: true,
      data: {
        total: recommendations.length,
        successful: successful.length,
        failed: failed.length,
        results: results
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Bulk Content] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate content'
    });
  }
});

/**
 * POST /api/recommendations-v3/refine-content
 * 
 * Refine content sections based on user feedback (Interactive refinement loop).
 * Takes original sections with per-section feedback and generates improved content.
 * 
 * Request body:
 *   - recommendationId: string
 *   - sections: Array<{ id, title, content, feedback }>
 *   - references: string (optional additional context)
 *   - brandName: string
 */
router.post('/refine-content', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { recommendationId, sections, references, brandName } = req.body;

    if (!recommendationId || !sections || !Array.isArray(sections)) {
      return res.status(400).json({
        success: false,
        error: 'recommendationId and sections array are required'
      });
    }

    // Verify recommendation belongs to customer
    const { data: recommendation, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('id, customer_id')
      .eq('id', recommendationId)
      .eq('customer_id', customerId)
      .single();

    if (recError || !recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    console.log(`🔄 [RecommendationsV3 Refine] Refining ${sections.length} sections for recommendation ${recommendationId}`);

    // Call refinement service
    const refinedContent = await recommendationContentService.refineContent(
      recommendationId,
      sections,
      references || '',
      brandName || ''
    );

    if (!refinedContent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to refine content'
      });
    }

    console.log(`✅ [RecommendationsV3 Refine] Successfully refined content with ${refinedContent.sections.length} sections`);

    return res.json({
      success: true,
      data: {
        refinedContent
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Refine] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to refine content'
    });
  }
});

/**
 * POST /api/recommendations-v3/generate-guides-bulk
 *
 * Cold-start Step 2: Generate implementation guides for approved recommendations.
 * Guides are execution checklists + deliverables + success criteria (NOT outreach emails / publishable content).
 */
router.post('/generate-guides-bulk', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { generationId } = req.body;

    if (!generationId) {
      return res.status(400).json({
        success: false,
        error: 'generationId is required'
      });
    }

    // Get all approved recommendations for this generation that haven't had a guide/content generated yet
    const { data: recommendations, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('id, generation_id, brand_id, customer_id')
      .eq('generation_id', generationId)
      .eq('customer_id', customerId)
      .eq('is_approved', true)
      .eq('is_content_generated', false);

    if (recError) {
      console.error('❌ [RecommendationsV3 Bulk Guides] Error fetching recommendations:', recError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch recommendations'
      });
    }

    if (!recommendations || recommendations.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No approved recommendations found for this generation'
      });
    }

    console.log(`📘 [RecommendationsV3 Bulk Guides] Generating guides for ${recommendations.length} recommendation(s)...`);

    const guidePromises = recommendations.map(async (rec) => {
      try {
        const result = await recommendationContentService.generateContent(
          rec.id,
          customerId,
          { contentType: 'cold_start_guide' }
        );

        if (result?.record) {
          // Mark recommendation as "generated" so it moves to Step 3.
          // For cold_start we use Step 3 as the guide review step (instead of email/publishable content).
          await supabaseAdmin
            .from('recommendations')
            .update({ is_content_generated: true })
            .eq('id', rec.id)
            .eq('customer_id', customerId);

          // Parse JSON guide if possible; otherwise return raw record
          let guideData: any = result.record;
          try {
            if (typeof result.record.content === 'string') {
              try {
                const parsed = JSON.parse(result.record.content);
                guideData = { ...result.record, content: parsed };
              } catch {
                guideData = result.record;
              }
            }
          } catch (err) {
            console.warn(`⚠️ [RecommendationsV3 Bulk Guides] Could not parse guide for ${rec.id}, using raw:`, err);
            guideData = result.record;
          }

          return {
            recommendationId: rec.id,
            success: true,
            guide: guideData,
            providerUsed: result.providerUsed,
            modelUsed: result.modelUsed
          };
        }

        return {
          recommendationId: rec.id,
          success: false,
          error: 'Failed to generate guide - no record returned'
        };
      } catch (error: any) {
        console.error(`❌ [RecommendationsV3 Bulk Guides] Error generating guide for ${rec.id}:`, error);
        return {
          recommendationId: rec.id,
          success: false,
          error: error.message || 'Failed to generate guide'
        };
      }
    });

    const results = await Promise.all(guidePromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`✅ [RecommendationsV3 Bulk Guides] Generated guides for ${successful.length}/${recommendations.length}`);

    return res.json({
      success: true,
      data: {
        total: recommendations.length,
        successful: successful.length,
        failed: failed.length,
        results
      }
    });
  } catch (error) {
    console.error('❌ [RecommendationsV3 Bulk Guides] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate guides'
    });
  }
});

/**
 * POST /api/recommendations-v3/:recommendationId/content
 * 
 * Generate content for a single approved recommendation (Step 2 → Step 3).
 * @deprecated Use /generate-content-bulk for bulk generation
 */
router.post('/:recommendationId/content', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { recommendationId } = req.params;
    const { contentType } = req.body || {};

    // Verify recommendation is approved
    const { data: recommendation } = await supabaseAdmin
      .from('recommendations')
      .select('id, is_approved, customer_id')
      .eq('id', recommendationId)
      .eq('customer_id', customerId)
      .single();

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    if (!recommendation.is_approved) {
      return res.status(400).json({
        success: false,
        error: 'Recommendation must be approved before generating content'
      });
    }

    // Generate content using existing service
    const result = await recommendationContentService.generateContent(
      recommendationId,
      customerId,
      { contentType }
    );

    if (!result?.record) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate content'
      });
    }

    // Mark recommendation as content generated
    await supabaseAdmin
      .from('recommendations')
      .update({ is_content_generated: true })
      .eq('id', recommendationId)
      .eq('customer_id', customerId);

    return res.json({
      success: true,
      data: {
        content: result.record,
        providerUsed: result.providerUsed,
        modelUsed: result.modelUsed
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Content] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate content'
    });
  }
});

/**
 * PATCH /api/recommendations-v3/:recommendationId/complete
 * 
 * Mark a recommendation as completed (Step 3 → Step 4).
 * Captures current KPI value as kpi_before_value.
 */
router.patch('/:recommendationId/complete', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { recommendationId } = req.params;

    // Get recommendation with KPI info
    const { data: recommendation, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('id, kpi_id, kpi, brand_id, customer_id, is_content_generated, citation_source, focus_area, visibility_score, soa, sentiment')
      .eq('id', recommendationId)
      .eq('customer_id', customerId)
      .single();

    if (recError || !recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recommendation not found'
      });
    }

    if (!recommendation.is_content_generated) {
      return res.status(400).json({
        success: false,
        error: 'Content must be generated before marking as completed'
      });
    }

    // Get brand's overall KPI value from dashboard API (same as shown on first page)
    // This represents the brand's overall KPI, not the per-source KPI
    let kpiBeforeValue: number | null = null;

    if (recommendation.brand_id) {
      try {
        // Get KPI name - prefer from linked KPI table (more accurate), fallback to recommendation.kpi field
        let kpiNameToMatch: string | null = null;

        // First try to get KPI name from recommendation_v3_kpis table (more reliable)
        if (recommendation.kpi_id) {
          const { data: kpiData } = await supabaseAdmin
            .from('recommendation_v3_kpis')
            .select('kpi_name')
            .eq('id', recommendation.kpi_id)
            .single();

          if (kpiData?.kpi_name) {
            kpiNameToMatch = kpiData.kpi_name;
          }
        }

        // Fallback to recommendation.kpi field if KPI table lookup didn't work
        if (!kpiNameToMatch && recommendation.kpi) {
          kpiNameToMatch = recommendation.kpi;
        }

        if (!kpiNameToMatch) {
          console.warn(`⚠️ [RecommendationsV3 Complete] No KPI name found for recommendation ${recommendationId}`);
        } else {
          // Fetch brand dashboard to get current overall KPI values
          const dashboard = await brandDashboardService.getBrandDashboard(
            recommendation.brand_id,
            customerId,
            undefined, // Use default date range
            { skipCache: false }
          );

          console.log(`📊 [RecommendationsV3 Complete] Dashboard scores:`, dashboard.scores?.map((s: any) => ({ label: s.label, value: s.value })));
          console.log(`📊 [RecommendationsV3 Complete] Matching KPI name: "${kpiNameToMatch}"`);

          // Match KPI name to dashboard score (more flexible matching)
          const kpiNameLower = kpiNameToMatch.toLowerCase();
          const matchingScore = dashboard.scores?.find((score: any) => {
            const scoreLabel = (score.label || '').toLowerCase();

            // Try exact match first
            if (scoreLabel === kpiNameLower || kpiNameLower.includes(scoreLabel) || scoreLabel.includes(kpiNameLower)) {
              return true;
            }

            // Then try keyword matching
            if (kpiNameLower.includes('visibility') && scoreLabel.includes('visibility')) {
              return true;
            }
            if ((kpiNameLower.includes('soa') || kpiNameLower.includes('share of answers') || kpiNameLower.includes('share'))
              && (scoreLabel.includes('share') || scoreLabel.includes('answers'))) {
              return true;
            }
            if (kpiNameLower.includes('sentiment') && scoreLabel.includes('sentiment')) {
              return true;
            }

            return false;
          });

          if (matchingScore && typeof matchingScore.value === 'number') {
            kpiBeforeValue = matchingScore.value;
            console.log(`✅ [RecommendationsV3 Complete] Matched KPI "${kpiNameToMatch}" to dashboard score "${matchingScore.label}": ${kpiBeforeValue}`);
          } else {
            console.warn(`⚠️ [RecommendationsV3 Complete] Could not match KPI "${kpiNameToMatch}" to dashboard score. Available scores:`,
              dashboard.scores?.map((s: any) => s.label));
          }

          // Capture all 3 brand-level scores for Benchmarking in Step 4
          const scores = dashboard.scores || [];
          const vizScore = scores.find((s: any) => s.label.toLowerCase().includes('visibility'))?.value ?? 0;
          const soaScore = scores.find((s: any) => s.label.toLowerCase().includes('soa') || s.label.toLowerCase().includes('share'))?.value ?? 0;
          const sentScore = scores.find((s: any) => s.label.toLowerCase().includes('sentiment'))?.value ?? 0;

          // Store these in a way the frontend Step 4 can read them as Benchmarked values
          // We'll update the recommendation record with these values
          (recommendation as any).currentBrandMetrics = {
            visibility: vizScore,
            soa: soaScore,
            sentiment: sentScore
          };
        }
      } catch (e) {
        console.error('⚠️ [RecommendationsV3 Complete] Failed to fetch dashboard KPI:', e);
        // Fallback to KPI table current_value if dashboard fetch fails
        if (recommendation.kpi_id) {
          const { data: kpi } = await supabaseAdmin
            .from('recommendation_v3_kpis')
            .select('kpi_name, current_value')
            .eq('id', recommendation.kpi_id)
            .single();

          if (kpi) {
            kpiBeforeValue = kpi.current_value;
            console.log(`📊 [RecommendationsV3 Complete] Using fallback KPI table value: ${kpiBeforeValue}`);
          }
        }
      }
    }

    // Update recommendation
    // Ensure review_status is 'approved' so it appears in Step 4 (which filters by review_status = 'approved')
    // If a recommendation reached Step 3, it must have been approved (Step 2 requires is_approved = true)
    const { error: updateError } = await supabaseAdmin
      .from('recommendations')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        kpi_before_value: kpiBeforeValue,
        // Update benchmarked values with current brand metrics at time of completion
        visibility_score: (recommendation as any).currentBrandMetrics ? String((recommendation as any).currentBrandMetrics.visibility) : recommendation.visibility_score,
        soa: (recommendation as any).currentBrandMetrics ? String((recommendation as any).currentBrandMetrics.soa) : recommendation.soa,
        sentiment: (recommendation as any).currentBrandMetrics ? String((recommendation as any).currentBrandMetrics.sentiment) : recommendation.sentiment,
        review_status: 'approved', // Ensure it's marked as approved so it appears in Step 4
        is_approved: true // Also ensure is_approved is true for consistency
      })
      .eq('id', recommendationId)
      .eq('customer_id', customerId);

    if (updateError) {
      console.error('❌ [RecommendationsV3] Error completing recommendation:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark recommendation as completed'
      });
    }

    return res.json({
      success: true,
      data: {
        recommendationId,
        completedAt: new Date().toISOString(),
        kpiBeforeValue
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 Complete] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to complete recommendation'
    });
  }
});

/**
 * GET /api/recommendations-v3/:generationId/kpis
 * 
 * Get identified KPIs for a generation.
 */
router.get('/:generationId/kpis', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { generationId } = req.params;

    // Verify generation belongs to customer and get brand_id
    const { data: generation } = await supabaseAdmin
      .from('recommendation_generations')
      .select('id, customer_id, brand_id')
      .eq('id', generationId)
      .eq('customer_id', customerId)
      .single();

    if (!generation) {
      return res.status(404).json({
        success: false,
        error: 'Generation not found'
      });
    }

    // Get KPIs
    const { data: kpisData, error: kpisError } = await supabaseAdmin
      .from('recommendation_v3_kpis')
      .select('*')
      .eq('generation_id', generationId)
      .order('display_order', { ascending: true });

    if (kpisError) {
      console.error('❌ [RecommendationsV3] Error fetching KPIs:', kpisError);
      return res.status(500).json({
        success: false,
        error: 'Failed to load KPIs'
      });
    }

    // Fetch live dashboard metrics to get current state
    // This allows "Current Visibility/SOA/Sentiment" columns in Impact page to be truly current
    let liveMetrics: { visibility?: number; soa?: number; sentiment?: number } = {};
    if (generation.brand_id) {
      try {
        // Fetch dashboard data (using cache if available)
        const dashboard = await dashboardService.getBrandDashboard(generation.brand_id, customerId);

        // Extract metrics (prefer brandSummary, fall back to scores/top-level)
        let visibility = dashboard.brandSummary?.visibility ?? dashboard.visibilityPercentage;
        let soa = dashboard.brandSummary?.share;
        let sentiment = dashboard.sentimentScore;

        // Fallback to scores array if brandSummary missing
        if (soa === undefined && dashboard.scores) {
          const soaScore = dashboard.scores.find(s => s.label === 'Share of Answers');
          if (soaScore) soa = soaScore.value;
        }

        // Normalize info
        liveMetrics = {
          visibility,
          soa,
          sentiment
        };
      } catch (err) {
        console.warn('⚠️ [RecommendationsV3] Failed to fetch live dashboard metrics, falling back to snapshot:', err);
      }
    }

    let rawKpis = kpisData || [];

    // Fallback: If no KPIs found in DB, return standard default ones
    if (rawKpis.length === 0) {
      console.log('ℹ️ [RecommendationsV3] No KPIs found in DB for generation, returning standard defaults');
      rawKpis = [
        {
          kpi_name: 'Visibility Index',
          kpi_description: 'Overall brand visibility across AI responses.',
          current_value: liveMetrics.visibility || 0,
          target_value: Math.min(100, (liveMetrics.visibility || 20) + 10),
          display_order: 0
        },
        {
          kpi_name: 'SOA %',
          kpi_description: 'Share of Answers for your brand compared to competitors.',
          current_value: liveMetrics.soa || 0,
          target_value: Math.min(100, (liveMetrics.soa || 15) + 5),
          display_order: 1
        },
        {
          kpi_name: 'Sentiment Score',
          kpi_description: 'Brand sentiment across AI citations.',
          current_value: liveMetrics.sentiment || 0,
          target_value: Math.min(100, (liveMetrics.sentiment || 70) + 5),
          display_order: 2
        }
      ];
    }

    const kpis = rawKpis.map(kpi => {
      let currentValue = kpi.current_value;
      const name = (kpi.kpi_name || '').toLowerCase();

      // Override with live value if available
      if (name.includes('visibility') && liveMetrics.visibility !== undefined) {
        currentValue = liveMetrics.visibility;
      } else if ((name.includes('share') || name.includes('soa')) && liveMetrics.soa !== undefined) {
        currentValue = liveMetrics.soa;
      } else if (name.includes('sentiment') && liveMetrics.sentiment !== undefined) {
        // Ensure sentiment is on same scale (likely 0-100)
        currentValue = liveMetrics.sentiment;
      }

      return {
        id: kpi.id,
        kpiName: kpi.kpi_name,
        kpiDescription: kpi.kpi_description,
        currentValue: currentValue,
        targetValue: kpi.target_value,
        displayOrder: kpi.display_order
      };
    });

    return res.json({
      success: true,
      data: {
        kpis
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 KPIs GET] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch KPIs. Please try again later.'
    });
  }
});

/**
 * GET /api/recommendations-v3/brand/:brandId/latest
 * 
 * Get the latest generation for a brand (useful for recovery after timeout).
 * 
 * Response:
 *   - success: boolean
 *   - data: {
 *       generationId: string
 *       kpis: IdentifiedKPI[]
 *       recommendations: RecommendationV3[]
 *       generatedAt: string
 *       brandId: string
 *       brandName: string
 *     } | null (if no generation found)
 */
router.get('/brand/:brandId/latest', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const { brandId } = req.params;

    // Verify brand belongs to customer
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name, customer_id')
      .eq('id', brandId)
      .eq('customer_id', customerId)
      .single();

    if (!brand) {
      return res.status(404).json({
        success: false,
        error: 'Brand not found'
      });
    }

    // Get latest generation for this brand
    const { data: generation, error: genError } = await supabaseAdmin
      .from('recommendation_generations')
      .select('id, brand_id, generated_at, metadata')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (genError || !generation) {
      return res.json({
        success: true,
        data: null
      });
    }

    // Get KPIs for this generation
    const { data: kpisData } = await supabaseAdmin
      .from('recommendation_v3_kpis')
      .select('*')
      .eq('generation_id', generation.id)
      .order('display_order', { ascending: true });

    // Get recommendations for this generation
    const { data: recommendationsData } = await supabaseAdmin
      .from('recommendations')
      .select('*')
      .eq('generation_id', generation.id)
      .order('created_at', { ascending: true });

    // Transform to API format
    const kpis = (kpisData || []).map(kpi => ({
      id: kpi.id,
      kpiName: kpi.kpi_name,
      kpiDescription: kpi.kpi_description,
      currentValue: kpi.current_value,
      targetValue: kpi.target_value,
      displayOrder: kpi.display_order
    }));

    const recommendations = (recommendationsData || []).map(rec => ({
      id: rec.id,
      action: rec.action,
      citationSource: rec.citation_source,
      focusArea: rec.focus_area,
      priority: rec.priority,
      effort: rec.effort,
      kpiId: rec.kpi_id,
      kpi: rec.kpi,
      reason: rec.reason,
      explanation: rec.explanation,
      impactScore: rec.impact_score,
      mentionRate: rec.mention_rate,
      soa: rec.soa,
      sentiment: rec.sentiment,
      visibilityScore: rec.visibility_score,
      citationCount: rec.citation_count,
      focusSources: rec.focus_sources,
      contentFocus: rec.content_focus,
      expectedBoost: rec.expected_boost,
      timeline: rec.timeline,
      confidence: rec.confidence,
      isApproved: rec.is_approved,
      isContentGenerated: rec.is_content_generated,
      isCompleted: rec.is_completed,
      completedAt: rec.completed_at,
      kpiBeforeValue: rec.kpi_before_value,
      kpiAfterValue: rec.kpi_after_value,
      reviewStatus: (rec.metadata as any)?.is_removed ? 'removed' : (rec.review_status || 'pending_review'),
      metadata: rec.metadata
    }));

    return res.json({
      success: true,
      data: {
        generationId: generation.id,
        dataMaturity: (generation as any)?.metadata?.dataMaturity || null,
        kpis,
        recommendations,
        generatedAt: generation.generated_at,
        brandId: generation.brand_id,
        brandName: brand.name
      }
    });

  } catch (error) {
    console.error('❌ [RecommendationsV3 GET latest] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch latest generation. Please try again later.'
    });
  }
});

/**
 * POST /api/recommendations-v3/:id/regenerate
 * 
 * Regenerate content for a recommendation based on user feedback.
 * Limited to one regeneration per recommendation.
 * 
 * Request body:
 *   - feedback: string (required) - User's specific feedback for regeneration
 * 
 * Response:
 *   - success: boolean
 *   - data: { content: any, regenRetry: number }
 *   - error?: string
 */
router.post('/:id/regenerate', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    const recommendationId = req.params.id;
    const { feedback } = req.body;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!recommendationId) {
      return res.status(400).json({
        success: false,
        error: 'Recommendation ID is required'
      });
    }

    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Feedback is required and must be a non-empty string'
      });
    }

    if (feedback.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Feedback must be at least 10 characters long'
      });
    }

    console.log(`🔄 [RecommendationsV3 POST /:id/regenerate] Regenerating content for ${recommendationId}`);

    const result = await regenerateContentService.regenerateContent(
      recommendationId,
      customerId,
      feedback.trim()
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error('❌ [RecommendationsV3 POST /:id/regenerate] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to regenerate content. Please try again later.'
    });
  }
});

/**
 * GET /api/recommendations-v3/analyze/keyword-mapping
 * 
 * Returns flattened graph data for the "Keyword Quadrants" screen.
 * - X-Axis: Sentiment Score
 * - Y-Axis: Brand Strength
 * - Quadrants: Stronghold, Risk, etc.
 */
router.get('/analyze/keyword-mapping', authenticateToken, async (req, res) => {
  try {
    const customerId = req.user?.customer_id;
    let { brandId } = req.query;

    if (!customerId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Default to first brand if not provided
    if (!brandId) {
      const brands = await brandService.getBrandsByCustomer(customerId);
      if (brands && brands.length > 0) brandId = brands[0].id;
    }

    if (!brandId) {
      return res.status(400).json({ success: false, error: 'Brand ID required' });
    }

    console.log(`[Analyze API] Fetching keywords with real sentiment for brand ${brandId}...`);

    // 1. Fetch collector_results for this brand (last 100)
    const { data: results } = await supabaseAdmin
      .from('collector_results')
      .select('id')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!results || results.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const resultIds = results.map(r => r.id);

    // 2. Fetch keywords from consolidated_analysis_cache + sentiment from metric_facts -> brand_sentiment
    const { data: cacheData, error: cacheError } = await supabaseAdmin
      .from('consolidated_analysis_cache')
      .select('collector_result_id, keywords')
      .in('collector_result_id', resultIds);

    if (cacheError) {
      console.error('[Analyze API] Error fetching cache:', cacheError);
      return res.status(500).json({ success: false, error: 'Failed to fetch analysis cache' });
    }

    // 3. Fetch metric_facts with brand_sentiment for the same collector_result_ids
    const { data: metricData, error: metricError } = await supabaseAdmin
      .from('metric_facts')
      .select(`
        collector_result_id,
        brand_sentiment(
          sentiment_score,
          sentiment_label
        )
      `)
      .in('collector_result_id', resultIds);

    if (metricError) {
      console.error('[Analyze API] Error fetching metrics:', metricError);
      return res.status(500).json({ success: false, error: 'Failed to fetch metric facts' });
    }

    // 4. Build a map of collector_result_id -> sentiment
    const sentimentMap = new Map<number, { score: number; label: string }>();
    for (const mf of metricData || []) {
      const bs = Array.isArray(mf.brand_sentiment)
        ? mf.brand_sentiment[0]
        : mf.brand_sentiment;
      if (bs) {
        sentimentMap.set(mf.collector_result_id, {
          score: bs.sentiment_score || 50,
          label: bs.sentiment_label || 'NEUTRAL'
        });
      }
    }

    // 5. Aggregate keywords with their sentiment AND track collector_result_ids per keyword
    // Each keyword may appear in multiple responses - average the sentiment
    const keywordAggregates = new Map<string, { totalScore: number; count: number; labels: string[]; collectorResultIds: number[] }>();

    for (const row of cacheData || []) {
      const sentiment = sentimentMap.get(row.collector_result_id);
      const keywords = row.keywords || [];

      for (const kw of keywords) {
        const keywordText = typeof kw === 'string' ? kw : kw.keyword;
        if (!keywordText) continue;

        const existing = keywordAggregates.get(keywordText) || { totalScore: 0, count: 0, labels: [], collectorResultIds: [] };
        existing.totalScore += sentiment?.score || 50;
        existing.count += 1;
        if (sentiment?.label) existing.labels.push(sentiment.label);
        existing.collectorResultIds.push(row.collector_result_id);
        keywordAggregates.set(keywordText, existing);
      }
    }

    // 6. Fetch citations for these collector_result_ids
    const { data: citationsData } = await supabaseAdmin
      .from('citations')
      .select('collector_result_id, domain, category')
      .in('collector_result_id', resultIds);

    // Build a map of collector_result_id -> citations
    const citationsByResult = new Map<number, { domains: string[]; categories: string[] }>();
    for (const c of citationsData || []) {
      const existing = citationsByResult.get(c.collector_result_id) || { domains: [], categories: [] };
      if (c.domain) existing.domains.push(c.domain);
      if (c.category) existing.categories.push(c.category);
      citationsByResult.set(c.collector_result_id, existing);
    }

    // 7. Build final response with citations
    const data = Array.from(keywordAggregates.entries()).map(([keyword, agg]) => {
      const avgScore = Math.round(agg.totalScore / agg.count);
      // Determine dominant label
      const labelCounts: Record<string, number> = {};
      for (const l of agg.labels) {
        labelCounts[l] = (labelCounts[l] || 0) + 1;
      }
      const dominantLabel = Object.entries(labelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'NEUTRAL';

      // Aggregate citations for this keyword
      const citationDomains = new Set<string>();
      const citationCategories: Record<string, number> = {};
      for (const crId of agg.collectorResultIds) {
        const cites = citationsByResult.get(crId);
        if (cites) {
          for (const d of cites.domains) citationDomains.add(d);
          for (const cat of cites.categories) {
            citationCategories[cat] = (citationCategories[cat] || 0) + 1;
          }
        }
      }

      return {
        keyword,
        sentiment: avgScore,
        sentimentLabel: dominantLabel,
        mentions: agg.count,
        citationDomains: Array.from(citationDomains).slice(0, 5), // Top 5 domains
        citationCategories: Object.entries(citationCategories)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => ({ category: cat, count }))
      };
    });

    // Sort by mentions descending
    data.sort((a, b) => b.mentions - a.mentions);

    console.log(`[Analyze API] Generated ${data.length} keywords with real sentiment.`);

    return res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('❌ [Analyze Keywords] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch keyword mapping'
    });
  }
});

export default router;

