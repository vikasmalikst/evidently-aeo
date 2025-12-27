import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PromptsList } from '../PromptsList';
import type { PromptEntry, PromptTopic } from '../../../types/prompts';

const buildPrompt = (index: number): PromptEntry => ({
  id: `prompt-${index}`,
  queryId: null,
  collectorResultId: null,
  question: `Question ${index}`,
  topic: 'Topic A',
  collectorTypes: index % 2 === 0 ? ['chatgpt', 'claude'] : ['gemini'],
  latestCollectorType: null,
  lastUpdated: null,
  response: null,
  volumePercentage: 0,
  volumeCount: 0,
  sentimentScore: null,
  visibilityScore: null,
  highlights: {
    brand: [],
    products: [],
    keywords: [],
    competitors: []
  }
});

const buildTopic = (id: string, name: string, promptCount: number): PromptTopic => ({
  id,
  name,
  promptCount,
  volumeCount: 0,
  visibilityScore: null,
  sentimentScore: null,
  prompts: Array.from({ length: promptCount }, (_, i) => buildPrompt(i))
});

describe('PromptsList', () => {
  it('does not log the React unique key warning', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <PromptsList
        topics={[buildTopic('t1', 'Topic A', 2), buildTopic('t2', 'Topic B', 1)]}
        selectedPromptId={null}
        onPromptSelect={vi.fn()}
        loading={false}
        selectedLLMs={[]}
      />
    );

    const keyWarnings = consoleErrorSpy.mock.calls
      .map((args) => args.join(' '))
      .filter((message) => message.includes("Each child in a list should have a unique 'key' prop"));

    consoleErrorSpy.mockRestore();

    expect(keyWarnings).toHaveLength(0);
  });

  it('renders a limited set of prompt rows and loads more on demand', async () => {
    render(
      <PromptsList
        topics={[buildTopic('t1', 'Topic A', 400)]}
        selectedPromptId={null}
        onPromptSelect={vi.fn()}
        loading={false}
        selectedLLMs={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Question 0')).toBeInTheDocument();
    });

    expect(screen.getByText('Question 149')).toBeInTheDocument();
    expect(screen.queryByText('Question 150')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /load more/i }));

    expect(await screen.findByText('Question 150')).toBeInTheDocument();
  });

  it('calls onPromptSelect when a prompt row is clicked', async () => {
    const onPromptSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <PromptsList
        topics={[buildTopic('t1', 'Topic A', 3)]}
        selectedPromptId={null}
        onPromptSelect={onPromptSelect}
        loading={false}
        selectedLLMs={[]}
      />
    );

    const promptText = await screen.findByText('Question 1');
    await user.click(promptText);

    expect(onPromptSelect).toHaveBeenCalledTimes(1);
    expect(onPromptSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'prompt-1' }));
  });
});

