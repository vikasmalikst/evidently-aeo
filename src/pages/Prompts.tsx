import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout/Layout';
import { PromptFilters } from '../components/Prompts/PromptFilters';
import { PromptsList } from '../components/Prompts/PromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { apiClient } from '../lib/apiClient';
import { useManualBrandDashboard } from '../manual-dashboard';
import { PromptAnalyticsPayload, PromptEntry, PromptTopic } from '../types/prompts';

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
  const [selectedPrompt, setSelectedPrompt] = useState<PromptEntry | null>(null);
  const navigate = useNavigate();
  const [selectedLLM, setSelectedLLM] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [dateRangeKey, setDateRangeKey] = useState<string>(DATE_PRESETS[2]?.value ?? 'last30');
  const [topics, setTopics] = useState<PromptTopic[]>([]);
  const [llmOptions, setLlmOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { brands, selectedBrandId, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();

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

  useEffect(() => {
    if (brandsLoading) {
      return;
    }

    if (!selectedBrandId) {
      setTopics([]);
      setSelectedPrompt(null);
      return;
    }

    let cancelled = false;

    const fetchPrompts = async () => {
      setLoading(true);
      setError(null);

      try {
        const preset = DATE_PRESETS.find((item) => item.value === dateRangeKey) ?? DATE_PRESETS[0];
        const bounds = getDateBounds(preset);
        const params = new URLSearchParams({
          startDate: bounds.startIso,
          endDate: bounds.endIso
        });

        if (selectedLLM) {
          params.set('collectors', selectedLLM);
        }

        const endpoint = `/brands/${selectedBrandId}/prompts?${params.toString()}`;
        const response = await apiClient.request<ApiResponse<PromptAnalyticsPayload>>(endpoint);

        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || 'Failed to load prompts.');
        }

        if (cancelled) {
          return;
        }

        const payload = response.data;
        const normalizedTopics = (payload.topics ?? []).filter((topic) => topic.prompts.length > 0);
        const availableCollectors = payload.collectors ?? [];

        setTopics(normalizedTopics);
        setLlmOptions(availableCollectors);
        // Set default to first available LLM if none selected or current selection is invalid
        setSelectedLLM((current) => {
          if (current && availableCollectors.includes(current)) {
            return current;
          }
          return availableCollectors.length > 0 ? availableCollectors[0] : null;
        });

        const flattenedPrompts = normalizedTopics.flatMap((topic) => topic.prompts);
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
      } catch (fetchError) {
        const message =
          fetchError instanceof Error ? fetchError.message : 'Failed to load prompts.';
        if (!cancelled) {
          setError(message);
          setTopics([]);
          setSelectedPrompt(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPrompts();

    return () => {
      cancelled = true;
    };
  }, [selectedBrandId, dateRangeKey, selectedLLM, brandsLoading]);

  const handleManagePrompts = () => {
    navigate('/settings/manage-prompts');
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
          onLLMChange={setSelectedLLM}
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