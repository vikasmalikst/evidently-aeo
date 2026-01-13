import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ArrowRight, Sparkles, Shield, Globe, Zap, SkipForward } from 'lucide-react';
import { domainReadinessApi, type DomainReadinessStreamEvent } from '../../api/domainReadinessApi';
import { apiClient } from '../../lib/apiClient';
import { AeoAuditResult, BotAccessStatus, TestResult } from '../../pages/DomainReadiness/types/types';
import { ScoreGauge } from '../../pages/DomainReadiness/components/ScoreGauge';
import { CategoryBreakdown } from '../../pages/DomainReadiness/components/CategoryBreakdown';
import { ActionItemsTable } from '../../pages/DomainReadiness/components/ActionItemsTable';
import evidentlyLogo from '../../assets/logo.png';

// Route wrapper component
export const OnboardingDomainReadinessScreenRoute = () => {
  const { brandId } = useParams<{ brandId: string }>();
  if (!brandId) return <div className="flex items-center justify-center h-screen">Invalid brand ID</div>;
  return <OnboardingDomainReadinessScreen brandId={brandId} />;
};

interface OnboardingDomainReadinessScreenProps {
  brandId: string;
}

interface BrandData {
  id: string;
  name: string;
  homepage_url?: string;
  metadata?: any;
}

type DomainReadinessBucket = 'technicalCrawlability' | 'contentQuality' | 'semanticStructure' | 'accessibilityAndBrand' | 'aeoOptimization' | 'botAccess';

type DomainReadinessProgress = {
  active: boolean;
  total: number;
  completed: number;
  buckets: Record<DomainReadinessBucket, { total: number; completed: number }>;
};

const AEO_TIPS = [
  'AI engines prefer structured content with clear headings',
  'Schema markup helps AI understand your content context',
  'Fresh, authoritative content signals expertise to AI',
  'FAQ sections are highly favored by conversational AI',
  'Entity linking strengthens your brand\'s knowledge graph',
  'Structured data increases your citation chances by 3x'
];

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
    auditTrigger: 'onboarding',
    executionTimeMs: 0
  }
});

const calculateScore = (tests: TestResult[]) => {
  if (tests.length === 0) return 0;
  const sum = tests.reduce((acc, t) => acc + t.score, 0);
  return Math.round(sum / tests.length);
};

