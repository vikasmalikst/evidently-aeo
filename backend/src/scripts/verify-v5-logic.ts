
// Verification script for v5.0 Content Logic
// This script replicates the logic in RecommendationContentService to ensure v5.0 is handled correctly.

type GeneratedAnyJson = any;

function normalizeGeneratedContent(parsed: any): GeneratedAnyJson {
    const version = parsed.version || '1.0';

    // Handle v5.0 (Unified Content - New System)
    if (version === '5.0') {
        const p5 = parsed as any;
        return {
            version: '5.0',
            recommendationId: String(p5.recommendationId || ''),
            brandName: String(p5.brandName || ''),
            contentTitle: String(p5.contentTitle || ''),
            content: String(p5.content || ''),
            requiredInputs: Array.isArray(p5.requiredInputs) ? p5.requiredInputs : []
        };
    }

    // ... (other versions omitted for brevity as we are testing v5.0)
    return { error: 'Not v5.0' };
}


function isValidGeneratedContent(parsed: any): boolean {
    if (!parsed || typeof parsed !== 'object') return false;

    // Check version
    const version = parsed.version;
    // v5.0 is valid
    if (version !== '1.0' && version !== '2.0' && version !== '3.0' && version !== '4.0' && version !== '5.0' && version !== 'guide_v1') {
        console.warn(`[VALIDATION FAIL] Invalid version: ${version}`);
        return false;
    }

    // v5.0 Unified Canvas: requires content and contentTitle
    if (version === '5.0') {
        if (!parsed.content || !parsed.contentTitle) return false;
        return true;
    }

    return false;
}

// TEST DATA
const v5Input = {
    version: "5.0",
    recommendationId: "rec_123",
    brandName: "Test Brand",
    contentTitle: "Test Unified Content",
    content: "# Unified Content\n\nThis is a test.\n\n## Section 1\nContent 1",
    requiredInputs: ["Check this"]
};

console.log("----------------------------------------------------------------");
console.log("Verifying v5.0 Content Logic...");
console.log("----------------------------------------------------------------");

// 1. Validate
const isValid = isValidGeneratedContent(v5Input);
if (isValid) {
    console.log("✅ isValidGeneratedContent passed for v5.0");
} else {
    console.error("❌ isValidGeneratedContent FAILED for v5.0");
}

// 2. Normalize
const normalized = normalizeGeneratedContent(v5Input);
console.log("Normalized Output:", JSON.stringify(normalized, null, 2));

if (normalized.version === '5.0' && normalized.content === v5Input.content) {
    console.log("✅ normalizeGeneratedContent correctly preserved v5.0 structure");
} else {
    console.error("❌ normalizeGeneratedContent FAILED. Expected version 5.0, got:", normalized.version);
}
