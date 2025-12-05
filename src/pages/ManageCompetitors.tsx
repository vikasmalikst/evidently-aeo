import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import {
  getActiveCompetitors,
  getCompetitorVersionHistory,
  addCompetitor,
  removeCompetitor,
  updateCompetitor,
  bulkUpdateCompetitors,
  type ManagedCompetitor,
  type CompetitorConfiguration,
  type VersionHistoryResponse,
} from '../api/competitorManagementApi';
import { IconUsers, IconHistory, IconPlus, IconX, IconTrash, IconEdit } from '@tabler/icons-react';
import { X as XIcon, Plus as PlusIcon } from 'lucide-react';

const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric',
  });
};

interface CompetitorCardProps {
  competitor: ManagedCompetitor;
  isSelected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
}

const CompetitorCard = ({ competitor, isSelected, onToggle, onRemove, onEdit }: CompetitorCardProps) => {
  return (
    <div
      className={`relative bg-white border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? 'border-[var(--accent-primary)] shadow-sm'
          : 'border-[var(--border-default)]'
      }`}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-1 ${
          isSelected
            ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
            : 'border-[var(--border-default)]'
        }`}>
          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
        </div>
        
        {competitor.logo && (
          <img
            src={competitor.logo}
            alt={competitor.name}
            className="w-12 h-12 rounded-lg object-contain flex-shrink-0"
            crossOrigin="anonymous"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        )}
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[var(--text-headings)] mb-1 truncate">
            {competitor.name}
          </h3>
          {competitor.industry && (
            <p className="text-sm text-[var(--text-caption)] mb-1">
              {competitor.industry}
            </p>
          )}
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
            competitor.relevance === 'Direct Competitor'
              ? 'bg-blue-100 text-blue-700'
              : competitor.relevance === 'Indirect Competitor'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {competitor.relevance || 'Competitor'}
          </span>
        </div>
        
        <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="p-1.5 text-[var(--text-caption)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded transition-colors"
            title="Edit competitor"
          >
            <IconEdit size={16} />
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-[var(--text-caption)] hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Remove competitor"
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ManageCompetitors = () => {
  const { selectedBrandId, selectedBrand } = useManualBrandDashboard();
  const [competitors, setCompetitors] = useState<ManagedCompetitor[]>([]);
  const [selectedCompetitors, setSelectedCompetitors] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryResponse | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<ManagedCompetitor | null>(null);
  const [newCompetitor, setNewCompetitor] = useState({
    name: '',
    domain: '',
    url: '',
    industry: '',
    relevance: 'Direct Competitor' as const,
  });

  const loadCompetitors = useCallback(async () => {
    if (!selectedBrandId) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getActiveCompetitors(selectedBrandId);
      setCompetitors(data.competitors);
      setCurrentVersion(data.currentVersion);
      setSelectedCompetitors(new Set(data.competitors.map(c => c.name.toLowerCase())));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
      console.error('Error loading competitors:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBrandId]);

  const loadVersionHistory = useCallback(async () => {
    if (!selectedBrandId) return;

    try {
      const history = await getCompetitorVersionHistory(selectedBrandId);
      setVersionHistory(history);
    } catch (err) {
      console.error('Error loading version history:', err);
    }
  }, [selectedBrandId]);

  useEffect(() => {
    loadCompetitors();
  }, [loadCompetitors]);

  const handleAddCompetitor = async () => {
    if (!selectedBrandId || !newCompetitor.name.trim()) return;

    try {
      const domain = newCompetitor.domain || newCompetitor.url?.replace(/^https?:\/\//, '').split('/')[0] || '';
      await addCompetitor(selectedBrandId, {
        name: newCompetitor.name.trim(),
        domain: domain || undefined,
        url: newCompetitor.url || (domain ? `https://${domain}` : undefined),
        industry: newCompetitor.industry || undefined,
        relevance: newCompetitor.relevance,
        logo: domain ? `https://logo.clearbit.com/${domain}` : undefined,
        source: 'custom',
      });
      
      setNewCompetitor({ name: '', domain: '', url: '', industry: '', relevance: 'Direct Competitor' });
      setShowAddModal(false);
      await loadCompetitors();
      await loadVersionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add competitor');
    }
  };

  const handleRemoveCompetitor = async (competitorName: string) => {
    if (!selectedBrandId) return;
    if (!confirm(`Are you sure you want to remove "${competitorName}"?`)) return;

    try {
      await removeCompetitor(selectedBrandId, competitorName);
      await loadCompetitors();
      await loadVersionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove competitor');
    }
  };

  const handleUpdateCompetitor = async (updates: Partial<ManagedCompetitor>) => {
    if (!selectedBrandId || !editingCompetitor) return;

    try {
      await updateCompetitor(selectedBrandId, editingCompetitor.name, updates);
      setEditingCompetitor(null);
      await loadCompetitors();
      await loadVersionHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competitor');
    }
  };

  const toggleCompetitor = (competitor: ManagedCompetitor) => {
    const key = competitor.name.toLowerCase();
    const newSelected = new Set(selectedCompetitors);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      if (newSelected.size >= 10) {
        alert('Maximum of 10 competitors allowed');
        return;
      }
      newSelected.add(key);
    }
    setSelectedCompetitors(newSelected);
  };

  if (!selectedBrandId) {
    return (
      <Layout>
        <SettingsLayout>
          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">Please select a brand to manage competitors.</p>
            </div>
          </div>
        </SettingsLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
                  Manage Competitors
                </h1>
                <p className="text-[var(--text-caption)]">
                  Add, remove, or update competitors for {selectedBrand?.name || 'your brand'}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowHistoryModal(true);
                    loadVersionHistory();
                  }}
                  className="flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  <IconHistory size={18} />
                  Version History
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors"
                  disabled={competitors.length >= 10}
                >
                  <IconPlus size={18} />
                  Add Competitor
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="bg-white border border-[var(--border-default)] rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--text-headings)]">
                    Current Version: V{currentVersion}
                  </p>
                  <p className="text-xs text-[var(--text-caption)] mt-1">
                    {competitors.length} competitor{competitors.length !== 1 ? 's' : ''} tracked
                  </p>
                </div>
                <div className="text-sm text-[var(--text-caption)]">
                  {selectedCompetitors.size} of {competitors.length} selected
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-[var(--text-caption)]">Loading competitors...</div>
            </div>
          ) : competitors.length === 0 ? (
            <div className="bg-white border border-[var(--border-default)] rounded-lg p-12 text-center">
              <IconUsers size={48} className="mx-auto mb-4 text-[var(--text-caption)]" />
              <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-2">
                No competitors yet
              </h3>
              <p className="text-[var(--text-caption)] mb-4">
                Add competitors to track their performance alongside your brand
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors"
              >
                Add Your First Competitor
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.map((competitor) => (
                <CompetitorCard
                  key={competitor.name}
                  competitor={competitor}
                  isSelected={selectedCompetitors.has(competitor.name.toLowerCase())}
                  onToggle={() => toggleCompetitor(competitor)}
                  onRemove={() => handleRemoveCompetitor(competitor.name)}
                  onEdit={() => setEditingCompetitor(competitor)}
                />
              ))}
            </div>
          )}

          {/* Add Competitor Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Add Competitor
                  </h2>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewCompetitor({ name: '', domain: '', url: '', industry: '', relevance: 'Direct Competitor' });
                    }}
                    className="text-[var(--text-caption)] hover:text-[var(--text-headings)]"
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Competitor Name *
                    </label>
                    <input
                      type="text"
                      value={newCompetitor.name}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      placeholder="e.g., Competitor Inc"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Domain or URL
                    </label>
                    <input
                      type="text"
                      value={newCompetitor.domain || newCompetitor.url}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value.includes('.')) {
                          setNewCompetitor({ ...newCompetitor, domain: value, url: value.startsWith('http') ? value : `https://${value}` });
                        } else {
                          setNewCompetitor({ ...newCompetitor, url: value, domain: '' });
                        }
                      }}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      placeholder="competitor.com or https://competitor.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={newCompetitor.industry}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, industry: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      placeholder="e.g., Software, E-commerce"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Relevance
                    </label>
                    <select
                      value={newCompetitor.relevance}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, relevance: e.target.value as any })}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                      <option value="Direct Competitor">Direct Competitor</option>
                      <option value="Indirect Competitor">Indirect Competitor</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewCompetitor({ name: '', domain: '', url: '', industry: '', relevance: 'Direct Competitor' });
                    }}
                    className="flex-1 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCompetitor}
                    disabled={!newCompetitor.name.trim() || competitors.length >= 10}
                    className="flex-1 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Competitor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Competitor Modal */}
          {editingCompetitor && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Edit Competitor
                  </h2>
                  <button
                    onClick={() => setEditingCompetitor(null)}
                    className="text-[var(--text-caption)] hover:text-[var(--text-headings)]"
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Competitor Name
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.name}
                      disabled
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg bg-[var(--bg-secondary)] text-[var(--text-caption)]"
                    />
                    <p className="text-xs text-[var(--text-caption)] mt-1">Name cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Domain or URL
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.domain || editingCompetitor.url || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleUpdateCompetitor({
                          domain: value.includes('.') ? value : undefined,
                          url: value.startsWith('http') ? value : (value ? `https://${value}` : undefined),
                        });
                      }}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.industry || ''}
                      onChange={(e) => handleUpdateCompetitor({ industry: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-headings)] mb-1">
                      Relevance
                    </label>
                    <select
                      value={editingCompetitor.relevance || 'Direct Competitor'}
                      onChange={(e) => handleUpdateCompetitor({ relevance: e.target.value })}
                      className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    >
                      <option value="Direct Competitor">Direct Competitor</option>
                      <option value="Indirect Competitor">Indirect Competitor</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setEditingCompetitor(null)}
                    className="flex-1 px-4 py-2 border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version History Modal */}
          {showHistoryModal && versionHistory && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-[var(--text-headings)]">
                    Version History
                  </h2>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="text-[var(--text-caption)] hover:text-[var(--text-headings)]"
                  >
                    <XIcon size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {versionHistory.versions.map((version, index) => (
                    <div
                      key={version.id}
                      className={`border rounded-lg p-4 ${
                        version.isActive
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]/10'
                          : 'border-[var(--border-default)]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">
                              Version {version.version}
                              {version.isActive && (
                                <span className="ml-2 px-2 py-0.5 bg-[var(--success500)]/20 text-[var(--success500)] rounded text-xs">
                                  Active
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--text-caption)] mb-2">
                            {formatDateShort(version.createdAt)}
                          </p>
                          {version.changeSummary && (
                            <p className="text-sm text-[var(--text-body)] mb-2">
                              {version.changeSummary}
                            </p>
                          )}
                          <p className="text-xs text-[var(--text-caption)]">
                            {version.competitorCount} competitor{version.competitorCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};





