import { IAEOScoringService, AEOScoreResult, MAX_SCRAPABILITY_SCORE } from './base-aeo-scoring.interface';

/**
 * Comparison Table AEO Scoring Service (v2)
 * 
 * Aligned with 'Comparison Table' criteria from reference doc.
 * Focuses on parsability, attribute quality, and decision clarity.
 */
export class ComparisonTableAEOScoringService implements IAEOScoringService {

    public calculateScrapabilityScore(content: string): AEOScoreResult {
        // Handle V4/JSON content structure
        let text = content || '';
        let tableContent = text;
        let contentTitle = ''; // Track title for intent scoring

        try {
            // Strip markdown code blocks if present
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            if (jsonText.startsWith('{')) {
                const parsed = JSON.parse(jsonText);

                if (parsed.contentTitle) {
                    contentTitle = parsed.contentTitle;
                }

                // If V4 sections, find the table section
                if (parsed.sections && Array.isArray(parsed.sections)) {
                    const tableSection = parsed.sections.find((s: any) =>
                        s.sectionType === 'comparison_table' ||
                        s.id === 'table' ||
                        s.title?.toLowerCase().includes('table')
                    );

                    if (tableSection) {
                        // If a table section is found, use its content for table-specific scoring
                        tableContent = tableSection.content || '';
                    }

                    // Reconstruct full text for context scoring
                    text = parsed.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');
                } else if (parsed.content) {
                    text = parsed.content;
                    // If no specific table section, assume the whole content might be a table
                    tableContent = text;
                }
            }
        } catch (e) {
            // Not JSON, treat as raw text
        }

        // Extract Markdown Tables for specific analysis if not already extracted from JSON
        if (!tableContent) {
            // Matches | Header | Header | ... \n | --- | --- | ...
            const tableMatch = text.match(/\|(.+)\|\n\|(\s*---.*\|)+/);
            if (tableMatch) {
                // Grab the table block roughly
                const split = text.split(tableMatch[0]);
                if (split.length > 1) {
                    // The starting match plus some following lines
                    // This is a rough heuristic, but effective enough for v1
                    tableContent = tableMatch[0] + (split[1] || '').split('\n\n')[0];
                } else {
                    tableContent = tableMatch[0];
                }
            }
        }


        // 1. Comparison Intent Clarity (10)
        // Check contentTitle or first H1/H2
        const firstLine = contentTitle || text.split('\n')[0]?.trim() || '';
        const intentScore = this.scoreComparisonIntent(firstLine);

        // 2. Table Structure & Parsability (20)
        const structureScore = this.scoreTableStructure(tableContent || text); // Use tableContent if available, else full text

        // 3. Attribute Quality (10)
        const attributeScore = this.scoreAttributeQuality(tableContent || text);

        // 4. Neutral Language (10)
        const neutralityScore = this.scoreNeutrality(text);

        // 5. Semantic Consistency (5)
        const consistencyScore = this.scoreSemanticConsistency(tableContent || text);

        // 6. Contextual Interpretation (5)
        const contextScore = this.scoreContextualInterpretation(text);

        // 7. Edge Case Coverage (10)
        const edgeCaseScore = this.scoreEdgeCases(text);

        // 8. Timeliness (10)
        const timelinessScore = this.scoreTimeliness(text);

        // LLM Readiness removed as separate score, integrated into Structure

        // Total Calculation (Max 80)
        // 10 + 20 + 10 + 10 + 5 + 5 + 10 + 10 = 80
        const total = intentScore.score + structureScore.score + attributeScore.score +
            neutralityScore.score + consistencyScore.score + contextScore.score +
            edgeCaseScore.score + timelinessScore.score;

        return {
            totalScore: Math.min(MAX_SCRAPABILITY_SCORE, total),
            breakdown: {
                comparisonIntent: intentScore,
                tableStructure: structureScore,
                attributeQuality: attributeScore,
                neutralFactuality: neutralityScore,
                semanticConsistency: consistencyScore,
                contextualInterpretation: contextScore,
                edgeCaseCoverage: edgeCaseScore,
                timeliness: timelinessScore,
                llmReadiness: { score: structureScore.score, max: 20, status: structureScore.status, feedback: "Integrated into Table Structure" }
            }
        };
    }

    // --- Dimension Scorers ---

    // 1. Comparison Intent Clarity (10)
    private scoreComparisonIntent(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // "Comparison of A vs B", "Comparing X and Y"
        // Look for Title or first sentence.
        const header = text.split('\n')[0]?.trim() || ''; // Handle leading newlines/spaces

        // Relaxed regex to include "Side-by-Side" and "Table"
        const hasVs = / vs\.? /i.test(header) ||
            /versus/i.test(header) ||
            /comparison/i.test(header) ||
            /comparing/i.test(header) ||
            /showdown/i.test(header) ||
            /side-by-side/i.test(header) ||
            /table/i.test(header);

        if (hasVs) {
            return { score: 10, max: 10, status: 'good', feedback: "Clear comparison intent in header." };
        }
        return { score: 5, max: 10, status: 'warning', feedback: "Header is vague. Use 'A vs B' format." };
    }

