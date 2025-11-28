import { useState, useMemo, useCallback, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { ManagePromptsList } from '../components/Settings/ManagePromptsList';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import {
  getActivePrompts,
  getVersionHistory,
  getVersionDetails,
  type Prompt,
  type Topic,
  type PromptConfiguration,
} from '../api/promptManagementApi';
import { IconForms, IconTags, IconUmbrella, IconEye, IconHistory, IconInfoCircle, IconHandClick } from '@tabler/icons-react';
import { X, ChevronRight, Plus } from 'lucide-react';
import { useTopicConfiguration } from './BrandSettings/hooks/useTopicConfiguration';
import { CurrentConfigCard } from './BrandSettings/components/CurrentConfigCard';
import { ActiveTopicsSection } from './BrandSettings/components/ActiveTopicsSection';
import { TopicEditModal } from './BrandSettings/components/TopicEditModal';
import { HistoryModal as TopicHistoryModal } from './BrandSettings/components/HistoryModal';
import { HowItWorksModal } from './BrandSettings/components/HowItWorksModal';
import type { Topic as ConfigTopic } from '../types/topic';
import type { TopicConfiguration as TopicConfigSnapshot } from './BrandSettings/types';

// Configuration version type for prompts
interface PromptTimelineItemProps {
  config: PromptConfiguration;
  isActive: boolean;
  isSelected: boolean;
  isLast: boolean;
  onClick: () => void;
  prompts: Topic[];
  isLoading: boolean;
}

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
}: PromptTimelineItemProps) => {
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
              Browse previous prompt configurations and their contents
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
              {versionCount} {versionCount === 1 ? 'version' : 'versions'} • Full history available
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

  const {
    currentConfig: topicConfig,
    history: topicHistory,
    changeImpact: topicChangeImpact,
    isLoading: topicConfigLoading,
    saveChanges: persistTopicChanges,
    discardChanges: discardTopicChanges,
  } = useTopicConfiguration(selectedBrandId);
  const [showTopicEditModal, setShowTopicEditModal] = useState(false);
  const [showTopicHistoryModal, setShowTopicHistoryModal] = useState(false);
  const [showTopicHowItWorks, setShowTopicHowItWorks] = useState(false);
  const [topicSelectedVersion, setTopicSelectedVersion] = useState<number | null>(null);
  const [topicModalInitialTopics, setTopicModalInitialTopics] = useState<ConfigTopic[]>([]);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Fetch active prompts and version history
  useEffect(() => {
    if (!selectedBrandId || brandsLoading) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log('🔄 Fetching prompts data for brand:', selectedBrandId);
        // Fetch active prompts
        const promptsData = await getActivePrompts(selectedBrandId);
        console.log('✅ Received prompts data:', {
          topicsCount: promptsData.topics?.length || 0,
          topics: promptsData.topics,
          currentVersion: promptsData.currentVersion,
          summary: promptsData.summary
        });
        
        setTopics(promptsData.topics || []);
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
        console.log('✅ Received version history:', {
          versionsCount: historyData.versions?.length || 0,
          currentVersion: historyData.currentVersion
        });
        setConfigHistory(historyData.versions || []);
        setCurrentConfigVersion(historyData.currentVersion);
      } catch (err) {
        console.error('❌ Error fetching prompts data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load prompts');
        // Set empty arrays on error to prevent showing stale data
        setTopics([]);
        setConfigHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedBrandId, brandsLoading]);

  useEffect(() => {
    if (topicConfig?.topics) {
      setTopicModalInitialTopics(topicConfig.topics);
    } else {
      setTopicModalInitialTopics([]);
    }
  }, [topicConfig]);
  
  // Load version details when a version is selected
  const [versionTopics, setVersionTopics] = useState<Topic[]>([]);
  const [loadingVersion, setLoadingVersion] = useState(false);
  useEffect(() => {
    if (selectedVersion === null || !selectedBrandId) {
      setVersionTopics([]);
      setLoadingVersion(false);
      return;
    }

    const loadVersionDetails = async () => {
      setLoadingVersion(true);
      setError(null);
      try {
        const versionDetails = await getVersionDetails(selectedBrandId, selectedVersion);
        setVersionTopics(versionDetails.topics);
      } catch (err) {
        console.error('Error loading version details:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load version details';
        setError(errorMessage);
        setVersionTopics([]);
      } finally {
        setLoadingVersion(false);
      }
    };

    loadVersionDetails();
  }, [selectedVersion, selectedBrandId]);

  // Get topics for selected version, or current topics if no version selected
  const displayedTopics = useMemo(() => {
    if (selectedVersion === null) {
      console.log('📊 Displayed topics (current):', { topicsCount: topics.length, topics });
      return topics;
    }
    // If loading, show current topics (or empty if no topics yet)
    if (loadingVersion) {
      console.log('📊 Displayed topics (loading version):', { topicsCount: topics.length });
      return topics;
    }
    // If version topics are loaded, use them; otherwise show current topics as fallback
    const result = versionTopics.length > 0 ? versionTopics : topics;
    console.log('📊 Displayed topics (version selected):', {
      selectedVersion,
      versionTopicsCount: versionTopics.length,
      topicsCount: topics.length,
      resultCount: result.length,
      result
    });
    return result;
  }, [selectedVersion, versionTopics, topics, loadingVersion]);

  const displayedTopicConfig = useMemo(() => {
    if (!topicConfig) {
      return null;
    }
    if (topicSelectedVersion === null) {
      return topicConfig;
    }
    return topicHistory.find(config => config.version === topicSelectedVersion) || topicConfig;
  }, [topicConfig, topicHistory, topicSelectedVersion]);

  const displayedTopicList = displayedTopicConfig?.topics ?? [];

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

  const handlePromptAdd = useCallback((topicId: number, prompt: Prompt) => {
    setTopics(prevTopics =>
      prevTopics.map(t =>
        t.id === topicId
          ? { ...t, prompts: [...t.prompts, prompt] }
          : t
      )
    );
  }, []);

  const handleTopicEditClick = useCallback(() => {
    if (topicConfig?.topics) {
      setTopicModalInitialTopics(topicConfig.topics);
    } else {
      setTopicModalInitialTopics([]);
    }
    setShowTopicEditModal(true);
  }, [topicConfig]);

  const handleTopicQuickRemove = useCallback((topicId: string) => {
    if (!topicConfig) return;
    const updatedTopics = topicConfig.topics.filter(t => t.id !== topicId);
    setTopicModalInitialTopics(updatedTopics);
    setShowTopicEditModal(true);
  }, [topicConfig]);

  const handleTopicModalSave = useCallback(
    async (updatedTopics: ConfigTopic[]) => {
      try {
        await persistTopicChanges(updatedTopics);
        setTopicError(null);
        setShowTopicEditModal(false);
        setTopicSelectedVersion(null);
      } catch (err) {
        console.error('Failed to save topics:', err);
        const message =
          err instanceof Error ? err.message : 'Failed to save topics. Please try again.';
        setTopicError(message);
      }
    },
    [persistTopicChanges]
  );

  const handleTopicModalCancel = useCallback(() => {
    discardTopicChanges();
    if (topicConfig?.topics) {
      setTopicModalInitialTopics(topicConfig.topics);
    } else {
      setTopicModalInitialTopics([]);
    }
    setShowTopicEditModal(false);
  }, [discardTopicChanges, topicConfig]);

  const handleTopicVersionChange = useCallback((version: number | null) => {
    setTopicSelectedVersion(version);
  }, []);

  const handleTopicTimelineSelect = useCallback((config: TopicConfigSnapshot) => {
    setTopicSelectedVersion(config.version);
    setShowTopicHistoryModal(false);
  }, []);

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
      
      // Clear selected prompt if it no longer exists in the updated topics
      if (selectedPrompt) {
        const promptStillExists = promptsData.topics.some(topic =>
          topic.prompts.some(p => p.id === selectedPrompt.id)
        );
        if (!promptStillExists) {
          setSelectedPrompt(null);
        }
      }
      
      // Reset version view to current after changes
      if (selectedVersion !== null && selectedVersion !== undefined) {
        setSelectedVersion(null);
      }
    } catch (err) {
      console.error('Error reloading data after changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload data');
    }
  }, [selectedBrandId, selectedPrompt, selectedVersion]);

  const handleViewTimeline = useCallback(() => {
    setShowHistoryModal(true);
    setModalSelectedVersion(null); // Reset selection when opening modal
  }, []);

  const handleTopicTimelineView = useCallback(() => {
    setShowTopicHistoryModal(true);
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


  const handleVersionChange = useCallback((version: number | null) => {
    setSelectedVersion(version);
  }, []);

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Prompts & Topics
            </h1>
            <p className="text-[var(--text-caption)]">
              Review topics, update their prompts, and keep configuration history aligned from one place.
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
                        Configuration versions track changes to your prompt setup. Each time you add, remove, or edit prompts, a new version is created. Past analyses remain unchanged, and you can review any previous version at any time.
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

          {/* Topics management */}
          <section className="mb-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[var(--text-headings)] mb-1">
                  Topics &amp; Queries
                </h2>
                <p className="text-sm text-[var(--text-caption)]">
                  Curate the topics powering your coverage and keep their queries in sync.
                </p>
              </div>
              <button
                onClick={() => setShowTopicHowItWorks(true)}
                className="inline-flex items-center gap-2 text-sm text-[var(--text-caption)] hover:text-[var(--accent-primary)] transition-colors group self-start"
                aria-label="Learn how topic configuration works"
              >
                <IconHandClick size={16} className="text-[var(--accent-primary)]" />
                <span className="relative inline-block">
                  See how it works
                  <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[var(--accent-primary)] transition-all duration-200 group-hover:w-full"></span>
                </span>
              </button>
            </div>

            {topicError && (
              <div className="mt-4 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{topicError}</p>
              </div>
            )}

            <div className="space-y-6 mt-4">
              {brandsLoading || topicConfigLoading ? (
                <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 text-sm text-[var(--text-caption)]">
                  Loading topic configuration...
                </div>
              ) : topicConfig ? (
                <>
                  <CurrentConfigCard
                    config={topicConfig}
                    history={topicHistory}
                    onEdit={handleTopicEditClick}
                    onViewTimeline={handleTopicTimelineView}
                  />
                  <ActiveTopicsSection
                    topics={displayedTopicList}
                    history={topicHistory}
                    currentVersion={topicConfig.version}
                    selectedVersion={topicSelectedVersion}
                    brandId={selectedBrandId || ''}
                    onEdit={handleTopicEditClick}
                    onRemoveTopic={handleTopicQuickRemove}
                    onVersionChange={handleTopicVersionChange}
                  />
                </>
              ) : (
                <div className="bg-white border border-[var(--border-default)] rounded-lg p-6 flex flex-col gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-1">
                      No topics configured yet
                    </h3>
                    <p className="text-sm text-[var(--text-caption)]">
                      Create a curated list of topics to organize prompts and drive consistent analyses.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={handleTopicEditClick}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                    >
                      <Plus size={16} />
                      Add Topics
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <div>
            <ManagePromptsList
              brandId={selectedBrandId || ''}
              topics={displayedTopics}
              selectedPromptId={selectedPrompt?.id || null}
              onPromptSelect={handlePromptSelect}
              onPromptEdit={handlePromptEdit}
              onPromptDelete={handlePromptDelete}
              onPromptAdd={handlePromptAdd}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              onChangesApplied={handleChangesApplied}
              currentConfigVersion={currentConfigVersion}
              configHistory={configHistory}
              selectedVersion={selectedVersion}
              onVersionChange={handleVersionChange}
              visibilityScore={summaryStats.avgVisibility || 0}
              coverage={summaryStats.coverage}
              isLoading={isLoading || loadingVersion}
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
          />

          {showTopicEditModal && (
            <TopicEditModal
              currentTopics={topicModalInitialTopics}
              onSave={handleTopicModalSave}
              onCancel={handleTopicModalCancel}
              changeImpact={topicChangeImpact}
              brandName="Your Brand"
              industry="Your Industry"
              currentVersion={topicConfig?.version}
            />
          )}

          {showTopicHistoryModal && topicConfig && (
            <TopicHistoryModal
              history={topicHistory}
              currentVersion={topicConfig.version}
              onClose={() => setShowTopicHistoryModal(false)}
              onSelectVersion={handleTopicTimelineSelect}
            />
          )}

          <HowItWorksModal
            isOpen={showTopicHowItWorks}
            onClose={() => setShowTopicHowItWorks(false)}
          />
            </>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};
