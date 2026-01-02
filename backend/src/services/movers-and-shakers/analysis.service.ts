import { MoverItem } from './types';
import { globalSettingsService } from '../global-settings.service';
import { OllamaChatRequest } from '../scoring/ollama-client.service';
import OpenAI from 'openai';

// We can import the ollamaQueue from the service if it was exported, 
// but looking at the file, it's not exported. 
// However, there is a `getOllamaConfigForBrand` helper, but the main class/instance isn't easily accessible 
// without refactoring.
// For now, I will implement a lightweight client here that mimics the logic or use OpenAI as primary fallback.
// Actually, looking at `ollama-client.service.ts`, it seems to be designed for scoring.
// I'll implement a clean separate client for this module to avoid tight coupling with scoring logic.

export class AnalysisService {
  private openai: OpenAI;

  constructor() {
    console.log('[AnalysisService] Initialized. Env:', process.env.NODE_ENV);
    const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    
    this.openai = new OpenAI({
      apiKey: openRouterKey || openAiKey || 'sk-mock-key',
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    });
  }

  async analyzeContent(content: string, brand: string, domain: string, url: string, useLocalLLM: boolean = false): Promise<MoverItem[]> {
    const prompt = `
      You are an AI analyst. Analyze the following Markdown content from ${domain} related to the brand "${brand}".
      Identify key reviews, news articles, or social posts from the last 48 hours.
      
      Content Snippet:
      ${content.substring(0, 15000)} // Limit context window
      
      Return a JSON array of objects with these fields:
      - title: string
      - type: 'review' | 'news' | 'social_post' | 'forum_thread' | 'video' | 'other'
      - sentiment_score: number (-1.0 to 1.0)
      - action_required: string (brief recommendation)
      - owner: string (author name if available)
      - date_published: string (ISO date or "recent")
      - snippet: string (short summary)
      
      Only include items that seem relevant and recent (last 48h).
      If nothing relevant is found, return an empty array.
    `;

    try {
      console.log(`[AnalysisService] Analyzing content for ${brand} on ${domain}. Local LLM: ${useLocalLLM}`);
      
      if (useLocalLLM) {
        return await this.callOllama(prompt, domain, url);
      } else {
        return await this.callOpenAI(prompt, domain, url);
      }
    } catch (error) {
      console.error('LLM Analysis failed:', error);
      // Removed mock fallback as per user request
      return [];
    }
  }

  private async callOpenAI(prompt: string, domain: string, url: string): Promise<MoverItem[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // or 'openai/gpt-4o-mini' for OpenRouter
        messages: [
          { role: 'system', content: 'You are a helpful JSON extractor.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      });

      const responseText = completion.choices[0].message.content || '{}';
      const result = JSON.parse(responseText);
      
      // Normalize output
      const items = (result.items || result || []) as any[];
      return items.map(item => ({
        ...item,
        domain,
        url, // This might be the search page URL, ideally LLM extracts specific article URL if possible
        sentiment_score: Number(item.sentiment_score) || 0
      }));
    } catch (e) {
      console.error('OpenAI call failed:', e);
      throw e;
    }
  }

  private async callOllama(prompt: string, domain: string, url: string): Promise<MoverItem[]> {
    // Basic fetch implementation for Ollama
    try {
      const response = await fetch(`${process.env.OLLAMA_HOST || 'http://localhost:11434'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'llama3',
          messages: [{ role: 'user', content: prompt }],
          format: 'json',
          stream: false
        })
      });
      
      const data = await response.json() as any;
      const result = JSON.parse(data.message.content);
      const items = (result.items || result || []) as any[];
      return items.map(item => ({
        ...item,
        domain,
        url,
        sentiment_score: Number(item.sentiment_score) || 0
      }));
    } catch (e) {
      console.error('Ollama call failed:', e);
      return [];
    }
  }
}

export const analysisService = new AnalysisService();
