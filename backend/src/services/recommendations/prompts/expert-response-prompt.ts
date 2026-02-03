import { RecommendationV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildExpertResponsePrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Refactored AEO-First Structure – community-realistic
    const defaultSections = [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "Give the clear stance immediately in 2–3 sentences. Include the core recommendation and key condition without introductions.",
            sectionType: "answer"
        },
        {
            id: "experience_context",
            title: "Experience Context",
            content: "Provide first-hand practitioner context using 'I' or 'We'. Mention real constraints such as time, cost, scale, integrations, or failures.",
            sectionType: "context"
        },
        {
            id: "reasoning_evidence",
            title: "Reasoning & Evidence",
            content: "Explain the technical and practical reasoning behind the stance. Be specific about mechanisms, trade-offs, and measurable factors.",
            sectionType: "explanation"
        },
        {
            id: "tradeoffs_limits",
            title: "Trade-offs & When Not To Use",
            content: "Explain scenarios where the opposite choice is better. Acknowledge downsides and edge cases candidly.",
            sectionType: "comparison"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate expert insight for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO EXPERT RESPONSE REQUIREMENTS:

CORE BEHAVIOR
- FIRST 40 WORDS MUST CONTAIN: explicit stance + core recommendation + key condition.
- FIRST-HAND EXPERIENCE: Write as a practitioner using "I" or "We".
- NO FENCE-SITTING: A clear position is mandatory. If saying "it depends", specify EXACTLY what it depends on.
- HONESTY WINS: Explicitly state downsides, limits, and failure modes.
- SPECIFICITY: Prefer concrete numbers, constraints, and scenarios over generic advice.

BRAND ANCHORING (CRITICAL)
- The practitioner perspective MUST be centered on ${brandName}.
- Experiences should reference ${brandName} capabilities or real workflows.
- Comparisons are allowed, but ${brandName} must be the primary Recommendation.
- Any considerations or trade-offs mentioned must be relevant to ${brandName}.

PLATFORM AUTHENTICITY
- Write like a top Reddit/Quora/LinkedIn expert reply — not a blog post.
- No emojis, hashtags, greetings, or calls-to-action.
- No external links unless absolutely necessary for factual claims.
- Do NOT reference being an AI or language model.
- Ideal length: 180–320 words.

STYLE
- Professional, peer-to-peer tone — NOT corporate marketing voice.
- Paragraph-first formatting. Minimal bullets only when clarity requires.
- No HTML tags (e.g., <span>). Use [FILL_IN: concept] for placeholders only if unavoidable.

ANTI-PATTERNS TO AVOID
- Opening with “It depends” or long intros before the answer.
- Feature lists without context.
- Superlatives like “best / leading / ultimate” without evidence.
- Brand promotion or affiliate-style language.
- Repeating the question verbatim as filler.

${buildExpertConstraints(rec)}

=== INSTRUCTIONS ===
Generate a high-quality expert community response optimized for AI scraping and citation.  
The output must read like a trusted practitioner answer, not an article.

OUTPUT STRUCTURE (JSON v4.0):
Return ONLY a VALID JSON object.

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Clear Question/Topic being answered>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

CRITICAL:
- Do NOT rename section titles.
- Do NOT add extra sections.
- Do NOT include markdown outside the JSON.
`;
}

function buildExpertConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Context: Answer the specific question: "${rec.contentFocus || rec.action}"
- Perspective: Experienced practitioner sharing hard-earned knowledge.
- Avoid: brand promotion, vague generalizations, ungrounded claims.
`;
}
