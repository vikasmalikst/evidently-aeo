
import { buildUnifiedArticlePrompt } from '../services/recommendations/prompts/unified/unified-article-prompt';
import { StructureConfig } from '../services/recommendations/new-content-factory';
import { RecommendationV3 } from '../services/recommendations/recommendation.types';

// Mock Data
const mockRec: RecommendationV3 = {
    id: '123',
    action: 'write article',
    citationSource: 'google',
    focusArea: 'visibility',
    priority: 'High',
    effort: 'Medium',
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date()
} as any;

const mockConfig: StructureConfig = {
    sections: [
        { id: 's1', title: 'Custom Section ONE', content: 'Instructions 1', sectionType: 'custom' },
        { id: 's2', title: 'Custom Section TWO', content: 'Instructions 2', sectionType: 'custom' }
    ]
};

console.log("----------------------------------------------------------------");
console.log("Verifying Unified Article Prompt with Custom Structure...");
console.log("----------------------------------------------------------------");

try {
    const prompt = buildUnifiedArticlePrompt(
        "System Context",
        "Rec Context",
        "Acme Corp",
        2026,
        mockRec,
        mockConfig
    );

    // Check for H2 headers
    const hasSection1 = prompt.includes('[H2] Custom Section ONE: Instructions 1');
    const hasSection2 = prompt.includes('[H2] Custom Section TWO: Instructions 2');
    const hasH1 = prompt.includes('[H1] Title (The Entity): Must include the Primary Entity');

    if (hasSection1 && hasSection2 && hasH1) {
        console.log("✅ Success: Custom structure detected in prompt.");
        console.log("✅ Success: H1 instruction prepended correctly.");
    } else {
        console.error("❌ Failure: Custom structure NOT found in prompt.");
        console.log("Debug Info:");
        console.log("Has Section 1:", hasSection1);
        console.log("Has Section 2:", hasSection2);
        console.log("Has H1:", hasH1);

        // Print the template section
        const start = prompt.indexOf('=== THE TEMPLATE ===');
        const end = prompt.indexOf('=== INSTRUCTIONS ===');
        if (start !== -1 && end !== -1) {
            console.log("\nGenerated Template Portion:\n", prompt.substring(start, end));
        } else {
            console.log("\nFull Prompt (truncated):\n", prompt.substring(0, 500));
        }
    }

} catch (error) {
    console.error("Error running verification:", error);
}
