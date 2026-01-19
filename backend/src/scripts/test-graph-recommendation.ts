
import { graphRecommendationService } from '../services/recommendations/graph-recommendation.service';
import { ConsolidatedAnalysisResult } from '../services/scoring/consolidated-analysis.service';

/**
 * Script to verify Graph Recommendation Service
 * Creates mock data and runs the graph algorithms.
 */

const mockResults: Array<{ id: number; analysis: ConsolidatedAnalysisResult; competitorNames: string[] }> = [
    {
        id: 1,
        competitorNames: ['Brooks'],
        analysis: {
            products: { brand: [], competitors: {} },
            citations: {},
            sentiment: {
                brand: { label: 'NEUTRAL', score: 50 },
                competitors: { 'Brooks': { label: 'NEGATIVE', score: 30 } }
            },
            keywords: [
                { keyword: 'Peeling', relevance_score: 0.9, metadata: { reasoning: 'Durability' } },
                { keyword: 'Toe Cap', relevance_score: 0.8, metadata: { reasoning: 'Durability' } }
            ],
            quotes: [
                { text: 'My Brooks toe cap is peeling off after 20 miles.', sentiment: 'NEGATIVE', entity: 'Brooks' }
            ]
        }
    },
    {
        id: 2,
        competitorNames: ['Brooks'],
        analysis: {
            products: { brand: [], competitors: {} },
            citations: {},
            sentiment: {
                brand: { label: 'POSITIVE', score: 80 },
                competitors: { 'Brooks': { label: 'NEGATIVE', score: 20 } }
            },
            keywords: [
                { keyword: 'Peeling', relevance_score: 0.9, metadata: { reasoning: 'Durability' } },
                { keyword: 'Durability', relevance_score: 0.9, metadata: { reasoning: 'Durability' } }
            ],
            quotes: [
                { text: 'Switching to Asics because of the peeling issue.', sentiment: 'NEGATIVE', entity: 'Brooks' }
            ]
        }
    }
];

async function runTest() {
    console.log('🚀 Starting Graph Service Test...');

    // 1. Build Graph
    graphRecommendationService.buildGraph('Asics', mockResults);

    // 2. Run Algorithms
    graphRecommendationService.runAlgorithms();

    // 3. Query Opportunity Gaps
    console.log('\n🔍 Querying Opportunity Gaps for Competitor: Brooks...');
    const gaps = graphRecommendationService.getOpportunityGaps('Brooks');

    console.log('\n📊 Results:');
    if (gaps.length === 0) {
        console.log('No gaps found (Unexpected).');
    } else {
        gaps.forEach(g => {
            console.log(`[${g.score.toFixed(2)}] Topic: ${g.topic}`);
            console.log(`       Context: ${g.context}`);
            console.log(`       Evidence: ${g.evidence[0] || 'No quote'}`);
        });
    }
}

runTest().catch(console.error);
