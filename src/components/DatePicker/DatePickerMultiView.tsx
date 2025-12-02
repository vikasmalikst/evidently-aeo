import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { IconCalendarEventFilled, IconCalendarWeekFilled, IconCalendarMonthFilled } from '@tabler/icons-react';

type ViewMode = 'daily' | 'weekly' | 'monthly';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface DatePickerMultiViewProps {
  onDateRangeSelect?: (startDate: Date, endDate: Date | null) => void;
  onViewChange?: (view: ViewMode) => void;
  onApply?: (startDate: Date, endDate: Date | null) => void;
  onClose?: () => void;
  initialDate?: Date;
  initialView?: ViewMode;
  signUpDate?: Date; // User sign-up date - only show dates from this forward
  mostRecentDataDate?: Date; // Most recent data date - disable dates after this
}

const DatePickerMultiView = ({
  onDateRangeSelect,
  onViewChange,
  onApply,
  onClose,
  initialDate = new Date(),
  initialView = 'daily',
  signUpDate = new Date(2024, 0, 1), // Default to Jan 1, 2024
  mostRecentDataDate = new Date(), // Default to today
}: DatePickerMultiViewProps) => {
  const [activeView, setActiveView] = useState<ViewMode>(initialView);
  const [selectedRange, setSelectedRange] = useState<DateRange | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [startWeekIndex, setStartWeekIndex] = useState<number | null>(null);
  const [endWeekIndex, setEndWeekIndex] = useState<number | null>(null);
  const [weekSelectionDirection, setWeekSelectionDirection] = useState<'forward' | 'backward' | null>(null);
  const [startMonthKey, setStartMonthKey] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
  );
  // Current quarter for weekly view (0 = Q1, 1 = Q2, 2 = Q3, 3 = Q4)
  const [currentQuarter, setCurrentQuarter] = useState<number>(() => {
    const now = new Date();
    return Math.floor(now.getMonth() / 3);
  });
  const [currentQuarterYear, setCurrentQuarterYear] = useState<number>(() => {
    return new Date().getFullYear();
  });

  // Normalize dates to start of day for comparison
  const normalizeDate = (date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  };

  const today = normalizeDate(mostRecentDataDate);
  const signUp = normalizeDate(signUpDate);

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedRange(null);
    setTempStartDate(null);
    setStartWeekIndex(null);
    setEndWeekIndex(null);
    setWeekSelectionDirection(null);
    setSelectedMonths(new Set());
    setStartMonthKey(null);
  };

  // Notify parent when view changes
  const handleViewChange = (view: ViewMode) => {
    const previousView = activeView;
    setActiveView(view);
    
    // If switching to a different view and there was a selection, clear it
    if (previousView !== view && selectedRange) {
      clearAllSelections();
    }
    
    // Reset sequential selection state when switching views
    if (view !== 'weekly') {
      setStartWeekIndex(null);
      setEndWeekIndex(null);
      setWeekSelectionDirection(null);
    } else {
      // Reset to current quarter when switching to weekly view
      const now = new Date();
      setCurrentQuarter(Math.floor(now.getMonth() / 3));
      setCurrentQuarterYear(now.getFullYear());
    }
    if (view !== 'monthly') {
      setStartMonthKey(null);
    }
    onViewChange?.(view);
  };

  // Month names
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthNamesFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const weekdayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Check if date is in the past (before or equal to mostRecentDataDate)
  const isDateAvailable = (date: Date): boolean => {
    const normalized = normalizeDate(date);
    return normalized >= signUp && normalized <= today;
  };

  // Check if date is in selected range
  const isDateInRange = (date: Date): boolean => {
    if (!selectedRange) return false;
    const normalized = normalizeDate(date);
    const start = normalizeDate(selectedRange.startDate);
    const end = normalizeDate(selectedRange.endDate);
    return normalized >= start && normalized <= end;
  };

  // Check if date is range start
  const isRangeStart = (date: Date): boolean => {
    if (!selectedRange) return false;
    return normalizeDate(date).getTime() === normalizeDate(selectedRange.startDate).getTime();
  };

  // Check if date is range end
  const isRangeEnd = (date: Date): boolean => {
    if (!selectedRange) return false;
    return normalizeDate(date).getTime() === normalizeDate(selectedRange.endDate).getTime();
  };

  // Handle date selection (daily view)
  const handleDateClick = (date: Date) => {
    const normalized = normalizeDate(date);
    
    // Don't allow selection of unavailable dates
    if (!isDateAvailable(date)) return;

    // If clicking on an existing range, deselect it
    if (selectedRange && isDateInRange(date)) {
      setSelectedRange(null);
      setTempStartDate(null);
      onDateRangeSelect?.(normalizeDate(selectedRange.startDate), null);
      return;
    }

    // If no temp start date, set this as start
    if (!tempStartDate) {
      setTempStartDate(normalized);
      return;
    }

    // If temp start exists, create range
    const start = tempStartDate < normalized ? tempStartDate : normalized;
    const end = tempStartDate < normalized ? normalized : tempStartDate;
    
    const range: DateRange = { startDate: start, endDate: end };
    setSelectedRange(range);
    setTempStartDate(null);
    onDateRangeSelect?.(start, end);
  };

  // Generate calendar days for daily view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isAvailable: boolean;
      isInRange: boolean;
      isRangeStart: boolean;
      isRangeEnd: boolean;
      isTempStart: boolean;
    }> = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const normalized = normalizeDate(date);

      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isAvailable: isDateAvailable(date),
        isInRange: isDateInRange(date),
        isRangeStart: isRangeStart(date),
        isRangeEnd: isRangeEnd(date),
        isTempStart: tempStartDate ? normalized.getTime() === tempStartDate.getTime() : false,
      });
    }

    return days;
  }, [currentMonth, selectedRange, tempStartDate, today, signUp]);

  // Helper: Get quarter start and end dates
  const getQuarterDates = (quarter: number, year: number) => {
    const quarterStartMonth = quarter * 3; // 0, 3, 6, 9
    const quarterEndMonth = quarterStartMonth + 2; // 2, 5, 8, 11
    const quarterStart = new Date(year, quarterStartMonth, 1);
    const quarterEnd = new Date(year, quarterEndMonth + 1, 0); // Last day of last month
    return { quarterStart, quarterEnd };
  };

  // Helper: Navigate quarters
  const navigateQuarter = (direction: 'prev' | 'next') => {
    let newQuarter = direction === 'prev' ? currentQuarter - 1 : currentQuarter + 1;
    let newYear = currentQuarterYear;

    if (newQuarter < 0) {
      newQuarter = 3; // Q4 of previous year
      newYear -= 1;
    } else if (newQuarter > 3) {
      newQuarter = 0; // Q1 of next year
      newYear += 1;
    }

    setCurrentQuarter(newQuarter);
    setCurrentQuarterYear(newYear);
  };

  // Generate weeks for weekly view (all weeks, but mark future ones as disabled)
  const weeks = useMemo(() => {
    const weeksList: Array<{
      start: Date;
      end: Date;
      month: string;
      year: number;
      isAvailable: boolean;
      isInRange: boolean;
      isRangeStart: boolean;
      isRangeEnd: boolean;
    }> = [];

    // Start from sign-up date
    const startDate = new Date(signUp);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday

    // Generate weeks for a reasonable future period (e.g., 2 years ahead)
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + 2);

    let currentWeekStart = new Date(startDate);
    while (currentWeekStart <= endDate) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      // Include all weeks, but mark availability based on date
      const weekStartNorm = normalizeDate(currentWeekStart);
      const isAvailable = weekStartNorm >= signUp && weekStartNorm <= today;

      weeksList.push({
        start: new Date(currentWeekStart),
        end: new Date(weekEnd),
        month: monthNamesFull[currentWeekStart.getMonth()].toUpperCase(),
        year: currentWeekStart.getFullYear(),
        isAvailable,
        isInRange: false,
        isRangeStart: false,
        isRangeEnd: false,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    // Mark range states
    if (selectedRange) {
      const rangeStart = normalizeDate(selectedRange.startDate);
      const rangeEnd = normalizeDate(selectedRange.endDate);

      weeksList.forEach(week => {
        const weekStart = normalizeDate(week.start);
        const weekEnd = normalizeDate(week.end);

        if (weekStart.getTime() === rangeStart.getTime()) {
          week.isRangeStart = true;
          week.isInRange = true;
        } else if (weekEnd.getTime() === rangeEnd.getTime()) {
          week.isRangeEnd = true;
          week.isInRange = true;
        } else if (weekStart >= rangeStart && weekEnd <= rangeEnd) {
          week.isInRange = true;
        }
      });
    }

    return weeksList;
  }, [selectedRange, today, signUp]);

  // Filter weeks for current quarter
  const currentQuarterWeeks = useMemo(() => {
    const { quarterStart, quarterEnd } = getQuarterDates(currentQuarter, currentQuarterYear);
    const quarterStartNorm = normalizeDate(quarterStart);
    const quarterEndNorm = normalizeDate(quarterEnd);

    return weeks.filter(week => {
      const weekStartNorm = normalizeDate(week.start);
      const weekEndNorm = normalizeDate(week.end);
      // Include weeks that overlap with the quarter
      return (weekStartNorm <= quarterEndNorm && weekEndNorm >= quarterStartNorm);
    });
  }, [weeks, currentQuarter, currentQuarterYear]);

  // Helper: Check if two weeks are consecutive
  const areWeeksConsecutive = (weekIndex1: number, weekIndex2: number): boolean => {
    return Math.abs(weekIndex1 - weekIndex2) === 1;
  };

  // Helper: Check if a week is part of the current range
  const isWeekInRange = (weekIndex: number, startIdx: number, endIdx: number): boolean => {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    return weekIndex >= minIdx && weekIndex <= maxIdx;
  };

  // Helper: Get all week indices between start and end (inclusive)
  const getWeekRangeIndices = (startIdx: number, endIdx: number): number[] => {
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);
    return Array.from({ length: maxIdx - minIdx + 1 }, (_, i) => minIdx + i);
  };

  // Helper: Calculate maximum week range (3 months = ~13 weeks)
  const getMaxWeekRange = (startWeekIdx: number): { minIndex: number; maxIndex: number } => {
    const MAX_WEEKS = 13; // 3 months approximately
    const minIndex = Math.max(0, startWeekIdx - (MAX_WEEKS - 1));
    const maxIndex = Math.min(weeks.length - 1, startWeekIdx + (MAX_WEEKS - 1));
    return { minIndex, maxIndex };
  };

  // Helper: Calculate week count between two indices
  const getWeekCount = (startIdx: number, endIdx: number): number => {
    return Math.abs(endIdx - startIdx) + 1;
  };

  // Helper: Check if week is at maximum range boundary
  const isAtMaxRange = (startIdx: number, endIdx: number, clickedIdx: number): boolean => {
    const currentCount = getWeekCount(startIdx, endIdx);
    
    // If already at max, check if clicking would extend beyond
    if (currentCount >= 13) {
      // Check if clicking would extend the range
      if (clickedIdx < startIdx) {
        // Would extend backward
        return true;
      } else if (clickedIdx > endIdx) {
        // Would extend forward
        return true;
      }
    }
    
    // Check if clicking would exceed max range
    if (clickedIdx < startIdx) {
      // Clicking backward
      const newCount = getWeekCount(clickedIdx, endIdx);
      return newCount > 13;
    } else if (clickedIdx > endIdx) {
      // Clicking forward
      const newCount = getWeekCount(startIdx, clickedIdx);
      return newCount > 13;
    }
    
    return false;
  };

  // Handle week selection (bidirectional, max 13 weeks / 3 months)
  const handleWeekClick = (weekStart: Date, weekIndex: number) => {
    const normalized = normalizeDate(weekStart);
    const MAX_WEEKS = 13; // Maximum 3 months of weeks

    // If clicking within existing range, deselect entire range
    if (selectedRange && startWeekIndex !== null && endWeekIndex !== null) {
      if (isWeekInRange(weekIndex, startWeekIndex, endWeekIndex)) {
        // Clicked within range - deselect all
        const rangeStart = normalizeDate(selectedRange.startDate);
        setSelectedRange(null);
        setTempStartDate(null);
        setStartWeekIndex(null);
        setEndWeekIndex(null);
        setWeekSelectionDirection(null);
        onDateRangeSelect?.(rangeStart, null);
        return;
      }
    }

    // If no start week selected, set this as start
    if (startWeekIndex === null) {
      setStartWeekIndex(weekIndex);
      setEndWeekIndex(weekIndex);
      setWeekSelectionDirection(null);
      setTempStartDate(normalized);
      // Select just this week
      const weekEnd = new Date(normalized);
      weekEnd.setDate(normalized.getDate() + 6);
      const range: DateRange = { startDate: normalized, endDate: weekEnd };
      setSelectedRange(range);
      onDateRangeSelect?.(normalized, weekEnd);
      return;
    }

    // We have a selection, check if we can extend it
    const currentStartIdx = startWeekIndex;
    const currentEndIdx = endWeekIndex!;
    const currentDirection = weekSelectionDirection;

    // Determine if clicked week is consecutive to start or end
    const isConsecutiveToStart = areWeeksConsecutive(currentStartIdx, weekIndex);
    const isConsecutiveToEnd = areWeeksConsecutive(currentEndIdx, weekIndex);

    // Determine direction of click relative to current range
    const isClickingBefore = weekIndex < currentStartIdx;
    const isClickingAfter = weekIndex > currentEndIdx;

    // Check if consecutive and in valid direction
    if ((isConsecutiveToStart && isClickingBefore) || (isConsecutiveToEnd && isClickingAfter)) {
      // Consecutive in valid direction - check if within max range
      if (isAtMaxRange(currentStartIdx, currentEndIdx, weekIndex)) {
        // Would exceed max range - do nothing
        return;
      }

      // Determine new boundaries
      let newStartIdx = currentStartIdx;
      let newEndIdx = currentEndIdx;
      let newDirection: 'forward' | 'backward' | null = currentDirection;

      if (isClickingBefore) {
        // Extending backward
        newStartIdx = weekIndex;
        newDirection = 'backward';
      } else {
        // Extending forward
        newEndIdx = weekIndex;
        newDirection = 'forward';
      }

      // If this is the second week, set direction
      if (currentStartIdx === currentEndIdx) {
        newDirection = isClickingBefore ? 'backward' : 'forward';
      }

      // Validate direction consistency - don't allow bidirectional
      if (currentDirection === 'forward' && isClickingBefore) {
        // Trying to extend backward when already going forward - clear and start fresh
        setStartWeekIndex(weekIndex);
        setEndWeekIndex(weekIndex);
        setWeekSelectionDirection(null);
        setTempStartDate(normalized);
        const weekEnd = new Date(normalized);
        weekEnd.setDate(normalized.getDate() + 6);
        const range: DateRange = { startDate: normalized, endDate: weekEnd };
        setSelectedRange(range);
        onDateRangeSelect?.(normalized, weekEnd);
        return;
      }

      if (currentDirection === 'backward' && isClickingAfter) {
        // Trying to extend forward when already going backward - clear and start fresh
        setStartWeekIndex(weekIndex);
        setEndWeekIndex(weekIndex);
        setWeekSelectionDirection(null);
        setTempStartDate(normalized);
        const weekEnd = new Date(normalized);
        weekEnd.setDate(normalized.getDate() + 6);
        const range: DateRange = { startDate: normalized, endDate: weekEnd };
        setSelectedRange(range);
        onDateRangeSelect?.(normalized, weekEnd);
        return;
      }

      // Update selection
      const startWeek = weeks[newStartIdx];
      const endWeek = weeks[newEndIdx];
      const rangeStartDate = normalizeDate(startWeek.start);
      const rangeEndDate = normalizeDate(endWeek.end);

      setStartWeekIndex(newStartIdx);
      setEndWeekIndex(newEndIdx);
      setWeekSelectionDirection(newDirection);

      const range: DateRange = { startDate: rangeStartDate, endDate: rangeEndDate };
      setSelectedRange(range);
      onDateRangeSelect?.(rangeStartDate, rangeEndDate);
    } else {
      // Not consecutive - clear previous selection and start fresh
      setStartWeekIndex(weekIndex);
      setEndWeekIndex(weekIndex);
      setWeekSelectionDirection(null);
      setTempStartDate(normalized);
      const weekEnd = new Date(normalized);
      weekEnd.setDate(normalized.getDate() + 6);
      const range: DateRange = { startDate: normalized, endDate: weekEnd };
      setSelectedRange(range);
      onDateRangeSelect?.(normalized, weekEnd);
    }
  };

  // Generate months for monthly view
  const months = useMemo(() => {
    const monthsList: Array<{
      year: number;
      month: number;
      date: Date;
      isAvailable: boolean;
      isSelected: boolean;
    }> = [];

    const startYear = signUp.getFullYear();
    const startMonth = signUp.getMonth();
    const endYear = today.getFullYear();
    const endMonth = today.getMonth();

    for (let year = startYear; year <= endYear; year++) {
      const monthStart = year === startYear ? startMonth : 0;
      const monthEnd = year === endYear ? endMonth : 11;

      for (let month = monthStart; month <= monthEnd; month++) {
        const monthDate = new Date(year, month, 1);
        const monthKey = `${year}-${month}`;
        monthsList.push({
          year,
          month,
          date: monthDate,
          isAvailable: true,
          isSelected: selectedMonths.has(monthKey),
        });
      }
    }

    return monthsList;
  }, [selectedMonths, today, signUp]);

  // Helper: Check if two months are consecutive
  const areMonthsConsecutive = (monthKey1: string, monthKey2: string): boolean => {
    const [year1, month1] = monthKey1.split('-').map(Number);
    const [year2, month2] = monthKey2.split('-').map(Number);
    
    // Calculate month indices (0-11) across years
    const monthIndex1 = year1 * 12 + month1;
    const monthIndex2 = year2 * 12 + month2;
    
    return Math.abs(monthIndex1 - monthIndex2) === 1;
  };

  // Helper: Check if a month is part of the current range
  const isMonthInRange = (monthKey: string, startKey: string, endKey: string): boolean => {
    const [startYear, startMonth] = startKey.split('-').map(Number);
    const [endYear, endMonth] = endKey.split('-').map(Number);
    const [checkYear, checkMonth] = monthKey.split('-').map(Number);
    
    const startIndex = startYear * 12 + startMonth;
    const endIndex = endYear * 12 + endMonth;
    const checkIndex = checkYear * 12 + checkMonth;
    
    const minIdx = Math.min(startIndex, endIndex);
    const maxIdx = Math.max(startIndex, endIndex);
    
    return checkIndex >= minIdx && checkIndex <= maxIdx;
  };

  // Helper: Get all month keys between start and end (inclusive)
  const getMonthRangeKeys = (startKey: string, endKey: string): string[] => {
    const [startYear, startMonth] = startKey.split('-').map(Number);
    const [endYear, endMonth] = endKey.split('-').map(Number);
    
    const startIndex = startYear * 12 + startMonth;
    const endIndex = endYear * 12 + endMonth;
    
    const minIdx = Math.min(startIndex, endIndex);
    const maxIdx = Math.max(startIndex, endIndex);
    
    const keys: string[] = [];
    for (let i = minIdx; i <= maxIdx; i++) {
      const year = Math.floor(i / 12);
      const month = i % 12;
      keys.push(`${year}-${month}`);
    }
    
    return keys;
  };

  // Handle month selection (sequential only)
  const handleMonthClick = (year: number, month: number) => {
    const monthKey = `${year}-${month}`;
    const monthDate = new Date(year, month, 1);
    const normalized = normalizeDate(monthDate);

    // If clicking within existing range, deselect entire range
    if (selectedRange && startMonthKey) {
      // Find end month key from selected range
      const rangeEnd = normalizeDate(selectedRange.endDate);
      const endYear = rangeEnd.getFullYear();
      const endMonth = rangeEnd.getMonth();
      const endMonthKey = `${endYear}-${endMonth}`;

      if (isMonthInRange(monthKey, startMonthKey, endMonthKey)) {
        // Clicked within range - deselect all
        setSelectedRange(null);
        setSelectedMonths(new Set());
        setStartMonthKey(null);
        onDateRangeSelect?.(normalized, null);
        return;
      }
    }

    // If no start month selected, set this as start
    if (startMonthKey === null) {
      setStartMonthKey(monthKey);
      setSelectedMonths(new Set([monthKey]));
      const endDate = new Date(year, month + 1, 0); // Last day of month
      const range: DateRange = { startDate: normalized, endDate };
      setSelectedRange(range);
      onDateRangeSelect?.(normalized, endDate);
      return;
    }

    // Find current range boundaries
    const rangeStart = normalizeDate(selectedRange!.startDate);
    const rangeEnd = normalizeDate(selectedRange!.endDate);
    const endYear = rangeEnd.getFullYear();
    const endMonth = rangeEnd.getMonth();
    const endMonthKey = `${endYear}-${endMonth}`;

    // Check if clicked month is consecutive to either start or end of current range
    const isConsecutiveToStart = areMonthsConsecutive(startMonthKey, monthKey);
    const isConsecutiveToEnd = areMonthsConsecutive(endMonthKey, monthKey);

    if (isConsecutiveToStart || isConsecutiveToEnd) {
      // Consecutive - extend range
      const [startYear, startMonth] = startMonthKey.split('-').map(Number);
      const startDate = new Date(startYear, startMonth, 1);
      const clickedEndDate = new Date(year, month + 1, 0); // Last day of clicked month
      
      // Determine actual start and end (extend in the direction clicked)
      const rangeStartDate = normalized < rangeStart ? normalized : rangeStart;
      const rangeEndDate = clickedEndDate > rangeEnd ? clickedEndDate : rangeEnd;
      
      // Determine which month key is the new start (earliest)
      const newStartKey = normalized < rangeStart ? monthKey : startMonthKey;
      const newEndKey = clickedEndDate > rangeEnd ? monthKey : endMonthKey;
      
      // Get all months in range
      const rangeKeys = getMonthRangeKeys(newStartKey, newEndKey);
      setSelectedMonths(new Set(rangeKeys));
      setStartMonthKey(newStartKey);
      
      const range: DateRange = { startDate: rangeStartDate, endDate: rangeEndDate };
      setSelectedRange(range);
      onDateRangeSelect?.(rangeStartDate, rangeEndDate);
    } else {
      // Not consecutive - clear previous selection and start fresh
      setStartMonthKey(monthKey);
      setSelectedMonths(new Set([monthKey]));
      const endDate = new Date(year, month + 1, 0);
      const range: DateRange = { startDate: normalized, endDate };
      setSelectedRange(range);
      onDateRangeSelect?.(normalized, endDate);
    }
  };

  // Group weeks by month for current quarter
  const weeksByMonth = useMemo(() => {
    const grouped: Record<string, typeof currentQuarterWeeks> = {};
    currentQuarterWeeks.forEach(week => {
      const key = `${week.month}-${week.year}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(week);
    });
    return grouped;
  }, [currentQuarterWeeks]);

  // Get quarter display name
  const getQuarterDisplayName = () => {
    const quarterMonths = [
      ['JANUARY', 'FEBRUARY', 'MARCH'],
      ['APRIL', 'MAY', 'JUNE'],
      ['JULY', 'AUGUST', 'SEPTEMBER'],
      ['OCTOBER', 'NOVEMBER', 'DECEMBER']
    ];
    const months = quarterMonths[currentQuarter];
    return `${months[0]} - ${months[2]} ${currentQuarterYear}`;
  };

  // Group months by year for monthly view
  const monthsByYear = useMemo(() => {
    const grouped: Record<number, typeof months> = {};
    months.forEach(month => {
      if (!grouped[month.year]) {
        grouped[month.year] = [];
      }
      grouped[month.year].push(month);
    });
    return grouped;
  }, [months]);

  // Check if there's a valid selection
  const hasValidSelection = selectedRange !== null;

  // Format selected date range for display
  const formatSelectedDateRange = (): string => {
    if (!selectedRange) return '';
    
    const formatDate = (date: Date) => {
      return monthNamesFull[date.getMonth()].substring(0, 3) + ' ' + date.getDate() + ', ' + date.getFullYear();
    };
    
    const start = formatDate(selectedRange.startDate);
    const end = formatDate(selectedRange.endDate);
    
    // If same date, show single date
    if (normalizeDate(selectedRange.startDate).getTime() === normalizeDate(selectedRange.endDate).getTime()) {
      return start;
    }
    
    return `${start} - ${end}`;
  };

  // Handle apply button click
  const handleApply = () => {
    if (hasValidSelection && onApply) {
      onApply(selectedRange.startDate, selectedRange.endDate);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-[#EEEEEE] overflow-hidden" style={{ minHeight: '100%' }}>
      {/* Close Button */}
      {onClose && (
        <div className="flex justify-end p-2 border-b border-[#EEEEEE] bg-white">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#EFEFEF] rounded transition-colors duration-150"
            aria-label="Close"
          >
            <X size={18} className="text-[#333333]" />
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[150px] flex-shrink-0 border-r border-[#EEEEEE] bg-[#F5F5F5] p-4">
        <div className="text-[12px] text-[var(--text-headings)] mb-4 font-medium">Select Period</div>

        <div className="flex flex-col gap-2">
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map((view) => {
            const getIcon = () => {
              switch (view) {
                case 'daily':
                  return <IconCalendarEventFilled size={16} />;
                case 'weekly':
                  return <IconCalendarWeekFilled size={16} />;
                case 'monthly':
                  return <IconCalendarMonthFilled size={16} />;
                default:
                  return <IconCalendarEventFilled size={16} />;
              }
            };

            const getLabel = () => {
              switch (view) {
                case 'daily':
                  return 'Daily';
                case 'weekly':
                  return 'Weekly';
                case 'monthly':
                  return 'Monthly';
                default:
                  return view;
              }
            };

            return (
              <button
                key={view}
                onClick={() => handleViewChange(view)}
                className={`
                  h-10 rounded-xl px-3 flex items-center gap-2 transition-all duration-150 relative
                  ${activeView === view
                    ? 'text-[var(--text-headings)] font-medium'
                    : 'bg-[#F5F5F5] text-[#333333] hover:bg-[#EFEFEF]'
                  }
                `}
              >
                <span className={activeView === view ? 'text-[var(--text-headings)]' : ''}>
                  {getIcon()}
                </span>
                <span className={`text-sm ${activeView === view ? 'text-[var(--text-headings)]' : ''}`}>
                  {getLabel()}
                </span>
                {activeView === view && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent500)] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-auto p-6">
        {/* Daily View */}
        {activeView === 'daily' && (
          <div>
            {/* Header with month/year and navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-[#EFEFEF] rounded transition-colors duration-150"
              >
                <ChevronLeft size={20} className="text-[#333333]" />
              </button>

              <h3 className="text-lg font-semibold text-[#333333]">
                {monthNamesFull[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>

              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-[#EFEFEF] rounded transition-colors duration-150"
              >
                <ChevronRight size={20} className="text-[#333333]" />
              </button>
            </div>

            {/* Weekday row */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekdayNames.map((day) => (
                <div
                  key={day}
                  className="text-[12px] font-bold text-[#666666] text-center py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const isDisabled = !day.isCurrentMonth || !day.isAvailable;
                const isInRange = day.isInRange && !day.isRangeStart && !day.isRangeEnd;
                const isStartOrEnd = day.isRangeStart || day.isRangeEnd || day.isTempStart;

                return (
                  <button
                    key={index}
                    onClick={() => handleDateClick(day.date)}
                    disabled={isDisabled}
                    className={`
                      w-[50px] h-[50px] rounded-full transition-all duration-150 flex items-center justify-center text-sm relative
                      ${isDisabled
                        ? 'text-[#CCCCCC] opacity-60 cursor-not-allowed'
                        : isStartOrEnd
                          ? 'bg-[var(--accent200)] border-2 border-[var(--accent500)] text-[var(--text-headings)] font-medium'
                          : isInRange
                            ? 'bg-[var(--accent200)] text-[var(--text-headings)] font-medium'
                            : 'text-[#333333] hover:text-[var(--text-headings)]'
                      }
                    `}
                  >
                    {day.date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly View */}
        {activeView === 'weekly' && (
          <div className="space-y-6">
            {/* Quarter Header with Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => navigateQuarter('prev')}
                className="p-2 hover:bg-[#EFEFEF] rounded transition-colors duration-150"
              >
                <ChevronLeft size={20} className="text-[#333333]" />
              </button>

              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold text-[#333333]">
                  {getQuarterDisplayName()}
                </h3>
                {startWeekIndex !== null && endWeekIndex !== null && (
                  <span className="text-xs text-[#666666] mt-1">
                    {getWeekCount(startWeekIndex, endWeekIndex)} week{getWeekCount(startWeekIndex, endWeekIndex) !== 1 ? 's' : ''} selected (max 13)
                  </span>
                )}
              </div>

              <button
                onClick={() => navigateQuarter('next')}
                className="p-2 hover:bg-[#EFEFEF] rounded transition-colors duration-150"
              >
                <ChevronRight size={20} className="text-[#333333]" />
              </button>
            </div>

            {/* Weeks grouped by month */}
            {Object.entries(weeksByMonth).map(([key, monthWeeks]) => {
              const [month, year] = key.split('-');
              return (
                <div key={key}>
                  <h3 className="text-base font-bold text-[#333333] mb-3 col-span-2">
                    {month} {year}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {monthWeeks.map((week, index) => {
                      const formatDate = (date: Date) => {
                        return monthNamesFull[date.getMonth()].substring(0, 3) + ' ' + date.getDate();
                      };

                      // Find the week index in the full weeks array
                      const weekIndex = weeks.findIndex(w => 
                        normalizeDate(w.start).getTime() === normalizeDate(week.start).getTime()
                      );

                      const isStartOrEnd = week.isRangeStart || week.isRangeEnd;
                      const isInRange = week.isInRange && !isStartOrEnd;
                      const isDisabled = !week.isAvailable; // Disabled if past current date
                      
                      // Check if this week is at maximum range boundary
                      let isAtMaxBoundary = false;
                      if (startWeekIndex !== null && endWeekIndex !== null && !isDisabled && !isInRange && !isStartOrEnd) {
                        // Check if this week is consecutive to the range and would exceed max
                        const isConsecutiveToStart = areWeeksConsecutive(startWeekIndex, weekIndex) && weekIndex < startWeekIndex;
                        const isConsecutiveToEnd = areWeeksConsecutive(endWeekIndex, weekIndex) && weekIndex > endWeekIndex;
                        
                        if (isConsecutiveToStart || isConsecutiveToEnd) {
                          isAtMaxBoundary = isAtMaxRange(startWeekIndex, endWeekIndex, weekIndex);
                        }
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => !isDisabled && !isAtMaxBoundary && handleWeekClick(week.start, weekIndex)}
                          disabled={isDisabled || isAtMaxBoundary}
                          className={`
                            h-10 rounded-xl px-3 text-left text-sm transition-all duration-150 relative
                            ${isDisabled
                              ? 'bg-transparent text-[#CCCCCC] opacity-60 border border-[#CCCCCC] cursor-not-allowed'
                              : isAtMaxBoundary
                                ? 'bg-transparent text-[#999999] opacity-50 border border-[#CCCCCC] cursor-not-allowed'
                                : isStartOrEnd
                                  ? 'bg-[var(--accent200)] border-2 border-[var(--accent500)] text-[var(--text-headings)] font-medium'
                                  : isInRange
                                    ? 'bg-[var(--accent200)] text-[var(--text-headings)] font-medium border border-[#CCCCCC]'
                                    : 'bg-transparent text-[#333333] border border-[#CCCCCC] hover:bg-[#EFEFEF]'
                            }
                          `}
                          title={isAtMaxBoundary ? 'Maximum range reached (13 weeks)' : undefined}
                        >
                          {formatDate(week.start)} - {formatDate(week.end)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Monthly View */}
        {activeView === 'monthly' && (
          <div className="space-y-8">
            {Object.entries(monthsByYear).map(([yearStr, yearMonths]) => {
              const year = parseInt(yearStr);
              return (
                <div key={year}>
                  <h3 className="text-base font-bold text-[#333333] mb-4">{year}</h3>

                  <div className="grid grid-cols-7 gap-3">
                    {yearMonths.map((monthItem) => {
                      return (
                        <button
                          key={`${monthItem.year}-${monthItem.month}`}
                          onClick={() => handleMonthClick(monthItem.year, monthItem.month)}
                          className={`
                            w-[70px] h-[70px] rounded-full text-xs font-medium transition-all duration-150 flex items-center justify-center
                            ${monthItem.isSelected
                              ? 'bg-[var(--accent200)] border-2 border-[var(--accent500)] text-[var(--text-headings)]'
                              : 'bg-white text-[#333333] border border-[#CCCCCC] hover:border-[#00BCDC]'
                            }
                          `}
                        >
                          {monthNames[monthItem.month]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Apply Button */}
      <div className="border-t border-[#EEEEEE] p-4 flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex-1">
          {hasValidSelection && (
            <p className="text-sm text-[var(--text-body)]">
              <span className="font-medium">Selected Period:</span> {formatSelectedDateRange()}
            </p>
          )}
        </div>
        <button
          onClick={handleApply}
          disabled={!hasValidSelection}
          className={`
            px-6 py-2 rounded-lg font-medium text-sm transition-all duration-150
            ${hasValidSelection
              ? 'bg-[var(--accent500)] text-white hover:bg-[var(--accent600)] cursor-pointer'
              : 'bg-[#CCCCCC] text-[#999999] cursor-not-allowed'
            }
          `}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default DatePickerMultiView;
