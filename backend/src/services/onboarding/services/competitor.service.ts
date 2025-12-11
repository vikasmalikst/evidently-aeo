import axios from 'axios';
import type { CompetitorSuggestion, CompetitorGenerationParams } from '../types';
import { stripProtocol, ensureHttps } from '../utils/string-utils';

/**
 * Service for generating and managing competitor suggestions
 */
export class CompetitorService {
  private cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
  private cerebrasModel =
    process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';

  async generateCompetitors(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    const { companyName, industry = 'General', domain, locale, country } = params;

    console.log('🔍 Starting competitor generation for:', {
      companyName,
      industry,
      domain,
      locale,
      country,
    });

    if (!this.cerebrasApiKey) {
      const errorMsg = '❌ CEREBRAS_API_KEY is not configured. Cannot generate competitors.';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const aiCompetitors = await this.generateWithCerebras({
        companyName,
        industry,
        domain,
        locale,
        country,
      });

      console.log(`✅ Cerebras returned ${aiCompetitors.length} competitors`);

      const uniqueCompetitors = new Map<string, CompetitorSuggestion>();
      aiCompetitors.forEach((competitor) => {
        if (!competitor.name) return;
        uniqueCompetitors.set(competitor.name.toLowerCase(), competitor);
      });

      // Remove brand itself if accidentally included
      if (uniqueCompetitors.has(companyName.toLowerCase())) {
        console.log(`⚠️ Removing ${companyName} from competitors (self-reference)`);
        uniqueCompetitors.delete(companyName.toLowerCase());
      }

      let finalCompetitors = Array.from(uniqueCompetitors.values()).slice(0, 12);
      finalCompetitors = this.verifyCompetitors(finalCompetitors, companyName);

      console.log(`✅ Returning ${finalCompetitors.length} verified unique competitors`);
      return finalCompetitors;
    } catch (error) {
      const errorMsg = `❌ Cerebras competitor generation failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  private async generateWithCerebras(
    params: CompetitorGenerationParams
  ): Promise<CompetitorSuggestion[]> {
    const { companyName, industry, domain, locale = 'en-US', country = 'US' } = params;

    const payload = {
      model: this.cerebrasModel,
      prompt: this.buildPrompt({ companyName, industry, domain, locale, country }),
      max_tokens: 3000,
      temperature: 0.6,
      stop: ['---END---'],
    };

    let response;
    try {
      response = await axios.post<any>(
        'https://api.cerebras.ai/v1/completions',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.cerebrasApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 12000,
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Cerebras API request failed: ${error.response?.status} ${
            error.response?.statusText || error.message
          }`
        );
      }
      throw error;
    }

    const text: string = response.data?.choices?.[0]?.text ?? '';
    if (!text.trim()) {
      throw new Error('Cerebras returned an empty response');
    }

    try {
      const json = this.extractJsonFromText(text);
      const competitors: CompetitorSuggestion[] = Array.isArray(json?.competitors)
        ? json.competitors
        : Array.isArray(json)
        ? json
        : [];

      return competitors
        .filter(
          (item): item is CompetitorSuggestion =>
            item && typeof item.name === 'string' && item.name.trim().length > 0
        )
        .map((item) => {
          const normalizedName = item.name.trim();
          // Always synthesize a domain from the name if none provided
          const fallbackDomain = `${normalizedName.toLowerCase().replace(/\s+/g, '')}.com`;
          const domain = stripProtocol(item.domain || fallbackDomain);

          return {
            name: normalizedName,
            logo:
              item.logo && item.logo.startsWith('http')
                ? item.logo
                : domain
                ? `https://logo.clearbit.com/${domain}`
                : '',
            industry: item.industry || industry || 'General',
            relevance: item.relevance || 'Direct Competitor',
            domain,
            url: item.url || ensureHttps(domain),
            description: item.description || '',
            source: 'cerebras-ai',
          };
        })
        .slice(0, 12);
    } catch (error) {
      throw new Error(
        `Failed to parse Cerebras competitor response: ${
          error instanceof Error ? error.message : 'Unknown parsing error'
        }`
      );
    }
  }

  private buildPrompt(params: {
    companyName: string;
    industry?: string;
    domain?: string;
    locale: string;
    country: string;
  }): string {
    const { companyName, industry = 'General', domain, locale, country } = params;

    return `You are a competitive intelligence analyst.

TASK:
- Identify up to 10 relevant competitors for "${companyName}" in the ${industry} industry.
- If ${companyName} operates in ${country}, find competitors in that market.
- If ${companyName} does NOT operate in ${country}, find companies that DO operate in ${country} and serve similar customer needs in the ${industry} industry.
- Prioritize realistic, well-known organizations. Avoid defunct companies.
- Include a mix of direct and indirect competitors, clearly labelled.

OUTPUT:
Return ONLY valid JSON using the following schema:
{
  "competitors": [
    {
      "name": "string",
      "domain": "string (domain or homepage URL)",
      "industry": "string",
      "relevance": "Direct Competitor | Indirect Competitor | Aspirational Alternative",
      "logo": "https://...",
      "description": "Short neutral summary"
    }
  ]
}

CONTEXT:
- Brand: ${companyName}
- Industry: ${industry}
- Target Market: ${country} (${locale})
${domain ? `- Website: ${domain}\n` : ''}

RULES:
- DO NOT include ${companyName} itself in the list.
- If the brand doesn't operate in ${country}, find companies that DO operate there and serve similar needs.
- Prefer competitors that customers would compare directly when researching options.
- If unsure, choose the most globally recognized companies in the same category.
- CRITICAL: Output ONLY valid JSON. Do NOT include any text, comments, explanations, or markdown after the JSON.
- The response must end immediately after the closing brace } of the JSON object.
- Always return at least 3-5 competitors if possible. Only return empty array if truly no relevant companies exist.

---END---`;
  }

  private extractJsonFromText(text: string): any {
    let cleanedText = text.trim();

    // Remove end tokens
    const endTokens = ['<|endoftext|>', '<|im_end|>', '---END---', '<|end|>'];
    for (const token of endTokens) {
      const tokenIndex = cleanedText.indexOf(token);
      if (tokenIndex !== -1) {
        cleanedText = cleanedText.substring(0, tokenIndex).trim();
      }
    }

    // Remove markdown code fences
    if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '');
      cleanedText = cleanedText.replace(/\n?```\s*$/i, '');
    }

    const firstBrace = cleanedText.indexOf('{');
    if (firstBrace === -1) {
      throw new Error('No JSON braces found in response');
    }

    // Find matching closing brace
    let braceCount = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < cleanedText.length; i++) {
      if (cleanedText[i] === '{') braceCount++;
      else if (cleanedText[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          lastBrace = i;
          break;
        }
      }
    }

    if (lastBrace === -1) {
      throw new Error('No matching closing brace found for JSON object');
    }

    let jsonString = cleanedText.slice(firstBrace, lastBrace + 1);

    // Try parsing as-is
    try {
      const parsed = JSON.parse(jsonString);
      if (this.validateJsonCompleteness(jsonString, parsed)) {
        return parsed;
      }
      throw new Error('JSON validation failed: Response is incomplete or truncated');
    } catch (firstError) {
      // Try enhanced cleaning
      try {
        const cleanedJson = this.cleanJsonString(jsonString);
        const parsed = JSON.parse(cleanedJson);
        if (this.validateJsonCompleteness(cleanedJson, parsed)) {
          return parsed;
        }
        throw new Error('JSON validation failed: Response is incomplete or truncated');
      } catch (secondError) {
        throw new Error(
          'Failed to parse complete JSON from response. Response appears to be truncated.'
        );
      }
    }
  }

  private cleanJsonString(jsonString: string): string {
    let cleaned = jsonString;
    cleaned = cleaned.replace(/'/g, '"');
    cleaned = cleaned.replace(/,\s*}/g, '}');
    cleaned = cleaned.replace(/,\s*]/g, ']');
    cleaned = cleaned.replace(/}\s*{/g, '},{');
    cleaned = cleaned.replace(/]\s*\[/g, '],[');
    cleaned = cleaned.replace(/}(\s*)"/g, '},"');
    cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
    cleaned = cleaned.replace(/\r\n/g, ' ');
    cleaned = cleaned.replace(/\n/g, ' ');
    cleaned = cleaned.replace(/\t/g, ' ');
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    cleaned = cleaned.replace(/""+/g, '"');
    return cleaned;
  }

  private validateJsonCompleteness(jsonString: string, parsedJson: any): boolean {
    const trimmed = jsonString.trim();
    if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
      return false;
    }

    const openBraces = (jsonString.match(/{/g) || []).length;
    const closeBraces = (jsonString.match(/}/g) || []).length;
    const openBrackets = (jsonString.match(/\[/g) || []).length;
    const closeBrackets = (jsonString.match(/]/g) || []).length;

    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      return false;
    }

    if (!parsedJson?.competitors || !Array.isArray(parsedJson.competitors)) {
      return false;
    }

    const requiredFields = ['name', 'domain', 'industry', 'relevance'];
    for (const competitor of parsedJson.competitors) {
      const missingFields = requiredFields.filter(field => !competitor[field]);
      if (missingFields.length > 0 || (competitor.name && competitor.name.length < 2)) {
        return false;
      }
    }

    return true;
  }

  private verifyCompetitors(
    competitors: CompetitorSuggestion[],
    brandName: string
  ): CompetitorSuggestion[] {
    const normalizedBrandName = brandName.toLowerCase().trim();
    const genericTerms = ['company', 'inc', 'ltd', 'corp', 'corporation', 'llc', 'brand', 'business'];

    return competitors.filter(competitor => {
      if (!competitor.name || competitor.name.trim().length < 2) {
        return false;
      }

      if (competitor.name.toLowerCase().trim() === normalizedBrandName) {
        return false;
      }

      const competitorLower = competitor.name.toLowerCase().trim();
      if (genericTerms.some(term => competitorLower === term || competitorLower === `${term}.`)) {
        return false;
      }

      return true;
    });
  }
}

export const competitorService = new CompetitorService();

