/**
 * Comprehensive Test Suite for Onboarding and Setup Processes
 * 
 * Tests:
 * 1. Brand Intel Lookup - Verify brand data is pulled correctly
 * 2. Competitor Generation - Ensure at least 5 correct competitors
 * 3. Topic Generation - Verify topics are keywords (not prompts)
 * 4. Prompt Generation - Ensure prompts are neutral and make sense
 * 5. End-to-End Integration - Test complete flow
 * 
 * Usage:
 *   1. Build TypeScript: cd backend && npm run build
 *   2. Run test: node backend/scripts/test-onboarding-setup-complete.js
 * 
 * Requirements:
 *   - Environment variables: CEREBRAS_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, SUPABASE credentials
 *   - TypeScript must be compiled to dist/ directory
 */

const { createClient } = require('@supabase/supabase-js');
const { loadEnvironment, getEnvVar } = require('../dist/utils/env-utils');

loadEnvironment();
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

// Test configuration
const TEST_BRANDS = [
  { name: 'Nike', domain: 'nike.com', industry: 'Sportswear' },
  { name: 'Apple', domain: 'apple.com', industry: 'Technology' },
  { name: 'Tesla', domain: 'tesla.com', industry: 'Automotive' },
  { name: 'Starbucks', domain: 'starbucks.com', industry: 'Food & Beverage' }
];

// Test results tracking
const testResults = {
  brandIntel: { passed: 0, failed: 0, tests: [] },
  competitors: { passed: 0, failed: 0, tests: [] },
  topics: { passed: 0, failed: 0, tests: [] },
  prompts: { passed: 0, failed: 0, tests: [] },
  integration: { passed: 0, failed: 0, tests: [] }
};

// Detailed failure tracking
const failureDetails = {
  timestamp: new Date().toISOString(),
  testRunId: `test-${Date.now()}`,
  failures: [],
  summary: {
    totalTests: 0,
    totalPassed: 0,
    totalFailed: 0,
    categories: {}
  }
};

// Helper functions
function assert(condition, message, category, context = {}) {
  const testInfo = {
    status: condition ? 'PASS' : 'FAIL',
    message,
    category,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  if (condition) {
    console.log(`  ✅ ${message}`);
    testResults[category].passed++;
    testResults[category].tests.push(testInfo);
  } else {
    console.log(`  ❌ ${message}`);
    testResults[category].failed++;
    testResults[category].tests.push(testInfo);
    
    // Add to detailed failure tracking
    failureDetails.failures.push({
      testCategory: category,
      testMessage: message,
      failureReason: context.expected ? `Expected: ${context.expected}, Got: ${context.actual}` : message,
      expected: context.expected,
      actual: context.actual,
      context: {
        ...context,
        // Remove expected/actual from context to avoid duplication
        expected: undefined,
        actual: undefined
      },
      timestamp: new Date().toISOString(),
      stackTrace: context.stackTrace || null
    });
  }
}

function isKeywordLike(text) {
  // Keywords are typically 1-4 words, not full sentences
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount <= 4 && !text.includes('?') && !text.includes('how') && !text.includes('what');
}

function isPromptLike(text) {
  // Prompts are full questions or search queries
  return text.includes('?') || text.toLowerCase().includes('how') || text.toLowerCase().includes('what') || text.length > 30;
}

function isNeutral(query, brandName) {
  const queryLower = query.toLowerCase();
  const brandLower = brandName.toLowerCase();
  
  // Check if query mentions brand (except in comparison context)
  if (!queryLower.includes(brandLower)) {
    return true; // No brand mention = neutral
  }
  
  // Allow brand mentions in comparison queries
  const comparisonKeywords = ['vs', 'versus', 'compare', 'comparison', 'better', 'difference'];
  const hasComparison = comparisonKeywords.some(keyword => queryLower.includes(keyword));
  
  return hasComparison; // Only neutral if it's a comparison
}

async function testBrandIntelLookup() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 1: Brand Intel Lookup');
  console.log('='.repeat(80));
  
  for (const testBrand of TEST_BRANDS) {
    console.log(`\n📋 Testing brand: ${testBrand.name}`);
    
    try {
      // Import service directly
      const { onboardingIntelService } = require('../dist/services/onboarding-intel.service');
      
      const result = await onboardingIntelService.lookupBrandIntel({
        input: testBrand.name,
        locale: 'en-US',
        country: 'US'
      });
      
      // Validate brand data
      assert(result.brand, `Brand data exists for ${testBrand.name}`, 'brandIntel', {
        testBrand: testBrand.name,
        input: testBrand.name,
        result: result.brand ? 'exists' : 'missing'
      });
      assert(result.brand?.companyName, `Company name exists: ${result.brand?.companyName}`, 'brandIntel', {
        testBrand: testBrand.name,
        expected: 'Non-empty string',
        actual: result.brand?.companyName || 'missing',
        companyName: result.brand?.companyName
      });
      assert(result.brand?.website, `Website exists: ${result.brand?.website}`, 'brandIntel', {
        testBrand: testBrand.name,
        expected: 'Valid URL',
        actual: result.brand?.website || 'missing',
        website: result.brand?.website
      });
      assert(result.brand?.domain, `Domain exists: ${result.brand?.domain}`, 'brandIntel', {
        testBrand: testBrand.name,
        expected: 'Valid domain',
        actual: result.brand?.domain || 'missing',
        domain: result.brand?.domain
      });
      assert(result.brand?.industry, `Industry exists: ${result.brand?.industry}`, 'brandIntel', {
        testBrand: testBrand.name,
        expected: 'Non-empty industry string',
        actual: result.brand?.industry || 'missing',
        industry: result.brand?.industry
      });
      assert(result.brand?.description, `Description exists (${result.brand?.description?.length || 0} chars)`, 'brandIntel', {
        testBrand: testBrand.name,
        expected: 'Non-empty description',
        actual: result.brand?.description ? `${result.brand.description.length} chars` : 'missing',
        descriptionLength: result.brand?.description?.length || 0
      });
      
      // Validate logo URL
      if (result.brand.logo) {
        assert(
          result.brand.logo.startsWith('http'),
          `Logo URL is valid: ${result.brand.logo}`,
          'brandIntel',
          {
            testBrand: testBrand.name,
            expected: 'URL starting with http',
            actual: result.brand.logo,
            logo: result.brand.logo
          }
        );
      }
      
      // Validate industry accuracy (should match or be related)
      if (result.brand.industry && testBrand.industry) {
        const industryMatch = result.brand.industry.toLowerCase().includes(testBrand.industry.toLowerCase()) ||
                             testBrand.industry.toLowerCase().includes(result.brand.industry.toLowerCase());
        assert(
          industryMatch || result.brand.industry !== 'General',
          `Industry is relevant: ${result.brand.industry} (expected: ${testBrand.industry})`,
          'brandIntel',
          {
            testBrand: testBrand.name,
            expected: testBrand.industry,
            actual: result.brand.industry,
            industryMatch,
            isGeneral: result.brand.industry === 'General'
          }
        );
      }
      
      // Validate domain
      if (result.brand.domain) {
        assert(
          result.brand.domain.includes('.'),
          `Domain format is valid: ${result.brand.domain}`,
          'brandIntel',
          {
            testBrand: testBrand.name,
            expected: 'Domain with dot (.)',
            actual: result.brand.domain,
            hasDot: result.brand.domain.includes('.')
          }
        );
      }
      
      console.log(`  📊 Brand Data: ${result.brand.companyName} | ${result.brand.industry} | ${result.brand.domain}`);
      
    } catch (error) {
      console.error(`  ❌ Error testing ${testBrand.name}:`, error.message);
      testResults.brandIntel.failed++;
      const errorInfo = {
        status: 'FAIL',
        message: `Error: ${error.message}`,
        testBrand: testBrand.name,
        errorType: error.constructor.name,
        stackTrace: error.stack
      };
      testResults.brandIntel.tests.push(errorInfo);
      
      // Add to detailed failure tracking
      failureDetails.failures.push({
        testCategory: 'brandIntel',
        testMessage: `Error testing ${testBrand.name}`,
        failureReason: error.message,
        expected: 'Successful brand intel lookup',
        actual: `Error: ${error.message}`,
        context: {
          testBrand: testBrand.name,
          input: testBrand.name,
          errorType: error.constructor.name
        },
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      });
    }
  }
}

