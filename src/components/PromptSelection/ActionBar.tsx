interface ActionBarProps {
  selectedCount: number;
  maxCount: number;
  onAnalyze: () => void;
}

export const ActionBar = ({ selectedCount, maxCount, onAnalyze }: ActionBarProps) => {
  return (
    <div className="prompt-action-bar">
      <div className="prompt-action-bar-content">
        <span className="prompt-selection-count">
          {selectedCount} / {maxCount} prompts selected
        </span>
        <button
          className="analyze-button"
          disabled={selectedCount === 0}
          onClick={onAnalyze}
        >
          Analyze ({selectedCount} {selectedCount === 1 ? 'query' : 'queries'})
        </button>
      </div>
    </div>
  );
};
