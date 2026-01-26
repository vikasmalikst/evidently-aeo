import { useMemo, useState, useEffect } from 'react';
import { Info, Calendar } from 'lucide-react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Popover } from '@mui/material';
import 'react-day-picker/dist/style.css';
import './DateRangePicker.css';
import { formatDateDisplay } from '../../utils/dateFormatting';
import { DateRangeSlider } from './DateRangeSlider';

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

const formatToYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  showComparisonInfo = true,
  className = '',
  variant = 'popover'
}: DateRangePickerProps) => {
  const previousPeriod = useMemo(() => {
    if (!startDate || !endDate) return null;
    return calculatePreviousPeriod(startDate, endDate);
  }, [startDate, endDate]);

  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  // Use local state precisely to track selection progress
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = startDate ? new Date(startDate + 'T00:00:00') : undefined;
    const to = endDate ? new Date(endDate + 'T00:00:00') : undefined;
    return { from, to };
  });

  // Keep internal state in sync with external props for reactivity (e.g. URL changes)
  useEffect(() => {
    const from = startDate ? new Date(startDate + 'T00:00:00') : undefined;
    const to = endDate ? new Date(endDate + 'T00:00:00') : undefined;
    
    // Only update if actually different to avoid clobbering partial selections
    const currentFrom = dateRange?.from?.getTime();
    const currentTo = dateRange?.to?.getTime();
    const nextFrom = from?.getTime();
    const nextTo = to?.getTime();

    if (currentFrom !== nextFrom || currentTo !== nextTo) {
      setDateRange({ from, to });
    }
  }, [startDate, endDate]);

  const handleDateRangeChange = (range: DateRange | undefined) => {
    // Just update local state
    setDateRange(range);
  };

  const handleApply = () => {
    if (dateRange?.from) {
      const startStr = formatToYYYYMMDD(dateRange.from);
      if (startStr !== startDate) {
        onStartDateChange(startStr);
      }
    }

    if (dateRange?.to) {
      const endStr = formatToYYYYMMDD(dateRange.to);
      if (endStr !== endDate) {
        onEndDateChange(endStr);
      }
    } else {
      // If no end date, we should probably clear it or handle it
      onEndDateChange('');
    }

    setAnchorEl(null);
  };

  const handleCancel = () => {
    // Revert local state to props
    const from = startDate ? new Date(startDate + 'T00:00:00') : undefined;
    const to = endDate ? new Date(endDate + 'T00:00:00') : undefined;
    setDateRange({ from, to });
    setAnchorEl(null);
  };

  const maxDate = new Date();
  maxDate.setHours(23, 59, 59, 999);

  const dateRangeDisplay = useMemo(() => {
    if (!startDate) return 'Select date';
    const start = formatDateDisplay(startDate);
    const end = endDate ? formatDateDisplay(endDate) : 'Select end date';
    return start === end ? start : `${start} - ${end}`;
  }, [startDate, endDate]);

  const calendarComponent = (
    <DayPicker
      mode="range"
      selected={dateRange}
      onSelect={handleDateRangeChange}
      disabled={{ after: maxDate }}
      className="rdp custom-rdp"
      showOutsideDays
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
            onClose={handleCancel}
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
                borderRadius: '12px',
                boxShadow: '0 12px 32px rgba(15,23,42,0.15)',
                border: '1px solid #e8e9ed',
                padding: '0',
                overflow: 'hidden'
              }
            }}
          >
            <div className="flex flex-col bg-white w-full min-w-[320px]">
              <div className="p-3 border-b border-slate-50">
                {calendarComponent}
              </div>
              <div className="px-4 py-3 custom-rdp-slider-container border-t border-slate-100">
                <DateRangeSlider 
                   startDate={dateRange?.from ? formatToYYYYMMDD(dateRange.from) : startDate} 
                   endDate={dateRange?.to ? formatToYYYYMMDD(dateRange.to) : endDate} 
                   onRangeChange={(start: string, end: string) => {
                     setDateRange({
                       from: new Date(start + 'T00:00:00'),
                       to: new Date(end + 'T00:00:00')
                     });
                   }}
                   maxDays={90}
                />
              </div>
              <div className="p-3 flex items-center justify-end gap-2 bg-white border-t border-slate-100">
                <button
                  onClick={handleCancel}
                  className="rdp-footer-btn rdp-cancel-btn px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  className="rdp-footer-btn rdp-apply-btn px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all"
                >
                  Apply Selection
                </button>
              </div>
            </div>
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
      <div className="flex items-start gap-3">
        <label className="text-[13px] text-[#64748b] font-medium mt-2">Date Range:</label>
        <div className="flex flex-col bg-white border border-[#e8e9ed] rounded-lg">
          <div className="p-2">
            {calendarComponent}
          </div>
          <div className="p-3 flex items-center justify-end gap-2 bg-slate-50 border-t border-slate-100 rounded-b-lg">
            <button
              onClick={handleCancel}
              className="rdp-footer-btn rdp-cancel-btn px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleApply}
              className="rdp-footer-btn rdp-apply-btn px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all"
            >
              Apply Selection
            </button>
          </div>
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