export const OnboardingDomainReadinessScreen = ({ brandId }: OnboardingDomainReadinessScreenProps) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'loading' | 'results'>('loading');
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [audit, setAudit] = useState<AeoAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('overall');
  const [auditStarted, setAuditStarted] = useState(false);
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

  // Fetch brand data from API
  useEffect(() => {
    const fetchBrand = async () => {
      setBrandLoading(true);
      try {
        const response = await apiClient.get<{ success: boolean; data: BrandData }>(`/brands/${brandId}`);
        if (response.success && response.data) {
          setBrand(response.data);
        } else {
          // Try to get from localStorage as fallback
          const localData = localStorage.getItem('onboarding_brand');
          if (localData) {
            try {
              setBrand(JSON.parse(localData));
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch brand:', err);
        // Try localStorage fallback
        const localData = localStorage.getItem('onboarding_brand');
        if (localData) {
          try {
            setBrand(JSON.parse(localData));
          } catch {
            // ignore parse errors
          }
        }
      } finally {
        setBrandLoading(false);
      }
    };
    fetchBrand();
  }, [brandId]);

  // Rotate tips every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % AEO_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Run domain readiness audit
  const runAudit = useCallback(async () => {
    if (!brand) {
      setError('Brand data not available. Please try again or skip.');
      return;
    }

    streamAbortRef.current?.abort();
    const abortController = new AbortController();
    streamAbortRef.current = abortController;

    setError(null);
    setAuditStarted(true);
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
      const seedDomain = brand.homepage_url || '';
      setAudit(createEmptyAudit(brandId, seedDomain));

      const handleEvent = (event: DomainReadinessStreamEvent) => {
        if (event.type === 'error') {
          setError(event.error || 'Audit failed');
          return;
        }

        if (event.type === 'progress') {
          setProgress((prev) => {
            const bucketKey = event.bucket as DomainReadinessBucket;
            return {
              ...prev,
              active: true,
              total: event.total,
              completed: event.completed,
              buckets: {
                ...prev.buckets,
                [bucketKey]: {
                  ...prev.buckets[bucketKey],
                  completed: Math.min(prev.buckets[bucketKey].total, prev.buckets[bucketKey].completed + 1)
                }
              }
            };
          });

          if (event.bucket === 'botAccess') {
            const botAccessStatus = event.botAccessStatus as BotAccessStatus[];
            setAudit((prev) => prev ? { ...prev, botAccessStatus } : prev);
            return;
          }

          const incomingTests = event.tests as TestResult[];
          const bucket = event.bucket;

          setAudit((prev) => {
            if (!prev || !prev.detailedResults[bucket]) return prev;

            const existing = prev.detailedResults[bucket].tests;
            const nextTests = bucket === 'semanticStructure' && (event as any).analyzer === 'analyzeHtmlStructure'
              ? incomingTests.filter((t) => t.name !== 'Content Depth')
              : incomingTests;

            const merged = [...existing, ...nextTests];

            const nextDetailedResults = {
              ...prev.detailedResults,
              [bucket]: { ...prev.detailedResults[bucket], tests: merged }
            } as AeoAuditResult['detailedResults'];

            const techScore = calculateScore(nextDetailedResults.technicalCrawlability.tests);
            const contentScore = calculateScore(nextDetailedResults.contentQuality.tests);
            const semanticScore = calculateScore(nextDetailedResults.semanticStructure.tests);
            const accessScore = calculateScore(nextDetailedResults.accessibilityAndBrand.tests);
            const aeoScore = calculateScore(nextDetailedResults.aeoOptimization.tests);

            const overallScore = Math.round(
              techScore * 0.20 + contentScore * 0.30 + semanticScore * 0.25 + accessScore * 0.15 + aeoScore * 0.10
            );

            return {
              ...prev,
              overallScore,
              scoreBreakdown: {
                technicalCrawlability: techScore,
                contentQuality: contentScore,
                semanticStructure: semanticScore,
                accessibilityAndBrand: accessScore,
                aeoOptimization: aeoScore
              },
              detailedResults: {
                technicalCrawlability: { ...nextDetailedResults.technicalCrawlability, score: techScore },
                contentQuality: { ...nextDetailedResults.contentQuality, score: contentScore },
                semanticStructure: { ...nextDetailedResults.semanticStructure, score: semanticScore },
                accessibilityAndBrand: { ...nextDetailedResults.accessibilityAndBrand, score: accessScore },
                aeoOptimization: { ...nextDetailedResults.aeoOptimization, score: aeoScore }
              }
            };
          });
        }

        if (event.type === 'final') {
          setAudit(event.result);
          setProgress((prev) => ({ ...prev, active: false, completed: prev.total }));
          setPhase('results');
        }
      };

      await domainReadinessApi.runAuditStream(brandId, handleEvent, abortController.signal);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Domain readiness audit failed:', err);
      setError(err.message || 'Failed to run domain readiness audit. You can skip and continue to data collection.');
      // Reset audit to null so we don't show 0 scores
      setAudit(null);
    } finally {
      streamAbortRef.current = null;
    }
  }, [brandId, brand]);

  // Start audit when brand data is loaded
  useEffect(() => {
    if (brand && !brandLoading && !auditStarted) {
      runAudit();
    }
    return () => {
      streamAbortRef.current?.abort();
    };
  }, [brand, brandLoading, auditStarted, runAudit]);

  // Manual timeout check for "stuck" state
  useEffect(() => {
    let stuckTimer: NodeJS.Timeout;
    if (phase === 'loading' && progress.completed === 0 && !error) {
      stuckTimer = setTimeout(() => {
        setError('The audit is taking longer than expected. You can wait or skip to data collection.');
      }, 15000); // 15 seconds
    }
    return () => clearTimeout(stuckTimer);
  }, [phase, progress.completed, error]);

  const handleProceed = useCallback(() => {
    console.log('Proceeding to data collection with brandId:', brandId);
    if (!brandId) {
      console.error('Missing brand ID for navigation');
      return;
    }
    // Navigate to the data collection loading screen
    navigate(`/onboarding/loading/${brandId}`, { replace: true });
  }, [navigate, brandId]);

  const handleSkip = useCallback(() => {
    console.log('Skipping audit for brandId:', brandId);
    // Skip domain readiness and go directly to data collection
    navigate(`/onboarding/loading/${brandId}`, { replace: true });
  }, [navigate, brandId]);

  const percentComplete = useMemo(() => {
    if (progress.total === 0) return 0;
    return Math.round((progress.completed / progress.total) * 100);
  }, [progress]);

  const brandName = brand?.name || brand?.metadata?.companyName || 'your brand';

  // Loading Phase UI
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-12 w-auto" />
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-12">
            {/* Header */}
            <div className="text-center mb-8">
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 text-cyan-700 text-sm font-medium mb-4"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-4 h-4" />
                Analyzing Your Domain
              </motion.div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Generating Domain Readiness Audit
              </h1>
              <p className="text-gray-500">
                We're analyzing {brandName}'s website for AI optimization
              </p>
            </div>

            {/* Show loading indicator while fetching brand */}
            {brandLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500">Loading brand data...</p>
              </div>
            ) : (
              <>
                {/* Animated Scanner */}
                <div className="relative w-48 h-48 mx-auto mb-8">
                  {/* Background circles */}
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full border-2 border-cyan-200"
                      style={{
                        width: `${100 - i * 25}%`,
                        height: `${100 - i * 25}%`,
                        top: `${i * 12.5}%`,
                        left: `${i * 12.5}%`
                      }}
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.3, 0.6, 0.3],
                        borderColor: ['#06b6d4', '#0ea5e9', '#06b6d4']
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.4
                      }}
                    />
                  ))}

                  {/* Scanning beam */}
                  <motion.div
                    className="absolute top-1/2 left-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent origin-left rounded-full"
                    style={{ transformOrigin: '0% 50%' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />

                  {/* Center icon */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <motion.div
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg"
                      animate={{ boxShadow: ['0 0 20px rgba(6,182,212,0.3)', '0 0 40px rgba(6,182,212,0.5)', '0 0 20px rgba(6,182,212,0.3)'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Shield className="w-8 h-8 text-white" />
                    </motion.div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Audit Progress</span>
                    <span className="font-semibold text-cyan-600">{percentComplete}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${percentComplete}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    {progress.completed} of {progress.total} checks completed
                  </p>
                </div>

                {/* Category Progress */}
                <div className="grid grid-cols-3 gap-3 mb-8">
                  {[
                    { key: 'technicalCrawlability', label: 'Technical', icon: Globe },
                    { key: 'contentQuality', label: 'Content', icon: Zap },
                    { key: 'semanticStructure', label: 'Structure', icon: Shield }
                  ].map((cat) => {
                    const bucket = progress.buckets[cat.key as DomainReadinessBucket];
                    const isComplete = bucket.completed >= bucket.total;
                    const Icon = cat.icon;
                    return (
                      <div
                        key={cat.key}
                        className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                          isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                          isComplete ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </div>
                        <span className={`text-xs font-medium ${isComplete ? 'text-green-700' : 'text-gray-600'}`}>
                          {cat.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tips Carousel */}
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xs font-semibold text-cyan-600 mb-1">💡 AEO TIP</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={tipIndex}
                      className="text-sm text-gray-700"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      {AEO_TIPS[tipIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>

                {/* Error State */}
                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
                    <p className="text-red-600 text-sm mb-3">{error}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => {
                          setError(null);
                          setAuditStarted(false);
                          runAudit(); // Explicitly retry
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                      >
                        Retry Audit
                      </button>
                      <button
                        onClick={handleSkip}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip & Continue
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Results Phase UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex justify-center mb-4">
            <img src={evidentlyLogo} alt="EvidentlyAEO" className="h-10 w-auto" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Domain Audit Complete
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Your Domain Readiness Report
          </h1>
          <p className="text-gray-500">
            Here's how {brandName} is optimized for AI visibility
          </p>
        </motion.div>

        {audit && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Score Overview Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Score Gauge */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center">
                  <ScoreGauge score={audit.overallScore} size={180} />
                  <p className="text-sm text-gray-500 mt-2 text-center">Overall Domain Score</p>
                </div>

                {/* Category Breakdown */}
                <div className="lg:col-span-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Breakdown</h3>
                  <CategoryBreakdown
                    audit={audit}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                  />
                </div>
              </div>
            </div>

            {/* Action Items */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Improvements</h3>
              <ActionItemsTable
                audit={audit}
                selectedCategory={selectedCategory}
              />
            </div>

            {/* Proceed Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center py-6"
            >
              <button
                onClick={handleProceed}
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
              >
                <span>Continue to Data Collection</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>

            {/* Info Note */}
            <p className="text-center text-sm text-gray-400">
              Your data collection is already running in the background. You can view progress on the next screen.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
