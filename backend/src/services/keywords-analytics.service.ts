import { supabaseAdmin } from '../config/database';

export interface KeywordAnalyticsItem {
  keyword: string;
  mentions: number; // number of responses where the keyword appeared
  volume: number; // total extracted_positions rows across those responses
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
  }): Promise<KeywordAnalyticsPayload> {
    const { brandId, customerId, startDate, endDate } = params;

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
      // 2) Pull brand presence from extracted_positions for those collector_result_ids
      let positionsQuery = supabaseAdmin
        .from('extracted_positions')
        .select('collector_result_id, has_brand_presence, created_at')
        .in('collector_result_id', collectorIdList);

      if (startDate) positionsQuery = positionsQuery.gte('created_at', startDate);
      if (endDate) positionsQuery = positionsQuery.lte('created_at', endDate);

      const { data: positionRows, error: positionsError } = await positionsQuery;
      if (positionsError) {
        throw new Error(`Failed to fetch positions for keywords: ${positionsError.message}`);
      }

      for (const row of positionRows ?? []) {
        const id = typeof row.collector_result_id === 'number' ? row.collector_result_id : null;
        if (id === null) continue;
        if (!brandPresenceByCollector.has(id)) brandPresenceByCollector.set(id, { brand: 0, total: 0, type: null });
        const agg = brandPresenceByCollector.get(id)!;
        agg.total += 1;
        if (row.has_brand_presence === true) {
          agg.brand += 1;
        }
      }

      // 3) Pull collector types for those collector_result_ids
      const { data: collectorRows, error: collectorError } = await supabaseAdmin
        .from('collector_results')
        .select('id, collector_type')
        .in('id', collectorIdList);

      if (collectorError) {
        throw new Error(`Failed to fetch collector types for keywords: ${collectorError.message}`);
      }
      for (const row of collectorRows ?? []) {
        const id = typeof row.id === 'number' ? row.id : null;
        if (id === null) continue;
        const agg = brandPresenceByCollector.get(id);
        if (agg) {
          agg.type = typeof row.collector_type === 'string' ? row.collector_type : null;
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


