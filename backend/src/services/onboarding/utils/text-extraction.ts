import { toTitleCase } from './string-utils';

/**
 * Text extraction utilities for parsing company information from text
 */

export function extractIndustry(text: string): string | null {
  if (!text) return null;

  const sentence = text.split('.').shift() ?? '';
  const match = sentence.match(
    /is an? ([^.]+?)(?: company| corporation| manufacturer| brand| provider| organisation| organization)/i
  );

  if (!match || !match[1]) {
    return null;
  }

  const industry = match[1]
    .replace(/\b(international|american|british|global|multinational|publicly traded)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return toTitleCase(industry);
}

export function extractHeadquarters(text: string): string | null {
  if (!text) return null;

  const match = text.match(/headquartered(?: in| near)? ([^.]+?)(?:\.|,)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return null;
}

export function extractFoundedYear(text: string): number | null {
  if (!text) return null;

  const match = text.match(
    /(founded|established|formed|launched)(?: in)? (\d{4})/i
  );
  if (match && match[2]) {
    return Number(match[2]);
  }

  return null;
}

