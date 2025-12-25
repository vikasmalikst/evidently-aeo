import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/apiClient';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { useAuthStore } from '../../store/authStore';

interface ScheduledJob {
  id: string;
  brand_id: string;
  customer_id: string;
  job_type: 'data_collection' | 'scoring' | 'data_collection_and_scoring';
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  metadata: Record<string, any>;
}

interface JobRun {
  id: string;
  scheduled_job_id: string;
  brand_id: string;
  customer_id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  metrics: Record<string, any>;
}

export const ScheduledJobs = () => {
  const { selectedBrandId, brands, selectBrand } = useManualBrandDashboard();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [showRunsModal, setShowRunsModal] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [collectingAndScoring, setCollectingAndScoring] = useState(false);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // Ollama settings state
  const [ollamaSettings, setOllamaSettings] = useState({
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5:latest',
    useOllama: false,
  });
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [ollamaSaving, setOllamaSaving] = useState(false);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [ollamaSuccess, setOllamaSuccess] = useState<string | null>(null);
  
  // Ollama health check state
  const [ollamaHealth, setOllamaHealth] = useState<{
    healthy: boolean;
    error?: string;
    responseTime?: number;
  } | null>(null);
  const [ollamaHealthChecking, setOllamaHealthChecking] = useState(false);
  
  // Test prompt state
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Get customer_id from auth store or fetch from brand
  const authUser = useAuthStore((state) => state.user);

  // Fetch customer_id from the selected brand
  useEffect(() => {
    const fetchCustomerId = async () => {
      if (!selectedBrandId) {
        setCustomerId(null);
        return;
      }

      try {
        // First try to get from auth store
        if (authUser?.customerId) {
          setCustomerId(authUser.customerId);
          console.log(`[ScheduledJobs] Using customer_id from auth: ${authUser.customerId}`);
          return;
        }

        // Try to fetch brand details to get customer_id
        const response = await apiClient.get(`/brands/${selectedBrandId}`);
        if (response.success && response.data) {
          const brandCustomerId = response.data.customer_id;
          if (brandCustomerId) {
            setCustomerId(brandCustomerId);
            console.log(`[ScheduledJobs] Found customer_id from brand API: ${brandCustomerId}`);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to fetch brand customer_id:', error);
      }

      // Last resort: Use known customer_id for specific brand
      // Based on user's info: brand '838ba1a6-3dec-433d-bea9-a9bc278969ea' has customer_id = '157c845c-9e87-4146-8479-cb8d045212bf'
      if (selectedBrandId === '838ba1a6-3dec-433d-bea9-a9bc278969ea') {
        setCustomerId('157c845c-9e87-4146-8479-cb8d045212bf');
        console.log(`[ScheduledJobs] Using known customer_id for brand: 157c845c-9e87-4146-8479-cb8d045212bf`);
      }
    };

    fetchCustomerId();
  }, [selectedBrandId, authUser?.customerId]);

  useEffect(() => {
    if (customerId) {
      loadJobs();
      loadRecentRuns();
      if (selectedBrandId) {
        loadDiagnostic();
      }
    }
  }, [customerId, selectedBrandId]);

  // Load Ollama settings when brand is selected
  useEffect(() => {
    if (selectedBrandId) {
    loadOllamaSettings();
    }
  }, [selectedBrandId]);

  // Check health when Ollama is enabled
  useEffect(() => {
    if (ollamaSettings.useOllama && ollamaSettings.ollamaUrl) {
      checkOllamaHealth();
    } else {
      setOllamaHealth(null);
    }
  }, [ollamaSettings.useOllama, ollamaSettings.ollamaUrl]);

  const loadOllamaSettings = async () => {
    if (!selectedBrandId) {
      return;
    }
    try {
      setOllamaLoading(true);
      setOllamaError(null);
      const response = await apiClient.get(`/admin/brands/${selectedBrandId}/local-llm`);
      if (response.success && response.data) {
        setOllamaSettings(response.data);
      }
    } catch (error) {
      console.error('Failed to load Ollama settings:', error);
      setOllamaError('Failed to load Ollama settings');
    } finally {
      setOllamaLoading(false);
    }
  };

  const checkOllamaHealth = async () => {
    if (!selectedBrandId) {
      return;
    }
    try {
      setOllamaHealthChecking(true);
      setOllamaError(null);
      const response = await apiClient.get(`/admin/brands/${selectedBrandId}/local-llm/health`);
      if (response.success && response.data) {
        setOllamaHealth(response.data);
        if (!response.data.healthy) {
          setOllamaError(response.data.error || 'Ollama is not available');
        }
      }
    } catch (error) {
      console.error('Failed to check Ollama health:', error);
      setOllamaHealth({
        healthy: false,
        error: 'Failed to check Ollama health',
      });
    } finally {
      setOllamaHealthChecking(false);
    }
  };

  const saveOllamaSettings = async () => {
    if (!selectedBrandId) {
      setOllamaError('Please select a brand first');
      return;
    }
    try {
      setOllamaSaving(true);
      setOllamaError(null);
      setOllamaSuccess(null);
      
      // Validate URL format
      try {
        new URL(ollamaSettings.ollamaUrl);
      } catch {
        setOllamaError('Invalid URL format');
        setOllamaSaving(false);
        return;
      }

      const response = await apiClient.put(`/admin/brands/${selectedBrandId}/local-llm`, {
        ollamaUrl: ollamaSettings.ollamaUrl,
        ollamaModel: ollamaSettings.ollamaModel,
        useOllama: ollamaSettings.useOllama,
      });

      if (response.success) {
        setOllamaSuccess('Ollama settings saved successfully!');
        setTimeout(() => setOllamaSuccess(null), 3000);
        
        // Auto-check health after saving if Ollama is enabled
        if (ollamaSettings.useOllama) {
          setTimeout(() => checkOllamaHealth(), 500);
        } else {
          setOllamaHealth(null);
        }
      } else {
        setOllamaError(response.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save Ollama settings:', error);
      setOllamaError('Failed to save Ollama settings');
    } finally {
      setOllamaSaving(false);
    }
  };

  const testOllamaPrompt = async () => {
    if (!selectedBrandId) {
      setTestError('Please select a brand first');
      return;
    }
    if (!testPrompt.trim()) {
      setTestError('Please enter a test prompt');
      return;
    }

    try {
      setTestLoading(true);
      setTestError(null);
      setTestResponse(null);
      
      const response = await apiClient.post(`/admin/brands/${selectedBrandId}/local-llm/test`, {
        prompt: testPrompt,
      });

      if (response.success && response.data) {
        setTestResponse(response.data.response);
      } else {
        setTestError(response.error || 'Test failed');
      }
    } catch (error: any) {
      console.error('Failed to test Ollama prompt:', error);
      setTestError(error?.response?.data?.error || 'Failed to test Ollama prompt');
    } finally {
      setTestLoading(false);
    }
  };

  const loadDiagnostic = async () => {
    if (!selectedBrandId || !customerId) return;
    try {
      const response = await apiClient.get(
        `/admin/brands/${selectedBrandId}/queries-diagnostic?customer_id=${customerId}`
      );
      if (response.success && response.data) {
        setDiagnostic(response.data);
      }
    } catch (error) {
      console.error('Failed to load diagnostic:', error);
    }
  };

  const loadJobs = async () => {
    try {
      setLoading(true);
      if (!customerId) return;
      const params = new URLSearchParams({ customer_id: customerId });
      if (selectedBrandId) {
        params.append('brand_id', selectedBrandId);
      }
      const response = await apiClient.get(`/admin/scheduled-jobs?${params.toString()}`);
      if (response.success && response.data) {
        setJobs(response.data);
      }
    } catch (error) {
      console.error('Failed to load scheduled jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentRuns = async () => {
    try {
      if (!customerId) return;
      const params = new URLSearchParams({ customer_id: customerId, limit: '10' });
      if (selectedBrandId) {
        params.append('brand_id', selectedBrandId);
      }
      const response = await apiClient.get(`/admin/job-runs?${params.toString()}`);
      if (response.success && response.data) {
        setRuns(response.data);
      }
    } catch (error) {
      console.error('Failed to load job runs:', error);
    }
  };

  const handleCreateJob = async (jobData: Partial<ScheduledJob>) => {
    try {
      const response = await apiClient.post('/admin/scheduled-jobs', {
        ...jobData,
        customer_id: customerId,
        brand_id: selectedBrandId || brands[0]?.id,
      });
      if (response.success) {
        setShowCreateModal(false);
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create scheduled job');
    }
  };

  const handleToggleActive = async (job: ScheduledJob) => {
    try {
      const response = await apiClient.put(`/admin/scheduled-jobs/${job.id}`, {
        is_active: !job.is_active,
      });
      if (response.success) {
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to update job:', error);
    }
  };

  const handleTriggerJob = async (jobId: string) => {
    try {
      const response = await apiClient.post(`/admin/scheduled-jobs/${jobId}/trigger`);
      if (response.success) {
        alert('Job triggered successfully');
        loadRecentRuns();
      }
    } catch (error) {
      console.error('Failed to trigger job:', error);
      alert('Failed to trigger job');
    }
  };

  const handleCollectDataNow = async (brandId: string) => {
    if (!confirm(`Start data collection for this brand now? This will use all active queries from onboarding.`)) {
      return;
    }
    try {
      setCollecting(true);
      const response = await apiClient.post(`/admin/brands/${brandId}/collect-data-now`, {
        customer_id: customerId,
      });
      if (response.success) {
        alert(`Data collection started! ${response.data.queriesExecuted} queries will be executed.`);
        loadRecentRuns();
      }
    } catch (error: any) {
      console.error('Failed to start data collection:', error);
      alert(`Failed to start data collection: ${error?.response?.data?.error || error.message}`);
    } finally {
      setCollecting(false);
    }
  };

  const handleScoreNow = async (brandId: string) => {
    if (!customerId) {
      alert('Customer ID not available. Please select a brand.');
      return;
    }
    if (!confirm(`Start scoring for this brand now? This will process all unprocessed collector results. The process runs in the background and may take 5-30 minutes.`)) {
      return;
    }
    try {
      setScoring(true);
      const response = await apiClient.post(`/admin/brands/${brandId}/score-now`, {
        customer_id: customerId,
      });
      if (response.success) {
        alert(`Scoring started in background! ${response.message || 'Check job run history for progress.'}`);
        loadRecentRuns();
      }
    } catch (error: any) {
      console.error('Failed to start scoring:', error);
      console.error('Error details:', {
        error,
        type: typeof error,
        isError: error instanceof Error,
        message: error?.message,
        response: error?.response,
        stack: error?.stack,
      });
      // Extract error message from various possible error formats
      // apiClient uses fetch, so errors are standard Error objects with message property
      const errorMessage = 
        error?.response?.data?.error || 
        error?.response?.data?.message ||
        error?.message || 
        (typeof error === 'string' ? error : error?.toString()) || 
        'Unknown error occurred. Please check the browser console for details.';
      alert(`Failed to start scoring: ${errorMessage}`);
    } finally {
      setScoring(false);
    }
  };

  const handleCollectAndScoreNow = async (brandId: string) => {
    if (!customerId) {
      alert('Customer ID not available. Please select a brand.');
      return;
    }
    if (!confirm(`Start data collection and scoring for this brand now? This will collect data first, then automatically score it.`)) {
      return;
    }
    try {
      setCollectingAndScoring(true);
      const response = await apiClient.post(`/admin/brands/${brandId}/collect-and-score-now`, {
        customer_id: customerId,
      });
      if (response.success) {
        // Check if this is the new async response format
        if (response.data.status === 'started') {
          alert(`✅ Data collection and scoring started!\n\nThis process will run in the background and may take 10-30 minutes. Check the job run history below to monitor progress.`);
          loadRecentRuns();
        } else {
          // Legacy synchronous response format (for backwards compatibility)
          const collection = response.data.dataCollection;
          const scoring = response.data.scoring;
          let message = `✅ Completed!\n\n`;
          if (collection) {
            message += `Data Collection: ${collection.queriesExecuted} queries executed, ${collection.successfulExecutions} successful\n`;
          }
          if (scoring) {
            message += `Scoring: ${scoring.positionsProcessed} positions, ${scoring.sentimentsProcessed} sentiments processed\n`;
          }
          if (response.data.errors && response.data.errors.length > 0) {
            message += `\n⚠️ Some errors occurred. Check job run history for details.`;
          }
          alert(message);
          loadRecentRuns();
        }
      }
    } catch (error: any) {
      console.error('Failed to start collection and scoring:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to start: ${errorMessage}`);
    } finally {
      setCollectingAndScoring(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled job?')) {
      return;
    }
    try {
      const response = await apiClient.delete(`/admin/scheduled-jobs/${jobId}`);
      if (response.success) {
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('Failed to delete job');
    }
  };

  const formatCron = (cron: string) => {
    // Simple cron format display
    const parts = cron.split(' ');
    if (parts.length === 5) {
      return `${parts[1]}:${parts[0]} ${parts[2]}/${parts[3]} * * ${parts[4]}`;
    }
    return cron;
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'data_collection':
        return 'Data Collection';
      case 'scoring':
        return 'Scoring';
      case 'data_collection_and_scoring':
        return 'Data Collection + Scoring';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
        <div className="flex space-x-3">
          {selectedBrandId && (
            <>
              <button
                onClick={() => handleCollectDataNow(selectedBrandId)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                title="Start data collection immediately for selected brand"
              >
                Collect Data Now
              </button>
              <button
                onClick={() => handleScoreNow(selectedBrandId)}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                title="Start scoring immediately for selected brand"
              >
                Score Now
              </button>
            </>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Scheduled Job
          </button>
        </div>
      </div>

      {/* Brand Selector and Quick Actions */}
      <div className="mb-6 space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Brand for Quick Actions
          </label>
          <select
            value={selectedBrandId || ''}
            onChange={(e) => {
              if (e.target.value) {
                selectBrand(e.target.value);
              }
            }}
            className="w-full max-w-md border rounded px-3 py-2"
          >
            <option value="">-- Select a brand --</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        {selectedBrandId && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-900">
                Quick Actions for {brands.find(b => b.id === selectedBrandId)?.name || 'Selected Brand'}
              </h3>
              <button
                onClick={() => {
                  loadDiagnostic();
                  setShowDiagnostic(!showDiagnostic);
                }}
                className="text-sm px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                {showDiagnostic ? 'Hide' : 'Show'} Diagnostic
              </button>
            </div>

            {/* Diagnostic Info */}
            {showDiagnostic && diagnostic && (
              <div className="mb-4 p-3 bg-white rounded border">
                <h4 className="font-medium text-gray-900 mb-2">Data Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Active Queries:</span>
                    <span className={`ml-2 font-semibold ${diagnostic.diagnostic?.hasActiveQueries ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostic.queries?.active || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Queries:</span>
                    <span className="ml-2 font-semibold">{diagnostic.queries?.total || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Collector Results:</span>
                    <span className="ml-2 font-semibold">{diagnostic.collectorResults?.count || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Can Collect:</span>
                    <span className={`ml-2 font-semibold ${diagnostic.diagnostic?.canCollectData ? 'text-green-600' : 'text-red-600'}`}>
                      {diagnostic.diagnostic?.canCollectData ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
                {!diagnostic.diagnostic?.canCollectData && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    ⚠️ No active queries found. Queries need to be created during onboarding or set to <code className="bg-yellow-100 px-1 rounded">is_active = true</code> in the <code className="bg-yellow-100 px-1 rounded">generated_queries</code> table.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded border border-green-200">
                <h4 className="font-medium text-gray-900 mb-2">Collect Data Now</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Immediately collects data using all active queries from onboarding
                </p>
                <button
                  onClick={() => handleCollectDataNow(selectedBrandId)}
                  disabled={collecting || collectingAndScoring}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {collecting ? 'Collecting...' : 'Start Collection'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-purple-200">
                <h4 className="font-medium text-gray-900 mb-2">Score Now</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Immediately processes and scores all unprocessed collector results
                </p>
                <button
                  onClick={() => handleScoreNow(selectedBrandId)}
                  disabled={scoring || collectingAndScoring}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scoring ? 'Scoring...' : 'Start Scoring'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-orange-200">
                <h4 className="font-medium text-gray-900 mb-2">⭐ Collect & Score</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Collects data first, then automatically scores it (recommended)
                </p>
                <button
                  onClick={() => handleCollectAndScoreNow(selectedBrandId)}
                  disabled={collecting || scoring || collectingAndScoring}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {collectingAndScoring ? 'Running...' : 'Collect & Score'}
                </button>
              </div>
              <div className="bg-white p-4 rounded border border-indigo-200">
                <h4 className="font-medium text-gray-900 mb-2">View Historical Trends</h4>
                <p className="text-sm text-gray-600 mb-3">
                  See charts and trends for this brand over time
                </p>
                <a
                  href={`/search-visibility`}
                  target="_blank"
                  className="block w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-center"
                >
                  View Trends →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ollama Settings Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Ollama Configuration</h2>
          <div className="flex items-center gap-2">
            {ollamaSettings.useOllama && (
              <>
                {/* Health Status Indicator */}
                {ollamaHealthChecking ? (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1">
                    <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Checking...
                  </span>
                ) : ollamaHealth ? (
                  ollamaHealth.healthy ? (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Healthy
                      {ollamaHealth.responseTime && (
                        <span className="ml-1 text-green-700">
                          ({ollamaHealth.responseTime}ms)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Unavailable
                    </span>
                  )
                ) : null}
                
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Active
                </span>
                
                {/* Manual Health Check Button */}
                <button
                  onClick={checkOllamaHealth}
                  disabled={ollamaHealthChecking}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="Check Ollama health"
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        {ollamaLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">Loading settings...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-900">Use Ollama for Scoring</label>
                <p className="text-xs text-gray-500 mt-1">
                  When enabled, scoring will use your local Ollama instance instead of cloud APIs
                  {selectedBrandId && (
                    <span className="block mt-1 text-blue-600 font-medium">
                      (Brand-specific settings)
                    </span>
                  )}
                  {!selectedBrandId && (
                    <span className="block mt-1 text-amber-600 font-medium">
                      Please select a brand to configure Ollama settings
                    </span>
                  )}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={ollamaSettings.useOllama}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, useOllama: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Configuration Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ollama API URL
                </label>
                <input
                  type="text"
                  value={ollamaSettings.ollamaUrl}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, ollamaUrl: e.target.value })
                  }
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={ollamaSaving}
                />
                <p className="mt-1 text-xs text-gray-500">
                  URL where your Ollama instance is running
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ollama Model
                </label>
                <input
                  type="text"
                  value={ollamaSettings.ollamaModel}
                  onChange={(e) =>
                    setOllamaSettings({ ...ollamaSettings, ollamaModel: e.target.value })
                  }
                  placeholder="qwen2.5:latest"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={ollamaSaving}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Model name as it appears in Ollama (e.g., qwen2.5:latest)
                </p>
              </div>
            </div>

            {/* Health Status Details */}
            {ollamaSettings.useOllama && ollamaHealth && !ollamaHealth.healthy && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start">
                  <svg className="h-5 w-5 text-red-400 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-red-800">Ollama is not available</p>
                    <p className="text-xs text-red-700 mt-1">{ollamaHealth.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {ollamaError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{ollamaError}</p>
              </div>
            )}

            {ollamaSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">{ollamaSuccess}</p>
              </div>
            )}

            {/* Info Box */}
            {ollamaSettings.useOllama && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Sequential Processing Enabled</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        When using Ollama, answers are processed one at a time to avoid overloading your local instance.
                        This may take longer but ensures stability.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveOllamaSettings}
                disabled={ollamaSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {ollamaSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test Prompt Section */}
      {ollamaSettings.useOllama && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Test Ollama</h2>
          <p className="text-sm text-gray-600 mb-4">
            Send a test prompt to verify Ollama is working correctly
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Prompt
              </label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a test prompt here..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={testLoading}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={testOllamaPrompt}
                disabled={testLoading || !testPrompt.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {testLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Send Test Prompt</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Response */}
            {testError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-700 mt-1">{testError}</p>
              </div>
            )}

            {testResponse && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm font-medium text-green-800 mb-2">Response</p>
                <div className="bg-white p-3 rounded border border-green-200">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{testResponse}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Run</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {brands.find((b) => b.id === job.brand_id)?.name || job.brand_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{getJobTypeLabel(job.job_type)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono">
                  {job.cron_expression}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {job.next_run_at ? new Date(job.next_run_at).toLocaleString() : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {job.is_active ? (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleToggleActive(job)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    {job.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleTriggerJob(job.id)}
                    className="text-green-600 hover:text-green-900"
                  >
                    Trigger
                  </button>
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setShowRunsModal(true);
                    }}
                    className="text-purple-600 hover:text-purple-900"
                  >
                    History
                  </button>
                  <a
                    href={`/search-visibility?brand=${job.brand_id}`}
                    target="_blank"
                    className="text-indigo-600 hover:text-indigo-900"
                    title="View historical trends"
                  >
                    Trends
                  </a>
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <div className="p-8 text-center text-gray-500">No scheduled jobs found</div>
        )}
      </div>

      {/* Recent Runs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Recent Job Runs</h2>
        <div className="space-y-2">
          {runs.slice(0, 10).map((run) => (
            <div key={run.id} className="flex items-center justify-between p-3 border rounded">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  {getStatusBadge(run.status)}
                  <span className="text-sm font-medium">{getJobTypeLabel(run.job_type)}</span>
                  <span className="text-sm text-gray-500">
                    {new Date(run.scheduled_for).toLocaleString()}
                  </span>
                </div>
                {run.error_message && (
                  <div className="text-sm text-red-600 mt-1">{run.error_message}</div>
                )}
                {run.metrics && Object.keys(run.metrics).length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    {JSON.stringify(run.metrics, null, 2)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {runs.length === 0 && (
            <div className="text-center text-gray-500 py-4">No recent job runs</div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateJobModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateJob}
          brands={brands}
          defaultBrandId={selectedBrandId}
        />
      )}

      {/* Runs History Modal */}
      {showRunsModal && selectedJob && (
        <RunsHistoryModal
          job={selectedJob}
          onClose={() => {
            setShowRunsModal(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
};

// Create Job Modal Component
const CreateJobModal = ({
  onClose,
  onSubmit,
  brands,
  defaultBrandId,
}: {
  onClose: () => void;
  onSubmit: (data: Partial<ScheduledJob>) => void;
  brands: Array<{ id: string; name: string }>;
  defaultBrandId?: string;
}) => {
  const [formData, setFormData] = useState({
    brand_id: defaultBrandId || brands[0]?.id || '',
    job_type: 'data_collection_and_scoring' as const,
    cron_expression: '0 9 * * *', // Daily at 9 AM
    timezone: 'UTC',
    is_active: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Create Scheduled Job</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand</label>
            <select
              value={formData.brand_id}
              onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
              className="w-full border rounded px-3 py-2"
              required
            >
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Job Type</label>
            <select
              value={formData.job_type}
              onChange={(e) =>
                setFormData({ ...formData, job_type: e.target.value as any })
              }
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="data_collection">Data Collection</option>
              <option value="scoring">Scoring</option>
              <option value="data_collection_and_scoring">Data Collection + Scoring</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cron Expression</label>
            <input
              type="text"
              value={formData.cron_expression}
              onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
              placeholder="0 9 * * *"
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Format: minute hour day month weekday (e.g., "0 9 * * *" = daily at 9 AM)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Timezone</label>
            <input
              type="text"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              placeholder="UTC"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm">Active</label>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Runs History Modal Component
const RunsHistoryModal = ({ job, onClose }: { job: ScheduledJob; onClose: () => void }) => {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, [job.id]);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/admin/job-runs?scheduled_job_id=${job.id}&limit=50`
      );
      if (response.success && response.data) {
        setRuns(response.data);
      }
    } catch (error) {
      console.error('Failed to load runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Job Run History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="border rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(run.status)}
                    <span className="text-sm">
                      {new Date(run.scheduled_for).toLocaleString()}
                    </span>
                  </div>
                  {run.finished_at && run.started_at && (
                    <span className="text-xs text-gray-500">
                      Duration: {Math.round(
                        (new Date(run.finished_at).getTime() -
                          new Date(run.started_at).getTime()) /
                          1000
                      )}{' '}
                      seconds
                    </span>
                  )}
                </div>
                {run.error_message && (
                  <div className="text-sm text-red-600 mb-2">{run.error_message}</div>
                )}
                {run.metrics && Object.keys(run.metrics).length > 0 && (
                  <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(run.metrics, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            {runs.length === 0 && (
              <div className="text-center text-gray-500 py-4">No runs found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

