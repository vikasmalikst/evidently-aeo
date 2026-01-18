import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { SafeLogo } from '../../components/Onboarding/common/SafeLogo';
import { useAuthStore } from '../../store/authStore';
import { AdminCustomerBrandSelector } from '../../components/admin/AdminCustomerBrandSelector';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface CollectorResultsRow {
  id: string;
  brandId: string;
  brandName: string | null;
  collectorType: string;
  status: string | null;
  scoringStatus: string | null;
  errorMessage?: string | null;
  scoringError?: string | null;
  rawAnswerPresent: boolean;
  createdAt: string;
}

interface CollectorResultsListPayload {
  rows: CollectorResultsRow[];
  total: number;
  limit: number;
  offset: number;
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

export const DataCollectionStatus = () => {
  const navigate = useNavigate();
  const { brands, selectedBrandId, selectedBrand, selectBrand } = useManualBrandDashboard();
  const authUser = useAuthStore((state) => state.user);

  // Admin customer/brand selection
  const [adminSelectedCustomerId, setAdminSelectedCustomerId] = useState<string | null>(null);
  const [adminSelectedBrandId, setAdminSelectedBrandId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerIdError, setCustomerIdError] = useState<string | null>(null);

  // Use admin selections if available, otherwise fall back to normal flow
  const effectiveCustomerId = adminSelectedCustomerId || customerId;
  const effectiveBrandId = adminSelectedBrandId || selectedBrandId;

  const [brandIdFilter, setBrandIdFilter] = useState<string>('');
  const [collectorFilter, setCollectorFilter] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [collectionStatus, setCollectionStatus] = useState<string>('');
  const [scoringStatus, setScoringStatus] = useState<string>('');
  const [rawAnswer, setRawAnswer] = useState<'any' | 'missing' | 'present'>('any');

  const [rows, setRows] = useState<CollectorResultsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCollectionError, setSelectedCollectionError] = useState<{
    rowId: string;
    title: string;
    error: string;
  } | null>(null);
  const [selectedScoringError, setSelectedScoringError] = useState<{
    rowId: string;
    title: string;
    error: string;
  } | null>(null);

