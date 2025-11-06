import { Check } from 'lucide-react';
import type { Prompt } from '../../data/mockPromptSelectionData';

interface PromptCardProps {
  prompt: Prompt;
  isSelected: boolean;
  onToggle: (promptId: string) => void;
}

export const PromptCard = ({ prompt, isSelected, onToggle }: PromptCardProps) => {
  return (
    <div
      className={`prompt-card ${isSelected ? 'prompt-card--selected' : ''}`}
      onClick={() => onToggle(prompt.id)}
    >
      <div className="prompt-checkbox">
        {isSelected && <Check size={14} strokeWidth={3} />}
      </div>
      <div className="prompt-content">
        <p className="prompt-text">"{prompt.text}"</p>
        <div className="prompt-meta">
          {prompt.recommended && (
            <span className="prompt-badge prompt-badge--recommended">
              ✓ RECOMMENDED
            </span>
          )}
          <span className="prompt-confidence">
            {prompt.confidence}% confidence
          </span>
        </div>
      </div>
    </div>
  );
};
