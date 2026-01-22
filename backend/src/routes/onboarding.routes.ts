import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { onboardingIntelService } from '../services/onboarding';
import { brandService } from '../services/brand.service';
import { topicsQueryGenerationService } from '../services/topics-query-generation.service';
import { brandProductEnrichmentService } from '../services/onboarding/brand-product-enrichment.service';
import { websiteScraperService } from '../services/website-scraper.service';
import { promptGenerationService } from '../services/prompt-generation.service';

const router = Router();

function getTopicsRequestKey(req: Request): string {
  const { brand_name, industry, brand_id, website_url, customer_id } = {
    brand_name: req.body?.brand_name,
    industry: req.body?.industry,
    brand_id: req.body?.brand_id,
    website_url: req.body?.website_url,
    customer_id: (req as any).user?.customer_id
  };
  return `${customer_id || 'anon'}:${brand_id || 'no-id'}:${brand_name || 'no-name'}:${industry || 'no-industry'}:${website_url || 'no-website'}`;
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

// Request deduplication caches
const topicsRequestCache = new Map<string, Promise<any>>();
const promptsRequestCache = new Map<string, Promise<any>>();
const DEDUP_WINDOW_MS = 5000; // 5 seconds

/**
 * POST /onboarding/topics
 * Generate topics AND trending keywords in a SINGLE LLM call
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
      topicsRequestCache.delete(requestKey);
    }
  }

  // Create a new request promise
  const requestPromise = (async () => {
    const { brand_name, industry, competitors = [], brand_id, website_url } = req.body;
    const customer_id = req.user?.customer_id;

    if (!brand_name || typeof brand_name !== 'string') {
      throw { status: 400, message: 'Brand name is required' };
    }

    console.log(`🎯 [TOPICS] Generating topics for ${brand_name} in ${industry || 'General'} industry`);

    // Try to get existing brand data from database
    let existingBrand = null;
    let brandCompetitors: string[] = competitors;
    let brandIndustry = industry;
    let existingTopics: any[] = [];

    if (customer_id) {
      try {
        if (brand_id) {
          existingBrand = await brandService.getBrandById(brand_id, customer_id);
          if (existingBrand && existingBrand.name.toLowerCase() !== brand_name.toLowerCase()) {
            existingBrand = null;
          }
        }
        
        if (!existingBrand) {
          existingBrand = await brandService.findBrandByUrlOrName(website_url, brand_name, customer_id);
        }

        if (existingBrand) {
          brandIndustry = existingBrand.industry || industry || 'General';
          brandCompetitors = existingBrand.competitors || competitors;
          existingTopics = await brandService.getBrandTopics(existingBrand.id, customer_id);
          console.log(`📋 Found ${existingTopics.length} existing topics in database`);
        }
      } catch (brandError) {
        console.log('⚠️ Could not fetch existing brand data:', brandError);
      }
    }

    // Scrape homepage (best-effort) for keywords
    let scrapeResult = null;
    if (website_url && typeof website_url === 'string' && website_url.trim()) {
      try {
        console.log(`🕸️ [TOPICS] Scraping homepage: ${website_url}`);
        scrapeResult = await websiteScraperService.scrapeHomepage(website_url, {
          brandName: brand_name,
          timeoutMs: 6000,
          maxKeywords: 15
        });
      } catch (scrapeError) {
        console.warn('⚠️ [TOPICS] Scraping failed (continuing without):', scrapeError);
      }
    }

    // Single LLM call for BOTH topics AND trending
    const unifiedResult = await topicsQueryGenerationService.generateTopicsAndQueries({
      brandName: brand_name,
      industry: brandIndustry || industry || 'General',
      competitors: brandCompetitors,
      description: existingBrand?.summary || existingBrand?.description || undefined,
      websiteContent: scrapeResult?.websiteContent,
      brandKeywords: scrapeResult?.brandKeywords,
      industryKeywords: scrapeResult?.industryKeywords,
      maxTopics: 20
    });

    console.log(`✅ [TOPICS] Generated ${unifiedResult.topics.length} topics + ${unifiedResult.trending.length} trending keywords`);

    // Format trending for frontend (from unified LLM response)
    const trendingForFrontend = unifiedResult.trending.map((tr, index) => ({
      id: `trend-${index}`,
      name: tr.keyword,
      source: 'trending' as const,
      relevance: 90,
      trendingIndicator: 'rising' as const
    }));

    // Organize topics by category
    const aiGenerated: Record<string, any[]> = {
      awareness: [],
      comparison: [],
      purchase: [],
      support: []
    };

    unifiedResult.topics.forEach((topicItem, index) => {
      const category = topicsQueryGenerationService.mapIntentToCategory(topicItem.intentArchetype);
      const categoryKey = category === 'post-purchase support' ? 'support' : category;

      if (aiGenerated[categoryKey]) {
        aiGenerated[categoryKey].push({
          id: `ai-${index}`,
          name: topicItem.topic,
          source: 'ai_generated' as const,
          category: categoryKey,
          relevance: 80
        });
      }
    });

    // Include existing topics from database
    existingTopics.forEach((topic: any, index: number) => {
      const topicName = topic.topic_name || topic.topic || topic;
      const category = topic.category || 'awareness';
      const categoryKey = category === 'support' || category === 'post-purchase support' ? 'support' : category;

      if (aiGenerated[categoryKey]) {
        const exists = aiGenerated[categoryKey].some(t => t.name.toLowerCase() === topicName.toLowerCase());
        if (!exists) {
          aiGenerated[categoryKey].push({
            id: `existing-${index}`,
            name: topicName,
            source: 'existing' as const,
            category: categoryKey,
            relevance: 90
          });
        }
      }
    });

    // Minimal preset topics (fallback)
    const preset = [
      { id: 'preset-1', name: 'Product features', source: 'preset' as const, relevance: 85 },
      { id: 'preset-2', name: 'Customer testimonials', source: 'preset' as const, relevance: 82 },
      { id: 'preset-3', name: 'Integration capabilities', source: 'preset' as const, relevance: 80 },
      { id: 'preset-4', name: 'Security and compliance', source: 'preset' as const, relevance: 78 }
    ];

    const response = {
      trending: trendingForFrontend,
      aiGenerated,
      preset,
      existing_count: existingTopics.length,
      primaryDomain: unifiedResult.primaryDomain
    };

    console.log(`✅ [TOPICS] Final: ${unifiedResult.topics.length} AI topics, ${trendingForFrontend.length} trending, ${existingTopics.length} existing`);

    return { success: true, data: response };
  })();

  // Store the promise in cache
  topicsRequestCache.set(requestKey, requestPromise);

  // Clean up cache after request completes
  requestPromise
    .then(() => setTimeout(() => topicsRequestCache.delete(requestKey), DEDUP_WINDOW_MS))
    .catch(() => topicsRequestCache.delete(requestKey));

  // Handle the request
  try {
    const result = await requestPromise;
    res.json(result);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ success: false, error: error.message });
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

    // Extract topic names from topic objects (topics can be strings or objects with 'name' property)
    const topicNames = topics.map((t: any) => {
      if (typeof t === 'string') return t;
      if (t && typeof t === 'object' && t.name) return t.name;
      if (t && typeof t === 'object' && t.topic) return t.topic;
      return String(t);
    });

    console.log(`📝 [PROMPTS] Extracted ${topicNames.length} topic names:`, topicNames.slice(0, 5), topicNames.length > 5 ? '...' : '');
    
    const finalIndustry = brandIndustry || industry || 'General';

    // Use dedicated prompt generation service
    const promptResult = await promptGenerationService.generatePrompts({
      brandName: brand_name,
      industry: finalIndustry,
      competitors: brandCompetitors,
      topics: topicNames,
    });

    console.log(`✅ [PROMPTS] Generated ${promptResult.queries.length} queries using ${promptResult.providerUsed}`);

    // Group queries by topic
    const promptsByTopic: Record<string, string[]> = {};
    promptResult.queries.forEach((item) => {
      if (item.topic && item.query) {
        if (!promptsByTopic[item.topic]) {
          promptsByTopic[item.topic] = [];
        }
        promptsByTopic[item.topic].push(item.query);
      }
    });

    // Format response as array of topic-prompts pairs
    const result = topicNames.map(topic => ({
      topic,
      prompts: promptsByTopic[topic] || []
    }));

    console.log(`✅ Generated ${promptResult.queries.length} prompts for ${Object.keys(promptsByTopic).length} topics`);

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
