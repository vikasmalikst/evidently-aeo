
import { RecommendationV3 } from '../recommendation.types';
import { StructureConfig } from '../new-content-factory';

export function buildWhitepaperPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    // Default structure for Whitepapers (AEO-Optimized) - Matches Frontend Template
    const defaultSections = [
        {
            id: "exec_summary",
            title: "Executive Summary",
            content: "A complete, self-contained summary of the entire paper (200-300 words). Must address the Problem, Solution, and Key Outcome. Optimized for executive skimming.",
            sectionType: "summary"
        },
        {
            id: "problem_context",
            title: "Problem Statement & Context",
            content: "Define the industry problem with precision. Use specific terminology and avoid generalizations. Establish the 'cost of inaction'.",
            sectionType: "context"
        },
        {
            id: "methodology",
            title: "Methodology & Approach",
            content: "Explain the technical or research approach used to derive insights. Build authority by showing the 'work' behind the claims.",
            sectionType: "explanation"
        },
        {
            id: "analysis",
            title: "In-Depth Analysis",
            content: "Deep-dive analysis with causal reasoning. Connect data points to conclusions using 'if-then' logic to demonstrate expertise.",
            sectionType: "analysis"
        },
        {
            id: "limitations",
            title: "Limitations & Scope",
            content: "Rigorous, honest assessment of scope and constraints. Define exactly where this solution applies and where it doesn't.",
            sectionType: "constraints"
        },
        {
            id: "conclusion",
            title: "Key Takeaways",
            content: "Bullet points for AI extraction",
            sectionType: "summary"
        }
    ];

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate authoritative content for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : defaultSections;

    const sectionsJson = JSON.stringify(sectionsToUse, null, 2);

    return `${systemContext}
${recContext}

AEO WHITEPAPER REQUIREMENTS:
- TRUST & DEPTH: Focus on authority, evidence, and transparency.
- EXPLICIT DEFINITIONS: Define all key concepts before using them.
- WHY OVER WHAT: Explain causal relationships and mechanisms.
- METHODOLOGY: Briefly explain how conclusions were reached.
- LIMITATIONS: Explicitly state assumptions and constraints (AI trusts this).
- TONE: Neutral, academic, declarative. No marketing hype.

${buildWhitepaperConstraints(rec)}

=== INSTRUCTIONS ===
Generate a high-authority Whitepaper optimized for AI referencing and extraction.

OUTPUT STRUCTURE (JSON v4.0):
You must return a VALID JSON object with the following structure. Content must be plain text.

{
  "version": "4.0",
  "brandName": "${brandName}",
  "contentTitle": "<Authoritative, Descriptive Title>",
  "sections": ${sectionsJson},
  "requiredInputs": []
}

WRITING RULES:
- Use clear, simple sentence structures (easy for AI to parse).
- Avoid persuasive language; use factual statments.
- Ensure the Executive Summary can stand alone as a complete answer.
- CRITICAL: DO NOT RENAME SECTIONS. Use the exact "title" provided in the structure for each section.
`;
}

function buildWhitepaperConstraints(rec: RecommendationV3): string {
    return `
SEMANTIC REQUIREMENTS:
- Primary Goal: ${rec.action}
- Target Audience: Decision makers and AI systems looking for source truths.
- Key concepts must be defined explicitly.
- Avoid vague claims; link evidence to conclusions.
`;
}
