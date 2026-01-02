import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { MoverItem } from './types';

export class MoversShakersStorageService {
  constructor(private db: SupabaseClient) {}

  /**
   * Stores analyzed Movers & Shakers items in the database.
   * Prevents duplicates based on brand_id and url.
   */
  async storeItems(brandId: string, items: MoverItem[]): Promise<void> {
    if (!items || items.length === 0) return;

    // Filter out invalid items
    const validItems = items.filter(item => item.title && item.url && item.domain);

    if (validItems.length === 0) return;

    // Map to DB schema
    const rows = validItems.map(item => ({
      brand_id: brandId,
      title: item.title,
      url: item.url,
      domain: item.domain,
      source_type: item.type,
      sentiment_score: item.sentiment_score,
      action_required: item.action_required,
      snippet: item.snippet,
      author: item.owner,
      published_at: item.date_published === 'recent' ? new Date() : new Date(item.date_published || Date.now())
    }));

    try {
      const { error } = await this.db
        .from('movers_shakers_items')
        .upsert(rows, { 
          onConflict: 'brand_id,url',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('[MoversShakersStorage] Error storing items:', error);
        throw error;
      }

      console.log(`[MoversShakersStorage] Successfully stored/updated ${rows.length} items for brand ${brandId}`);
    } catch (err) {
      console.error('[MoversShakersStorage] Unexpected error:', err);
    }
  }

  /**
   * Retrieves items for a specific brand
   */
  async getItems(brandId: string, limit: number = 50): Promise<MoverItem[]> {
    const { data, error } = await this.db
      .from('movers_shakers_items')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[MoversShakersStorage] Error fetching items:', error);
      return [];
    }

    return data.map(row => ({
      title: row.title,
      type: row.source_type,
      sentiment_score: row.sentiment_score,
      action_required: row.action_required,
      owner: row.author,
      date_published: row.published_at,
      snippet: row.snippet,
      domain: row.domain,
      url: row.url
    }));
  }
}

export const moversShakersStorage = new MoversShakersStorageService(supabase);
