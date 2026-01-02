/**
 * Database Service
 * 
 * Handles saving KPIs and recommendations to the database
 */

import { supabaseAdmin } from '../../../config/database';
import type { IdentifiedKPI, RecommendationV3, BrandContextV3 } from './types';

export class DatabaseService {
  /**
   * Save KPIs and recommendations to database
   */
  async saveToDatabase(
    brandId: string,
    customerId: string,
    kpis: IdentifiedKPI[],
    recommendations: RecommendationV3[],
    context: BrandContextV3
  ): Promise<string | null> {
    try {
      // Create generation record
      const { data: generation, error: genError } = await supabaseAdmin
        .from('recommendation_generations')
        .insert({
          brand_id: brandId,
          customer_id: customerId,
          problems_detected: 0, // V3 doesn't use problem detection
          recommendations_count: recommendations.length,
          diagnostics_count: 0,
          status: 'completed',
          metadata: {
            version: 'v3',
            brandName: context.brandName,
            industry: context.industry
          }
        })
        .select('id')
        .single();

      if (genError || !generation) {
        console.error('❌ [DatabaseService] Error creating generation:', genError);
        return null;
      }

      const generationId = generation.id;
      console.log(`💾 [DatabaseService] Created generation ${generationId}`);

      // Save KPIs if any
      const kpiIdMap = new Map<string, string>();
      
      if (kpis.length > 0) {
        const kpisToInsert = kpis.map(kpi => ({
          generation_id: generationId,
          brand_id: brandId,
          customer_id: customerId,
          kpi_name: kpi.kpiName,
          kpi_description: kpi.kpiDescription,
          current_value: kpi.currentValue ?? null,
          target_value: kpi.targetValue ?? null,
          display_order: kpi.displayOrder
        }));

        const { data: insertedKpis, error: kpiError } = await supabaseAdmin
          .from('recommendation_v3_kpis')
          .insert(kpisToInsert)
          .select('id, kpi_name');

        if (kpiError) {
          console.error('❌ [DatabaseService] Error inserting KPIs:', kpiError);
          return null;
        }

        // Map KPI IDs to recommendations
        if (insertedKpis) {
          kpis.forEach((kpi, idx) => {
            if (insertedKpis[idx]) {
              kpiIdMap.set(kpi.kpiName, insertedKpis[idx].id);
            }
          });
        }
      }

      // Save recommendations
      const recommendationsToInsert = recommendations.map((rec, index) => {
        const kpiId = rec.kpi ? kpiIdMap.get(rec.kpi) : null;
        
        return {
          generation_id: generationId,
          brand_id: brandId,
          customer_id: customerId,
          action: rec.action,
          reason: rec.reason || rec.action,
          explanation: rec.explanation || rec.reason || rec.action,
          citation_source: rec.citationSource,
          impact_score: rec.impactScore ? String(rec.impactScore) : null,
          mention_rate: rec.mentionRate ? String(rec.mentionRate) : null,
          soa: rec.soa ? String(rec.soa) : null,
          sentiment: rec.sentiment ? String(rec.sentiment) : null,
          visibility_score: rec.visibilityScore ? String(rec.visibilityScore) : null,
          citation_count: rec.citationCount || 0,
          focus_sources: rec.focusSources || rec.citationSource,
          content_focus: rec.contentFocus || rec.action,
          kpi: rec.kpi || 'Unknown',
          expected_boost: rec.expectedBoost || 'TBD',
          effort: rec.effort,
          timeline: rec.timeline || '2-4 weeks',
          confidence: rec.confidence || 70,
          priority: rec.priority,
          focus_area: rec.focusArea,
          calculated_score: null,
          display_order: index,
          kpi_id: kpiId,
          is_approved: false,
          is_content_generated: false,
          is_completed: false,
          review_status: 'pending_review'
        };
      });

      const { data: insertedRecommendations, error: recError } = await supabaseAdmin
        .from('recommendations')
        .insert(recommendationsToInsert)
        .select('id');

      if (recError) {
        console.error('❌ [DatabaseService] Error inserting recommendations:', recError);
        return null;
      }

      // Map database IDs back to recommendations
      if (insertedRecommendations && insertedRecommendations.length === recommendations.length) {
        for (let i = 0; i < recommendations.length; i++) {
          if (insertedRecommendations[i]?.id) {
            recommendations[i].id = insertedRecommendations[i].id;
            console.log(`✅ [DatabaseService] Mapped ID ${insertedRecommendations[i].id} to recommendation ${i + 1}`);
          }
        }
      } else {
        console.warn(`⚠️ [DatabaseService] ID count mismatch: ${insertedRecommendations?.length || 0} inserted vs ${recommendations.length} recommendations`);
      }

      console.log(`💾 [DatabaseService] Saved ${kpis.length} KPIs and ${recommendations.length} recommendations`);
      return generationId;

    } catch (error) {
      console.error('❌ [DatabaseService] Error saving to database:', error);
      return null;
    }
  }
}

export const databaseService = new DatabaseService();

