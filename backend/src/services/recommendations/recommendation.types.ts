
import { CompetitorExclusionList } from './competitor-filter.service';
import { AeoAuditResult } from '../domain-readiness/types';

/**
 * Identified KPI for a brand
 */
export interface IdentifiedKPI {
    id?: string;              // Database id (present when loaded from DB)
    kpiName: string;          // e.g., "Visibility Index", "SOA %", "Sentiment Score"
    kpiDescription: string;    // Why this KPI matters for this brand
    currentValue?: number;     // Current KPI value
    targetValue?: number;      // Target/improved value
    displayOrder: number;      // Order in which KPIs should be displayed
}

/**
 * Recommendation for V3 (simplified structure)
 */
export interface RecommendationV3 {
    id?: string;
    action: string;           // What to do
    citationSource: string;   // Source/domain
    focusArea: 'visibility' | 'soa' | 'sentiment';
    priority: 'High' | 'Medium' | 'Low';
    effort: 'Low' | 'Medium' | 'High';
    kpiId?: string;           // Links to identified KPI
    kpi?: string;             // KPI name (for display)

    // Additional fields (stored but not shown in simplified table)
    reason?: string;
    explanation?: string;
    impactScore?: string;
    mentionRate?: string;
    soa?: string;
    sentiment?: string;
    visibilityScore?: string;
    citationCount?: number;
    focusSources?: string;
    contentFocus?: string;
    expectedBoost?: string;
    timeline?: string;
    confidence?: number;
    calculatedScore?: number; // Deterministic ranking score (stored in DB as calculated_score)

    // Workflow flags
    isApproved?: boolean;
    isContentGenerated?: boolean;
    isCompleted?: boolean;
    completedAt?: string;
    kpiBeforeValue?: number;
    kpiAfterValue?: number;

    // Target competitors for this recommendation
    competitors_target?: string[];
    howToFix?: string[];  // Step-by-step fix instructions (for domain audit recs)
    assetType?: string;   // Content Asset Type (e.g. 'article', 'short_video')

    // Strategic classification (filled by ranking service)
    strategicRole?: 'Battleground' | 'Stronghold' | 'Opportunity' | 'Standard';
}

/**
 * Response from V3 recommendation service
 */
export interface RecommendationV3Response {
    success: boolean;
    generationId?: string;
    dataMaturity?: 'cold_start' | 'low_data' | 'normal';
    kpis: IdentifiedKPI[];
    recommendations: RecommendationV3[];
    message?: string;
    generatedAt?: string;
    brandId?: string;
    brandName?: string;
}

/**
 * Brand context for KPI identification
 */
export interface BrandContextV3 {
    brandId: string;
    brandName: string;
    brandDomain?: string;      // Brand's own domain (for competitor filter whitelist)
    brandSummary?: string;
    industry?: string;
    visibilityIndex?: number;
    shareOfAnswers?: number;
    sentimentScore?: number;
    trends?: {
        visibility?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
        soa?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
        sentiment?: { current: number; previous: number; changePercent: number; direction: 'up' | 'down' | 'stable' };
    };
    competitors?: Array<{
        name: string;
        visibilityIndex?: number;
        shareOfAnswers?: number;
        sentimentScore?: number;
    }>;
    sourceMetrics?: Array<{
        domain: string;
        mentionRate: number;
        soa: number;
        sentiment: number;
        citations: number;
        impactScore: number;
        visibility: number;
        topCompetitor?: {
            name: string;
            soa: number;
            sentiment: number;
        };
    }>;
    // Internal fields for competitor filtering (not exposed in prompt)
    _competitorExclusionList?: CompetitorExclusionList;
    _competitorAvgMetrics?: {
        visibility?: number;
        soa?: number;
        sentiment?: number;
        count: number;
    };
    // Internal: data maturity classification (computed)
    _dataMaturity?: 'cold_start' | 'low_data' | 'normal';

    // Domain Readiness Audit Result
    domainAuditResult?: AeoAuditResult | null;

    // Qualitative Context (from Consolidated Analysis)
    topKeywords?: Array<{ keyword: string; count: number }>;
    strategicNarrative?: string;
    keyQuotes?: string[];

    // Phase 7: Graph Insights
    graphInsights?: {
        opportunityGaps: Array<{
            topic: string;
            score: number;
            context: string;
            evidence: string[];
        }>;
        battlegrounds?: Array<{
            topic: string;
            score: number;
            context: string;
        }>;
        competitorStrongholds?: Array<{
            topic: string;
            score: number;
            context: string;
            evidence: string[];
        }>;
    };
}

export type CerebrasChatResponse = {
    choices?: Array<{
        message?: {
            content?: string;
        };
    }>;
};

