import { useState, useMemo, useCallback, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { ManagePromptsList } from '../components/Settings/ManagePromptsList';
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
import { RotateCcw, X, ChevronRight } from 'lucide-react';

// Configuration version type for prompts
type PromptChangeType = 'initial_setup' | 'prompt_added' | 'prompt_removed' | 'prompt_edited';



// Timeline Item Component for Prompts
interface PromptTimelineItemProps {
  config: PromptConfiguration;
  isActive: boolean;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
  prompts: Topic[];
  isLoading: boolean;
  onRevert?: () => void;
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (dateString: string) => {
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
  isSelected,
  isLast,
  onClick,
  prompts,
  isLoading,
  onRevert,
}: PromptTimelineItemProps) => {
  const totalPrompts = prompts.reduce((sum, topic) => sum + topic.prompts.length, 0);

  return (
    <div className="relative flex gap-6">
      {/* Timeline connector line */}
      {!isLast && (
        <div className="absolute left-[15px] top-12 bottom-0 w-0.5 bg-[var(--border-default)]" />
      )}

      {/* Version circle */}
      <div
        className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${
          isActive
            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
            : isSelected
            ? 'bg-[var(--accent-light)] border-[var(--accent-primary)]'
            : 'bg-white border-[var(--border-default)] hover:border-[var(--accent-primary)]'
        } transition-colors`}
      >
        <div className={`w-3 h-3 rounded-full ${isActive || isSelected ? 'bg-white' : 'bg-[var(--border-default)]'}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8 min-w-0">
        <button
          onClick={onClick}
          className={`w-full text-left bg-white border rounded-lg p-4 hover:shadow-md transition-all ${
            isSelected
              ? 'border-[var(--accent-primary)] shadow-sm'
              : 'border-[var(--border-default)]'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-base text-[var(--text-headings)]">
                  {isActive ? 'Current version' : `Version`} V{config.version}
                </span>
                {isActive && (
                  <span className="px-2 py-0.5 bg-[var(--success500)]/20 text-[var(--success500)] rounded text-xs font-medium">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-caption)] mb-2">
                {formatDateShort(config.created_at)}
              </p>
            </div>
            <ChevronRight 
              size={20} 
              className={`text-[var(--text-caption)] transition-transform flex-shrink-0 ${
                isSelected ? 'rotate-90' : ''
              }`} 
            />
          </div>
          {isSelected && (
            <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
              {!isActive && onRevert && (
                <div className="mb-3 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevert();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                  >
                    <RotateCcw size={16} />
                    Revert to this version
                  </button>
                </div>
              )}
              {isLoading ? (
                <p className="text-sm text-[var(--text-caption)]">Loading prompts...</p>
              ) : prompts.length === 0 ? (
                <p className="text-sm text-[var(--text-caption)]">No prompts in this version</p>
              ) : (
                <div className="space-y-3">
                  {prompts.map((topic) => (
                    <div key={topic.id} className="mb-3">
                      <h4 className="text-sm font-semibold text-[var(--text-headings)] mb-2">
                        {topic.name} ({topic.prompts.length})
                      </h4>
                      <div className="space-y-2 ml-2">
                        {topic.prompts.map((prompt) => (
                          <div
                            key={prompt.id}
                            className="p-3 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-body)] border border-[var(--border-default)]"
                          >
                            {prompt.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

// History Section Component for Prompts
interface PromptHistorySectionProps {
  history: PromptConfiguration[];
  currentVersion: number;
  selectedVersion: number | null;
  onVersionSelect: (version: number) => void;
  versionPrompts: Map<number, Topic[]>;
  loadingVersions: Set<number>;
}

const PromptHistorySection = ({
  history,
  currentVersion,
  selectedVersion,
  onVersionSelect,
  versionPrompts,
  loadingVersions,
}: PromptHistorySectionProps) => {
  // Sort history by version descending (most recent first)
  const sortedHistory = [...history].sort((a, b) => b.version - a.version);

  return (
    <div>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-[var(--text-body)] leading-relaxed">
          Past analyses are not affected by prompt changes. All historical data is preserved, and changes only apply to future analyses.
        </p>
      </div>

      {sortedHistory.length === 0 ? (
        <p className="text-sm text-[var(--text-caption)] text-center py-8">
          No configuration history available
        </p>
      ) : (
        <div className="space-y-0">
          {sortedHistory.map((config, index) => (
            <PromptTimelineItem
              key={config.id}
              config={config}
              isActive={config.version === currentVersion}
              isSelected={selectedVersion === config.version}
              isLast={index === sortedHistory.length - 1}
              onClick={() => onVersionSelect(config.version)}
              prompts={versionPrompts.get(config.version) || []}
              isLoading={loadingVersions.has(config.version)}
              onRevert={() => onRevertVersion(config.id)}
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
  selectedVersion: number | null;
  onVersionSelect: (version: number) => void;
  versionPrompts: Map<number, Topic[]>;
  loadingVersions: Set<number>;
  onRevertVersion: (versionId: string) => void;
}

const PromptHistoryModal = ({
  history,
  currentVersion,
  isOpen,
  onClose,
  selectedVersion,
  onVersionSelect,
  versionPrompts,
  loadingVersions,
  onRevertVersion,
}: PromptHistoryModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-headings)] mb-1">
              Configuration History
            </h2>
            <p className="text-sm text-[var(--text-caption)]">
              View and revert to previous prompt configurations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X size={24} className="text-[var(--text-caption)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <PromptHistorySection
            history={history}
            currentVersion={currentVersion}
            selectedVersion={selectedVersion}
            onVersionSelect={onVersionSelect}
            versionPrompts={versionPrompts}
            loadingVersions={loadingVersions}
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
    <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
            <IconHistory size={24} className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-headings)] mb-1">
              Configuration History
            </h3>
            <p className="text-sm text-[var(--text-caption)]">
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} • Can revert anytime
            </p>
          </div>
        </div>
        <button
          onClick={onViewTimeline}
          className="flex items-center gap-2 px-5 py-2.5 text-sm text-white bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors font-medium shadow-sm"
        >
          View Timeline
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export const ManagePrompts = () => {
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [configHistory, setConfigHistory] = useState<PromptConfiguration[]>([]);
  const [currentConfigVersion, setCurrentConfigVersion] = useState<number>(0);
  const [modalSelectedVersion, setModalSelectedVersion] = useState<number | null>(null);
  const [versionPrompts, setVersionPrompts] = useState<Map<number, Topic[]>>(new Map());
  const [loadingVersions, setLoadingVersions] = useState<Set<number>>(new Set());
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
    setModalSelectedVersion(null); // Reset selection when opening modal
  }, []);

  const handleCloseHistoryModal = useCallback(() => {
    setShowHistoryModal(false);
    setModalSelectedVersion(null); // Reset selection when closing modal
  }, []);

  const handleModalVersionSelect = useCallback(async (version: number) => {
    // Toggle selection if clicking the same version
    if (modalSelectedVersion === version) {
      setModalSelectedVersion(null);
      return;
    }

    setModalSelectedVersion(version);

    // If prompts already loaded, don't reload
    if (versionPrompts.has(version)) {
      return;
    }

    // Load version details
    if (!selectedBrandId) return;

    setLoadingVersions(prev => new Set(prev).add(version));

    try {
      const versionDetails = await getVersionDetails(selectedBrandId, version);
      setVersionPrompts(prev => {
        const newMap = new Map(prev);
        newMap.set(version, versionDetails.topics);
        return newMap;
      });
    } catch (err) {
      console.error('Error loading version details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load version details');
    } finally {
      setLoadingVersions(prev => {
        const newSet = new Set(prev);
        newSet.delete(version);
        return newSet;
      });
    }
  }, [modalSelectedVersion, versionPrompts, selectedBrandId]);

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
      
      // Clear cached version prompts since we've reverted
      setVersionPrompts(new Map());
      setModalSelectedVersion(null);
      
      setShowHistoryModal(false);
    } catch (err) {
      console.error('Error reverting version:', err);
      setError(err instanceof Error ? err.message : 'Failed to revert version');
    }
  }, [selectedBrandId, configHistory]);


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
                      Configuration version v{currentConfigVersion} • Created {currentConfig ? formatDateShort(currentConfig.created_at) : 'N/A'}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Prompts Card */}
              <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <IconForms size={20} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-headings)]">
                    Total Prompts
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--text-headings)]">
                  {summaryStats.totalPrompts}
                </div>
              </div>

              {/* Total Topics Card */}
              <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <IconTags size={20} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-headings)]">
                    Topics Covered
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--text-headings)]">
                  {summaryStats.totalTopics}
                </div>
              </div>

              {/* Coverage Card */}
              <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
                    <IconUmbrella size={20} className={`${getCoverageColor(summaryStats.coverage)}`} />
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-headings)]">
                    Coverage
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getCoverageColor(summaryStats.coverage)}`}>
                  {summaryStats.coverage.toFixed(1)}%
                </div>
              </div>

              {/* Visibility Score Card */}
              <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
                    <IconEye size={20} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="text-sm font-semibold text-[var(--text-headings)]">
                    Visibility Score
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--text-headings)]">
                  {summaryStats.avgVisibility.toFixed(1)}
                </div>
              </div>
            </div>
          </div>

          {/* Configuration History */}
          <div className="mb-6">
            <CompactHistoryCard
              history={configHistory}
              onViewTimeline={handleViewTimeline}
            />
          </div>

          <div>
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

          {/* History Modal */}
          <PromptHistoryModal
            history={configHistory}
            currentVersion={currentConfigVersion}
            isOpen={showHistoryModal}
            onClose={handleCloseHistoryModal}
            selectedVersion={modalSelectedVersion}
            onVersionSelect={handleModalVersionSelect}
            versionPrompts={versionPrompts}
            loadingVersions={loadingVersions}
            onRevertVersion={handleRevertVersion}
          />
            </>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};
