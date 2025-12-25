import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { SettingsLayout } from '../../components/Settings/SettingsLayout';
import { ManagePromptsList } from '../../components/Settings/ManagePromptsList';
import { useManualBrandDashboard } from '../../manual-dashboard/useManualBrandDashboard';
import {
  getActivePrompts,
  getVersionHistory,
  getVersionDetails,
  applyBatchChanges,
  type Prompt,
  type Topic,
  type PromptConfiguration,
} from '../../api/promptManagementApi';
import { IconForms, IconTags, IconUmbrella, IconEye, IconHistory, IconInfoCircle, IconHandClick } from '@tabler/icons-react';
import { X, ChevronRight, Plus, ChevronDown } from 'lucide-react';
import { useTopicConfiguration } from '../BrandSettings/hooks/useTopicConfiguration';
import { CurrentConfigCard } from '../BrandSettings/components/CurrentConfigCard';
import { ActiveTopicsSection } from '../BrandSettings/components/ActiveTopicsSection';
import { TopicEditModal } from '../BrandSettings/components/TopicEditModal';
import { HistoryModal as TopicHistoryModal } from '../BrandSettings/components/HistoryModal';
import { HowItWorksModal } from '../BrandSettings/components/HowItWorksModal';
import { InlineTopicManager } from '../../components/Settings/InlineTopicManager';
import type { Topic as ConfigTopic, TopicCategory, TopicSource } from '../../types/topic';
import type { TopicConfiguration as TopicConfigSnapshot } from '../BrandSettings/types';
import { usePromptsManagement } from './hooks/usePromptsManagement';
import { formatDateWithYear } from '../../utils/dateFormatting';

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

const formatDateShort = formatDateWithYear;

const normalizeTopicName = (name: string) => name.trim().toLowerCase();
const generateTemporaryTopicId = () => Date.now() + Math.floor(Math.random() * 1000);

