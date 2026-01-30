
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

    // Default structure for Whitepapers (AEO-Optimized)
    const defaultSections = [
        {
            id: "exec_summary",
            title: "Executive Summary",
            content: "<Standalone answer to the core problem (200-300 words)>",
            sectionType: "summary"
        },
        {
            id: "problem_context",
            title: "Problem Statement & Context",
            content: "<Explicit definition of the problem and key concepts>",
            sectionType: "context"
        },
        {
            id: "methodology",
            title: "Methodology & Approach",
            content: "<How we arrived at these conclusions>",
            sectionType: "explanation"
        },
        {
            id: "analysis",
            title: "In-Depth Analysis",
            content: "<Detailed breakdown with causal relationships (Why > What)>",
            sectionType: "analysis"
        },
        {
            id: "limitations",
            title: "Limitations & Scope",
            content: "<Explicitly state what this does NOT cover>",
            sectionType: "constraints"
        },
        {
            id: "conclusion",
            title: "Key Takeaways",
            content: "<Bullet points for AI extraction>",
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
