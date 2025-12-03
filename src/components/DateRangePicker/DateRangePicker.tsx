import { useMemo } from 'react';
import { Info } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  showComparisonInfo?: boolean;
  className?: string;
}

// Helper to format date for display (e.g., "Dec 02, 2025")
const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// Calculate previous period (same duration before start date)
// This matches the backend logic: compares most recent day to previous day
export const calculatePreviousPeriod = (startDate: string, endDate: string): { start: string; end: string } | null => {
  try {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');
    
    // Use the end date as the "current day" to compare
    const currentDay = new Date(end);
    currentDay.setUTCHours(0, 0, 0, 0);
    
    // Previous day is one day before the current day
    const previousDay = new Date(currentDay);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    
    // Previous period is just the previous day (00:00:00 to 23:59:59)
    const previousStart = new Date(previousDay);
    previousStart.setUTCHours(0, 0, 0, 0);
    const previousEnd = new Date(previousDay);
    previousEnd.setUTCHours(23, 59, 59, 999);
    
    return {
      start: previousStart.toISOString().split('T')[0],
      end: previousEnd.toISOString().split('T')[0]
    };
  } catch {
    return null;
  }
};

export const DateRangePicker = ({ 
  startDate, 
  endDate, 
  onStartDateChange, 
  onEndDateChange,
  showComparisonInfo = true,
  className = ''
}: DateRangePickerProps) => {
  const previousPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculatePreviousPeriod(startDate, endDate);
  }, [startDate, endDate]);

  const maxDate = new Date().toISOString().split('T')[0]; // Today

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
        <input
          type="date"
          value={startDate}
          max={endDate || maxDate}
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
          max={maxDate}
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
      
      {showComparisonInfo && previousPeriod && (
        <div className="flex items-center gap-2 text-[11px] text-[#64748b] ml-0">
          <Info size={12} className="flex-shrink-0" />
          <span>
            Comparing to previous day: <span className="font-medium text-[#1a1d29]">{formatDateDisplay(previousPeriod.start)}</span>
            {' '}(changes show day-over-day comparison)
          </span>
        </div>
      )}
    </div>
  );
};

