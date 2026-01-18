
import { filterCompetitorRecommendations, CompetitorExclusionList } from '../services/recommendations/competitor-filter.service';

function runTest() {
    console.log('🧪 Testing Competitor Filter Refinement');

    // Mock Exclusion List: Competitor = "BadCompetitor" (badcompetitor.com)
    const exclusionList: CompetitorExclusionList = {
        names: new Set(['badcompetitor']),
        domains: new Set(['badcompetitor.com']),
        nameVariations: new Set(['bad competitor']),
        baseDomains: new Set(['badcompetitor']),
    };

    const recommendations = [
        {
            id: 1,
            action: 'Create a comparison guide: Us vs. BadCompetitor',
            citationSource: 'reddit.com', // SAFE source
            reason: 'People are asking about BadCompetitor alternatives',
            explanation: 'We need to differentiate from BadCompetitor.'
        },
        {
            id: 2,
            action: 'Post a guest blog on BadCompetitor.com',
            citationSource: 'badcompetitor.com', // UNSAFE source
            reason: 'Get backlink',
            explanation: 'Bad idea.'
        },
        {
            id: 3,
            action: 'Write about general topics',
            citationSource: 'medium.com',
            reason: 'Good visibility',
            explanation: 'Neutral content.'
        }
    ];

    console.log('\n--- Test 1: Strict Mode (Default) ---');
    // Should filter BOTH 1 and 2
    const resultsStrict = filterCompetitorRecommendations(recommendations, exclusionList);
    console.log(`Filtered: ${resultsStrict.filtered.length}, Removed: ${resultsStrict.removed.length}`);
    resultsStrict.removed.forEach(r => console.log(`   [Strict] Removed ID ${r.recommendation.id}: ${r.reason}`));

    console.log('\n--- Test 2: Relaxed Mode (allowTextMentions: true) ---');
    // Should filter ONLY 2. ID 1 should pass.
    const resultsRelaxed = filterCompetitorRecommendations(recommendations, exclusionList, { allowTextMentions: true });
    console.log(`Filtered: ${resultsRelaxed.filtered.length}, Removed: ${resultsRelaxed.removed.length}`);

    const id1Passed = resultsRelaxed.filtered.find(r => r.id === 1);
    const id2Removed = resultsRelaxed.removed.find(r => r.recommendation.id === 2);

    if (id1Passed && id2Removed) {
        console.log('\n✅ SUCCESS: Relaxed mode allowed text mention on safe source but blocked competitor source.');
    } else {
        console.error('\n❌ FAILURE: Logic incorrect.');
        if (!id1Passed) console.error('   Error: ID 1 was blocked in relaxed mode.');
        if (!id2Removed) console.error('   Error: ID 2 was allowed in relaxed mode.');
    }
}

runTest();