async function testCompetitorGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 2: Competitor Generation');
  console.log('='.repeat(80));
  
  for (const testBrand of TEST_BRANDS) {
    console.log(`\n📋 Testing competitors for: ${testBrand.name}`);
    
    try {
      const { onboardingIntelService } = require('../dist/services/onboarding-intel.service');
      
      // First get brand intel to have brand data
      const brandIntel = await onboardingIntelService.lookupBrandIntel({
        input: testBrand.name,
        locale: 'en-US',
        country: 'US'
      });
      
      // Generate competitors
      const competitors = await onboardingIntelService.generateCompetitorsForRequest({
        companyName: brandIntel.brand.companyName,
        industry: brandIntel.brand.industry || testBrand.industry,
        domain: brandIntel.brand.domain,
        locale: 'en-US',
        country: 'US'
      });
      
      // Validate competitor count
      assert(
        competitors.length >= 5,
        `At least 5 competitors returned: ${competitors.length}`,
        'competitors',
        {
          testBrand: testBrand.name,
          expected: 'At least 5 competitors',
          actual: `${competitors.length} competitors`,
          competitorCount: competitors.length,
          competitors: competitors.map(c => c.name)
        }
      );
      
      // Validate competitor details
      competitors.forEach((competitor, index) => {
        assert(
          competitor.name && competitor.name.length > 0,
          `Competitor ${index + 1} has name: ${competitor.name}`,
          'competitors',
          {
            testBrand: testBrand.name,
            competitorIndex: index + 1,
            expected: 'Non-empty competitor name',
            actual: competitor.name || 'missing',
            competitor: competitor
          }
        );
        
        assert(
          competitor.name.toLowerCase() !== testBrand.name.toLowerCase(),
          `Competitor ${index + 1} is not the brand itself: ${competitor.name}`,
          'competitors',
          {
            testBrand: testBrand.name,
            competitorIndex: index + 1,
            expected: `Competitor name different from ${testBrand.name}`,
            actual: competitor.name,
            isSameAsBrand: competitor.name.toLowerCase() === testBrand.name.toLowerCase()
          }
        );
        
        if (competitor.domain) {
          assert(
            competitor.domain.includes('.'),
            `Competitor ${index + 1} has valid domain: ${competitor.domain}`,
            'competitors',
            {
              testBrand: testBrand.name,
              competitorIndex: index + 1,
              competitorName: competitor.name,
              expected: 'Domain with dot (.)',
              actual: competitor.domain,
              hasDot: competitor.domain.includes('.')
            }
          );
        }
        
        if (competitor.industry) {
          assert(
            competitor.industry.length > 0,
            `Competitor ${index + 1} has industry: ${competitor.industry}`,
            'competitors',
            {
              testBrand: testBrand.name,
              competitorIndex: index + 1,
              competitorName: competitor.name,
              expected: 'Non-empty industry',
              actual: competitor.industry
            }
          );
        }
        
        if (competitor.relevance) {
          const validRelevances = ['Direct Competitor', 'Indirect Competitor', 'Aspirational Alternative'];
          assert(
            validRelevances.includes(competitor.relevance),
            `Competitor ${index + 1} has valid relevance: ${competitor.relevance}`,
            'competitors',
            {
              testBrand: testBrand.name,
              competitorIndex: index + 1,
              competitorName: competitor.name,
              expected: `One of: ${validRelevances.join(', ')}`,
              actual: competitor.relevance,
              isValid: validRelevances.includes(competitor.relevance)
            }
          );
        }
      });
      
      // Check for duplicates
      const competitorNames = competitors.map(c => c.name.toLowerCase());
      const uniqueNames = new Set(competitorNames);
      const duplicates = competitorNames.filter((name, index) => competitorNames.indexOf(name) !== index);
      assert(
        uniqueNames.size === competitors.length,
        `No duplicate competitors found (${uniqueNames.size} unique)`,
        'competitors',
        {
          testBrand: testBrand.name,
          expected: `${competitors.length} unique competitors`,
          actual: `${uniqueNames.size} unique out of ${competitors.length} total`,
          duplicates: duplicates.length > 0 ? duplicates : null,
          allCompetitorNames: competitorNames
        }
      );
      
      // Check industry relevance
      const industryRelevant = competitors.filter(c => 
        c.industry && (
          c.industry.toLowerCase().includes(testBrand.industry.toLowerCase()) ||
          testBrand.industry.toLowerCase().includes(c.industry.toLowerCase())
        )
      );
      
      assert(
        industryRelevant.length >= 3,
        `At least 3 competitors in same/related industry: ${industryRelevant.length}`,
        'competitors',
        {
          testBrand: testBrand.name,
          expectedIndustry: testBrand.industry,
          expected: 'At least 3 industry-relevant competitors',
          actual: `${industryRelevant.length} industry-relevant competitors`,
          industryRelevantCount: industryRelevant.length,
          industryRelevantCompetitors: industryRelevant.map(c => ({ name: c.name, industry: c.industry })),
          allCompetitorIndustries: competitors.map(c => c.industry)
        }
      );
      
      console.log(`  📊 Competitors: ${competitors.length} total`);
      competitors.slice(0, 5).forEach((c, i) => {
        console.log(`    ${i + 1}. ${c.name} (${c.industry || 'N/A'}) - ${c.relevance || 'N/A'}`);
      });
      
    } catch (error) {
      console.error(`  ❌ Error testing competitors for ${testBrand.name}:`, error.message);
      testResults.competitors.failed++;
      const errorInfo = {
        status: 'FAIL',
        message: `Error: ${error.message}`,
        testBrand: testBrand.name,
        errorType: error.constructor.name,
        stackTrace: error.stack
      };
      testResults.competitors.tests.push(errorInfo);
      
      // Add to detailed failure tracking
      failureDetails.failures.push({
        testCategory: 'competitors',
        testMessage: `Error testing competitors for ${testBrand.name}`,
        failureReason: error.message,
        expected: 'Successful competitor generation',
        actual: `Error: ${error.message}`,
        context: {
          testBrand: testBrand.name,
          errorType: error.constructor.name
        },
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      });
    }
  }
}

