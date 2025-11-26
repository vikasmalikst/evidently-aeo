/**
 * Brand Intelligence API
 * 
 * This file provides API functions for generating brand intelligence
 * using the LLM service. These functions can be called from the frontend.
 */

import { BrandIntel, BrandIntelRequest, BrandIntelResponse, LLMProvider } from '../types/index';
import { LLMService, createLLMServiceFromEnv } from '../server/llm';
import { validateBrandInput } from '../utils/validation';

/**
 * Create LLM service with a specific provider
 */
function createLLMServiceFromProvider(provider: LLMProvider | string): LLMService {
  // Normalize "openai" to "chatgpt" for backwards compatibility
  const normalizedProvider = provider.toLowerCase() === 'openai' ? 'chatgpt' : provider;
  
  switch (normalizedProvider) {
    case 'chatgpt':
      const openaiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY;
      if (!openaiKey) {
        throw new Error('OpenAI API key is required for ChatGPT provider. Please set VITE_OPENAI_API_KEY in your environment variables.');
      }
      return new LLMService({
        provider: 'chatgpt',
        apiKey: openaiKey,
        model: (import.meta as any).env?.VITE_OPENAI_MODEL || 'gpt-4o-mini'
      });
      
    case 'cerebras':
      const cerebrasKey = (import.meta as any).env?.VITE_CEREBRAS_API_KEY;
      if (!cerebrasKey) {
        throw new Error('Cerebras API key is required for Cerebras provider. Please set VITE_CEREBRAS_API_KEY in your environment variables.');
      }
      return new LLMService({
        provider: 'cerebras',
        apiKey: cerebrasKey,
        model: (import.meta as any).env?.VITE_CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507',
        baseUrl: (import.meta as any).env?.VITE_CEREBRAS_BASE_URL || 'https://api.cerebras.ai'
      });
      
    default:
      throw new Error(`Unsupported LLM provider: ${provider}. Supported providers are: cerebras, chatgpt`);
  }
}

/**
 * Generate brand intelligence from raw input
 * @param request - Brand intelligence request containing raw input
 * @returns Promise<BrandIntelResponse> - Generated brand intelligence
 */
