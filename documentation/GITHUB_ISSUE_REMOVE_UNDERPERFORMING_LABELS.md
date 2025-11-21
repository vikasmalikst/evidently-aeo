# Remove "UNDERPERFORMING" Labels from Topics Analysis Charts

## Problem

The "UNDERPERFORMING" label (and "HIGH VALUE ZONE" label) are appearing on Topics Analysis charts (bar charts and line charts), where they don't belong. These labels are intended only for scatter/quadrant charts on the Search Sources and AI Sources pages.

## Root Cause

The `quadrantPlugin` registered globally in `SearchSources.tsx` and `AISources.tsx` was executing on all Chart.js charts throughout the application, including bar charts and line charts in Topics Analysis. The plugin uses the `beforeDraw` hook to draw quadrant lines and labels, but it wasn't checking the chart type before executing.

## Impact

- Visual clutter on Topics Analysis charts
- Incorrect labeling that doesn't apply to bar/line chart visualizations
- Confusing user experience

## Solution

Modified the `quadrantPlugin` in both `SearchSources.tsx` and `AISources.tsx` to:

1. **Check chart type**: Only execute for scatter charts (`chart.config.type === 'scatter'`)
2. **Validate scales**: Ensure required scales exist before accessing them

### Code Changes

**File: `src/pages/SearchSources.tsx`**
```typescript
const quadrantPlugin = {
  id: 'quadrantPlugin',
  beforeDraw: (chart: any) => {
    // Only run for scatter charts, not bar/line charts
    if (chart.config.type !== 'scatter') {
      return;
    }
    
    const ctx = chart.ctx;
    const chartArea = chart.chartArea;
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    
    // Ensure scales exist before proceeding
    if (!xScale || !yScale) {
      return;
    }
    // ... rest of plugin code
  }
};
```

**File: `src/pages/AISources.tsx`**
- Same changes as above

## Testing

- [x] Verify "UNDERPERFORMING" label no longer appears on Topics Analysis bar charts
- [x] Verify "UNDERPERFORMING" label no longer appears on Topics Analysis line charts
- [x] Verify "UNDERPERFORMING" label still appears correctly on Search Sources scatter charts
- [x] Verify "UNDERPERFORMING" label still appears correctly on AI Sources scatter charts
- [x] Build passes without errors

## Files Modified

- `src/pages/SearchSources.tsx`
- `src/pages/AISources.tsx`
- `src/pages/TopicsAnalysis/components/TopicsRacingBarChart.tsx` (removed duplicate plugins object)

## Related Components

- Topics Analysis Charts:
  - `TopicsRacingBarChart.tsx`
  - `TopicsBarChart.tsx`
  - `TopicsLineChart.tsx`

## Status

✅ **RESOLVED** - Fixed by adding chart type check to quadrantPlugin

## Notes

The plugin is registered globally using `ChartJS.register(quadrantPlugin)`, which means it affects all charts. By adding the chart type check, we ensure it only runs on the intended scatter charts while preventing it from interfering with other chart types.

