import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import { updateBrandCollectors } from '../api/brandApi';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconInfoCircle,
  IconSearch,
  IconBrain,
  IconMessageCircle,
  IconBrandOpenai,
  IconBrandGoogle,
  IconBolt,
  IconDeviceLaptop
} from '@tabler/icons-react';
import { getLLMIcon } from '../components/Visibility/LLMIcons';

interface CollectorDefinition {
  id: string;
  name: string;
  provider: string;
  description: string;
  icon: any;
  color: string;
}

const AVAILABLE_COLLECTORS: Omit<CollectorDefinition, 'icon' | 'color'>[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Queries OpenAI\'s ChatGPT models for brand mentions and visibility.',
  },
  {
    id: 'google_aio',
    name: 'Google Search AIO',
    provider: 'Google',
    description: 'Tracks brand presence in Google\'s AI-powered Search Generative Experience.',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    description: 'Monitors brand citations and mentions in Perplexity AI search results.',
  },
  {
    id: 'claude',
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Analyzes brand perception and visibility in Anthropic\'s Claude models.',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    description: 'Queries Google\'s Gemini models for brand insights and performance.',
  },
  {
    id: 'bing_copilot',
    name: 'Bing Copilot',
    provider: 'Microsoft',
    description: 'Tracks brand mentions in Microsoft\'s AI-powered Bing search.',
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    description: 'Monitors brand presence and mentions in xAI\'s Grok assistant.',
  }
];

export const ManageCollectors = () => {
  const { selectedBrand, selectedBrandId, reload } = useManualBrandDashboard();
  const [enabledCollectors, setEnabledCollectors] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize enabled collectors from brand metadata
  useEffect(() => {
    if (!selectedBrand) {
      setEnabledCollectors(new Set());
      return;
    }

    const metadata = selectedBrand.metadata;
    const metadataHasAiModelsKey =
      typeof metadata === 'object' &&
      metadata !== null &&
      Object.prototype.hasOwnProperty.call(metadata, 'ai_models');

    if (metadataHasAiModelsKey) {
      const aiModelsValue =
        typeof metadata === 'object' && metadata !== null && 'ai_models' in metadata
          ? (metadata as { ai_models?: unknown }).ai_models
          : undefined;

      const rawAiModels = Array.isArray(aiModelsValue)
        ? aiModelsValue
          .filter((value): value is string => typeof value === 'string')
          .map(value => value === 'copilot' ? 'bing_copilot' : value) // Normalize legacy 'copilot' to 'bing_copilot'
        : [];

      setEnabledCollectors(new Set(rawAiModels));
      return;
    }

    setEnabledCollectors(new Set(AVAILABLE_COLLECTORS.map((collector) => collector.id)));
  }, [selectedBrand]);

  const handleToggleCollector = async (collectorId: string) => {
    if (!selectedBrandId) return;

    setIsUpdating(collectorId);
    setError(null);
    setSuccessMessage(null);

    const newEnabled = new Set(enabledCollectors);
    if (newEnabled.has(collectorId)) {
      newEnabled.delete(collectorId);
    } else {
      newEnabled.add(collectorId);
    }

    try {
      const aiModels = Array.from(newEnabled);
      const response = await updateBrandCollectors(selectedBrandId, aiModels);

      if (response.success) {
        setEnabledCollectors(newEnabled);
        setSuccessMessage(`${AVAILABLE_COLLECTORS.find(c => c.id === collectorId)?.name} status updated`);
        // Refresh brand data to sync metadata
        reload();

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(response.error || 'Failed to update collector status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUpdating(null);
    }
  };

  if (!selectedBrandId) {
    return (
      <Layout>
        <SettingsLayout>
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
              <IconInfoCircle className="text-yellow-600" size={20} />
              <p className="text-yellow-800">Please select a brand to manage collectors.</p>
            </div>
          </div>
        </SettingsLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedBrand && (
                <SafeLogo
                  src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
                  domain={selectedBrand.homepage_url || undefined}
                  alt={selectedBrand.name}
                  size={48}
                  className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">AI Data Collectors</h1>
                <p className="text-sm text-[var(--text-caption)] mt-1">Select the AI models you want to monitor for your brand</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-800">
              <IconX size={20} />
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 text-green-800 animate-in fade-in slide-in-from-top-2">
              <IconCheck size={20} />
              {successMessage}
            </div>
          )}

          <div className="space-y-3">
            {[...AVAILABLE_COLLECTORS]
              .sort((a, b) => {
                const aActive = enabledCollectors.has(a.id);
                const bActive = enabledCollectors.has(b.id);
                if (aActive === bActive) return 0; // Maintain original relative order
                return aActive ? -1 : 1; // Active first
              })
              .map((collector) => {
                const isActive = enabledCollectors.has(collector.id);
                const updating = isUpdating === collector.id;

                return (
                  <div
                    key={collector.id}
                    className={`bg-white rounded-2xl border p-5 transition-all flex items-center justify-between group
                    ${isActive
                        ? 'border-[var(--accent-primary)] shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <div className="flex items-center gap-5 flex-1">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm border border-gray-100 flex-shrink-0 transition-transform group-hover:scale-105">
                        <div className="scale-125">
                          {getLLMIcon(collector.id)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-[var(--text-headings)] tracking-tight">
                            {collector.name}
                          </h3>
                          <span className="text-[10px] font-bold text-[var(--text-caption)] uppercase tracking-wider px-2 py-0.5 bg-gray-100 rounded-md">
                            {collector.provider}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--accent-primary)] font-medium opacity-80 mb-0.5">
                          {collector.id === 'google_aio' ? 'Google SGE' : collector.provider}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-xl">
                          {collector.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 ml-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={`text-xs font-bold ${isActive ? 'text-green-600' : 'text-gray-500'} hidden sm:inline`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleToggleCollector(collector.id)}
                        disabled={updating !== false && updating !== null}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 ${isActive ? 'bg-[var(--accent-primary)]' : 'bg-gray-200'
                          } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`${isActive ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                        {updating && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <IconLoader2 size={12} className="animate-spin text-white" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </SettingsLayout>
    </Layout>
  );
};
