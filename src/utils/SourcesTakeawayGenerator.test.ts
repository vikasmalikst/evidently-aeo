
import { describe, it, expect } from 'vitest';
import { generateKeyTakeaways, AnalysisSource } from './SourcesTakeawayGenerator';

describe('generateKeyTakeaways', () => {
    it('returns insufficient data message for empty input', () => {
        const result = generateKeyTakeaways([]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('no-data');
    });

    it('detects overall health summary', () => {
        const sources: AnalysisSource[] = [
            { name: 's1', type: 'editorial', mentionRate: 50, mentionChange: 0, soa: 10, soaChange: 0, sentiment: 90, sentimentChange: 0, citations: 10, quadrant: 'growth', url: '', topics: [], prompts: [], pages: [] },
            { name: 's2', type: 'editorial', mentionRate: 50, mentionChange: 0, soa: 10, soaChange: 0, sentiment: 80, sentimentChange: 0, citations: 10, quadrant: 'growth', url: '', topics: [], prompts: [], pages: [] },
        ];
        const result = generateKeyTakeaways(sources);
        const summary = result.find(r => r.id === 'summary-health');
        expect(summary).toBeDefined();
        expect(summary?.description).toContain('strong sentiment');
    });

    it('detects Negative Sentiment issue', () => {
        const sources: AnalysisSource[] = [
            {
                name: 'BadSource', type: 'editorial',
                mentionRate: 50, mentionChange: 0,
                soa: 10, soaChange: 0,
                sentiment: 20, sentimentChange: 0,
                citations: 10,
                valueScore: 80, // High value
                quadrant: 'reputation',
                url: '', topics: [], prompts: [], pages: []
            },
        ];
        const result = generateKeyTakeaways(sources);
        const issue = result.find(r => r.type === 'critical');
        expect(issue).toBeDefined();
        expect(issue?.title).toBe('Negative Sentiment');
        expect(issue?.description).toContain('BadSource');
    });

    it('detects Rising Stars opportunity', () => {
        const sources: AnalysisSource[] = [
            {
                name: 'NewStar', type: 'blog',
                mentionRate: 10, mentionChange: 20, // +20% change
                soa: 5, soaChange: 15,
                sentiment: 60, sentimentChange: 0,
                citations: 2,
                quadrant: 'growth',
                url: '', topics: [], prompts: [], pages: []
            },
        ];
        const result = generateKeyTakeaways(sources);
        const opp = result.find(r => r.id === 'opp-rising');
        expect(opp).toBeDefined();
        expect(opp?.description).toContain('NewStar');
    });
});
