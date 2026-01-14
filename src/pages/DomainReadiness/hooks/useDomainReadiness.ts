import { useState, useEffect, useCallback, useRef } from 'react';
import { domainReadinessApi, type DomainReadinessStreamEvent } from '../../../api/domainReadinessApi';
import { AeoAuditResult, BotAccessStatus, TestResult } from '../types/types';
import { useManualBrandDashboard } from '../../../manual-dashboard/useManualBrandDashboard';

type DomainReadinessBucket = 'technicalCrawlability' | 'contentQuality' | 'semanticStructure' | 'accessibilityAndBrand' | 'aeoOptimization' | 'botAccess';

type DomainReadinessProgress = {
  active: boolean;
  total: number;
  completed: number;
  buckets: Record<DomainReadinessBucket, { total: number; completed: number }>;
};

const createEmptyAudit = (brandId: string, domain: string): AeoAuditResult => ({
  brandId,
  domain,
  timestamp: new Date().toISOString(),
  overallScore: 0,
  scoreBreakdown: {
    technicalCrawlability: 0,
    contentQuality: 0,
    semanticStructure: 0,
    accessibilityAndBrand: 0,
    aeoOptimization: 0
  },
  detailedResults: {
    technicalCrawlability: { score: 0, weight: 0.20, tests: [], recommendations: [] },
    contentQuality: { score: 0, weight: 0.30, tests: [], recommendations: [] },
    semanticStructure: { score: 0, weight: 0.25, tests: [], recommendations: [] },
    accessibilityAndBrand: { score: 0, weight: 0.15, tests: [], recommendations: [] },
    aeoOptimization: { score: 0, weight: 0.10, tests: [], recommendations: [] }
  },
  botAccessStatus: [],
  criticalIssues: [],
  improvementPriorities: [],
  metadata: {
    auditTrigger: 'manual',
    executionTimeMs: 0
  }
});

const calculateScore = (tests: TestResult[]) => {
  if (tests.length === 0) return 0;
  const sum = tests.reduce((acc, t) => acc + t.score, 0);
  return Math.round(sum / tests.length);
};

