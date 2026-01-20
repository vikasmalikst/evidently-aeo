
import { rankRecommendationsV3, RankingInputs } from '../services/recommendations/recommendation-ranking.service';
import { RecommendationV3 } from '../services/recommendations/recommendation.types';

const mockRecs: RecommendationV3[] = [
    {
        action: "Fix Battleground",
        citationSource: "competitor.com",
        focusArea: "visibility",
        priority: "Medium",
        effort: "High"
    },
    {
        action: "Protect Stronghold",
        citationSource: "brand.com",
        focusArea: "soa",
        priority: "High",
        effort: "Low"
    },
    {
        action: "Seize Opportunity",
        citationSource: "niche-blog.com",
        focusArea: "sentiment",
        priority: "Low",
        effort: "Medium"
    }
];

const inputs: RankingInputs = {
    sourceMetrics: [
        {
            domain: "competitor.com",
            citations: 50,
            impactScore: 9, // High Impact
            soa: 5, // Low SOA (<20%), should be Battleground
            visibility: 80,
            mentionRate: 5,
            sentiment: 40
        },
        {
            domain: "brand.com",
            citations: 100,
            impactScore: 8,
            soa: 80, // High SOA (>50%), should be Stronghold
            visibility: 90,
            mentionRate: 10,
            sentiment: 80
        },
        {
            domain: "niche-blog.com",
            citations: 20,
            impactScore: 7,
            soa: 30, // Mod SOA (20-50%), should be Opportunity
            visibility: 40,
            mentionRate: 2,
            sentiment: 50
        }
    ]
};

console.log('🧪 Testing Ranking Logic...');
const ranked = rankRecommendationsV3(mockRecs, inputs);

ranked.forEach((r, i) => {
    console.log(`\n#${i + 1}: ${r.action}`);
    console.log(`   Role: ${r.strategicRole}`);
    console.log(`   Score: ${r.calculatedScore}`);
    console.log(`   Priority: ${r.priority}`);

    // Assertions
    if (r.action === "Fix Battleground" && r.strategicRole !== 'Battleground') console.error('❌ Failed Battleground Check');
    if (r.action === "Protect Stronghold" && r.strategicRole !== 'Stronghold') console.error('❌ Failed Stronghold Check');
    if (r.action === "Seize Opportunity" && r.strategicRole !== 'Opportunity') console.error('❌ Failed Opportunity Check');
});
