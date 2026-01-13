import type { SourceData } from '../pages/SearchSourcesR2';

export type TakeawayType = 'critical' | 'opportunity' | 'insight' | 'info';

export interface KeyTakeaway {
    id: string;
    type: TakeawayType;
    title: string;
    description: string;
    priority: number;
    relatedSources?: string[];
}

// Input needs SourceData fields (metrics + changes) AND quadrant/valueScore
export interface AnalysisSource extends SourceData {
    quadrant?: string;
    valueScore?: number;
}

export const generateKeyTakeaways = (sources: AnalysisSource[]): KeyTakeaway[] => {
    if (!sources || sources.length === 0) {
        return [{
            id: 'no-data',
            type: 'info',
            title: 'Insufficient Data',
            description: 'Not enough data to generate takeaways. Check back after more citations are collected.',
            priority: 1
        }];
    }

    const candidates: KeyTakeaway[] = [];

    // --- Helpers ---
    const validSources = sources.filter(s => s.name && s.type);
    const total = validSources.length;
    if (total === 0) return [];

    const avgSentiment = validSources.reduce((sum, s) => sum + s.sentiment, 0) / total;

    // Quadrant Counts
    const quadrants = {
        priority: 0,
        reputation: 0,
        growth: 0,
        monitor: 0
    };

    validSources.forEach(s => {
        if (s.quadrant && s.quadrant !== '—') {
            const q = s.quadrant.toLowerCase();
            if (q === 'priority') quadrants.priority++;
            else if (q === 'reputation') quadrants.reputation++;
            else if (q === 'growth') quadrants.growth++;
            else if (q === 'monitor') quadrants.monitor++;
        }
    });

    // --- Analyzers ---

    // 1. Overall Health Summary (Always)
    let healthLabel = 'Moderate';
    if (avgSentiment >= 80) healthLabel = 'Strong';
    else if (avgSentiment < 50) healthLabel = 'Concerning';

    candidates.push({
        id: 'summary-health',
        type: 'info',
        title: 'Snapshot',
        description: `Across ${total} sources, your brand maintains ${healthLabel.toLowerCase()} sentiment (Avg: ${Math.round(avgSentiment)}).`,
        priority: 5
    });

    // 2. Quadrant Dominance
    const dominantThreshold = 0.4; // 40%

    if (quadrants.priority / total > dominantThreshold) {
        candidates.push({
            id: 'dom-priority',
            type: 'insight',
            title: 'Strong Visibility',
            description: `${Math.round((quadrants.priority / total) * 100)}% of your sources are 'Priority Partnerships', indicating strong all-around performance.`,
            priority: 5
        });
    } else if (quadrants.reputation / total > dominantThreshold) {
        candidates.push({
            id: 'dom-reputation',
            type: 'critical',
            title: 'Reputation Risk',
            description: `${Math.round((quadrants.reputation / total) * 100)}% of sources are in 'Reputation Management', meaning high visibility but lower sentiment/citations.`,
            priority: 6
        });
    } else if (quadrants.growth / total > dominantThreshold) {
        candidates.push({
            id: 'dom-growth',
            type: 'opportunity',
            title: 'Growth Potential',
            description: `${Math.round((quadrants.growth / total) * 100)}% of sources are 'Growth Opportunities'. You have good sentiment but need more visibility.`,
            priority: 6
        });
    }

    // 3. Issue: High Value, Negative Sentiment
    const negSentimentSources = validSources
        .filter(s => (s.valueScore || 0) > 60 && s.sentiment < 40)
        .sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0));

    if (negSentimentSources.length > 0) {
        const names = negSentimentSources.slice(0, 2).map(s => s.name).join(', ');
        candidates.push({
            id: 'issue-sentiment',
            type: 'critical',
            title: 'Negative Sentiment',
            description: `High-impact sources like ${names} show negative sentiment. Prioritize reputation management here.`,
            priority: 10,
            relatedSources: negSentimentSources.map(s => s.name)
        });
    }

    // 4. Issue: Dropping Visibility
    const droppingSources = validSources
        .filter(s => s.mentionChange < -10)
        .sort((a, b) => a.mentionChange - b.mentionChange); // Most negative first

    if (droppingSources.length > 0) {
        const names = droppingSources.slice(0, 2).map(s => s.name).join(', ');
        candidates.push({
            id: 'issue-visibility',
            type: 'critical',
            title: 'Declining Visibility',
            description: `Visibility is dropping on: ${names}. Mentions decreased significantly this period.`,
            priority: 9,
            relatedSources: droppingSources.map(s => s.name)
        });
    }

    // 5. Issue: High Visibility, Low SOA (Conversion Gap)
    const gapSources = validSources
        .filter(s => s.mentionRate > 40 && s.soa < 15)
        .sort((a, b) => b.mentionRate - a.mentionRate);

    if (gapSources.length > 0) {
        const names = gapSources.slice(0, 2).map(s => s.name).join(', ');
        candidates.push({
            id: 'issue-conversion',
            type: 'critical',
            title: 'Conversion Gap',
            description: `High mention rate but low Share of Answer on: ${names}. Review content alignment to improve citations.`,
            priority: 8,
            relatedSources: gapSources.map(s => s.name)
        });
    }

    // 6. Opportunity: Rising Stars
    const risingSources = validSources
        .filter(s =>
            (s.quadrant === 'growth' || s.quadrant === 'monitor') &&
            (s.mentionChange > 10 || s.soaChange > 10)
        )
        .sort((a, b) => Math.max(b.mentionChange, b.soaChange) - Math.max(a.mentionChange, a.soaChange));

    if (risingSources.length > 0) {
        const names = risingSources.slice(0, 2).map(s => s.name).join(', ');
        candidates.push({
            id: 'opp-rising',
            type: 'opportunity',
            title: 'Rising Stars',
            description: `Momentum detected: ${names} are showing rapid growth metrics. Consider targeted partnerships.`,
            priority: 9,
            relatedSources: risingSources.map(s => s.name)
        });
    }

    // 7. Opportunity: Sentiment Leaders
    const sentimentLeaders = validSources
        .filter(s => s.sentiment > 85 && s.mentionRate < 30)
        .sort((a, b) => b.sentiment - a.sentiment);

    if (sentimentLeaders.length > 0 && !candidates.some(c => c.id === 'opp-rising')) {
        const names = sentimentLeaders.slice(0, 2).map(s => s.name).join(', ');
        candidates.push({
            id: 'opp-sentiment',
            type: 'opportunity',
            title: 'Sentiment Leaders',
            description: `${names} host positive content but have low visibility. Explore ways to boost traffic.`,
            priority: 7,
            relatedSources: sentimentLeaders.map(s => s.name)
        });
    }

    // 8. Insight: Category Strength
    const byType: Record<string, { sumScore: number, count: number }> = {};
    validSources.forEach(s => {
        if (!byType[s.type]) byType[s.type] = { sumScore: 0, count: 0 };
        byType[s.type].sumScore += (s.valueScore || 0);
        byType[s.type].count++;
    });

    let bestType = '';
    let bestAvg = 0;
    const overallAvgScore = overallAvgScoreCalc(validSources);

    Object.entries(byType).forEach(([type, data]) => {
        const avg = data.sumScore / data.count;
        if (avg > bestAvg && data.count > 1) {
            bestAvg = avg;
            bestType = type;
        }
    });

    if (bestType && overallAvgScore > 0 && bestAvg > overallAvgScore * 1.25) {
        candidates.push({
            id: 'insight-category',
            type: 'insight',
            title: 'Category Strength',
            description: `Your brand performs exceptionally well in '${bestType.charAt(0).toUpperCase() + bestType.slice(1)}' sources compared to other channels.`,
            priority: 6
        });
    }

    // --- Selection Logic ---

    candidates.sort((a, b) => b.priority - a.priority);

    const finalTakeaways: KeyTakeaway[] = [];

    const critical = candidates.find(c => c.type === 'critical');
    if (critical) {
        finalTakeaways.push(critical);
    } else {
        const topOpp = candidates.find(c => c.type === 'opportunity');
        if (topOpp) finalTakeaways.push(topOpp);
    }

    const nextBest = candidates.find(c => !finalTakeaways.includes(c) && c.type !== 'info');
    if (nextBest) {
        finalTakeaways.push(nextBest);
    }

    const summary = candidates.find(c => c.type === 'info');
    if (summary && finalTakeaways.length < 3) {
        finalTakeaways.push(summary);
    }

    while (finalTakeaways.length < 3) {
        const next = candidates.find(c => !finalTakeaways.includes(c));
        if (!next) break;
        finalTakeaways.push(next);
    }

    return finalTakeaways.slice(0, 4);
};

function overallAvgScoreCalc(sources: AnalysisSource[]) {
    if (!sources.length) return 0;
    return sources.reduce((sum, s) => sum + (s.valueScore || 0), 0) / sources.length;
}
