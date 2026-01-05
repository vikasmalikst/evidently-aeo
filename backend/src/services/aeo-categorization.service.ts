import { supabaseAdmin } from '../config/database';

export interface AEOCategory {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface CategorizedTopic {
  topic_name: string;
  category: string;
  confidence: number;
}

export interface CategorizationRequest {
  topics: string[];
  brand_name: string;
  industry: string;
  competitors?: string[];
}

export interface CategorizationResponse {
  categories: AEOCategory[];
  categorized_topics: CategorizedTopic[];
}

export class AEOCategorizationService {
  private geminiApiKey: string;
  private geminiModel: string;
  private openaiApiKey: string;

  constructor() {
    this.geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'] || '';
    this.geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-1.5-flash-002';
    this.openaiApiKey = process.env['OPENAI_API_KEY'] || '';
    
    if (!this.geminiApiKey && !this.openaiApiKey) {
      console.warn('⚠️ Neither Gemini nor OpenAI API key configured, will use rule-based categorization');
    } else {
      console.log('✅ Categorization service initialized');
      if (this.geminiApiKey) console.log('  - Gemini: ✅ Configured');
      if (this.openaiApiKey) console.log('  - OpenAI: ✅ Configured (fallback)');
    }
  }

  /**
   * Categorize AEO topics into 4 main categories using AI
   */
  async categorizeTopics(request: CategorizationRequest): Promise<CategorizationResponse> {
    try {
      // Try Gemini first
      if (this.geminiApiKey) {
        try {
          return await this.categorizeWithGemini(request);
        } catch (geminiError) {
          console.error('❌ Gemini categorization failed:', geminiError);
          console.log('🔄 Falling back to OpenAI...');
        }
      }
      
      // Fallback to OpenAI
      if (this.openaiApiKey) {
        try {
          return await this.categorizeWithOpenAI(request);
        } catch (openaiError) {
          console.error('❌ OpenAI categorization failed:', openaiError);
          console.log('🔄 Falling back to rule-based categorization...');
        }
      }
      
      // Final fallback to rule-based
      return this.categorizeWithRules(request);
    } catch (error) {
      console.error('❌ Error in categorizeTopics:', error);
      // Fallback to rule-based categorization
      return this.categorizeWithRules(request);
    }
  }

  /**
   * Use Gemini AI to categorize topics
   */
  private async categorizeWithGemini(request: CategorizationRequest): Promise<CategorizationResponse> {
    const prompt = this.buildCategorizationPrompt(request);
    
    console.log('🤖 Categorizing topics with Gemini...');
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are an expert in Answer Engine Optimization (AEO) and customer journey mapping. Your task is to categorize brand topics into 4 main customer journey categories.\n\n${prompt}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!content) {
      throw new Error('No response from Gemini');
    }

    return await this.parseAIResponse(content, request.topics);
  }

