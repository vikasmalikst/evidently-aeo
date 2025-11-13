import { Plus, Minus, Edit } from 'lucide-react';
import type { PendingChanges } from '../../hooks/usePromptConfiguration';

interface PendingChangesIndicatorProps {
  changes: PendingChanges;
}

export const PendingChangesIndicator = ({ changes }: PendingChangesIndicatorProps) => {
  const totalChanges = changes.added.length + changes.removed.length + changes.edited.length;

  if (totalChanges === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-sm text-[var(--text-body)] font-medium">
        Changes applied to {totalChanges} prompt{totalChanges !== 1 ? 's' : ''}:
      </span>
      
      <div className="flex items-center gap-2">
        {changes.added.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--success500)]/10 text-[var(--success500)] text-xs font-semibold">
            <Plus size={12} />
            {changes.added.length} Added
          </span>
        )}
        
        {changes.removed.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--dataviz-4)]/10 text-[var(--dataviz-4)] text-xs font-semibold">
            <Minus size={12} />
            {changes.removed.length} Removed
          </span>
        )}
        
        {changes.edited.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--primary300)]/10 text-[var(--text-caption)] text-xs font-semibold">
            <Edit size={12} />
            {changes.edited.length} Edited
          </span>
        )}
      </div>
    </div>
  );
};

