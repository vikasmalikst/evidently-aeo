import React, { useMemo } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib-landing/utils';
import { formatDateDisplay } from '../../utils/dateFormatting';

interface DateRangeSliderProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onRangeChange: (start: string, end: string) => void;
  maxDays?: number;
  className?: string;
}

export const DateRangeSlider = ({
  startDate,
  endDate,
  onRangeChange,
  maxDays = 90,
  className
}: DateRangeSliderProps) => {
  // We represent the timeline as negative days from today
  // 0 = today, maxDays = maxDays ago
  
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const dateToSliderValue = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr + 'T00:00:00');
    const diffTime = today.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(maxDays, diffDays));
  };

  const sliderValueToDate = (value: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Radix Slider values: MUST be in ascending order [minValue, maxValue]
  const values = useMemo(() => {
    const startVal = dateToSliderValue(startDate);
    const endVal = dateToSliderValue(endDate);
    return [Math.min(startVal, endVal), Math.max(startVal, endVal)];
  }, [startDate, endDate]);

  const handleValueChange = (newValues: number[]) => {
    // newValues is [smaller, larger]
    // smaller value = closer to today (recent date) = endDate
    // larger value = further in past (older date) = startDate
    const [recentVal, pastVal] = newValues;
    const startStr = sliderValueToDate(pastVal);
    const endStr = sliderValueToDate(recentVal);
    onRangeChange(startStr, endStr);
  };

  return (
    <div className={cn("flex flex-col gap-3 w-full max-w-[400px] px-2 py-4", className)}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Timeline Selection</span>
        <div className="flex items-center gap-2">
           <span className="text-[12px] font-bold text-[#00bcdc] bg-cyan-50 px-2 py-0.5 rounded">
             {formatDateDisplay(startDate)} — {formatDateDisplay(endDate)}
           </span>
        </div>
      </div>
      
      <SliderPrimitive.Root
        min={0}
        max={maxDays}
        step={1}
        value={values}
        onValueChange={handleValueChange}
        minStepsBetweenThumbs={0}
        className="relative flex w-full touch-none items-center select-none"
        inverted // Because 0 is "latest" and max is "oldest"
      >
        <SliderPrimitive.Track className="bg-slate-100 relative grow overflow-hidden rounded-full h-1.5 w-full border border-slate-200/50">
          <SliderPrimitive.Range className="bg-[#00bcdc] absolute h-full rounded-full" />
        </SliderPrimitive.Track>
        
        {/* Thumb 1: Start Date (Past) */}
        <SliderPrimitive.Thumb 
          className="block w-5 h-5 bg-white border-2 border-[#00bcdc] shadow-lg rounded-full focus:outline-none focus:ring-4 focus:ring-cyan-500/20 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          aria-label="Start Date"
        />
        
        {/* Thumb 2: End Date (Recent) */}
        <SliderPrimitive.Thumb 
          className="block w-5 h-5 bg-white border-2 border-[#00bcdc] shadow-lg rounded-full focus:outline-none focus:ring-4 focus:ring-cyan-500/20 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
          aria-label="End Date"
        />
      </SliderPrimitive.Root>
      
      <div className="flex justify-between text-[10px] font-medium text-slate-400">
        <span>{maxDays} days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};
