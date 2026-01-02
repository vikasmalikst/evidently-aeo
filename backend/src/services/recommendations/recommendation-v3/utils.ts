/**
 * Utility functions for Recommendation V3 Service
 */

/**
 * Normalize a metric that may be in 0-1 or 0-100 to a 0-100 display scale
 */
export function normalizePercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled * 10) / 10));
}

/**
 * Normalize sentiment from -1 to 1 range to 0-100
 */
export function normalizeSentiment100(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(0, Math.min(100, ((value + 1) / 2) * 100));
}

/**
 * Format a value to specified decimal places
 */
export function formatValue(value: number | null | undefined, decimals: number = 1): string | null {
  if (value === null || value === undefined) return null;
  return String(Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals));
}

/**
 * Parse JSON from LLM response with robust error handling
 */
export function parseLLMJSONResponse(content: string, expectedField?: string): any[] {
  let cleaned = content.trim();
  
  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  // Try to extract JSON array if there's extra text
  let jsonStart = cleaned.indexOf('[');
  let jsonEnd = cleaned.lastIndexOf(']');
  
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  // Try parsing
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseError) {
    console.error('❌ JSON parse error. Attempting to fix...');
    console.error('Cleaned content (first 1000 chars):', cleaned.substring(0, 1000));
    
    // Try to fix common JSON issues
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    cleaned = cleaned.replace(/\}\s*\}\s*\]/g, '}]');
    cleaned = cleaned.replace(/(\})\s*\}(\s*\])/g, '$1$2');
    
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      cleaned = arrayMatch[0];
    }
    
    const lastBraceIndex = cleaned.lastIndexOf('}');
    const lastBracketIndex = cleaned.lastIndexOf(']');
    if (lastBraceIndex !== -1 && lastBracketIndex !== -1 && lastBraceIndex < lastBracketIndex) {
      const beforeBracket = cleaned.substring(lastBraceIndex, lastBracketIndex);
      const braceCount = (beforeBracket.match(/\}/g) || []).length;
      if (braceCount > 1) {
        cleaned = cleaned.substring(0, lastBraceIndex) + 
                 cleaned.substring(lastBraceIndex).replace(/\}/g, '').replace(/\]/, '}]');
      }
    }
    
    try {
      parsed = JSON.parse(cleaned);
    } catch (secondError) {
      console.error('❌ Failed to parse JSON after fixes:', secondError);
      console.error('Cleaned content (last 200 chars):', cleaned.substring(Math.max(0, cleaned.length - 200)));
      
      // Last resort: try to manually extract array elements
      try {
        const elements: any[] = [];
        const pattern = expectedField ? `"${expectedField}"` : '"action"|"kpiName"';
        const elementMatches = cleaned.match(new RegExp(`\\{[^}]*${pattern}[^}]*\\}`, 'g'));
        if (elementMatches && elementMatches.length > 0) {
          for (const match of elementMatches) {
            try {
              const element = JSON.parse(match);
              elements.push(element);
            } catch (e) {
              // Skip malformed elements
            }
          }
          if (elements.length > 0) {
            console.log(`⚠️ Manually extracted ${elements.length} items from malformed JSON`);
            parsed = elements;
          } else {
            throw secondError;
          }
        } else {
          throw secondError;
        }
      } catch (manualError) {
        console.error('Full content length:', content.length);
        console.error('Cleaned content length:', cleaned.length);
        return [];
      }
    }
  }

  if (!Array.isArray(parsed)) {
    console.error('❌ Response is not an array. Type:', typeof parsed);
    return [];
  }

  return parsed;
}