type InlineTopicMeta = {
  promptTopicId?: number;
  prompts: Prompt[];
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
  const [dateRange, setDateRange] = useState('30d');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [modalSelectedVersion, setModalSelectedVersion] = useState<number | null>(null);
  const [versionPrompts, setVersionPrompts] = useState<Map<number, Topic[]>>(new Map());
  const [loadingVersions, setLoadingVersions] = useState<Set<number>>(new Set());
  
  // Use prompts management hook
  const promptsManagement = usePromptsManagement(selectedBrandId, brandsLoading);
  
  const {
    topics,
    selectedPrompt,
    configHistory,
    currentConfigVersion,
    summaryStats,
    isLoading,
    error,
    handlePromptEdit,
    handlePromptDelete,
    handlePromptAdd,
    handlePromptSelect,
    refreshPrompts,
  } = promptsManagement;

  const {
    currentConfig: topicConfig,
    history: topicHistory,
    isLoading: topicConfigLoading,
    saveChanges: persistTopicChanges,
    discardChanges: discardTopicChanges,
  } = useTopicConfiguration(selectedBrandId);
  const [showTopicEditModal, setShowTopicEditModal] = useState(false);
  const [showTopicHistoryModal, setShowTopicHistoryModal] = useState(false);
  const [showTopicHowItWorks, setShowTopicHowItWorks] = useState(false);
  const [topicModalInitialTopics, setTopicModalInitialTopics] = useState<ConfigTopic[]>([]);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [topicDeleteModal, setTopicDeleteModal] = useState<{
    topicId: string;
    name: string;
    promptCount: number;
    prompts: Prompt[];
  } | null>(null);
  const [isDeletingTopic, setIsDeletingTopic] = useState(false);
  const [isUnifiedVersionMenuOpen, setIsUnifiedVersionMenuOpen] = useState(false);
  const versionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (versionMenuRef.current && !versionMenuRef.current.contains(event.target as Node)) {
        setIsUnifiedVersionMenuOpen(false);
      }
    };
    if (isUnifiedVersionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isUnifiedVersionMenuOpen]);

  useEffect(() => {
    console.log('🔄 topicConfig changed:', topicConfig);
    console.log('🔄 topicConfig.topics:', topicConfig?.topics);
    if (topicConfig?.topics) {
      console.log('🔄 Setting topicModalInitialTopics:', topicConfig.topics.map(t => ({ id: t.id, name: t.name })));
      setTopicModalInitialTopics(topicConfig.topics);
    } else {
      setTopicModalInitialTopics([]);
    }
  }, [topicConfig]);

  const activeTopicConfig = useMemo(() => {
    if (selectedVersion !== null && selectedVersion !== undefined) {
      return topicHistory.find(config => config.version === selectedVersion) || topicConfig;
    }
    return topicConfig;
  }, [selectedVersion, topicHistory, topicConfig]);

  const isTopicsReadOnly = selectedVersion !== null && selectedVersion !== undefined;

  const sortedConfigHistory = useMemo(
    () => [...configHistory].sort((a, b) => b.version - a.version),
    [configHistory]
  );

  const currentConfigEntry = useMemo(
    () => configHistory.find(config => config.version === currentConfigVersion),
    [configHistory, currentConfigVersion]
  );

  const selectedConfigMeta =
    selectedVersion !== null && selectedVersion !== undefined
      ? configHistory.find(config => config.version === selectedVersion)
      : currentConfigEntry;

  const versionButtonLabel =
    selectedVersion !== null && selectedVersion !== undefined
      ? `Viewing v${selectedVersion}`
      : `Current (v${currentConfigVersion ?? 0})`;

  const versionButtonCaption = selectedConfigMeta
    ? `${formatDateShort(selectedConfigMeta.created_at)} • ${selectedConfigMeta.change_summary}`
    : 'No configuration history yet';
  
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
      promptsManagement.setState(prev => ({ ...prev, error: null }));
      try {
        const versionDetails = await getVersionDetails(selectedBrandId, selectedVersion);
        setVersionTopics(versionDetails.topics);
      } catch (err) {
        console.error('Error loading version details:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load version details';
        promptsManagement.setState(prev => ({ ...prev, error: errorMessage }));
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


  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-[var(--success500)]';
    if (coverage >= 70) return 'text-[var(--text-warning)]';
    return 'text-[var(--dataviz-4)]';
  };

  const handlePromptSelectWithTopic = useCallback((prompt: Prompt, topicName: string) => {
    void topicName;
    handlePromptSelect(prompt);
  }, [handlePromptSelect]);

  // Compute inline topics and metadata BEFORE callbacks that depend on them
  const { inlineTopics, inlineTopicMeta } = useMemo(() => {
    console.log('📊 Computing inlineTopics...');
    console.log('📊 activeTopicConfig:', activeTopicConfig);
    console.log('📊 topics:', topics);
    console.log('📊 isTopicsReadOnly:', isTopicsReadOnly);
    
    const meta = new Map<string, InlineTopicMeta>();
    const inlineList: ConfigTopic[] = [];

    if (isTopicsReadOnly && activeTopicConfig) {
      console.log('📊 Using read-only mode with activeTopicConfig');
      activeTopicConfig.topics.forEach(topic => {
        // Ensure topic has a valid ID - check for 'NaN' string, undefined, null, or actual NaN
        const idValue = topic.id;
        const idStr = String(idValue);
        const isInvalidId = 
          idValue == null || 
          idValue === undefined || 
          idStr === 'NaN' || 
          idStr === 'undefined' || 
          idStr === 'null' ||
          (typeof idValue === 'number' && isNaN(idValue)) ||
          (idStr.trim() === '');
        const topicId = isInvalidId
          ? `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : String(idValue);
        
        console.log(`📊 Read-only topic: "${topic.name}", original ID: "${topic.id}", isInvalid: ${isInvalidId}, using: "${topicId}"`);
          
        inlineList.push({
          ...topic,
          id: topicId, // Ensure valid ID
          relevance: topic.relevance ?? 70,
        });
        const promptMatch = topics.find(p => normalizeTopicName(p.name) === normalizeTopicName(topic.name));
        meta.set(topicId, {
          promptTopicId: promptMatch?.id,
          prompts: promptMatch?.prompts ?? [],
        });
      });
      console.log('📊 Read-only inlineList:', inlineList);
      return { inlineTopics: inlineList, inlineTopicMeta: meta };
    }

    const configTopics = activeTopicConfig?.topics ?? [];
    console.log('📊 configTopics:', configTopics);
    const seenKeys = new Set<string>();

    configTopics.forEach(topic => {
      const key = normalizeTopicName(topic.name);
      console.log(`📊 Processing configTopic: "${topic.name}" (key: "${key}", id: "${topic.id}")`);
      
      // Ensure topic has a valid ID - check for 'NaN' string, undefined, null, or actual NaN
      const idValue = topic.id;
      const idStr = String(idValue);
      const isInvalidId = 
        idValue == null || 
        idValue === undefined || 
        idStr === 'NaN' || 
        idStr === 'undefined' || 
        idStr === 'null' ||
        (typeof idValue === 'number' && isNaN(idValue)) ||
        (idStr.trim() === '');
      const topicId = isInvalidId
        ? `topic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : String(idValue);
      
      console.log(`📊 Topic: "${topic.name}", original ID: "${topic.id}", isInvalid: ${isInvalidId}, using: "${topicId}"`);
      
      seenKeys.add(key);
      inlineList.push({
        ...topic,
        id: topicId, // Ensure valid ID
        category: topic.category, // Explicitly preserve category
        relevance: topic.relevance ?? 70,
      });
      const promptMatch = topics.find(p => normalizeTopicName(p.name) === key);
      meta.set(topicId, {
        promptTopicId: promptMatch?.id,
        prompts: promptMatch?.prompts ?? [],
      });
    });

    console.log('📊 After configTopics, inlineList:', inlineList);
    console.log('📊 seenKeys:', Array.from(seenKeys));

    topics.forEach(topic => {
      const key = normalizeTopicName(topic.name);
      console.log(`📊 Processing topic from prompts: "${topic.name}" (key: "${key}", already seen: ${seenKeys.has(key)})`);
      if (seenKeys.has(key)) {
        return;
      }
      // Try to find matching topic in config by name to preserve category
      const matchingConfigTopic = configTopics.find(
        ct => normalizeTopicName(ct.name) === key
      );
      const inlineId = `prompt-${topic.id}`;
      inlineList.push({
        id: inlineId,
        name: topic.name,
        source: 'custom',
        category: matchingConfigTopic?.category || undefined,
        relevance: matchingConfigTopic?.relevance ?? 70,
      });
      meta.set(inlineId, {
        promptTopicId: topic.id,
        prompts: topic.prompts,
      });
    });

    inlineList.sort((a, b) => a.name.localeCompare(b.name));
    
    // Final validation pass - ensure no NaN IDs
    const validatedList = inlineList.map((topic, index) => {
      const idValue = topic.id;
      const idStr = String(idValue);
      const isInvalidId = 
        idValue == null || 
        idValue === undefined || 
        idStr === 'NaN' || 
        idStr === 'undefined' || 
        idStr === 'null' ||
        (typeof idValue === 'number' && isNaN(idValue)) ||
        (idStr.trim() === '');
      if (isInvalidId) {
        const fixedId = `topic-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
        console.warn(`⚠️ Final validation: Fixed invalid ID "${topic.id}" (type: ${typeof topic.id}) -> "${fixedId}" for topic: "${topic.name}"`);
        return { ...topic, id: fixedId };
      }
      return { ...topic, id: String(idValue) }; // Ensure it's always a string
    });
    
    console.log('📊 Final inlineList (after sorting and validation):', validatedList);
    return { inlineTopics: validatedList, inlineTopicMeta: meta };
  }, [activeTopicConfig, isTopicsReadOnly, topics]);

  const syncPromptTopicsWithInline = useCallback((updatedInlineTopics: ConfigTopic[], metaMap: Map<string, InlineTopicMeta>) => {
    promptsManagement.setState(prev => {
      const renameMap = new Map<number, string>();
      updatedInlineTopics.forEach(topic => {
        const meta = metaMap.get(topic.id);
        if (meta?.promptTopicId) {
          renameMap.set(meta.promptTopicId, topic.name);
        }
      });
      let updatedPromptTopics = prev.topics.map(promptTopic => {
        const newName = renameMap.get(promptTopic.id);
        if (newName && newName !== promptTopic.name) {
          return { ...promptTopic, name: newName };
        }
        return promptTopic;
      });
      const existingNames = new Set(updatedPromptTopics.map(topic => normalizeTopicName(topic.name)));
      updatedInlineTopics.forEach(topic => {
        const meta = metaMap.get(topic.id);
        if (!meta?.promptTopicId && !existingNames.has(normalizeTopicName(topic.name))) {
          updatedPromptTopics = [
            ...updatedPromptTopics,
            {
              id: generateTemporaryTopicId(),
              name: topic.name,
              prompts: [],
            },
          ];
          existingNames.add(normalizeTopicName(topic.name));
        }
      });
      return { ...prev, topics: updatedPromptTopics };
    });
  }, [promptsManagement]);

  const handleInlineTopicsChange = useCallback(
    async (updatedTopics: ConfigTopic[]) => {
      if (isTopicsReadOnly) {
        return;
      }
      try {
        const topicsToSave: ConfigTopic[] = updatedTopics.map(topic => ({
          id: topic.id,
          name: topic.name,
          source: (topic.source as TopicSource) || 'custom',
          category: topic.category,
          relevance: topic.relevance ?? 70,
        }));
        await persistTopicChanges(topicsToSave);
        syncPromptTopicsWithInline(updatedTopics, inlineTopicMeta);
        setTopicError(null);
      } catch (err) {
        console.error('Failed to save topics:', err);
        setTopicError(err instanceof Error ? err.message : 'Failed to save topics');
        throw err;
      }
    },
    [isTopicsReadOnly, persistTopicChanges, syncPromptTopicsWithInline, inlineTopicMeta]
  );

  const handleTopicDeleteRequest = useCallback((topic: ConfigTopic) => {
    console.log('🗑️ handleTopicDeleteRequest called with topic:', topic);
    console.log('🗑️ isTopicsReadOnly:', isTopicsReadOnly);
    
    if (isTopicsReadOnly) {
      console.log('🗑️ Topics are read-only, exiting');
      return;
    }
    
    const normalizedName = normalizeTopicName(topic.name);
    console.log('🗑️ normalizedName:', normalizedName);
    
    const meta = inlineTopicMeta.get(topic.id) || inlineTopicMeta.get(`prompt-${topic.id}`);
    console.log('🗑️ meta:', meta);
    
    const fallbackPrompts =
      topics.find(promptTopic => normalizeTopicName(promptTopic.name) === normalizedName)?.prompts ?? [];
    console.log('🗑️ fallbackPrompts:', fallbackPrompts);
    
    const promptsForTopic = meta?.prompts?.length ? meta.prompts : fallbackPrompts;
    console.log('🗑️ promptsForTopic:', promptsForTopic);
    
    const modalData = {
      topicId: topic.id,
      name: topic.name,
      promptCount: promptsForTopic.length,
      prompts: promptsForTopic,
    };
    console.log('🗑️ Setting topicDeleteModal:', modalData);
    setTopicDeleteModal(modalData);
  }, [inlineTopicMeta, isTopicsReadOnly, topics]);
  
  // Debug: Log when this function is created - ensure it's always defined
  useEffect(() => {
    console.log('✅ handleTopicDeleteRequest defined:', !!handleTopicDeleteRequest);
    console.log('✅ handleTopicDeleteRequest type:', typeof handleTopicDeleteRequest);
  }, [handleTopicDeleteRequest]);

  const handleCancelTopicDeletion = useCallback(() => {
    setTopicDeleteModal(null);
  }, []);

  const handleConfirmTopicDeletion = useCallback(async () => {
    if (!topicDeleteModal || isDeletingTopic) {
      return;
    }
    if (!selectedBrandId) {
      setTopicError('Please select a brand before deleting topics.');
      return;
    }
    
    const topicIdToDelete = topicDeleteModal.topicId;
    const topicNameToDelete = topicDeleteModal.name;
    const remainingTopics = inlineTopics.filter(topic => topic.id !== topicIdToDelete);
    const promptsToDelete = topicDeleteModal.prompts ?? [];
    const missingIds = promptsToDelete.filter(prompt => !prompt.queryId);
    const deletablePrompts = promptsToDelete.filter(prompt => !!prompt.queryId);
    
    if (missingIds.length > 0) {
      setTopicError('Some prompts are missing identifiers. Please refresh the page and try again.');
      return;
    }
    
    setIsDeletingTopic(true);
    setTopicError(null);
    
    try {
      if (deletablePrompts.length > 0) {
        const removalChanges = deletablePrompts.map(prompt => ({
          id: prompt.queryId as string,
          text: prompt.text,
        }));
        const changeSummary = `Removed ${removalChanges.length} prompt${removalChanges.length === 1 ? '' : 's'} after deleting topic "${topicNameToDelete}"`;
        await applyBatchChanges(selectedBrandId, {
          added: [],
          removed: removalChanges,
          edited: [],
        }, changeSummary);
      }
      
      await handleInlineTopicsChange(remainingTopics);
      
      promptsManagement.setState(prev => ({
        ...prev,
        topics: prev.topics.filter(
          promptTopic => normalizeTopicName(promptTopic.name) !== normalizeTopicName(topicNameToDelete)
        ),
      }));
      
      setTopicDeleteModal(null);
      
      await refreshPrompts();
    } catch (err) {
      console.error('Failed to delete topic:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete topic';
      setTopicError(errorMessage);
    } finally {
      setIsDeletingTopic(false);
    }
  }, [topicDeleteModal, isDeletingTopic, selectedBrandId, inlineTopics, handleInlineTopicsChange, promptsManagement, refreshPrompts]);

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

  const handleTopicTimelineSelect = useCallback((config: TopicConfigSnapshot) => {
    setSelectedVersion(config.version);
    setShowTopicHistoryModal(false);
  }, [setSelectedVersion]);

  const handleChangesApplied = useCallback(async () => {
    // Reload data after changes are applied
    await refreshPrompts();
    
    // Reset version view to current after changes
    if (selectedVersion !== null && selectedVersion !== undefined) {
      setSelectedVersion(null);
    }
  }, [refreshPrompts, selectedVersion]);

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
                    setTopicError(err instanceof Error ? err.message : 'Failed to load version details');
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

          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-caption)]">
                Configuration Versions
              </p>
              <p className="text-base font-semibold text-[var(--text-headings)]">
                Prompts v{currentConfigVersion ?? 0} • Topics v{topicConfig?.version ?? 0}
              </p>
              <p className="text-xs text-[var(--text-caption)]">
                {selectedVersion !== null && selectedVersion !== undefined
                  ? `Viewing combined configuration snapshot v${selectedVersion}`
                  : 'Viewing current configuration'}
              </p>
            </div>
            {currentConfigVersion && configHistory.length > 0 && (
              <div className="relative" ref={versionMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUnifiedVersionMenuOpen(prev => !prev)}
                  className="flex items-center gap-3 px-4 py-2 border border-[var(--border-default)] rounded-xl bg-white hover:shadow-sm transition-all"
                >
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-caption)] mb-0.5">
                      Configuration
                    </p>
                    <p className="text-sm font-semibold text-[var(--text-headings)]">
                      {versionButtonLabel}
                    </p>
                    <p className="text-[11px] text-[var(--text-caption)] line-clamp-1 max-w-[200px]">
                      {versionButtonCaption}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-[var(--text-caption)] transition-transform ${isUnifiedVersionMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isUnifiedVersionMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-[var(--border-default)] rounded-2xl shadow-xl z-20 overflow-hidden">
                    <div className="p-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                      <p className="text-sm font-semibold text-[var(--text-headings)]">Select version</p>
                      <p className="text-xs text-[var(--text-caption)]">Switch between saved configurations</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <button
                        type="button"
                        className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                          selectedVersion === null ? 'bg-[var(--bg-secondary)]' : ''
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleVersionChange(null);
                          setIsUnifiedVersionMenuOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-[var(--text-headings)]">
                            Current (v{currentConfigVersion})
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success500)]/15 text-[var(--success500)] font-semibold">
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-caption)]">
                          {currentConfigEntry ? formatDateShort(currentConfigEntry.created_at) : 'Awaiting first version'}
                        </p>
                      </button>
                      {sortedConfigHistory
                        .filter(config => config.version !== currentConfigVersion)
                        .map(config => (
                          <button
                            key={config.id}
                            type="button"
                            className={`w-full text-left px-4 py-3 border-b border-[var(--border-default)] hover:bg-[var(--bg-secondary)] transition-colors ${
                              selectedVersion === config.version ? 'bg-[var(--bg-secondary)]' : 'bg-white'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleVersionChange(config.version === currentConfigVersion ? null : config.version);
                              setIsUnifiedVersionMenuOpen(false);
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-semibold text-[var(--text-headings)]">
                                Version v{config.version}
                              </span>
                              {config.version === currentConfigVersion && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--success500)]/15 text-[var(--success500)] font-semibold">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-caption)] mb-1">
                              {formatDateShort(config.created_at)}
                            </p>
                            <p className="text-xs text-[var(--text-body)] line-clamp-2">
                              {config.change_summary}
                            </p>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
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
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{topicError}</p>
              </div>
            )}

            {(() => {
              console.log('🔧 About to render InlineTopicManager');
              console.log('🔧 handleTopicDeleteRequest:', handleTopicDeleteRequest);
              console.log('🔧 typeof handleTopicDeleteRequest:', typeof handleTopicDeleteRequest);
              console.log('🔧 inlineTopics:', inlineTopics);
              return null;
            })()}

            <InlineTopicManager
              topics={inlineTopics}
              brandId={selectedBrandId}
              isLoading={brandsLoading || topicConfigLoading || isLoading}
              onTopicsChange={handleInlineTopicsChange}
              isReadOnly={isTopicsReadOnly}
              onTopicDeleteRequest={handleTopicDeleteRequest}
            />
          </section>

          <div>
            <ManagePromptsList
              brandId={selectedBrandId || ''}
              topics={displayedTopics}
              selectedPromptId={selectedPrompt?.id || null}
              onPromptSelect={handlePromptSelectWithTopic}
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
              showVersionSelector={false}
            />
          </div>

          {topicDeleteModal && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={handleCancelTopicDeletion}>
              <div
                className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
                  Delete "{topicDeleteModal.name}"?
                </h3>
                <p className="text-sm text-[var(--text-body)] mb-4">
                  Warning: {topicDeleteModal.promptCount > 0 ? `${topicDeleteModal.promptCount} prompt${topicDeleteModal.promptCount === 1 ? '' : 's'} associated with this topic will also be deleted.` : 'This topic does not have any prompts yet.'}{' '}
                  A fresh prompts and topics version will be created immediately after you confirm.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={handleCancelTopicDeletion}
                    className="px-4 py-2 rounded-lg border border-[var(--border-default)] text-sm font-medium text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmTopicDeletion}
                    disabled={isDeletingTopic}
                    className="px-4 py-2 rounded-lg bg-[var(--text-error)] text-white text-sm font-medium hover:bg-[var(--text-error)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeletingTopic ? 'Deleting...' : 'Delete topic'}
                  </button>
                </div>
              </div>
            </div>
          )}

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
