import { useMemo, useState, useEffect } from 'react';
import { Info, Calendar } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Popover } from '@mui/material';
import 'react-day-picker/dist/style.css';
import './DateRangePicker.css';
import { formatDateDisplay } from '../../utils/dateFormatting';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  showComparisonInfo?: boolean;
  className?: string;
  variant?: 'inline' | 'popover'; // New prop to choose display style
}

// Calculate previous period (same duration before start date)
// This matches the backend logic: compares most recent day to previous day
// Uses UTC for date calculations to ensure consistency with backend
export const calculatePreviousPeriod = (startDate: string, endDate: string): { start: string; end: string } | null => {
  try {
    // Parse date strings and work in local time for calculations
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    // Create date in local timezone at 00:00:00
    const currentDay = new Date(endYear, endMonth - 1, endDay);
    currentDay.setHours(0, 0, 0, 0);

    // Previous day is one day before the current day
    const previousDay = new Date(currentDay);
    previousDay.setDate(previousDay.getDate() - 1);

    // Previous period is just the previous day (00:00:00 to 23:59:59)
    const previousStart = new Date(previousDay);
    previousStart.setHours(0, 0, 0, 0);
    const previousEnd = new Date(previousDay);
    previousEnd.setHours(23, 59, 59, 999);

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      start: formatDate(previousStart),
      end: formatDate(previousEnd)
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
  className = '',
  variant = 'popover' // Default to popover for better UX
}: DateRangePickerProps) => {
  const previousPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculatePreviousPeriod(startDate, endDate);
  }, [startDate, endDate]);

  // Popover state for variant='popover'
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  // Convert string dates to Date objects for react-day-picker
  // Parse dates in local timezone to preserve calendar dates
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00') : undefined;
    const end = endDate ? new Date(endDate + 'T00:00:00') : undefined;
    return start && end ? { from: start, to: end } : start ? { from: start } : undefined;
  });

  // Sync dateRange when props change
  useEffect(() => {
    const start = startDate ? new Date(startDate + 'T00:00:00') : undefined;
    const end = endDate ? new Date(endDate + 'T00:00:00') : undefined;
    setDateRange(start && end ? { from: start, to: end } : start ? { from: start } : undefined);
  }, [startDate, endDate]);

  // Handle date range change from react-day-picker
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);

    // Convert Date objects back to YYYY-MM-DD strings
    if (range?.from) {
      const year = range.from.getFullYear();
      const month = String(range.from.getMonth() + 1).padStart(2, '0');
      const day = String(range.from.getDate()).padStart(2, '0');
      const startDateStr = `${year}-${month}-${day}`;
      onStartDateChange(startDateStr);
    }

    if (range?.to) {
      const year = range.to.getFullYear();
      const month = String(range.to.getMonth() + 1).padStart(2, '0');
      const day = String(range.to.getDate()).padStart(2, '0');
      const endDateStr = `${year}-${month}-${day}`;
      onEndDateChange(endDateStr);
    }

    // Close popover when both dates are selected (for popover variant)
    if (variant === 'popover' && range?.from && range?.to) {
      setAnchorEl(null);
    }
  };

  // Get max date (today) for disabling future dates
  const maxDate = new Date();
  maxDate.setHours(23, 59, 59, 999);

  // Format date range for display button
  const dateRangeDisplay = useMemo(() => {
    if (!startDate || !endDate) return 'Select date range';
    const start = formatDateDisplay(startDate);
    const end = formatDateDisplay(endDate);
    return start === end ? start : `${start} - ${end}`;
  }, [startDate, endDate]);

  // Calendar component with styling
  const calendarComponent = (
    <DayPicker
      mode="range"
      selected={dateRange}
      onSelect={handleDateRangeChange}
      disabled={{ after: maxDate }}
      className="rdp"
      styles={{
        root: {
          fontSize: '13px',
        },
        day: {
          fontSize: '13px',
          width: '36px',
          height: '36px',
        },
        day_selected: {
          backgroundColor: '#00bcdc',
          color: 'white',
        },
        day_range_start: {
          backgroundColor: '#00bcdc',
          color: 'white',
        },
        day_range_end: {
          backgroundColor: '#00bcdc',
          color: 'white',
        },
        day_range_middle: {
          backgroundColor: 'rgba(0, 188, 220, 0.1)',
        },
        day_today: {
          border: '1px solid #00bcdc',
        },
      }}
    />
  );

  // Popover variant - shows button that opens calendar in popover
  if (variant === 'popover') {
    return (
      <div className={`flex ${showComparisonInfo ? 'flex-col' : 'flex-row'} gap-2 ${className}`}>
        <div className="flex items-center gap-3">
          <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
          <button
            type="button"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#e8e9ed] rounded-lg text-[13px] bg-white hover:border-[#00bcdc] focus:outline-none focus:border-[#00bcdc] focus:ring-1 focus:ring-[#00bcdc] transition-colors"
          >
            <Calendar size={16} className="text-[#64748b]" />
            <span className="text-[#1a1d29]">{dateRangeDisplay}</span>
          </button>
          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            PaperProps={{
              sx: {
                borderRadius: '8px',
                boxShadow: '0 8px 18px rgba(15,23,42,0.1)',
                border: '1px solid #e8e9ed',
                padding: '8px',
              }
            }}
          >
            {calendarComponent}
          </Popover>
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
  }

  // Inline variant - shows calendar directly inline
  return (
    <div className={`flex ${showComparisonInfo ? 'flex-col' : 'flex-row'} gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <label className="text-[13px] text-[#64748b] font-medium">Date Range:</label>
        <div style={{
          border: '1px solid #e8e9ed',
          borderRadius: '8px',
          padding: '8px',
          backgroundColor: 'white'
        }}>
          {calendarComponent}
        </div>
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
