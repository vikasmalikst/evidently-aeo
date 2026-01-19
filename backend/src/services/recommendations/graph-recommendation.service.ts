
import Graph from 'graphology';
import { Attributes } from 'graphology-types';
// @ts-ignore
import pagerank from 'graphology-pagerank';
// @ts-ignore
import louvain from 'graphology-communities-louvain';
import { ConsolidatedAnalysisResult } from '../scoring/consolidated-analysis.service';

/**
 * GRAPH RECOMMENDATION SERVICE
 * 
 * Implementation of Phase 7: Knowledge Graph for Recommendation Engine.
 * Transforms linear analysis results into a network graph to identify 
 * centrality (PageRank) and narrative clusters (Louvain).
 */

// =====================================
// 1. Schema Definitions
// =====================================

export enum NodeType {
    BRAND = 'BRAND',
    PRODUCT = 'PRODUCT',
    COMPETITOR = 'COMPETITOR',
    TOPIC = 'TOPIC',
    SENTIMENT = 'SENTIMENT'
}

export enum EdgeType {
    HAS_ATTRIBUTE = 'HAS_ATTRIBUTE', // Product -> Topic
    COMPETES_WITH = 'COMPETES_WITH', // Product -> Competitor
    LEADS_TO = 'LEADS_TO',           // Topic -> Sentiment
    MENTIONED_WITH = 'MENTIONED_WITH' // Brand -> Product
}

export interface NodeAttributes extends Attributes {
    type: NodeType;
    label: string;
    centralityScore?: number;
    communityId?: number;
}

export interface EdgeAttributes extends Attributes {
    type: EdgeType;
    weight: number;
    evidence_quotes: string[]; // Store quotes as evidence
    source_id?: number; // Collector result ID
}

export interface GraphInsight {
    type: 'opportunity_gap' | 'toxicity' | 'battleground' | 'strength';
    topic: string;
    score: number;
    evidence: string[];
    context: string;
}

// =====================================
// 2. Service Implementation
// =====================================

export class GraphRecommendationService {
    private graph: Graph<NodeAttributes, EdgeAttributes>;

    constructor() {
        this.graph = new Graph({ type: 'directed', allowSelfLoops: false, multi: false });
    }

    /**
     * Main Entry Point: Ingest Data and Build Graph
     * @param analysisResults Array of Consolidated Analysis Results combined with metadata
     */
    public buildGraph(
        brandName: string,
        results: Array<{
            id: number;
            analysis: ConsolidatedAnalysisResult;
            competitorNames: string[]
        }>
    ): void {
        this.graph.clear();
        console.log(`[GraphService] Building graph for ${brandName} from ${results.length} results...`);

        // 1. Create Root Brand Node
        this.ensureNode(brandName, NodeType.BRAND);

        // 2. Create Sentiment Nodes (The Attractors)
        this.ensureNode('POSITIVE', NodeType.SENTIMENT);
        this.ensureNode('NEGATIVE', NodeType.SENTIMENT);
        this.ensureNode('MIXED', NodeType.SENTIMENT);

        for (const result of results) {
            if (!result.analysis) {
                console.warn(`[GraphService] Skipping result ${result.id} - Analysis object missing`);
                continue;
            }
            this.processResult(brandName, result);
        }

        console.log(`[GraphService] Graph Built: ${this.graph.order} nodes, ${this.graph.size} edges.`);
    }

