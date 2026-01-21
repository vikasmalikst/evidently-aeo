import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { onboardingIntelService } from '../services/onboarding';
import { trendingKeywordsService } from '../services/keywords/trending-keywords.service';
import { aeoCategorizationService } from '../services/aeo-categorization.service';
import { brandService } from '../services/brand.service';
import { topicsQueryGenerationService } from '../services/topics-query-generation.service';
import { brandProductEnrichmentService } from '../services/onboarding/brand-product-enrichment.service';

const router = Router();

// Request deduplication cache for topics endpoint
const topicsRequestCache = new Map<string, Promise<any>>();
// Request deduplication cache for prompts endpoint
const promptsRequestCache = new Map<string, Promise<any>>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

function getTopicsRequestKey(req: Request): string {
  const { brand_name, industry, brand_id, customer_id } = {
    brand_name: req.body?.brand_name,
    industry: req.body?.industry,
    brand_id: req.body?.brand_id,
    customer_id: (req as any).user?.customer_id
  };
  return `${customer_id || 'anon'}:${brand_id || 'no-id'}:${brand_name || 'no-name'}:${industry || 'no-industry'}`;
}

function getPromptsRequestKey(req: Request): string {
  const { brand_name, topics, brand_id, customer_id } = {
    brand_name: req.body?.brand_name,
    topics: req.body?.topics,
    brand_id: req.body?.brand_id,
    customer_id: (req as any).user?.customer_id
  };
  const topicsKey = Array.isArray(topics) ? topics.sort().join(',') : 'no-topics';
  return `${customer_id || 'anon'}:${brand_id || 'no-id'}:${brand_name || 'no-name'}:${topicsKey}`;
}

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
            competitorDetails = existingBrand.brand_competitors.map((comp: any) => {
              // Build competitor domain with proper fallback
              const compUrlDomain = comp.competitor_url?.replace(/^https?:\/\//, '').split('/')[0] || '';
              const compNameDomain = comp.competitor_name.toLowerCase().replace(/\s+/g, '');
              const compDomain = compUrlDomain || (compNameDomain ? `${compNameDomain}.com` : '');
              const compLogo = compDomain ? `https://logo.clearbit.com/${compDomain}` : '';
              
              return {
                name: comp.competitor_name,
                logo: compLogo,
                relevance: 'Direct Competitor',
                industry: existingBrand.industry || '',
                domain: compDomain,
                url: comp.competitor_url || (compDomain ? `https://${compDomain}` : ''),
                priority: comp.priority || 999
              };
            });
          }
          
          // Format response with existing data - include all available fields
          // Build logo URL with proper fallback to brand name (same format as dashboard)
          const brandDomain = existingBrand.homepage_url?.replace(/^https?:\/\//, '').split('/')[0] || '';
          const brandNameDomain = existingBrand.name.toLowerCase().replace(/\s+/g, '');
          const logoDomain = brandDomain || (brandNameDomain ? `${brandNameDomain}.com` : '');
          // Use same logo format as dashboard: metadata.logo or metadata.brand_logo
          const logoUrl = existingBrand.metadata?.logo || existingBrand.metadata?.brand_logo || 
            (logoDomain ? `https://logo.clearbit.com/${logoDomain}` : '');

          const brandIntel = {
            verified: true,
            companyName: existingBrand.name,
            website: existingBrand.homepage_url || input,
            domain: brandDomain || logoDomain,
            logo: logoUrl,
            industry: existingBrand.industry || 'General',
            headquarters: existingBrand.headquarters || existingBrand.metadata?.headquarters || '',
            founded: existingBrand.founded_year || existingBrand.metadata?.founded_year || null,
            ceo: existingBrand.ceo || existingBrand.metadata?.ceo || '',
            description: existingBrand.summary || existingBrand.description || existingBrand.metadata?.description || '',
            metadata: {
              ...(existingBrand.metadata || {}),
              logo: logoUrl, // Add logo to metadata for dashboard compatibility
              brand_logo: logoUrl, // Also add as brand_logo for compatibility
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
      url: req.body?.url,
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

router.post('/brand-products/preview', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { brand_name, industry, competitors, website_url } = req.body ?? {};

    console.log('🔍 [BACKEND] Received brand-products/preview request:', {
      brand_name,
      competitors_count: Array.isArray(competitors) ? competitors.length : 0,
      competitors: competitors,
      website_url
    });

    if (!brand_name || typeof brand_name !== 'string') {
      res.status(400).json({ success: false, error: 'brand_name is required' });
      return;
    }

    const competitorNames: string[] = Array.isArray(competitors)
      ? competitors
          .map((c: any) => (typeof c === 'string' ? c : c?.name))
          .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
      : [];

    const competitorDomains: Record<string, string> = {};
    if (Array.isArray(competitors)) {
      competitors.forEach((c: any) => {
        if (typeof c !== 'string' && c?.name && c?.url) {
          competitorDomains[c.name] = c.url;
        }
      });
    }

    const result = await brandProductEnrichmentService.previewEnrichment(
      {
        brandName: brand_name,
        industry: typeof industry === 'string' ? industry : undefined,
        competitors: competitorNames,
        brandDomain: typeof website_url === 'string' ? website_url : undefined,
        competitorDomains: Object.keys(competitorDomains).length > 0 ? competitorDomains : undefined,
      },
      (msg: string) => console.log(msg)
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ Brand products preview failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate brand products preview',
    });
  }
});

