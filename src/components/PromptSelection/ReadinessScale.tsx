interface ReadinessScaleProps {
  percentage: number;
  status: string;
}

export const ReadinessScale = ({ percentage, status }: ReadinessScaleProps) => {
  const getColor = () => {
    if (percentage < 30) return '#f94343';
    if (percentage < 60) return '#f9db43';
    return '#06c686';
  };

  const getStatusClass = () => {
    if (percentage < 30) return 'incomplete';
    if (percentage < 60) return 'adequate';
    if (percentage < 85) return 'strong';
    return 'optimal';
  };

  return (
    <div className="readiness-scale">
      <span className="readiness-label">Readiness</span>
      <div className="readiness-bar-container">
        <div className="readiness-bar">
          <div
            className="readiness-indicator"
            style={{
              left: `${percentage}%`,
              backgroundColor: getColor()
            }}
          />
        </div>
        <span className="readiness-percentage">{percentage}%</span>
      </div>
      <span className={`readiness-status readiness-status--${getStatusClass()}`}>
        {status}
      </span>
    </div>
  );
};
