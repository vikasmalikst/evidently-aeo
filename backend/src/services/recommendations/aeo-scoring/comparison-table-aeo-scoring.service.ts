import { IAEOScoringService, AEOScoreResult } from './base-aeo-scoring.interface';

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
                        tableContent = tableSection.content || '';
                    }

                    // Reconstruct full text for context scoring
                    text = parsed.sections.map((s: any) => `${s.title}\n${s.content}`).join('\n\n');
                } else if (parsed.content) {
                    text = parsed.content;
                    tableContent = text;
                }
            }
        } catch (e) {
            // Not JSON, treat as raw text
        }

        // 1. Comparison Intent Clarity (10)
        // Pass contentTitle explicitly if found
        const intentScore = this.scoreComparisonIntent(contentTitle || text);

        // 2. Table Structure & Parsability (20)
        // Pass specifically the table content for structure check
        const structureScore = this.scoreTableStructure(tableContent);

        // 3. Attribute Selection Quality (20)
        const attributeScore = this.scoreAttributeQuality(tableContent);

        // 4. Neutral Language & Factuality (15)
        const neutralityScore = this.scoreNeutrality(text);

        // 5. Semantic Consistency (10)
        const consistencyScore = this.scoreSemanticConsistency(tableContent);

        // 6. Contextual Interpretation Layer (10)
        const contextScore = this.scoreContextualInterpretation(text);

        // 7. Edge-Case & Limitation Coverage (10)
        const edgeCaseScore = this.scoreEdgeCases(text);

        // 8. Timeliness & Update Signals (5)
        const timelinessScore = this.scoreTimeliness(text);

        // 9. LLM Extraction Readiness (Bonus +5)
        const llmScore = this.scoreLLMReadiness(structureScore.score);

        // Total Calculation (Total 100 + 5 bonus, capped at 70 for backend portion)
        const rawTotal = intentScore.score + structureScore.score + attributeScore.score +
            neutralityScore.score + consistencyScore.score + contextScore.score +
            edgeCaseScore.score + timelinessScore.score;

        const total = Math.round(rawTotal * 0.7) + llmScore.score;

        return {
            totalScore: Math.min(70, total),
            breakdown: {
                comparisonIntent: intentScore,
                tableStructure: structureScore,
                attributeQuality: attributeScore,
                neutralFactuality: neutralityScore,
                semanticConsistency: consistencyScore,
                contextualInterpretation: contextScore,
                edgeCaseCoverage: edgeCaseScore,
                timeliness: timelinessScore,
                llmReadiness: llmScore
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
        // Simple Markdown Table Check
        // | Header | Header |
        // | --- | --- |

        // Count lines that look like table rows
        const tableLines = text.match(/^\s*\|.*\|\s*$/gm) || [];
        const hasSeparator = /^\s*\|[-:\s|]+\|\s*$/m.test(text);

        let score = 0;
        let status: 'good' | 'warning' | 'error' = 'error';
        let feedback = "No markdown table structure detected.";

        if (tableLines.length >= 3 && hasSeparator) {
            score = 20;
            status = 'good';
            feedback = "Strong table structure.";
        } else if (tableLines.length > 0) {
            score = 10;
            status = 'warning';
            feedback = "Structure exists but is thin (add more rows).";
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
