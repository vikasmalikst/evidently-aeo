import { useMemo, useRef, useEffect, useState } from 'react';
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
  
  // Local state for input values (allows visual updates without triggering callbacks)
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  
  // Track the value when input is focused to detect actual changes on blur
  const startDateOnFocusRef = useRef<string>(startDate);
  const endDateOnFocusRef = useRef<string>(endDate);
  
  // Sync local state when props change (from parent)
  useEffect(() => {
    setLocalStartDate(startDate);
    startDateOnFocusRef.current = startDate;
  }, [startDate]);
  
  useEffect(() => {
    setLocalEndDate(endDate);
    endDateOnFocusRef.current = endDate;
  }, [endDate]);

  return (
    <div className={`flex ${showComparisonInfo ? 'flex-col' : 'flex-row'} gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
        <input
          type="date"
          value={localStartDate}
          max={localEndDate || maxDate}
          onFocus={(e) => {
            // Store the value when user starts interacting with the date picker
            startDateOnFocusRef.current = e.target.value;
          }}
          onChange={(e) => {
            // Update local state for immediate visual feedback
            const value = e.target.value;
            setLocalStartDate(value);
          }}
          onBlur={(e) => {
            // Only trigger callback when input loses focus AND value actually changed
            // This prevents updates when just navigating months without selecting a date
            const value = e.target.value;
            if (value && value !== startDateOnFocusRef.current && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              onStartDateChange(value);
              if (value && localEndDate && value > localEndDate) {
                setLocalEndDate(value);
                onEndDateChange(value);
              }
            } else {
              // If value didn't actually change, revert to prop value
              setLocalStartDate(startDate);
            }
          }}
          className="px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc]"
        />
        <span className="text-[13px] text-[#64748b]">to</span>
        <input
          type="date"
          value={localEndDate}
          min={localStartDate}
          max={maxDate}
          onFocus={(e) => {
            // Store the value when user starts interacting with the date picker
            endDateOnFocusRef.current = e.target.value;
          }}
          onChange={(e) => {
            // Update local state for immediate visual feedback
            const value = e.target.value;
            setLocalEndDate(value);
          }}
          onBlur={(e) => {
            // Only trigger callback when input loses focus AND value actually changed
            // This prevents updates when just navigating months without selecting a date
            const value = e.target.value;
            if (value && value !== endDateOnFocusRef.current && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
              onEndDateChange(value);
              if (value && localStartDate && value < localStartDate) {
                setLocalStartDate(value);
                onStartDateChange(value);
              }
            } else {
              // If value didn't actually change, revert to prop value
              setLocalEndDate(endDate);
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



