/**
 * Recommendation Actions Service
 * 
 * Manages user actions on recommendations (status tracking: Not Started, In Progress, Completed, Dismissed)
 */

import { supabaseAdmin } from '../../config/supabase';

export type RecommendationStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export interface RecommendationActionRecord {
  id: string;
  recommendation_id: string;
  brand_id: string;
  customer_id: string;
  user_id: string | null;
  action_type: 'viewed' | 'dismissed' | 'marked_complete' | 'marked_in_progress' | 'bookmarked';
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RecommendationWithStatus {
  recommendation_id: string;
  status: RecommendationStatus;
  last_action_at: string | null;
  last_action_type: string | null;
}

/**
 * Get the current status for a recommendation
 */
export async function getRecommendationStatus(
  recommendationId: string,
  customerId: string
): Promise<RecommendationStatus> {
  try {
    const { data, error } = await supabaseAdmin
      .from('recommendation_user_actions')
      .select('action_type, created_at')
      .eq('recommendation_id', recommendationId)
      .eq('customer_id', customerId)
      .in('action_type', ['marked_complete', 'marked_in_progress', 'dismissed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine (means not_started)
      console.error('Error fetching recommendation status:', error);
      return 'not_started';
    }

    if (!data) {
      return 'not_started';
    }

    // Map action types to status
    switch (data.action_type) {
      case 'marked_complete':
        return 'completed';
      case 'marked_in_progress':
        return 'in_progress';
      case 'dismissed':
        return 'dismissed';
      default:
        return 'not_started';
    }
  } catch (error) {
    console.error('Error in getRecommendationStatus:', error);
    return 'not_started';
  }
}

/**
 * Get statuses for multiple recommendations
 */
export async function getRecommendationStatuses(
  recommendationIds: string[],
  customerId: string
): Promise<Map<string, RecommendationStatus>> {
  if (recommendationIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('recommendation_user_actions')
      .select('recommendation_id, action_type, created_at')
      .in('recommendation_id', recommendationIds)
      .eq('customer_id', customerId)
      .in('action_type', ['marked_complete', 'marked_in_progress', 'dismissed']);

    if (error) {
      console.error('Error fetching recommendation statuses:', error);
      return new Map();
    }

    // Group by recommendation_id and get the latest action for each
    const statusMap = new Map<string, RecommendationStatus>();
    const latestActions = new Map<string, { action_type: string; created_at: string }>();

    for (const action of data || []) {
      const existing = latestActions.get(action.recommendation_id);
      if (!existing || new Date(action.created_at) > new Date(existing.created_at)) {
        latestActions.set(action.recommendation_id, {
          action_type: action.action_type,
          created_at: action.created_at
        });
      }
    }

    // Map to statuses
    for (const [recId, action] of latestActions.entries()) {
      switch (action.action_type) {
        case 'marked_complete':
          statusMap.set(recId, 'completed');
          break;
        case 'marked_in_progress':
          statusMap.set(recId, 'in_progress');
          break;
        case 'dismissed':
          statusMap.set(recId, 'dismissed');
          break;
        default:
          statusMap.set(recId, 'not_started');
      }
    }

    // Set not_started for recommendations without actions
    for (const recId of recommendationIds) {
      if (!statusMap.has(recId)) {
        statusMap.set(recId, 'not_started');
      }
    }

    return statusMap;
  } catch (error) {
    console.error('Error in getRecommendationStatuses:', error);
    // Return all as not_started on error
    const statusMap = new Map<string, RecommendationStatus>();
    for (const recId of recommendationIds) {
      statusMap.set(recId, 'not_started');
    }
    return statusMap;
  }
}

/**
 * Update recommendation status
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  customerId: string,
  brandId: string,
  status: RecommendationStatus,
  userId?: string,
  notes?: string
): Promise<RecommendationActionRecord | null> {
  try {
    // Map status to action_type
    let actionType: 'marked_complete' | 'marked_in_progress' | 'dismissed';
    switch (status) {
      case 'completed':
        actionType = 'marked_complete';
        break;
      case 'in_progress':
        actionType = 'marked_in_progress';
        break;
      case 'dismissed':
        actionType = 'dismissed';
        break;
      default:
        throw new Error(`Invalid status: ${status}`);
    }

    // Insert new action record
    const { data, error } = await supabaseAdmin
      .from('recommendation_user_actions')
      .insert({
        recommendation_id: recommendationId,
        brand_id: brandId,
        customer_id: customerId,
        user_id: userId || null,
        action_type: actionType,
        notes: notes || null,
        metadata: {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating recommendation status:', error);
      return null;
    }

    return data as RecommendationActionRecord;
  } catch (error) {
    console.error('Error in updateRecommendationStatus:', error);
    return null;
  }
}
