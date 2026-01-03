import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { useManualBrandDashboard } from '../manual-dashboard/useManualBrandDashboard';
import {
  getActiveCompetitors,
  addCompetitor,
  removeCompetitor,
  updateCompetitor,
  type ManagedCompetitor,
} from '../api/competitorManagementApi';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { IconUsers, IconPlus, IconX, IconTrash, IconEdit, IconExternalLink, IconLoader2 } from '@tabler/icons-react';

interface CompetitorRowProps {
  competitor: ManagedCompetitor;
  onRemove: () => void;
  onEdit: () => void;
}

const CompetitorRow = ({ competitor, onRemove, onEdit }: CompetitorRowProps) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.checked) {
      setIsToggling(true);
      try {
        await onRemove();
      } finally {
        setIsToggling(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-4 bg-white border border-[var(--border-default)] rounded-xl p-4 hover:shadow-sm transition-all group">
      {/* Logo */}
      <div className="flex-shrink-0">
        <SafeLogo
          domain={competitor.domain || competitor.url?.replace(/^https?:\/\//, '').split('/')[0]}
          src={competitor.logo}
          alt={competitor.name}
          className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-[var(--border-default)]"
          size={48}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="font-semibold text-[var(--text-headings)] truncate">
            {competitor.name}
          </h3>
          {competitor.url && (
            <a
              href={competitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-caption)] hover:text-[var(--accent-primary)] transition-colors"
            >
              <IconExternalLink size={14} />
            </a>
          )}
        </div>
        <div className="flex items-center gap-3">
          {competitor.industry && (
            <span className="text-sm text-[var(--text-caption)] truncate">
              {competitor.industry}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            competitor.relevance === 'Direct Competitor'
              ? 'bg-blue-100 text-blue-700'
              : competitor.relevance === 'Indirect Competitor'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {competitor.relevance || 'Competitor'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Toggle Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-caption)]">
            {isToggling ? 'Removing...' : 'Active'}
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={true}
              disabled={isToggling}
              onChange={handleToggle}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent-primary)]"></div>
          </label>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-2 text-[var(--text-caption)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
            title="Edit"
          >
            <IconEdit size={18} />
          </button>
          <button
            onClick={onRemove}
            className="p-2 text-[var(--text-caption)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const ManageCompetitors = () => {
  const { selectedBrandId, selectedBrand, brands, isLoading: brandsLoading, selectBrand } = useManualBrandDashboard();
  const [competitors, setCompetitors] = useState<ManagedCompetitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
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
      setCompetitors(data.competitors || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
      console.error('Error loading competitors:', err);
    } finally {
      setIsLoading(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competitor');
    }
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
        <div className="flex flex-col gap-6">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">Manage Competitors</h1>
                <p className="text-sm text-[var(--text-caption)] mt-1">Configure competitors to track alongside your brand</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-all shadow-sm"
              disabled={competitors.length >= 10}
            >
              <IconPlus size={18} />
              Add Competitor
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <IconX size={18} className="text-red-600" />
              </div>
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Main Content Area */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white border border-[var(--border-default)] rounded-xl">
              <IconLoader2 size={32} className="text-[var(--accent-primary)] animate-spin mb-4" />
              <p className="text-[var(--text-caption)] font-medium">Loading competitors...</p>
            </div>
          ) : competitors.length === 0 ? (
            <div className="bg-white border border-[var(--border-default)] rounded-xl p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-6">
                <IconUsers size={40} className="text-[var(--text-caption)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-headings)] mb-2">
                No competitors yet
              </h3>
              <p className="text-[var(--text-caption)] max-w-sm mx-auto mb-8">
                Add up to 10 competitors to track their market share and sentiment alongside your brand.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-all shadow-md font-medium"
              >
                Add Your First Competitor
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-sm font-semibold text-[var(--text-headings)] uppercase tracking-wider">
                  {competitors.length} Competitor{competitors.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-[var(--text-caption)]">
                  Maximum 10 competitors allowed
                </p>
              </div>
              <div className="space-y-3">
                {competitors.map((competitor) => (
                  <CompetitorRow
                    key={competitor.name}
                    competitor={competitor}
                    onRemove={() => handleRemoveCompetitor(competitor.name)}
                    onEdit={() => setEditingCompetitor(competitor)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Modals Section */}
          {/* Add Competitor Modal */}
          {showAddModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text-headings)]">
                      Add Competitor
                    </h2>
                    <p className="text-sm text-[var(--text-caption)] mt-1">Add a new competitor to track</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewCompetitor({ name: '', domain: '', url: '', industry: '', relevance: 'Direct Competitor' });
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <IconX size={24} className="text-[var(--text-caption)]" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Competitor Name *
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={newCompetitor.name}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                      placeholder="e.g., Competitor Inc"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
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
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                      placeholder="competitor.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={newCompetitor.industry}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, industry: e.target.value })}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                      placeholder="e.g., Software, E-commerce"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Relevance
                    </label>
                    <select
                      value={newCompetitor.relevance}
                      onChange={(e) => setNewCompetitor({ ...newCompetitor, relevance: e.target.value as any })}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50 appearance-none"
                    >
                      <option value="Direct Competitor">Direct Competitor</option>
                      <option value="Indirect Competitor">Indirect Competitor</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewCompetitor({ name: '', domain: '', url: '', industry: '', relevance: 'Direct Competitor' });
                    }}
                    className="flex-1 px-4 py-3 border border-[var(--border-default)] rounded-xl hover:bg-gray-50 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCompetitor}
                    disabled={!newCompetitor.name.trim() || competitors.length >= 10}
                    className="flex-1 px-4 py-3 bg-[var(--accent-primary)] text-white rounded-xl hover:bg-[var(--accent-primary)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-semibold"
                  >
                    Add Competitor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Competitor Modal */}
          {editingCompetitor && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text-headings)]">
                      Edit Competitor
                    </h2>
                    <p className="text-sm text-[var(--text-caption)] mt-1">Update competitor details</p>
                  </div>
                  <button
                    onClick={() => setEditingCompetitor(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <IconX size={24} className="text-[var(--text-caption)]" />
                  </button>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Competitor Name
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.name}
                      disabled
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl bg-gray-100 text-[var(--text-caption)] cursor-not-allowed font-medium"
                    />
                    <p className="text-[10px] text-[var(--text-caption)] mt-1.5 ml-1">Name cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Domain or URL
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.domain || editingCompetitor.url || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditingCompetitor({
                          ...editingCompetitor,
                          domain: value.includes('.') ? value : undefined,
                          url: value.startsWith('http') ? value : (value ? `https://${value}` : undefined),
                        });
                      }}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Industry
                    </label>
                    <input
                      type="text"
                      value={editingCompetitor.industry || ''}
                      onChange={(e) => setEditingCompetitor({ ...editingCompetitor, industry: e.target.value })}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-headings)] mb-2">
                      Relevance
                    </label>
                    <select
                      value={editingCompetitor.relevance}
                      onChange={(e) => setEditingCompetitor({ ...editingCompetitor, relevance: e.target.value as any })}
                      className="w-full px-4 py-3 border border-[var(--border-default)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50 appearance-none"
                    >
                      <option value="Direct Competitor">Direct Competitor</option>
                      <option value="Indirect Competitor">Indirect Competitor</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button
                    onClick={() => setEditingCompetitor(null)}
                    className="flex-1 px-4 py-3 border border-[var(--border-default)] rounded-xl hover:bg-gray-50 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateCompetitor(editingCompetitor)}
                    className="flex-1 px-4 py-3 bg-[var(--accent-primary)] text-white rounded-xl hover:bg-[var(--accent-primary)]/90 transition-all shadow-lg font-semibold"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};
