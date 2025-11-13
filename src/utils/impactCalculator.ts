/**
 * Calculate impact of prompt configuration changes on visibility scores
 */

export interface PromptConfig {
  id: number;
  text: string;
  topic: string;
  type: 'system' | 'custom';
  isSelected: boolean;
}

export interface ImpactEstimate {
  newScore: number;
  delta: number;
  confidence: 'high' | 'medium' | 'low';
  newCoverage: number;
  coverageDelta: number;
  reasoning?: string;
}

export interface PromptChanges {
  added: Array<{ text: string; topic: string }>;
  removed: Array<{ id: number; text: string }>;
  edited: Array<{ id: number; oldText: string; newText: string }>;
}

/**
 * Calculate estimated impact of prompt changes
 * This is a simplified calculation - replace with actual algorithm
 */
export function calculateImpact(
  currentConfig: {
    prompts: PromptConfig[];
    coverage: number;
    visibilityScore: number;
  },
  changes: PromptChanges
): ImpactEstimate {
  const { prompts, coverage, visibilityScore } = currentConfig;
  const { added, removed, edited } = changes;

  // Calculate new prompt count
  const currentSelectedCount = prompts.filter(p => p.isSelected).length;
  const newCount = currentSelectedCount + added.length - removed.length;

  // Calculate coverage impact (simplified)
  // Assume each prompt contributes equally to coverage
  const avgPromptCoverage = coverage / Math.max(currentSelectedCount, 1);
  const coverageChange = (added.length - removed.length) * avgPromptCoverage;
  const newCoverage = Math.max(0, Math.min(100, coverage + coverageChange));

  // Calculate score impact (simplified heuristic)
  // This is a placeholder - replace with actual scoring algorithm
  const topicDiversity = calculateTopicDiversity(prompts, changes);
  const coverageImpact = (newCoverage - coverage) / 100;
  
  // Score delta based on coverage change and topic diversity
  const scoreDelta = coverageImpact * 10 + (topicDiversity - 1) * 5;
  const newScore = Math.max(0, Math.min(100, visibilityScore + scoreDelta));

  // Determine confidence level
  const confidence = determineConfidence(prompts, changes);

  return {
    newScore: Math.round(newScore * 10) / 10,
    delta: Math.round(scoreDelta * 10) / 10,
    confidence,
    newCoverage: Math.round(newCoverage * 10) / 10,
    coverageDelta: Math.round(coverageChange * 10) / 10,
    reasoning: generateReasoning(changes, scoreDelta, confidence)
  };
}

/**
 * Calculate topic diversity impact
 */
function calculateTopicDiversity(
  currentPrompts: PromptConfig[],
  changes: PromptChanges
): number {
  const currentTopics = new Set(
    currentPrompts.filter(p => p.isSelected).map(p => p.topic)
  );
  
  const addedTopics = new Set(changes.added.map(a => a.topic));
  const removedTopics = new Set(
    changes.removed.map(r => {
      const prompt = currentPrompts.find(p => p.id === r.id);
      return prompt?.topic || '';
    }).filter(Boolean)
  );

  // Calculate new topic set
  const newTopics = new Set([...currentTopics]);
  addedTopics.forEach(t => newTopics.add(t));
  removedTopics.forEach(t => newTopics.delete(t));

  // Diversity factor: more topics = higher diversity
  const diversityFactor = newTopics.size / Math.max(currentTopics.size, 1);
  return diversityFactor;
}

/**
 * Determine confidence level based on changes
 */
function determineConfidence(
  currentPrompts: PromptConfig[],
  changes: PromptChanges
): 'high' | 'medium' | 'low' {
  const { added, removed, edited } = changes;
  const totalChanges = added.length + removed.length + edited.length;
  const currentCount = currentPrompts.filter(p => p.isSelected).length;

  // High confidence: small changes, similar topic coverage
  if (totalChanges <= 2 && currentCount > 5) {
    return 'high';
  }

  // Low confidence: large changes or significant topic shifts
  if (totalChanges > currentCount * 0.5) {
    return 'low';
  }

  // Medium confidence: moderate changes
  return 'medium';
}

/**
 * Generate human-readable reasoning for the impact
 */
function generateReasoning(
  changes: PromptChanges,
  scoreDelta: number,
  confidence: 'high' | 'medium' | 'low'
): string {
  const { added, removed, edited } = changes;
  const parts: string[] = [];

  if (added.length > 0) {
    parts.push(`Added ${added.length} prompt${added.length > 1 ? 's' : ''}`);
  }
  if (removed.length > 0) {
    parts.push(`Removed ${removed.length} prompt${removed.length > 1 ? 's' : ''}`);
  }
  if (edited.length > 0) {
    parts.push(`Edited ${edited.length} prompt${edited.length > 1 ? 's' : ''}`);
  }

  const changeSummary = parts.join(', ');
  const direction = scoreDelta > 0 ? 'increase' : scoreDelta < 0 ? 'decrease' : 'no change';
  
  return `${changeSummary}. Estimated ${direction} of ${Math.abs(scoreDelta).toFixed(1)} points (${confidence} confidence).`;
}

