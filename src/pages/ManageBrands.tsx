import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { getBrands, updateBrandStatus, getBrandStats, type BrandResponse, type BrandStats } from '../api/brandApi';
import { SafeLogo } from '../components/Onboarding/common/SafeLogo';
import { 
  IconBuildingStore, 
  IconPlus, 
  IconLoader2, 
  IconExternalLink, 
  IconCircleCheck, 
  IconAlertCircle,
  IconSearch,
  IconChartBar,
  IconListCheck,
  IconQuestionMark,
  IconRobot,
  IconMessageCircle
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

export const ManageBrands = () => {
  const [brands, setBrands] = useState<BrandResponse[]>([]);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setIsStatsLoading(true);
    setError(null);
    try {
      const [brandsRes, statsRes] = await Promise.all([
        getBrands(),
        getBrandStats()
      ]);

      if (brandsRes.success && brandsRes.data) {
        setBrands(brandsRes.data);
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

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const query = searchQuery.toLowerCase();
    return brands.filter(b => 
      b.name.toLowerCase().includes(query) || 
      b.homepage_url.toLowerCase().includes(query) ||
      (b.industry && b.industry.toLowerCase().includes(query))
    );
  }, [brands, searchQuery]);

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-headings)]">Manage Brands</h1>
              <p className="text-[var(--text-caption)] mt-1">View and manage all your registered brands and their status</p>
            </div>
            <button
              onClick={handleAddBrand}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-all font-semibold shadow-sm hover:shadow-md active:scale-95"
            >
              <IconPlus size={20} />
              Add New Brand
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBrands.map((brand) => (
                <div
                  key={brand.id}
                  className={`bg-white border rounded-lg p-4 transition-all shadow-sm hover:shadow-md group flex flex-col justify-between h-full ${
                    brand.status === 'active' ? 'border-[var(--border-default)]' : 'border-gray-100 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-[var(--border-default)] shadow-sm group-hover:border-[var(--accent-primary)] transition-colors flex-shrink-0">
                      <SafeLogo 
                        src={brand.homepage_url ? `https://logo.clearbit.com/${brand.homepage_url.replace(/^https?:\/\//, '').split('/')[0]}` : undefined}
                        domain={brand.homepage_url}
                        alt={brand.name}
                        size={32}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-[var(--text-headings)] flex items-center gap-1.5 truncate">
                        {brand.name}
                        {brand.status === 'active' && (
                          <IconCircleCheck size={16} className="text-green-500 flex-shrink-0" />
                        )}
                      </h3>
                      <a
                        href={brand.homepage_url.startsWith('http') ? brand.homepage_url : `https://${brand.homepage_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1 mt-0.5 font-medium"
                      >
                        <span className="truncate max-w-[120px]">
                          {brand.homepage_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </span>
                        <IconExternalLink size={12} className="flex-shrink-0" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-default)]">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${brand.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className={`text-xs font-bold ${brand.status === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
                        {brand.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>

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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SettingsLayout>
    </Layout>
  );
};