  /**
   * Use OpenAI to categorize topics (fallback)
   */
  private async categorizeWithOpenAI(request: CategorizationRequest): Promise<CategorizationResponse> {
    const prompt = this.buildCategorizationPrompt(request);
    
    console.log('🤖 Categorizing topics with OpenAI (fallback)...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'You are an expert in Answer Engine Optimization (AEO) and customer journey mapping. Your task is to categorize brand topics into 4 main customer journey categories. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return await this.parseAIResponse(content, request.topics);
  }

  /**
   * Build the categorization prompt
   */
  private buildCategorizationPrompt(request: CategorizationRequest): string {
    const competitorsText = request.competitors && request.competitors.length > 0 
      ? `Competitors: ${request.competitors.join(', ')}` 
      : 'No specific competitors mentioned';

    return `
You are an expert in Answer Engine Optimization (AEO) and customer journey mapping. 

Brand Context:
- Brand: ${request.brand_name}
- Industry: ${request.industry}
- ${competitorsText}

Your task is to categorize the following AEO topics into 4 main customer journey categories:

1. **Awareness** - Topics that help users discover and learn about the brand
2. **Comparison** - Topics that help users compare the brand with competitors
3. **Purchase** - Topics that help users make buying decisions
4. **Post-Purchase Support** - Topics that help users after they've made a purchase

AEO Topics to categorize:
${request.topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

For each topic, determine which category it best fits into based on the user's intent when searching for that topic.

Respond with a JSON object in this exact format:
{
  "categorized_topics": [
    {
      "topic_name": "Brand Trust & Identity",
      "category": "awareness",
      "confidence": 0.95,
      "reasoning": "Users search for this to learn about the brand's reputation and trustworthiness"
    }
  ]
}

Make sure to:
- Use only the 4 categories: "awareness", "comparison", "purchase", "post-purchase support"
- Provide confidence scores between 0.0 and 1.0
- Include brief reasoning for each categorization
- Consider the brand's industry context when categorizing
`;
  }

  /**
   * Parse AI response into structured data
   */
  private async parseAIResponse(content: string, originalTopics: string[]): Promise<CategorizationResponse> {
    try {
      // Use robust JSON extraction (same approach as other services)
      let parsed: any = {};
      
      try {
        // Strategy 1: Try parsing as-is
        parsed = JSON.parse(content);
      } catch (firstError) {
        console.log('⚠️ Direct JSON parse failed, trying extraction...');
        try {
          // Strategy 2: Extract JSON using regex and brace matching
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const firstBrace = jsonMatch[0].indexOf('{');
            if (firstBrace !== -1) {
              let braceCount = 0;
              let lastBrace = -1;
              for (let i = firstBrace; i < jsonMatch[0].length; i++) {
                if (jsonMatch[0][i] === '{') {
                  braceCount++;
                } else if (jsonMatch[0][i] === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastBrace = i;
                    break;
                  }
                }
              }
              if (lastBrace !== -1) {
                const jsonString = jsonMatch[0].slice(firstBrace, lastBrace + 1);
                parsed = JSON.parse(jsonString);
                console.log('✅ Successfully extracted and parsed JSON from Gemini response');
              } else {
                throw new Error('No matching closing brace found');
              }
            } else {
              throw new Error('No opening brace found');
            }
          } else {
            throw new Error('No JSON object found in response');
          }
        } catch (secondError) {
          console.error('❌ Failed to parse Gemini JSON response:', secondError);
          console.error('📄 Response text preview:', content.substring(0, 500));
          // Fallback to rule-based categorization
          return await this.categorizeWithRules({ topics: originalTopics, brand_name: '', industry: '' });
        }
      }

      const categorizedTopics: CategorizedTopic[] = parsed.categorized_topics || [];
      
      if (categorizedTopics.length === 0) {
        console.warn('⚠️ No categorized topics found in AI response, using rule-based fallback');
        return await this.categorizeWithRules({ topics: originalTopics, brand_name: '', industry: '' });
      }
      
      console.log(`✅ Successfully categorized ${categorizedTopics.length} topics with Gemini`);
      
      return {
        categories: this.getDefaultCategories(),
        categorized_topics: categorizedTopics
      };
    } catch (error) {
      console.error('❌ Error parsing AI response:', error);
      // Fallback to rule-based categorization
      return await this.categorizeWithRules({ topics: originalTopics, brand_name: '', industry: '' });
    }
  }

  /**
   * Rule-based categorization as fallback
   */
  private async categorizeWithRules(request: CategorizationRequest): Promise<CategorizationResponse> {
    const categorizedTopics: CategorizedTopic[] = request.topics.map(topic => {
      const topicLower = topic.toLowerCase();
      
      // Awareness category rules
      if (topicLower.includes('brand') || topicLower.includes('trust') || topicLower.includes('identity') || 
          topicLower.includes('history') || topicLower.includes('reputation') || topicLower.includes('company')) {
        return { topic_name: topic, category: 'awareness', confidence: 0.9 };
      }
      
      // Comparison category rules
      if (topicLower.includes('comparison') || topicLower.includes('competitor') || topicLower.includes('vs') || 
          topicLower.includes('better') || topicLower.includes('versus')) {
        return { topic_name: topic, category: 'comparison', confidence: 0.9 };
      }
      
      // Purchase category rules
      if (topicLower.includes('pricing') || topicLower.includes('price') || topicLower.includes('cost') || 
          topicLower.includes('discount') || topicLower.includes('value') || topicLower.includes('buy') ||
          topicLower.includes('purchase') || topicLower.includes('afford')) {
        return { topic_name: topic, category: 'purchase', confidence: 0.9 };
      }
      
      // Post-purchase support category rules
      if (topicLower.includes('complaint') || topicLower.includes('support') || topicLower.includes('service') || 
          topicLower.includes('warranty') || topicLower.includes('return') || topicLower.includes('refund') ||
          topicLower.includes('help') || topicLower.includes('issue') || topicLower.includes('problem')) {
        return { topic_name: topic, category: 'post-purchase support', confidence: 0.9 };
      }
      
      // Default to awareness for unmatched topics
      return { topic_name: topic, category: 'awareness', confidence: 0.5 };
    });

    return {
      categories: this.getDefaultCategories(),
      categorized_topics: categorizedTopics
    };
  }

  /**
   * Get the 4 default categories
   */
  private getDefaultCategories(): AEOCategory[] {
    return [
      {
        id: 'awareness',
        name: 'Awareness',
        description: 'Topics that help users discover and learn about the brand',
        color: '#3B82F6' // Blue
      },
      {
        id: 'comparison',
        name: 'Comparison',
        description: 'Topics that help users compare the brand with competitors',
        color: '#F59E0B' // Orange
      },
      {
        id: 'purchase',
        name: 'Purchase',
        description: 'Topics that help users make buying decisions',
        color: '#10B981' // Green
      },
      {
        id: 'post-purchase support',
        name: 'Post-Purchase Support',
        description: 'Topics that help users after they\'ve made a purchase',
        color: '#EF4444' // Red
      }
    ];
  }

  /**
   * Store categorized topics in database
   */
  async storeCategorizedTopics(brandId: string, customerId: string, categorizedTopics: CategorizedTopic[]): Promise<void> {
    try {
      // Update brand_topics table with category information
      for (const topic of categorizedTopics) {
        await supabaseAdmin
          .from('brand_topics')
          .update({ 
            category: topic.category,
            metadata: { 
              confidence: topic.confidence,
              categorized_at: new Date().toISOString()
            }
          })
          .eq('brand_id', brandId)
          .eq('topic_name', topic.topic_name);
      }
      
      console.log(`✅ Stored ${categorizedTopics.length} categorized topics for brand ${brandId}`);
    } catch (error) {
      console.error('❌ Error storing categorized topics:', error);
      throw error;
    }
  }
}

export const aeoCategorizationService = new AEOCategorizationService();
