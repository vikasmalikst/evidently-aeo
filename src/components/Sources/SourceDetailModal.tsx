import { X } from 'lucide-react';

interface URLDetail {
  url: string;
  title: string;
  mentionRate: number;
  sentiment: number;
  lastCrawled: string;
}

interface SourceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceName: string;
  topic: string;
  mentionRate: number;
  shareOfAnswer: number;
  urls: URLDetail[];
}

export const SourceDetailModal = ({
  isOpen,
  onClose,
  sourceName,
  topic,
  mentionRate,
  shareOfAnswer,
  urls
}: SourceDetailModalProps) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e8e9ed',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#1a1d29',
                marginBottom: '8px',
                fontFamily: 'Sora, sans-serif'
              }}
            >
              {sourceName}
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#393e51',
                margin: 0
              }}
            >
              Topic: <strong>{topic}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f4f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={24} color="#393e51" />
          </button>
        </div>

        {/* Share of Answer Stat */}
        <div
          style={{
            padding: '24px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e8e9ed'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px'
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#393e51',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}
              >
                Share of Answer
              </div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#1a1d29',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              >
                {shareOfAnswer.toFixed(2)}×
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#393e51',
                  marginTop: '4px'
                }}
              >
                Relative visibility for this topic
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#393e51',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px'
                }}
              >
                Brand Mention Rate
              </div>
              <div
                style={{
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#1a1d29',
                  fontFamily: 'IBM Plex Mono, monospace'
                }}
              >
                {mentionRate}%
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: '#393e51',
                  marginTop: '4px'
                }}
              >
                Citations containing brand mention
              </div>
            </div>
          </div>
        </div>

        {/* URLs List */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1
          }}
        >
          <h3
            style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1a1d29',
              marginBottom: '16px',
              fontFamily: 'Sora, sans-serif'
            }}
          >
            URLs with Brand Mentions ({urls.length})
          </h3>

          {urls.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#393e51',
                fontSize: '14px'
              }}
            >
              No URLs with brand mentions found for this source-topic combination.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {urls.map((urlDetail, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e8e9ed',
                    borderRadius: '8px',
                    padding: '16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#498cf9';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(73, 140, 249, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e8e9ed';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => window.open(urlDetail.url, '_blank')}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#1a1d29',
                          marginBottom: '4px'
                        }}
                      >
                        {urlDetail.title}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#498cf9',
                          wordBreak: 'break-all'
                        }}
                      >
                        {urlDetail.url}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '16px',
                      fontSize: '12px',
                      color: '#393e51'
                    }}
                  >
                    <span>
                      Mention Rate: <strong>{urlDetail.mentionRate}%</strong>
                    </span>
                    <span>
                      Sentiment: <strong style={{ color: urlDetail.sentiment >= 0.5 ? '#10b981' : urlDetail.sentiment >= 0 ? '#f59e0b' : '#ef4444' }}>
                        {urlDetail.sentiment > 0 ? '+' : ''}{(urlDetail.sentiment * 100).toFixed(0)}
                      </strong>
                    </span>
                    <span>
                      Last Crawled: <strong>{urlDetail.lastCrawled}</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e8e9ed',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#498cf9',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3a7ce0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#498cf9';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
};
