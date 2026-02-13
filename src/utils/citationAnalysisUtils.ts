import { EnhancedSource, SourceData } from '../types/citation-sources';

export const median = (nums: number[]): number => {
    if (!nums.length) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const percentile = (nums: number[], p: number): number => {
    if (!nums.length) return 0;
    const sorted = [...nums].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
    return sorted[idx];
};

export const valueScoreForSource = (
    src: SourceData,
    maxCitations: number,
    maxTopics: number,
    maxSentiment: number
): number => {
    const sentimentNorm = maxSentiment > 0 ? Math.min(100, (src.sentiment / maxSentiment) * 100) : 0;
    const citationsNorm = maxCitations > 0 ? (src.citations / maxCitations) * 100 : 0;
    const topicsNorm = maxTopics > 0 ? (src.topics.length / maxTopics) * 100 : 0;
    return (
        src.mentionRate * 0.3 +
        src.soa * 0.3 +
        sentimentNorm * 0.2 +
        citationsNorm * 0.1 +
        topicsNorm * 0.1
    );
};

export const classifyQuadrant = (
    mention: number,
    soa: number,
    sentiment: number,
    citations: number,
    thresholds: {
        mentionMedian: number;
        soaMedian: number;
        sentimentMedian: number;
        citationsMedian: number;
        compositeMedian: number;
        compositeTopQuartile: number;
    },
    maxCitations: number,
    maxSentiment: number
): EnhancedSource['quadrant'] => {
    const mentionNorm = mention / 100;
    const soaNorm = soa / 100;
    // Use raw sentiment value, normalize relative to max sentiment in dataset
    const sentimentNorm = maxSentiment > 0 ? Math.min(1, sentiment / maxSentiment) : 0;
    const citationsNorm = maxCitations > 0 ? citations / maxCitations : 0;

    const compositeScore =
        mentionNorm * 0.35 +
        soaNorm * 0.35 +
        sentimentNorm * 0.2 +
        citationsNorm * 0.1;

    const visibilityStrong = mention >= thresholds.mentionMedian;
    const soaStrong = soa >= thresholds.soaMedian;
    const sentimentPositive = sentimentNorm >= thresholds.sentimentMedian;
    const citationsStrong = citationsNorm >= thresholds.citationsMedian;
    // const compositeStrong = compositeScore >= thresholds.compositeTopQuartile;
    const compositeHealthy = compositeScore >= thresholds.compositeMedian;
    const compositeStrong = compositeScore >= thresholds.compositeTopQuartile;

    if (visibilityStrong && soaStrong && compositeStrong) return 'priority';
    if (visibilityStrong && (!sentimentPositive || !citationsStrong)) return 'reputation';
    if (!visibilityStrong && (sentimentPositive || citationsStrong) && compositeHealthy) return 'growth';
    return 'monitor';
};

export const normalizeDomain = (value: string | null | undefined): string => {
    if (!value) return '';
    const raw = value.trim().toLowerCase();
    if (!raw) return '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        try {
            return new URL(raw).hostname.replace(/^www\./, '');
        } catch {
            return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        }
    }
    return raw.replace(/^www\./, '').split('/')[0];
};

export const computeEnhancedSources = (sourceData: SourceData[]): EnhancedSource[] => {
    if (!sourceData.length) return [];

    const maxCitations = Math.max(...sourceData.map((s) => s.citations), 1);
    const maxTopics = Math.max(...sourceData.map((s) => s.topics.length), 1);
    const maxSentiment = Math.max(...sourceData.map((s) => s.sentiment), 1);
    const mentionMedian = median(sourceData.map((s) => s.mentionRate));
    const soaMedian = median(sourceData.map((s) => s.soa));
    const sentimentMedian = median(sourceData.map((s) => (maxSentiment > 0 ? s.sentiment / maxSentiment : 0)));
    const citationsMedian = median(sourceData.map((s) => (maxCitations > 0 ? s.citations / maxCitations : 0)));

    const compositeScores = sourceData.map((s) => {
        const mentionNorm = s.mentionRate / 100;
        const soaNorm = s.soa / 100;
        const sentimentNorm = maxSentiment > 0 ? Math.min(1, s.sentiment / maxSentiment) : 0;
        const citationsNorm = maxCitations > 0 ? s.citations / maxCitations : 0;
        return mentionNorm * 0.35 + soaNorm * 0.35 + sentimentNorm * 0.2 + citationsNorm * 0.1;
    });

    const compositeMedian = median(compositeScores);
    const compositeTopQuartile = percentile(compositeScores, 75);

    return sourceData.map((s) => {
        const valueScore = valueScoreForSource(s, maxCitations, maxTopics, maxSentiment);
        return {
            name: s.name,
            type: s.type,
            mentionRate: s.mentionRate,
            soa: s.soa,
            sentiment: s.sentiment,
            citations: s.citations,
            topPages: s.topPages,
            valueScore,
            quadrant: classifyQuadrant(
                s.mentionRate,
                s.soa,
                s.sentiment,
                s.citations,
                {
                    mentionMedian,
                    soaMedian,
                    sentimentMedian,
                    citationsMedian,
                    compositeMedian,
                    compositeTopQuartile
                },
                maxCitations,
                maxSentiment
            )
        };
    });
};
