import React, { useEffect, useState } from 'react';
import { IconTrash, IconPlus, IconCheck, IconChevronLeft, IconSparkles, IconEdit } from '@tabler/icons-react';
import type { Topic } from '../../types/topic';
import type { PromptWithTopic } from './PromptConfiguration';
import { getBrightdataCountries, type BrightdataCountry } from '../../api/promptManagementApi';

export interface ReviewRow {
  topic: string;
  prompt: string;
  country: string;
  locale: string;
}

interface ReviewStepProps {
  initialData: ReviewRow[];
  onConfirm: (data: { topics: Topic[]; prompts: PromptWithTopic[] }) => void;
  onBack: () => void;
  title?: string;
  description?: string;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ 
  initialData, 
  onConfirm, 
  onBack,
  title = "Review & Edit Topics & Prompts",
  description = "Review and edit the data before proceeding to summary."
}) => {
  const [data, setData] = useState<ReviewRow[]>(initialData);
  const [countries, setCountries] = useState<BrightdataCountry[]>([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);

  useEffect(() => {
    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);
        const fetchedCountries = await getBrightdataCountries();
        setCountries(fetchedCountries);
      } catch (error) {
        console.error('Failed to fetch countries:', error);
      } finally {
        setIsLoadingCountries(false);
      }
    };
    loadCountries();
  }, []);

  const getFlagEmoji = (countryCode: string) => {
    const code = countryCode.trim().toUpperCase();
    if (code.length !== 2) return '🌐';
    const points = [...code].map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...points);
  };

  const updateRow = (index: number, field: keyof ReviewRow, value: string) => {
    const newData = [...data];
    newData[index] = { ...newData[index], [field]: value };
    setData(newData);
  };

  const removeRow = (index: number) => {
    setData(data.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setData([
      ...data,
      { topic: '', prompt: '', country: 'US', locale: 'en-US' }
    ]);
  };

  const handleConfirm = () => {
    const topics: Topic[] = [];
    const prompts: PromptWithTopic[] = [];
    const topicMap = new Map<string, Topic>();

    data.forEach((row, idx) => {
      if (!row.topic.trim() || !row.prompt.trim()) return;

      if (!topicMap.has(row.topic)) {
        const topic: Topic = {
          id: `review-${Date.now()}-${idx}`,
          name: row.topic,
          source: 'custom',
          relevance: 100,
          category: 'awareness',
        };
        topicMap.set(row.topic, topic);
        topics.push(topic);
      }

      prompts.push({
        topic: row.topic,
        prompt: row.prompt,
      });
    });

    onConfirm({ topics, prompts });
  };

  return (
    <div className="review-step">
      <style>{`
        .review-step {
          --glass-bg: rgba(255, 255, 255, 0.85);
          --glass-border: rgba(255, 255, 255, 0.6);
          --gradient-primary: linear-gradient(135deg, #00bcdc 0%, #498cf9 100%);
          --row-hover: rgba(0, 188, 220, 0.04);
        }
        
        .review-header {
          margin-bottom: 28px;
          animation: fadeIn 0.4s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .review-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--gradient-primary);
          border-radius: 100px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 14px;
          box-shadow: 0 4px 12px rgba(0, 188, 220, 0.25);
        }
        
        .review-title {
          font-size: 26px;
          font-weight: 700;
          color: var(--text-headings);
          margin: 0 0 8px 0;
          font-family: 'Sora', sans-serif;
        }
        
        .review-subtitle {
          font-size: 14px;
          color: var(--text-caption);
          margin: 0;
        }
        
        .review-table-container {
          background: var(--glass-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid var(--border-default);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
          animation: fadeInUp 0.5s ease-out 0.1s both;
        }
        
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .review-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        
        .review-table-header {
          background: linear-gradient(135deg, rgba(0, 188, 220, 0.06) 0%, rgba(73, 140, 249, 0.04) 100%);
          border-bottom: 1px solid var(--border-default);
        }
        
        .review-table-header th {
          padding: 16px 20px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-caption);
        }
        
        .review-table-header th:nth-child(1) { width: 22%; }
        .review-table-header th:nth-child(2) { width: 48%; }
        .review-table-header th:nth-child(3) { width: 18%; }
        .review-table-header th:nth-child(4) { width: 12%; text-align: center; }
        
        .review-table-body tr {
          border-bottom: 1px solid var(--border-default);
          transition: all 0.2s ease;
        }
        
        .review-table-body tr:last-child {
          border-bottom: none;
        }
        
        .review-table-body tr:hover {
          background: var(--row-hover);
        }
        
        .review-table-body td {
          padding: 12px 20px;
          vertical-align: middle;
        }
        
        .review-input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--border-default);
          border-radius: 10px;
          font-size: 14px;
          color: var(--text-body);
          background: white;
          transition: all 0.2s ease;
          outline: none;
          font-family: inherit;
        }
        
        .review-input:hover {
          border-color: var(--primary300);
        }
        
        .review-input:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 188, 220, 0.1);
        }
        
        .review-input::placeholder {
          color: var(--text-caption);
          opacity: 0.7;
        }
        
        .review-input--topic {
          font-weight: 500;
        }
        
        .review-input--prompt {
          min-height: 48px;
          resize: none;
          overflow: hidden;
          line-height: 1.5;
        }
        
        .review-select-wrapper {
          position: relative;
        }
        
        .review-select {
          width: 100%;
          padding: 12px 14px;
          padding-right: 36px;
          border: 1.5px solid var(--border-default);
          border-radius: 10px;
          font-size: 14px;
          color: var(--text-body);
          background: white;
          transition: all 0.2s ease;
          outline: none;
          font-family: inherit;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
        }
        
        .review-select:hover {
          border-color: var(--primary300);
        }
        
        .review-select:focus {
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 188, 220, 0.1);
        }
        
        .review-select-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--text-caption);
        }
        
        .review-delete-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-caption);
          margin: 0 auto;
        }
        
        .review-delete-btn:hover {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        
        .review-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 20px;
          animation: fadeInUp 0.5s ease-out 0.2s both;
        }
        
        .review-add-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border: 2px dashed var(--accent-primary);
          border-radius: 10px;
          background: transparent;
          color: var(--accent-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        
        .review-add-btn:hover {
          background: rgba(0, 188, 220, 0.08);
          border-style: solid;
        }
        
        .review-row-count {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: var(--bg-secondary);
          border-radius: 100px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-caption);
        }
        
        .review-row-count-num {
          color: var(--accent-primary);
          font-weight: 700;
        }
        
        .review-actions {
          display: flex;
          gap: 16px;
          margin-top: 32px;
          animation: fadeInUp 0.5s ease-out 0.3s both;
        }
        
        .review-btn-back {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 24px;
          border: 2px solid var(--border-default);
          border-radius: 12px;
          background: white;
          color: var(--text-body);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
        
        .review-btn-back:hover {
          border-color: var(--primary300);
          background: var(--bg-secondary);
        }
        
        .review-btn-confirm {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 24px;
          border: none;
          border-radius: 12px;
          background: var(--gradient-primary);
          color: white;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
          box-shadow: 0 6px 20px rgba(0, 188, 220, 0.3);
        }
        
        .review-btn-confirm:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 188, 220, 0.4);
        }
        
        .review-btn-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .review-empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-caption);
        }
        
        .review-empty-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          background: var(--bg-secondary);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-caption);
        }
        
        .review-empty-text {
          font-size: 15px;
          font-weight: 500;
          margin: 0 0 4px 0;
        }
        
        .review-empty-hint {
          font-size: 13px;
          margin: 0;
          opacity: 0.7;
        }
      `}</style>
      
      <div className="onboarding-modal-body p-6">
        {/* Header */}
        <div className="review-header">
          <div className="review-header-badge">
            <IconEdit size={14} />
            Configuration
          </div>
          <h3 className="review-title">{title}</h3>
          <p className="review-subtitle">{description}</p>
        </div>

        {/* Table */}
        <div className="review-table-container">
          <table className="review-table">
            <thead className="review-table-header">
              <tr>
                <th>Topic</th>
                <th>Prompt</th>
                <th>Country</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="review-table-body">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="review-empty-state">
                      <div className="review-empty-icon">
                        <IconSparkles size={24} />
                      </div>
                      <p className="review-empty-text">No prompts configured yet</p>
                      <p className="review-empty-hint">Click "Add New Row" to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={row.topic}
                        onChange={(e) => updateRow(idx, 'topic', e.target.value)}
                        className="review-input review-input--topic"
                        placeholder="e.g. Pricing"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.prompt}
                        onChange={(e) => updateRow(idx, 'prompt', e.target.value)}
                        className="review-input review-input--prompt"
                        placeholder="e.g. How much does it cost?"
                      />
                    </td>
                    <td>
                      <div className="review-select-wrapper">
                        <select
                          value={row.country}
                          onChange={(e) => updateRow(idx, 'country', e.target.value)}
                          className="review-select"
                        >
                          {countries.length === 0 ? (
                            <option value={row.country}>{getFlagEmoji(row.country)} {row.country}</option>
                          ) : (
                            countries.map((c) => (
                              <option key={c.code} value={c.code.toUpperCase()}>
                                {getFlagEmoji(c.code)} {c.code.toUpperCase()}
                              </option>
                            ))
                          )}
                        </select>
                        <span className="review-select-arrow">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => removeRow(idx)}
                        className="review-delete-btn"
                        title="Delete row"
                      >
                        <IconTrash size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="review-footer">
          <button onClick={addRow} className="review-add-btn">
            <IconPlus size={18} />
            Add New Row
          </button>
          <div className="review-row-count">
            <span className="review-row-count-num">{data.length}</span>
            <span>{data.length === 1 ? 'row' : 'rows'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="review-actions">
          <button onClick={onBack} className="review-btn-back">
            <IconChevronLeft size={20} />
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={data.length === 0 || data.some(r => !r.topic.trim() || !r.prompt.trim())}
            className="review-btn-confirm"
          >
            <IconCheck size={20} />
            Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
