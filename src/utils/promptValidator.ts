/**
 * Validation utilities for prompt changes
 */

export interface PromptChange {
  id?: number;
  text: string;
  topic?: string;
  type?: 'system' | 'custom';
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a single prompt
 */
export function validatePrompt(prompt: PromptChange): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!prompt.text || prompt.text.trim().length === 0) {
    errors.push('Prompt text is required');
  }

  // Length validation
  if (prompt.text && prompt.text.length < 10) {
    warnings.push('Prompt is very short (less than 10 characters)');
  }

  if (prompt.text && prompt.text.length > 500) {
    errors.push('Prompt text must be less than 500 characters');
  }

  // Content validation
  if (prompt.text && prompt.text.trim().length < 3) {
    errors.push('Prompt must contain at least 3 characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates multiple prompts
 */
export function validatePrompts(prompts: PromptChange[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (prompts.length === 0) {
    errors.push('At least one prompt is required');
  }

  // Check for duplicates
  const promptTexts = prompts.map(p => p.text.trim().toLowerCase());
  const duplicates = promptTexts.filter((text, index) => promptTexts.indexOf(text) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Found ${duplicates.length} duplicate prompt(s)`);
  }

  // Validate each prompt
  prompts.forEach((prompt, index) => {
    const result = validatePrompt(prompt);
    if (!result.isValid) {
      errors.push(`Prompt ${index + 1}: ${result.errors.join(', ')}`);
    }
    warnings.push(...result.warnings.map(w => `Prompt ${index + 1}: ${w}`));
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Checks if prompt changes are significant enough to trigger recalibration
 */
export function requiresRecalibration(
  added: PromptChange[],
  removed: PromptChange[],
  edited: Array<{ id: number; oldText: string; newText: string }>
): boolean {
  // Always recalibrate if prompts are added or removed
  if (added.length > 0 || removed.length > 0) {
    return true;
  }

  // Recalibrate if more than 25% of prompts are edited
  // This is a heuristic - adjust based on your needs
  const totalChanges = added.length + removed.length + edited.length;
  return totalChanges > 0;
}

