export const formatDateForInput = (date: Date): string => date.toISOString().split('T')[0];

export const getDefaultDateRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    start: formatDateForInput(start),
    end: formatDateForInput(end)
  };
};

export const formatNumber = (value: number, decimals = 1): string => {
  const fixed = value.toFixed(decimals);
  if (decimals === 0) {
    return fixed;
  }
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
};

import type { DashboardScoreMetric } from './types';

export const formatMetricValue = (metric: DashboardScoreMetric | undefined, suffix = '%'): string => {
  if (!metric) {
    return '—';
  }
  return `${formatNumber(metric.value, 1)}${suffix}`;
};

export const computeTrend = (delta?: number) => {
  if (!delta) {
    return { direction: 'stable' as const, value: 0 };
  }
  return {
    direction: delta > 0 ? ('up' as const) : ('down' as const),
    value: Number(Math.abs(delta).toFixed(1))
  };
};

export const getBrandData = () => {
  const brandInfo = localStorage.getItem('onboarding_brand');
  if (brandInfo) {
    try {
      const parsed = JSON.parse(brandInfo);
      return { name: parsed.name || 'Your Brand', industry: parsed.industry || 'Technology' };
    } catch (e) {
      return { name: 'Your Brand', industry: 'Technology' };
    }
  }
  return { name: 'Your Brand', industry: 'Technology' };
};