    /**
     * Process a single analysis result into nodes and edges
     */
    private processResult(brandName: string, item: { id: number; analysis: ConsolidatedAnalysisResult; competitorNames: string[] }) {
        const { analysis, id } = item;
        console.log(`[GraphService] Processing Result ${id}: Keywords=${analysis.keywords?.length || 0}, Products=${analysis.products?.brand?.length || 0}`);
        if (analysis.keywords && !Array.isArray(analysis.keywords)) {
            console.warn(`[GraphService] WARN: Keywords is not an array for result ${id}:`, analysis.keywords);
        }

        // A. Process Products
        const products = analysis.products?.brand || [];
        for (const prod of products) {
            this.ensureNode(prod, NodeType.PRODUCT);
            this.ensureEdge(brandName, prod, EdgeType.MENTIONED_WITH, id);
        }

        // B. Process Keywords (Topics) with Sentiment
        // We assume keywords are linked to the general sentiment of the answer if not specific
        // In a real advanced version, we'd look for specific Keyword->Sentiment mapping.
        // For now, we use the Brand Sentiment to influence the Keyword edges.

        // Determine dominant brand sentiment for this result
        let sentimentNode = 'MIXED';
        if (analysis.sentiment?.brand?.label) {
            sentimentNode = analysis.sentiment.brand.label;
        }

        const keywords = analysis.keywords || [];
        for (const kw of keywords) {
            const topicLabel = kw.keyword;
            this.ensureNode(topicLabel, NodeType.TOPIC);

            // Edge 1: Product -> Topic (if products exist)
            for (const prod of products) {
                this.ensureEdge(prod, topicLabel, EdgeType.HAS_ATTRIBUTE, id);
            }

            // Edge 2: Brand -> Topic (if no products, link directly to brand)
            if (products.length === 0) {
                this.ensureEdge(brandName, topicLabel, EdgeType.HAS_ATTRIBUTE, id);
            }

            // Edge 3: Topic -> Sentiment
            // Filter quotes for Brand or generic (no entity)
            const brandQuotes = analysis.quotes?.filter(q => !q.entity || q.entity === brandName || q.entity === 'Brand').map(q => q.text) || [];
            this.ensureEdge(topicLabel, sentimentNode, EdgeType.LEADS_TO, id, brandQuotes);
        }

        // C. Process Competitors
        for (const compName of item.competitorNames) {
            this.ensureNode(compName, NodeType.COMPETITOR);

            // Competitor -> Sentiment
            let compSentiment = 'MIXED';
            if (analysis.sentiment?.competitors?.[compName]?.label) {
                compSentiment = analysis.sentiment.competitors[compName].label;
            }

            // Link Competitor to their Sentiment
            // We don't link Competitor -> Topic unless we have specific competitor data
            // For now, if the topic appeared in a result mentioning the competitor, we create a weak link?
            // MVP Strategy: Link Competitor to Topics found in the same answer? 
            // YES,co-occurrence implies connection.
            const compQuotes = analysis.quotes?.filter(q => q.entity === compName).map(q => q.text) || [];

            for (const kw of keywords) {
                this.ensureEdge(compName, kw.keyword, EdgeType.HAS_ATTRIBUTE, id);
                this.ensureEdge(kw.keyword, compSentiment, EdgeType.LEADS_TO, id, compQuotes); // Topic leads to competitor sentiment too
            }
        }
    }

    /**
     * Helper: Ensure Node Exists
     */
    private ensureNode(key: string, type: NodeType) {
        if (!key) return;
        if (!this.graph.hasNode(key)) {
            this.graph.addNode(key, {
                type,
                label: key,
                centralityScore: 0
            });
        }
    }

    /**
     * Helper: Ensure Edge Exists or Update Weight
     */
    private ensureEdge(source: string, target: string, type: EdgeType, sourceId: number, quotes: string[] = []) {
        if (!source || !target) return;
        if (source === target) return; // Prevent self-loops
        if (!this.graph.hasNode(source) || !this.graph.hasNode(target)) return;

        // In a multi-graph, we can add multiple edges.
        // But for weight calculation, simple graphs are easier.
        // Let's use specific edge keys if we want multi, or update weight if simple.
        // Strategy: Simple Directed Graph with Weight.

        // Key = Source->Target
        // If exists, increment weight and append quotes
        if (this.graph.hasEdge(source, target)) {
            this.graph.updateEdgeAttribute(source, target, 'weight', (w: unknown) => ((w as number) || 0) + 1);
            if (quotes.length > 0) {
                this.graph.updateEdgeAttribute(source, target, 'evidence_quotes', (existingQuotes: unknown) => {
                    return [...((existingQuotes as string[]) || []), ...quotes].slice(0, 5); // Keep top 5 latest
                });
            }
        } else {
            this.graph.addEdge(source, target, {
                type,
                weight: 1,
                evidence_quotes: quotes,
                source_id: sourceId
            });
        }
    }

    // =====================================
    // 3. Algorithms
    // =====================================

    public runAlgorithms() {
        console.log('[GraphService] Running PageRank...');
        const ranks = pagerank(this.graph);

        // Update nodes with centrality
        for (const [node, score] of Object.entries(ranks)) {
            this.graph.setNodeAttribute(node, 'centralityScore', score as number);
        }

        console.log('[GraphService] Running Louvain Community Detection...');
        const communities: any = louvain(this.graph);

        // Update nodes with community ID
        for (const [node, communityId] of Object.entries(communities)) {
            this.graph.setNodeAttribute(node, 'communityId', communityId as number);
        }
    }

    // =====================================
    // 4. Queries (The 3 Insights)
    // =====================================