export async function generateBrandIntel(
  request: BrandIntelRequest
): Promise<BrandIntelResponse> {
  console.log('🎯 Brand Intelligence API - Starting generation for:', request.raw);
  
  try {
    // ❌ REMOVED: localStorage clearing (database-first architecture)
    // localStorage.removeItem('brand_intel');
    // localStorage.removeItem('onboarding_artifact');
    console.log('🔄 Starting fresh brand intelligence generation');
    
    // Validate input
    const validation = validateBrandInput(request.raw);
    if (!validation.isValid) {
      console.error('❌ Input validation failed:', validation.error);
      throw new Error(validation.error || 'Invalid input');
    }

    /* ========================================
     * DATABASE-FIRST LOOKUP (TEMPORARILY DISABLED)
     * ========================================
     * Uncomment this section to enable database-first brand lookup
     * to reduce LLM API calls for existing brands.
     * ======================================== */
    
    /*
    // Extract URL and brand name from input
    const urlPattern = /https?:\/\/[^\s]+/i;
    const urlMatch = request.raw.match(urlPattern);
    const extractedUrl = urlMatch ? urlMatch[0] : null;
    
    // If no URL found, assume it's a brand name
    const brandName = !extractedUrl ? request.raw.trim() : null;

    // Try to find existing brand in database first
    console.log('🔍 Checking database for existing brand...');
    console.log('🔍 Search params:', { url: extractedUrl, name: brandName });
    
    try {
      // Build search URL with both url and name if available
      const searchParams = new URLSearchParams();
      if (extractedUrl) searchParams.append('url', extractedUrl);
      if (brandName) searchParams.append('name', brandName);
      
      // Get access token from localStorage
      const accessToken = localStorage.getItem('access_token');
      
      // Use environment variable for API URL, fallback to localhost for development
      const apiBaseUrl = (import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3000/api');
      
      const searchResponse = await fetch(`${apiBaseUrl}/brands/search?${searchParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const searchData = await searchResponse.json();
      
      if (searchData.success && searchData.data) {
        console.log('✅ Found existing brand in database!', searchData.data.name);
        console.log('💾 Using cached brand data instead of LLM API');
        console.log('📦 Full database brand data:', searchData.data);
        
        // Convert database brand to BrandIntel format
        const brandData = searchData.data;
        
        // Use onboarding_artifact if available for most complete data
        const artifactData = brandData.onboarding_artifact || {};
        
        // Debug logging for data sources
        console.log('🔍 Raw database data:', {
          competitors: brandData.competitors,
          aeo_topics: brandData.aeo_topics,
          topics: brandData.topics,
          artifactCompetitors: artifactData.competitors,
          artifactTopics: artifactData.topics || artifactData.aeo_topics
        });

        const brandIntel: BrandIntel = {
          input: { raw: extractedUrl || brandName || '' },
          brandName: brandData.name,
          homepageUrl: brandData.homepage_url,
          summary: brandData.summary || artifactData.description || artifactData.summary || '',
          ceo: brandData.ceo || artifactData.ceo,
          headquarters: brandData.headquarters || artifactData.headquarters,
          foundedYear: brandData.founded_year || artifactData.foundedYear,
          industry: brandData.industry || artifactData.industry,
          // Prioritize competitors from brand_competitors table, fallback to artifact
          competitors: brandData.competitors || artifactData.competitors || [],
          // Prioritize topics from database tables, fallback to artifact
          topics: brandData.aeo_topics || brandData.topics || artifactData.topics || artifactData.aeo_topics || [],
          sources: brandData.sources || artifactData.sources || [],
          generatedAtIso: brandData.metadata?.generated_at || artifactData.onboarding_completed_at || brandData.created_at || new Date().toISOString()
        };
        
        console.log('✨ Converted brand intel from database:', brandIntel);
        console.log('📊 Topics count:', brandIntel.topics?.length);
        console.log('🏆 Competitors count:', brandIntel.competitors?.length);
        console.log('📋 Full topics array:', brandIntel.topics);
        console.log('🏅 Full competitors array:', brandIntel.competitors);
        
        // Add a marker to indicate this came from database
        (brandIntel as any)._source = 'database';
        
        return brandIntel;
      }
    } catch (dbError) {
      console.log('ℹ️ No existing brand found in database, proceeding with LLM generation');
      console.log('🔍 Database error:', dbError);
    }
    */

    console.log('✅ Input validation passed, using LLM service...');
    
    // Use the provider from the request, or fall back to environment variable, or default to cerebras
    // Normalize "openai" to "chatgpt" for backwards compatibility
    let envProvider = ((import.meta as any).env?.VITE_LLM_PROVIDER as string) || 'cerebras';
    if (envProvider.toLowerCase() === 'openai') {
      envProvider = 'chatgpt';
    }
    const selectedProvider = (request.provider || envProvider as LLMProvider) || 'cerebras';
    console.log('🔧 Selected LLM provider:', selectedProvider);
    console.log('🔧 Environment LLM provider:', (import.meta as any).env?.VITE_LLM_PROVIDER || 'cerebras');

    // Create LLM service with the selected provider
    const llmService = createLLMServiceFromProvider(selectedProvider);
    
    // Generate brand intelligence using LLM service
    const brandIntel = await llmService.generateBrandIntel(request.raw);
    
    console.log('🎉 Brand intelligence generation completed successfully!');
    console.log('📊 Generated data summary:', {
      brandName: brandIntel.brandName,
      industry: brandIntel.industry,
      competitorsCount: brandIntel.competitors?.length || 0,
      competitors: brandIntel.competitors,
      ceo: brandIntel.ceo,
      headquarters: brandIntel.headquarters,
      foundedYear: brandIntel.foundedYear,
      topics: brandIntel.topics
    });
    console.log('🔍 Full brand intelligence object:', brandIntel);
    
    return brandIntel;
  } catch (error) {
    console.error('❌ Brand intelligence generation error:', error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to generate brand intelligence'
    );
  }
}

