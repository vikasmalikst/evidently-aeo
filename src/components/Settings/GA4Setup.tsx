import { useState, useEffect } from 'react';
import { IconCheck, IconX, IconAlertCircle, IconUpload } from '@tabler/icons-react';

interface GA4SetupProps {
  brandId: string;
  customerId?: string;
}

export const GA4Setup: React.FC<GA4SetupProps> = ({ brandId, customerId = 'default-customer' }) => {
  const [propertyId, setPropertyId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [configuredAt, setConfiguredAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localBrandId, setLocalBrandId] = useState(brandId);
  const [localCustomerId, setLocalCustomerId] = useState(customerId);

  // Check if GA4 is already configured
  useEffect(() => {
    checkConfiguration();
  }, [brandId]);

  const checkConfiguration = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${localBrandId}/analytics/credentials?customer_id=${localCustomerId}`
      );

      const result = await response.json();
      if (result.success && result.configured) {
        setIsConfigured(true);
        setPropertyId(result.data.property_id);
        setConfiguredAt(result.data.configured_at);
      }
    } catch (err) {
      console.error('Error checking GA4 configuration:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setServiceAccountJson(content);
      
      // Try to parse and extract property ID if available
      try {
        const parsed = JSON.parse(content);
        if (parsed.project_id) {
          setSuccess('Service account file loaded successfully');
          setError(null);
        }
      } catch (err) {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate inputs
      if (!propertyId || !serviceAccountJson) {
        setError('Please provide both Property ID and Service Account JSON');
        setLoading(false);
        return;
      }

      // Parse service account JSON
      let serviceAccountKey;
      try {
        serviceAccountKey = JSON.parse(serviceAccountJson);
      } catch (err) {
        setError('Invalid service account JSON format');
        setLoading(false);
        return;
      }

      // Save credentials
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${localBrandId}/analytics/credentials`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_id: localCustomerId,
            property_id: propertyId,
            service_account_key: serviceAccountKey,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save GA4 configuration');
      }

      setSuccess('GA4 configuration saved successfully!');
      setIsConfigured(true);
      setConfiguredAt(new Date().toISOString());
      setServiceAccountJson(''); // Clear for security
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${localBrandId}/analytics/reports?customer_id=${localCustomerId}&days=7`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch data from GA4');
      }

      setSuccess('✅ Connection test successful! GA4 is working correctly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete GA4 configuration?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/brands/${localBrandId}/analytics/credentials?customer_id=${localCustomerId}`,
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete GA4 configuration');
      }

      setIsConfigured(false);
      setPropertyId('');
      setServiceAccountJson('');
      setConfiguredAt(null);
      setSuccess('GA4 configuration deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[var(--border-default)] rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
          Google Analytics 4 Configuration
        </h3>
        <p className="text-sm text-[var(--text-caption)]">
          Connect your GA4 property to view analytics data directly in your dashboard
        </p>
      </div>

      {/* Status Indicator */}
      {isConfigured && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <IconCheck size={20} className="text-green-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">GA4 Connected</p>
            <p className="text-xs text-green-700 mt-1">
              Property ID: {propertyId}
              {configuredAt && (
                <span className="ml-2">
                  • Configured {new Date(configuredAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <IconAlertCircle size={20} className="text-red-600 mt-0.5" />
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <IconCheck size={20} className="text-green-600 mt-0.5" />
          <p className="text-sm text-green-900">{success}</p>
        </div>
      )}

      {/* Advanced Settings (Brand/Customer ID) */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-[var(--accent-primary)] hover:underline"
        >
          {showAdvanced ? '▼' : '▶'} Advanced Settings (Brand & Customer ID)
        </button>
        
        {showAdvanced && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
                Brand ID
              </label>
              <input
                type="text"
                value={localBrandId}
                onChange={(e) => setLocalBrandId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                disabled={isConfigured}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-body)] mb-1">
                Customer ID
              </label>
              <input
                type="text"
                value={localCustomerId}
                onChange={(e) => setLocalCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                disabled={isConfigured}
              />
            </div>
            <p className="text-xs text-[var(--text-caption)]">
              These are automatically detected from your account. Only change if you need to configure GA4 for a specific brand.
            </p>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
            GA4 Property ID
          </label>
          <input
            type="text"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="123456789"
            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            disabled={isConfigured}
          />
          <p className="text-xs text-[var(--text-caption)] mt-1">
            Find this in GA4: Admin → Property Settings → Property ID
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-body)] mb-2">
            Service Account JSON
          </label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-[var(--border-default)] rounded-lg hover:border-[var(--accent-primary)] cursor-pointer transition-colors">
                <IconUpload size={20} className="text-[var(--text-caption)]" />
                <span className="text-sm text-[var(--text-caption)]">
                  Upload Service Account JSON
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isConfigured}
                />
              </label>
            </div>
            <textarea
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder='Paste service account JSON here or upload file above'
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] font-mono text-xs"
              rows={6}
              disabled={isConfigured}
            />
          </div>
          <p className="text-xs text-[var(--text-caption)] mt-1">
            Create a service account in Google Cloud Console with GA4 read permissions
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4">
          {!isConfigured ? (
            <button
              onClick={handleSave}
              disabled={loading || !propertyId || !serviceAccountJson}
              className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:bg-[var(--accent-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          ) : (
            <>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Deleting...' : 'Delete Configuration'}
              </button>
              <button
                onClick={() => {
                  setIsConfigured(false);
                  setServiceAccountJson('');
                }}
                className="px-6 py-2 border border-[var(--border-default)] text-[var(--text-body)] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Update Configuration
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

