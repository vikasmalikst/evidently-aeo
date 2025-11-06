interface SelectionBarProps {
  selectedCount: number;
  maxTopics: number;
  minTopics: number;
  qualityScore: number;
}

export const SelectionBar = ({
  selectedCount,
  maxTopics,
  minTopics,
  qualityScore,
}: SelectionBarProps) => {
  const getQualityLabel = () => {
    if (qualityScore >= 80) return 'Excellent';
    if (qualityScore >= 60) return 'Good';
    if (qualityScore >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  const getQualityClass = () => {
    if (qualityScore >= 80) return 'excellent';
    if (qualityScore >= 60) return 'good';
    if (qualityScore >= 40) return 'fair';
    return 'poor';
  };

  return (
    <div className="topic-selection-bar">
      <div className="topic-selection-count">
        <span className="topic-count-display">
          {selectedCount}/{maxTopics} topics selected
        </span>
        <span className="topic-requirement-text">
          Minimum: {minTopics} topics required
        </span>
      </div>
      <div className="topic-quality-indicator">
        <span className="topic-quality-label">Selection Quality: {getQualityLabel()}</span>
        <div className="topic-quality-bar">
          <div
            className={`topic-quality-fill ${getQualityClass()}`}
            style={{ width: `${qualityScore}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
