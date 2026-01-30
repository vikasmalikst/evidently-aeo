
import { getNewContentPrompt } from './new-content-factory';
import { RecommendationV3, BrandContextV3 } from './recommendation.types';

const mockRec: RecommendationV3 = {
    id: 'rec_123',
    action: 'Write a blog post about AI',
    citationSource: 'example.com',
    focusArea: 'visibility',
    priority: 'High',
    effort: 'Medium',
    kpi: 'Share of Voice',
    reason: 'To improve visibility',
    explanation: 'Explanation here',
    timeline: '2 weeks'
};

const mockBrand: BrandContextV3 = {
    brandId: 'brand_123',
    brandName: 'TestBrand',
    industry: 'Tech',
    brandDomain: 'testbrand.com'
};

const mockStructure = {
    sections: [
        {
            id: 'custom_1',
            title: 'My Custom Title That Should Not Change',
            content: 'Description of content for this section',
            sectionType: 'custom'
        }
    ]
};

console.log("=== ARTICLE PROMPT ===");
const promptArticle = getNewContentPrompt({
    recommendation: mockRec,
    brandContext: mockBrand,
    structureConfig: mockStructure
}, 'article');
console.log(promptArticle);

console.log("\n\n=== EXPERT RESPONSE PROMPT ===");
const promptExpert = getNewContentPrompt({
    recommendation: mockRec,
    brandContext: mockBrand,
    structureConfig: mockStructure
}, 'expert_community_response');
console.log(promptExpert);
