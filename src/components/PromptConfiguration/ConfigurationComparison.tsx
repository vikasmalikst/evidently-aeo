import type { CurrentConfiguration } from '../../hooks/usePromptConfiguration';
import type { PromptConfig } from '../../utils/impactCalculator';
import type { PendingChanges } from '../../hooks/usePromptConfiguration';

interface ConfigurationComparisonProps {
  currentConfig: CurrentConfiguration;
  effectiveConfig: CurrentConfiguration;
  pendingChanges: PendingChanges;
}

export const ConfigurationComparison = ({
  currentConfig,
  effectiveConfig,
  pendingChanges
}: ConfigurationComparisonProps) => {
  const currentSelected = currentConfig.prompts.filter(p => p.isSelected);
  const effectiveSelected = effectiveConfig.prompts.filter(p => p.isSelected);

  return (
    <div className="grid grid-cols-2 gap-6 mb-6">
      {/* Current Configuration */}
      <div className="bg-white rounded-lg p-5 border border-[var(--border-default)] shadow-sm">
        <h4 className="text-sm font-semibold text-[var(--text-headings)] mb-4 uppercase tracking-wider">
          Current Configuration
        </h4>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Prompts:</span>
            <span className="text-lg font-bold text-[var(--text-headings)]">
              {currentSelected.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Coverage:</span>
            <span className="text-lg font-bold text-[var(--text-headings)]">
              {currentConfig.coverage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Score:</span>
            <span className="text-lg font-bold text-[var(--text-headings)]">
              {currentConfig.visibilityScore.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="pt-4 border-t border-[var(--border-default)]">
          <div className="text-xs text-[var(--text-caption)] space-y-1.5">
            {currentSelected.slice(0, 3).map((p) => (
              <div key={p.id} className="truncate text-[var(--text-body)]">
                {p.text}
              </div>
            ))}
            {currentSelected.length > 3 && (
              <div className="text-[var(--text-caption)] font-medium">
                +{currentSelected.length - 3} more
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proposed Configuration */}
      <div className="bg-[var(--success500)]/5 rounded-lg p-5 border-2 border-[var(--success500)] shadow-sm">
        <h4 className="text-sm font-semibold text-[var(--text-headings)] mb-4 uppercase tracking-wider">
          Proposed Configuration
        </h4>
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Prompts:</span>
            <span className="text-lg font-bold text-[var(--success500)]">
              {effectiveSelected.length}
              {effectiveSelected.length !== currentSelected.length && (
                <span className="ml-1.5 text-xs font-semibold">
                  ({effectiveSelected.length > currentSelected.length ? '+' : ''}
                  {effectiveSelected.length - currentSelected.length})
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Coverage:</span>
            <span className="text-lg font-bold text-[var(--success500)]">
              {effectiveConfig.coverage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-caption)] uppercase tracking-wider">Score:</span>
            <span className="text-lg font-bold text-[var(--success500)]">
              {effectiveConfig.visibilityScore.toFixed(1)}
            </span>
          </div>
        </div>
        <div className="pt-4 border-t border-[var(--success500)]/30">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {pendingChanges.added.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-[var(--success500)] text-white text-xs font-semibold">
                +{pendingChanges.added.length} Added
              </span>
            )}
            {pendingChanges.removed.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-[var(--dataviz-4)] text-white text-xs font-semibold">
                -{pendingChanges.removed.length} Removed
              </span>
            )}
            {pendingChanges.edited.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-[var(--primary300)] text-white text-xs font-semibold">
                ~{pendingChanges.edited.length} Edited
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-caption)] space-y-1.5">
            {effectiveSelected.slice(0, 3).map((p) => (
              <div key={p.id} className="truncate text-[var(--text-body)]">
                {p.text}
              </div>
            ))}
            {effectiveSelected.length > 3 && (
              <div className="text-[var(--text-caption)] font-medium">
                +{effectiveSelected.length - 3} more
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

