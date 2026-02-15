
import { AEOScoringFactory2 } from '../services/recommendations/aeo-scoring2/aeo-scoring-factory.service';

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

## Data Points (2025)
In 2025, 60% of marketers prioritized this. Budgets increased by $5000 on average.
- List item 1
- List item 2
- List item 3
- List item 4
- List item 5
- List item 6
- List item 7
- List item 8
- List item 9
- List item 10
`;

const BAD_CONTENT_SAMPLE = `
Check out our revolutionary tool! It is the best-in-class solution for everyone.
Click here to sign up now. You won't believe how good it is.
Buy now for a discount.
It is very hard to read because the sentences are extremely long and convoluted and do not really make much sense but just go on and on forever without ever stopping to take a breath or make a point.
`;

async function runVerification() {
    console.log("=== AEO SCORING 2.0 VERIFICATION ===\n");

    const service = AEOScoringFactory2.getService('article');

    console.log("--- TEST CASE 1: GOOD CONTENT (Structured, Recent, Readable) ---");
    const goodResult = service.calculateScrapabilityScore(GOOD_CONTENT_SAMPLE);
    console.log(`Total Score: ${goodResult.totalScore}/100`);
    console.log("Breakdown:", JSON.stringify(goodResult.breakdown, null, 2));

    console.log("\n--- TEST CASE 2: BAD CONTENT (Flat, Old, Hard to Read) ---");
    const badResult = service.calculateScrapabilityScore(BAD_CONTENT_SAMPLE);
    console.log(`Total Score: ${badResult.totalScore}/100`);
    console.log("Breakdown:", JSON.stringify(badResult.breakdown, null, 2));
}

runVerification();
