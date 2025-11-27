interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const DateRangeSelector = ({ startDate, endDate, onStartDateChange, onEndDateChange }: DateRangeSelectorProps) => {
  return (
    <div className="flex items-center gap-3">
      <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
      <input
        type="date"
        value={startDate}
        max={endDate}
        onChange={(e) => {
          const value = e.target.value;
          onStartDateChange(value);
          if (value && endDate && value > endDate) {
            onEndDateChange(value);
          }
        }}
        className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
      />
      <span className="text-[13px] text-[#64748b]">to</span>
      <input
        type="date"
        value={endDate}
        min={startDate}
        onChange={(e) => {
          const value = e.target.value;
          onEndDateChange(value);
          if (value && startDate && value < startDate) {
            onStartDateChange(value);
          }
        }}
        className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
      />
    </div>
  );
};