  const getErrorMessage = (err: unknown): string => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return 'Unknown error';
  };

  const customerIdCandidateBrandId = useMemo(() => {
    if (brandIdFilter) return brandIdFilter;
    if (selectedBrandId) return selectedBrandId;
    return brands[0]?.id || null;
  }, [brandIdFilter, selectedBrandId, brands]);

  useEffect(() => {
    if (brandIdFilter) return;
    if (selectedBrandId) {
      setBrandIdFilter(selectedBrandId);
    }
  }, [brandIdFilter, selectedBrandId]);

  // Sync brand filter with admin selection
  useEffect(() => {
    if (adminSelectedBrandId) {
      setBrandIdFilter(adminSelectedBrandId);
    }
  }, [adminSelectedBrandId]);

  useEffect(() => {
    if (from || to) return;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 1);
    const toDateOnly = (d: Date) => d.toISOString().split('T')[0];
    setFrom(toDateOnly(start));
    setTo(toDateOnly(end));
  }, [from, to]);

  useEffect(() => {
    const fetchCustomerId = async () => {
      try {
        setCustomerIdError(null);

        const authCustomerId = authUser?.customerId;
        if (authCustomerId && isUuid(authCustomerId)) {
          setCustomerId(authCustomerId);
          return;
        }

        if (!customerIdCandidateBrandId) {
          setCustomerId(null);
          return;
        }

        const response = await apiClient.get<ApiResponse<{ customer_id?: string }>>(
          `/brands/${customerIdCandidateBrandId}`
        );
        if (!response.success || !response.data?.customer_id) {
          throw new Error(response.error || response.message || 'Failed to resolve customer_id');
        }

        setCustomerId(response.data.customer_id);
      } catch (err) {
        setCustomerId(null);
        setCustomerIdError(getErrorMessage(err));
      }
    };

    fetchCustomerId();
  }, [authUser?.customerId, customerIdCandidateBrandId]);

  const load = useCallback(
    async (nextOffset: number) => {
      if (!effectiveCustomerId) return;

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          customer_id: effectiveCustomerId,
          limit: String(limit),
          offset: String(nextOffset),
          sort_by: sortBy,
          sort_order: sortOrder,
        });

        if (brandIdFilter) params.append('brand_id', brandIdFilter);
        if (collectorFilter) params.append('collector', collectorFilter);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        if (collectionStatus) params.append('collection_status', collectionStatus);
        if (scoringStatus) params.append('scoring_status', scoringStatus);
        if (rawAnswer !== 'any') params.append('raw_answer', rawAnswer);

        const response = await apiClient.get<ApiResponse<CollectorResultsListPayload>>(
          `/admin/collector-results?${params.toString()}`
        );

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to load collector results');
        }

        setRows(response.data.rows || []);
        setTotal(response.data.total || 0);
        setOffset(response.data.offset || 0);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [
      effectiveCustomerId,
      limit,
      brandIdFilter,
      collectorFilter,
      from,
      to,
      collectionStatus,
      scoringStatus,
      rawAnswer,
      sortBy,
      sortOrder,
    ]
  );

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setOffset(0);
  };

  useEffect(() => {
    if (!effectiveCustomerId) return;
    load(0);
  }, [effectiveCustomerId, brandIdFilter, collectorFilter, from, to, collectionStatus, scoringStatus, rawAnswer, sortBy, sortOrder, load]);

  useEffect(() => {
    if (!effectiveCustomerId) return;
    const interval = setInterval(() => {
      load(offset);
    }, 600000);
    return () => clearInterval(interval);
  }, [effectiveCustomerId, load, offset]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-6">
          {selectedBrand && (
            <SafeLogo
              src={selectedBrand.metadata?.logo || selectedBrand.metadata?.brand_logo}
              domain={selectedBrand.homepage_url || undefined}
              alt={selectedBrand.name}
              size={48}
              className="w-12 h-12 rounded-lg shadow-sm object-contain bg-white p-1 border border-gray-100 shrink-0"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold mb-2">Data Collection Status</h1>
            <p className="text-sm text-gray-500">Monitor and manage the status of data collection and scoring across all collectors</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/scheduled-jobs')}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Back to Scheduled Jobs
          </button>
          <button
            onClick={() => load(offset)}
            disabled={loading || !customerId}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Admin Customer & Brand Selector */}
      <AdminCustomerBrandSelector
        selectedCustomerId={adminSelectedCustomerId}
        selectedBrandId={adminSelectedBrandId}
        onCustomerChange={setAdminSelectedCustomerId}
        onBrandChange={setAdminSelectedBrandId}
      />

      <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Brand</label>
            <select
              value={brandIdFilter}
              onChange={(e) => {
                const next = e.target.value;
                setOffset(0);
                setBrandIdFilter(next);
                if (next) {
                  selectBrand(next);
                }
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collector</label>
            <select
              value={collectorFilter}
              onChange={(e) => {
                setOffset(0);
                setCollectorFilter(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Collectors</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="google_aio">Google AIO</option>
              <option value="perplexity">Perplexity</option>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="bing_copilot">Bing Copilot</option>
              <option value="grok">Grok</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setOffset(0);
                setFrom(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setOffset(0);
                setTo(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Raw Answer</label>
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => {
                  setOffset(0);
                  setRawAnswer('any');
                }}
                className={`px-4 py-2 text-sm font-medium border border-gray-300 rounded-l-lg focus:z-10 focus:ring-2 focus:ring-blue-500 ${rawAnswer === 'any'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setOffset(0);
                  setRawAnswer('missing');
                }}
                className={`px-4 py-2 text-sm font-medium border-t border-b border-gray-300 focus:z-10 focus:ring-2 focus:ring-blue-500 ${rawAnswer === 'missing'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Null
              </button>
              <button
                type="button"
                onClick={() => {
                  setOffset(0);
                  setRawAnswer('present');
                }}
                className={`px-4 py-2 text-sm font-medium border border-gray-300 rounded-r-lg focus:z-10 focus:ring-2 focus:ring-blue-500 ${rawAnswer === 'present'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
              >
                Non-null
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Status</label>
            <select
              value={collectionStatus}
              onChange={(e) => {
                setOffset(0);
                setCollectionStatus(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Any</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="failed_retry">failed_retry</option>
              <option value="failed">failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scoring Status</label>
            <select
              value={scoringStatus}
              onChange={(e) => {
                setOffset(0);
                setScoringStatus(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Any</option>
              <option value="pending">pending</option>
              <option value="processing">processing</option>
              <option value="completed">completed</option>
              <option value="error">error</option>
              <option value="null">Null</option>
              <option value="timeout">timeout</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="w-full flex gap-3">
              <button
                onClick={() => {
                  setOffset(0);
                  setCollectionStatus('');
                  setScoringStatus('');
                  setRawAnswer('any');
                  setCollectorFilter('');
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Clear Status
              </button>
            </div>
          </div>
        </div>

        {customerIdError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {customerIdError}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Total: <span className="font-semibold">{total}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => load(Math.max(offset - limit, 0))}
              disabled={!canPrev || loading}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => load(offset + limit)}
              disabled={!canNext || loading}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1">
                    ID
                    {sortBy === 'id' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1">
                    Created
                    {sortBy === 'createdAt' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('brandName')}
                >
                  <div className="flex items-center gap-1">
                    Brand
                    {sortBy === 'brandName' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('collectorType')}
                >
                  <div className="flex items-center gap-1">
                    Collector
                    {sortBy === 'collectorType' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Data Collection Status
                    {sortBy === 'status' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('scoringStatus')}
                >
                  <div className="flex items-center gap-1">
                    Scoring Status
                    {sortBy === 'scoringStatus' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('rawAnswerPresent')}
                >
                  <div className="flex items-center gap-1">
                    Raw Answer
                    {sortBy === 'rawAnswerPresent' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-600">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-600">
                    No results found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td
                      className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500 cursor-help"
                      title={r.id}
                    >
                      {r.id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString(undefined, {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : ''}
                    </td>
                    <td className="px-4 py-3">{r.brandName || r.brandId}</td>
                    <td className="px-4 py-3">{r.collectorType}</td>
                    <td
                      className={`px-4 py-3 ${r.status === 'failed' || r.status === 'failed_retry'
                        ? 'cursor-pointer text-red-700 hover:underline'
                        : ''
                        }`}
                      onClick={() => {
                        if (!(r.status === 'failed' || r.status === 'failed_retry')) {
                          return;
                        }
                        const title = `${r.brandName || r.brandId} • ${r.collectorType} • ${r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}`;
                        setSelectedCollectionError({
                          rowId: r.id,
                          title,
                          error: r.errorMessage || 'No error details available.',
                        });
                      }}
                    >
                      {r.status || ''}
                    </td>
                    <td
                      className={`px-4 py-3 ${r.scoringStatus === 'error'
                        ? 'cursor-pointer text-red-700 hover:underline'
                        : ''
                        }`}
                      onClick={() => {
                        if (r.scoringStatus !== 'error') {
                          return;
                        }
                        const title = `${r.brandName || r.brandId} • ${r.collectorType} • ${r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}`;
                        setSelectedScoringError({
                          rowId: r.id,
                          title,
                          error: r.scoringError || 'No error details available.',
                        });
                      }}
                    >
                      {r.scoringStatus || ''}
                    </td>
                    <td className="px-4 py-3">{r.rawAnswerPresent ? 'Non-null' : 'Null'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(selectedCollectionError || selectedScoringError) && (
        <div className="mt-6 bg-white rounded-lg shadow p-6 space-y-6">
          {selectedCollectionError && (
            <div>
              <div className="text-sm font-semibold text-gray-900">Collection Error</div>
              <div className="text-xs text-gray-600 mt-1">{selectedCollectionError.title}</div>
              <pre className="mt-3 text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-4">
                {selectedCollectionError.error}
              </pre>
            </div>
          )}
          {selectedScoringError && (
            <div>
              <div className="text-sm font-semibold text-gray-900">Scoring Error</div>
              <div className="text-xs text-gray-600 mt-1">{selectedScoringError.title}</div>
              <pre className="mt-3 text-sm whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-4">
                {selectedScoringError.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
