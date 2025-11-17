# Topics Analysis Page

A comprehensive React component for analyzing topic performance across AI search engines, featuring sortable tables, category highlights, and performance metrics.

## Components

### TopicsAnalysisPage
Main container component that orchestrates all sub-components.

**Props:**
- `data: TopicsAnalysisData` - Complete topic analysis data
- `isLoading?: boolean` - Loading state
- `onTopicClick?: (topic: Topic) => void` - Callback when topic row is clicked
- `onCategoryFilter?: (categoryId: string) => void` - Callback when category is clicked

### HeadlineMetrics
Two-column metric cards displaying portfolio and performance snapshots.

**Features:**
- Portfolio card: Total topics, categories, search volume, last analyzed date
- Performance card: Average SoA, top performers, opportunity gaps, weekly gainer

### TopicsRankedTable
Primary visualization with sortable and filterable table.

**Features:**
- Sortable columns: Rank, Topic, SoA, Trend, Volume
- Category filter dropdown
- Tag filters: Trending, Gaps, Growing (multi-select OR logic)
- Display count toggle: 10, 15, or All rows
- Color-coded SoA values based on scale:
  - Cyan (#00BCDC): SoA ≥ 3.0x (Strong Position)
  - Teal (#0096b0): SoA 2.0–3.0x (Competitive)
  - Orange (#fa8a40): SoA 1.0–2.0x (Opportunity)
  - Navy (#1A1D29): SoA < 1.0x (Citation Gap)
- Hover states with contextual tooltips
- Keyboard accessible (Tab navigation, Enter/Space to activate)

### CategoryHighlights
Summary strip showing category performance with collapsible view.

**Features:**
- Responsive grid: 4 columns desktop, 2 tablet, 1 mobile
- Status icons: Leader (Trophy), Emerging (Search), Growing (TrendingUp), Declining (AlertTriangle)
- Clickable cards that filter main table
- Category-specific border colors

## Usage

```tsx
import { TopicsAnalysisPage } from './pages/TopicsAnalysis';
import { mockTopicsAnalysisData } from './pages/TopicsAnalysis/mockData';

function App() {
  return (
    <TopicsAnalysisPage
      data={mockTopicsAnalysisData}
      onTopicClick={(topic) => {
        // Handle topic click - future: open detail panel
        console.log('Topic clicked:', topic);
      }}
      onCategoryFilter={(categoryId) => {
        // Handle category filter
        console.log('Category filtered:', categoryId);
      }}
    />
  );
}
```

## Data Structure

See `types.ts` for complete TypeScript interfaces. Key structure:

```typescript
{
  portfolio: {
    totalTopics: number;
    searchVolume: number;
    categories: number;
    lastUpdated: string; // ISO date
  },
  performance: {
    avgSoA: number;
    maxSoA: number;
    minSoA: number;
    weeklyGainer: { topic: string; delta: number; category: string; }
  },
  topics: Topic[],
  categories: Category[]
}
```

## Design System

Uses CSS variables from `tokens.css`:
- Colors: `--accent500`, `--accent600`, `--text-headings`, etc.
- Spacing: 4px grid system
- Typography: Sora (headlines), IBM Plex Sans (body)
- Border radius: 8px (rounded-lg), 12px (rounded-lg for cards)

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- ARIA labels on interactive elements
- Screen reader friendly table structure
- Color + icon/symbol for meaning (not color alone)
- Contrast ratio ≥ 4.5:1

## Responsive Design

- **Desktop**: Full width, all sections visible
- **Tablet (768px)**: Metrics cards stack, category cards 2x2
- **Mobile (375px)**: Single column, category strip collapses

## Future Enhancements

- Chart View toggle (currently disabled)
- Drill-down detail panel on row click
- Virtual scrolling for large datasets (>50 topics)
- Export functionality
- More filter options

