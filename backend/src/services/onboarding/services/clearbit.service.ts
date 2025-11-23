import axios from 'axios';
import type { ClearbitSuggestion } from '../types';
import { stripProtocol } from '../utils/string-utils';

/**
 * Service for interacting with Clearbit API
 */
export class ClearbitService {
  async fetchSuggestions(query: string): Promise<ClearbitSuggestion[]> {
    try {
      const response = await axios.get<ClearbitSuggestion[]>(
        'https://autocomplete.clearbit.com/v1/companies/suggest',
        {
          params: { query },
          timeout: 5000,
        }
      );
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.warn('⚠️ Clearbit autocomplete failed:', error);
      return [];
    }
  }

  pickBestSuggestion(
    suggestions: ClearbitSuggestion[],
    input: string,
    isLikelyDomain: boolean
  ): ClearbitSuggestion | null {
    if (!suggestions.length) {
      return null;
    }

    const normalizedInput = input.trim().toLowerCase();

    // Exact domain match first
    if (isLikelyDomain) {
      const matchedByDomain = suggestions.find((suggestion) =>
        suggestion.domain
          ? suggestion.domain.toLowerCase() === stripProtocol(normalizedInput)
          : false
      );

      if (matchedByDomain) {
        return matchedByDomain;
      }
    }

    // Exact name match
    const matchedByName = suggestions.find(
      (suggestion) =>
        suggestion.name.trim().toLowerCase() === normalizedInput ||
        suggestion.name.trim().toLowerCase().includes(normalizedInput)
    );

    if (matchedByName) {
      return matchedByName;
    }

    // Fallback: first suggestion
    return suggestions[0];
  }

  buildCompanyName(
    suggestion: ClearbitSuggestion | null,
    fallback: string
  ): string {
    if (suggestion?.name) {
      return suggestion.name;
    }
    const sanitized = fallback.replace(/https?:\/\//i, '').replace(/www\./i, '');
    return this.toTitleCase(sanitized.split('.')[0] || fallback);
  }

  buildDomain(
    suggestion: ClearbitSuggestion | null,
    input: string
  ): string {
    if (suggestion?.domain) {
      return suggestion.domain;
    }

    const stripped = stripProtocol(input);
    if (stripped.includes('.')) {
      return stripped;
    }

    if (!stripped) {
      return '';
    }

    return `${stripped.replace(/\s+/g, '')}.com`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[\s-_]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

export const clearbitService = new ClearbitService();

