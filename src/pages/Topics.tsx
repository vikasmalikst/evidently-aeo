import { useState, useEffect } from 'react';
import { TopicsAnalysisPage } from './TopicsAnalysis/TopicsAnalysisPage';
import { mockTopicsAnalysisData } from './TopicsAnalysis/mockData';
import { fetchBrandTopics } from '../api/topicsApi';
import { useManualBrandDashboard } from '../manual-dashboard';
import type { TopicsAnalysisData } from './TopicsAnalysis/types';

export const Topics = () => {
  const { selectedBrandId, selectedBrand, isLoading: brandsLoading } = useManualBrandDashboard();
  const [topicsData, setTopicsData] = useState<TopicsAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTopics = async () => {
      if (!selectedBrandId || brandsLoading) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchBrandTopics(selectedBrandId);
        
        if (!cancelled) {
          // If we have real topics, use them; otherwise use mock data
          if (data.topics.length === 0) {
            console.warn('No topics found for brand, using mock data');
            setTopicsData(mockTopicsAnalysisData);
          } else {
            setTopicsData(data);
          }
        }
      } catch (err) {
        console.error('Error loading topics:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load topics');
          // Fallback to mock data on error
          setTopicsData(mockTopicsAnalysisData);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadTopics();

    return () => {
      cancelled = true;
    };
  }, [selectedBrandId, brandsLoading]);

  // Show loading state
  if (isLoading || brandsLoading) {
    return (
      <TopicsAnalysisPage
        data={mockTopicsAnalysisData}
        isLoading={true}
        onTopicClick={(topic) => {
          console.log('Topic clicked:', topic);
        }}
        onCategoryFilter={(categoryId) => {
          console.log('Category filtered:', categoryId);
        }}
      />
    );
  }

  // Show error banner if there was an error but we have fallback data
  const dataToShow = topicsData || mockTopicsAnalysisData;

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          backgroundColor: '#fff8f0',
          border: '1px solid #f9db43',
          borderRadius: '8px',
          padding: '12px 20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          maxWidth: '600px',
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
                Unable to load real-time topics data
              </div>
              <div style={{ fontSize: '13px', color: '#393e51' }}>
                {error}. Showing sample data for demonstration.
              </div>
            </div>
          </div>
        </div>
      )}
      
      <TopicsAnalysisPage
        data={dataToShow}
        isLoading={false}
        onTopicClick={(topic) => {
          // Future: Open drill-down detail panel
          console.log('Topic clicked:', topic);
        }}
        onCategoryFilter={(categoryId) => {
          // Future: Filter table by category
          console.log('Category filtered:', categoryId);
        }}
      />
    </>
  );
};