// ============================================================================
// CONTENT STRATEGY TYPES (FSA Framework v2026.2)
// ============================================================================

/**
 * Supported Section Types for GeneratedContentJsonV4
 * Maps to the "Container + Payload" model in the implementation plan.
 */
export type ContentSectionType =
    | 'summary'              // Executive summary / TL;DR
    | 'context'              // Problem statement / Background
    | 'strategies'           // Key approaches / numbered lists
    | 'case_study'           // Real-world example
    | 'faq'                  // Q&A pairs for featured snippets
    | 'cta'                  // Call to action
    | 'custom'               // Generic fallback
    // New Strategic Asset Types
    | 'comparison_table'     // Structured markdown table (for "vs" queries)
    | 'comparison_table'     // Structured markdown table (for "vs" queries)
    | 'whitepaper_metadata'  // Report metadata (summary, chapters, download link)
    | 'structured_list'      // Timestamped lists (webinar recaps, checklists)
    | 'code_block'           // Technical code/config snippets
    | 'schema_markup';       // JSON-LD schema for SEO

/**
 * Structure Section for Strategy and Template Plans
 */
export interface StructureSection {
    id: string;
    title: string;
    content: string;
    sectionType: string;
}

/**
 * Content Template Type (subset or alias of ContentAssetType)
 */
export type ContentTemplateType = ContentAssetType;

/**
 * Determines the *type of content asset* being generated (the "Payload").
 * This is detected from `recommendation.action`.
 */
export type ContentAssetType =
    | 'article'              // Standard blog/article (default)
    | 'video_script'         // Long-form YouTube script
    | 'short_video'          // YouTube Shorts, Reels, TikTok
    | 'comparison_table'     // Side-by-side comparison
    | 'whitepaper'           // Deep-dive whitepaper or research report
    | 'webinar_recap'        // Event summary with Q&A
    | 'case_study'           // Customer success story template
    | 'linkedin_post'        // Short-form professional post
    | 'reddit_post'          // Community-style conversational post
    | 'expert_community_response' // Detailed response for forums/communities
    | 'podcast'              // Audio script/transcript
    | 'social_media_thread'  // Threaded content (X, LinkedIn)
    | 'other';

/**
 * Represents a single structured section within generated content (v4+).
 */
export interface ContentSection {
    id: string;              // e.g., "executive_summary", "comparison_table_1"
    title: string;           // e.g., "Executive Summary"
    content: string;         // The actual section text or structured data
    sectionType: ContentSectionType;
}



/**
 * Comparison Table output structure.
 */
export interface ComparisonTableData {
    title: string;                  // e.g., "Slack vs Microsoft Teams: Feature Comparison"
    columnHeaders: string[];        // e.g., ["Feature", "Slack", "Microsoft Teams"]
    rows: Array<{
        feature: string;            // e.g., "Free Tier Limit"
        values: string[];           // e.g., ["90 days history", "Unlimited"]
    }>;
    analysisNotes: string;          // Brief summary/recommendation below the table
}

/**
 * Whitepaper / Report metadata output structure.
 */
export interface WhitepaperMetadata {
    title: string;
    subtitle?: string;
    executiveSummary: string;       // 2-3 paragraph summary
    chapters: Array<{
        title: string;
        summary: string;
    }>;
    targetAudience: string;
    estimatedReadTime: string;
}

/**
 * Context File Upload Structure
 */
export interface ContextFile {
    id: string;
    name: string;
    content: string; // The extracted text content
    uploadedAt: string;
    type?: string;
    size?: number;
}

/**
 * Strategy Plan Structure (Step 2 Output)
 */
export interface StrategyPlan {
    recommendationId: string;
    contentType: ContentTemplateType;
    primaryEntity: string;
    targetChannel: string;
    brandContext: {
        name: string;
        competitors?: string[];
    };
    structure: StructureSection[];
    strategicGuidance: {
        keyFocus: string;
        aeoTargets: string[];
        toneGuidelines: string;
        differentiation: string;
    };
    contextFiles?: ContextFile[];
    researchQueries?: string[]; // Legacy support
    additional_context?: string; // For TemplatePlan compatibility if needed
    context_files?: ContextFile[]; // For TemplatePlan compatibility if needed (snake_case)
}

/**
 * Template Plan Structure (Step 1 Output)
 */
export interface TemplatePlan {
    version: string;
    recommendationId: string;
    targetChannel: string;
    content_type: ContentTemplateType;
    primary_entity: string;
    action_description: string;
    aeo_extraction_targets: any;
    structure: any[];
    embedded_placeholders?: {
        fact_pack_slot?: boolean;
        sources_slot?: boolean;
        voice_rules_slot?: boolean;
        banned_claims_slot?: boolean;
    };
    additional_context?: string;
    context_files?: ContextFile[];
}

