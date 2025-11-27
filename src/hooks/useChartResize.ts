import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle chart resize when window size changes
 * This is particularly useful when browser dev tools open/close
 * 
 * @param chartRef - Reference to the Chart.js chart instance
 * @param enabled - Whether resize handling is enabled (default: true)
 */
export const useChartResize = (chartRef: React.RefObject<any>, enabled: boolean = true) => {
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !chartRef.current) return;

    const handleResize = () => {
      // Debounce resize events to avoid excessive calls
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = setTimeout(() => {
        const chart = chartRef.current;
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation changes on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [chartRef, enabled]);
};

