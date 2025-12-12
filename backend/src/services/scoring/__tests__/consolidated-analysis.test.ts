/**
 * Consolidated Analysis Service Tests
 * 
 * Tests for the consolidated LLM analysis service that combines:
 * - Product extraction (brand + competitors)
 * - Citation categorization
 * - Sentiment analysis (brand + competitors)
 */

import { consolidatedAnalysisService, ConsolidatedAnalysisOptions, ConsolidatedAnalysisResult } from '../consolidated-analysis.service';

// Mock environment variables
process.env.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'test-key';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key';

describe('ConsolidatedAnalysisService', () => {
  const testOptions: ConsolidatedAnalysisOptions = {
    brandName: 'Nike',
    brandMetadata: {
      industry: 'Sportswear',
      description: 'Athletic footwear and apparel company'
    },
    competitorNames: ['Adidas', 'Puma'],
    competitorMetadata: new Map([
      ['Adidas', { industry: 'Sportswear' }],
      ['Puma', { industry: 'Sportswear' }]
    ]),
    rawAnswer: `Nike is a leading sportswear brand known for innovative products like Air Max and Jordan sneakers. 
    The company has strong brand recognition and positive customer sentiment. Adidas is a major competitor with 
    products like Ultraboost and Stan Smith. Puma also competes in the athletic footwear market. 
    Nike's latest Air Max 270 has received excellent reviews. However, some customers have concerns about pricing.`,
    citations: [
      'https://techcrunch.com/nike-review',
      'https://nike.com/products',
      'https://reddit.com/r/sneakers',
      'https://wikipedia.org/wiki/Nike'
    ],
    collectorResultId: 12345
  };

  describe('analyze()', () => {
    it('should return valid consolidated analysis result', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Validate structure
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('citations');
      expect(result).toHaveProperty('sentiment');

      // Validate products
      expect(result.products).toHaveProperty('brand');
      expect(result.products).toHaveProperty('competitors');
      expect(Array.isArray(result.products.brand)).toBe(true);
      expect(typeof result.products.competitors).toBe('object');

      // Validate citations
      expect(typeof result.citations).toBe('object');
      for (const url in result.citations) {
        expect(result.citations[url]).toHaveProperty('category');
        expect(['Editorial', 'Corporate', 'Reference', 'UGC', 'Social', 'Institutional']).toContain(result.citations[url].category);
      }

      // Validate sentiment
      expect(result.sentiment).toHaveProperty('brand');
      expect(result.sentiment).toHaveProperty('competitors');
      expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(result.sentiment.brand.label);
      expect(result.sentiment.brand.score).toBeGreaterThanOrEqual(-1);
      expect(result.sentiment.brand.score).toBeLessThanOrEqual(1);
    }, 60000); // 60 second timeout for LLM calls

    it('should extract brand products correctly', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Should find Nike products mentioned in text
      expect(result.products.brand.length).toBeGreaterThan(0);
      expect(result.products.brand.some(p => p.toLowerCase().includes('air max'))).toBe(true);
      expect(result.products.brand.some(p => p.toLowerCase().includes('jordan'))).toBe(true);
    }, 60000);

    it('should extract competitor products correctly', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Should find competitor products
      expect(result.products.competitors).toHaveProperty('Adidas');
      expect(result.products.competitors['Adidas'].length).toBeGreaterThan(0);
      expect(result.products.competitors['Adidas'].some(p => p.toLowerCase().includes('ultraboost'))).toBe(true);
    }, 60000);

    it('should categorize citations correctly', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Check specific citations
      if (result.citations['https://techcrunch.com/nike-review']) {
        expect(result.citations['https://techcrunch.com/nike-review'].category).toBe('Editorial');
      }
      if (result.citations['https://nike.com/products']) {
        expect(result.citations['https://nike.com/products'].category).toBe('Corporate');
      }
      if (result.citations['https://reddit.com/r/sneakers']) {
        expect(result.citations['https://reddit.com/r/sneakers'].category).toBe('Social');
      }
      if (result.citations['https://wikipedia.org/wiki/Nike']) {
        expect(result.citations['https://wikipedia.org/wiki/Nike'].category).toBe('Reference');
      }
    }, 60000);

    it('should analyze brand sentiment correctly', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Brand sentiment should be positive (based on test text)
      expect(result.sentiment.brand.label).toBe('POSITIVE');
      expect(result.sentiment.brand.score).toBeGreaterThan(0);
      expect(Array.isArray(result.sentiment.brand.positiveSentences)).toBe(true);
      expect(result.sentiment.brand.positiveSentences.length).toBeGreaterThan(0);
    }, 60000);

    it('should analyze competitor sentiment correctly', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      // Should have sentiment for each competitor
      expect(result.sentiment.competitors).toHaveProperty('Adidas');
      expect(result.sentiment.competitors).toHaveProperty('Puma');
      
      // Validate competitor sentiment structure
      for (const compName in result.sentiment.competitors) {
        const compSentiment = result.sentiment.competitors[compName];
        expect(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).toContain(compSentiment.label);
        expect(compSentiment.score).toBeGreaterThanOrEqual(-1);
        expect(compSentiment.score).toBeLessThanOrEqual(1);
        expect(Array.isArray(compSentiment.positiveSentences)).toBe(true);
        expect(Array.isArray(compSentiment.negativeSentences)).toBe(true);
      }
    }, 60000);

    it('should cache results for same collector result ID', async () => {
      // First call
      const result1 = await consolidatedAnalysisService.analyze(testOptions);
      
      // Second call with same ID should use cache
      const startTime = Date.now();
      const result2 = await consolidatedAnalysisService.analyze(testOptions);
      const duration = Date.now() - startTime;

      // Should be much faster (cached)
      expect(duration).toBeLessThan(100); // Cache should be instant
      expect(result1).toEqual(result2);
    }, 60000);

    it('should handle empty citations array', async () => {
      const options = { ...testOptions, citations: [] };
      const result = await consolidatedAnalysisService.analyze(options);

      expect(result.citations).toEqual({});
    }, 60000);

    it('should handle no competitors', async () => {
      const options = { ...testOptions, competitorNames: [] };
      const result = await consolidatedAnalysisService.analyze(options);

      expect(result.products.competitors).toEqual({});
      expect(result.sentiment.competitors).toEqual({});
    }, 60000);

    it('should handle long answer text (truncation)', async () => {
      const longAnswer = 'Nike is great. '.repeat(10000); // ~150,000 characters
      const options = { ...testOptions, rawAnswer: longAnswer };
      
      const result = await consolidatedAnalysisService.analyze(options);
      
      // Should still return valid result
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('sentiment');
    }, 60000);

    it('should normalize sentiment scores to -1 to 1 range', async () => {
      const result = await consolidatedAnalysisService.analyze(testOptions);

      expect(result.sentiment.brand.score).toBeGreaterThanOrEqual(-1);
      expect(result.sentiment.brand.score).toBeLessThanOrEqual(1);

      for (const compName in result.sentiment.competitors) {
        const score = result.sentiment.competitors[compName].score;
        expect(score).toBeGreaterThanOrEqual(-1);
        expect(score).toBeLessThanOrEqual(1);
      }
    }, 60000);
  });

  describe('validateAndNormalize()', () => {
    it('should handle missing fields gracefully', () => {
      const invalidResult = {} as ConsolidatedAnalysisResult;
      const normalized = (consolidatedAnalysisService as any).validateAndNormalize(invalidResult);

      expect(normalized.products).toBeDefined();
      expect(normalized.citations).toBeDefined();
      expect(normalized.sentiment).toBeDefined();
      expect(normalized.sentiment.brand.label).toBe('NEUTRAL');
      expect(normalized.sentiment.brand.score).toBe(0);
    });
  });

  describe('clearCache()', () => {
    it('should clear cache for specific collector result', async () => {
      await consolidatedAnalysisService.analyze(testOptions);
      
      consolidatedAnalysisService.clearCache(testOptions.collectorResultId!);
      
      // Next call should not use cache
      const startTime = Date.now();
      await consolidatedAnalysisService.analyze(testOptions);
      const duration = Date.now() - startTime;

      // Should take longer (not cached)
      expect(duration).toBeGreaterThan(1000); // LLM call takes time
    }, 60000);
  });
});
