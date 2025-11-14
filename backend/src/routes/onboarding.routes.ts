import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { onboardingIntelService } from '../services/onboarding-intel.service';
import { trendingKeywordsService } from '../services/keywords/trending-keywords.service';
import { aeoCategorizationService } from '../services/aeo-categorization.service';
import { brandService } from '../services/brand.service';

const router = Router();

/**
 * POST /onboarding/brand-intel
 * Resolve brand information and suggested competitors for onboarding flow
 */
router.post('/brand-intel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { input, locale, country } = req.body ?? {};
    const customer_id = req.user?.customer_id;

    if (!input || typeof input !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Brand input is required',
      });
      return;
    }

    // First, check if brand already exists in database
    let existingBrand = null;
    if (customer_id) {
      try {
        existingBrand = await brandService.findBrandByUrlOrName(
          input.includes('.') ? input : undefined,
          input,
          customer_id
        );
        if (existingBrand) {
          console.log(`✅ Found existing brand: ${existingBrand.name}`);
          
          // Get competitors from existing brand (already fetched by findBrandByUrlOrName)
          const competitors = existingBrand.competitors || [];
          
          // Get existing topics
          const existingTopics = await brandService.getBrandTopics(existingBrand.id, customer_id);
          
          // Get full competitor details from database if available
          let competitorDetails: any[] = [];
          if (existingBrand.brand_competitors && Array.isArray(existingBrand.brand_competitors)) {
            competitorDetails = existingBrand.brand_competitors.map((comp: any) => ({
              name: comp.competitor_name,
              logo: `https://logo.clearbit.com/${(comp.competitor_url || comp.competitor_name).replace(/^https?:\/\//, '').split('/')[0]}`,
              relevance: 'Direct Competitor',
              industry: existingBrand.industry || '',
              domain: comp.competitor_url?.replace(/^https?:\/\//, '').split('/')[0] || comp.competitor_name.toLowerCase().replace(/\s+/g, '') + '.com',
              url: comp.competitor_url || `https://${comp.competitor_name.toLowerCase().replace(/\s+/g, '')}.com`,
              priority: comp.priority || 999
            }));
          }
          
          // Format response with existing data - include all available fields
          const brandIntel = {
            verified: true,
            companyName: existingBrand.name,
            website: existingBrand.homepage_url || input,
            domain: existingBrand.homepage_url?.replace(/^https?:\/\//, '').split('/')[0] || '',
            logo: existingBrand.metadata?.brand_logo || existingBrand.metadata?.logo || `https://logo.clearbit.com/${existingBrand.homepage_url?.replace(/^https?:\/\//, '').split('/')[0]}`,
            industry: existingBrand.industry || 'General',
            headquarters: existingBrand.headquarters || existingBrand.metadata?.headquarters || '',
            founded: existingBrand.founded_year || existingBrand.metadata?.founded_year || null,
            ceo: existingBrand.ceo || existingBrand.metadata?.ceo || '',
            description: existingBrand.summary || existingBrand.description || existingBrand.metadata?.description || '',
            metadata: {
              ...(existingBrand.metadata || {}),
              ceo: existingBrand.ceo || existingBrand.metadata?.ceo,
              headquarters: existingBrand.headquarters || existingBrand.metadata?.headquarters,
              founded_year: existingBrand.founded_year || existingBrand.metadata?.founded_year,
              topics: existingBrand.aeo_topics || existingBrand.topics || [],
              sources: existingBrand.sources || existingBrand.metadata?.sources || []
            }
          };

          // Use detailed competitor info if available, otherwise format from names
          const competitorSuggestions = competitorDetails.length > 0 
            ? competitorDetails.sort((a, b) => (a.priority || 999) - (b.priority || 999))
            : competitors.map((compName: string, index: number) => ({
                name: compName,
                logo: `https://logo.clearbit.com/${compName.toLowerCase().replace(/\s+/g, '')}.com`,
                relevance: 'Direct Competitor',
                industry: existingBrand.industry || '',
                domain: compName.toLowerCase().replace(/\s+/g, '') + '.com',
                url: `https://${compName.toLowerCase().replace(/\s+/g, '')}.com`
              }));

          return res.json({
            success: true,
            data: {
              brand: brandIntel,
              competitors: competitorSuggestions,
              existing_topics: existingTopics.map((t: any) => t.topic_name || t.topic || t)
            },
          });
        }
      } catch (brandError) {
        console.log('⚠️ Could not check for existing brand, proceeding with intel lookup:', brandError);
      }
    }

    // If brand doesn't exist, use onboarding intel service
    const data = await onboardingIntelService.lookupBrandIntel({
      input,
      locale,
      country,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Failed to generate onboarding brand intel:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to resolve brand information',
    });
  }
});

