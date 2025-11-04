import { useState } from 'react';
import { Layout } from '../components/Layout/Layout';
import { PromptFilters } from '../components/Prompts/PromptFilters';
import { PromptsList } from '../components/Prompts/PromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { mockPromptsData, Prompt } from '../data/mockPromptsData';

export const Prompts = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState('us');
  const [dateRange, setDateRange] = useState('30d');

  const handlePromptSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Prompts
            </h1>
            <p className="text-[var(--text-caption)]">
              Analyze AI responses to tracked prompts across topics and platforms
            </p>
          </div>
          <button className="px-5 py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-semibold hover:bg-[var(--accent-hover)] transition-colors shadow-sm">
            Manage Prompts
          </button>
        </div>

        <PromptFilters
          selectedLLMs={selectedLLMs}
          onLLMChange={setSelectedLLMs}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
        />

        <div className="grid grid-cols-10 gap-6">
          <div className="col-span-6">
            <PromptsList
              topics={mockPromptsData}
              selectedPromptId={selectedPrompt?.id || null}
              onPromptSelect={handlePromptSelect}
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
          </div>

          <div className="col-span-4">
            <ResponseViewer prompt={selectedPrompt} />
          </div>
        </div>
      </div>
    </Layout>
  );
};
