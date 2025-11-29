import { supabaseAdmin } from '../config/database';

export interface KeywordAnalyticsItem {
  keyword: string;
  mentions: number; // number of responses where the keyword appeared
  volume: number; // total extracted_positions rows where competitor_name is null (brand positions only)
  brandPositions: number; // total extracted_positions rows with has_brand_presence = true
  competitorPositions: number; // total extracted_positions rows with has_brand_presence = false
  sources: string[]; // collector types where the keyword appeared
}

export interface KeywordAnalyticsPayload {
  keywords: KeywordAnalyticsItem[];
  startDate?: string;
  endDate?: string;
}

export const keywordsAnalyticsService = {
  async getKeywordAnalytics(params: {
    brandId: string;
    customerId: string;
    startDate?: string;
    endDate?: string;
    collectorType?: string;
  }): Promise<KeywordAnalyticsPayload> {
    const { brandId, customerId, startDate, endDate, collectorType } = params;

    // Map collector type if provided (for filtering)
    let mappedCollectorType: string | undefined = undefined;
    if (collectorType && collectorType.trim() !== '') {
      const collectorTypeMap: Record<string, string> = {
        'chatgpt': 'chatgpt',
        'claude': 'claude',
        'gemini': 'gemini',
        'perplexity': 'perplexity',
        'copilot': 'copilot',
        'deepseek': 'deepseek',
        'mistral': 'mistral',
        'grok': 'grok'
      };
      mappedCollectorType = collectorTypeMap[collectorType.toLowerCase()] || collectorType.toLowerCase();
      console.log(`🔍 Filtering keywords by collector_type: ${mappedCollectorType}`);
    }

    // 1) Pull keywords for this brand/customer in range
    let keywordQuery = supabaseAdmin
      .from('generated_keywords')
      .select('keyword, query_id, collector_result_id, created_at')
      .eq('brand_id', brandId)
      .eq('customer_id', customerId);

    if (startDate) keywordQuery = keywordQuery.gte('created_at', startDate);
    if (endDate) keywordQuery = keywordQuery.lte('created_at', endDate);

    const { data: keywordRows, error: keywordError } = await keywordQuery;
    if (keywordError) {
      throw new Error(`Failed to fetch keywords: ${keywordError.message}`);
    }

    const keywordToCollectorIds = new Map<string, Set<number>>();
    const collectorIds = new Set<number>();

    for (const row of keywordRows ?? []) {
      const kw = typeof row.keyword === 'string' ? row.keyword.trim() : '';
      const collectorId = typeof row.collector_result_id === 'number' ? row.collector_result_id : null;
      if (kw.length === 0 || collectorId === null) continue;
      if (!keywordToCollectorIds.has(kw)) keywordToCollectorIds.set(kw, new Set<number>());
      keywordToCollectorIds.get(kw)!.add(collectorId);
      collectorIds.add(collectorId);
    }

    const collectorIdList = Array.from(collectorIds.values());
    const brandPresenceByCollector = new Map<number, { brand: number; total: number; type: string | null }>();

    if (collectorIdList.length > 0) {
      // 2) First, get collector_results and filter by collector_type if provided
      // This gives us the valid collector_result_ids to use for filtering positions
      let collectorQuery = supabaseAdmin
        .from('collector_results')
        .select('id, collector_type')
        .in('id', collectorIdList);
      
      if (mappedCollectorType) {
        collectorQuery = collectorQuery.eq('collector_type', mappedCollectorType);
      }

      const { data: collectorRows, error: collectorError } = await collectorQuery;

      if (collectorError) {
        throw new Error(`Failed to fetch collector types for keywords: ${collectorError.message}`);
      }
      
      // Get valid collector IDs (filtered by collector_type if provided)
      const validCollectorIds = new Set<number>();
      const collectorTypeMap = new Map<number, string>();
      for (const row of collectorRows ?? []) {
        const id = typeof row.id === 'number' ? row.id : null;
        if (id === null) continue;
        validCollectorIds.add(id);
        const type = typeof row.collector_type === 'string' ? row.collector_type : null;
        if (type) {
          collectorTypeMap.set(id, type);
        }
      }

      // Filter keywordToCollectorIds to only include valid collector IDs
      if (mappedCollectorType && validCollectorIds.size > 0) {
        keywordToCollectorIds.forEach((ids, kw) => {
          const validIds = new Set<number>();
          ids.forEach(id => {
            if (validCollectorIds.has(id)) {
              validIds.add(id);
            }
          });
          if (validIds.size === 0) {
            keywordToCollectorIds.delete(kw);
          } else {
            keywordToCollectorIds.set(kw, validIds);
          }
        });
      }

      const filteredCollectorIdList = validCollectorIds.size > 0 ? Array.from(validCollectorIds) : collectorIdList;

      // 3) Pull brand presence from extracted_positions for valid collector_result_ids
      // Filter by collector_type directly from extracted_positions if provided
      // Volume should only count positions where competitor_name is null (brand positions only)
      let positionsQuery = supabaseAdmin
        .from('extracted_positions')
        .select('collector_result_id, has_brand_presence, created_at, collector_type, competitor_name')
        .in('collector_result_id', filteredCollectorIdList)
        .is('competitor_name', null); // Only count brand positions for volume

      // Filter by collector_type from extracted_positions if provided
      if (mappedCollectorType) {
        positionsQuery = positionsQuery.eq('collector_type', mappedCollectorType);
      }

      if (startDate) positionsQuery = positionsQuery.gte('created_at', startDate);
      if (endDate) positionsQuery = positionsQuery.lte('created_at', endDate);

      const { data: positionRows, error: positionsError } = await positionsQuery;
      if (positionsError) {
        throw new Error(`Failed to fetch positions for keywords: ${positionsError.message}`);
      }

      for (const row of positionRows ?? []) {
        const id = typeof row.collector_result_id === 'number' ? row.collector_result_id : null;
        if (id === null) continue;
        if (!brandPresenceByCollector.has(id)) {
          brandPresenceByCollector.set(id, { 
            brand: 0, 
            total: 0, 
            type: collectorTypeMap.get(id) || null 
          });
        }
        const agg = brandPresenceByCollector.get(id)!;
        agg.total += 1;
        if (row.has_brand_presence === true) {
          agg.brand += 1;
        }
      }
    }

    // 4) Build per-keyword metrics
    const items: KeywordAnalyticsItem[] = [];
    keywordToCollectorIds.forEach((ids, kw) => {
      let mentionResponses = 0;
      let volume = 0;
      let brandPositions = 0;
      const sources = new Set<string>();
      ids.forEach((id) => {
        const agg = brandPresenceByCollector.get(id);
        if (agg) {
          mentionResponses += 1;
          volume += agg.total;
          brandPositions += agg.brand;
          if (agg.type) sources.add(agg.type);
        } else {
          // If we don't have positions, still count the response appearance
          mentionResponses += 1;
        }
      });
      const competitorPositions = Math.max(0, volume - brandPositions);
      items.push({
        keyword: kw,
        mentions: mentionResponses,
        volume,
        brandPositions,
        competitorPositions,
        sources: Array.from(sources.values()).sort((a, b) => a.localeCompare(b))
      });
    });

    // Sort by mentions desc
    items.sort((a, b) => b.volume - a.volume || b.mentions - a.mentions || a.keyword.localeCompare(b.keyword));

    return {
      keywords: items,
      startDate,
      endDate
    };
  }
};


