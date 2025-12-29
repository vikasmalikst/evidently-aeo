import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useAuthStore } from '../../store/authStore';

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
  const { brands, selectedBrandId, selectBrand } = useManualBrandDashboard();
  const authUser = useAuthStore((state) => state.user);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerIdError, setCustomerIdError] = useState<string | null>(null);

  const [brandIdFilter, setBrandIdFilter] = useState<string>('');
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

  useEffect(() => {
    if (from || to) return;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
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
      if (!customerId) return;

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          customer_id: customerId,
          limit: String(limit),
          offset: String(nextOffset),
        });

        if (brandIdFilter) params.append('brand_id', brandIdFilter);
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
      customerId,
      limit,
      brandIdFilter,
      from,
      to,
      collectionStatus,
      scoringStatus,
      rawAnswer,
    ]
  );

  useEffect(() => {
    if (!customerId) return;
    load(0);
  }, [customerId, brandIdFilter, from, to, collectionStatus, scoringStatus, rawAnswer, load]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Data Collection Status</h1>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Raw Answer</label>
            <select
              value={rawAnswer}
              onChange={(e) => {
                setOffset(0);
                const value = e.target.value;
                if (value === 'any' || value === 'missing' || value === 'present') {
                  setRawAnswer(value);
                }
              }}
              className="w-full border rounded px-3 py-2"
            >
              <option value="any">Any</option>
              <option value="missing">Null</option>
              <option value="present">Non-null</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <option value="pending">pending</option>
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
                <th className="px-4 py-3 text-left font-medium text-gray-600">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Brand</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Collector</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Data Collection Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Scoring Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Raw Answer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-600">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-600">
                    No results found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}
                    </td>
                    <td className="px-4 py-3">{r.brandName || r.brandId}</td>
                    <td className="px-4 py-3">{r.collectorType}</td>
                    <td
                      className={`px-4 py-3 ${
                        r.status === 'failed' || r.status === 'failed_retry'
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
                      className={`px-4 py-3 ${
                        r.scoringStatus === 'error'
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
