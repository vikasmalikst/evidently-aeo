import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { getBrands, updateBrandStatus, getBrandStats, getBrandById, updateBrand, type BrandResponse, type BrandStats } from '../api/brandApi';
import { invalidateCache } from '../lib/apiCache';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { 
  IconBuildingStore, 
  IconPlus, 
  IconLoader2, 
  IconExternalLink, 
  IconCircleCheck, 
  IconAlertCircle,
  IconSearch,
  IconListCheck,
  IconQuestionMark,
  IconRobot,
  IconMessageCircle,
  IconEdit,
  IconX
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

const KPICard = ({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: any, loading?: boolean }) => (
  <div className="bg-white p-4 rounded-xl border border-[var(--border-default)] shadow-sm flex items-center gap-4">
    <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
      <Icon size={20} className="text-[var(--accent-primary)]" />
    </div>
    <div>
      <p className="text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">{title}</p>
      {loading ? (
        <div className="h-6 w-16 bg-gray-100 animate-pulse rounded mt-1" />
      ) : (
        <p className="text-lg font-bold text-[var(--text-headings)] mt-0.5">{value}</p>
      )}
    </div>
  </div>
);

interface EditableTagListProps {
  items: string[];
  onItemsChange: (items: string[]) => void;
  placeholder: string;
  colorClass: string;
  bgClass: string;
}

// Editable tag list component for synonyms and products
const EditableTagList = ({ items, onItemsChange, placeholder, colorClass, bgClass }: EditableTagListProps) => {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    if (newItem.trim() && !items.includes(newItem.trim())) {
      onItemsChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(items[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null && editingValue.trim()) {
      const updated = [...items];
      updated[editingIndex] = editingValue.trim();
      onItemsChange(updated);
      setEditingIndex(null);
      setEditingValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue('');
  };

  return (
    <div className="space-y-2">
      <div className="px-3 py-2 border border-[var(--border-default)] rounded-lg bg-gray-50/50 min-h-[2.5rem]">
        {items.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {items.map((item, index) => (
              <div key={index} className="inline-flex items-center gap-1">
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    className="px-2 py-0.5 text-xs border border-[var(--accent-primary)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] bg-white min-w-[80px]"
                    autoFocus
                  />
                ) : (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 ${bgClass} ${colorClass} rounded text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity`}
                    onDoubleClick={() => handleStartEdit(index)}
                    title="Double-click to edit"
                  >
                    {item}
                  </span>
                )}
                <button
                  onClick={() => handleRemove(index)}
                  className="p-0.5 hover:bg-red-100 rounded text-red-600 transition-colors"
                  title="Remove"
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-caption)] italic">No items. Add one below.</p>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-2 py-1.5 text-xs border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-white"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim() || items.includes(newItem.trim())}
          className="px-3 py-1.5 text-xs bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <IconPlus size={14} />
          Add
        </button>
      </div>
    </div>
  );
};

export const ManageBrands = () => {
  const [brands, setBrands] = useState<BrandResponse[]>([]);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<BrandResponse | null>(null);
  const [editingBrand, setEditingBrand] = useState<(BrandResponse & { brand_synonyms?: string[]; brand_products?: string[] }) | null>(null);
  const [isLoadingBrandData, setIsLoadingBrandData] = useState(false);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setIsStatsLoading(true);
    setError(null);
    try {
      // Invalidate existing cache for brands to ensure fresh data across the whole app
      invalidateCache('/brands');
      
      const [brandsRes, statsRes] = await Promise.all([
        getBrands(true),
        getBrandStats(true)
      ]);

      if (brandsRes.success && brandsRes.data) {
        // Sort brands: active first, then inactive
        const sortedBrands = [...brandsRes.data].sort((a, b) => {
          if (a.status === 'active' && b.status === 'inactive') return -1;
          if (a.status === 'inactive' && b.status === 'active') return 1;
          return a.name.localeCompare(b.name);
        });
        setBrands(sortedBrands);
        
        // Get active brand from local storage or first active
        const savedBrandId = localStorage.getItem('selectedBrandId');
        const brand = sortedBrands.find(b => b.id === savedBrandId) || sortedBrands.find(b => b.status === 'active');
        if (brand) setSelectedBrand(brand);
      } else {
        setError(brandsRes.error || 'Failed to load brands');
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      console.error('Error loading brand data:', err);
    } finally {
      setIsLoading(false);
      setIsStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async (brandId: string, currentStatus: 'active' | 'inactive') => {
    setUpdatingId(brandId);
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await updateBrandStatus(brandId, newStatus);
      if (response.success) {
        setBrands(prev => prev.map(b => b.id === brandId ? { ...b, status: newStatus } : b));
        // Refresh stats to reflect the status change
        const statsRes = await getBrandStats();
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
      } else {
        alert(response.error || 'Failed to update brand status');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update brand status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddBrand = () => {
    navigate('/onboarding');
  };

  const handleEditBrand = async (brand: BrandResponse) => {
    setIsLoadingBrandData(true);
    try {
      const response = await getBrandById(brand.id);
      if (response.success && response.data) {
        setEditingBrand({
          ...brand,
          brand_synonyms: response.data.brand_synonyms || [],
          brand_products: response.data.brand_products || []
        });
      } else {
        // If API doesn't return synonyms/products, initialize with empty arrays
        setEditingBrand({
          ...brand,
          brand_synonyms: [],
          brand_products: []
        });
      }
    } catch (err) {
      console.error('Error loading brand data:', err);
      // Still open modal with basic brand data
      setEditingBrand({
        ...brand,
        brand_synonyms: [],
        brand_products: []
      });
    } finally {
      setIsLoadingBrandData(false);
    }
  };

  const handleUpdateBrand = async () => {
    if (!editingBrand) return;

    try {
      const updates: {
        homepage_url?: string;
        industry?: string;
        brand_synonyms?: string[];
        brand_products?: string[];
      } = {};

      if (editingBrand.homepage_url !== undefined) {
        updates.homepage_url = editingBrand.homepage_url;
      }
      if (editingBrand.industry !== undefined) {
        updates.industry = editingBrand.industry;
      }
      if (editingBrand.brand_synonyms !== undefined) {
        updates.brand_synonyms = editingBrand.brand_synonyms;
      }
      if (editingBrand.brand_products !== undefined) {
        updates.brand_products = editingBrand.brand_products;
      }

      const response = await updateBrand(editingBrand.id, updates);
      if (response.success) {
        setEditingBrand(null);
        await loadData(); // Reload brands list
      } else {
        setError(response.error || 'Failed to update brand');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update brand');
    }
  };

  const filteredBrands = useMemo(() => {
    const result = [...brands];
    
    // Always sort by status first (active at top), then by name
    result.sort((a, b) => {
      if (a.status === 'active' && b.status === 'inactive') return -1;
      if (a.status === 'inactive' && b.status === 'active') return 1;
      return a.name.localeCompare(b.name);
    });

    if (!searchQuery.trim()) return result;
    
    const query = searchQuery.toLowerCase();
    return result.filter(b => 
      b.name.toLowerCase().includes(query) || 
      b.homepage_url.toLowerCase().includes(query) ||
      (b.industry && b.industry.toLowerCase().includes(query))
    );
  }, [brands, searchQuery]);

  return (
    <Layout>
      <SettingsLayout>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-headings)] tracking-tight">Manage Brands</h1>
                <p className="text-sm text-[var(--text-caption)] mt-1">View and configure your monitored brands</p>
              </div>
            </div>
            <button
              onClick={handleAddBrand}
              className="flex items-center gap-2 bg-[var(--accent-primary)] text-white px-4 py-2.5 rounded-lg hover:opacity-90 transition-all font-medium text-sm shadow-sm"
            >
              <IconPlus size={18} />
              Add Brand
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <KPICard 
              title="Total Brands" 
              value={stats?.totalBrands || 0} 
              icon={IconBuildingStore} 
              loading={isStatsLoading} 
            />
            <KPICard 
              title="Total Topics" 
              value={stats?.totalTopics || 0} 
              icon={IconListCheck} 
              loading={isStatsLoading} 
            />
            <KPICard 
              title="Total Queries" 
              value={stats?.totalQueries || 0} 
              icon={IconQuestionMark} 
              loading={isStatsLoading} 
            />
            <KPICard 
              title="Avg LLM/Brand" 
              value={stats?.avgLlmsPerBrand?.toFixed(1) || 0} 
              icon={IconRobot} 
              loading={isStatsLoading} 
            />
            <KPICard 
              title="Total Answers" 
              value={stats?.totalAnswers || 0} 
              icon={IconMessageCircle} 
              loading={isStatsLoading} 
            />
          </div>

          {/* Search/Filter */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-caption)]" size={18} />
              <input
                type="text"
                placeholder="Search brands by name, URL, or industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 bg-white rounded-xl border border-[var(--border-default)] shadow-sm">
              <IconLoader2 className="animate-spin text-[var(--accent-primary)]" size={48} />
              <p className="text-[var(--text-caption)] font-medium">Fetching your brands...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex flex-col items-center gap-4 text-center">
              <IconAlertCircle size={40} className="text-red-500" />
              <div>
                <h3 className="font-bold text-lg">Unable to load brands</h3>
                <p className="text-red-600/80 mt-1">{error}</p>
              </div>
              <button 
                onClick={loadData} 
                className="px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : filteredBrands.length === 0 ? (
            <div className="text-center py-24 bg-[var(--bg-secondary)] rounded-xl border-2 border-dashed border-[var(--border-default)]">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-[var(--border-default)]">
                <IconBuildingStore size={40} className="text-[var(--text-caption)] opacity-50" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-headings)]">
                {searchQuery ? 'No matching brands found' : 'No brands found'}
              </h3>
              <p className="text-[var(--text-caption)] mt-2 mb-8 max-w-md mx-auto">
                {searchQuery 
                  ? `We couldn't find any brands matching "${searchQuery}". Try a different search term.`
                  : "You haven't added any brands yet. Start by adding your first brand to track its visibility across AI models."}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleAddBrand}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-all font-bold shadow-md hover:shadow-lg active:scale-95"
                >
                  <IconPlus size={20} />
                  Add Your First Brand
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredBrands.map((brand) => (
                <div
                  key={brand.id}
                  className={`bg-white border rounded-lg p-4 transition-all shadow-sm hover:shadow-md group flex items-center justify-between ${
                    brand.status === 'active' ? 'border-[var(--border-default)]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-[var(--border-default)] shadow-sm group-hover:border-[var(--accent-primary)] transition-colors flex-shrink-0">
                      <SafeLogo 
                        src={brand.homepage_url ? `https://logo.clearbit.com/${brand.homepage_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : undefined}
                        domain={brand.homepage_url}
                        alt={brand.name}
                        size={32}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-[var(--text-headings)] truncate">
                          {brand.name}
                        </h3>
                        {brand.status === 'active' && (
                          <IconCircleCheck size={16} className="text-green-500 flex-shrink-0" />
                        )}
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold ${
                          brand.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {brand.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <a
                          href={brand.homepage_url.startsWith('http') ? brand.homepage_url : `https://${brand.homepage_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                        >
                          <span className="truncate max-w-[200px]">
                            {brand.homepage_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </span>
                          <IconExternalLink size={12} className="flex-shrink-0" />
                        </a>
                        {brand.industry && (
                          <span className="text-xs text-[var(--text-caption)] flex items-center gap-1 before:content-['•'] before:mr-1">
                            {brand.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 ml-4">
                    <button
                      onClick={() => handleEditBrand(brand)}
                      className="p-2 text-[var(--text-caption)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Edit"
                    >
                      <IconEdit size={18} />
                    </button>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        {updatingId === brand.id && (
                          <IconLoader2 size={14} className="animate-spin text-[var(--accent-primary)]" />
                        )}
                        <button
                          onClick={() => handleToggleStatus(brand.id, brand.status)}
                          disabled={updatingId === brand.id}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all focus:outline-none ring-offset-1 focus:ring-1 focus:ring-[var(--accent-primary)] ${
                            brand.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                          } ${updatingId === brand.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                          aria-label={brand.status === 'active' ? "Deactivate brand" : "Activate brand"}
                        >
                          <span
                            className={`${
                              brand.status === 'active' ? 'translate-x-4' : 'translate-x-1'
                            } inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out`}
                          />
                        </button>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter ${brand.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                        {brand.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit Brand Modal */}
          {editingBrand && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--text-headings)]">
                      Edit Brand
                    </h2>
                    <p className="text-xs text-[var(--text-caption)] mt-0.5">Update brand details</p>
                  </div>
                  <button
                    onClick={() => setEditingBrand(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <IconX size={20} className="text-[var(--text-caption)]" />
                  </button>
                </div>

                {isLoadingBrandData ? (
                  <div className="flex items-center justify-center py-8">
                    <IconLoader2 size={24} className="animate-spin text-[var(--accent-primary)]" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        value={editingBrand.name}
                        disabled
                        className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg bg-gray-100 text-[var(--text-caption)] cursor-not-allowed font-medium"
                      />
                      <p className="text-[10px] text-[var(--text-caption)] mt-1 ml-1">Name cannot be changed</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Domain or URL
                      </label>
                      <input
                        type="text"
                        value={editingBrand.homepage_url || ''}
                        onChange={(e) => setEditingBrand({ ...editingBrand, homepage_url: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                        placeholder="example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Industry
                      </label>
                      <input
                        type="text"
                        value={editingBrand.industry || ''}
                        onChange={(e) => setEditingBrand({ ...editingBrand, industry: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/20 focus:border-[var(--accent-primary)] transition-all bg-gray-50/50"
                        placeholder="e.g., Technology, Automotive"
                      />
                    </div>

                    {/* Brand Synonyms/Aliases Section - Editable */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Brand Synonyms/Aliases
                      </label>
                      <EditableTagList
                        items={editingBrand.brand_synonyms || []}
                        onItemsChange={(synonyms) => setEditingBrand({ ...editingBrand, brand_synonyms: synonyms })}
                        placeholder="Add synonym or alias..."
                        colorClass="text-blue-700"
                        bgClass="bg-blue-100"
                      />
                    </div>

                    {/* Products Section - Editable */}
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-headings)] mb-1.5">
                        Products
                      </label>
                      <EditableTagList
                        items={editingBrand.brand_products || []}
                        onItemsChange={(products) => setEditingBrand({ ...editingBrand, brand_products: products })}
                        placeholder="Add product name..."
                        colorClass="text-green-700"
                        bgClass="bg-green-100"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setEditingBrand(null)}
                    className="flex-1 px-4 py-2 text-sm border border-[var(--border-default)] rounded-lg hover:bg-gray-50 transition-all font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateBrand}
                    disabled={isLoadingBrandData}
                    className="flex-1 px-4 py-2 text-sm bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary)]/90 transition-all shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