    // 2. Table Structure & Parsability (20)
    private scoreTableStructure(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Must contain markdown table syntax: | Header | and | --- |
        const hasPipes = (text.match(/\|/g) || []).length > 6; // More than 3 pipes implies at least 2 columns and 2 rows
        const hasSeparators = /\|?\s*:?-+:?\s*\|/.test(text); // Checks for separator line like |---| or |:---|

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No Markdown table definition found.";

        if (hasPipes && hasSeparators) {
            score = 20;
            status = 'good';
            feedback = "Valid Markdown table structure detected.";
        } else if (hasPipes) {
            score = 10;
            status = 'warning';
            feedback = "Potential table found but malformed (missing separator row).";
        }

        return { score, max: 20, status, feedback };
    }

    // 3. Attribute Selection Quality (20)
    private scoreAttributeQuality(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Look for row headers (first column) or column headers keywords
        // Features, Price, Support, Users, Pros, Cons
        const keywords = [/price/i, /cost/i, /feature/i, /support/i, /platform/i, /user/i, /rating/i, /limit/i, /security/i, /compliance/i, /granular/i];
        const matches = keywords.filter(p => p.test(text)).length;

        if (matches >= 3) {
            return { score: 20, max: 20, status: 'good', feedback: "High quality, functional attributes." };
        } else if (matches >= 1) {
            return { score: 10, max: 20, status: 'warning', feedback: "Basic attributes. Add deeper functional comparison." };
        }
        return { score: 5, max: 20, status: 'error', feedback: "Attributes seem weak or missing functional details." };
    }

    // 4. Neutral Language & Factuality (15)
    private scoreNeutrality(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Avoid "Winner", "Best", "Destroyed" - strict check
        // "Best suited" is okay, so we look for "The Winner is" patterns or extreme language
        const hype = /absolute winner/i.test(text) || /destroyed/i.test(text) || /crushes the competition/i.test(text);

        if (hype) {
            return { score: 5, max: 15, status: 'warning', feedback: "Avoid 'winner' language in AEO comparisons." };
        }
        return { score: 15, max: 15, status: 'good', feedback: "Neutral comparison tone." };
    }

    // 5. Semantic Consistency (10)
    private scoreSemanticConsistency(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Check if rows have equal columns (simple regex check on pipe count)
        const lines = text.match(/^\s*\|.*\|\s*$/gm) || [];
        if (lines.length === 0) return { score: 0, max: 10, status: 'error', feedback: "No table rows." };

        const pipeCounts = lines.map(l => (l.match(/\|/g) || []).length);
        const refCount = pipeCounts[0];
        // Allow variance of 0 (perfect) for consistency
        const allSame = pipeCounts.every(val => val === refCount);

        if (allSame && lines.length > 2) {
            return { score: 10, max: 10, status: 'good', feedback: "Consistent table formatting." };
        }
        // If mostly same (one outlier allowed?) - strict for now
        return { score: 5, max: 10, status: 'warning', feedback: "Inconsistent column counts detected." };
    }

    // 6. Contextual Interpretation Layer (10)
    private scoreContextualInterpretation(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // Text *outside* of the table
        // Remove table lines and check for remaining length
        const nonTableText = text.replace(/^\s*\|.*\|\s*$/gm, '').trim();

        if (nonTableText.length > 150) {
            return { score: 10, max: 10, status: 'good', feedback: "Good contextual analysis surrounding the table." };
        }
        return { score: 2, max: 10, status: 'warning', feedback: "Add analysis text before/after the table." };
    }

    // 7. Edge-Case & Limitation Coverage (10)
    private scoreEdgeCases(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // "Except", "However", "Trade-off", "Limitation", "Only if"
        const edgeWords = [/except/i, /however/i, /trade-off/i, /limitation/i, /only if/i, /unless/i, /gap/i, /lack/i];
        const matches = edgeWords.filter(p => p.test(text)).length;

        if (matches >= 2) {
            return { score: 10, max: 10, status: 'good', feedback: "Explicitly covers edge cases/limitations." };
        }
        return { score: 0, max: 10, status: 'warning', feedback: "Missing edge-case/trade-off analysis." };
    }

    // 8. Timeliness & Update Signals (5)
    private scoreTimeliness(text: string): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        const year = new Date().getFullYear();
        const nextYear = year + 1;
        const timeRegex = new RegExp(`${year}|${nextYear}|current|updated|latest|${year - 1}`, 'i'); // Allow last year too for data

        if (timeRegex.test(text)) {
            return { score: 5, max: 5, status: 'good', feedback: "Includes timeliness signals." };
        }
        return { score: 0, max: 5, status: 'warning', feedback: "Add a date or 'current as of' signal." };
    }

    // 9. LLM Extraction Readiness (Bonus +5)
    private scoreLLMReadiness(structureScore: number): { score: number, max: number, status: 'good' | 'warning' | 'error', feedback: string } {
        // If structure is high, implies high readability
        if (structureScore >= 15) {
            return { score: 5, max: 5, status: 'good', feedback: "Perfectly parsable structure." };
        }
        return { score: 0, max: 5, status: 'warning', feedback: "Structure errors may hinder LLM extraction." };
    }
}
