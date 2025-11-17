import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { IconChartBarPopular, IconChartBar, IconChartArea } from '@tabler/icons-react';

interface TopicsChartTypeSelectorProps {
  activeChart: 'racing' | 'bar' | 'line';
  onChartChange: (chart: 'racing' | 'bar' | 'line') => void;
}

export const TopicsChartTypeSelector = ({ activeChart, onChartChange }: TopicsChartTypeSelectorProps) => {
  const [highlightStyle, setHighlightStyle] = useState({ left: 0, width: 0 });
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const chartOptions = [
    { value: 'racing' as const, icon: IconChartBarPopular, label: 'Racing Chart', transform: 'rotate(90deg) scaleX(-1)' },
    { value: 'bar' as const, icon: IconChartBar, label: 'Bar Chart', transform: '' },
    { value: 'line' as const, icon: IconChartArea, label: 'Line Chart', transform: '' },
  ];

  // Update highlight position when activeChart changes
  const updateHighlightPosition = () => {
    const activeIndex = chartOptions.findIndex(opt => opt.value === activeChart);
    const activeButton = buttonRefs.current[activeIndex];
    
    if (activeButton) {
      const container = activeButton.parentElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        setHighlightStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
        });
      }
    }
  };

  useLayoutEffect(() => {
    // Initial position update - use layout effect for immediate positioning
    updateHighlightPosition();
  }, [activeChart]);

  useEffect(() => {
    // Update on window resize
    const handleResize = () => {
      updateHighlightPosition();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeChart]);

  return (
    <div className="relative inline-flex rounded-full border border-[var(--border-default)] p-1 bg-white shadow-sm gap-1">
      {/* Sliding highlight background */}
      <div
        className="absolute top-1 bottom-1 rounded-full bg-[var(--accent50)] border-2 border-[var(--accent-primary)] transition-all duration-300 ease-in-out"
        style={{
          left: `${highlightStyle.left}px`,
          width: `${highlightStyle.width}px`,
        }}
      />
      
      {chartOptions.map((option, index) => {
        const Icon = option.icon;
        const isActive = activeChart === option.value;
        
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onChartChange(option.value)}
            className={`relative z-10 p-2 rounded-full transition-all duration-300 ${
              isActive
                ? 'text-[var(--accent-primary)]'
                : 'text-[#6c7289] hover:text-[#212534]'
            }`}
            title={option.label}
            aria-label={option.label}
          >
            <Icon 
              size={18} 
              strokeWidth={isActive ? 2 : 1.5}
              style={{ transform: option.transform }}
            />
          </button>
        );
      })}
    </div>
  );
};

