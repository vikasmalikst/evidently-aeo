
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { buildUnifiedArticlePrompt } from './prompts/unified/unified-article-prompt';
import { buildUnifiedVideoPrompt } from './prompts/unified/unified-video-prompt';
import { buildUnifiedComparisonPrompt } from './prompts/unified/unified-comparison-prompt';
import { RecommendationV3 } from './recommendation.types';

function testPrompts() {
    console.log('🧪 Testing Optimized Prompts...');

    const mockRec: RecommendationV3 = {
        action: 'How to optimize AI content',
        citationSource: 'google',
        focusArea: 'visibility',
        priority: 'High',
        effort: 'Medium',
    };

    const brandName = "TechFlow";
    const year = 2026;
    const systemContext = "System Context Placeholder";
    const recContext = "Recommendation Context Placeholder";

    console.log('\n--- ARTICLE PROMPT ---');
    console.log(buildUnifiedArticlePrompt(systemContext, recContext, brandName, year, mockRec));

    console.log('\n--- VIDEO PROMPT ---');
    console.log(buildUnifiedVideoPrompt(systemContext, recContext, brandName, year, mockRec));

    console.log('\n--- COMPARISON PROMPT ---');
    console.log(buildUnifiedComparisonPrompt(systemContext, recContext, brandName, year, mockRec, undefined, ['Competitor X']));
}

testPrompts();
