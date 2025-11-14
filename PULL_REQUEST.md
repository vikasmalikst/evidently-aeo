# Topics Analysis Visualization Overhaul

## Overview
This PR introduces a comprehensive overhaul of the topics analysis visualization system, adding multiple chart types, improved filtering capabilities, enhanced date selection, and a complete redesign of the Topics page with rich analytics components.

## Major Features

### 🎯 New Topics Analysis Page
- **Complete redesign** of the Topics page with a dedicated `TopicsAnalysisPage` component
- **Multi-view chart system** supporting Racing Bar, Bar, Line, and Donut chart types
- **Compact metrics pods** displaying key performance indicators
- **Sortable ranked table** with category filtering and tag-based filters
- **Date range selection** with daily, weekly, and monthly views via enhanced DatePickerMultiView
- **Country/region filtering** with visual flag indicators
- **Topic selection** with shared state between charts and table

### 📊 Enhanced Chart Components

#### Citations/Sources Charts
- **New chart types**: Added Bar Chart and Line Chart options alongside existing Racing and Donut charts
- **Unified chart container** (`SourcesChartContainer`) for consistent chart switching
- **Enhanced chart selector** with icon-based navigation and improved UX
- **Category and time series filtering** integrated into chart controls
- **Export functionality** support added to chart controls

#### Topics Charts
- **TopicsRacingBarChart**: Animated racing bar chart using Nivo
- **TopicsBarChart**: Static bar chart using Chart.js
- **TopicsLineChart**: Time series line chart with trend visualization
- **TopicsDonutChart**: Distribution visualization
- **Chart type selector** with seamless switching between visualization modes
- **Consistent styling** using CSS variables for theming

### 🗓️ DatePickerMultiView Enhancements
- **Visual improvements**: Underline indicators for time period selection, circular highlights for dates
- **Sequential selection logic**: 
  - Weekly view: Bidirectional selection (forward/backward) with 13-week maximum
  - Monthly view: Consecutive month selection only
- **Quarterly organization**: Weeks organized into Q1-Q4 quarters with navigation
- **User controls**: Apply button, close button, and selected date range display
- **Modal improvements**: Expanded size, better padding, improved scrolling

### 🏳️ Country Flag Component
- **New reusable component** (`CountryFlag`) for displaying country flags
- **Support for 7 countries**: US, Canada, UK, India, South Korea, China, Japan
- **Regional support**: Globe icon for multi-country regions (LATAM, EMEA, Southeast Asia, etc.)
- **Consistent sizing**: 16px default with customizable styling
- **Accessibility**: ARIA labels and proper semantic HTML

### 🎨 UI/UX Improvements

#### Chart Controls
- **Country flags in dropdowns**: Visual indicators for country/region selection
- **Improved dropdown styling**: Better hover states and visual feedback
- **Separated country and region options**: Clear distinction between single countries and multi-country regions
- **Enhanced accessibility**: Better keyboard navigation and screen reader support

#### Prompt Filters
- **Enhanced filtering UI**: Improved category and tag filtering
- **Better visual hierarchy**: Clearer organization of filter options
- **Consistent styling**: Aligned with design system tokens

## Technical Details

### New Components
- `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx` - Main topics analysis page
- `src/pages/TopicsAnalysis/components/CompactMetricsPods.tsx` - Metrics display
- `src/pages/TopicsAnalysis/components/TopicsRankedTable.tsx` - Sortable table
- `src/pages/TopicsAnalysis/components/TopicAnalysisMultiView.tsx` - Chart container
- `src/pages/TopicsAnalysis/components/TopicsBarChart.tsx` - Bar chart visualization
- `src/pages/TopicsAnalysis/components/TopicsLineChart.tsx` - Line chart visualization
- `src/pages/TopicsAnalysis/components/TopicsRacingBarChart.tsx` - Racing bar chart
- `src/pages/TopicsAnalysis/components/TopicsDonutChart.tsx` - Donut chart
- `src/pages/TopicsAnalysis/components/TopicsChartTypeSelector.tsx` - Chart type selector
- `src/components/Citations/SourcesChartContainer.tsx` - Unified chart container
- `src/components/Citations/SourcesBarChart.tsx` - Sources bar chart
- `src/components/Citations/SourcesLineChart.tsx` - Sources line chart
- `src/components/CountryFlag.tsx` - Country flag component
- `src/components/DatePicker/DatePickerMultiView.tsx` - Enhanced date picker

