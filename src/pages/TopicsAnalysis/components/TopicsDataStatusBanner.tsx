import { CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface TopicsDataStatusBannerProps {
  hasRealData: boolean;
  topicCount: number;
}

export const TopicsDataStatusBanner = ({ hasRealData, topicCount }: TopicsDataStatusBannerProps) => {
  if (hasRealData) {
    return (
      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'start',
          gap: '12px',
        }}
      >
        <CheckCircle size={20} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
            All Systems Operational
          </div>
          <div style={{ fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', lineHeight: '1.6' }}>
            Your topics are being tracked across all AI search engines. All analytics data is up to date.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'start',
        gap: '12px',
      }}
    >
      <Info size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontFamily: 'IBM Plex Sans, sans-serif', fontWeight: '600', color: '#1a1d29', marginBottom: '4px' }}>
          Topics Tracking Active — Analytics Data Pending
        </div>
        <div style={{ fontSize: '13px', fontFamily: 'IBM Plex Sans, sans-serif', color: '#393e51', lineHeight: '1.6' }}>
          We're currently tracking <strong>{topicCount} topic{topicCount !== 1 ? 's' : ''}</strong> for your brand. 
          Advanced metrics like Share of Answer, visibility trends, sentiment analysis, and citation sources will populate 
          automatically as your brand monitoring system collects query results. 
          <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', padding: '4px 8px', backgroundColor: '#fef3c7', borderRadius: '4px' }}>
            💡 <strong>Tip:</strong> Make sure your query collectors are running to see real-time analytics
          </span>
        </div>
      </div>
    </div>
  );
};

