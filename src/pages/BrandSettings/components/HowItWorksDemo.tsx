import { useState } from 'react';
import { IconInfoCircle } from '@tabler/icons-react';

type TopicKey = 'reviews' | 'pricing' | 'sustainability';

interface TopicExample {
  queries: string[];
  totalCount: number;
}

const examples: Record<TopicKey, TopicExample> = {
  reviews: {
    queries: ['best product reviews', 'product reviews 2024', 'top rated products', 'trusted product reviews'],
    totalCount: 8
  },
  pricing: {
    queries: ['product pricing comparison', 'best product deals', 'product cost', 'affordable products'],
    totalCount: 8
  },
  sustainability: {
    queries: ['sustainable products', 'eco friendly products', 'sustainable brands', 'green products'],
    totalCount: 8
  }
};

const topicLabels: Record<TopicKey, string> = {
  reviews: 'Reviews',
  pricing: 'Pricing',
  sustainability: 'Sustainability'
};

export const HowItWorksDemo = () => {
  const [selectedTopic, setSelectedTopic] = useState<TopicKey>('reviews');
  const selectedExample = examples[selectedTopic];
  const remainingQueries = selectedExample.totalCount - selectedExample.queries.length;

  return (
    <div className="how-it-works-demo">
      {/* Subheader */}
      <div className="mb-4">
        <p className="text-sm text-[#6c7289]">
          Pick a topic to see the queries we'd generate
        </p>
      </div>

      {/* Topic Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(examples) as TopicKey[]).map((topicKey) => {
          const isActive = selectedTopic === topicKey;
          return (
            <button
              key={topicKey}
              onClick={() => setSelectedTopic(topicKey)}
              className={`how-it-works-topic-button ${isActive ? 'active' : ''}`}
            >
              {topicLabels[topicKey]}
            </button>
          );
        })}
      </div>

      {/* Query Display Card */}
      <div className="how-it-works-query-card">
        {/* Topic Display */}
        <div className="flex items-center gap-2 mb-3">
          <span className="how-it-works-topic-pill">
            {topicLabels[selectedTopic]}
          </span>
          <span className="how-it-works-topic-count">
            Generates {selectedExample.totalCount} search queries
          </span>
        </div>

        {/* Queries Grid */}
        <div className="how-it-works-queries-grid">
          {selectedExample.queries.map((query, index) => (
            <div key={index} className="how-it-works-query-item">
              <span>🔍</span>
              <span className="italic">"{query}"</span>
            </div>
          ))}

          {/* +N more queries */}
          {remainingQueries > 0 && (
            <div className="how-it-works-more-queries">
              +{remainingQueries} more queries
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="how-it-works-info-box">
        <IconInfoCircle size={18} className="flex-shrink-0 text-[#498cf9]" />
        <p className="how-it-works-info-text">
          Each search prompt is tested on your selected AI models each week. We then use the prompt responses to update your visibility score.
        </p>
      </div>

      <style>{`
        .how-it-works-topic-button {
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 400;
          background-color: #ffffff;
          color: #1a1d29;
          border: 1px solid #dcdfe5;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 44px;
          min-width: 44px;
        }

        .how-it-works-topic-button:hover:not(.active) {
          background-color: #f4f4f6;
        }

        .how-it-works-topic-button.active {
          background-color: #00bcdc;
          color: #ffffff;
          border: none;
          font-weight: 600;
        }

        .how-it-works-query-card {
          border: 2px solid #00bcdc;
          border-radius: 8px;
          background: #ffffff;
          padding: 16px;
          margin-bottom: 16px;
        }

        .how-it-works-topic-pill {
          padding: 4px 12px;
          border-radius: 20px;
          background-color: #f4f4f6;
          color: #1a1d29;
          font-size: 14px;
          font-weight: 500;
        }

        .how-it-works-topic-count {
          font-size: 12px;
          color: #6c7289;
        }

        .how-it-works-queries-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        @media (max-width: 640px) {
          .how-it-works-queries-grid {
            grid-template-columns: 1fr;
          }
        }

        .how-it-works-query-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background-color: #f4f4f6;
          border: 1px solid #e8e9ed;
          border-radius: 6px;
          font-size: 11px;
          color: #6c7289;
        }

        .how-it-works-more-queries {
          grid-column: 1 / -1;
          padding: 8px 12px;
          border: 2px dashed #00bcdc;
          border-radius: 6px;
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: #00bcdc;
          background-color: transparent;
        }

        .how-it-works-info-box {
          background-color: rgba(73, 140, 249, 0.1);
          border: 1px solid rgba(73, 140, 249, 0.2);
          border-radius: 8px;
          padding: 12px 16px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .how-it-works-info-text {
          font-size: 12px;
          color: #498cf9;
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

