import { OpenAI } from 'openai';
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
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
    } else {
      console.warn('⚠️ OpenAI API key not configured, using mock categorization');
    }
  }

  /**
   * Categorize AEO topics into 4 main categories using AI
   */
  async categorizeTopics(request: CategorizationRequest): Promise<CategorizationResponse> {
    try {
      if (this.openai) {
        return await this.categorizeWithAI(request);
      } else {
        return this.categorizeWithRules(request);
      }
    } catch (error) {
      console.error('❌ Error in categorizeTopics:', error);
      // Fallback to rule-based categorization
      return this.categorizeWithRules(request);
    }
  }

  /**
   * Use AI to categorize topics
   */
  private async categorizeWithAI(request: CategorizationRequest): Promise<CategorizationResponse> {
    const prompt = this.buildCategorizationPrompt(request);
    
    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert in Answer Engine Optimization (AEO) and customer journey mapping. Your task is to categorize brand topics into 4 main customer journey categories.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
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
      const parsed = JSON.parse(content);
      const categorizedTopics: CategorizedTopic[] = parsed.categorized_topics || [];
      
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
