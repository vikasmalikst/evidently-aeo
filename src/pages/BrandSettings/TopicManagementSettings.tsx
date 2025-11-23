import { useState } from 'react';
import { Layout } from '../../components/Layout/Layout';
import { SettingsLayout } from '../../components/Settings/SettingsLayout';
import { useTopicConfiguration } from './hooks/useTopicConfiguration';
import { CurrentConfigCard } from './components/CurrentConfigCard';
import { ActiveTopicsSection } from './components/ActiveTopicsSection';
import { TopicEditModal } from './components/TopicEditModal';
import { HistoryModal } from './components/HistoryModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { IconHandClick } from '@tabler/icons-react';
import { useManualBrandDashboard } from '../../manual-dashboard';
import type { TopicConfiguration } from './types';

export const TopicManagementSettings = () => {
  const { selectedBrandId, isLoading: brandsLoading } = useManualBrandDashboard();

  const {
    currentConfig,
    history,
    changeImpact,
    isLoading,
    handleTopicChange,
    saveChanges,
    discardChanges,
    revertToVersion,
  } = useTopicConfiguration(selectedBrandId || '');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const handleEdit = () => {
    if (currentConfig) {
      handleTopicChange(currentConfig.topics);
      setShowEditModal(true);
    }
  };

  const handleConfirmChanges = async () => {
    setShowEditModal(false);
    try {
      await saveChanges();
      // Show success toast
    } catch (error) {
      // Show error toast
      console.error('Failed to save topics:', error);
    }
  };

  const handleCancel = () => {
    discardChanges();
    setShowEditModal(false);
  };

  const handleViewTimeline = () => {
    setShowHistoryModal(true);
  };

  const handleViewVersion = (config: TopicConfiguration) => {
    // Could open a modal or navigate to a detail view
    console.log('View version:', config);
  };

  const handleRevertVersion = async (versionId: string) => {
    try {
      await revertToVersion(versionId);
      setShowHistoryModal(false);
      // Show success toast
    } catch (error) {
      // Show error toast
      console.error('Failed to revert version:', error);
    }
  };

  const handleCompareVersion = (config: TopicConfiguration) => {
    // TODO: Implement comparison view
    console.log('Compare with:', config);
  };

  const handleRemoveTopic = (topicId: string) => {
    if (currentConfig) {
      const updatedTopics = currentConfig.topics.filter(t => t.id !== topicId);
      handleTopicChange(updatedTopics);
      setShowEditModal(true);
    }
  };

  const handleVersionChange = (version: number | null) => {
    setSelectedVersion(version);
  };

  const handleRestoreVersion = async () => {
    if (selectedVersion === null) return;
    
    const versionToRestore = history.find(c => c.version === selectedVersion);
    if (!versionToRestore) return;

    if (confirm(`Are you sure you want to restore version ${selectedVersion}? This will create a new configuration version with these topics.`)) {
      try {
        await revertToVersion(versionToRestore.id);
        setSelectedVersion(null);
        // Show success toast
      } catch (error) {
        // Show error toast
        console.error('Failed to restore version:', error);
      }
    }
  };

  // Get topics to display based on selected version
  const displayTopics = selectedVersion !== null
    ? history.find(c => c.version === selectedVersion)?.topics || currentConfig?.topics || []
    : currentConfig?.topics || [];

  if (brandsLoading || isLoading) {
    return (
      <Layout>
        <SettingsLayout>
          <div className="p-6 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4"></div>
              <p className="text-[var(--text-caption)]">Loading topic configuration...</p>
            </div>
          </div>
        </SettingsLayout>
      </Layout>
    );
  }

  if (!selectedBrandId) {
    return (
      <Layout>
        <SettingsLayout>
          <div className="p-6">
            <p className="text-[var(--text-caption)]">Please select a brand first.</p>
          </div>
        </SettingsLayout>
      </Layout>
    );
  }

  if (!currentConfig) {
    return (
      <Layout>
        <SettingsLayout>
          <div className="p-6">
            <p className="text-[var(--text-caption)]">No topic configuration found. Create your first topic configuration by adding topics.</p>
          </div>
        </SettingsLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6 pt-12 max-w-[1200px]">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
                  Topic Configuration
                </h1>
                <p className="text-[var(--text-caption)]">
                  Topics determine which queries your brand is measured against. Changes only affect future analyses.
                </p>
              </div>
              <button
                onClick={() => setShowHowItWorks(true)}
                className="flex items-center gap-2 text-sm text-[var(--text-caption)] hover:text-[var(--accent-primary)] transition-colors group ml-4 flex-shrink-0"
                aria-label="Learn how topic configuration works"
              >
                <IconHandClick size={16} className="text-[#498cf9]" />
                <span className="relative inline-block">
                  See how it works
                  <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[var(--accent-primary)] transition-all duration-200 group-hover:w-full"></span>
                </span>
              </button>
            </div>
          </div>

          {/* Section 1: Current Configuration Card */}
          <CurrentConfigCard
            config={currentConfig}
            history={history}
            onEdit={handleEdit}
            onViewTimeline={handleViewTimeline}
          />

          {/* Section 2: Active Topics */}
          <ActiveTopicsSection
            topics={displayTopics}
            history={history}
            currentVersion={currentConfig.version}
            selectedVersion={selectedVersion}
            brandId={selectedBrandId || ''}
            onEdit={handleEdit}
            onRemoveTopic={handleRemoveTopic}
            onVersionChange={handleVersionChange}
            onRestoreVersion={handleRestoreVersion}
          />

          {/* Edit Modal */}
          {showEditModal && (
            <TopicEditModal
              currentTopics={currentConfig.topics}
              onSave={handleConfirmChanges}
              onCancel={handleCancel}
              changeImpact={changeImpact}
              brandName="Your Brand" // TODO: Get from store/context
              industry="Technology" // TODO: Get from store/context
              currentVersion={currentConfig.version}
            />
          )}

          {/* History Modal */}
          {showHistoryModal && (
            <HistoryModal
              history={history}
              currentVersion={currentConfig.version}
              onClose={() => setShowHistoryModal(false)}
              onViewVersion={handleViewVersion}
              onRevertVersion={handleRevertVersion}
              onCompareVersion={handleCompareVersion}
            />
          )}

          {/* How It Works Modal */}
          <HowItWorksModal
            isOpen={showHowItWorks}
            onClose={() => setShowHowItWorks(false)}
          />
        </div>
      </SettingsLayout>
    </Layout>
  );
};
