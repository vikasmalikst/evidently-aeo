/**
 * Adapter utilities to convert between different prompt data formats
 */
import type { Prompt, Topic } from '../data/mockPromptsData';
import type { PromptConfig } from './impactCalculator';
import type { CurrentConfiguration } from '../hooks/usePromptConfiguration';

/**
 * Convert mock Prompt data to PromptConfig format
 */
export function promptToConfig(prompt: Prompt, topic: string, isSelected: boolean = true): PromptConfig {
  return {
    id: prompt.id,
    text: prompt.text,
    topic: topic,
    type: 'system', // Default to system, can be customized
    isSelected: isSelected
  };
}

/**
 * Convert Topic[] to CurrentConfiguration format
 */
export function topicsToConfiguration(
  topics: Topic[],
  coverage: number = 94,
  visibilityScore: number = 72.4
): CurrentConfiguration {
  const prompts: PromptConfig[] = topics.flatMap(topic =>
    topic.prompts.map(prompt => promptToConfig(prompt, topic.name, true))
  );

  return {
    prompts,
    coverage,
    visibilityScore,
    lastUpdated: new Date().toISOString().split('T')[0]
  };
}

/**
 * Create a sample configuration for testing
 */
export function createSampleConfiguration(): CurrentConfiguration {
  return {
    prompts: [
      {
        id: 1,
        text: "What are the best project management tools?",
        topic: "Product Features",
        type: "system",
        isSelected: true
      },
      {
        id: 2,
        text: "How does AI enhance productivity?",
        topic: "Product Features",
        type: "system",
        isSelected: true
      },
      {
        id: 3,
        text: "What are the pricing options?",
        topic: "Pricing",
        type: "system",
        isSelected: true
      }
    ],
    coverage: 94,
    visibilityScore: 72.4,
    lastUpdated: "2024-11-08"
  };
}

