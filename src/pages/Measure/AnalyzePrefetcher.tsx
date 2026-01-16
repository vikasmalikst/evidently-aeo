import { useEffect, useRef } from 'react';
import { usePrefetch } from '../../hooks/useCachedData';

interface AnalyzePrefetcherProps {
  brandId: string;
}

/**
 * Background component that prefetches heavy data for Analyze section pages
 * while the user is viewing the Measure dashboard.
 * 
 * Uses requestIdleCallback to avoid impacting the main interaction thread.
 */
export const AnalyzePrefetcher = ({ brandId }: AnalyzePrefetcherProps) => {
  const { prefetch } = usePrefetch();
  const hasPrefetchedRef = useRef(false);

  useEffect(() => {
    if (!brandId || hasPrefetchedRef.current) return;

    // Use requestIdleCallback if available, otherwise fallback to timeout
    const schedulePrefetch = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 2000));

    const taskId = schedulePrefetch(() => {
      hasPrefetchedRef.current = true;
      console.log('[AnalyzePrefetcher] 🚀 Starting background prefetch for Analyze pages...');

      // --- 1. Topics (Target: /analyze/topics) ---
      // Logic: Last 7 Days (Local dates)
      const topicsEnd = new Date();
      topicsEnd.setHours(23, 59, 59, 999);
      const topicsStart = new Date(topicsEnd);
      topicsStart.setDate(topicsStart.getDate() - 6);
      topicsStart.setHours(0, 0, 0, 0);

      const topicParams = new URLSearchParams({
        startDate: topicsStart.toISOString(),
        endDate: topicsEnd.toISOString(),
      });
      const topicsEndpoint = `/brands/${brandId}/topics?${topicParams.toString()}`;
      
      // --- 2. Queries Analysis (Target: /analyze/queries) ---
      // Logic: Last 30 Days (Local YYYY-MM-DD -> ISO)
      const promptsEnd = new Date();
      const promptsStart = new Date(promptsEnd);
      promptsStart.setDate(promptsStart.getDate() - 29);
      
      const formatDate = (date: Date) => {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
      };
      
      // QueriesAnalysisPage uses ISO strings constructed from local dates treated as UTC midnight? 
      // Actually it does: new Date(startDate + 'T00:00:00Z').toISOString()
      const promptQueryStart = new Date(formatDate(promptsStart) + 'T00:00:00Z').toISOString();
      const promptQueryEnd = new Date(formatDate(promptsEnd) + 'T23:59:59.999Z').toISOString();

      const promptsQueryEndpoint = `/brands/${brandId}/prompts?${new URLSearchParams({
          startDate: promptQueryStart,
          endDate: promptQueryEnd
      }).toString()}`;

      // --- 3. Prompts / Queries & Answers (Target: /analyze/queries-answers) ---
      // Logic: Last 7 Days (Local YYYY-MM-DD -> ISO)
      // Matches src/pages/Prompts.tsx
      const prompts7End = new Date();
      const prompts7Start = new Date(prompts7End);
      prompts7Start.setDate(prompts7Start.getDate() - 6);

      const prompt7StartISO = new Date(formatDate(prompts7Start) + 'T00:00:00Z').toISOString();
      const prompt7EndISO = new Date(formatDate(prompts7End) + 'T23:59:59.999Z').toISOString();

      const prompts7Endpoint = `/brands/${brandId}/prompts?${new URLSearchParams({
          startDate: prompt7StartISO,
          endDate: prompt7EndISO
      }).toString()}`;

      // --- 4. Citation Sources (Target: /analyze/citation-sources) ---
      // Logic: Last 7 Days (UTC date part)
      // Matches src/pages/SearchSourcesR2.tsx
      const sourcesEnd = new Date();
      sourcesEnd.setUTCHours(23, 59, 59, 999);
      const sourcesStart = new Date(sourcesEnd);
      sourcesStart.setUTCDate(sourcesStart.getUTCDate() - 6);
      sourcesStart.setUTCHours(0, 0, 0, 0);

      const sourcesStartDateStr = sourcesStart.toISOString().split('T')[0];
      // Note: SearchSourcesR2 uses urlEndDate || new Date().toISOString().split('T')[0] for end date
      const sourcesEndDateStr = new Date().toISOString().split('T')[0];

      const sourcesEndpoint = `/brands/${brandId}/sources?${new URLSearchParams({
          startDate: sourcesStartDateStr,
          endDate: sourcesEndDateStr
      }).toString()}`;

      // Execute prefetches
      // Chaining promises to avoid network congestion
      prefetch(topicsEndpoint)
        .then(() => {
            console.log('[AnalyzePrefetcher] ✅ Topics prefetched');
            return prefetch(promptsQueryEndpoint);
        })
        .then(() => {
            console.log('[AnalyzePrefetcher] ✅ Queries Analysis (30d) prefetched');
            return prefetch(prompts7Endpoint);
        })
        .then(() => {
            console.log('[AnalyzePrefetcher] ✅ Queries & Answers (7d) prefetched');
            return prefetch(sourcesEndpoint);
        })
        .then(() => {
            console.log('[AnalyzePrefetcher] ✅ Citation Sources (7d) prefetched');
        })
        .catch(err => {
            console.warn('[AnalyzePrefetcher] Prefetch failed', err);
        });

    }, { timeout: 5000 });

    return () => {
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(taskId);
      } else {
        clearTimeout(taskId);
      }
    };
  }, [brandId, prefetch]);

  return null;
};
