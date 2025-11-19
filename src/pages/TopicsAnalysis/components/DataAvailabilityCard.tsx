import { CheckCircle, AlertCircle, Info } from 'lucide-react';

interface DataPoint {
  name: string;
  available: boolean;
  description: string;
  status: 'available' | 'partial' | 'unavailable';
}

export const DataAvailabilityCard = () => {
  const dataPoints: DataPoint[] = [
    {
      name: 'Topics & Categories',
      available: true,
      status: 'available',
      description: 'Your tracked topics organized by categories',
    },
    {
      name: 'Share of Answer (SoA)',
      available: true,
      status: 'available',
      description: 'Average Share of Answer calculated from query results',
    },
    {
      name: 'Sentiment Analysis',
      available: true,
      status: 'available',
      description: 'AI-powered sentiment analysis of brand mentions',
    },
    {
      name: 'Visibility Metrics',
      available: true,
      status: 'available',
      description: 'Average visibility index across query responses',
    },
    {
      name: 'Historical Trends',
      available: false,
      status: 'unavailable',
      description: 'Requires time-series data to show performance over time',
    },
    {
      name: 'Citation Sources',
      available: false,
      status: 'unavailable',
      description: 'Requires source attribution data from query responses',
    },
  ];

  const availableCount = dataPoints.filter(d => d.status === 'available').length;
  const totalCount = dataPoints.length;
  const percentageAvailable = Math.round((availableCount / totalCount) * 100);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e8e9ed',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Info size={18} style={{ color: '#498cf9' }} />
            <h3 style={{ fontSize: '16px', fontFamily: 'Sora, sans-serif', fontWeight: '600', color: '#1a1d29', margin: 0 }}>
              Data Availability Status
            </h3>
          </div>
          <p style={{ fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748b', margin: 0 }}>
            Overview of available and missing data for comprehensive topics analysis
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontFamily: 'Sora, sans-serif', fontWeight: '700', color: '#1a1d29' }}>
            {percentageAvailable}%
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Available
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
        {dataPoints.map((point) => (
          <div
            key={point.name}
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: '10px',
              padding: '12px',
              backgroundColor: point.status === 'available' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${point.status === 'available' ? '#86efac' : '#fecaca'}`,
              borderRadius: '6px',
            }}
          >
            {point.status === 'available' ? (
              <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
            ) : (
              <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
                {point.name}
              </div>
              <div style={{ fontSize: '12px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#64748b' }}>
                {point.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f9f9fb',
          borderRadius: '6px',
          borderLeft: '3px solid #498cf9',
        }}
      >
        <div style={{ fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', lineHeight: '1.6' }}>
          <strong>What's Working:</strong> Your topics are being tracked with Share of Answer, sentiment analysis, and visibility metrics calculated from query results. 
          <strong style={{ display: 'block', marginTop: '8px' }}>Coming Soon:</strong> Historical trends (performance over time) and citation source tracking will populate automatically as more data is collected.
        </div>
      </div>
    </div>
  );
};

