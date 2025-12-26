import { useState, useEffect } from 'react';
import { IconCheck, IconAlertCircle, IconUpload } from '@tabler/icons-react';

interface GA4SetupProps {
  brandId: string;
  customerId?: string;
}

/**
 * Helper function to build API URL correctly
 * Handles VITE_API_URL that may or may not include /api
 */
const buildApiUrl = (endpoint: string): string => {
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '');
  // If baseUrl already ends with /api, use it as-is, otherwise append /api
  const apiBase = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const finalUrl = `${apiBase}${cleanEndpoint}`;
  
  // Debug logging
  console.log('🔧 buildApiUrl called:');
  console.log('   endpoint:', endpoint);
  console.log('   VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('   baseUrl:', baseUrl);
  console.log('   apiBase:', apiBase);
  console.log('   finalUrl:', finalUrl);
  
  return finalUrl;
};

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
        buildApiUrl(`/brands/${localBrandId}/analytics/credentials?customer_id=${localCustomerId}`)
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
    console.log('🔵 handleSave called');
    console.log('   localBrandId:', localBrandId);
    console.log('   localCustomerId:', localCustomerId);
    console.log('   propertyId:', propertyId ? 'Set' : 'Not set');
    console.log('   serviceAccountJson length:', serviceAccountJson.length);
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate inputs
      if (!propertyId || !serviceAccountJson) {
        console.log('❌ Validation failed - missing propertyId or serviceAccountJson');
        setError('Please provide both Property ID and Service Account JSON');
        setLoading(false);
        return;
      }
      
      // Validate brandId
      if (!localBrandId) {
        console.log('❌ Validation failed - localBrandId is not set');
        setError('Brand ID is not set. Please check your configuration.');
        setLoading(false);
        return;
      }

      // Parse service account JSON
      let serviceAccountKey;
      try {
        // Trim whitespace that might cause issues
        const trimmedJson = serviceAccountJson.trim();
        serviceAccountKey = JSON.parse(trimmedJson);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Invalid service account JSON format: ${errorMessage}. Please ensure the JSON is valid and properly formatted.`);
        setLoading(false);
        return;
      }

      // Basic validation of parsed JSON structure
      if (typeof serviceAccountKey !== 'object' || serviceAccountKey === null) {
        setError('Service account JSON must be an object. Please provide a valid service account JSON file.');
        setLoading(false);
        return;
      }

      // Check for required fields
      if (!serviceAccountKey.type || !serviceAccountKey.project_id || !serviceAccountKey.private_key || !serviceAccountKey.client_email) {
        setError('Service account JSON is missing required fields. Required: type, project_id, private_key, client_email');
        setLoading(false);
        return;
      }

      // Save credentials
      const saveUrl = buildApiUrl(`/brands/${localBrandId}/analytics/credentials`);
      const requestBody = {
        customer_id: localCustomerId,
        property_id: propertyId,
        service_account_key: serviceAccountKey,
      };
      
      console.log('🔵 Save Configuration - Making API call:');
      console.log('   URL:', saveUrl);
      console.log('   Method: POST');
      console.log('   Brand ID:', localBrandId);
      console.log('   Customer ID:', localCustomerId);
      console.log('   Property ID:', propertyId);
      console.log('   VITE_API_URL:', import.meta.env.VITE_API_URL);
      console.log('   Request body keys:', Object.keys(requestBody));
      console.log('   Service account key type:', typeof requestBody.service_account_key);
      
      let response: Response;
      try {
        console.log('📡 About to call fetch...');
        response = await fetch(
          saveUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );
        console.log('🟢 Save Configuration - Response received:');
        console.log('   Status:', response.status, response.statusText);
        console.log('   Headers:', Object.fromEntries(response.headers.entries()));
      } catch (fetchErr) {
        console.error('🔴 Fetch error caught:');
        console.error('   Error:', fetchErr);
        console.error('   Error type:', fetchErr instanceof Error ? fetchErr.constructor.name : typeof fetchErr);
        console.error('   Error message:', fetchErr instanceof Error ? fetchErr.message : String(fetchErr));
        throw fetchErr; // Re-throw to be caught by outer catch
      }

      // Check if response has content before parsing
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      // Read response text once (can only be read once)
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        throw new Error(`Failed to read server response: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
      }

      if (!responseText || responseText.trim().length === 0) {
        throw new Error(`Empty response from server (${response.status} ${response.statusText}). This might indicate a server error or network issue.`);
      }

      let result;
      if (isJson) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse server response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response preview: ${responseText.substring(0, 300)}`);
        }
      } else {
        // Non-JSON response (likely HTML error page or plain text)
        throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText}). Response preview: ${responseText.substring(0, 300)}`);
      }

      if (!response.ok || !result.success) {
        // Show detailed error message from backend
        const errorMsg = result.error || 'Failed to save GA4 configuration';
        const detailsMsg = result.details ? ` (${result.details})` : '';
        throw new Error(`${errorMsg}${detailsMsg}`);
      }

      setSuccess('GA4 configuration saved successfully!');
      setIsConfigured(true);
      setConfiguredAt(new Date().toISOString());
      setServiceAccountJson(''); // Clear for security
    } catch (err) {
      console.error('🔴 Save Configuration - Error caught:');
      console.error('   Error type:', err instanceof Error ? err.constructor.name : typeof err);
      console.error('   Error message:', err instanceof Error ? err.message : String(err));
      if (err instanceof Error && err.stack) {
        console.error('   Stack trace:', err.stack);
      }
      if (err instanceof TypeError && err.message.includes('fetch')) {
        console.error('   This is a fetch/network error - the request likely never reached the server');
        console.error('   Check:');
        console.error('     1. Backend server is running');
        console.error('     2. VITE_API_URL is correct:', import.meta.env.VITE_API_URL);
        console.error('     3. No CORS blocking');
        console.error('     4. Network connectivity');
      }
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
      // First check if credentials are saved
      const checkUrl = buildApiUrl(`/brands/${localBrandId}/analytics/credentials?customer_id=${localCustomerId}`);
      console.log('Checking credentials at:', checkUrl);
      
      const checkResponse = await fetch(checkUrl);
      
      if (!checkResponse.ok) {
        const checkText = await checkResponse.text();
        throw new Error(`Failed to check credentials: ${checkResponse.status} ${checkResponse.statusText}. ${checkText.substring(0, 200)}`);
      }
      
      const checkResult = await checkResponse.json();
      
      if (!checkResult.success || !checkResult.configured) {
        throw new Error('GA4 credentials not saved yet. Please save your configuration first before testing.');
      }

      // Test with real-time report (like Python script)
      const testUrl = buildApiUrl(`/brands/${localBrandId}/analytics/test-connection?customer_id=${localCustomerId}`);
      console.log('Testing connection at:', testUrl);
      console.log('VITE_API_URL:', import.meta.env.VITE_API_URL);
      
      // Try POST first, fallback to GET if network error
      let response: Response | null = null;
      try {
        response = await fetch(testUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        console.log('Test response status:', response.status, response.statusText);
      } catch (fetchError) {
        // Network error - try GET as fallback
        console.log('POST failed with network error, trying GET...', fetchError);
        try {
          response = await fetch(testUrl, {
            method: 'GET',
          });
          console.log('GET response status:', response.status, response.statusText);
        } catch (getError) {
          // Both failed - it's a network issue
          throw new Error(
            `Failed to connect to backend server. Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}. ` +
            `Please check: 1) Backend is running, 2) VITE_API_URL is correct (${import.meta.env.VITE_API_URL || 'not set'}), 3) No CORS issues`
          );
        }
      }

      if (!response) {
        throw new Error('Failed to get response from server');
      }

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        throw new Error(`Failed to read server response: ${textError instanceof Error ? textError.message : 'Unknown error'}`);
      }

      if (!responseText || responseText.trim().length === 0) {
        throw new Error(`Empty response from server (${response.status} ${response.statusText})`);
      }

      let result;
      if (isJson) {
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse server response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response: ${responseText.substring(0, 200)}`);
        }
      } else {
        throw new Error(`Server returned non-JSON response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok || !result.success) {
        const errorMsg = result.error || 'Failed to connect to GA4';
        const detailsMsg = result.details ? ` (${result.details})` : '';
        throw new Error(`${errorMsg}${detailsMsg}`);
      }

      // Display results matching Python script format
      const activeUsers = result.data?.activeUsers || 0;
      const rowCount = result.data?.rowCount || 0;
      const headers = result.data?.headers || [];
      const rows = result.data?.rows || [];
      
      let successMessage = `✅ Connection test successful! GA4 is working correctly.\n\n`;
      successMessage += `Property ID: ${result.data?.propertyId || 'N/A'}\n`;
      successMessage += `Active Users: ${activeUsers}\n`;
      successMessage += `Total Rows: ${rowCount}\n`;
      
      if (headers.length > 0) {
        successMessage += `\nHeaders: ${headers.join(' | ')}\n`;
      }
      
      if (rows.length > 0) {
        successMessage += `\nFound ${rows.length} row(s):\n`;
        rows.slice(0, 5).forEach((row: any, idx: number) => {
          const values = row.flat || row.dimensions?.concat(row.metrics) || [];
          successMessage += `  ${idx + 1}: ${values.join(' | ')}\n`;
        });
        if (rows.length > 5) {
          successMessage += `  ... and ${rows.length - 5} more\n`;
        }
      }
      
      if (result.data?.totals && result.data.totals.length > 0) {
        successMessage += `\nTotals:\n`;
        result.data.totals.forEach((total: any) => {
          successMessage += `  ${total.metric}: ${total.value}\n`;
        });
      }
      
      setSuccess(successMessage);
    } catch (err) {
      console.error('Test connection error:', err);
      let errorMessage = 'Connection test failed';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Provide helpful error messages
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = `Network error: Cannot connect to backend server. Please check:
1. Backend server is running
2. VITE_API_URL is set correctly (current: ${import.meta.env.VITE_API_URL || 'not set'})
3. No CORS or firewall issues`;
        } else if (err.message.includes('404')) {
          errorMessage = `Endpoint not found (404). The test-connection endpoint may not be registered. Check backend routes.`;
        } else if (err.message.includes('500')) {
          errorMessage = `Server error: ${err.message}. Check backend logs for details.`;
        }
      }
      
      setError(errorMessage);
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
        buildApiUrl(`/brands/${localBrandId}/analytics/credentials?customer_id=${localCustomerId}`),
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

  // Test credentials pre-fill function (for development/testing)
  const handleFillTestCredentials = () => {
    setPropertyId('516904207');
    setServiceAccountJson(JSON.stringify({
      "type": "service_account",
      "project_id": "startup-444304",
      "private_key_id": "9384d2116ae1d4c45c1951a09d76b5724f379cb0",
      "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDlFq3RE6CtOu+8\\n7gwM6cZwKtWmynyc4NxSHZ6Vm1w/3JJGdxoIZmwNrFPDQoyVtbUyj29kW2iIi8Jc\\nigT3VjOPJoSnywJSdEcKj3W66uX2vq++3KP4S0ys+xPSz0VShGOpC6oHOdQAGcNA\\neDUt3YNZaYmr++F4dHly7a1KYDudc8d8hwrazONJygOelznprxOsUEStVQQcl/YN\\nWzAzPH1yiglC2ZUBIuzu9W7QSua4sX17IFJ6mYEnOS3UGx3+n8xjb2KqBbwOSO+N\\nfkFN6SP/Gmi9qwQT6x826u8b+0NwmbLavtLQXQxzBlR2n6X2z3rUEfL04NZxY442\\nzdAFtnYHAgMBAAECggEAH/XjMmU/HZE4i3lYfrVfWnHCFJQbq3/8LOFLU8r0z/IJ\\nXuxUhPHTxwU7kGUTRlBZ+F+mJkWnFqRiQtUnQ+HSV/kt46zrui4qZRubogQN041J\\n6TemEUi2vfavZCdHoBoD6hHMWwK4hCUT+5q/AehCtXGHDqfu47ENlTj53AOt/YAQ\\nhBcaf1uQSX+M7mBhqxsBxDYNjEvKLesguDDFWqcKuzh1S5j6Dog2iU9zTu1KbfIs\\n1hP+XUrX6xn3pfWlpqLN5WufLdzgRe2PYb538LuW9hc5CS4JGjZnz5SwPMBWgbcL\\n06rr039wmB8p+6beRaXdYC8uucGswC78iDh2H82BkQKBgQD4x7YTED0oyDlweDr1\\nFi/5ZoZS41NNM0cUwVIJ5WN1iGkEVk27dqjzI2z7IvtNdd1EgwgYZXZ8ADueUfxZ\\nxGf/ncnzK4O1DnmRHoXP/BqYbfWDc98E9oJ9cjk+3dLAIbdmUd437ikC2uJDwj/+\\n5ku5H8k66pVuTVSPOoU7K7NdMQKBgQDrvKvcsHNbVeoCqt3UG2SlqOfn0ixHRfmQ\\n2ftb3R8wwgF1jaUs3aikwuLndg+1d9efBfMY2or/f3+pF5W42OKbcgf+eykVpMHS\\nmjSIZPw+WF7yudLgXD0F0ZQOea1uYv7CQpHIfw990Q91rdJE0yCppaJepnitKGaw\\nDORNclZYtwKBgBpeAFww4mqKHhxfgdAsE9WZGi96zH9oKeZ3PtyxpUL1vDurcf2m\\na+2pGYncgUoKbfMu+BKt3kryM19qTRaujF85OAg/2mu8JwJMe945WBBDxzuxcjey\\ncM4e5xZUqFuYtzlu/+Bpq4sT69tGoUXA3tG2HrvR1RiltYqgpzJIRXBhAoGBAMDU\\nDCDxlOrZVBnqepnN7n4zs77FBMMoUgRSynFSZvkTOO5Xdw1EI3bik4iR4jemWBIU\\nY82otppYSKygRjB1+Kb+l9tqEylJI+KJkP8g29SDpOcXaY9s492mmV1d2qe5AnsU\\nyPsgNCPOpr6z+JOjv8wFWNPjiELcEWNgqD9Rj5/xAoGAOeUq19ZTRie8VGIdfHp8\\nDqa2j/YMmzS7C3CvNXmo1E8jV2RDS1LHCJI6Ovr7BPg79HCpW2nPJk1AMtzTBmZg\\ntfUjWF85kymfzC2Hyhy4k0l+c/lZIldIg7BdVIqsceAtiHWIoYkJIXZ76WTkYPve\\nsoZ0YzQKmSa5bI3QvdmyX48=\\n-----END PRIVATE KEY-----\\n",
      "client_email": "evidently@startup-444304.iam.gserviceaccount.com",
      "client_id": "108824704440778678219",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/evidently%40startup-444304.iam.gserviceaccount.com",
      "universe_domain": "googleapis.com"
    }, null, 2));
    setSuccess('Test credentials loaded! Click "Save Configuration" to continue.');
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
              <label htmlFor="brand-id-input" className="block text-xs font-medium text-[var(--text-body)] mb-1">
                Brand ID
              </label>
              <input
                id="brand-id-input"
                type="text"
                value={localBrandId}
                onChange={(e) => setLocalBrandId(e.target.value)}
                placeholder="Enter Brand ID"
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                disabled={isConfigured}
              />
            </div>
            <div>
              <label htmlFor="customer-id-input" className="block text-xs font-medium text-[var(--text-body)] mb-1">
                Customer ID
              </label>
              <input
                id="customer-id-input"
                type="text"
                value={localCustomerId}
                onChange={(e) => setLocalCustomerId(e.target.value)}
                placeholder="Enter Customer ID"
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
              {!isConfigured && (
                <button
                  onClick={handleFillTestCredentials}
                  className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Fill Test Credentials
                </button>
              )}
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

