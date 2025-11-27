import { useState, useMemo, useCallback, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { ManagePromptsList } from '../components/Settings/ManagePromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { topicsToConfiguration } from '../utils/promptConfigAdapter';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import {
  getActivePrompts,
  getVersionHistory,
  getVersionDetails,
  revertToVersion,
  type Prompt,
  type Topic,
  type PromptConfiguration,
} from '../api/promptManagementApi';
import { IconForms, IconTags, IconUmbrella, IconEye, IconHistory, IconInfoCircle } from '@tabler/icons-react';
import { Eye, RotateCcw, GitCompare, X } from 'lucide-react';
import type { PromptEntry } from '../types/prompts';

// Configuration version type for prompts
type PromptChangeType = 'initial_setup' | 'prompt_added' | 'prompt_removed' | 'prompt_edited';

// Convert Prompt to PromptEntry format for ResponseViewer
const convertPromptToEntry = (prompt: Prompt, topicName: string): PromptEntry => {
  return {
    id: prompt.id.toString(),
    queryId: null,
    collectorResultId: null,
    question: prompt.text,
    topic: topicName,
    collectorTypes: [],
    latestCollectorType: null,
    lastUpdated: prompt.lastUpdated,
    response: prompt.response || null,
    volumePercentage: prompt.volume,
    volumeCount: 0,
    sentimentScore: prompt.sentiment,
    visibilityScore: prompt.visibilityScore ?? null,
    highlights: {
      brand: prompt.keywords.brand || [],
      products: prompt.keywords.target || [], // Map target to products
      keywords: prompt.keywords.top || [], // Map top to keywords
      competitors: [] // Competitors not available in Prompt type
    }
  };
};


// Timeline Item Component for Prompts
interface PromptTimelineItemProps {
  config: PromptConfiguration;
  isActive: boolean;
  isLast: boolean;
  onView: () => void;
  onRevert: () => void;
  onCompare: () => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
  });
};

const PromptTimelineItem = ({
  config,
  isActive,
  isLast,
  onView,
  onRevert,
  onCompare,
}: PromptTimelineItemProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const totalPrompts = config.topics.reduce((sum, topic) => sum + topic.prompts.length, 0);

  return (
    <div className="relative flex gap-4">
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-[var(--border-default)]" />
      )}

      {/* Version circle */}
      <div
        className={`relative z-10 flex-shrink-0 w-6 h-6 rounded-full border-2 ${
          isActive
            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
            : 'bg-white border-[var(--border-default)]'
        }`}
      />

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="bg-white border border-[var(--border-default)] rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--text-headings)]">
                  v{config.version}
                </span>
                {isActive && (
                  <span className="px-2 py-0.5 bg-[var(--success500)]/20 text-[var(--success500)] rounded text-xs font-medium">
                    Active
                  </span>
                )}
                <span className="text-sm text-[var(--text-caption)]">
                  {formatDate(config.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--text-body)] mb-2">
                {config.change_summary}
              </p>
              <p className="text-xs text-[var(--text-caption)]">
                {config.topics.length} topics • {totalPrompts} prompts • Used by {config.analysis_count} analyses
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onView}
                className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                title="View details"
              >
                <Eye size={16} className="text-[var(--text-caption)]" />
              </button>
              {!isActive && (
                <>
                  <button
                    onClick={onRevert}
                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                    title="Revert to this version"
                  >
                    <RotateCcw size={16} className="text-[var(--text-caption)]" />
                  </button>
                  <button
                    onClick={onCompare}
                    className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
                    title="Compare with current"
                  >
                    <GitCompare size={16} className="text-[var(--text-caption)]" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-[var(--border-default)]">
              <div className="flex flex-wrap gap-2">
                {config.topics.map((topic) => (
                  <span
                    key={topic.id}
                    className="px-2 py-1 bg-[var(--bg-secondary)] rounded text-xs text-[var(--text-body)]"
                  >
                    {topic.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 text-xs text-[var(--accent-primary)] hover:underline"
          >
            {isExpanded ? 'Show less' : 'Show topics'}
          </button>
        </div>
      </div>
    </div>
  );
};

// History Section Component for Prompts
interface PromptHistorySectionProps {
  history: PromptConfiguration[];
  currentVersion: number;
  onViewVersion: (config: PromptConfiguration) => void;
  onRevertVersion: (versionId: string) => void;
  onCompareVersion: (config: PromptConfiguration) => void;
}

const PromptHistorySection = ({
  history,
  currentVersion,
  onViewVersion,
  onRevertVersion,
  onCompareVersion,
}: PromptHistorySectionProps) => {
  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-[var(--text-headings)] mb-4">
        Configuration History
      </h2>

      <div className="mb-4 p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-default)]">
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          Past analyses are not affected by prompt changes. All historical data is preserved, and changes only apply to future analyses.
        </p>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)] text-center py-8">
          No configuration history available
        </p>
      ) : (
        <div className="space-y-0">
          {history.map((config, index) => (
            <PromptTimelineItem
              key={config.id}
              config={config}
              isActive={config.version === currentVersion}
              isLast={index === history.length - 1}
              onView={() => onViewVersion(config)}
              onRevert={() => onRevertVersion(config.id)}
              onCompare={() => onCompareVersion(config)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// History Modal Component for Prompts
interface PromptHistoryModalProps {
  history: PromptConfiguration[];
  currentVersion: number;
  isOpen: boolean;
  onClose: () => void;
  onViewVersion: (config: PromptConfiguration) => void;
  onRevertVersion: (versionId: string) => void;
  onCompareVersion: (config: PromptConfiguration) => void;
}

const PromptHistoryModal = ({
  history,
  currentVersion,
  isOpen,
  onClose,
  onViewVersion,
  onRevertVersion,
  onCompareVersion,
}: PromptHistoryModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)]">
          <h2 className="text-2xl font-semibold text-[var(--text-headings)]">
            Configuration History
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <X size={24} className="text-[var(--text-caption)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <PromptHistorySection
            history={history}
            currentVersion={currentVersion}
            onViewVersion={onViewVersion}
            onRevertVersion={onRevertVersion}
            onCompareVersion={onCompareVersion}
          />
        </div>
      </div>
    </div>
  );
};

// Compact Configuration History Component
// This component displays a compact view of configuration history
interface CompactHistoryCardProps {
  history: PromptConfiguration[];
  onViewTimeline: () => void;
}

const CompactHistoryCard = ({
  history,
  onViewTimeline,
}: CompactHistoryCardProps) => {
  const versionCount = history.length;

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
            <IconHistory size={20} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-headings)]">
              Configuration History
            </h3>
            <p className="text-xs text-[var(--text-caption)]">
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} • Can revert anytime
            </p>
          </div>
        </div>
        <button
          onClick={onViewTimeline}
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--accent-primary)] hover:bg-[var(--accent-light)] rounded-lg transition-colors font-medium"
        >
          View Timeline
          <span>→</span>
        </button>
      </div>
    </div>
  );
};