### Enhanced Components
- `src/components/Citations/ChartTypeSelector.tsx` - Added icon-based navigation, category/time series filters
- `src/components/Visibility/ChartControls.tsx` - Added country flags, improved dropdowns
- `src/components/Prompts/PromptFilters.tsx` - Enhanced filtering UI
- `src/pages/Topics.tsx` - Simplified to use new TopicsAnalysisPage component

### Dependencies
- Added `country-flag-icons` package for country flag support
- Enhanced Chart.js usage for new chart types
- Nivo charts for racing bar visualization

## Design System Integration

All components use CSS variables from the design system:
- Colors: `--accent500`, `--accent-primary`, `--text-headings`, `--text-body`, etc.
- Chart colors: `--chart-grid`, `--chart-label`, `--chart-axis`
- Spacing: Consistent 4px grid system
- Typography: Sora for headlines, IBM Plex Sans for body text

## Accessibility

- **WCAG 2.1 AA compliant** across all new components
- **Keyboard navigation** support for all interactive elements
- **ARIA labels** on icons and buttons
- **Screen reader friendly** table structures
- **Color + icon/symbol** for meaning (not color alone)
- **Contrast ratios** ≥ 4.5:1

## Responsive Design

- **Desktop**: Full width layouts, all features visible
- **Tablet (768px)**: Metrics cards stack, category cards 2x2 grid
- **Mobile (375px)**: Single column layouts, collapsible sections

## Testing Scenarios

### Topics Analysis Page
- ✅ Load topics data and display metrics pods
- ✅ Switch between chart types (Racing, Bar, Line, Donut)
- ✅ Filter by category and tags
- ✅ Select date ranges (daily, weekly, monthly)
- ✅ Filter by country/region
- ✅ Sort table by different columns
- ✅ Click topics to trigger callbacks

### Chart Components
- ✅ Switch between chart types in Citations/Sources
- ✅ Filter by category and time series
- ✅ Export chart data
- ✅ Responsive chart rendering
- ✅ Hover interactions and tooltips

### DatePickerMultiView
- ✅ Select date ranges in daily, weekly, monthly views
- ✅ Sequential week selection (forward/backward, max 13 weeks)
- ✅ Consecutive month selection
- ✅ Navigate between quarters
- ✅ Apply and close buttons work correctly

### Country Flags
- ✅ Display correct flags for supported countries
- ✅ Show globe icon for regions
- ✅ Proper sizing and styling
- ✅ Accessibility labels

## Breaking Changes
None - All changes are backward compatible. New components are additive.

## Migration Guide
No migration needed. Existing implementations will continue to work. To use new features:
- Import `TopicsAnalysisPage` for the new topics analysis experience
- Use `CountryFlag` component for country/region displays
- Pass `onApply` and `onClose` props to `DatePickerMultiView` for enhanced controls
- Use `SourcesChartContainer` for unified chart management

## Files Changed

### New Files
- `src/pages/TopicsAnalysis/TopicsAnalysisPage.tsx`
- `src/pages/TopicsAnalysis/components/*` (13 new component files)
- `src/pages/TopicsAnalysis/types.ts`
- `src/pages/TopicsAnalysis/mockData.ts`
- `src/pages/TopicsAnalysis/utils/chartColors.ts`
- `src/components/Citations/SourcesChartContainer.tsx`
- `src/components/Citations/SourcesBarChart.tsx`
- `src/components/Citations/SourcesLineChart.tsx`
- `src/components/CountryFlag.tsx`
- `src/components/DatePicker/DatePickerMultiView.tsx`

### Modified Files
- `src/pages/Topics.tsx` - Simplified to use new TopicsAnalysisPage
- `src/components/Citations/ChartTypeSelector.tsx` - Enhanced with icons and filters
- `src/components/Visibility/ChartControls.tsx` - Added country flags
- `src/components/Prompts/PromptFilters.tsx` - Enhanced filtering
- `src/pages/AISources.tsx` - Updated to use new chart components
- `src/pages/Dashboard.tsx` - Updated chart integrations
- `src/pages/SearchSources.tsx` - Updated chart integrations
- `package.json` - Added country-flag-icons dependency

## Future Enhancements
- Virtual scrolling for large topic datasets (>50 topics)
- Export functionality for charts and tables
- Drill-down detail panels on topic/bar clicks
- More filter options (date range presets, custom ranges)
- Chart animation controls
- Data export formats (CSV, PDF)
