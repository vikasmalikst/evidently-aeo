import React, { useEffect, useState, useRef } from 'react';
import { IconTrash, IconPlus, IconCheck, IconChevronLeft } from '@tabler/icons-react';
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

const AutoResizeTextarea: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    resize();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      rows={1}
      placeholder={placeholder}
    />
  );
};

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
        // country/locale can be stored if the type is updated
      });
    });

    onConfirm({ topics, prompts });
  };

  return (
    <div className="review-step">
      <div className="onboarding-modal-body p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-[var(--text-headings)] mb-2">
            {title}
          </h3>
          <p className="text-sm text-[var(--text-caption)]">
            {description}
          </p>
        </div>

        <div className="overflow-x-auto max-h-[400px] border border-[var(--border-default)] rounded-xl">
          <table className="min-w-full divide-y divide-[var(--border-default)]">
            <thead className="bg-[var(--bg-secondary)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                  Topic
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                  Prompt
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                  Country
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-caption)] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--bg-primary)]">
              {data.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-secondary)]/50 transition-colors group">
                  <td className="px-4 py-2 align-middle">
                    <input
                      value={row.topic}
                      onChange={(e) => updateRow(idx, 'topic', e.target.value)}
                      className="w-full h-12 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm bg-[var(--bg-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all outline-none"
                      placeholder="e.g. Pricing"
                    />
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <textarea
                      value={row.prompt}
                      onChange={(e) => updateRow(idx, 'prompt', e.target.value)}
                      className="w-full h-12 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm bg-[var(--bg-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all resize-none overflow-y-auto outline-none"
                      placeholder="e.g. How much does it cost?"
                    />
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <span className="inline-flex w-full">
                      <select
                        value={row.country}
                        onChange={(e) => updateRow(idx, 'country', e.target.value)}
                        className="w-full h-12 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm bg-[var(--bg-primary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] transition-all appearance-none cursor-pointer outline-none"
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
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right">
                    <button
                      onClick={() => removeRow(idx)}
                      className="h-12 w-12 inline-flex items-center justify-center rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                      title="Delete row"
                    >
                      <IconTrash size={18} className="text-[var(--text-caption)] hover:text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 rounded-lg transition-all"
          >
            <IconPlus size={18} /> Add New Row
          </button>
          <div className="text-xs text-[var(--text-caption)] font-medium">
            {data.length} rows
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl border border-[var(--border-default)] text-[var(--text-body)] font-bold hover:bg-[var(--bg-secondary)] transition-all flex items-center justify-center gap-2"
          >
            <IconChevronLeft size={20} /> Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={data.length === 0 || data.some(r => !r.topic.trim() || !r.prompt.trim())}
            className="flex-1 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <IconCheck size={20} /> Confirm & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
