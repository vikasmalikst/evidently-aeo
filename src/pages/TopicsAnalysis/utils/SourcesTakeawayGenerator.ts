import { Topic, TopicsAnalysisData } from '../types';

export type TakeawayType = 'summary' | 'issue' | 'opportunity' | 'insight';
export type SentimentType = 'positive' | 'neutral' | 'negative';

export interface Takeaway {
    id: string;
    type: TakeawayType;
    title: string;
    description: string;
    metric?: {
        label: string;
        value: string | number;
        trend?: 'up' | 'down' | 'neutral';
        color?: SentimentType;
    };
    relatedTopicId?: string;
    score: number;
}

export const generateKeyTakeaways = (data: TopicsAnalysisData, metricType: 'share' | 'visibility' | 'sentiment' = 'share'): Takeaway[] => {
    const { topics, performance, portfolio } = data;
    const takeaways: Takeaway[] = [];

    if (!topics || topics.length === 0) {
        return [{
            id: 'no-data',
            type: 'summary',
            title: 'No Data Available',
            description: 'Once you add topics and data is collected, key insights will appear here.',
            score: 100
        }];
    }

    // --- SHARE OF ANSWER (Default) ---
    if (metricType === 'share') {
        const validTopics = topics.filter(t => t.currentSoA !== undefined);
        const avgSoAPercent = validTopics.length > 0
            ? validTopics.reduce((sum, t) => sum + (t.currentSoA || 0), 0) / validTopics.length
            : 0;

        const industryTopics = topics.filter(t => t.industryAvgSoA !== null && t.industryAvgSoA !== undefined);
        const avgIndustrySoAPercent = industryTopics.length > 0
            ? (industryTopics.reduce((sum, t) => sum + (t.industryAvgSoA || 0), 0) / industryTopics.length) * 20
            : 0;

        const gap = avgSoAPercent - avgIndustrySoAPercent;
        let summaryTitle = '';
        let summaryDesc = '';

        if (industryTopics.length === 0) {
            summaryTitle = `You have ${portfolio.totalTopics} active topics`;
            summaryDesc = `Your average Share of Answer is ${avgSoAPercent.toFixed(1)}%.`;
        } else if (gap > 5) {
            summaryTitle = 'Leading the Industry';
            summaryDesc = `Your Share of Answer (${avgSoAPercent.toFixed(1)}%) is higher than the competitor average (${avgIndustrySoAPercent.toFixed(1)}%).`;
        } else if (gap < -5) {
            summaryTitle = 'Trailing Competitors';
            summaryDesc = `Your Share of Answer (${avgSoAPercent.toFixed(1)}%) is below the competitor average (${avgIndustrySoAPercent.toFixed(1)}%).`;
        } else {
            summaryTitle = 'Competitive Performance';
            summaryDesc = `Your Share of Answer (${avgSoAPercent.toFixed(1)}%) is in line with the competitor average (${avgIndustrySoAPercent.toFixed(1)}%).`;
        }

        takeaways.push({
            id: 'summary-soa',
            type: 'summary',
            title: summaryTitle,
            description: summaryDesc,
            metric: {
                label: 'Avg SoA',
                value: `${avgSoAPercent.toFixed(1)}%`,
                color: gap > 0 ? 'positive' : (gap < -5 ? 'negative' : 'neutral')
            },
            score: 1000
        });

        // Issues: Drop
        const droppingTopics = topics.filter(t => t.trend.delta <= -10);
        droppingTopics.forEach(t => {
            takeaways.push({
                id: `issue-drop-${t.id}`,
                type: 'issue',
                title: `Share of Answer Drop: ${t.name}`,
                description: `SoA decreased by ${Math.abs(t.trend.delta).toFixed(1)}% this period.`,
                relatedTopicId: t.id,
                metric: {
                    label: 'Drop',
                    value: `${t.trend.delta.toFixed(1)}%`,
                    trend: 'down',
                    color: 'negative'
                },
                score: 850 + Math.abs(t.trend.delta)
            });
        });

        // Opportunities: Competitor Gaps
        topics.forEach(t => {
            if (t.industryAvgSoA !== null && t.industryAvgSoA !== undefined) {
                const indSoAPercent = t.industryAvgSoA * 20;
                const mySoA = t.currentSoA || 0;
                const gap = indSoAPercent - mySoA;

                if (gap >= 15) {
                    takeaways.push({
                        id: `opp-gap-${t.id}`,
                        type: 'opportunity',
                        title: `Competitor Lead: ${t.name}`,
                        description: `Competitors avg ${indSoAPercent.toFixed(1)}% vs your ${mySoA.toFixed(1)}%.`,
                        relatedTopicId: t.id,
                        metric: {
                            label: 'Gap',
                            value: `-${gap.toFixed(1)}%`,
                            color: 'neutral'
                        },
                        score: 600 + gap
                    });
                }
            }
        });

        // Insight: Dominance
        const dominantTopics = topics.filter(t => {
            if (!t.industryAvgSoA) return false;
            const indSoAPercent = t.industryAvgSoA * 20;
            return (t.currentSoA || 0) > 50 && ((t.currentSoA || 0) - indSoAPercent > 10);
        });
        dominantTopics.forEach(t => {
            takeaways.push({
                id: `win-dom-${t.id}`,
                type: 'insight',
                title: `Dominating: ${t.name}`,
                description: `You have ${(t.currentSoA || 0).toFixed(1)}% SoA, well above the competition.`,
                relatedTopicId: t.id,
                score: 400
            });
        });
    }

    // --- VISIBILITY ---
    else if (metricType === 'visibility') {
        const validTopics = topics.filter(t => t.currentVisibility !== null && t.currentVisibility !== undefined);
        const avgVis = validTopics.length > 0
            ? validTopics.reduce((sum, t) => sum + (t.currentVisibility || 0), 0) / validTopics.length
            : 0;

        const industryTopics = topics.filter(t => t.industryAvgVisibility !== null && t.industryAvgVisibility !== undefined);
        const avgIndVis = industryTopics.length > 0
            ? industryTopics.reduce((sum, t) => sum + (t.industryAvgVisibility || 0), 0) / industryTopics.length
            : 0;

        const gap = avgVis - avgIndVis;

        let summaryTitle = '';
        if (industryTopics.length === 0) summaryTitle = 'Visibility Overview';
        else if (gap > 5) summaryTitle = 'High Visibility';
        else if (gap < -5) summaryTitle = 'Low Visibility';
        else summaryTitle = 'Average Visibility';

        takeaways.push({
            id: 'summary-vis',
            type: 'summary',
            title: summaryTitle,
            description: `Your average visibility score is ${Math.round(avgVis)}/100${industryTopics.length > 0 ? `, compared to industry avg of ${Math.round(avgIndVis)}/100` : ''}.`,
            metric: {
                label: 'Avg Visibility',
                value: Math.round(avgVis),
                color: gap > 0 ? 'positive' : (gap < -5 ? 'negative' : 'neutral')
            },
            score: 1000
        });

        const invisibleTopics = topics.filter(t => (t.currentVisibility || 0) < 10);
        if (invisibleTopics.length > 0) {
            takeaways.push({
                id: 'issue-invisible',
                type: 'issue',
                title: `${invisibleTopics.length} Topics with Critical Visibility`,
                description: `These topics have a visibility score below 10. Consider content optimization.`,
                score: 900
            });
        }

        const mediumVisTopics = topics.filter(t => (t.currentVisibility || 0) >= 30 && (t.currentVisibility || 0) <= 60);
        mediumVisTopics.slice(0, 2).forEach(t => {
            takeaways.push({
                id: `opp-vis-${t.id}`,
                type: 'opportunity',
                title: `Growth Potential: ${t.name}`,
                description: `Visibility is moderate (${Math.round(t.currentVisibility || 0)}). Improvements could push this into high visibility.`,
                score: 600
            });
        });

        const topVisTopics = topics.filter(t => (t.currentVisibility || 0) > 80);
        topVisTopics.slice(0, 2).forEach(t => {
            takeaways.push({
                id: `win-vis-${t.id}`,
                type: 'insight',
                title: `Highly Visible: ${t.name}`,
                description: `You are extremely visible for this topic (Score: ${Math.round(t.currentVisibility || 0)}).`,
                score: 400
            });
        });
    }

    // --- SENTIMENT ---
    else if (metricType === 'sentiment') {
        const validTopics = topics.filter(t => t.currentSentiment !== null && t.currentSentiment !== undefined);
        const avgSent = validTopics.length > 0
            ? validTopics.reduce((sum, t) => sum + (t.currentSentiment || 0), 0) / validTopics.length
            : 0;

        let sentimentLabel = 'Neutral';
        if (avgSent > 60) sentimentLabel = 'Positive';
        if (avgSent < 40) sentimentLabel = 'Negative';

        takeaways.push({
            id: 'summary-sent',
            type: 'summary',
            title: `${sentimentLabel} Overall Sentiment`,
            description: `Your average sentiment score is ${Math.round(avgSent)}/100.`,
            metric: {
                label: 'Avg Sentiment',
                value: Math.round(avgSent),
                color: avgSent > 60 ? 'positive' : (avgSent < 40 ? 'negative' : 'neutral')
            },
            score: 1000
        });

        const negativeTopics = topics.filter(t => (t.currentSentiment || 0) < 40);
        negativeTopics.forEach(t => {
            takeaways.push({
                id: `issue-sent-${t.id}`,
                type: 'issue',
                title: `Negative Sentiment: ${t.name}`,
                description: `Sentiment is low (${Math.round(t.currentSentiment || 0)}). Investigate coverage.`,
                relatedTopicId: t.id,
                score: 950 - (t.currentSentiment || 0)
            });
        });

        const perfectTopics = topics.filter(t => (t.currentSentiment || 0) > 90);
        if (perfectTopics.length > 0) {
            takeaways.push({
                id: 'win-sent-perfect',
                type: 'insight',
                title: `${perfectTopics.length} Topics with Excellent Sentiment`,
                description: `You have exceptionally positive coverage (>90) in these topics.`,
                score: 500
            });
        }
    }

    // Weekly Gainer (Global)
    if (performance.weeklyGainer && performance.weeklyGainer.delta > 5) {
        takeaways.push({
            id: 'win-gainer',
            type: 'insight',
            title: `Top Gainer: ${performance.weeklyGainer.topic}`,
            description: `Biggest share increase: +${performance.weeklyGainer.delta.toFixed(1)}%.`,
            relatedTopicId: topics.find(t => t.name === performance.weeklyGainer.topic)?.id,
            metric: {
                label: 'Gain',
                value: `+${performance.weeklyGainer.delta.toFixed(1)}%`,
                trend: 'up',
                color: 'positive'
            },
            score: 300
        });
    }

    return takeaways.sort((a, b) => b.score - a.score);
};