async function testTopicGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 3: Topic Generation');
  console.log('='.repeat(80));
  
  for (const testBrand of TEST_BRANDS.slice(0, 2)) { // Test first 2 brands
    console.log(`\n📋 Testing topics for: ${testBrand.name}`);
    
    try {
      // Get brand intel first
      const { onboardingIntelService } = require('../dist/services/onboarding-intel.service');
      const brandIntel = await onboardingIntelService.lookupBrandIntel({
        input: testBrand.name,
        locale: 'en-US',
        country: 'US'
      });
      
      // Call services directly (more reliable than API calls)
      const { trendingKeywordsService } = require('../dist/services/keywords/trending-keywords.service');
      const { aeoCategorizationService } = require('../dist/services/aeo-categorization.service');
      
      // Get trending keywords
      const trendingResult = await trendingKeywordsService.getTrendingKeywords({
        brand: brandIntel.brand.companyName,
        industry: brandIntel.brand.industry || testBrand.industry,
        competitors: brandIntel.competitors.slice(0, 5).map(c => c.name),
        locale: 'en-US',
        country: 'US',
        max_keywords: 12
      });
      
      // Build topics structure similar to API response
      const trendingTopics = trendingResult.success && trendingResult.data
        ? trendingResult.data.keywords.map((kw, index) => ({
            id: `trend-${index}`,
            name: kw.keyword,
            source: 'trending',
            relevance: Math.round(kw.trend_score * 100)
          }))
        : [];
      
      // Store prompts separately (these are for query generation, not topic generation)
      const trendingPrompts = trendingResult.success && trendingResult.data && trendingResult.data.prompts
        ? trendingResult.data.prompts.map((prompt, index) => ({
            id: `prompt-${index}`,
            name: prompt.prompt,
            source: 'trending',
            category: prompt.category?.toLowerCase() || 'awareness',
            relevance: 85
          }))
        : [];
      
      // 3. Include existing topics from database (if any) - empty for testing
      const existingTopics = [];
      const existingTopicsFormatted = existingTopics.map((topic, index) => {
        const topicName = topic.topic_name || topic.topic || topic;
        return {
          id: `existing-${index}`,
          name: topicName,
          source: 'existing',
          category: topic.category || 'awareness',
          relevance: 90 // Existing topics have high relevance
        };
      });

      // 4. Normalize all topics to ensure they are keyword-like (not prompt-like)
      // Combine keywords from trending and existing topics (matching real route)
      const allTopicNames = [
        ...trendingTopics.map((t) => t.name),
        ...existingTopicsFormatted.map((t) => t.name)
      ];
      
      // Normalize topics using the trending keywords service
      if (!trendingKeywordsService.normalizeTopicsToKeywords) {
        throw new Error('normalizeTopicsToKeywords method not found. Please rebuild TypeScript: cd backend && npm run build');
      }
      const normalizedTopicNames = await trendingKeywordsService.normalizeTopicsToKeywords(
        allTopicNames,
        brandIntel.brand.companyName,
        brandIntel.brand.industry || testBrand.industry
      );
      
      // Create a map of original topic names to normalized names
      // Since normalizeTopicsToKeywords processes topics in order, we can match them by index
      // But we need to handle cases where some topics are skipped
      const topicNameMap = new Map();
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
        .map((t) => {
          const normalized = topicNameMap.get(t.name.toLowerCase()) || t.name;
          return { ...t, name: normalized };
        });
      
      const normalizedExistingTopics = existingTopicsFormatted
        .map((t) => {
          const normalized = topicNameMap.get(t.name.toLowerCase()) || t.name;
          return { ...t, name: normalized };
        }); // Only keep successfully normalized topics
      
      // Categorize topics using normalized keywords (not prompts)
      const categorizedResult = await aeoCategorizationService.categorizeTopics({
        topics: normalizedTopicNames,
        brand_name: brandIntel.brand.companyName,
        industry: brandIntel.brand.industry || testBrand.industry,
        competitors: brandIntel.competitors.slice(0, 5).map(c => c.name)
      });
      
      // Organize by category
      const aiGenerated = {
        awareness: [],
        comparison: [],
        purchase: [],
        support: []
      };
      
      if (categorizedResult.categorized_topics) {
        categorizedResult.categorized_topics.forEach((ct, index) => {
          const category = ct.category.toLowerCase().replace('post-purchase support', 'support');
          
          // Find matching topic from normalized topics
          const matchingTopic = normalizedTrendingTopics.find((t) => t.name === ct.topic_name) ||
                               normalizedExistingTopics.find((t) => t.name === ct.topic_name);
          
          if (matchingTopic && aiGenerated[category]) {
            aiGenerated[category].push({
              id: matchingTopic.id || `ai-${index}`,
              name: ct.topic_name, // Use the normalized topic name
              source: matchingTopic.source || 'ai_generated',
              category: category,
              relevance: Math.round((ct.confidence || 0.8) * 100)
            });
          } else if (aiGenerated[category]) {
            // If no matching topic found, create a new one
            aiGenerated[category].push({
              id: `ai-${index}`,
              name: ct.topic_name,
              source: 'ai_generated',
              category: category,
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

      // 8. Add minimal preset topics (keep a small set for fallback) - matching real route
      const preset = [
        { id: 'preset-1', name: 'Product features', source: 'preset', relevance: 85 },
        { id: 'preset-2', name: 'Customer testimonials', source: 'preset', relevance: 82 },
        { id: 'preset-3', name: 'Integration capabilities', source: 'preset', relevance: 80 },
        { id: 'preset-4', name: 'Security and compliance', source: 'preset', relevance: 78 }
      ];
      
      const result = {
        success: true,
        data: {
          trending: normalizedTrendingTopics.slice(0, 6),
          aiGenerated,
          preset,
          existing_count: existingTopics.length
        }
      };
      
      // Collect all topics
      const allTopics = [
        ...(result.data.trending || []).map(t => t.name),
        ...(result.data.aiGenerated?.awareness || []).map(t => t.name),
        ...(result.data.aiGenerated?.comparison || []).map(t => t.name),
        ...(result.data.aiGenerated?.purchase || []).map(t => t.name),
        ...(result.data.aiGenerated?.support || []).map(t => t.name),
        ...(result.data.preset || []).map(t => t.name)
      ];
      
      // Validate topic count
      assert(
        allTopics.length >= 10,
        `At least 10 topics generated: ${allTopics.length}`,
        'topics',
        {
          testBrand: testBrand.name,
          expected: 'At least 10 topics',
          actual: `${allTopics.length} topics`,
          topicCount: allTopics.length,
          allTopics: allTopics
        }
      );
      
      // Validate topics are keywords (not prompts)
      const keywordLikeTopics = allTopics.filter(t => isKeywordLike(t));
      const promptLikeTopics = allTopics.filter(t => isPromptLike(t));
      
      assert(
        keywordLikeTopics.length >= 8,
        `At least 8 topics are keyword-like (not prompts): ${keywordLikeTopics.length}`,
        'topics',
        {
          testBrand: testBrand.name,
          expected: 'At least 8 keyword-like topics',
          actual: `${keywordLikeTopics.length} keyword-like topics`,
          keywordLikeCount: keywordLikeTopics.length,
          keywordLikeTopics: keywordLikeTopics,
          promptLikeTopics: promptLikeTopics
        }
      );
      
      assert(
        promptLikeTopics.length <= 2,
        `Few topics are prompt-like (max 2): ${promptLikeTopics.length}`,
        'topics',
        {
          testBrand: testBrand.name,
          expected: 'Maximum 2 prompt-like topics',
          actual: `${promptLikeTopics.length} prompt-like topics`,
          promptLikeCount: promptLikeTopics.length,
          promptLikeTopics: promptLikeTopics
        }
      );
      
      // Validate topic uniqueness
      const uniqueTopics = new Set(allTopics.map(t => t.toLowerCase()));
      const duplicates = allTopics.filter((topic, index) => 
        allTopics.findIndex(t => t.toLowerCase() === topic.toLowerCase()) !== index
      );
      assert(
        uniqueTopics.size === allTopics.length,
        `All topics are unique: ${uniqueTopics.size} unique out of ${allTopics.length}`,
        'topics',
        {
          testBrand: testBrand.name,
          expected: `${allTopics.length} unique topics`,
          actual: `${uniqueTopics.size} unique out of ${allTopics.length} total`,
          duplicateCount: duplicates.length,
          duplicates: duplicates.length > 0 ? duplicates : null
        }
      );
      
      // Validate topics are categorized
      const categorizedCount = [
        ...(result.data.aiGenerated?.awareness || []),
        ...(result.data.aiGenerated?.comparison || []),
        ...(result.data.aiGenerated?.purchase || []),
        ...(result.data.aiGenerated?.support || [])
      ].length;
      
      assert(
        categorizedCount >= 5,
        `At least 5 topics are categorized: ${categorizedCount}`,
        'topics',
        {
          testBrand: testBrand.name,
          expected: 'At least 5 categorized topics',
          actual: `${categorizedCount} categorized topics`,
          categorizedCount: categorizedCount,
          categoryBreakdown: {
            awareness: result.data.aiGenerated?.awareness?.length || 0,
            comparison: result.data.aiGenerated?.comparison?.length || 0,
            purchase: result.data.aiGenerated?.purchase?.length || 0,
            support: result.data.aiGenerated?.support?.length || 0
          }
        }
      );
      
      console.log(`  📊 Topics: ${allTopics.length} total`);
      console.log(`    - Keyword-like: ${keywordLikeTopics.length}`);
      console.log(`    - Prompt-like: ${promptLikeTopics.length}`);
      console.log(`    - Categorized: ${categorizedCount}`);
      console.log(`  📋 Sample topics (first 10):`);
      allTopics.slice(0, 10).forEach((topic, i) => {
        const type = isKeywordLike(topic) ? '✅' : '⚠️';
        console.log(`    ${i + 1}. ${type} ${topic}`);
      });
      
    } catch (error) {
      console.error(`  ❌ Error testing topics for ${testBrand.name}:`, error.message);
      testResults.topics.failed++;
      const errorInfo = {
        status: 'FAIL',
        message: `Error: ${error.message}`,
        testBrand: testBrand.name,
        errorType: error.constructor.name,
        stackTrace: error.stack
      };
      testResults.topics.tests.push(errorInfo);
      
      // Add to detailed failure tracking
      failureDetails.failures.push({
        testCategory: 'topics',
        testMessage: `Error testing topics for ${testBrand.name}`,
        failureReason: error.message,
        expected: 'Successful topic generation',
        actual: `Error: ${error.message}`,
        context: {
          testBrand: testBrand.name,
          errorType: error.constructor.name
        },
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      });
    }
  }
}

async function testPromptGeneration() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 4: Prompt Generation');
  console.log('='.repeat(80));
  
  for (const testBrand of TEST_BRANDS.slice(0, 2)) { // Test first 2 brands
    console.log(`\n📋 Testing prompts for: ${testBrand.name}`);
    
    try {
      // Get brand intel and topics first
      const { onboardingIntelService } = require('../dist/services/onboarding-intel.service');
      const brandIntel = await onboardingIntelService.lookupBrandIntel({
        input: testBrand.name,
        locale: 'en-US',
        country: 'US'
      });
      
      // Get topics using services directly
      const { trendingKeywordsService } = require('../dist/services/keywords/trending-keywords.service');
      const { aeoCategorizationService } = require('../dist/services/aeo-categorization.service');
      
      const trendingResult = await trendingKeywordsService.getTrendingKeywords({
        brand: brandIntel.brand.companyName,
        industry: brandIntel.brand.industry || testBrand.industry,
        competitors: brandIntel.competitors.slice(0, 5).map(c => c.name),
        locale: 'en-US',
        country: 'US',
        max_keywords: 12
      });
      
      // Use keywords (not prompts) for topics
      const trendingKeywords = trendingResult.success && trendingResult.data && trendingResult.data.keywords
        ? trendingResult.data.keywords.map(kw => kw.keyword)
        : [];
      
      // Normalize topics to ensure they are keyword-like
      if (!trendingKeywordsService.normalizeTopicsToKeywords) {
        throw new Error('normalizeTopicsToKeywords method not found. Please rebuild TypeScript: cd backend && npm run build');
      }
      const normalizedTopicNames = await trendingKeywordsService.normalizeTopicsToKeywords(
        trendingKeywords,
        brandIntel.brand.companyName,
        brandIntel.brand.industry || testBrand.industry
      );
      
      const categorizedResult = await aeoCategorizationService.categorizeTopics({
        topics: normalizedTopicNames,
        brand_name: brandIntel.brand.companyName,
        industry: brandIntel.brand.industry || testBrand.industry,
        competitors: brandIntel.competitors.slice(0, 5).map(c => c.name)
      });
      
      const allTopics = categorizedResult.categorized_topics
        ? categorizedResult.categorized_topics.map(ct => ct.topic_name)
        : normalizedTopicNames;
      
      const topicsToUse = allTopics.slice(0, 5); // Use first 5 topics
      
      // Generate prompts using query generation service directly
      const { queryGenerationService } = require('../dist/services/query-generation.service');
      
      const queryGenResult = await queryGenerationService.generateSeedQueries({
        url: brandIntel.brand.website || `https://${brandIntel.brand.domain}`,
        locale: 'en-US',
        country: 'US',
        industry: brandIntel.brand.industry || testBrand.industry,
        competitors: brandIntel.competitors.slice(0, 5).map(c => c.name).join(', '),
        llm_provider: 'cerebras',
        topics: topicsToUse
      });
      
      // Format result similar to API response
      // Group queries by topic - extract topic from evidence_snippet
      // evidence_snippet format: "Generated query for {brandName} {topic}"
      const promptsResult = {
        success: true,
        data: topicsToUse.map((topic) => {
          // Find queries that match this topic
          // Method 1: Extract topic from evidence_snippet
          const queriesBySnippet = queryGenResult.queries.filter(q => {
            if (!q.evidence_snippet) return false;
            // Extract topic from "Generated query for {brandName} {topic}"
            const snippet = q.evidence_snippet.toLowerCase();
            const topicLower = topic.toLowerCase();
            // Check if snippet ends with topic or contains topic
            return snippet.includes(topicLower) || snippet.endsWith(topicLower);
          });
          
          // Method 2: Find queries that mention topic keywords in the query itself
          const topicLower = topic.toLowerCase();
          const topicWords = topicLower.split(/\s+/).filter(w => w.length > 2);
          
          const queriesByKeywords = queryGenResult.queries.filter(q => {
            const queryLower = q.query.toLowerCase();
            return topicWords.some(word => queryLower.includes(word));
          });
          
          // Combine and deduplicate
          const allMatches = [...queriesBySnippet, ...queriesByKeywords];
          const uniqueMatches = Array.from(new Map(allMatches.map(q => [q.query, q])).values());
          
          // If no matches found, use all queries (fallback)
          const prompts = uniqueMatches.length > 0 
            ? uniqueMatches.map(q => q.query).slice(0, 5)
            : queryGenResult.queries.slice(0, 3).map(q => q.query);
          
          return {
            topic,
            prompts
          };
        })
      };
      
      // Collect all prompts
      const allPrompts = promptsResult.data.flatMap(item => item.prompts || []);
      
      // Validate prompt count
      assert(
        allPrompts.length >= allTopics.length,
        `At least one prompt per topic: ${allPrompts.length} prompts for ${allTopics.length} topics`,
        'prompts',
        {
          testBrand: testBrand.name,
          expected: `At least ${allTopics.length} prompts (one per topic)`,
          actual: `${allPrompts.length} prompts for ${allTopics.length} topics`,
          promptCount: allPrompts.length,
          topicCount: allTopics.length,
          promptsPerTopic: promptsResult.data.map(item => ({ topic: item.topic, promptCount: item.prompts?.length || 0 }))
        }
      );
      
      // Validate prompts are neutral
      const neutralPrompts = allPrompts.filter(p => isNeutral(p, brandIntel.brand.companyName));
      const nonNeutralPrompts = allPrompts.filter(p => !isNeutral(p, brandIntel.brand.companyName));
      const neutralityRate = allPrompts.length > 0 ? (neutralPrompts.length / allPrompts.length) * 100 : 0;
      
      assert(
        neutralPrompts.length >= allPrompts.length * 0.8,
        `At least 80% prompts are neutral: ${neutralPrompts.length}/${allPrompts.length} (${Math.round(neutralityRate)}%)`,
        'prompts',
        {
          testBrand: testBrand.name,
          brandName: brandIntel.brand.companyName,
          expected: 'At least 80% neutral prompts',
          actual: `${Math.round(neutralityRate)}% neutral (${neutralPrompts.length}/${allPrompts.length})`,
          neutralCount: neutralPrompts.length,
          nonNeutralCount: nonNeutralPrompts.length,
          nonNeutralPrompts: nonNeutralPrompts.slice(0, 5) // First 5 non-neutral for debugging
        }
      );
      
      // Validate prompts are actual search queries (not just keywords)
      const queryLikePrompts = allPrompts.filter(p => isPromptLike(p));
      const queryLikeRate = allPrompts.length > 0 ? (queryLikePrompts.length / allPrompts.length) * 100 : 0;
      assert(
        queryLikePrompts.length >= allPrompts.length * 0.7,
        `At least 70% prompts are query-like: ${queryLikePrompts.length}/${allPrompts.length}`,
        'prompts',
        {
          testBrand: testBrand.name,
          expected: 'At least 70% query-like prompts',
          actual: `${Math.round(queryLikeRate)}% query-like (${queryLikePrompts.length}/${allPrompts.length})`,
          queryLikeCount: queryLikePrompts.length,
          nonQueryLikeCount: allPrompts.length - queryLikePrompts.length
        }
      );
      
      // Validate prompts make sense for their topics
      let topicRelevanceCount = 0;
      const topicRelevanceDetails = [];
      promptsResult.data.forEach(item => {
        if (item.prompts && item.prompts.length > 0) {
          // Check if prompts relate to topic (simple keyword matching)
          const topicLower = item.topic.toLowerCase();
          const relevantPrompts = item.prompts.filter(p => 
            p.toLowerCase().includes(topicLower.split(' ')[0]) || 
            topicLower.split(' ').some(word => p.toLowerCase().includes(word))
          );
          const isRelevant = relevantPrompts.length > 0;
          if (isRelevant) {
            topicRelevanceCount++;
          }
          topicRelevanceDetails.push({
            topic: item.topic,
            promptCount: item.prompts.length,
            relevantPromptCount: relevantPrompts.length,
            isRelevant,
            prompts: item.prompts
          });
        }
      });
      const relevanceRate = promptsResult.data.length > 0 ? (topicRelevanceCount / promptsResult.data.length) * 100 : 0;
      
      assert(
        topicRelevanceCount >= promptsResult.data.length * 0.7,
        `At least 70% topics have relevant prompts: ${topicRelevanceCount}/${promptsResult.data.length}`,
        'prompts',
        {
          testBrand: testBrand.name,
          expected: 'At least 70% topics with relevant prompts',
          actual: `${Math.round(relevanceRate)}% topics with relevant prompts (${topicRelevanceCount}/${promptsResult.data.length})`,
          topicRelevanceCount: topicRelevanceCount,
          totalTopics: promptsResult.data.length,
          topicRelevanceDetails: topicRelevanceDetails
        }
      );
      
      // Validate no duplicates
      const uniquePrompts = new Set(allPrompts.map(p => p.toLowerCase().trim()));
      const duplicatePrompts = allPrompts.filter((prompt, index) => 
        allPrompts.findIndex(p => p.toLowerCase().trim() === prompt.toLowerCase().trim()) !== index
      );
      assert(
        uniquePrompts.size === allPrompts.length,
        `All prompts are unique: ${uniquePrompts.size} unique out of ${allPrompts.length}`,
        'prompts',
        {
          testBrand: testBrand.name,
          expected: `${allPrompts.length} unique prompts`,
          actual: `${uniquePrompts.size} unique out of ${allPrompts.length} total`,
          duplicateCount: duplicatePrompts.length,
          duplicates: duplicatePrompts.length > 0 ? duplicatePrompts.slice(0, 5) : null
        }
      );
      
      console.log(`  📊 Prompts: ${allPrompts.length} total`);
      console.log(`    - Neutral: ${neutralPrompts.length} (${Math.round(neutralPrompts.length/allPrompts.length*100)}%)`);
      console.log(`    - Query-like: ${queryLikePrompts.length} (${Math.round(queryLikePrompts.length/allPrompts.length*100)}%)`);
      console.log(`    - Topic-relevant: ${topicRelevanceCount}/${promptsResult.data.length} topics`);
      console.log(`  📋 Sample prompts:`);
      allPrompts.slice(0, 5).forEach((prompt, i) => {
        const neutral = isNeutral(prompt, brandIntel.brand.companyName) ? '✅' : '❌';
        console.log(`    ${i + 1}. ${neutral} ${prompt}`);
      });
      
      if (nonNeutralPrompts.length > 0) {
        console.log(`  ⚠️ Non-neutral prompts found:`);
        nonNeutralPrompts.slice(0, 3).forEach(p => console.log(`    - ${p}`));
      }
      
    } catch (error) {
      console.error(`  ❌ Error testing prompts for ${testBrand.name}:`, error.message);
      testResults.prompts.failed++;
      const errorInfo = {
        status: 'FAIL',
        message: `Error: ${error.message}`,
        testBrand: testBrand.name,
        errorType: error.constructor.name,
        stackTrace: error.stack
      };
      testResults.prompts.tests.push(errorInfo);
      
      // Add to detailed failure tracking
      failureDetails.failures.push({
        testCategory: 'prompts',
        testMessage: `Error testing prompts for ${testBrand.name}`,
        failureReason: error.message,
        expected: 'Successful prompt generation',
        actual: `Error: ${error.message}`,
        context: {
          testBrand: testBrand.name,
          errorType: error.constructor.name
        },
        timestamp: new Date().toISOString(),
        stackTrace: error.stack
      });
    }
  }
}

async function testEndToEndIntegration() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TEST 5: End-to-End Integration');
  console.log('='.repeat(80));
  
  const testBrand = TEST_BRANDS[0]; // Use Nike for full integration test
  console.log(`\n📋 Testing complete flow for: ${testBrand.name}`);
  
  try {
    // Step 1: Brand Intel
    console.log('\n  Step 1: Brand Intel Lookup...');
    const { onboardingIntelService } = require('../dist/services/onboarding-intel.service');
    const brandIntel = await onboardingIntelService.lookupBrandIntel({
      input: testBrand.name,
      locale: 'en-US',
      country: 'US'
    });
    
    assert(brandIntel.brand, 'Brand intel retrieved', 'integration', {
      testBrand: testBrand.name,
      expected: 'Brand intel object',
      actual: brandIntel.brand ? 'exists' : 'missing',
      brandData: brandIntel.brand
    });
    assert(brandIntel.competitors.length >= 5, `Competitors retrieved: ${brandIntel.competitors.length}`, 'integration', {
      testBrand: testBrand.name,
      expected: 'At least 5 competitors',
      actual: `${brandIntel.competitors.length} competitors`,
      competitorCount: brandIntel.competitors.length
    });
    
    // Step 2: Topics
    console.log('  Step 2: Topic Generation...');
    const { trendingKeywordsService } = require('../dist/services/keywords/trending-keywords.service');
    const { aeoCategorizationService } = require('../dist/services/aeo-categorization.service');
    
    const trendingResult = await trendingKeywordsService.getTrendingKeywords({
      brand: brandIntel.brand.companyName,
      industry: brandIntel.brand.industry || testBrand.industry,
      competitors: brandIntel.competitors.slice(0, 5).map(c => c.name),
      locale: 'en-US',
      country: 'US',
      max_keywords: 12
    });
    
    // Use keywords (not prompts) for topics
    const trendingKeywords = trendingResult.success && trendingResult.data && trendingResult.data.keywords
      ? trendingResult.data.keywords.map(kw => kw.keyword)
      : [];
    
    // Normalize topics to ensure they are keyword-like
    if (!trendingKeywordsService.normalizeTopicsToKeywords) {
      throw new Error('normalizeTopicsToKeywords method not found. Please rebuild TypeScript: cd backend && npm run build');
    }
    const normalizedTopicNames = await trendingKeywordsService.normalizeTopicsToKeywords(
      trendingKeywords,
      brandIntel.brand.companyName,
      brandIntel.brand.industry || testBrand.industry
    );
    
    const categorizedResult = await aeoCategorizationService.categorizeTopics({
      topics: normalizedTopicNames,
      brand_name: brandIntel.brand.companyName,
      industry: brandIntel.brand.industry || testBrand.industry,
      competitors: brandIntel.competitors.slice(0, 5).map(c => c.name)
    });
    
    const allTopics = categorizedResult.categorized_topics
      ? categorizedResult.categorized_topics.map(ct => ct.topic_name)
      : normalizedTopicNames;
    
    const topicsToUse = allTopics.slice(0, 5);
    
    assert(topicsToUse.length >= 5, `Topics generated: ${topicsToUse.length}`, 'integration', {
      testBrand: testBrand.name,
      expected: 'At least 5 topics',
      actual: `${topicsToUse.length} topics`,
      topics: topicsToUse
    });
    
    // Step 3: Prompts
    console.log('  Step 3: Prompt Generation...');
    const { queryGenerationService } = require('../dist/services/query-generation.service');
    
    const queryGenResult = await queryGenerationService.generateSeedQueries({
      url: brandIntel.brand.website || `https://${brandIntel.brand.domain}`,
      locale: 'en-US',
      country: 'US',
      industry: brandIntel.brand.industry || testBrand.industry,
      competitors: brandIntel.competitors.slice(0, 5).map(c => c.name).join(', '),
      llm_provider: 'cerebras',
      topics: topicsToUse
    });
    
    const allPrompts = queryGenResult.queries.map(q => q.query);
    
    assert(allPrompts.length >= topicsToUse.length, `Prompts generated: ${allPrompts.length}`, 'integration', {
      testBrand: testBrand.name,
      expected: `At least ${topicsToUse.length} prompts`,
      actual: `${allPrompts.length} prompts`,
      promptCount: allPrompts.length,
      topicCount: topicsToUse.length
    });
    
    // Step 4: Verify data flow
    console.log('  Step 4: Data Flow Verification...');
    assert(
      brandIntel.brand.companyName && brandIntel.brand.industry,
      'Brand data flows correctly',
      'integration',
      {
        testBrand: testBrand.name,
        expected: 'Brand name and industry present',
        actual: {
          hasCompanyName: !!brandIntel.brand.companyName,
          hasIndustry: !!brandIntel.brand.industry,
          companyName: brandIntel.brand.companyName,
          industry: brandIntel.brand.industry
        }
      }
    );
    
    assert(
      brandIntel.competitors.every(c => c.name),
      'Competitor data flows correctly',
      'integration',
      {
        testBrand: testBrand.name,
        expected: 'All competitors have names',
        actual: {
          totalCompetitors: brandIntel.competitors.length,
          competitorsWithNames: brandIntel.competitors.filter(c => c.name).length,
          competitors: brandIntel.competitors.map(c => ({ name: c.name, hasName: !!c.name }))
        }
      }
    );
    
    assert(
      allTopics.every(t => typeof t === 'string' && t.length > 0),
      'Topic data flows correctly',
      'integration',
      {
        testBrand: testBrand.name,
        expected: 'All topics are non-empty strings',
        actual: {
          totalTopics: allTopics.length,
          validTopics: allTopics.filter(t => typeof t === 'string' && t.length > 0).length,
          topics: allTopics
        }
      }
    );
    
    assert(
      allPrompts.every(p => typeof p === 'string' && p.length > 10),
      'Prompt data flows correctly',
      'integration',
      {
        testBrand: testBrand.name,
        expected: 'All prompts are strings with length > 10',
        actual: {
          totalPrompts: allPrompts.length,
          validPrompts: allPrompts.filter(p => typeof p === 'string' && p.length > 10).length,
          invalidPrompts: allPrompts.filter(p => !(typeof p === 'string' && p.length > 10))
        }
      }
    );
    
    console.log('\n  ✅ End-to-end flow completed successfully!');
    console.log(`     Brand: ${brandIntel.brand.companyName}`);
    console.log(`     Competitors: ${brandIntel.competitors.length}`);
    console.log(`     Topics: ${allTopics.length}`);
    console.log(`     Prompts: ${allPrompts.length}`);
    
  } catch (error) {
    console.error(`  ❌ Error in end-to-end test:`, error.message);
    testResults.integration.failed++;
    const errorInfo = {
      status: 'FAIL',
      message: `Error: ${error.message}`,
      testBrand: testBrand.name,
      errorType: error.constructor.name,
      stackTrace: error.stack
    };
    testResults.integration.tests.push(errorInfo);
    
    // Add to detailed failure tracking
    failureDetails.failures.push({
      testCategory: 'integration',
      testMessage: `Error in end-to-end test for ${testBrand.name}`,
      failureReason: error.message,
      expected: 'Successful end-to-end flow',
      actual: `Error: ${error.message}`,
      context: {
        testBrand: testBrand.name,
        errorType: error.constructor.name
      },
      timestamp: new Date().toISOString(),
      stackTrace: error.stack
    });
  }
}

async function saveFailureReport() {
  const fs = require('fs');
  const path = require('path');
  
  // Update summary in failure details
  const categories = ['brandIntel', 'competitors', 'topics', 'prompts', 'integration'];
  let totalPassed = 0;
  let totalFailed = 0;
  
  categories.forEach(category => {
    const results = testResults[category];
    const total = results.passed + results.failed;
    totalPassed += results.passed;
    totalFailed += results.failed;
    
    failureDetails.summary.categories[category] = {
      passed: results.passed,
      failed: results.failed,
      total: total,
      passRate: total > 0 ? Math.round((results.passed / total) * 100) : 0
    };
  });
  
  failureDetails.summary.totalTests = totalPassed + totalFailed;
  failureDetails.summary.totalPassed = totalPassed;
  failureDetails.summary.totalFailed = totalFailed;
  failureDetails.summary.overallPassRate = failureDetails.summary.totalTests > 0 
    ? Math.round((totalPassed / failureDetails.summary.totalTests) * 100) 
    : 0;
  
  // Save to JSON file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test-failures-${timestamp}.json`;
  const filepath = path.join(__dirname, filename);
  
  try {
    fs.writeFileSync(filepath, JSON.stringify(failureDetails, null, 2));
    console.log(`\n💾 Failure report saved to: ${filepath}`);
    return filepath;
  } catch (error) {
    console.error(`\n❌ Failed to save failure report: ${error.message}`);
    return null;
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const categories = ['brandIntel', 'competitors', 'topics', 'prompts', 'integration'];
  let totalPassed = 0;
  let totalFailed = 0;
  
  categories.forEach(category => {
    const results = testResults[category];
    const total = results.passed + results.failed;
    const passRate = total > 0 ? Math.round((results.passed / total) * 100) : 0;
    const status = results.failed === 0 ? '✅' : '❌';
    
    console.log(`\n${status} ${category.toUpperCase()}:`);
    console.log(`   Passed: ${results.passed} | Failed: ${results.failed} | Pass Rate: ${passRate}%`);
    
    totalPassed += results.passed;
    totalFailed += results.failed;
  });
  
  const overallTotal = totalPassed + totalFailed;
  const overallPassRate = overallTotal > 0 ? Math.round((totalPassed / overallTotal) * 100) : 0;
  
  console.log('\n' + '='.repeat(80));
  console.log(`📈 OVERALL: ${totalPassed} passed, ${totalFailed} failed (${overallPassRate}% pass rate)`);
  console.log('='.repeat(80));
  
  // Save failure report
  if (totalFailed > 0) {
    const reportPath = await saveFailureReport();
    if (reportPath) {
      console.log(`\n📋 Detailed failure information saved to JSON file`);
      console.log(`   Review the file for complete failure details, context, and debugging information`);
    }
  }
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log(`\n⚠️ ${totalFailed} test(s) failed. Review the output above and the JSON report for details.`);
    process.exit(1);
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Onboarding and Setup Tests');
  console.log('='.repeat(80));
  console.log('✅ All tests use direct service calls - no server required!');
  console.log('   Tests will work as long as environment variables are configured.');
  console.log('   Required: CEREBRAS_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, SUPABASE credentials');
  console.log('\n⚠️  IMPORTANT: Make sure to build the TypeScript code first:');
  console.log('   cd backend && npm run build');
  console.log('='.repeat(80));
  
  try {
    await testBrandIntelLookup();
    await testCompetitorGeneration();
    await testTopicGeneration();
    await testPromptGeneration();
    await testEndToEndIntegration();
    
    await printSummary();
  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run tests
runAllTests();

