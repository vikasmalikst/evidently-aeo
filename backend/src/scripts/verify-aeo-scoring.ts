
import { aeoScoringService } from '../services/recommendations/aeo-scoring.service';

const GOOD_CONTENT_SAMPLE = `
# Content Optimization Strategy (Summary)
**TL;DR**: Content optimization refers to the process of refining web content to improve its visibility and relevance.
This study shows that optimized content improves engagement by 40% (Smith, 2024).

## What is Content Optimization?
Content optimization is defined as the practice of making content useful.

## Why it Matters
This matters because search engines prioritize user value. Consequently, rankings improve.

## Strategy vs Tactics
Unlike simple tactics, strategy involves long-term planning. Compared to paid ads, SEO is sustainable.
There is a trade-off between speed and quality.

## Data Points
In 2023, 60% of marketers prioritized this. Budgets increased by $5000 on average.
`;

const BAD_CONTENT_SAMPLE = `
Check out our revolutionary tool! It is the best-in-class solution for everyone.
Click here to sign up now. You won't believe how good it is.
Buy now for a discount.
`;

async function runVerification() {
    console.log("=== AEO SCORING VERIFICATION ===\n");

    console.log("--- TEST CASE 1: OPTIMIZED CONTENT ---");
    const goodResult = aeoScoringService.calculateScrapabilityScore(GOOD_CONTENT_SAMPLE);
    console.log(`Total Score: ${goodResult.totalScore}/70`);
    console.log("Breakdown:", JSON.stringify(goodResult.breakdown, null, 2));

    console.log("\n--- TEST CASE 2: POOR/MARKETING CONTENT ---");
    const badResult = aeoScoringService.calculateScrapabilityScore(BAD_CONTENT_SAMPLE);
    console.log(`Total Score: ${badResult.totalScore}/70`);
    console.log("Breakdown:", JSON.stringify(badResult.breakdown, null, 2));
}

runVerification();