export function useDomainReadiness() {
  const {
    brands,
    isLoading: brandsLoading,
    error: brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    reload: reloadBrands
  } = useManualBrandDashboard();

  const [audit, setAudit] = useState<AeoAuditResult | null>(null);
  const [auditHistory, setAuditHistory] = useState<AeoAuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DomainReadinessProgress>({
    active: false,
    total: 16,
    completed: 0,
    buckets: {
      technicalCrawlability: { total: 5, completed: 0 },
      contentQuality: { total: 3, completed: 0 },
      semanticStructure: { total: 2, completed: 0 },
      accessibilityAndBrand: { total: 2, completed: 0 },
      aeoOptimization: { total: 3, completed: 0 },
      botAccess: { total: 1, completed: 0 }
    }
  });

  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setAudit(null);
    setError(null);
    setProgress({
      active: false,
      total: 16,
      completed: 0,
      buckets: {
        technicalCrawlability: { total: 5, completed: 0 },
        contentQuality: { total: 3, completed: 0 },
        semanticStructure: { total: 2, completed: 0 },
        accessibilityAndBrand: { total: 2, completed: 0 },
        aeoOptimization: { total: 3, completed: 0 },
        botAccess: { total: 1, completed: 0 }
      }
    });
  }, [selectedBrandId, selectedBrand?.homepage_url]);

  const fetchLatestAudit = useCallback(async () => {
    if (!selectedBrandId) {
      setAudit(null);
      setAuditHistory([]); // Clear history when no brand is selected
      return;
    }

    setLoading(true);
    setError(null);
    setAudit(null); // Clear previous audit
    setAuditHistory([]); // Clear previous history

    try {
      // Fetch latest audit
      const latestAuditResponse = await domainReadinessApi.getLatestAudit(selectedBrandId);
      if (latestAuditResponse.success && latestAuditResponse.data) {
        setAudit(latestAuditResponse.data);
      } else if (latestAuditResponse.error) {
        // If error is "Brand not found" or similar, just set null (no audit yet)
        setAudit(null);
      }

      // Fetch audit history for trend charts
      const history = await domainReadinessApi.getAuditHistory(selectedBrandId, 30);
      setAuditHistory(history);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch audit');
    } finally {
      setLoading(false);
    }
  }, [selectedBrandId]);

  const runAudit = useCallback(async () => {
    if (!selectedBrandId) {
      setError('Select a brand to run a domain audit.');
      return;
    }

    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    setLoading(true);
    setError(null);
    setProgress({
      active: true,
      total: 16,
      completed: 0,
      buckets: {
        technicalCrawlability: { total: 5, completed: 0 },
        contentQuality: { total: 3, completed: 0 },
        semanticStructure: { total: 2, completed: 0 },
        accessibilityAndBrand: { total: 2, completed: 0 },
        aeoOptimization: { total: 3, completed: 0 },
        botAccess: { total: 1, completed: 0 }
      }
    });

    try {
      const seedDomain = selectedBrand?.homepage_url || '';
      setAudit(createEmptyAudit(selectedBrandId, seedDomain));

      const handleEvent = (event: DomainReadinessStreamEvent) => {
        if (event.type === 'error') {
          setError(event.error || 'Audit failed');
          return;
        }

        if (event.type === 'progress') {
          setProgress((prev) => {
            const bucketKey = event.bucket as DomainReadinessBucket;
            const next = {
              ...prev,
              active: true,
              total: event.total,
              completed: event.completed,
              buckets: {
                ...prev.buckets,
                [bucketKey]: {
                  ...prev.buckets[bucketKey],
                  completed: Math.min(prev.buckets[bucketKey].total, prev.buckets[bucketKey].completed + 1)
                },
                aeoOptimization: prev.buckets.aeoOptimization || { total: 3, completed: 0 }
              }
            };
            return next;
          });

          if (event.bucket === 'botAccess') {
            const botAccessStatus = event.botAccessStatus as BotAccessStatus[];
            setAudit((prev) => {
              if (!prev) return prev;
              return { ...prev, botAccessStatus };
            });
            return;
          }

          const incomingTests = event.tests as TestResult[];
          const bucket = event.bucket;

          setAudit((prev) => {
            if (!prev) return prev;

            // Check if the bucket exists in detailedResults (defensive check for new categories)
            if (!prev.detailedResults[bucket]) {
              console.warn(`Bucket "${bucket}" not initialized in detailedResults, skipping test update`);
              return prev;
            }

            const existing = prev.detailedResults[bucket].tests;
            const nextTests =
              bucket === 'semanticStructure' && event.analyzer === 'analyzeHtmlStructure'
                ? incomingTests.filter((t) => t.name !== 'Content Depth')
                : incomingTests;

            const merged = [...existing, ...nextTests];

            const nextDetailedResults = {
              ...prev.detailedResults,
              [bucket]: {
                ...prev.detailedResults[bucket],
                tests: merged
              }
            } as AeoAuditResult['detailedResults'];

            const techScore = calculateScore(nextDetailedResults.technicalCrawlability.tests);
            const contentScore = calculateScore(nextDetailedResults.contentQuality.tests);
            const semanticScore = calculateScore(nextDetailedResults.semanticStructure.tests);
            const accessScore = calculateScore(nextDetailedResults.accessibilityAndBrand.tests);
            const aeoScore = calculateScore(nextDetailedResults.aeoOptimization.tests);

            // Calculate Bot Access Score
            const botScore = (prev?.botAccessStatus?.length || 0) > 0
              ? Math.round((prev!.botAccessStatus.filter(b => b.allowed).length / prev!.botAccessStatus.length) * 100)
              : 0;

            const overallScore = Math.round(
              techScore * 0.15 + contentScore * 0.25 + semanticScore * 0.20 + accessScore * 0.15 + aeoScore * 0.10 + botScore * 0.15
            );

            return {
              ...prev,
              overallScore,
              scoreBreakdown: {
                technicalCrawlability: techScore,
                contentQuality: contentScore,
                semanticStructure: semanticScore,
                accessibilityAndBrand: accessScore,
                aeoOptimization: aeoScore,
                botAccess: botScore
              },
              detailedResults: {
                technicalCrawlability: { ...nextDetailedResults.technicalCrawlability, score: techScore, weight: 0.15 },
                contentQuality: { ...nextDetailedResults.contentQuality, score: contentScore, weight: 0.25 },
                semanticStructure: { ...nextDetailedResults.semanticStructure, score: semanticScore, weight: 0.20 },
                accessibilityAndBrand: { ...nextDetailedResults.accessibilityAndBrand, score: accessScore, weight: 0.15 },
                aeoOptimization: { ...nextDetailedResults.aeoOptimization, score: aeoScore, weight: 0.10 }
              }
            };
          });
          return;
        }

        if (event.type === 'final') {
          setAudit(event.result);
          setProgress((prev) => ({ ...prev, active: false, completed: prev.total }));
        }
      };

      await domainReadinessApi.runAuditStream(selectedBrandId, handleEvent, abortController.signal);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error(err);
      setError(err.message || 'Failed to run audit');
    } finally {
      streamAbortRef.current = null;
      setLoading(false);
      setProgress((prev) => ({ ...prev, active: false }));
    }
  }, [selectedBrandId]);

  useEffect(() => {
    fetchLatestAudit();
  }, [fetchLatestAudit]);

  useEffect(() => {
    if (selectedBrandId) {
      localStorage.setItem('current_brand_id', selectedBrandId);
    } else {
      localStorage.removeItem('current_brand_id');
    }
  }, [selectedBrandId]);

  return {
    brands,
    brandsLoading,
    brandsError,
    selectedBrandId,
    selectedBrand,
    selectBrand,
    reloadBrands,
    audit,
    auditHistory,
    loading,
    error,
    progress,
    runAudit,
    brandDomain: selectedBrand?.homepage_url || ''
  };
}