/**
 * POST /onboarding/competitors
 * Regenerate competitor suggestions (optional refresh endpoint)
 */
router.post('/competitors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { companyName, industry, domain, locale, country } = req.body ?? {};

    if (!companyName || typeof companyName !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Company name is required to generate competitors',
      });
      return;
    }

    const competitors = await onboardingIntelService.generateCompetitorsForRequest({
      companyName,
      industry,
      domain,
      locale,
      country,
    });

    res.json({
      success: true,
      data: competitors,
    });
  } catch (error) {
    console.error('❌ Competitor generation failed:', error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to generate competitor suggestions',
    });
  }
});

/**
 * POST /onboarding/topics
 * Generate topics for brand using trending keywords and AI categorization
 */
router.post('/topics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brand_name, industry, competitors = [], locale = 'en-US', country = 'US', brand_id, website_url } = req.body;
    const customer_id = req.user?.customer_id;

    if (!brand_name || typeof brand_name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Brand name is required',
      });
      return;
    }

    console.log(`🎯 Generating topics for ${brand_name} in ${industry || 'General'} industry`);

    // Try to get existing brand data from database
    let existingBrand = null;
    let brandCompetitors: string[] = competitors;
    let brandIndustry = industry;
    let existingTopics: any[] = [];

    if (customer_id) {
      try {
        // Try to find brand by ID first, then by name/URL
        if (brand_id) {
          existingBrand = await brandService.getBrandById(brand_id, customer_id);
        }
        
        if (!existingBrand) {
          existingBrand = await brandService.findBrandByUrlOrName(
            website_url,
            brand_name,
            customer_id
          );
        }

        if (existingBrand) {
          console.log(`✅ Found existing brand: ${existingBrand.name}`);
          
          // Use existing brand data
          brandIndustry = existingBrand.industry || industry || 'General';
          brandCompetitors = existingBrand.competitors || competitors;
          
          // Get existing topics from database
          existingTopics = await brandService.getBrandTopics(existingBrand.id, customer_id);
          console.log(`📋 Found ${existingTopics.length} existing topics in database`);
        }
      } catch (brandError) {
        console.log('⚠️ Could not fetch existing brand data, using provided values:', brandError);
      }
    }

    // 1. Get trending keywords/topics from Gemini
    const trendingResult = await trendingKeywordsService.getTrendingKeywords({
      brand: brand_name,
      industry: brandIndustry || 'General',
      competitors: brandCompetitors,
      locale,
      country,
      max_keywords: 12
    });

    // 2. Get trending keywords which will serve as topics
    const trendingTopics: any[] = [];
    const trendingPrompts: any[] = [];
    
    if (trendingResult.success && trendingResult.data) {
      // Use keywords as topics (these are already keyword-like)
      trendingResult.data.keywords.forEach((kw: any, index: number) => {
        trendingTopics.push({
          id: `trend-${index}`,
          name: kw.keyword,
          source: 'trending' as const,
          relevance: Math.round(kw.trend_score * 100),
          trendingIndicator: kw.trend_score > 0.85 ? 'rising' : 'stable'
        });
      });
      
      // Store prompts separately (these are for query generation, not topic generation)
      if (trendingResult.data.prompts && Array.isArray(trendingResult.data.prompts)) {
        trendingResult.data.prompts.forEach((prompt: any, index: number) => {
          trendingPrompts.push({
            id: `prompt-${index}`,
            name: prompt.prompt,
            source: 'trending' as const,
            category: prompt.category?.toLowerCase() || 'awareness',
            relevance: 85
          });
        });
      }
    }

    // 3. Include existing topics from database (if any)
    const existingTopicsFormatted = existingTopics.map((topic: any, index: number) => {
      const topicName = topic.topic_name || topic.topic || topic;
      return {
        id: `existing-${index}`,
        name: topicName,
        source: 'existing' as const,
        category: topic.category || 'awareness',
        relevance: 90 // Existing topics have high relevance
      };
    });

    // 4. Normalize all topics to ensure they are keyword-like (not prompt-like)
    // Combine keywords from trending and existing topics
    const allTopicNames = [
      ...trendingTopics.map((t: any) => t.name),
      ...existingTopicsFormatted.map((t: any) => t.name)
    ];
    
    // Normalize topics using the trending keywords service (already imported at top)
    const normalizedTopicNames = await trendingKeywordsService.normalizeTopicsToKeywords(
      allTopicNames,
      brand_name,
      brandIndustry || 'General'
    );
    
    // Create a map of original topic names to normalized names
    // Since normalizeTopicsToKeywords processes topics in order, we can match them by index
    // But we need to handle cases where some topics are skipped
    const topicNameMap = new Map<string, string>();
    let normalizedIndex = 0;
    
    for (const original of allTopicNames) {
      // Check if this topic was normalized (it should be in the normalized array)
      // We'll match by checking if the normalized version exists and is similar
      const normalized = normalizedTopicNames[normalizedIndex];
      
      if (normalized) {
        // Check if this normalized topic corresponds to the current original
        // (either exact match, or the original was converted to this)
        if (normalized.toLowerCase() === original.toLowerCase() || 
            original.toLowerCase().includes(normalized.toLowerCase()) ||
            normalized.toLowerCase().includes(original.toLowerCase().split(' ').slice(-2).join(' '))) {
          topicNameMap.set(original.toLowerCase(), normalized);
          normalizedIndex++;
        } else {
          // This original topic was skipped, don't map it
          topicNameMap.set(original.toLowerCase(), original); // Keep original if not normalized
        }
      } else {
        // No more normalized topics, keep original
        topicNameMap.set(original.toLowerCase(), original);
      }
    }
    
    // Map normalized topics back to their original structure
    const normalizedTrendingTopics = trendingTopics
      .map((t: any) => {
        const normalized = topicNameMap.get(t.name.toLowerCase()) || t.name;
        return { ...t, name: normalized };
      });
    
    const normalizedExistingTopics = existingTopicsFormatted
      .map((t: any) => {
        const normalized = topicNameMap.get(t.name.toLowerCase()) || t.name;
        return { ...t, name: normalized };
      });

    // 5. Generate categorized topics using AEO categorization
    // Use normalized keywords (not prompts) for categorization
    const categorizationRequest = {
      topics: normalizedTopicNames,
      brand_name,
      industry: brandIndustry || 'General',
      competitors: brandCompetitors
    };

    const categorizedResult = await aeoCategorizationService.categorizeTopics(categorizationRequest);

    // 6. Organize topics by category
    const aiGenerated: Record<string, any[]> = {
      awareness: [],
      comparison: [],
      purchase: [],
      support: []
    };

    if (categorizedResult.categorized_topics) {
      categorizedResult.categorized_topics.forEach((ct: any, index: number) => {
        const category = ct.category.toLowerCase().replace('post-purchase support', 'support');
        
        // Find matching topic from normalized topics
        const matchingTopic = normalizedTrendingTopics.find((t: any) => t.name === ct.topic_name) ||
                             normalizedExistingTopics.find((t: any) => t.name === ct.topic_name);
        
        if (matchingTopic && aiGenerated[category]) {
          aiGenerated[category].push({
            id: matchingTopic.id || `ai-${index}`,
            name: ct.topic_name, // Use the normalized topic name
            source: matchingTopic.source || 'ai_generated' as const,
            category: category as 'awareness' | 'comparison' | 'purchase' | 'support',
            relevance: Math.round((ct.confidence || 0.8) * 100)
          });
        } else if (aiGenerated[category]) {
          // If no matching topic found, create a new one
          aiGenerated[category].push({
            id: `ai-${index}`,
            name: ct.topic_name,
            source: 'ai_generated' as const,
            category: category as 'awareness' | 'comparison' | 'purchase' | 'support',
            relevance: Math.round((ct.confidence || 0.8) * 100)
          });
        }
      });
    }

    // 7. Merge normalized existing topics into appropriate categories (if not already added)
    normalizedExistingTopics.forEach((topic) => {
      const category = (topic.category || 'awareness').toLowerCase().replace('post-purchase support', 'support');
      if (aiGenerated[category]) {
        // Check if topic already exists to avoid duplicates
        const exists = aiGenerated[category].some(t => t.name.toLowerCase() === topic.name.toLowerCase());
        if (!exists) {
          aiGenerated[category].push(topic);
        }
      }
    });

    // 8. Add minimal preset topics (keep a small set for fallback)
    const preset = [
      { id: 'preset-1', name: 'Product features', source: 'preset' as const, relevance: 85 },
      { id: 'preset-2', name: 'Customer testimonials', source: 'preset' as const, relevance: 82 },
      { id: 'preset-3', name: 'Integration capabilities', source: 'preset' as const, relevance: 80 },
      { id: 'preset-4', name: 'Security and compliance', source: 'preset' as const, relevance: 78 }
    ];

    const response = {
      trending: normalizedTrendingTopics.slice(0, 6),
      aiGenerated,
      preset,
      existing_count: existingTopics.length
    };

    console.log(`✅ Generated ${trendingTopics.length} trending topics, ${Object.values(aiGenerated).flat().length} AI topics, and found ${existingTopics.length} existing topics`);

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('❌ Failed to generate topics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate topics'
    });
  }
});

