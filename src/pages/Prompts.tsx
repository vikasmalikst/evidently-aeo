import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { PromptFilters } from '../components/Prompts/PromptFilters';
import { PromptsList } from '../components/Prompts/PromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { PromptAnalyticsPayload, PromptEntry } from '../types/prompts';

// Performance logging
const perfLog = (label: string, startTime: number) => {
  const duration = performance.now() - startTime;
  console.log(`[PERF] ${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

import { getDefaultDateRange } from './dashboard/utils';

export const Prompts = () => {
  const pageLoadStart = useRef(performance.now());
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEntry | null>(null);
  const navigate = useNavigate();
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>([]);
  const defaultDateRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState<string>(defaultDateRange.start);
  const [endDate, setEndDate] = useState<string>(defaultDateRange.end);
  const { brands, selectedBrandId, selectedBrand, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();

  const handlePromptSelect = (prompt: PromptEntry) => {
    setSelectedPrompt(prompt);
  };

  // Build endpoint - always fetch all prompts with all responses (filtering happens client-side)
  // NOTE: We use a two-step approach to handle "All" selection correctly:
  // 1. First request (no collectors param) to get available collectors
  // 2. Subsequent requests explicitly pass collectors to ensure consistent aggregation
  const promptsEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId || brandsLoading) return null;
    const params = new URLSearchParams({
      startDate: startDate ? new Date(startDate + 'T00:00:00').toISOString() : '',
      endDate: endDate ? new Date(endDate + 'T23:59:59.999').toISOString() : ''
    });

    // Filter by collector on backend so visibility/sentiment reflect the selected LLMs
    if (selectedLLMs.length > 0) {
      // Explicitly selected models: pass them as comma-separated list
      params.set('collectors', selectedLLMs.join(','));
    }
    // When "All" is selected (empty array), don't pass collectors parameter
    // Backend will return data aggregated across all collectors

    // IMPORTANT (perf):
    // Keep the endpoint stable on mount to maximize cache hits and avoid double-fetches.

    const endpoint = `/brands/${selectedBrandId}/prompts?${params.toString()}`;
    perfLog('Prompts: Endpoint computation', endpointStart);
    return endpoint;
  }, [selectedBrandId, startDate, endDate, brandsLoading, selectedLLMs]);

  // Use cached data hook
  const fetchStart = useRef(performance.now());
  const {
    data: response,
    loading,
    error: fetchError
  } = useCachedData<ApiResponse<PromptAnalyticsPayload>>(
    promptsEndpoint,
    {},
    { requiresAuth: true },
    { enabled: !!promptsEndpoint, refetchOnMount: false }
  );

  // Log fetch completion
  useEffect(() => {
    if (response && !loading) {
      perfLog('Prompts: Data fetch complete', fetchStart.current);
      fetchStart.current = performance.now();
    }
  }, [response, loading]);

  // Extract available collectors from response
  const llmOptions = useMemo(() => {
    if (!response?.success || !response.data) {
      return [];
    }
    return response.data.collectors ?? [];
  }, [response]);

  // Process response data with performance logging
  const topics = useMemo(() => {
    const start = performance.now();
    if (!response?.success || !response.data) {
      return [];
    }
    const payload = response.data;
    const filtered = (payload.topics ?? []).filter((topic) => topic.prompts.length > 0);
    perfLog('Prompts: Topics processing', start);
    return filtered;
  }, [response]);

  // Keep selected LLMs in sync with available options
  // Remove any selected LLMs that are no longer available
  useEffect(() => {
    if (llmOptions.length === 0) {
      if (selectedLLMs.length > 0) {
        setSelectedLLMs([]);
      }
      return;
    }

    // Filter out any selected LLMs that are no longer in available options
    const validSelected = selectedLLMs.filter(llm => llmOptions.includes(llm));
    if (validSelected.length !== selectedLLMs.length) {
      setSelectedLLMs(validSelected);
    }
  }, [llmOptions, selectedLLMs]);

  // Set selected prompt
  useEffect(() => {
    const flattenedPrompts = topics.flatMap((topic) => topic.prompts);
    setSelectedPrompt((previous) => {
      if (!flattenedPrompts.length) {
        return null;
      }
      if (previous) {
        const stillExists = flattenedPrompts.find((prompt) => prompt.id === previous.id);
        if (stillExists) {
          return stillExists;
        }
      }
      return flattenedPrompts[0];
    });
  }, [topics]);

  const error = fetchError?.message || (response && !response.success ? (response.error || response.message || 'Failed to load prompts.') : null);

  const handleManagePrompts = () => {
    navigate('/settings/manage-prompts');
  };

  // Log page render completion
  useEffect(() => {
    if (!loading && topics.length > 0) {
      perfLog('Prompts: Page fully rendered', pageLoadStart.current);
    }
  }, [loading, topics.length]);

  const handleLLMChange = (llms: string[]) => {
    setSelectedLLMs(llms);
  };

  if (loading && (!response || !response.data)) {
    return (
      <Layout>
        <LoadingScreen message="Loading prompts..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-6">
            {selectedBrand && (
              <SafeLogo
                src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                domain={selectedBrand.homepage_url || undefined}
                alt={selectedBrand.name}
                size={48}
                className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
                Prompts
              </h1>
              <p className="text-[var(--text-caption)]">
                Analyze AI responses to tracked prompts across topics and platforms
              </p>
            </div>
          </div>
          <button
            onClick={handleManagePrompts}
            className="px-5 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            Manage Prompts
          </button>
        </div>

        <PromptFilters
          llmOptions={llmOptions}
          selectedLLMs={selectedLLMs}
          onLLMChange={handleLLMChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-[#fcdada] bg-[#fff5f5] text-sm text-[#b42323]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-10 gap-6">
          <div className="col-span-6">
            <PromptsList
              topics={topics}
              selectedPromptId={selectedPrompt?.id ?? null}
              onPromptSelect={handlePromptSelect}
              loading={loading}
              selectedLLMs={selectedLLMs}
            />
          </div>

          <div className="col-span-4">
            <ResponseViewer prompt={selectedPrompt} selectedLLMs={selectedLLMs} />
          </div>
        </div>
      </div>
    </Layout>
  );
};