// Shared competitor color mapping for consistent colors across all chart types

export interface Competitor {
  id: string;
  name: string;
  favicon?: string;
}

// 10 unique colors for competitors (based on dataviz palette with variations)
export const COMPETITOR_COLORS = [
  '#498cf9', // dataviz-1 - blue
  '#06c686', // dataviz-2 - green
  '#f9db43', // dataviz-3 - yellow
  '#fa8a40', // dataviz-4 - orange
  '#f94343', // dataviz-5 - red
  '#7c3aed', // purple variant
  '#14b8a6', // teal variant
  '#f59e0b', // amber variant
  '#ec4899', // pink variant
  '#6366f1', // indigo variant
];

// Get color for competitor by index (10 unique colors, no repetition)
export const getCompetitorColor = (index: number): string => {
  return COMPETITOR_COLORS[index % COMPETITOR_COLORS.length] || '#498cf9';
};

// Create a color map for competitors by ID
export const createCompetitorColorMap = (competitors: Competitor[]): Map<string, string> => {
  const colorMap = new Map<string, string>();
  competitors.forEach((competitor, index) => {
    colorMap.set(competitor.id, getCompetitorColor(index));
  });
  return colorMap;
};

// Get color for competitor by ID from a color map
export const getCompetitorColorById = (competitorId: string, colorMap: Map<string, string>): string => {
  return colorMap.get(competitorId) || '#498cf9';
};