/**
 * POST /onboarding/prompts
 * Generate prompts/queries for specific topics
 */
router.post('/prompts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brand_name, industry, competitors = [], topics = [], locale = 'en-US', country = 'US', brand_id, website_url } = req.body;

    if (!brand_name || typeof brand_name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Brand name is required',
      });
      return;
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one topic is required',
      });
      return;
    }

    // Get customer_id from authenticated user
    const customer_id = req.user?.customer_id;
    if (!customer_id) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    console.log(`🔍 Generating prompts for ${topics.length} topics for ${brand_name}`);

    // Try to get existing brand data from database
    let existingBrand = null;
    let brandCompetitors: string[] = competitors;
    let brandIndustry = industry;

    if (customer_id) {
      try {
        // Try to find brand by ID first, then by name/URL
        if (brand_id) {
          existingBrand = await brandService.getBrandById(brand_id, customer_id);
        }
        
        if (!existingBrand) {
          existingBrand = await brandService.findBrandByUrlOrName(
            website_url,
            brand_name,
            customer_id
          );
        }

        if (existingBrand) {
          console.log(`✅ Found existing brand: ${existingBrand.name}`);
          
          // Use existing brand data
          brandIndustry = existingBrand.industry || industry || 'General';
          brandCompetitors = existingBrand.competitors || competitors;
        }
      } catch (brandError) {
        console.log('⚠️ Could not fetch existing brand data, using provided values:', brandError);
      }
    }

    // Use Cerebras or OpenAI directly to generate queries without database operations
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    const openaiApiKey = process.env['OPENAI_API_KEY'];

    let generatedQueries: Array<{ topic: string; query: string }> = [];

    // Build a simple prompt for query generation using brand data
    const finalIndustry = brandIndustry || industry || 'General';
    const finalCompetitors = brandCompetitors.length > 0 
      ? `Competitors: ${brandCompetitors.join(', ')}. ` 
      : '';
    
    const prompt = `You are an SEO expert. Generate 3-5 realistic search queries for each topic about ${brand_name} in the ${finalIndustry} industry. ${finalCompetitors}

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no code blocks. Just the JSON array.
Format:
[
  {"topic": "Topic Name", "query": "search query text"},
  {"topic": "Topic Name", "query": "another search query"}
]

Generate queries that real users would type into Google. Make them specific and actionable.`;

    try {
      // Try Cerebras first
      if (cerebrasApiKey && cerebrasApiKey !== 'your_cerebras_api_key_here') {
        const response = await fetch('https://api.cerebras.ai/v1/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cerebrasApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: cerebrasModel,
            prompt: prompt,
            max_tokens: 2000,
            temperature: 0.7,
            stop: ['---END---']
          })
        });

        if (response.ok) {
          const data = await response.json() as any;
          const generatedText = data.choices?.[0]?.text || '';
          
          if (generatedText) {
            try {
              // Try multiple JSON extraction methods
              let jsonStr = '';
              
              // Method 1: Remove markdown code blocks if present
              let cleanText = generatedText.trim();
              if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
              
              // Method 2: Find complete JSON array by counting brackets (more reliable)
              let bracketCount = 0;
              let startIndex = -1;
              
              for (let i = 0; i < cleanText.length; i++) {
                if (cleanText[i] === '[') {
                  if (startIndex === -1) {
                    startIndex = i;
                  }
                  bracketCount++;
                } else if (cleanText[i] === ']') {
                  bracketCount--;
                  if (bracketCount === 0 && startIndex !== -1) {
                    jsonStr = cleanText.substring(startIndex, i + 1);
                    break;
                  }
                }
              }
              
              // Method 3: Fallback to regex if bracket counting didn't work
              if (!jsonStr) {
                const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  jsonStr = jsonMatch[0];
                }
              }
              
              if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ Successfully parsed ${parsed.length} queries from Cerebras response`);
                }
              } else {
                console.warn('⚠️ No valid JSON array found in Cerebras response');
              }
            } catch (parseError) {
              console.error('❌ Failed to parse Cerebras JSON response:', parseError);
              console.log('🔍 Raw response snippet:', generatedText.substring(0, 500));
            }
          }
        }
      }

      // Fallback to OpenAI if Cerebras failed
      if (generatedQueries.length === 0 && openaiApiKey && openaiApiKey !== 'your_openai_api_key_here') {
        try {
          const { OpenAI } = await import('openai');
          const openai = new OpenAI({ apiKey: openaiApiKey });

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an SEO expert. Return only valid JSON arrays. Do not include any text before or after the JSON array.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
          });

          const responseText = completion.choices[0]?.message?.content || '';
          
          if (responseText) {
            try {
              // Try multiple JSON extraction methods
              let jsonStr = '';
              
              // Method 1: Remove markdown code blocks if present
              let cleanText = responseText.trim();
              if (cleanText.startsWith('```json')) {
                cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
              } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
              }
              
              // Method 2: Find complete JSON array by counting brackets (more reliable)
              let bracketCount = 0;
              let startIndex = -1;
              
              for (let i = 0; i < cleanText.length; i++) {
                if (cleanText[i] === '[') {
                  if (startIndex === -1) {
                    startIndex = i;
                  }
                  bracketCount++;
                } else if (cleanText[i] === ']') {
                  bracketCount--;
                  if (bracketCount === 0 && startIndex !== -1) {
                    jsonStr = cleanText.substring(startIndex, i + 1);
                    break;
                  }
                }
              }
              
              // Method 3: Fallback to regex if bracket counting didn't work
              if (!jsonStr) {
                const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  jsonStr = jsonMatch[0];
                }
              }
              
              if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ Successfully parsed ${parsed.length} queries from OpenAI response`);
                }
              } else {
                console.warn('⚠️ No valid JSON array found in OpenAI response');
              }
            } catch (parseError) {
              console.error('❌ Failed to parse OpenAI JSON response:', parseError);
              console.log('🔍 Raw response snippet:', responseText.substring(0, 500));
            }
          }
        } catch (openaiError) {
          console.error('❌ OpenAI API error:', openaiError);
        }
      }
    } catch (error) {
      console.error('❌ Error generating queries:', error);
    }

    // Fallback: Generate basic prompts if AI generation failed
    if (generatedQueries.length === 0) {
      console.log('⚠️ AI generation failed, generating fallback prompts');
      topics.forEach((topic) => {
        generatedQueries.push(
          { topic, query: `What are ${brand_name}'s ${topic.toLowerCase()}?` },
          { topic, query: `How does ${brand_name} handle ${topic.toLowerCase()}?` },
          { topic, query: `${brand_name} ${topic.toLowerCase()} information` }
        );
      });
    }

    // Group queries by topic
    const promptsByTopic: Record<string, string[]> = {};
    generatedQueries.forEach((item) => {
      if (item.topic && item.query) {
        if (!promptsByTopic[item.topic]) {
          promptsByTopic[item.topic] = [];
        }
        promptsByTopic[item.topic].push(item.query);
      }
    });

    // Format response as array of topic-prompts pairs
    const result = topics.map(topic => ({
      topic,
      prompts: promptsByTopic[topic] || []
    }));

    console.log(`✅ Generated ${generatedQueries.length} prompts for ${Object.keys(promptsByTopic).length} topics`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Failed to generate prompts:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate prompts'
    });
  }
});

export default router;

