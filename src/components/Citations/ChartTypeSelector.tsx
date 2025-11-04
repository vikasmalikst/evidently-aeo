interface ChartTypeSelectorProps {
  activeChart: 'racing' | 'donut';
  onChartChange: (chart: 'racing' | 'donut') => void;
}

export const ChartTypeSelector = ({ activeChart, onChartChange }: ChartTypeSelectorProps) => {
  return (
    <div className="inline-flex rounded-lg border border-[var(--border-default)] p-1 bg-white shadow-sm">
      <button
        onClick={() => onChartChange('racing')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
          activeChart === 'racing'
            ? 'bg-[var(--accent-primary)] text-white font-semibold'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)]'
        }`}
      >
        Racing Chart
      </button>
      <button
        onClick={() => onChartChange('donut')}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
          activeChart === 'donut'
            ? 'bg-[var(--accent-primary)] text-white font-semibold'
            : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)]'
        }`}
      >
        Donut Chart
      </button>
    </div>
  );
};
