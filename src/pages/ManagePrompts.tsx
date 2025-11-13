import { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/Layout/Layout';
import { SettingsLayout } from '../components/Settings/SettingsLayout';
import { ManagePromptsList } from '../components/Settings/ManagePromptsList';
import { ResponseViewer } from '../components/Prompts/ResponseViewer';
import { PromptConfigurationWorkflow } from '../components/PromptConfiguration';
import { topicsToConfiguration } from '../utils/promptConfigAdapter';
import { mockPromptsData, type Prompt, type Topic } from '../data/mockPromptsData';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';

export const ManagePrompts = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>(mockPromptsData);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [hasChanges, setHasChanges] = useState(false);

  // Convert topics to configuration format for the workflow
  const currentConfig = useMemo(() => {
    return topicsToConfiguration(topics, 94, 72.4);
  }, [topics]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalPrompts = topics.reduce((sum, topic) => sum + topic.prompts.length, 0);
    const totalTopics = topics.length;
    return {
      totalPrompts,
      totalTopics,
      coverage: currentConfig.coverage,
      visibilityScore: currentConfig.visibilityScore
    };
  }, [topics, currentConfig]);

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-[var(--success500)]';
    if (coverage >= 70) return 'text-[var(--text-warning)]';
    return 'text-[var(--dataviz-4)]';
  };

  const getCoverageIcon = (coverage: number) => {
    if (coverage >= 90) return <CheckCircle size={16} className="text-[var(--success500)]" />;
    return <AlertCircle size={16} className="text-[var(--dataviz-4)]" />;
  };

  const handlePromptSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
  };

  const handlePromptEdit = useCallback((prompt: Prompt, newText: string) => {
    setHasChanges(true);
    setTopics(prevTopics => 
      prevTopics.map(topic => ({
        ...topic,
        prompts: topic.prompts.map(p => 
          p.id === prompt.id ? { ...p, text: newText } : p
        )
      }))
    );
    
    // Update selected prompt if it's the one being edited
    if (selectedPrompt?.id === prompt.id) {
      setSelectedPrompt({ ...selectedPrompt, text: newText });
    }
  }, [selectedPrompt]);

  const handlePromptDelete = useCallback((prompt: Prompt) => {
    setHasChanges(true);
    setTopics(prevTopics => 
      prevTopics.map(topic => ({
        ...topic,
        prompts: topic.prompts.filter(p => p.id !== prompt.id)
      })).filter(topic => topic.prompts.length > 0) // Remove topics with no prompts
    );
    
    // Clear selection if deleted prompt was selected
    if (selectedPrompt?.id === prompt.id) {
      setSelectedPrompt(null);
    }
  }, [selectedPrompt]);

  const handlePromptAdd = useCallback((topicId: number, promptText: string) => {
    setHasChanges(true);
    // Find the topic and create a new prompt
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    // Generate a new ID (simple approach - use max ID + 1)
    const maxId = Math.max(...topics.flatMap(t => t.prompts.map(p => p.id)), 0);
    const newPrompt: Prompt = {
      id: maxId + 1,
      text: promptText,
      response: '', // Empty response for new prompts
      lastUpdated: new Date().toISOString().split('T')[0],
      sentiment: 3, // Default neutral sentiment
      volume: 0, // Default volume
      keywords: {
        brand: [],
        target: [],
        top: []
      }
    };

    setTopics(prevTopics =>
      prevTopics.map(t =>
        t.id === topicId
          ? { ...t, prompts: [...t.prompts, newPrompt] }
          : t
      )
    );
  }, [topics]);

  // Handler for workflow changes - syncs back to topics state
  const handleWorkflowChanges = useCallback((updatedConfig: typeof currentConfig) => {
    // Convert configuration back to topics format
    // This is a simplified sync - in production, you'd want more robust mapping
    setTopics(prevTopics => {
      const updatedTopics = prevTopics.map(topic => ({
        ...topic,
        prompts: topic.prompts.map(prompt => {
          const configPrompt = updatedConfig.prompts.find(cp => cp.id === prompt.id);
          if (configPrompt) {
            return {
              ...prompt,
              text: configPrompt.text,
              // Note: isSelected state is managed differently in the workflow
            };
          }
          return prompt;
        })
      }));

      // Add new prompts from workflow
      const newPrompts = updatedConfig.prompts.filter(cp => cp.id < 0); // Temporary IDs
      newPrompts.forEach(newPrompt => {
        const topic = updatedTopics.find(t => t.name === newPrompt.topic);
        if (topic) {
          const maxId = Math.max(...updatedTopics.flatMap(t => t.prompts.map(p => p.id)), 0);
          topic.prompts.push({
            id: maxId + 1,
            text: newPrompt.text,
            response: '',
            lastUpdated: new Date().toISOString().split('T')[0],
            sentiment: 3,
            volume: 0,
            keywords: { brand: [], target: [], top: [] }
          });
        }
      });

      return updatedTopics;
    });

    setHasChanges(false);
  }, []);

  return (
    <Layout>
      <SettingsLayout>
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-[var(--text-headings)] mb-2">
              Manage Prompts
            </h1>
            <p className="text-[var(--text-caption)]">
              View and manage your tracked prompts grouped by topic
            </p>
          </div>

          {/* Prompt Coverage Summary */}
          <div className="bg-white border border-[var(--border-default)] rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-[var(--text-headings)] mb-4">
              Prompt Coverage Summary
            </h3>
            
            <div className="grid grid-cols-4 gap-6">
              {/* Total Prompts */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--dataviz-1)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--dataviz-1)] font-semibold text-sm">{summaryStats.totalPrompts}</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
                    Total Prompts
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-headings)]">
                    {summaryStats.totalPrompts}
                  </div>
                </div>
              </div>

              {/* Total Topics */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--dataviz-2)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--dataviz-2)] font-semibold text-sm">{summaryStats.totalTopics}</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
                    Topics Covered
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-headings)]">
                    {summaryStats.totalTopics}
                  </div>
                </div>
              </div>

              {/* Coverage */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--success500)]/10 flex items-center justify-center flex-shrink-0">
                  {getCoverageIcon(summaryStats.coverage)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
                    Coverage
                  </div>
                  <div className={`text-2xl font-bold ${getCoverageColor(summaryStats.coverage)}`}>
                    {summaryStats.coverage.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Visibility Score */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--accent-primary)] font-semibold text-sm">VS</span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider mb-1">
                    Visibility Score
                  </div>
                  <div className="text-2xl font-bold text-[var(--text-headings)]">
                    {summaryStats.visibilityScore.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure Workflow - Shows when changes are made */}
          {hasChanges && (
            <div className="mb-6">
              <PromptConfigurationWorkflow
                key={currentConfig.lastUpdated} // Reset workflow when config changes
                initialConfig={currentConfig}
                onViewChart={() => navigate('/prompts')}
                onComplete={() => setHasChanges(false)}
                onDismiss={() => setHasChanges(false)}
              />
            </div>
          )}

          <div className="grid grid-cols-10 gap-6">
            <div className="col-span-6">
              <ManagePromptsList
                topics={topics}
                selectedPromptId={selectedPrompt?.id || null}
                onPromptSelect={handlePromptSelect}
                onPromptEdit={handlePromptEdit}
                onPromptDelete={handlePromptDelete}
                onPromptAdd={handlePromptAdd}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
            </div>

            <div className="col-span-4">
              <ResponseViewer prompt={selectedPrompt} showHighlighting={false} />
            </div>
          </div>
        </div>
      </SettingsLayout>
    </Layout>
  );
};
