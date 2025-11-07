interface ActionBarProps {
  selectedCount: number;
  maxCount: number;
  onAnalyze: () => void;
}

export const ActionBar = ({ selectedCount, maxCount, onAnalyze }: ActionBarProps) => {
  return (
    <div className="prompt-action-bar">
      <div className="prompt-action-bar-content">
        <button
          className="analyze-button"
          disabled={selectedCount === 0}
          onClick={onAnalyze}
        >
          Continue to Dashboard
        </button>
      </div>
    </div>
  );
};
