
import { PositionExtractionService } from '../position-extraction.service';

// Mock dependencies
jest.mock('../../../utils/api-key-resolver', () => ({
    getPositionExtractionKey: () => 'mock-key',
    getGeminiKey: () => 'mock-key',
    getGeminiModel: () => 'mock-model',
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: () => ({}),
}));

describe('PositionExtractionService - Brand Matching Logic', () => {
    let service: PositionExtractionService;

    beforeEach(() => {
        process.env.SUPABASE_URL = 'http://localhost';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
        service = new PositionExtractionService();
    });

    // Helper to access private method combineBrandTerms
    const combineBrandTerms = (
        brandName: string,
        brandProductsData: any,
        consolidatedCacheData: any,
        llmExtractedProducts: string[]
    ) => {
        return (service as any).combineBrandTerms(
            brandName,
            brandProductsData,
            consolidatedCacheData,
            llmExtractedProducts
        );
    };

    // Helper to access private method calculatePositions
    const calculatePositions = (
        brandName: string,
        brandSynonyms: string[],
        brandProducts: string[],
        competitors: any[],
        rawAnswer: string
    ) => {
        return (service as any).calculateWordPositions(
            brandName,
            brandSynonyms,
            brandProducts,
            competitors,
            rawAnswer
        );
    };

    it('should filter out synonyms that are single-word subsets of a multi-word brand name', () => {
        const brandName = 'Super Bowl';
        const brandProductsData = {
            brand_synonyms: ['Super', 'Bowl', 'The Big Game', 'Super Bowl 2026'],
            brand_products: ['Bowl', 'Ticket']
        };

        // Mock cache and LLM data
        const consolidatedCacheData = { products: { brand: ['Super'] } };
        const llmProducts = ['Stadium']; // 'Stadium' is fine

        const result = combineBrandTerms(
            brandName,
            brandProductsData,
            consolidatedCacheData,
            llmProducts
        );

        // Synonyms "Super" and "Bowl" should be filtered out
        expect(result.brandSynonyms).not.toContain('Super');
        expect(result.brandSynonyms).not.toContain('Bowl');
        expect(result.brandSynonyms).toContain('The Big Game');

        // Products "Bowl" and "Super" (from cache) should be filtered out
        // "Ticket" and "Stadium" should remain
        expect(result.brandProducts).not.toContain('Bowl');
        expect(result.brandProducts).not.toContain('Super');
        expect(result.brandProducts).toContain('Ticket');
        expect(result.brandProducts).toContain('Stadium');
    });

    it('should calculate mentions correctly for user provided Insider Sports example', () => {
        const brandName = 'Insider Sports';
        const brandSynonyms = ['InsiderSports'];
        const brandProducts = ['Super Bowl'];
        const competitors: any[] = [];
        const rawAnswer = 'InsiderSports is really a good brand which can be considered if you want to buy Super Bowl Tickets but it is super expensive . Sports tickets are expensive although';

        const result = calculatePositions(
            brandName,
            brandSynonyms,
            brandProducts,
            competitors,
            rawAnswer
        );

        // Expected matches: "InsiderSports" and "Super Bowl"
        // "super" (expensive) should NOT match because "Super" is not in our list
        // "Sports" (tickets) should NOT match because "Sports" is not in our list (and would be filtered if it was, as it's part of brand name)

        // We expect 2 total mentions
        expect(result.brand.all.length).toBe(2);

        // Verify positions (approximate checks)
        // "InsiderSports" is at start (token 1)
        expect(result.brand.all).toContain(1);
    });

    it('should NOT filter out synonyms for single-word brand names', () => {
        const brandName = 'Apple';
        const brandProductsData = {
            brand_synonyms: ['Mac', 'iPhone'],
            brand_products: []
        };

        const result = combineBrandTerms(
            brandName,
            brandProductsData,
            null,
            []
        );

        expect(result.brandSynonyms).toContain('Mac');
    });
});