/**
 * POST /onboarding/topics
 * Generate topics for brand using trending keywords and AI categorization
 */
router.post('/topics', authenticateToken, async (req: Request, res: Response) => {
  const requestKey = getTopicsRequestKey(req);
  const existingRequest = topicsRequestCache.get(requestKey);

  // If there's a pending request for the same parameters, wait for it and return the same result
  if (existingRequest) {
    console.log(`🔄 Duplicate topics request detected, reusing pending request for key: ${requestKey}`);
    try {
      const result = await existingRequest;
      return res.json(result);
    } catch (error) {
      // If the existing request failed, remove it and continue with new request
      topicsRequestCache.delete(requestKey);
    }
  }

  // Create a new request promise
  const requestPromise = (async () => {
    const { brand_name, industry, competitors = [], locale = 'en-US', country = 'US', brand_id, website_url } = req.body;
    const customer_id = req.user?.customer_id;

    if (!brand_name || typeof brand_name !== 'string') {
      throw { status: 400, message: 'Brand name is required' };
    }

    console.log(`🎯 Generating topics for ${brand_name} in ${industry || 'General'} industry`);
    console.log(`🔍 Topic generation params:`, { brand_name, brand_id, website_url, customer_id });

    // Try to get existing brand data from database
    let existingBrand = null;
    let brandCompetitors: string[] = competitors;
    let brandIndustry = industry;
    let existingTopics: any[] = [];

    if (customer_id) {
      try {
        // Try to find brand by ID first, then by name/URL
        if (brand_id) {
          console.log(`🔍 Looking up brand by ID: ${brand_id}`);
          existingBrand = await brandService.getBrandById(brand_id, customer_id);
          if (existingBrand) {
            console.log(`✅ Found brand by ID: ${existingBrand.name} (requested: ${brand_name})`);
            // Verify the brand ID matches the brand name - if not, ignore it
            if (existingBrand.name.toLowerCase() !== brand_name.toLowerCase()) {
              console.warn(`⚠️ Brand ID ${brand_id} points to "${existingBrand.name}" but request is for "${brand_name}" - ignoring brand_id`);
              existingBrand = null;
            }
          }
        }
        
        if (!existingBrand) {
          console.log(`🔍 Looking up brand by name/URL: name="${brand_name}", url="${website_url}"`);
          existingBrand = await brandService.findBrandByUrlOrName(
            website_url,
            brand_name,
            customer_id
          );
        }

        if (existingBrand) {
          console.log(`✅ Found existing brand: ${existingBrand.name} (matches request for: ${brand_name})`);
          
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

    // Fetch topics and trending keywords in PARALLEL (not sequential)
    const [topicsAndQueriesResult, trendingResult] = await Promise.all([
      // Primary: Generate AI topics
      topicsQueryGenerationService.generateTopicsAndQueries({
        brandName: brand_name,
        industry: brandIndustry || industry || 'General',
        competitors: brandCompetitors,
        maxTopics: 20
      }),
      // Parallel: Fetch trending keywords (with timeout to not block too long)
      Promise.race([
        trendingKeywordsService.getTrendingKeywords({
          brand: brand_name,
          industry: brandIndustry || 'General',
          competitors: brandCompetitors,
          locale,
          country,
          max_keywords: 6
        }).then((result) => {
          if (result.success && result.data) {
            return result.data.keywords.slice(0, 6).map((kw: any, index: number) => ({
              id: `trend-${index}`,
              name: kw.keyword,
              source: 'trending' as const,
              relevance: Math.round((kw.trend_score || 0.9) * 100),
              trendingIndicator: (kw.trend_score || 0.9) > 0.85 ? 'rising' : 'stable'
            }));
          }
          return [];
        }).catch((trendingError) => {
          console.warn('⚠️ Trending keywords failed (continuing without trending topics):', trendingError);
          return [];
        }),
        // 15 second timeout (increased from 10 to give more time)
        new Promise<any[]>((resolve) => setTimeout(() => {
          console.warn('⏱️ [TRENDING] Timeout after 15s, returning empty trending topics');
          resolve([]);
        }, 15000))
      ])
    ]);

    console.log(`✅ Generated ${topicsAndQueriesResult.topics.length} topics with queries using new service`);
    console.log(`📊 [TRENDING] Received ${trendingResult.length} trending topics for frontend`);

    // Organize topics by category using intent archetype mapping
    const aiGenerated: Record<string, any[]> = {
      awareness: [],
      comparison: [],
      purchase: [],
      'post-purchase support': []
    };

    topicsAndQueriesResult.topics.forEach((topicWithQuery: any, index: number) => {
      const category = topicsQueryGenerationService.mapIntentToCategory(topicWithQuery.intentArchetype);
      const categoryKey = category === 'post-purchase support' ? 'post-purchase support' : category;

      if (aiGenerated[categoryKey]) {
        aiGenerated[categoryKey].push({
          id: `ai-${index}`,
          name: topicWithQuery.topic,
          description: topicWithQuery.description,
          source: 'ai_generated' as const,
          category: category,
          relevance: topicWithQuery.priority * 20, // Convert 1-5 priority to 20-100 relevance
          priority: topicWithQuery.priority
        });
      }
    });

    // Include existing topics from database
    const existingTopicsFormatted = existingTopics.map((topic: any, index: number) => {
      const topicName = topic.topic_name || topic.topic || topic;
      const category = topic.category || 'awareness';
      const categoryKey = category === 'support' || category === 'post-purchase support' ? 'post-purchase support' : category;

      return {
        id: `existing-${index}`,
        name: topicName,
        source: 'existing' as const,
        category: category,
        relevance: 90
      };
    });

    // Merge existing topics into appropriate categories
    existingTopicsFormatted.forEach((topic) => {
      const categoryKey = topic.category === 'support' || topic.category === 'post-purchase support' ? 'post-purchase support' : topic.category;
      if (aiGenerated[categoryKey]) {
        const exists = aiGenerated[categoryKey].some(t => t.name.toLowerCase() === topic.name.toLowerCase());
        if (!exists) {
          aiGenerated[categoryKey].push(topic);
        }
      }
    });

    // Add minimal preset topics (keep a small set for fallback)
    const preset = [
      { id: 'preset-1', name: 'Product features', source: 'preset' as const, relevance: 85 },
      { id: 'preset-2', name: 'Customer testimonials', source: 'preset' as const, relevance: 82 },
      { id: 'preset-3', name: 'Integration capabilities', source: 'preset' as const, relevance: 80 },
      { id: 'preset-4', name: 'Security and compliance', source: 'preset' as const, relevance: 78 }
    ];

    // Map 'post-purchase support' back to 'support' for frontend compatibility
    const aiGeneratedForFrontend = {
      awareness: Array.isArray(aiGenerated.awareness) ? aiGenerated.awareness : [],
      comparison: Array.isArray(aiGenerated.comparison) ? aiGenerated.comparison : [],
      purchase: Array.isArray(aiGenerated.purchase) ? aiGenerated.purchase : [],
      support: Array.isArray(aiGenerated['post-purchase support']) ? aiGenerated['post-purchase support'] : []
    };

    const response = {
      trending: trendingResult, // Use trending topics from parallel fetch
      aiGenerated: aiGeneratedForFrontend,
      preset,
      existing_count: existingTopics.length,
      primaryDomain: topicsAndQueriesResult.primaryDomain
    };

    console.log(`✅ Generated ${topicsAndQueriesResult.topics.length} topics using new service, ${Object.values(aiGenerated).flat().length} total AI topics, and found ${existingTopics.length} existing topics`);

    return {
      success: true,
      data: response
    };
  })();

  // Store the promise in cache
  topicsRequestCache.set(requestKey, requestPromise);

  // Clean up cache after request completes (success or failure)
  requestPromise
    .then(() => {
      setTimeout(() => topicsRequestCache.delete(requestKey), DEDUP_WINDOW_MS);
    })
    .catch(() => {
      topicsRequestCache.delete(requestKey);
    });

  // Handle the request
  try {
    const result = await requestPromise;
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('❌ Failed to generate topics:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate topics'
      });
    }
  }
});

/**
 * POST /onboarding/prompts
 * Generate prompts/queries for specific topics
 */
router.post('/prompts', authenticateToken, async (req: Request, res: Response) => {
  const requestKey = getPromptsRequestKey(req);
  const existingRequest = promptsRequestCache.get(requestKey);

  // If there's a pending request for the same parameters, wait for it and return the same result
  if (existingRequest) {
    console.log(`🔄 Duplicate prompts request detected, reusing pending request for key: ${requestKey}`);
    try {
      const result = await existingRequest;
      return res.json(result);
    } catch (error) {
      // If the existing request failed, remove it and continue with new request
      promptsRequestCache.delete(requestKey);
    }
  }

  // Create a new request promise
  const requestPromise = (async () => {
    const { brand_name, industry, competitors = [], topics = [], locale = 'en-US', country = 'US', brand_id, website_url } = req.body;

    if (!brand_name || typeof brand_name !== 'string') {
      throw { status: 400, message: 'Brand name is required' };
    }

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      throw { status: 400, message: 'At least one topic is required' };
    }

    // Get customer_id from authenticated user
    const customer_id = req.user?.customer_id;
    if (!customer_id) {
      throw { status: 401, message: 'User not authenticated' };
    }

    console.log(`🔍 Generating prompts for ${topics.length} topics for ${brand_name}`);
    console.log(`🔍 Prompt generation params:`, { brand_name, brand_id, website_url, customer_id, topics_count: topics.length });

    // Try to get existing brand data from database
    let existingBrand = null;
    let brandCompetitors: string[] = competitors;
    let brandIndustry = industry;

    if (customer_id) {
      try {
        // Try to find brand by ID first, then by name/URL
        if (brand_id) {
          console.log(`🔍 Looking up brand by ID: ${brand_id}`);
          existingBrand = await brandService.getBrandById(brand_id, customer_id);
          if (existingBrand) {
            console.log(`✅ Found brand by ID: ${existingBrand.name} (requested: ${brand_name})`);
            // Verify the brand ID matches the brand name - if not, ignore it
            if (existingBrand.name.toLowerCase() !== brand_name.toLowerCase()) {
              console.warn(`⚠️ Brand ID ${brand_id} points to "${existingBrand.name}" but request is for "${brand_name}" - ignoring brand_id`);
              existingBrand = null;
            }
          }
        }
        
        if (!existingBrand) {
          console.log(`🔍 Looking up brand by name/URL: name="${brand_name}", url="${website_url}"`);
          existingBrand = await brandService.findBrandByUrlOrName(
            website_url,
            brand_name,
            customer_id
          );
        }

        if (existingBrand) {
          console.log(`✅ Found existing brand: ${existingBrand.name} (matches request for: ${brand_name})`);
          
          // Use existing brand data
          brandIndustry = existingBrand.industry || industry || 'General';
          brandCompetitors = existingBrand.competitors || competitors;
        } else {
          console.log(`ℹ️ No existing brand found for "${brand_name}" - using provided values for prompt generation`);
        }
      } catch (brandError) {
        console.log('⚠️ Could not fetch existing brand data, using provided values:', brandError);
      }
    }

    // Use OpenRouter as primary (gpt-4o-mini), fallback to gpt-5-nano, then Cerebras, then Gemini
    const openRouterApiKey = process.env['OPENROUTER_API_KEY'];
    const openRouterModel = process.env['OPENROUTER_MODEL'] || 'openai/gpt-4o-mini';
    const openRouterFallbackModel = 'openai/gpt-5-nano-2025-08-07';
    const openRouterSiteUrl = process.env['OPENROUTER_SITE_URL'];
    const openRouterSiteTitle = process.env['OPENROUTER_SITE_TITLE'];
    const cerebrasApiKey = process.env['CEREBRAS_API_KEY'];
    const cerebrasModel = process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507';
    // Standardize on GOOGLE_GEMINI_API_KEY (fallback to GEMINI_API_KEY for compatibility)
    const geminiApiKey = process.env['GOOGLE_GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'];

    let generatedQueries: Array<{ topic: string; query: string }> = [];

    // Helper function to extract JSON array from text
    const extractJsonArray = (text: string): string | null => {
      let cleanText = text.trim();
      
      // Remove markdown code blocks if present
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Find complete JSON array by counting brackets
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
            return cleanText.substring(startIndex, i + 1);
          }
        }
      }
      
      // Fallback to regex if bracket counting didn't work
      const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
      return jsonMatch ? jsonMatch[0] : null;
    };

    // Build prompt for query generation
    const finalIndustry = brandIndustry || industry || 'General';
    const finalCompetitors = brandCompetitors.length > 0 
      ? `Competitors: ${brandCompetitors.join(', ')}. ` 
      : '';
    
    // Extract topic names from topic objects (topics can be strings or objects with 'name' property)
    const topicNames = topics.map((t: any) => {
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object' && t.name) return t.name;
      if (t && typeof t === 'object' && t.topic) return t.topic;
      return String(t);
    });

    console.log(`📝 [PROMPTS] Extracted ${topicNames.length} topic names:`, topicNames.slice(0, 5), topicNames.length > 5 ? '...' : '');
    
    const prompt = `You are an SEO expert. Generate 3-5 realistic, neutral search queries for each topic in the ${finalIndustry} industry. ${finalCompetitors}

CRITICAL RULES:
- Queries must be NEUTRAL and INDUSTRY-FOCUSED
- DO NOT include the brand name "${brand_name}" in any query
- DO NOT include competitor names in queries (unless it's a comparison query)
- Queries should help users find and evaluate options in the ${finalIndustry} industry
- Think from customer perspective: "How would someone search when researching ${finalIndustry} options?"

Topics:
${topicNames.map((t, i) => `${i + 1}. ${t}`).join('\n')}

CRITICAL: Return ONLY a valid JSON array. No explanations, no markdown, no code blocks. Just the JSON array.
Format:
[
  {"topic": "Topic Name", "query": "neutral industry-focused search query without brand name"},
  {"topic": "Topic Name", "query": "another neutral search query"}
]

Generate queries that real users would type into Google. Make them specific, actionable, and NEUTRAL (no brand mentions).`;

    let openRouterFailed = false;
    let cerebrasFailed = false;
    let geminiFailed = false;

    console.log('📝 Prompts generation prompt preview:', prompt.substring(0, 500) + '...');
    
    // Try OpenRouter first (primary)
    if (openRouterApiKey && openRouterApiKey !== 'your_openrouter_api_key_here') {
      try {
        console.log('🌐 [PROMPTS FLOW] Step 1: Attempting prompt generation with OpenRouter (primary)...');
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        };
        if (openRouterSiteUrl) {
          headers['HTTP-Referer'] = openRouterSiteUrl;
        }
        if (openRouterSiteTitle) {
          headers['X-Title'] = openRouterSiteTitle;
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: openRouterModel,
            messages: [
              { role: 'system', content: 'You are an SEO expert. Always respond with valid JSON arrays only. No explanations, no markdown, no code blocks.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const generatedText = data.choices?.[0]?.message?.content || '';
          
          if (generatedText) {
            const jsonStr = extractJsonArray(generatedText);
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ [PROMPTS FLOW] Step 1 SUCCESS: Generated ${parsed.length} queries using OpenRouter`);
                  console.log(`🔍 [PROMPTS FLOW] OpenRouter response preview:`, JSON.stringify(parsed).substring(0, 500) + '...');
                }
              } catch (parseError) {
                console.error('❌ Failed to parse OpenRouter JSON response:', parseError);
                openRouterFailed = true;
              }
            } else {
              console.warn('⚠️ No valid JSON array found in OpenRouter response');
              openRouterFailed = true;
            }
          } else {
            openRouterFailed = true;
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [PROMPTS FLOW] Step 1 FAILED: OpenRouter API error: ${response.status} ${errorText}`);
          openRouterFailed = true;
        }
      } catch (openRouterError) {
        console.error('❌ [PROMPTS FLOW] Step 1 FAILED: OpenRouter API request failed:', openRouterError);
        openRouterFailed = true;
      }
    } else {
      console.warn('⚠️ [PROMPTS FLOW] Step 1 SKIPPED: OpenRouter API key not configured');
      openRouterFailed = true;
    }

    // Fallback to OpenRouter with gpt-5-nano-2025-08-07 if primary failed
    if (generatedQueries.length === 0 && openRouterApiKey && openRouterApiKey !== 'your_openrouter_api_key_here') {
      try {
        console.log(`🔄 [PROMPTS FLOW] Step 2: Attempting prompt generation with OpenRouter fallback (${openRouterFallbackModel})...`);
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
        };
        if (openRouterSiteUrl) {
          headers['HTTP-Referer'] = openRouterSiteUrl;
        }
        if (openRouterSiteTitle) {
          headers['X-Title'] = openRouterSiteTitle;
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: openRouterFallbackModel,
            messages: [
              { role: 'system', content: 'You are an SEO expert. Always respond with valid JSON arrays only. No explanations, no markdown, no code blocks.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json() as any;
          const generatedText = data.choices?.[0]?.message?.content || '';
          
          if (generatedText) {
            const jsonStr = extractJsonArray(generatedText);
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ [PROMPTS FLOW] Step 2 SUCCESS: Generated ${parsed.length} queries using OpenRouter fallback (${openRouterFallbackModel})`);
                  console.log(`🔍 [PROMPTS FLOW] OpenRouter fallback response preview:`, JSON.stringify(parsed).substring(0, 500) + '...');
                }
              } catch (parseError) {
                console.error('❌ Failed to parse OpenRouter fallback JSON response:', parseError);
              }
            }
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [PROMPTS FLOW] Step 2 FAILED: OpenRouter fallback API error: ${response.status} ${errorText}`);
        }
      } catch (fallbackError) {
        console.error('❌ [PROMPTS FLOW] Step 2 FAILED: OpenRouter fallback API request failed:', fallbackError);
      }
    }

    // Fallback to Cerebras if OpenRouter failed
    if (generatedQueries.length === 0 && cerebrasApiKey && cerebrasApiKey !== 'your_cerebras_api_key_here') {
      try {
        console.log('🧠 [PROMPTS FLOW] Step 3: Attempting prompt generation with Cerebras (tertiary)...');
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
            const jsonStr = extractJsonArray(generatedText);
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ [PROMPTS FLOW] Step 2 SUCCESS: Generated ${parsed.length} queries using Cerebras`);
                  console.log(`🔍 [PROMPTS FLOW] Cerebras response preview:`, JSON.stringify(parsed).substring(0, 500) + '...');
                }
              } catch (parseError) {
                console.error('❌ Failed to parse Cerebras JSON response:', parseError);
                cerebrasFailed = true;
              }
            } else {
              console.warn('⚠️ No valid JSON array found in Cerebras response');
              cerebrasFailed = true;
            }
          } else {
            cerebrasFailed = true;
          }
        } else {
          console.error(`❌ [PROMPTS FLOW] Step 2 FAILED: Cerebras API error: ${response.status} ${response.statusText}`);
          cerebrasFailed = true;
        }
      } catch (cerebrasError) {
        console.error('❌ [PROMPTS FLOW] Step 2 FAILED: Cerebras API request failed:', cerebrasError);
        cerebrasFailed = true;
      }
    } else if (generatedQueries.length === 0) {
      console.warn('⚠️ [PROMPTS FLOW] Step 2 SKIPPED: Cerebras API key not configured');
      cerebrasFailed = true;
    }

    // Fallback to Gemini if both OpenRouter and Cerebras failed
    if (generatedQueries.length === 0 && geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('🤖 [PROMPTS FLOW] Step 3: Attempting prompt generation with Gemini (tertiary fallback)...');
        const geminiModel = process.env['GOOGLE_GEMINI_MODEL'] || 'gemini-1.5-flash-002';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [{
                  text: `You are an SEO expert. Return only valid JSON arrays. No explanations, no markdown, no code blocks.\n\n${prompt}`,
                }],
              }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json() as any;
          const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (generatedText) {
            const jsonStr = extractJsonArray(generatedText);
            if (jsonStr) {
              try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  generatedQueries = parsed;
                  console.log(`✅ [PROMPTS FLOW] Step 3 SUCCESS: Generated ${parsed.length} queries using Gemini`);
                  console.log(`🔍 [PROMPTS FLOW] Gemini response preview:`, JSON.stringify(parsed).substring(0, 500) + '...');
                }
              } catch (parseError) {
                console.error('❌ Failed to parse Gemini JSON response:', parseError);
                geminiFailed = true;
              }
            } else {
              console.warn('⚠️ No valid JSON array found in Gemini response');
              geminiFailed = true;
            }
          } else {
            geminiFailed = true;
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ [PROMPTS FLOW] Step 3 FAILED: Gemini API error: ${response.status} ${errorText}`);
          geminiFailed = true;
        }
      } catch (geminiError) {
        console.error('❌ [PROMPTS FLOW] Step 3 FAILED: Gemini API request failed:', geminiError);
        geminiFailed = true;
      }
    } else if (generatedQueries.length === 0) {
      console.warn('⚠️ [PROMPTS FLOW] Step 3 SKIPPED: Gemini API key not configured');
      geminiFailed = true;
    }

    // If all providers failed, throw error
    if (generatedQueries.length === 0) {
      const errorMsg = 'Prompt generation failed: All providers (OpenRouter, Cerebras, Gemini) failed';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
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

    return {
      success: true,
      data: result
    };
  })();

  // Store the promise in cache
  promptsRequestCache.set(requestKey, requestPromise);

  // Clean up cache after request completes (success or failure)
  requestPromise
    .then(() => {
      setTimeout(() => promptsRequestCache.delete(requestKey), DEDUP_WINDOW_MS);
    })
    .catch(() => {
      promptsRequestCache.delete(requestKey);
    });

  // Handle the request
  try {
    const result = await requestPromise;
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({
        success: false,
        error: error.message
      });
    } else {
      console.error('❌ Failed to generate prompts:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate prompts'
      });
    }
  }
});

export default router;
