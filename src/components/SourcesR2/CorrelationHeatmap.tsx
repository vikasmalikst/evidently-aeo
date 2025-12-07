interface CorrelationHeatmapProps {
  matrix: number[][];
  labels: string[];
}

const colorForValue = (value: number) => {
  // value in [-1,1]; map to color
  const v = Math.max(-1, Math.min(1, value));
  const intensity = Math.round(Math.abs(v) * 180);
  if (v >= 0) {
    return `rgb(${240 - intensity}, 255, ${240 - intensity})`; // greenish for positive
  }
  return `rgb(255, ${240 - intensity}, ${240 - intensity})`; // reddish for negative
};

export const CorrelationHeatmap = ({ matrix, labels }: CorrelationHeatmapProps) => {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 25px rgba(15,23,42,0.05)' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 16, color: '#1a1d29', fontWeight: 700 }}>Correlation Matrix</h3>
      <p style={{ margin: '0 0 12px 0', fontSize: 12, color: '#64748b' }}>See how metrics move together</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 420, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 100 }} />
              {labels.map((label) => (
                <th key={label} style={{ padding: '6px 8px', textAlign: 'center', color: '#475569', fontWeight: 700 }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#475569', fontWeight: 700 }}>{labels[i]}</th>
                {row.map((val, j) => (
                  <td
                    key={`${i}-${j}`}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'center',
                      background: colorForValue(val),
                      border: '1px solid #e5e7eb',
                      color: '#0f172a',
                      fontWeight: i === j ? 700 : 500
                    }}
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