export const ManagePrompts = () => {
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');
  const [dateRange, setDateRange] = useState('30d');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [configHistory, setConfigHistory] = useState<PromptConfiguration[]>([]);
  const [currentConfigVersion, setCurrentConfigVersion] = useState<number>(0);
  const [summaryStats, setSummaryStats] = useState({
    totalPrompts: 0,
    totalTopics: 0,
    coverage: 0,
    avgVisibility: 0,
    avgSentiment: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch active prompts and version history
  useEffect(() => {
    if (!selectedBrandId || brandsLoading) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch active prompts
        const promptsData = await getActivePrompts(selectedBrandId);
        setTopics(promptsData.topics);
        setCurrentConfigVersion(promptsData.currentVersion);
        setSummaryStats({
          totalPrompts: promptsData.summary.totalPrompts,
          totalTopics: promptsData.summary.totalTopics,
          coverage: promptsData.summary.coverage,
          avgVisibility: promptsData.summary.avgVisibility || 0,
          avgSentiment: promptsData.summary.avgSentiment || 0,
        });

        // Fetch version history
        const historyData = await getVersionHistory(selectedBrandId);
        setConfigHistory(historyData.versions);
        setCurrentConfigVersion(historyData.currentVersion);
      } catch (err) {
        console.error('Error fetching prompts data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load prompts');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedBrandId, brandsLoading]);
  
  // Load version details when a version is selected
  const [versionTopics, setVersionTopics] = useState<Topic[]>([]);
  useEffect(() => {
    if (selectedVersion === null || !selectedBrandId) {
      setVersionTopics([]);
      return;
    }

    const loadVersionDetails = async () => {
      try {
        const versionDetails = await getVersionDetails(selectedBrandId, selectedVersion);
        setVersionTopics(versionDetails.topics);
      } catch (err) {
        console.error('Error loading version details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load version details');
      }
    };

    loadVersionDetails();
  }, [selectedVersion, selectedBrandId]);

  // Get topics for selected version, or current topics if no version selected
  const displayedTopics = useMemo(() => {
    if (selectedVersion === null) {
      return topics;
    }
    return versionTopics.length > 0 ? versionTopics : topics;
  }, [selectedVersion, versionTopics, topics]);

  // Convert topics to configuration format for summary stats
  const currentConfig = useMemo(() => {
    return topicsToConfiguration(topics, summaryStats.coverage, summaryStats.avgVisibility);
  }, [topics, summaryStats]);

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-[var(--success500)]';
    if (coverage >= 70) return 'text-[var(--text-warning)]';
    return 'text-[var(--dataviz-4)]';
  };

  const handlePromptSelect = (prompt: Prompt, topicName: string) => {
    setSelectedPrompt(prompt);
    setSelectedTopicName(topicName);
  };

  const handlePromptEdit = useCallback((prompt: Prompt, newText: string) => {
    setTopics(prevTopics => 
      prevTopics.map(topic => ({
        ...topic,
        prompts: topic.prompts.map(p => 
          p.id === prompt.id ? { ...p, text: newText } : p
        )
      }))
    );
    
    // Update selected prompt if it's the one being edited
    if (selectedPrompt?.id === prompt.id) {
      setSelectedPrompt({ ...selectedPrompt, text: newText });
    }
  }, [selectedPrompt]);

  const handlePromptDelete = useCallback((prompt: Prompt) => {
    setTopics(prevTopics => 
      prevTopics.map(topic => ({
        ...topic,
        prompts: topic.prompts.filter(p => p.id !== prompt.id)
      })).filter(topic => topic.prompts.length > 0) // Remove topics with no prompts
    );
    
    // Clear selection if deleted prompt was selected
    if (selectedPrompt?.id === prompt.id) {
      setSelectedPrompt(null);
    }
  }, [selectedPrompt]);

  const handlePromptAdd = useCallback((topicId: number, promptText: string) => {
    // Find the topic and create a new prompt
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    // Generate a new ID (simple approach - use max ID + 1)
    const maxId = Math.max(...topics.flatMap(t => t.prompts.map(p => p.id)), 0);
    const newPrompt: Prompt = {
      id: maxId + 1,
      text: promptText,
      response: '', // Empty response for new prompts
      lastUpdated: new Date().toISOString().split('T')[0],
      sentiment: 3, // Default neutral sentiment
      volume: 0, // Default volume
      keywords: {
        brand: [],
        target: [],
        top: []
      }
    };

    setTopics(prevTopics =>
      prevTopics.map(t =>
        t.id === topicId
          ? { ...t, prompts: [...t.prompts, newPrompt] }
          : t
      )
    );
  }, [topics]);

  const handleChangesApplied = useCallback(async () => {
    // Reload data after changes are applied
    if (!selectedBrandId) return;
    
    try {
      const promptsData = await getActivePrompts(selectedBrandId);
      setTopics(promptsData.topics);
      setCurrentConfigVersion(promptsData.currentVersion);
      setSummaryStats({
        totalPrompts: promptsData.summary.totalPrompts,
        totalTopics: promptsData.summary.totalTopics,
        coverage: promptsData.summary.coverage,
        avgVisibility: promptsData.summary.avgVisibility || 0,
        avgSentiment: promptsData.summary.avgSentiment || 0,
      });
      
      const historyData = await getVersionHistory(selectedBrandId);
      setConfigHistory(historyData.versions);
    } catch (err) {
      console.error('Error reloading data after changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload data');
    }
  }, [selectedBrandId]);

  const handleTopicsReplace = useCallback((newTopics: Topic[]) => {
    setTopics(newTopics);
  }, []);

  const handleViewTimeline = useCallback(() => {
    setShowHistoryModal(true);
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setShowHistoryModal(false);
  }, []);

  const handleViewVersion = useCallback((config: PromptConfiguration) => {
    // TODO: Implement view version functionality
    console.log('View version:', config);
  }, []);

  const handleRevertVersion = useCallback(async (versionId: string) => {
    if (!selectedBrandId) return;
    
    try {
      const config = configHistory.find(c => c.id === versionId);
      if (!config) return;

      await revertToVersion(selectedBrandId, config.version, 'Reverted via UI');
      
      // Reload data after revert
      const promptsData = await getActivePrompts(selectedBrandId);
      setTopics(promptsData.topics);
      setCurrentConfigVersion(promptsData.currentVersion);
      
      const historyData = await getVersionHistory(selectedBrandId);
      setConfigHistory(historyData.versions);
      
      setShowHistoryModal(false);
    } catch (err) {
      console.error('Error reverting version:', err);
      setError(err instanceof Error ? err.message : 'Failed to revert version');
    }
  }, [selectedBrandId, configHistory]);

  const handleCompareVersion = useCallback((config: PromptConfiguration) => {
    // TODO: Implement compare version functionality
    console.log('Compare version:', config);
  }, []);

  const handleVersionChange = useCallback((version: number | null) => {
    setSelectedVersion(version);
  }, []);

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Manage Prompts
            </h1>
            <p className="text-[var(--text-caption)]">
              View and manage your tracked prompts grouped by topic
            </p>
          </div>

          {/* Prompt Coverage Summary */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="mb-6 p-8 text-center">
              <p className="text-[var(--text-caption)]">Loading prompts...</p>
            </div>
          ) : (
            <>
          <div className="mb-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-1">
                Prompt Coverage Summary
              </h3>
              {currentConfigVersion > 0 && configHistory.length > 0 && (() => {
                const currentConfig = configHistory.find(c => c.is_active) || configHistory[0];
                return (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[var(--text-caption)]">
                      Configuration version v{currentConfigVersion} • Created {currentConfig ? formatDate(currentConfig.created_at) : 'N/A'}
                    </p>
                    <div className="relative group">
                      <IconInfoCircle 
                        size={16} 
                        className="text-[var(--accent-primary)] cursor-help" 
                      />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-[var(--text-headings)] text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                        Configuration versions track changes to your prompt setup. Each time you add, remove, or edit prompts, a new version is created. Past analyses remain unchanged, and you can revert to any previous version at any time.
                        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[var(--text-headings)]"></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="grid grid-cols-10 gap-6">
              <div className="col-span-6">
                <div className="flex flex-wrap gap-4">
                  {/* Total Prompts Card */}
                  <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 flex-1 min-w-[200px] hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                        <IconForms size={20} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-headings)]">
                        Total Prompts
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-[var(--text-headings)] text-center">
                      {summaryStats.totalPrompts}
                    </div>
                  </div>

                  {/* Total Topics Card */}
                  <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 flex-1 min-w-[200px] hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                        <IconTags size={20} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-headings)]">
                        Topics Covered
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-[var(--text-headings)] text-center">
                      {summaryStats.totalTopics}
                    </div>
                  </div>

                  {/* Coverage Card */}
                  <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 flex-1 min-w-[200px] hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
                        <IconUmbrella size={20} className={`${getCoverageColor(summaryStats.coverage)}`} />
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-headings)]">
                        Coverage
                      </div>
                    </div>
                    <div className={`text-3xl font-bold ${getCoverageColor(summaryStats.coverage)} text-center`}>
                      {summaryStats.coverage.toFixed(1)}%
                    </div>
                  </div>

                  {/* Visibility Score Card */}
                  <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 flex-1 min-w-[200px] hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                        <IconEye size={20} className="text-[var(--accent-primary)]" />
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-headings)]">
                        Visibility Score
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-[var(--text-headings)] text-center">
                      {summaryStats.avgVisibility.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Configuration History */}
          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-6">
              <CompactHistoryCard
                history={configHistory}
                onViewTimeline={handleViewTimeline}
              />
            </div>
          </div>

          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-6">
              <ManagePromptsList
                brandId={selectedBrandId || ''}
                topics={displayedTopics}
                selectedPromptId={selectedPrompt?.id || null}
                onPromptSelect={handlePromptSelect}
                onPromptEdit={handlePromptEdit}
                onPromptDelete={handlePromptDelete}
                onPromptAdd={handlePromptAdd}
                onTopicsReplace={handleTopicsReplace}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onChangesApplied={handleChangesApplied}
                currentConfigVersion={currentConfigVersion}
                configHistory={configHistory}
                selectedVersion={selectedVersion}
                onVersionChange={handleVersionChange}
              />
            </div>

            <div className="col-span-4">
              <ResponseViewer 
                prompt={selectedPrompt && selectedTopicName 
                  ? convertPromptToEntry(selectedPrompt, selectedTopicName) 
                  : null} 
              />
            </div>
          </div>

          {/* History Modal */}
          <PromptHistoryModal
            history={configHistory}
            currentVersion={currentConfigVersion}
            isOpen={showHistoryModal}
            onClose={handleCloseHistoryModal}
            onViewVersion={handleViewVersion}
            onRevertVersion={handleRevertVersion}
            onCompareVersion={handleCompareVersion}
          />
            </>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};
