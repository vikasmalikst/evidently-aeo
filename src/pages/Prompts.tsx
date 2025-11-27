import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { PromptFilters } from '../components/Prompts/PromptFilters';
import { PromptsList } from '../components/Prompts/PromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { useCachedData } from '../hooks/useCachedData';
import { useManualBrandDashboard } from '../manual-dashboard';
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

interface DatePreset {
  value: string;
  days: number;
}

const DATE_PRESETS: DatePreset[] = [
  { value: 'last7', days: 7 },
  { value: 'last14', days: 14 },
  { value: 'last30', days: 30 }
];

const formatDateRangeLabel = (start: Date, end: Date) => {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit'
  });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const getDateBounds = (preset: DatePreset) => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (preset.days - 1));
  start.setUTCHours(0, 0, 0, 0);

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label: formatDateRangeLabel(start, end)
  };
};

export const Prompts = () => {
  const pageLoadStart = useRef(performance.now());
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEntry | null>(null);
  const navigate = useNavigate();
  const [selectedLLM, setSelectedLLM] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [dateRangeKey, setDateRangeKey] = useState<string>(DATE_PRESETS[2]?.value ?? 'last30');
  const { brands, selectedBrandId, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  
  // Track if LLM was set programmatically (from API) vs user action
  const isLLMSetProgrammatically = useRef(false);

  const dateRangeOptions = useMemo(
    () =>
      DATE_PRESETS.map((preset) => {
        const bounds = getDateBounds(preset);
        return {
          value: preset.value,
          label: bounds.label
        };
      }),
    []
  );

  const handlePromptSelect = (prompt: PromptEntry) => {
    setSelectedPrompt(prompt);
  };

  // Build endpoint - only include selectedLLM if it was set by user, not programmatically
  const promptsEndpoint = useMemo(() => {
    const endpointStart = performance.now();
    if (!selectedBrandId || brandsLoading) return null;
    const preset = DATE_PRESETS.find((item) => item.value === dateRangeKey) ?? DATE_PRESETS[0];
    const bounds = getDateBounds(preset);
    const params = new URLSearchParams({
      startDate: bounds.startIso,
      endDate: bounds.endIso
    });

    // Only add LLM filter if it was set by user action, not from API response
    if (selectedLLM && !isLLMSetProgrammatically.current) {
      params.set('collectors', selectedLLM);
    }

    const endpoint = `/brands/${selectedBrandId}/prompts?${params.toString()}`;
    perfLog('Prompts: Endpoint computation', endpointStart);
    return endpoint;
  }, [selectedBrandId, dateRangeKey, selectedLLM, brandsLoading]);

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

  const llmOptions = useMemo(() => {
    if (!response?.success || !response.data) {
      return [];
    }
    return response.data.collectors ?? [];
  }, [response]);

  // Set default LLM - mark as programmatic to prevent endpoint change
  useEffect(() => {
    if (llmOptions.length > 0) {
      isLLMSetProgrammatically.current = true;
      setSelectedLLM((current) => {
        if (current && llmOptions.includes(current)) {
          isLLMSetProgrammatically.current = false;
          return current;
        }
        const newLLM = llmOptions[0];
        // Reset flag after state update
        setTimeout(() => {
          isLLMSetProgrammatically.current = false;
        }, 0);
        return newLLM;
      });
    }
  }, [llmOptions]);

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

  // Handle LLM change from user (not programmatic)
  const handleLLMChange = (llm: string | null) => {
    isLLMSetProgrammatically.current = false;
    setSelectedLLM(llm);
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Prompts
            </h1>
            <p className="text-[var(--text-caption)]">
              Analyze AI responses to tracked prompts across topics and platforms
            </p>
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
          selectedLLM={selectedLLM}
          onLLMChange={handleLLMChange}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          brands={brands}
          selectedBrandId={selectedBrandId}
          onBrandChange={selectBrand}
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
              dateRangeKey={dateRangeKey}
              dateRangeOptions={dateRangeOptions}
              onDateRangeChange={setDateRangeKey}
              loading={loading}
              selectedLLM={selectedLLM}
            />
          </div>

          <div className="col-span-4">
            <ResponseViewer prompt={selectedPrompt} />
          </div>
        </div>
      </div>
    </Layout>
  );
};