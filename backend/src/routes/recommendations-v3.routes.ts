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
import { recommendationContentService } from '../services/recommendations/recommendation-content.service';
import { supabaseAdmin } from '../config/database';
import { brandService } from '../services/brand.service';

const router = express.Router();

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
      kpiAfterValue: rec.kpi_after_value
    }));

    return res.json({
      success: true,
      data: {
        generationId: generation.id,
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
 * Step 1: All recommendations (is_approved = false)
 * Step 2: Approved recommendations (is_approved = true, is_content_generated = false)
 * Step 3: Content generated (is_content_generated = true, is_completed = false)
 * Step 4: Completed (is_completed = true)
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
      .select('id, customer_id')
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
      // Step 1: All recommendations (not approved)
      query = query.eq('is_approved', false);
    } else if (stepNum === 2) {
      // Step 2: Approved but content not generated
      query = query.eq('is_approved', true).eq('is_content_generated', false);
    } else if (stepNum === 3) {
      // Step 3: Content generated but not completed
      query = query.eq('is_content_generated', true).eq('is_completed', false);
    } else if (stepNum === 4) {
      // Step 4: Completed
      query = query.eq('is_completed', true);
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

    // For Step 4, fetch current KPI values if kpi_before_value is null
    let kpiCurrentValuesMap: Map<string, number | null> = new Map();
    if (stepNum === 4) {
      const recommendationsWithNullKpiBefore = (recommendationsData || []).filter(
        rec => rec.kpi_before_value === null && rec.kpi_id
      );
      
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
      // For Step 4, use current KPI value if kpi_before_value is null
      let kpiBeforeValue = rec.kpi_before_value;
      if (stepNum === 4 && kpiBeforeValue === null && rec.kpi_id) {
        const currentValue = kpiCurrentValuesMap.get(rec.kpi_id);
        if (currentValue !== undefined) {
          kpiBeforeValue = currentValue;
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
        kpiBeforeValue: kpiBeforeValue,
        kpiAfterValue: rec.kpi_after_value
      };
    });

    return res.json({
      success: true,
      data: {
        step: stepNum,
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
      .update({ is_approved: true })
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
      .select('id, kpi_id, kpi, brand_id, customer_id, is_content_generated')
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

    // Get current KPI value
    let kpiBeforeValue: number | null = null;
    
    if (recommendation.kpi_id) {
      // Get KPI info
      const { data: kpi } = await supabaseAdmin
        .from('recommendation_v3_kpis')
        .select('kpi_name, current_value')
        .eq('id', recommendation.kpi_id)
        .single();

      if (kpi) {
        kpiBeforeValue = kpi.current_value;
      }
    }

    // Update recommendation
    const { error: updateError } = await supabaseAdmin
      .from('recommendations')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        kpi_before_value: kpiBeforeValue
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

    // Verify generation belongs to customer
    const { data: generation } = await supabaseAdmin
      .from('recommendation_generations')
      .select('id, customer_id')
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

    const kpis = (kpisData || []).map(kpi => ({
      id: kpi.id,
      kpiName: kpi.kpi_name,
      kpiDescription: kpi.kpi_description,
      currentValue: kpi.current_value,
      targetValue: kpi.target_value,
      displayOrder: kpi.display_order
    }));

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
      .select('id, brand_id, generated_at')
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
      kpiAfterValue: rec.kpi_after_value
    }));

    return res.json({
      success: true,
      data: {
        generationId: generation.id,
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

export default router;