    /**
     * Insight 1: The Opportunity Gap
     * Logic: Topics where Competitor -> Negative is Strong, but Brand -> Negative is Weak/None.
     */
    public getOpportunityGaps(competitorName: string): GraphInsight[] {
        const gaps: GraphInsight[] = [];

        // iterating all topics
        this.graph.forEachNode((node, attr) => {
            if (attr.type !== NodeType.TOPIC) return;

            // Check Connection to Competitor
            if (!this.graph.hasEdge(competitorName, node)) return;

            // Check Path: Competitor -> Topic -> Negative
            const compNegWeight = this.getPathWeight(competitorName, node, 'NEGATIVE');

            if (compNegWeight > 0) {
                // High Opportunity!
                // Retrieve evidence
                const evidence = this.getEvidence(node, 'NEGATIVE');

                gaps.push({
                    type: 'opportunity_gap',
                    topic: node,
                    score: compNegWeight * (attr.centralityScore || 1), // Weight by centrality
                    evidence: evidence,
                    context: `${competitorName} is failing at ${node}`
                });
            }
        });

        return gaps.sort((a, b) => b.score - a.score).slice(0, 3);
    }
    /**
     * Insight 2: Battlegrounds
     * Logic: Topics where BOTH Brand and Competitor have significant presence.
     */
    public getBattlegrounds(brandName: string, competitorName: string): GraphInsight[] {
        const battlegrounds: GraphInsight[] = [];

        this.graph.forEachNode((node, attr) => {
            if (attr.type !== NodeType.TOPIC) return;

            // Must be connected to BOTH
            if (!this.graph.hasEdge(brandName, node) || !this.graph.hasEdge(competitorName, node)) return;

            // Calculate contention score (sum of weights)
            const brandWeight = this.graph.getEdgeAttribute(brandName, node, 'weight');
            const compWeight = this.graph.getEdgeAttribute(competitorName, node, 'weight');
            const contentionScore = (brandWeight + compWeight) * (attr.centralityScore || 1);

            battlegrounds.push({
                type: 'battleground',
                topic: node,
                score: contentionScore,
                evidence: [], // Could fetch evidence from both
                context: `High contention topic between ${brandName} and ${competitorName}`
            });
        });

        return battlegrounds.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    /**
     * Insight 3: Competitor Strongholds (Envy)
     * Logic: Topics where Competitor -> Topic -> Positive is strong.
     */
    public getCompetitorStrongholds(competitorName: string): GraphInsight[] {
        const strongholds: GraphInsight[] = [];

        this.graph.forEachNode((node, attr) => {
            if (attr.type !== NodeType.TOPIC) return;

            if (!this.graph.hasEdge(competitorName, node)) return;

            // Check Path: Competitor -> Topic -> POSITIVE
            const compPosWeight = this.getPathWeight(competitorName, node, 'POSITIVE');

            if (compPosWeight > 0) {
                const evidence = this.getEvidence(node, 'POSITIVE');
                strongholds.push({
                    type: 'strength',
                    topic: node,
                    score: compPosWeight * (attr.centralityScore || 1),
                    evidence: evidence,
                    context: `${competitorName} is dominating ${node} with positive sentiment`
                });
            }
        });

        return strongholds.sort((a, b) => b.score - a.score).slice(0, 3);
    }

    /**
     * Insight 4: Keyword Quadrant Data
     * Returns flattened data for UI Visualization (Sentiment vs Strength)
     */
    public getKeywordQuadrantData(): Array<{ topic: string; sentiment: number; strength: number; narrative: string }> {
        const data: Array<{ topic: string; sentiment: number; strength: number; narrative: string }> = [];

        // Find max centrality to normalize
        let maxCentrality = 0;
        this.graph.forEachNode((node, attr) => {
            if (attr.type === NodeType.TOPIC && attr.centralityScore) {
                if (attr.centralityScore > maxCentrality) maxCentrality = attr.centralityScore;
            }
        });

        this.graph.forEachNode((node, attr) => {
            if (attr.type !== NodeType.TOPIC) return;

            // Calculate Sentiment Score (-1 to 1)
            const posWeight = this.graph.hasEdge(node, 'POSITIVE') ? this.graph.getEdgeAttribute(node, 'POSITIVE', 'weight') : 0;
            const negWeight = this.graph.hasEdge(node, 'NEGATIVE') ? this.graph.getEdgeAttribute(node, 'NEGATIVE', 'weight') : 0;

            let sentimentScore = 0;
            const total = posWeight + negWeight;
            if (total > 0) {
                // Formula: (Pos - Neg) / Total => Range [-1, 1]
                sentimentScore = (posWeight - negWeight) / total;
                // Scale to -100 to 100 for UI
                sentimentScore = Math.round(sentimentScore * 100);
            }

            // Strength = Normalized Centrality (0-100)
            const rawScore = attr.centralityScore || 0;
            const strength = maxCentrality > 0 ? Math.round((rawScore / maxCentrality) * 100) : 0;

            data.push({
                topic: node,
                sentiment: sentimentScore,
                strength: strength,
                narrative: attr.communityId ? `Narrative ${attr.communityId}` : 'General'
            });
        });

        // Sort by strength descending
        return data.sort((a, b) => b.strength - a.strength);
    }
    /**
     * Insight 4: Source Toxicity Score
     * (Placeholder - requires Source Nodes which we haven't implemented fully yet)
     */
    public getSourceToxicity(): any {
        // TODO: Implement with Source Nodes
        return {};
    }

    // Helpers
    private getPathWeight(start: string, mid: string, end: string): number {
        if (this.graph.hasEdge(mid, end)) { // Topic -> Sentiment
            return this.graph.getEdgeAttribute(mid, end, 'weight');
        }
        return 0;
    }

    private getEvidence(topic: string, sentiment: string): string[] {
        if (this.graph.hasEdge(topic, sentiment)) {
            return this.graph.getEdgeAttribute(topic, sentiment, 'evidence_quotes') || [];
        }
        return [];
    }
}

export const graphRecommendationService = new GraphRecommendationService();