/**
 * Parse raw brand input to extract structured information
 */
function parseBrandInput(rawInput: string): {
  brandName: string;
  websiteUrl?: string;
  industry?: string;
  competitors?: string[];
} {
  // Extract brand name (first word or phrase)
  const brandName = rawInput.split(/[,\n]/)[0].trim();
  
  // Extract website URL
  const urlMatch = rawInput.match(/(https?:\/\/[^\s,]+)/i);
  const websiteUrl = urlMatch ? urlMatch[1] : undefined;
  
  // Extract industry (look for common industry keywords)
  const industryKeywords = [
    'technology', 'software', 'fintech', 'healthcare', 'e-commerce', 'retail',
    'manufacturing', 'automotive', 'aerospace', 'energy', 'finance', 'banking',
    'insurance', 'real estate', 'construction', 'food', 'beverage', 'fashion',
    'entertainment', 'media', 'education', 'consulting', 'logistics', 'transportation'
  ];
  
  let industry: string | undefined;
  const lowerInput = rawInput.toLowerCase();
  for (const keyword of industryKeywords) {
    if (lowerInput.includes(keyword)) {
      industry = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      break;
    }
  }
  
  // Extract competitors (look for "vs", "competitors", etc.)
  const competitorPatterns = [
    /vs\.?\s+([^.]+)/i,
    /competitors?[:\s]+([^.]+)/i,
    /competes with[:\s]+([^.]+)/i
  ];
  
  let competitors: string[] | undefined;
  for (const pattern of competitorPatterns) {
    const match = rawInput.match(pattern);
    if (match) {
      competitors = match[1]
        .split(/[,;|&]/)
        .map(c => c.trim())
        .filter(c => c.length > 0)
        .slice(0, 5); // Limit to 5 competitors
      break;
    }
  }
  
  return {
    brandName,
    websiteUrl,
    industry,
    competitors
  };
}

/**
 * Regenerate brand intelligence (useful for Step 2 - Review)
 * @param request - Brand intelligence request containing raw input
 * @returns Promise<BrandIntelResponse> - Regenerated brand intelligence
 */
export async function regenerateBrandIntel(
  request: BrandIntelRequest
): Promise<BrandIntelResponse> {
  // For now, this is the same as generateBrandIntel
  // In the future, we could add logic to vary the generation
  return generateBrandIntel(request);
}

/**
 * Validate brand input without generating intelligence
 * @param input - Raw brand input to validate
 * @returns Promise<{isValid: boolean, error?: string}> - Validation result
 */
export async function validateBrandInputAPI(input: string): Promise<{
  isValid: boolean;
  error?: string;
}> {
  try {
    const validation = validateBrandInput(input);
    return {
      isValid: validation.isValid,
      error: validation.error
    };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    };
  }
}

/**
 * Get available LLM providers and their status
 * @returns Promise<{provider: string, available: boolean, error?: string}[]> - Provider status
 */
export async function getLLMProviderStatus(): Promise<{
  provider: string;
  available: boolean;
  error?: string;
}[]> {
  const providers = [
    { name: 'OpenAI', key: 'VITE_OPENAI_API_KEY' },
    { name: 'Anthropic', key: 'VITE_ANTHROPIC_API_KEY' },
    { name: 'Cerebras', key: 'VITE_CEREBRAS_API_KEY' }
  ];

  return providers.map(provider => {
    const hasKey = !!(import.meta as any).env?.[provider.key];
    return {
      provider: provider.name,
      available: hasKey,
      error: hasKey ? undefined : `Missing ${provider.key} environment variable`
    };
  });
}

/**
 * Test LLM service with a simple request
 * @returns Promise<{success: boolean, error?: string}> - Test result
 */
export async function testLLMService(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Test with a simple brand name
    const llmService = createLLMServiceFromProvider('cerebras');
    await llmService.generateBrandIntel('Test Brand');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
