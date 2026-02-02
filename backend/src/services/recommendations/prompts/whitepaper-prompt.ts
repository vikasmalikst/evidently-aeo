
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

    const sectionsToUse = structureConfig?.sections && structureConfig.sections.length > 0
        ? structureConfig.sections.map(s => ({
            id: s.id,
            title: s.title,
            content: `<${s.content || 'Generate authoritative content for this section'}>`,
            sectionType: s.sectionType || "custom"
        }))
        : [];

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
