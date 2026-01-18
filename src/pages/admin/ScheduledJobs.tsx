import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { generateRecommendationsV3 } from '../../api/recommendationsV3Api';
import { useAuthStore } from '../../store/authStore';
import { AdminCustomerBrandSelector } from '../../components/admin/AdminCustomerBrandSelector';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface QueriesDiagnosticPayload {
  queries?: {
    total?: number;
    active?: number;
  };
  collectorResults?: {
    count?: number;
    recent?: Array<{
      id: string;
      created_at: string;
      status: string;
    }>;
    statusCounts?: Record<string, number>;
    pendingOver2hCount?: number;
    pendingOver8hCount?: number;
  };
  diagnostic?: {
    hasActiveQueries?: boolean;
    canCollectData?: boolean;
  };
}

interface ScoringDiagnosticPayload {
  pendingScoringCount: number;
  lastScoredAt: string | null;
}

interface ScheduledJob {
  id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring';
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface JobRun {
  id: string;
  scheduled_job_id: string;
  brand_id: string;
  customer_id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  metrics: Record<string, unknown>;
}

export const ScheduledJobs = () => {
  const navigate = useNavigate();
  const { selectedBrandId, brands, selectBrand } = useManualBrandDashboard();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showRunsModal, setShowRunsModal] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{ processed: number; errors: any[] } | null>(null);
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillLogs, setBackfillLogs] = useState<Array<{ ts: string; level: string; message: string }>>([]);
  const [enrichmentRunning, setEnrichmentRunning] = useState(false);
  const [enrichmentLogs, setEnrichmentLogs] = useState<Array<{ ts: string; message: string }>>([]);
  const [enrichAllBrands, setEnrichAllBrands] = useState(false);
  const [generatingRecommendations, setGeneratingRecommendations] = useState(false);
  const [generateRecsForAllBrands, setGenerateRecsForAllBrands] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionPreview, setCollectionPreview] = useState<{
    brandName: string;
    prompts: number;
    collectors: number;
    totalPrompts: number;
    costCents: number;
    costDollars: number;
    lastCollectedAt: string | null;
    brandId: string;
  } | null>(null);

  const [showScoringModal, setShowScoringModal] = useState(false);
  const [scoringPreview, setScoringPreview] = useState<{
    brandName: string;
    pendingCount: number;
    llmProvider: 'OpenRouter' | 'Local LLM';
    costDollars: number;
    lastScoredAt: string | null;
    brandId: string;
  } | null>(null);

  const handleGenerateRecommendations = async () => {
    if (!selectedBrandId && !generateRecsForAllBrands) return;

    if (!confirm(`Generate recommendations for ${generateRecsForAllBrands ? 'ALL active brands' : 'the selected brand'}? This may take a while.`)) {
      return;
    }

    setGeneratingRecommendations(true);
    try {
      if (generateRecsForAllBrands) {
        let successCount = 0;
        let failCount = 0;

        // Filter out empty IDs just in case
        const targetBrands = brands.filter(b => b.id);

        for (const brand of targetBrands) {
          console.log(`Generating for ${brand.name}...`);
          try {
            const result = await generateRecommendationsV3({ brandId: brand.id });
            if (result.success) successCount++;
            else {
              console.error(`Failed for ${brand.name}:`, result.error);
              failCount++;
            }
          } catch (e) {
            console.error(`Exception for ${brand.name}:`, e);
            failCount++;
          }
        }
        alert(`Generation complete. Success: ${successCount}, Failed: ${failCount}`);
      } else {
        const result = await generateRecommendationsV3({ brandId: selectedBrandId! });
        if (result.success) {
          alert('Recommendations generated successfully!');
        } else {
          alert(`Failed to generate recommendations: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      alert('An error occurred while generating recommendations.');
    } finally {
      setGeneratingRecommendations(false);
    }
  };

  const handleRefreshBrandProducts = async () => {
    if (!selectedBrandId && !enrichAllBrands) return;
    if (enrichAllBrands && !customerId) return;

    setEnrichmentRunning(true);
    setEnrichmentLogs([]);

    try {
      const endpoint = enrichAllBrands
        ? `${apiClient.baseUrl}/admin/brands/bulk/refresh-products?customer_id=${customerId}`
        : `${apiClient.baseUrl}/admin/brands/${selectedBrandId}/refresh-products`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiClient.getAccessToken()}`,
        }
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read response stream');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonStr = trimmedLine.substring(6);
              const data = JSON.parse(jsonStr);
              if (data.message) {
                setEnrichmentLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), message: data.message }]);
              }
              if (data.status === 'completed' || data.status === 'failed') {
                setEnrichmentRunning(false);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Enrichment error:', error);
      setEnrichmentLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), message: `Error: ${error instanceof Error ? error.message : 'Failed to connect'}` }]);
      setEnrichmentRunning(false);
    }
  };
  const [backfillResult, setBackfillResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const backfillEventSourceRef = useRef<EventSource | null>(null);
  const [diagnostic, setDiagnostic] = useState<QueriesDiagnosticPayload | null>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Ollama settings state
  const [ollamaSettings, setOllamaSettings] = useState({
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:latest',
    useOllama: false,
  });
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaSaving, setOllamaSaving] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaSuccess, setOllamaSuccess] = useState<string | null>(null);

  // Ollama health check state
  const [ollamaHealth, setOllamaHealth] = useState<{
    healthy: boolean;
    error?: string;
    responseTime?: number;
  } | null>(null);
  const [ollamaHealthChecking, setOllamaHealthChecking] = useState(false);

  // Test prompt state
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Backfill Scoring state
  const [showBackfillModal, setShowBackfillModal] = useState(false);
  const [backfillStartDate, setBackfillStartDate] = useState('');
  const [backfillEndDate, setBackfillEndDate] = useState('');
  const [scoringBackfillRunning, setScoringBackfillRunning] = useState(false);
  const [scoringBackfillLogs, setScoringBackfillLogs] = useState<Array<{ ts: string; message: string }>>([]);
  const [backfillForce, setBackfillForce] = useState(false);
  const [backfillPreserveDates, setBackfillPreserveDates] = useState(true);

  // Admin customer/brand selection (for admin users only)
  const [adminSelectedCustomerId, setAdminSelectedCustomerId] = useState<string | null>(null);
  const [adminSelectedBrandId, setAdminSelectedBrandId] = useState<string | null>(null);

  // Get customer_id from auth store or fetch from brand
  const authUser = useAuthStore((state) => state.user);

  // Use admin selections if available, otherwise fall back to normal flow
  const effectiveCustomerId = adminSelectedCustomerId || customerId;
  const effectiveBrandId = adminSelectedBrandId || selectedBrandId;

  // Fetch customer_id from the selected brand
  useEffect(() => {
    const fetchCustomerId = async () => {
      if (!selectedBrandId) {
        setCustomerId(null);
        return;
      }

      try {
        // First try to get from auth store
        if (authUser?.customerId) {
          setCustomerId(authUser.customerId);
          console.log(`[ScheduledJobs] Using customer_id from auth: ${authUser.customerId}`);
          return;
        }

        // Try to fetch brand details to get customer_id
        const response = await apiClient.get<ApiResponse<{ customer_id?: string }>>(
          `/brands/${selectedBrandId}`
        );
        if (response.success && response.data) {
          const brandCustomerId = response.data.customer_id;
          if (brandCustomerId) {
            setCustomerId(brandCustomerId);
            console.log(`[ScheduledJobs] Found customer_id from brand API: ${brandCustomerId}`);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch brand customer_id:', error);
      }

      // Last resort: Use known customer_id for specific brand
      // Based on user's info: brand '838ba1a6-3dec-433d-bea9-a9bc278969ea' has customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
      if (selectedBrandId === '838ba1a6-3dec-433d-bea9-a9bc278969ea') {
        setCustomerId('157c845c-9e87-4146-8479-cb8d045212bf');
        console.log(`[ScheduledJobs] Using known customer_id for brand: 157c845c-9e87-4146-8479-cb8d045212bf`);
      }
    };

    fetchCustomerId();
  }, [selectedBrandId, authUser?.customerId]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return 'Unknown error';
  };

  useEffect(() => {
    if (effectiveCustomerId) {
      loadJobs();
      if (effectiveBrandId) {
        loadDiagnostic();
      }
    }
  }, [effectiveCustomerId, effectiveBrandId]);

  useEffect(() => {
    return () => {
      backfillEventSourceRef.current?.close();
    };
  }, []);

  // Load Ollama settings when brand is selected
  useEffect(() => {
    if (effectiveBrandId) {
      loadOllamaSettings();
    }
  }, [effectiveBrandId]);

  // Check health when Ollama is enabled
  useEffect(() => {
    if (ollamaSettings.useOllama && ollamaSettings.ollamaUrl) {
      checkOllamaHealth();
    } else {
      setOllamaHealth(null);
    }
  }, [ollamaSettings.useOllama, ollamaSettings.ollamaUrl]);

  const loadOllamaSettings = async () => {
    if (!selectedBrandId) {
      return;
    }
    try {
      setOllamaLoading(true);
      setOllamaError(null);
      const response = await apiClient.get<
        ApiResponse<{ ollamaUrl: string; ollamaModel: string; useOllama: boolean }>
      >(`/admin/brands/${selectedBrandId}/local-llm`);
      if (response.success && response.data) {
        setOllamaSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load Ollama settings:', error);
      setOllamaError('Failed to load Ollama settings');
    } finally {
      setOllamaLoading(false);
    }
  };

  const checkOllamaHealth = async () => {
    if (!selectedBrandId) {
      return;
    }
    try {
      setOllamaHealthChecking(true);
      setOllamaError(null);
      const response = await apiClient.get<
        ApiResponse<{ healthy: boolean; error?: string; responseTime?: number }>
      >(`/admin/brands/${selectedBrandId}/local-llm/health`);
      if (response.success && response.data) {
        setOllamaHealth(response.data);
        if (!response.data.healthy) {
          setOllamaError(response.data.error || 'Ollama is not available');
        }
      }
    } catch (error) {
      console.error('Failed to check Ollama health:', error);
      setOllamaHealth({
        healthy: false,
        error: 'Failed to check Ollama health',
      });
    } finally {
      setOllamaHealthChecking(false);
    }
  };

  const saveOllamaSettings = async () => {
    if (!selectedBrandId) {
      setOllamaError('Please select a brand first');
      return;
    }
    try {
      setOllamaSaving(true);
      setOllamaError(null);
      setOllamaSuccess(null);

      // Validate URL format
      try {
        new URL(ollamaSettings.ollamaUrl);
      } catch {
        setOllamaError('Invalid URL format');
        setOllamaSaving(false);
        return;
      }

      const response = await apiClient.put<ApiResponse<unknown>>(
        `/admin/brands/${selectedBrandId}/local-llm`,
        {
          ollamaUrl: ollamaSettings.ollamaUrl,
          ollamaModel: ollamaSettings.ollamaModel,
          useOllama: ollamaSettings.useOllama,
        }
      );

      if (response.success) {
        setOllamaSuccess('Ollama settings saved successfully!');
        setTimeout(() => setOllamaSuccess(null), 3000);

        // Auto-check health after saving if Ollama is enabled
        if (ollamaSettings.useOllama) {
          setTimeout(() => checkOllamaHealth(), 500);
        } else {
          setOllamaHealth(null);
        }
      } else {
        setOllamaError(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save Ollama settings:', error);
      setOllamaError('Failed to save Ollama settings');
    } finally {
      setOllamaSaving(false);
    }
  };

  const testOllamaPrompt = async () => {
    if (!selectedBrandId) {
      setTestError('Please select a brand first');
      return;
    }
    if (!testPrompt.trim()) {
      setTestError('Please enter a test prompt');
      return;
    }

    try {
      setTestLoading(true);
      setTestError(null);
      setTestResponse(null);

      const response = await apiClient.post<ApiResponse<{ response: string }>>(
        `/admin/brands/${selectedBrandId}/local-llm/test`,
        {
          prompt: testPrompt,
        }
      );

      if (response.success && response.data) {
        setTestResponse(response.data.response);
      } else {
        setTestError(response.error || 'Test failed');
      }
    } catch (error: unknown) {
      console.error('Failed to test Ollama prompt:', error);
      const apiError =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setTestError(apiError || 'Failed to test Ollama prompt');
    } finally {
      setTestLoading(false);
    }
  };

  const loadDiagnostic = async () => {
    if (!effectiveBrandId || !effectiveCustomerId) return;
    try {
      const response = await apiClient.get<ApiResponse<QueriesDiagnosticPayload>>(
        `/admin/brands/${effectiveBrandId}/queries-diagnostic?customer_id=${effectiveCustomerId}`
      );
      if (response.success && response.data) {
        setDiagnostic(response.data);
      }
    } catch (error) {
      console.error('Failed to load diagnostic:', error);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      if (!effectiveCustomerId) return;
      const params = new URLSearchParams({ customer_id: effectiveCustomerId });
      if (effectiveBrandId) {
        params.append('brand_id', effectiveBrandId);
      }
      const response = await apiClient.get<ApiResponse<ScheduledJob[]>>(
        `/admin/scheduled-jobs?${params.toString()}`
      );
      if (response.success && response.data) {
        setJobs(response.data);
      }
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (jobData: Partial<ScheduledJob>) => {
    try {
      const response = await apiClient.post<ApiResponse<unknown>>('/admin/scheduled-jobs', {
        ...jobData,
        customer_id: customerId,
        brand_id: selectedBrandId || brands[0]?.id,
      });
      if (response.success) {
        setShowCreateModal(false);
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create scheduled job');
    }
  };

  const handleToggleActive = async (job: ScheduledJob) => {
    try {
      const response = await apiClient.put<ApiResponse<unknown>>(
        `/admin/scheduled-jobs/${job.id}`,
        {
          is_active: !job.is_active,
        }
      );
      if (response.success) {
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const handleTriggerJob = async (jobId: string) => {
    try {
      const response = await apiClient.post<ApiResponse<unknown>>(
        `/admin/scheduled-jobs/${jobId}/trigger`
      );
      if (response.success) {
        alert('Job triggered successfully');
      }
    } catch (error) {
      console.error('Failed to trigger job:', error);
      alert('Failed to trigger job');
    }
  };

  const handleCollectDataNow = async (brandId: string) => {
    if (!brandId) {
      alert('Please select a brand first');
      return;
    }

    const brand = brands.find(b => b.id === brandId);
    const brandName = brand?.name || 'Selected Brand';

    let currentDiagnostic = diagnostic;

    // If diagnostic is not loaded or for a different brand, try to load it now
    if ((!currentDiagnostic || selectedBrandId !== brandId) && brandId && customerId) {
      try {
        const response = await apiClient.get<ApiResponse<QueriesDiagnosticPayload>>(
          `/admin/brands/${brandId}/queries-diagnostic?customer_id=${customerId}`
        );
        if (response.success && response.data) {
          currentDiagnostic = response.data;
          setDiagnostic(response.data);
        }
      } catch (error) {
        console.error('Failed to load diagnostic for warning:', error);
      }
    }

    // Calculate collectors count
    let collectorsCount = 0;
    const metadata = brand?.metadata;
    const aiModelsValue =
      typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
        ? (metadata as { ai_models?: unknown }).ai_models
        : undefined;

    if (Array.isArray(aiModelsValue)) {
      collectorsCount = aiModelsValue.length;
    } else {
      // Default to 7 if not specified (based on AVAILABLE_COLLECTORS in ManageCollectors.tsx)
      collectorsCount = 7;
    }

    const activeQueries = currentDiagnostic?.queries?.active || 0;
    const totalQueries = activeQueries * collectorsCount;

    // Calculate expected cost: 1000 queries cost 150 cents (Corrected per user request)
    const expectedCostCents = (totalQueries / 1000) * 150;
    const expectedCostDollars = expectedCostCents / 100;

    // Get last collection date
    const lastCollectedAt = currentDiagnostic?.collectorResults?.recent?.[0]?.created_at || null;

    setCollectionPreview({
      brandName,
      prompts: activeQueries,
      collectors: collectorsCount,
      totalPrompts: totalQueries,
      costCents: expectedCostCents,
      costDollars: expectedCostDollars,
      lastCollectedAt,
      brandId
    });
    setShowCollectionModal(true);
  };

  const confirmCollectDataNow = async () => {
    if (!collectionPreview) return;

    const { brandId } = collectionPreview;
    setShowCollectionModal(false);

    try {
      setCollecting(true);
      const response = await apiClient.post<ApiResponse<{ queriesExecuted: number }>>(
        `/admin/brands/${brandId}/collect-data-now`,
        {
          customer_id: customerId,
        }
      );
      if (response.success && response.data) {
        alert(`Data collection started! ${response.data.queriesExecuted} queries will be executed.`);
      }
    } catch (error: unknown) {
      console.error('Failed to start data collection:', error);
      alert(`Failed to start data collection: ${getErrorMessage(error)}`);
    } finally {
      setCollecting(false);
    }
  };

  const handleScoreNow = async (brandId: string) => {
    if (!brandId) {
      alert('Please select a brand first');
      return;
    }
    if (!customerId) {
      alert('Customer ID not available. Please select a brand.');
      return;
    }

    const brand = brands.find(b => b.id === brandId);
    const brandName = brand?.name || 'Selected Brand';

    let scoringDiag: ScoringDiagnosticPayload | null = null;

    try {
      setScoring(true);
      const response = await apiClient.get<ApiResponse<ScoringDiagnosticPayload>>(
        `/admin/brands/${brandId}/scoring-diagnostic?customer_id=${customerId}`
      );
      if (response.success && response.data) {
        scoringDiag = response.data;
      }
    } catch (error) {
      console.error('Failed to load scoring diagnostic:', error);
    } finally {
      setScoring(false);
    }

    const pendingCount = scoringDiag?.pendingScoringCount || 0;
    const llmProvider = ollamaSettings.useOllama ? 'Local LLM' : 'OpenRouter';

    // Cost calculation: 1.5 USD for 1000 results for OpenRouter, 0 for Local LLM
    const costDollars = ollamaSettings.useOllama ? 0 : (pendingCount / 1000) * 1.5;

    setScoringPreview({
      brandName,
      pendingCount,
      llmProvider,
      costDollars,
      lastScoredAt: scoringDiag?.lastScoredAt || null,
      brandId
    });
    setShowScoringModal(true);
  };

  const confirmScoreNow = async () => {
    if (!scoringPreview) return;

    const { brandId } = scoringPreview;
    setShowScoringModal(false);

    try {
      setScoring(true);
      const response = await apiClient.post<ApiResponse<unknown>>(`/admin/brands/${brandId}/score-now`, {
        customer_id: customerId,
      });
      if (response.success) {
        alert(`Scoring started in background! ${response.message || 'Check job run history for progress.'}`);
      }
    } catch (error: unknown) {
      console.error('Failed to start scoring:', error);
      alert(`Failed to start scoring: ${getErrorMessage(error)}`);
    } finally {
      setScoring(false);
    }
  };

  const handleRecoverStuckScoring = async () => {
    if (!confirm(`Recover stuck scoring jobs? This will check for results with cached analysis that are not marked as completed.`)) {
      return;
    }
    try {
      setRecovering(true);
      setRecoveryResult(null);
      const response = await apiClient.post<ApiResponse<{ processed: number; errors: any[] }>>('/admin/scoring/backfill-from-cache', {
        limit: 100
      });
      if (response.success && response.data) {
        setRecoveryResult(response.data);
        alert(`Recovery complete! Processed ${response.data.processed} items.`);
      }
    } catch (error: unknown) {
      console.error('Failed to recover stuck scoring:', error);
      alert(`Failed to recover stuck scoring: ${getErrorMessage(error)}`);
    } finally {
      setRecovering(false);
    }
  };

  const handleOpenBackfillModal = () => {
    if (!selectedBrandId) {
      alert('Please select a brand first');
      return;
    }
    setScoringBackfillLogs([]);
    setShowBackfillModal(true);
  };

  const handleRunBackfillScoring = async () => {
    if (!selectedBrandId || !backfillStartDate || !backfillEndDate) {
      alert('Please select a brand and both start and end dates');
      return;
    }

    if (!confirm(`Run scoring backfill for ${brands.find(b => b.id === selectedBrandId)?.name} from ${backfillStartDate} to ${backfillEndDate}? This will use existing cached analysis.`)) {
      return;
    }

    setScoringBackfillRunning(true);
    setScoringBackfillLogs([]);

    try {
      const response = await fetch(`${apiClient.baseUrl}/admin/brands/${selectedBrandId}/backfill-scoring`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiClient.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: backfillStartDate,
          endDate: backfillEndDate,
          force: backfillForce,
          preserveDates: backfillPreserveDates
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read response stream');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            try {
              const dataStr = trimmedLine.substring(6);
              if (dataStr === '[DONE]') {
                setScoringBackfillRunning(false);
                break;
              }
              if (dataStr === '[ERROR]') {
                setScoringBackfillRunning(false);
                break;
              }

              const data = JSON.parse(dataStr);
              if (data.message) {
                setScoringBackfillLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), message: data.message }]);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Backfill error:', error);
      setScoringBackfillLogs(prev => [...prev, { ts: new Date().toLocaleTimeString(), message: `Error: ${error instanceof Error ? error.message : 'Failed to connect'}` }]);
      setScoringBackfillRunning(false);
    }
  };

  const handleBackfillRawAnswers = () => {
    if (
      !confirm(
        `Run raw_answer backfill from BrightData snapshots now? This will update collector_results where raw_answer is NULL and brightdata_snapshot_id is NOT NULL.`
      )
    ) {
      return;
    }

    backfillEventSourceRef.current?.close();
    setBackfillLogs([]);
    setBackfillResult(null);
    setBackfillRunning(true);

    let finished = false;

    const url = `${apiClient.baseUrl}/admin/scheduled-jobs/backfill-raw-answer-from-snapshots/stream`;
    const es = new EventSource(url);
    backfillEventSourceRef.current = es;

    es.addEventListener('log', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { ts: string; level: string; message: string };
        setBackfillLogs((prev) => {
          const next = [...prev, payload];
          if (next.length > 500) {
            next.splice(0, next.length - 500);
          }
          return next;
        });
      } catch {
        setBackfillLogs((prev) => {
          const next = [...prev, { ts: new Date().toISOString(), level: 'log', message: (event as MessageEvent).data }];
          if (next.length > 500) {
            next.splice(0, next.length - 500);
          }
          return next;
        });
      }
    });

    es.addEventListener('done', (event) => {
      finished = true;
      try {
        const payload = JSON.parse((event as MessageEvent).data) as { ok: boolean; error?: string };
        setBackfillResult(payload);
      } catch {
        setBackfillResult({ ok: false, error: 'Backfill finished with unknown status' });
      } finally {
        setBackfillRunning(false);
        es.close();
      }
    });

    es.onerror = () => {
      if (finished) return;
      setBackfillRunning(false);
      setBackfillResult({ ok: false, error: 'Backfill stream connection error' });
      es.close();
    };
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) {
      return;
    }
    try {
      const response = await apiClient.delete<ApiResponse<unknown>>(`/admin/scheduled-jobs/${jobId}`);
      if (response.success) {
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job');
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'data_collection':
        return 'Data Collection';
      case 'scoring':
        return 'Scoring';
      case 'data_collection_and_scoring':
        return 'Data Collection + Scoring';
      default:
        return type;
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/admin/entitlements')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Entitlements
          </button>
          <button
            onClick={() => navigate('/admin/data-collection-status')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Data Collection Status
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Scheduled Job
          </button>
        </div>
      </div>

      {/* Admin Customer & Brand Selector */}
      <AdminCustomerBrandSelector
        selectedCustomerId={adminSelectedCustomerId}
        selectedBrandId={adminSelectedBrandId}
        onCustomerChange={setAdminSelectedCustomerId}
        onBrandChange={setAdminSelectedBrandId}
      />

      {/* Quick Actions */}
      {selectedBrandId && (
        <div className="mb-6 space-y-4">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900">
                Quick Actions for {brands.find(b => b.id === selectedBrandId)?.name || 'Selected Brand'}
              </h3>
              <button
                onClick={() => {
                  loadDiagnostic();
                  setShowDiagnostic(!showDiagnostic);
                }}
                className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                {showDiagnostic ? 'Hide' : 'Show'} Diagnostic
              </button>
            </div>

            {/* Diagnostic Info */}
            {showDiagnostic && diagnostic && (
              <div className="mb-4 p-3 bg-white rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Data Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Active Queries:</span>
                    <span className={`ml-2 font-semibold ${diagnostic.diagnostic?.hasActiveQueries ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostic.queries?.active || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Queries:</span>
                    <span className="ml-2 font-semibold">{diagnostic.queries?.total || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Collector Results:</span>
                    <span className="ml-2 font-semibold">{diagnostic.collectorResults?.count || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Can Collect:</span>
                    <span className={`ml-2 font-semibold ${diagnostic.diagnostic?.canCollectData ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostic.diagnostic?.canCollectData ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                {diagnostic.collectorResults?.statusCounts && (
                  <div className="mt-2 text-sm text-gray-700">
                    <span className="text-gray-600">Statuses:</span>
                    <span className="ml-2">
                      pending {diagnostic.collectorResults.statusCounts.pending || 0},{' '}
                      running {diagnostic.collectorResults.statusCounts.running || 0},{' '}
                      completed {diagnostic.collectorResults.statusCounts.completed || 0},{' '}
                      failed_retry {diagnostic.collectorResults.statusCounts.failed_retry || 0},{' '}
                      failed {diagnostic.collectorResults.statusCounts.failed || 0}
                    </span>
                    {(diagnostic.collectorResults.pendingOver2hCount || diagnostic.collectorResults.pendingOver8hCount) ? (
                      <span className="ml-2 text-yellow-700">
                        (stuck: &gt;2h {diagnostic.collectorResults.pendingOver2hCount || 0}, &gt;8h {diagnostic.collectorResults.pendingOver8hCount || 0})
                      </span>
                    ) : null}
                  </div>
                )}
                {!diagnostic.diagnostic?.canCollectData && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    ⚠️ No active queries found. Queries need to be created during onboarding or set to <code className="bg-yellow-100 px-1 rounded">is_active = true</code> in the <code className="bg-yellow-100 px-1 rounded">generated_queries</code> table.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded border border-indigo-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 text-indigo-800">Generate Recommendations</h4>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={generateRecsForAllBrands}
                          onChange={(e) => setGenerateRecsForAllBrands(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${generateRecsForAllBrands ? 'bg-indigo-600' : 'bg-gray-400'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${generateRecsForAllBrands ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <div className="ml-3 text-gray-700 text-xs font-medium">
                        All Brands
                      </div>
                    </label>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Generate V3 recommendations (KPI-first approach).
                </p>
                <button
                  onClick={handleGenerateRecommendations}
                  disabled={generatingRecommendations || collecting || scoring || backfillRunning}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingRecommendations ? 'Generating...' : generateRecsForAllBrands ? 'Generate All' : 'Generate Recommendations'}
                </button>
              </div>

              <div className="bg-white p-4 rounded border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 text-blue-800">Refresh Brand Products</h4>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={enrichAllBrands}
                          onChange={(e) => setEnrichAllBrands(e.target.checked)}
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${enrichAllBrands ? 'bg-blue-600' : 'bg-gray-400'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${enrichAllBrands ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <div className="ml-3 text-gray-700 text-xs font-medium">
                        Active Brands Only
                      </div>
                    </label>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  LLM enrichment for brand synonyms and commercial products (Ollama or OpenRouter)
                </p>
                <button
                  onClick={handleRefreshBrandProducts}
                  disabled={enrichmentRunning || collecting || scoring || backfillRunning}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrichmentRunning ? 'Refreshing...' : enrichAllBrands ? 'Refresh Active Brands' : 'Refresh Products'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-green-200">
                <h4 className="font-medium text-gray-900 mb-2">Collect Data Now</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Immediately collects data using all active queries from onboarding
                </p>
                <button
                  onClick={() => handleCollectDataNow(selectedBrandId)}
                  disabled={collecting || scoring || backfillRunning}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {collecting ? 'Collecting...' : 'Start Collection'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-purple-200">
                <h4 className="font-medium text-gray-900 mb-2">Score Now</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Immediately processes and scores all unprocessed collector results
                </p>
                <button
                  onClick={() => handleScoreNow(selectedBrandId)}
                  disabled={collecting || scoring || backfillRunning}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scoring ? 'Scoring...' : 'Start Scoring'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-red-200">
                <h4 className="font-medium text-gray-900 mb-2">Recover Stuck Scoring</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Completes interrupted scoring tasks using existing cache data
                </p>
                <button
                  onClick={handleRecoverStuckScoring}
                  disabled={collecting || scoring || backfillRunning || recovering}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recovering ? 'Recovering...' : 'Recover Stuck Scoring'}
                </button>
                {recoveryResult && (
                  <div className="mt-2 text-xs text-gray-600">
                    Last run: {recoveryResult.processed} items recovered, {recoveryResult.errors.length} errors.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 bg-white p-4 rounded border border-orange-200">
              <h4 className="font-medium text-gray-900 mb-2">Backfill Raw Answers</h4>
              <p className="text-sm text-gray-600 mb-3">
                Updates raw_answer from BrightData snapshots and resets stuck scoring
              </p>
              <button
                onClick={handleBackfillRawAnswers}
                disabled={collecting || scoring || backfillRunning}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {backfillRunning ? 'Running Backfill...' : 'Run Backfill'}
              </button>
              {backfillResult ? (
                <div
                  className={`mt-2 text-sm ${backfillResult.ok ? 'text-green-700' : 'text-red-700'}`}
                >
                  {backfillResult.ok ? 'Backfill finished successfully' : `Backfill failed: ${backfillResult.error || 'Unknown error'}`}
                </div>
              ) : null}
            </div>

            {/* Scoring Backfill Panel */}
            <div className="mt-4 bg-white p-4 rounded border border-teal-200">
              <h4 className="font-medium text-gray-900 mb-2">Backfill Scoring</h4>
              <p className="text-sm text-gray-600 mb-3">
                Re-calculate scores for a specific time period using cached analysis (no LLM cost)
              </p>
              <button
                onClick={handleOpenBackfillModal}
                disabled={collecting || scoring || backfillRunning || scoringBackfillRunning}
                className="w-full px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scoringBackfillRunning ? 'Backfilling Scoring...' : 'Start Scoring Backfill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backfill Scoring Modal */}
      {showBackfillModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Backfill Scoring</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 mb-4">
                  Select time period for {brands.find(b => b.id === selectedBrandId)?.name}.
                  This will re-run scoring using existing analysis data.
                </p>
                <div className="mb-4 text-left">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={backfillStartDate}
                    onChange={(e) => setBackfillStartDate(e.target.value)}
                  />
                </div>
                <div className="mb-4 text-left">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    value={backfillEndDate}
                    onChange={(e) => setBackfillEndDate(e.target.value)}
                  />
                </div>
                <div className="mb-4 text-left">
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="backfill-force"
                      className="mr-2 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      checked={backfillForce}
                      onChange={(e) => setBackfillForce(e.target.checked)}
                    />
                    <label htmlFor="backfill-force" className="text-gray-700 text-sm font-medium">
                      Force Re-Scoring (Delete existing data)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="backfill-dates"
                      className="mr-2 h-4 w-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                      checked={backfillPreserveDates}
                      onChange={(e) => setBackfillPreserveDates(e.target.checked)}
                    />
                    <label htmlFor="backfill-dates" className="text-gray-700 text-sm font-medium">
                      Preserve Dates (Backdate metrics)
                    </label>
                  </div>
                </div>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handleRunBackfillScoring}
                  disabled={scoringBackfillRunning || !backfillStartDate || !backfillEndDate}
                  className="px-4 py-2 bg-teal-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-50 mb-2"
                >
                  {scoringBackfillRunning ? 'Running...' : 'Start Backfill'}
                </button>
                <button
                  onClick={() => setShowBackfillModal(false)}
                  disabled={scoringBackfillRunning}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(scoringBackfillRunning || scoringBackfillLogs.length > 0) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">Scoring Backfill Logs</h2>
            <button
              onClick={() => setScoringBackfillLogs([])}
              disabled={scoringBackfillRunning || scoringBackfillLogs.length === 0}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="h-64 overflow-auto border rounded bg-gray-900 text-teal-400 p-3 font-mono text-xs whitespace-pre-wrap shadow-inner">
            {scoringBackfillLogs.length === 0
              ? 'Initializing scoring backfill...'
              : scoringBackfillLogs.map((l, i) => (
                <div key={i} className="mb-1">
                  <span className="text-gray-500">[{l.ts}]</span> {l.message}
                </div>
              ))}
            {scoringBackfillRunning && <div className="animate-pulse inline-block w-2 h-4 bg-teal-400 ml-1"></div>}
          </div>
        </div>
      )}

      {(enrichmentRunning || enrichmentLogs.length > 0) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">Enrichment Logs</h2>
            <button
              onClick={() => setEnrichmentLogs([])}
              disabled={enrichmentRunning || enrichmentLogs.length === 0}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="h-64 overflow-auto border rounded bg-gray-900 text-green-400 p-3 font-mono text-xs whitespace-pre-wrap shadow-inner">
            {enrichmentLogs.length === 0
              ? 'Initializing LLM enrichment...'
              : enrichmentLogs.map((l, i) => (
                <div key={i} className="mb-1">
                  <span className="text-gray-500">[{l.ts}]</span> {l.message}
                </div>
              ))}
            {enrichmentRunning && <div className="animate-pulse inline-block w-2 h-4 bg-green-400 ml-1"></div>}
          </div>
        </div>
      )}

      {(backfillRunning || backfillLogs.length > 0 || backfillResult) && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">Backfill Logs</h2>
            <button
              onClick={() => setBackfillLogs([])}
              disabled={backfillRunning || backfillLogs.length === 0}
              className="text-sm px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <div className="h-64 overflow-auto border rounded bg-gray-50 p-3 font-mono text-xs whitespace-pre-wrap">
            {backfillLogs.length === 0
              ? backfillRunning
                ? 'Connecting...'
                : 'No logs yet'
              : backfillLogs.map((l) => `${l.ts} [${l.level}] ${l.message}`).join('\n')}
          </div>
        </div>
      )}

      {/* Ollama Settings Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ollama Configuration</h2>
          <div className="flex items-center gap-2">
            {ollamaSettings.useOllama && (
              <>
                {/* Health Status Indicator */}
                {ollamaHealthChecking ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Checking...
                  </span>
                ) : ollamaHealth ? (
                  ollamaHealth.healthy ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Healthy
                      {ollamaHealth.responseTime && (
                        <span className="ml-1 text-green-700">
                          ({ollamaHealth.responseTime}ms)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Unavailable
                    </span>
                  )
                ) : null}

                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Active
                </span>

                {/* Manual Health Check Button */}
                <button
                  onClick={checkOllamaHealth}
                  disabled={ollamaHealthChecking}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="Check Ollama health"
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        {ollamaLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">Loading settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-900">Use Ollama for Scoring</label>
                <p className="text-xs text-gray-500 mt-1">
                  When enabled, scoring will use your local Ollama instance instead of cloud APIs
                  {selectedBrandId && (
                    <span className="block mt-1 text-blue-600 font-medium">
                      (Brand-specific settings)
                    </span>
                  )}
                  {!selectedBrandId && (
                    <span className="block mt-1 text-amber-600 font-medium">
                      Please select a brand to configure Ollama settings
                    </span>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ollamaSettings.useOllama}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, useOllama: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Configuration Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ollama API URL
                </label>
                <input
                  type="text"
                  value={ollamaSettings.ollamaUrl}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, ollamaUrl: e.target.value })
                  }
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={ollamaSaving}
                />
                <p className="mt-1 text-xs text-gray-500">
                  URL where your Ollama instance is running
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ollama Model
                </label>
                <input
                  type="text"
                  value={ollamaSettings.ollamaModel}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, ollamaModel: e.target.value })
                  }
                  placeholder="qwen2.5:latest"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={ollamaSaving}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Model name as it appears in Ollama (e.g., qwen2.5:latest)
                </p>
              </div>
            </div>

            {/* Health Status Details */}
            {ollamaSettings.useOllama && ollamaHealth && !ollamaHealth.healthy && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">Ollama is not available</p>
                    <p className="text-xs text-red-700 mt-1">{ollamaHealth.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {ollamaError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{ollamaError}</p>
              </div>
            )}

            {ollamaSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">{ollamaSuccess}</p>
              </div>
            )}

            {/* Info Box */}
            {ollamaSettings.useOllama && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Sequential Processing Enabled</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        When using Ollama, answers are processed one at a time to avoid overloading your local instance.
                        This may take longer but ensures stability.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveOllamaSettings}
                disabled={ollamaSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {ollamaSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Prompt Section */}
      {ollamaSettings.useOllama && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Test Ollama</h2>
          <p className="text-sm text-gray-600 mb-4">
            Send a test prompt to verify Ollama is working correctly
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Prompt
              </label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a test prompt here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={testLoading}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={testOllamaPrompt}
                disabled={testLoading || !testPrompt.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {testLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Send Test Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Response */}
            {testError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-700 mt-1">{testError}</p>
              </div>
            )}

            {testResponse && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800 mb-2">Response</p>
                <div className="bg-white p-3 rounded border border-green-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{testResponse}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Run</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {brands.find((b) => b.id === job.brand_id)?.name || job.brand_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{getJobTypeLabel(job.job_type)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono">
                  {job.cron_expression}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {job.is_active ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleToggleActive(job)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {job.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleTriggerJob(job.id)}
                    className="text-green-600 hover:text-green-900"
                  >
                    Trigger
                  </button>
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setShowRunsModal(true);
                    }}
                    className="text-purple-600 hover:text-purple-900"
                  >
                    History
                  </button>
                  <a
                    href={`/search-visibility?brand=${job.brand_id}`}
                    target="_blank"
                    className="text-indigo-600 hover:text-indigo-900"
                    title="View historical trends"
                  >
                    Trends
                  </a>
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <div className="p-8 text-center text-gray-500">No scheduled jobs found</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateJob}
          brands={brands}
          defaultBrandId={selectedBrandId ?? undefined}
        />
      )}

      {/* Runs History Modal */}
      {showRunsModal && selectedJob && (
        <RunsHistoryModal
          job={selectedJob}
          onClose={() => {
            setShowRunsModal(false);
            setSelectedJob(null);
          }}
        />
      )}

      {/* Collection Confirmation Modal */}
      {showCollectionModal && collectionPreview && (
        <CollectionConfirmationModal
          preview={collectionPreview}
          onClose={() => setShowCollectionModal(false)}
          onConfirm={confirmCollectDataNow}
        />
      )}

      {/* Scoring Confirmation Modal */}
      {showScoringModal && scoringPreview && (
        <ScoringConfirmationModal
          preview={scoringPreview}
          onClose={() => setShowScoringModal(false)}
          onConfirm={confirmScoreNow}
        />
      )}
    </div>
  );
};

// Collection Confirmation Modal Component
const CollectionConfirmationModal = ({
  preview,
  onClose,
  onConfirm,
}: {
  preview: {
    brandName: string;
    prompts: number;
    collectors: number;
    totalPrompts: number;
    costCents: number;
    costDollars: number;
    lastCollectedAt: string | null;
  };
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        <div className="bg-amber-50 px-6 py-4 border-b border-amber-100">
          <h2 className="text-xl font-bold text-amber-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Data Collection Warning
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 font-medium">
            BrightData Collection will start for the following brand:
          </p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-500">Brand Name</span>
              <span className="font-bold text-gray-900">{preview.brandName}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Number of Prompts</span>
                <span className="text-lg font-bold text-gray-800">{preview.prompts}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Number of Collectors</span>
                <span className="text-lg font-bold text-gray-800">{preview.collectors}</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-500">Total Number of Prompts</span>
              <span className="text-lg font-extrabold text-indigo-600">{preview.totalPrompts}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-500">Expected Cost</span>
                <span className="text-xs text-gray-400">(Rate: 150 cents / 1000 queries)</span>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-emerald-600">${preview.costDollars.toFixed(2)}</div>
                <div className="text-xs font-medium text-emerald-500">{preview.costCents.toFixed(0)} cents</div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-500">Last Data Collected</span>
              <span className="text-sm font-medium text-gray-700 italic">{formatDate(preview.lastCollectedAt)}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 italic text-center">
            This action will incur costs on your BrightData account.
          </p>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Collection
          </button>
        </div>
      </div>
    </div>
  );
};

const ScoringConfirmationModal = ({
  preview,
  onClose,
  onConfirm,
}: {
  preview: {
    brandName: string;
    pendingCount: number;
    llmProvider: 'OpenRouter' | 'Local LLM';
    costDollars: number;
    lastScoredAt: string | null;
  };
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Unknown';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
          <h2 className="text-xl font-bold text-indigo-800 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Scoring Warning
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 font-medium">
            Scoring will start for the following brand:
          </p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-500">Brand Name</span>
              <span className="font-bold text-gray-900">{preview.brandName}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-semibold text-gray-500">Collector results to be scored</span>
              <span className="text-lg font-bold text-gray-800">{preview.pendingCount}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-500">LLM Provider</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${preview.llmProvider === 'Local LLM' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                {preview.llmProvider}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-t border-gray-200">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-500">Estimated Cost</span>
                <span className="text-xs text-gray-400">
                  {preview.llmProvider === 'OpenRouter' ? '(Rate: $1.50 / 1000 results)' : '(Free with local LLM)'}
                </span>
              </div>
              <div className="text-right">
                <div className={`text-xl font-black ${preview.costDollars > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                  ${preview.costDollars.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm font-semibold text-gray-500">Last Date for Scoring</span>
              <span className="text-sm font-medium text-gray-700 italic">{formatDate(preview.lastScoredAt)}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 italic text-center">
            The scoring process runs in the background and may take some time depending on the volume.
          </p>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Scoring
          </button>
        </div>
      </div>
    </div>
  );
};

// Create Job Modal Component
const CreateJobModal = ({
  onClose,
  onSubmit,
  brands,
  defaultBrandId,
}: {
  onClose: () => void;
  onSubmit: (data: Partial<ScheduledJob>) => void;
  brands: Array<{ id: string; name: string }>;
  defaultBrandId?: string;
}) => {
  const [formData, setFormData] = useState<{
    brand_id: string;
    job_type: ScheduledJob['job_type'];
    cron_expression: string;
    timezone: string;
    is_active: boolean;
  }>({
    brand_id: defaultBrandId || brands[0]?.id || '',
    job_type: 'data_collection_and_scoring',
    cron_expression: '0 9 * * *', // Daily at 9 AM
    timezone: 'UTC',
    is_active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Create Scheduled Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <select
              value={formData.brand_id}
              onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job Type</label>
            <select
              value={formData.job_type}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === 'data_collection' ||
                  value === 'scoring' ||
                  value === 'data_collection_and_scoring'
                ) {
                  setFormData({ ...formData, job_type: value });
                }
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="data_collection">Data Collection</option>
              <option value="scoring">Scoring</option>
              <option value="data_collection_and_scoring">Data Collection + Scoring</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cron Expression</label>
            <input
              type="text"
              value={formData.cron_expression}
              onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
              placeholder="0 9 * * *"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: minute hour day month weekday (e.g., "0 9 * * *" = daily at 9 AM)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder="UTC"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm">Active</label>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Runs History Modal Component
const RunsHistoryModal = ({ job, onClose }: { job: ScheduledJob; onClose: () => void }) => {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, [job.id]);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<ApiResponse<JobRun[]>>(
        `/admin/job-runs?scheduled_job_id=${job.id}&limit=50`
      );
      if (response.success && response.data) {
        setRuns(response.data);
      }
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Job Run History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(run.status)}
                    <span className="text-sm">
                      {new Date(run.scheduled_for).toLocaleString()}
                    </span>
                  </div>
                  {run.finished_at && run.started_at && (
                    <span className="text-xs text-gray-500">
                      Duration: {Math.round(
                        (new Date(run.finished_at).getTime() -
                          new Date(run.started_at).getTime()) /
                        1000
                      )}{' '}
                      seconds
                    </span>
                  )}
                </div>
                {run.error_message && (
                  <div className="text-sm text-red-600 mb-2">{run.error_message}</div>
                )}
                {run.metrics && Object.keys(run.metrics).length > 0 && (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(run.metrics, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {runs.length === 0 && (
              <div className="text-center text-gray-500 py-4">No runs found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
