// Chart color palette - consistent across all chart types
// Each topic gets assigned a color based on its selection order
export const chartVizColors = [
  '#06b6d4', // chartViz01 - Cyan
  '#498cf9', // chartViz02 - Blue
  '#ac59fb', // chartViz03 - Purple
  '#fa8a40', // chartViz04 - Orange
  '#f155a2', // chartViz05 - Pink
  '#0d7c96', // chartViz06 - Teal
  '#f9db43', // chartViz07 - Yellow
  '#0d3196', // chartViz08 - Dark Blue
  '#54079c', // chartViz09 - Dark Purple
  '#06c686', // chartViz10 - Green
];

/**
 * Get chart color for a topic based on its index (0-9)
 * @param index - The index of the topic (0-9 for first 10 topics)
 * @returns Hex color string
 */
export const getChartColor = (index: number): string => {
  return chartVizColors[index % chartVizColors.length];
};

/**
 * Get chart colors for multiple topics
 * @param count - Number of topics
 * @returns Array of color strings
 */
export const getChartColors = (count: number): string[] => {
  return Array.from({ length: Math.min(count, 10) }, (_, i) => getChartColor(i));
};

