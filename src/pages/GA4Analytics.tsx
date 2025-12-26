import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { GA4Dashboard } from '../components/GA4Analytics';
import { GA4Setup } from '../components/Settings/GA4Setup';

export const GA4Analytics = () => {
  // Use default IDs - these will be replaced with actual values if available
  const [brandId, setBrandId] = useState<string>('default-brand');
  const [customerId, setCustomerId] = useState<string>('default-customer');
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    checkGA4Config();
  }, []);

  const checkGA4Config = async () => {
    try {
      // Try to get brand from localStorage if available
      const storedBrand = localStorage.getItem('currentBrandId');
      const storedCustomer = localStorage.getItem('currentCustomerId');
      
      const activeBrandId = storedBrand || 'default-brand';
      const activeCustomerId = storedCustomer || 'default-customer';
      
      setBrandId(activeBrandId);
      setCustomerId(activeCustomerId);

      // Check if GA4 is configured
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const apiUrl = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;
      const configRes = await fetch(
        `${apiUrl}/brands/${activeBrandId}/analytics/credentials?customer_id=${activeCustomerId}`
      );

      if (configRes.ok) {
        const configResult = await configRes.json();
        setIsConfigured(configResult.success && configResult.configured);
      }
    } catch (error) {
      console.error('Error checking GA4 config:', error);
      // Don't show error - just show setup form
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <p className="text-[var(--text-caption)]">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!isConfigured || showSetup) {
    return (
      <Layout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Google Analytics 4
            </h1>
            <p className="text-[var(--text-caption)]">
              {!isConfigured 
                ? 'GA4 not configured. Set up your connection below to view analytics data.'
                : 'Configure your GA4 connection to view analytics data'
              }
            </p>
          </div>
          <GA4Setup brandId={brandId} customerId={customerId} />
          {showSetup && isConfigured && (
            <button
              onClick={() => {
                setShowSetup(false);
                checkGA4Config();
              }}
              className="mt-4 px-4 py-2 border border-[var(--border-default)] text-[var(--text-body)] rounded-lg hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowSetup(true)}
            className="px-4 py-2 text-sm border border-[var(--border-default)] text-[var(--text-body)] rounded-lg hover:bg-gray-50"
          >
            ⚙️ Configure GA4
          </button>
        </div>
        <GA4Dashboard brandId={brandId} customerId={customerId} />
      </div>
    </Layout>
  );
};

