/**
 * Recommendation Content Service
 *
 * Generates small, actionable content drafts for a given recommendation and persists them.
 * Uses Cerebras as primary provider and OpenRouter as fallback.
 */

import { supabaseAdmin } from '../../config/database';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { groqCompoundService } from './groq-compound.service';
import {
  detectContentAsset,
  detectPlatform,
  getNewContentPrompt,
  NewContentPromptContext,
  StructureConfig
} from './new-content-factory';
import { mcpSearchService } from '../data-collection/mcp-search.service';
import { BrandContextV3, RecommendationV3, ContentAssetType } from './recommendation.types';

export type RecommendationContentStatus = 'generated' | 'accepted' | 'rejected';
export type RecommendationContentProvider = 'groq' | 'openrouter';

export interface GenerateRecommendationContentRequest {
  contentType?: string; // e.g. 'draft', 'blog_intro', 'faq', 'linkedin_post'
  structureConfig?: StructureConfig;
}

export interface RecommendationContentRecord {
  id: string;
  recommendation_id: string;
  generation_id: string;
  brand_id: string;
  customer_id: string;
  status: RecommendationContentStatus;
  content_type: string;
  content: string;
  model_provider: RecommendationContentProvider;
  model_name: string | null;
  created_at: string;
  updated_at: string;
}

type CerebrasChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

type GeneratedContentJsonV1 = {
  version: '1.0';
  recommendationId: string;
  brandName: string;
  targetSource: {
    domain: string;
    mode: 'post_on_source' | 'pitch_collaboration';
    rationale: string;
  };
  deliverable: {
    type: 'guest_article' | 'expert_quote' | 'faq' | 'product_page_update' | 'press_pitch' | 'other';
    placement: string;
  };
  whatToPublishOrSend: {
    readyToPaste: string; // main copy user can paste or send
    subjectLine?: string; // for pitches
    cta: string;
  };
  keyPoints: string[];
  seoAeo: {
    h1: string;
    h2: string[];
    faq: string[];
    snippetSummary: string;
  };
  requiredInputs: string[];
  complianceNotes: string[];
};

type GeneratedContentJsonV2 = {
  version: '2.0';
  recommendationId: string;
  brandName: string;
  targetSource: {
    domain: string;
    sourceType: 'youtube' | 'article_site' | 'collaboration_target' | 'other';
    mode: 'post_on_source' | 'pitch_collaboration';
    rationale: string;
  };
  // Deprecated: we no longer generate collaboration emails, but keep parsing support
  // for existing stored content.
  collaborationEmail?: {
    subjectLine: string;
    emailBody: string;
    cta: string;
  };
  publishableContent: {
    type: 'article' | 'video_script' | 'faq' | 'other';
    title: string;
    content: string;
    metadata?: {
      // For articles
      h1?: string;
      h2?: string[];
      faq?: string[];
      snippetSummary?: string;
      // For video scripts
      estimatedDuration?: string;
      scenes?: Array<{
        start: string;
        end: string;
        type: string;
        content: string;
      }>;
      keyVisuals?: string[];
      onScreenText?: string[];
    };
  };
  keyPoints: string[];
  requiredInputs: string[];
  complianceNotes: string[];
};

// NEW v3.0 format: Simplified - Publishable Content Only
type GeneratedContentJsonV3 = {
  version: '3.0';
  recommendationId: string;
  brandName: string;
  targetSource: {
    domain: string;
    sourceType: 'reddit' | 'linkedin' | 'dev_to' | 'youtube' | 'article_site' | 'owned_site' | 'other';
  };
  // Ready-to-publish content: THE ACTUAL CONTENT to copy/paste
  publishableContent: {
    type: 'reddit_post' | 'linkedin_post' | 'article' | 'case_study' | 'video_script' | 'blog_post' | 'other';
    title: string;
    content: string;  // The actual post/article ready to use
    callToAction: string;
  };
  requiredInputs: string[];  // [FILL_IN:] markers user needs to complete
};

// NEW v4.0 format: Sectioned Content with Interactive Refinement
type ContentSection = {
  id: string;           // e.g., "executive_summary", "key_strategies"
  title: string;        // e.g., "Executive Summary"
  content: string;      // The actual section text
  sectionType: 'summary' | 'context' | 'strategies' | 'case_study' | 'faq' | 'cta' | 'custom';
};

type GeneratedContentJsonV4 = {
  version: '4.0';
  recommendationId: string;
  brandName: string;
  targetSource: {
    domain: string;
    sourceType: 'reddit' | 'linkedin' | 'dev_to' | 'youtube' | 'article_site' | 'owned_site' | 'other';
  };
  contentTitle: string;                    // Overall title of the content
  sections: ContentSection[];              // Array of structured sections
  callToAction: string;                    // Final CTA
  requiredInputs: string[];                // [FILL_IN:] markers user needs to complete
};


// NEW v5.0 format: Unified Content Canvas
type GeneratedContentJsonV5 = {
  version: '5.0';
  recommendationId: string;
  brandName: string;
  contentTitle: string;
  content: string;
  requiredInputs: string[];
};

type GeneratedContentJson = GeneratedContentJsonV1 | GeneratedContentJsonV2 | GeneratedContentJsonV3 | GeneratedContentJsonV4 | GeneratedContentJsonV5;
type GeneratedAnyJson = GeneratedContentJson | GeneratedGuideJsonV1;

// Cold-start guide format (Step 2/3 for cold_start)
type GeneratedGuideJsonV1 = {
  version: 'guide_v1';
  recommendationId: string;
  brandName: string;
  summary?: {
    goal?: string;
    whyThisMatters?: string;
    timeEstimate?: string;
    effortLevel?: string;
  };
  prerequisites?: string[];
  implementationPlan?: Array<{
    phase: string;
    steps: Array<{
      title: string;
      howTo: string;
      deliverable?: string;
      qualityChecks?: string[];
    }>;
  }>;
  templatesAndExamples?: Array<{ name: string; content: string }>;
  successCriteria?: {
    whatToMeasure?: string[];
    expectedDirection?: string;
    checkInCadence?: string;
  };
  ifAlreadyDone?: {
    verificationSteps?: string[];
    upgradePath?: string[];
  };
  commonMistakes?: string[];
  nextBestActions?: string[];
};

// Source detection utility - enhanced for v3.0 source-specific content
function detectSourceTypeV3(domain: string): 'reddit' | 'linkedin' | 'dev_to' | 'youtube' | 'article_site' | 'owned_site' | 'other' {
  const domainLower = domain.toLowerCase().trim();

  // Owned site detection (check first)
  if (domainLower === 'owned-site' || domainLower === 'owned_site') {
    return 'owned_site';
  }

  // YouTube detection
  const youtubeDomains = ['youtube.com', 'youtu.be', 'm.youtube.com', 'www.youtube.com'];
  if (youtubeDomains.some(d => domainLower.includes(d))) {
    return 'youtube';
  }

  // Reddit detection
  if (domainLower.includes('reddit.com') || domainLower.includes('reddit')) {
    return 'reddit';
  }

  // LinkedIn detection
  if (domainLower.includes('linkedin.com') || domainLower.includes('linkedin')) {
    return 'linkedin';
  }

  // Dev.to detection
  if (domainLower.includes('dev.to')) {
    return 'dev_to';
  }

  // Known editorial/article sites
  const articleSitePatterns = [
    'techcrunch', 'forbes', 'wired', 'theverge', 'engadget', 'ars-technica',
    'healthline', 'webmd', 'mayoclinic', 'nih.gov', 'medicalnewstoday',
    'medium', 'hashnode', 'smashingmagazine', 'css-tricks',
    'wikipedia', 'britannica', 'encyclopedia',
    'nytimes', 'wsj', 'theguardian', 'bbc', 'cnn', 'reuters',
    'hbr', 'harvard', 'stanford', 'mit.edu', 'atlassian.com',
    'quora', 'stackoverflow', 'stackexchange'
  ];

  if (articleSitePatterns.some(pattern => domainLower.includes(pattern))) {
    return 'article_site';
  }

  // Default to other
  return 'other';
}

// Legacy function for backward compatibility
function detectSourceType(domain: string): 'youtube' | 'article_site' | 'collaboration_target' | 'other' {
  const v3Type = detectSourceTypeV3(domain);
  if (v3Type === 'youtube') return 'youtube';
  if (['reddit', 'linkedin', 'dev_to', 'article_site'].includes(v3Type)) return 'article_site';
  return 'other';
}

class RecommendationContentService {
  constructor() { }

  async getLatestContent(recommendationId: string, customerId: string): Promise<RecommendationContentRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('recommendation_generated_contents')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ [RecommendationContentService] Error fetching latest content:', error);
      return null;
    }

    return (data as any) || null;
  }

  async updateStatus(contentId: string, customerId: string, status: RecommendationContentStatus): Promise<RecommendationContentRecord | null> {
    const { data, error } = await supabaseAdmin
      .from('recommendation_generated_contents')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', contentId)
      .eq('customer_id', customerId)
      .select('*')
      .single();

    if (error) {
      console.error('❌ [RecommendationContentService] Error updating status:', error);
      return null;
    }

    return data as any;
  }

  /**
   * Save content structure draft WITHOUT calling LLM
   */
  async saveContentDraft(
    recommendationId: string,
    customerId: string,
    structure: any
  ): Promise<RecommendationContentRecord | null> {
    try {
      // Fetch recommendation to get brand/generation IDs
      const { data: rec, error: recError } = await supabaseAdmin
        .from('recommendations')
        .select('*')
        .eq('id', recommendationId)
        .eq('customer_id', customerId)
        .single();

      if (recError || !rec) {
        throw new Error('Recommendation not found or unauthorized');
      }

      // Prepare metadata with structure flag
      const metadata = {
        is_structure_draft: true,
        structure_config: structure
      };

      // Create content record
      // NOTE: Using 'cerebras' as provider to avoid potential enum constraints, 
      // as 'ollama' might not be a valid value in the DB constraint.
      const contentRecord: any = {
        recommendation_id: recommendationId,
        generation_id: rec.generation_id,
        brand_id: rec.brand_id,
        customer_id: customerId,
        status: 'generated',
        content_type: 'draft',
        content: JSON.stringify(structure, null, 2),
        model_provider: 'cerebras',
        model_name: 'draft',
        prompt: 'manual_structure_draft',
        metadata: {
          is_structure_draft: true,
          structure_config: structure,
          updated_manually: true
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Check if a draft already exists to update it
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('recommendation_generated_contents')
        .select('id')
        .eq('recommendation_id', recommendationId)
        .eq('content_type', 'draft')
        .contains('metadata', { is_structure_draft: true })
        .maybeSingle();

      if (existingError) {
        console.error('❌ [RecommendationContentService] Error checking existing draft:', existingError);
        throw existingError;
      }

      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('recommendation_generated_contents')
          .update({
            content: contentRecord.content,
            metadata: contentRecord.metadata,
            updated_at: contentRecord.updated_at
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (error) {
          console.error('❌ [RecommendationContentService] Error updating draft:', error);
          throw error;
        }
        return data as any;
      } else {
        const { data, error } = await supabaseAdmin
          .from('recommendation_generated_contents')
          .insert(contentRecord)
          .select('*')
          .single();

        if (error) {
          console.error('❌ [RecommendationContentService] Error inserting draft:', error);
          throw error;
        }
        return data as any;
      }
    } catch (error: any) {
      console.error('❌ [RecommendationContentService] Error saving content draft:', error?.message || error);
      throw error;
    }
  }

  async generateContent(
    recommendationId: string,
    customerId: string,
    request: GenerateRecommendationContentRequest = {}
  ): Promise<{ record: RecommendationContentRecord | null; providerUsed?: RecommendationContentProvider; modelUsed?: string } | null> {
    // Fetch recommendation (validate customer ownership)
    const { data: rec, error: recError } = await supabaseAdmin
      .from('recommendations')
      .select('*')
      .eq('id', recommendationId)
      .eq('customer_id', customerId)
      .single();

    if (recError || !rec) {
      console.error('❌ [RecommendationContentService] Recommendation not found or unauthorized:', recError);
      throw new Error('Recommendation not found or unauthorized');
    }

    // Fetch brand context (lightweight)
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name, industry, summary')
      .eq('id', rec.brand_id)
      .eq('customer_id', customerId)
      .single();

    const contentType = request.contentType || 'draft';
    const isColdStartGuide = contentType === 'cold_start_guide';

    const projectContext = `You are generating content for AnswerIntel (Evidently): a platform that helps brands improve their visibility in AI answers.
We track brand performance across AI models (visibility, Share of Answers, sentiment) and citation sources.
Your content should help the customer's brand improve the targeted KPI by executing the recommendation.\n`;

    // Fetch context files from strategy plan (if any)
    let contextFilesContent = '';
    const { data: strategyPlan } = await supabaseAdmin
      .from('recommendation_generated_contents')
      .select('content')
      .eq('recommendation_id', recommendationId)
      .eq('content_type', 'strategy_plan')
      .maybeSingle();

    if (strategyPlan) {
      try {
        const parsedPlan = JSON.parse(strategyPlan.content);
        if (parsedPlan.contextFiles && Array.isArray(parsedPlan.contextFiles) && parsedPlan.contextFiles.length > 0) {
          console.log(`📂 [RecommendationContentService] Found ${parsedPlan.contextFiles.length} context files for generation.`);

          contextFilesContent = `\n\nUPLOADED CONTEXT DOCUMENTS:\nThe following documents were provided by the user to guide this content generation. USE them as primary source material.\n\n`;

          parsedPlan.contextFiles.forEach((file: any, index: number) => {
            contextFilesContent += `--- DOCUMENT ${index + 1}: ${file.name} ---\n${file.content}\n--- END DOCUMENT ${index + 1} ---\n\n`;
          });
        }

        // --- NEW: Execute Web Research if queries exist ---
        if (parsedPlan.researchQueries && Array.isArray(parsedPlan.researchQueries) && parsedPlan.researchQueries.length > 0) {
          console.log(`🔎 [RecommendationContentService] Executing ${parsedPlan.researchQueries.length} research queries via MCP...`);

          let researchContext = '';
          for (const query of parsedPlan.researchQueries) {
            try {
              // Using Quick Search (SearXNG) for speed and reliability
              const results = await mcpSearchService.quickSearch(query, 3);
              const formatted = mcpSearchService.formatContext(results);
              if (formatted) {
                researchContext += formatted + '\n\n';
              }
            } catch (err) {
              console.warn(`⚠️ [RecommendationContentService] Failed research for query: "${query}"`, err);
            }
          }

          if (researchContext.length > 0) {
            // Append to contextFilesContent (or treating it as highest priority context)
            contextFilesContent += `\n\n### LATEST MARKET RESEARCH (MCP Verified):\n${researchContext}\n\n`;
            console.log(`✅ [RecommendationContentService] Injected research context`);
          }
        }

      } catch (e) {
        console.warn('⚠️ [RecommendationContentService] Failed to parse strategy plan for context files', e);
      }
    }

    const recommendationContext = `Brand\n- Name: ${brand?.name || 'Unknown'}\n- Industry: ${brand?.industry || 'Unknown'}\n- Summary: ${brand?.summary || 'N/A'}\n\nRecommendation\n- Action: ${rec.action}\n- KPI: ${rec.kpi}\n- Focus area: ${rec.focus_area}\n- Priority: ${rec.priority}\n- Effort: ${rec.effort}\n- Timeline: ${rec.timeline}\n- Expected boost: ${rec.expected_boost || 'TBD'}\n\nEvidence & metrics\n- Citation source: ${rec.citation_source}\n- Impact score: ${rec.impact_score}\n- Mention rate: ${rec.mention_rate}\n- Visibility: ${rec.visibility_score}\n- SOA: ${rec.soa}\n- Sentiment: ${rec.sentiment}\n- Citations: ${rec.citation_count}\n\nFocus\n- Focus sources: ${rec.focus_sources}\n- Content focus: ${rec.content_focus}\n\nReason\n${rec.reason}\n\nExplanation\n${rec.explanation}${contextFilesContent}`;

    // Detect source type
    const detectedSourceType = detectSourceType(rec.citation_source || '');
    const isYouTube = detectedSourceType === 'youtube';
    const isArticleSite = detectedSourceType === 'article_site';

    // Determine mode (for external sites, prefer collaboration; for owned/YouTube, prefer post_on_source)
    const preferredMode = (isYouTube || rec.citation_source?.includes(brand?.name?.toLowerCase() || ''))
      ? 'post_on_source'
      : 'pitch_collaboration';

    // Build source type description
    const sourceTypeDesc = isYouTube
      ? 'YOUTUBE - Generate a video script'
      : isArticleSite
        ? 'ARTICLE SITE - Generate article content'
        : 'OTHER - Generate appropriate content type';

    // Build content type
    const contentTypeValue = isYouTube ? 'video_script' : isArticleSite ? 'article' : 'other';

    // NOTE: We intentionally avoid putting "placeholder instructions" into the JSON template
    // for publishableContent.content. The model must fill that field with real content.
    const contentStyleGuide = isYouTube
      ? `VIDEO SCRIPT REQUIREMENTS:
- Output a complete script (not notes), written for an expert but friendly host.
- Include 4-6 scenes with timestamps (e.g., 0:00-0:15).
- Include spoken dialogue + on-screen text cues + suggested visuals.
- No made-up stats; if numbers are required, put them in requiredInputs.`
      : isArticleSite
        ? `ARTICLE REQUIREMENTS:
- Output a complete publishable article draft in Markdown, ~900-1200 words.
- Use a strong angle that matches the recommendation action + KPI + target source.
- Include these sections with headings: TL;DR, Why this matters, Step-by-step, Checklist, Common mistakes, FAQs, CTA.
- Ground claims in the provided evidence/metrics where possible. Do NOT invent metrics, quotes, or customer names.
- CRITICAL: Do NOT introduce any new proper nouns or org names besides the brand and the target source domain. If you need a customer, use "a customer" (anonymous) and list missing specifics in requiredInputs.
- If the action mentions "case study" but customer details are not provided, write a \"Case Study Kit\" instead: an anonymized case-study skeleton + interview questions + proof checklist (still publishable, but clearly framed as a template).`
        : `CONTENT REQUIREMENTS:
- Output a complete publishable draft in the most appropriate format for the target source.
- Do NOT invent customer names or hard numbers; list missing facts in requiredInputs.`;

    // Build metadata template
    const metadataTemplate = isYouTube
      ? '"estimatedDuration": "<e.g., 4:30>", "scenes": [{"start": "0:00", "end": "0:15", "type": "hook", "content": "<hook>"}], "keyVisuals": ["<visual 1>"], "onScreenText": ["<text 1>"]'
      : isArticleSite
        ? '"h1": "<main heading>", "h2": ["<subheading 1>", "<subheading 2>"], "faq": ["<FAQ 1>"], "snippetSummary": "<summary>"'
        : '';

    // Build content constraints
    const contentConstraints = isYouTube
      ? 'Video script must be engaging, visual, and include clear timing/scenes.'
      : isArticleSite
        ? 'Article must be authoritative, well-researched, and citation-friendly with proper structure.'
        : '';

    const guideInstructions = `You are a senior marketing consultant and AEO strategist.

CRITICAL: You MUST return ONLY valid JSON. Do NOT include markdown code blocks, do NOT include any text before or after the JSON. Return ONLY the raw JSON object starting with { and ending with }.

TASK:
Create a step-by-step, execution-ready implementation guide for the approved recommendation. This is for a cold-start brand (low evidence), so the guide should focus on fundamentals and creating measurable signals quickly.

OUTPUT SIZE LIMITS (to avoid truncation / invalid JSON):
- Max 3 phases in implementationPlan
- Max 3 steps per phase
- Max 3 qualityChecks per step
- Keep each "howTo" under 500 characters and DO NOT include literal newlines inside strings
- Keep arrays short (no long lists)

STRICT FORMAT (must match exactly):
{
  "version": "guide_v1",
  "recommendationId": "${rec.id}",
  "brandName": "${brand?.name || 'Brand'}",
  "summary": {
    "goal": "<1 sentence goal aligned to KPI>",
    "whyThisMatters": "<1-2 sentences grounded in the recommendation reason>",
    "timeEstimate": "<e.g., 2-4 hours, 1-2 days, 2-4 weeks>",
    "effortLevel": "${rec.effort || 'Medium'}"
  },
  "prerequisites": ["<what you need before starting>"],
  "implementationPlan": [
    {
      "phase": "<Phase name>",
      "steps": [
        {
          "title": "<step title>",
          "howTo": "<2-6 sentences with concrete instructions>",
          "deliverable": "<what artifact should exist after this step>",
          "qualityChecks": ["<check 1>", "<check 2>"]
        }
      ]
    }
  ],
  "templatesAndExamples": [
    {
      "name": "<template name>",
      "content": "<short template text / outline / checklist>"
    }
  ],
  "successCriteria": {
    "whatToMeasure": ["<metric 1>", "<metric 2>"],
    "expectedDirection": "<what should improve and when>",
    "checkInCadence": "<e.g., weekly for 4 weeks>"
  },
  "ifAlreadyDone": {
    "verificationSteps": ["<how to verify it's actually done correctly>"],
    "upgradePath": ["<how to improve it beyond the basics>"]
  },
  "commonMistakes": ["<mistake 1>", "<mistake 2>"],
  "nextBestActions": ["<what to do next after completing this>"]
}

CONSTRAINTS:
- Do NOT mention internal tool/provider names.
- **CRITICAL**: Do NOT mention any competitor names in any field.
- Keep everything aligned to the recommendation action, KPI, focus area, and citation source.
- Be specific: name pages, sections, checklists, and concrete deliverables.
`;

    // NEW v3.0: Dual content prompt with source-specific formats
    const detectSourceTypeV3 = (source: string): string => {
      source = source.toLowerCase();
      if (source.includes('youtube.com') || source.includes('youtu.be')) return 'youtube';
      if (source.includes('reddit.com')) return 'reddit';
      if (source.includes('linkedin.com')) return 'linkedin';
      if (source.includes('dev.to')) return 'dev_to';
      // Check if it's an owned site (e.g., brand's own domain)
      if (brand?.name && source.includes(brand.name.toLowerCase().replace(/\s/g, ''))) return 'owned_site';
      // Generic article sites (e.g., blogs, news sites)
      if (source.includes('.com') || source.includes('.org') || source.includes('.net')) return 'article_site';
      return 'other';
    };

    const sourceTypeV3 = detectSourceTypeV3(rec.citation_source || '');

    // Source-specific content guidance
    const getSourceContentGuidance = (sourceType: string): { contentType: string; format: string; tone: string; example: string } => {
      switch (sourceType) {
        case 'reddit':
          return {
            contentType: 'reddit_post',
            format: 'Conversational text post with story structure',
            tone: 'Casual, authentic, community-first. NO marketing speak. Ask a question at the end.',
            example: 'Start with a hook about your experience, share the problem, explain what you did, show results, ask for community input.'
          };
        case 'linkedin':
          return {
            contentType: 'linkedin_post',
            format: 'Professional thought leadership post with data points',
            tone: 'Professional but accessible. Use short paragraphs. Include 1-2 data points.',
            example: 'Hook with a bold statement, share insight, provide actionable takeaway, end with engaging question.'
          };
        case 'dev_to':
          return {
            contentType: 'article',
            format: 'Technical tutorial or guide with code examples if applicable',
            tone: 'Educational, developer-friendly. Include practical examples.',
            example: 'Start with problem, explain solution step-by-step, include code snippets or configs, summarize learnings.'
          };
        case 'youtube':
          return {
            contentType: 'video_script',
            format: 'Video script with timestamps, scenes, and dialogue',
            tone: 'Engaging, friendly, expert. Visual cues and on-screen text included.',
            example: 'Hook (0:00-0:15), Problem (0:15-0:45), Solution (0:45-2:30), Results (2:30-3:30), CTA (3:30-4:00).'
          };
        case 'owned_site':
          return {
            contentType: 'blog_post',
            format: 'SEO-optimized blog post with H1, H2, FAQ structure',
            tone: 'Authoritative, brand voice. Include structured data hints.',
            example: 'TL;DR summary, problem statement, solution explanation, case study/example, FAQ section, CTA.'
          };
        case 'article_site':
          return {
            contentType: 'article',
            format: 'Guest article or case study format',
            tone: 'Professional, data-driven. Align with publication style.',
            example: 'Lead with insight, support with evidence, provide actionable takeaways, end with call to action.'
          };
        default:
          return {
            contentType: 'other',
            format: 'Appropriate content format for the target',
            tone: 'Professional and clear',
            example: 'Hook, main content, call to action.'
          };
      }
    };

    const sourceGuidance = getSourceContentGuidance(sourceTypeV3);

    // === NEW: Detect Asset Type from action for FSA-based prompts ===
    const assetDetection = detectContentAsset(rec.action || '');
    const platformDetection = detectPlatform(rec.citation_source || '', brand?.name);
    const useFactoryPrompt = assetDetection.confidence === 'high' &&
      ['comparison_table', 'whitepaper', 'webinar_recap', 'case_study', 'expert_community_response', 'social_media_thread'].includes(assetDetection.asset);

    console.log(`📊 [RecommendationContentService] Asset Detection: ${assetDetection.asset} (${assetDetection.confidence}), Platform: ${platformDetection}, UseFactory: ${useFactoryPrompt}`);


    // v4.0 Prompt: Generate structured sections for interactive refinement
    // DYNAMICALLY build sections based on structureConfig if present
    const hasCustomStructure = request.structureConfig && request.structureConfig.sections && request.structureConfig.sections.length > 0;

    let sectionsInstruction = `REQUIRED SECTIONS:
1. "executive_summary" - TL;DR with key takeaways (2-3 bullet points)
2. "context" - Why this matters / The problem being solved
3. "strategies" - Key approaches or steps (numbered list)
4. "case_study" - Real example with metrics (use [FILL_IN:] for specifics)
5. "faq" - 2-3 FAQ-style Q&As that AI models love to cite
6. "cta" - Clear call to action`;

    let jsonSchemaSections = `    {
      "id": "executive_summary",
      "title": "Executive Summary",
      "content": "<2-3 bullet points summarizing key takeaways>",
      "sectionType": "summary"
    },
    {
      "id": "context",
      "title": "<Why X Matters / The Problem>",
      "content": "<2-3 paragraphs explaining the context>",
      "sectionType": "context"
    },
    {
      "id": "strategies",
      "title": "Key Strategies",
      "content": "<numbered list of 3-5 actionable strategies>",
      "sectionType": "strategies"
    },
    {
      "id": "case_study",
      "title": "Case Study: [FILL_IN: Company Name]",
      "content": "<real-world example with metrics using [FILL_IN:] for specifics>",
      "sectionType": "case_study"
    },
    {
      "id": "faq",
      "title": "Frequently Asked Questions",
      "content": "<2-3 Q&A pairs formatted as Q: ... A: ...>",
      "sectionType": "faq"
    },
    {
      "id": "next_steps",
      "title": "Next Steps",
      "content": "<actionable next steps for the reader>",
      "sectionType": "cta"
    }`;

    if (hasCustomStructure) {
      console.log('📝 [RecommendationContentService] Using custom structure for prompt generation');

      // Build instructions from custom structure
      const customSectionsList = request.structureConfig!.sections.map((s, i) =>
        `${i + 1}. "${s.id}" - ${s.title}` + (s.content ? `: ${s.content}` : '')
      ).join('\n');

      sectionsInstruction = `REQUIRED SECTIONS (Strictly follow this structure):
${customSectionsList}`;

      // Build JSON schema example from custom structure
      jsonSchemaSections = request.structureConfig!.sections.map(s => `    {
      "id": "${s.id}",
      "title": "${s.title}",
      "content": "<generate content for '${s.title}' based on instructions: ${s.content || 'provide relevant details'}>",
      "sectionType": "${s.sectionType || 'custom'}"
    }`).join(',\n');
    }

    const contentInstructionsV4 = `You are a senior content strategist. Generate AEO-optimized content as STRUCTURED SECTIONS.

RETURN ONLY VALID JSON. No markdown, no explanations.

BRAND: ${brand?.name || 'Brand'} (${brand?.industry || 'Unknown industry'})
TARGET: ${rec.citation_source || 'Unknown'} (${sourceTypeV3})
ACTION: ${rec.action}
KPI: ${rec.kpi}

=== OUTPUT: STRUCTURED SECTIONS ===

Generate content as an array of sections. Each section should be:
- Self-contained and valuable on its own
- AEO-optimized with clear headings that match search queries
- 100-200 words per section (unless specified otherwise)

${sectionsInstruction}

=== TONE: ${sourceTypeV3.toUpperCase()} ===
${sourceTypeV3 === 'reddit' ? `Conversational, first-person, genuine questions` :
        sourceTypeV3 === 'linkedin' ? `Professional, data-driven, thought leadership` :
          sourceTypeV3 === 'youtube' ? `Spoken dialogue with [VISUAL:] cues` :
            `Professional, clear, actionable`}

=== CRITICAL: REAL CONTENT ===
Write ACTUAL sentences. NOT "this section should cover..." but the REAL text.

=== JSON SCHEMA v4.0 ===
{
  "version": "4.0",
  "recommendationId": "${rec.id}",
  "brandName": "${brand?.name || 'Brand'}",
  "targetSource": { "domain": "${rec.citation_source || ''}", "sourceType": "${sourceTypeV3}" },
  "contentTitle": "<compelling overall title>",
  "sections": [
${jsonSchemaSections}
  ],
  "callToAction": "<final CTA with link placeholder>",
  "requiredInputs": ["<[FILL_IN: X] items across all sections>"]
}

RULES:
- Each section.content = REAL TEXT, not descriptions
- Use [FILL_IN: specific thing] for data you don't know
- Escape newlines as \\\\n in JSON strings
- No competitor mentions
`;

    // Decide which prompt to use: v4.0 sectioned (default) or guide_v1 (cold start)
    const useV4 = !isColdStartGuide; // Use v4 for normal content generation
    const contentInstructions = useV4 ? contentInstructionsV4 : `You are a senior marketing consultant and AEO strategist.

CRITICAL: You MUST return ONLY valid JSON. Do NOT include markdown code blocks, do NOT include any text before or after the JSON, do NOT include explanations. Return ONLY the raw JSON object starting with { and ending with }.

SOURCE TYPE: ${sourceTypeDesc}

GOAL:
- Generate ONE section: Publishable Content (ready to publish/post). Do NOT generate any email or outreach copy.
- For YouTube: Generate video script with scenes and timing.
- For article sites: Generate full article with H1/H2/FAQ structure.

OUTPUT RULES (to ensure valid JSON):
- You MUST escape newlines in any string values using \\\\n (no literal newlines inside JSON strings).
- Do NOT use placeholders like [Client], [Company], or <insert>. If a detail is missing, omit it and add it to requiredInputs.
- Do NOT invent customer names, certifications, study results, or performance claims. If missing, put in requiredInputs.
- CRITICAL: Do NOT introduce any new brand/company/community names besides the brandName and the citation source domain. Use "a customer" if needed.

STRICT FORMAT v2.0 (must match exactly):
{
  "version": "2.0",
  "recommendationId": "${rec.id}",
  "brandName": "${brand?.name || 'Brand'}",
  "targetSource": {
    "domain": "${rec.citation_source || ''}",
    "sourceType": "${detectedSourceType}",
    "mode": "post_on_source",
    "rationale": "<1-2 sentences explaining why this content format will help achieve the KPI on this source>"
  },
  "publishableContent": {
    "type": "${contentTypeValue}",
    "title": "<compelling title for the content>",
    "content": "<FULL, READY-TO-PUBLISH DRAFT HERE (escape newlines as \\\\n)>",
    "metadata": {
      ${metadataTemplate}
    }
  },
  "keyPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "requiredInputs": ["<facts/links the marketer must verify or add>"],
  "complianceNotes": ["<brand-safe constraints>"]
}

CONSTRAINTS:
- Do NOT invent clinical studies, certifications, or regulatory claims. Put them under requiredInputs if needed.
- Do NOT promise outcomes; speak in probabilities.
- Do NOT mention internal tool/provider names.
- **CRITICAL**: Do NOT mention any competitor names in the generated content (any field). Focus solely on the brand's own value proposition, features, and benefits.
- Keep content aligned to the recommendation, KPI, focus area, and citation source.
${contentConstraints ? `- ${contentConstraints}` : ''}
${contentStyleGuide}
`;

    // === PROMPT SELECTION: Factory (for FSA strategic assets) or Legacy ===

    // v2026.3 Integration: Check New Content Factory for specific assets
    let newFactoryPrompt: string | null = null;

    // Supported types in New Content Factory
    const newFactorySupportedAssets = ['article', 'whitepaper', 'short_video', 'expert_community_response', 'podcast', 'comparison_table', 'social_media_thread'];

    if (newFactorySupportedAssets.includes(assetDetection.asset)) {
      const recV3ForNew: RecommendationV3 = {
        id: rec.id,
        action: rec.action || '',
        citationSource: rec.citation_source || '',
        focusArea: (rec.focus_area as 'visibility' | 'soa' | 'sentiment') || 'visibility',
        priority: (rec.priority as 'High' | 'Medium' | 'Low') || 'Medium',
        effort: (rec.effort as 'Low' | 'Medium' | 'High') || 'Medium',
        kpi: rec.kpi,
        reason: rec.reason,
        explanation: rec.explanation,
        contentFocus: rec.content_focus,
        timeline: rec.timeline,
      };
      const brandContextV3ForNew: BrandContextV3 = {
        brandId: brand?.id || rec.brand_id,
        brandName: brand?.name || 'Brand',
        industry: brand?.industry || 'Unknown',
        brandDomain: brand?.name?.toLowerCase().replace(/\s/g, '') || undefined,
      };

      console.log(`🚀 [RecommendationContentService] Attempting NEW Content Factory for asset: ${assetDetection.asset}`);

      // Pass the structureConfig to the factory
      newFactoryPrompt = getNewContentPrompt({
        recommendation: recV3ForNew,
        brandContext: brandContextV3ForNew,
        structureConfig: request.structureConfig,
        // Ensure any uploaded context files (PDF/TXT, etc.) are
        // forwarded into the unified prompt so the LLM can treat
        // them as primary source material for generation.
        extraContext: contextFilesContent
      }, assetDetection.asset);
    }

    let prompt: string;

    if (newFactoryPrompt) {
      prompt = newFactoryPrompt;
      console.log(`🚀 [RecommendationContentService] Using NEW Content Factory (v2026.3) for ${assetDetection.asset}.`);
    } else {
      // Fallback to legacy prompt construction (Restored to original state)
      prompt = `${projectContext}\nRecommendation ID: ${rec.id}\n\n${recommendationContext}\n\n${isColdStartGuide ? guideInstructions : contentInstructions}`;
    }

    // Log the prompt being sent
    console.log('\n📤 [RecommendationContentService] ========== PROMPT ==========');
    console.log(prompt);
    console.log('📤 [RecommendationContentService] ========== END PROMPT ==========\n');

    // Call providers - Groq Compound (Primary) → OpenRouter (Fallback)
    let content: string | null = null;
    let providerUsed: RecommendationContentProvider | undefined;
    let modelUsed: string | undefined;

    // 1. Try Groq Compound (Primary)
    try {
      console.log('🚀 [RecommendationContentService] Attempting Groq Compound (Primary)...');
      const enableSearch = !isColdStartGuide;

      const groqResult = await groqCompoundService.generateContent({
        systemPrompt: isColdStartGuide
          ? 'You are a senior marketing consultant and AEO strategist. Generate implementation guides.'
          : 'You are a senior content strategist. Produce high-quality, grounded content.',
        userPrompt: prompt,
        model: 'groq/compound',
        temperature: isColdStartGuide ? 0.4 : 0.6,
        maxTokens: 8000,
        jsonMode: false,
        enableWebSearch: enableSearch
      });

      if (groqResult.content) {
        content = groqResult.content;
        providerUsed = 'openrouter'; // Use 'openrouter' label for DB compatibility
        modelUsed = 'groq/compound';
        console.log(`✅ [RecommendationContentService] Groq Compound succeeded (Search: ${enableSearch ? 'Active' : 'N/A'})`);
      }
    } catch (err: any) {
      console.warn(`⚠️ [RecommendationContentService] Groq Compound failed: ${err.message}. Falling back to OpenRouter...`);
    }

    // 2. Fallback to OpenRouter
    if (!content) {
      try {
        console.log('🚀 [RecommendationContentService] Attempting OpenRouter Fallback...');
        providerUsed = 'openrouter';
        modelUsed = 'meta-llama/llama-3.3-70b-instruct';

        const result = await openRouterCollectorService.executeQuery({
          systemPrompt: 'You are a senior content strategist. Produce high-quality, grounded content.',
          prompt: prompt,
          model: modelUsed,
          maxTokens: 5000
        });
        content = result.response;
        console.log('✅ [RecommendationContentService] OpenRouter fallback succeeded');
      } catch (err: any) {
        console.error('❌ [RecommendationContentService] All providers failed:', err.message);
      }
    }

    if (!content) {
      throw new Error('All LLM providers failed to generate content');
    }

    // Log the response received
    console.log('\n📥 [RecommendationContentService] ========== RESPONSE ==========');
    console.log(`Provider: ${providerUsed || 'unknown'}, Model: ${modelUsed || 'unknown'} `);
    console.log(content);
    console.log('📥 [RecommendationContentService] ========== END RESPONSE ==========\n');

    const parsed = this.parseGeneratedContentJson(content);
    if (!parsed) {
      console.warn('⚠️ [RecommendationContentService] LLM did not return valid JSON. Storing raw response.');
    }

    // If parsed but low quality, do one deterministic rewrite pass (non-cold-start only)
    const isParsedV2 = parsed && typeof parsed === 'object' && (parsed as any).version === '2.0';
    const shouldRewriteV2 = !isColdStartGuide && isParsedV2 && this.isLowQualityV2(parsed as any);
    if (shouldRewriteV2) {
      console.warn('⚠️ [RecommendationContentService] Detected low-quality v2 content. Attempting one rewrite pass...');
      const rewritePrompt = `${projectContext} \n\n${recommendationContext} \n\nYou previously generated JSON but it failed quality requirements.\n\nQUALITY REQUIREMENTS(must satisfy all): \n - Do NOT invent any customer / org / community names(no \"Tech Club\" style names). Only mention the brand and the target source domain.\n- Do NOT invent metrics or specific results. If missing, add to requiredInputs.\n- Must be publishable and structured with headings: TL;DR, Why this matters, Step-by-step, Checklist, Common mistakes, FAQs, CTA.\n- Must be Markdown and escape newlines as \\\\n in JSON strings.\n- Keep the same JSON v2.0 schema.\n\nHere is the previous JSON:\n${JSON.stringify(parsed, null, 2)}\n\nReturn ONLY the corrected JSON object.`;

      try {
        const orRewrite = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt: rewritePrompt,
          maxTokens: 2600,
          temperature: 0.2,
          topP: 0.9,
          enableWebSearch: false
        });
        const rewritten = orRewrite.response || null;
        if (rewritten) {
          const rewrittenParsed = this.parseGeneratedContentJson(rewritten);
          if (rewrittenParsed && (rewrittenParsed as any).version === '2.0') {
            console.log('✅ [RecommendationContentService] Rewrite pass succeeded');
            // Prefer rewritten
            (parsed as any).publishableContent = (rewrittenParsed as any).publishableContent;
            (parsed as any).keyPoints = (rewrittenParsed as any).keyPoints;
            (parsed as any).requiredInputs = (rewrittenParsed as any).requiredInputs;
            (parsed as any).complianceNotes = (rewrittenParsed as any).complianceNotes;
          }
        }
      } catch (e) {
        console.error('❌ [RecommendationContentService] Rewrite pass failed:', e);
      }
    }

    const now = new Date().toISOString();

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('recommendation_generated_contents')
      .insert({
        recommendation_id: rec.id,
        generation_id: rec.generation_id,
        brand_id: rec.brand_id,
        customer_id: rec.customer_id,
        status: 'generated',
        content_type: contentType,
        content: parsed ? JSON.stringify(parsed, null, 2) : content,
        model_provider: providerUsed || 'cerebras',
        model_name: modelUsed || null,
        prompt,
        metadata: {
          source: rec.citation_source,
          kpi: rec.kpi,
          focus_area: rec.focus_area,
          format: parsed
            ? ((parsed as any).version === '2.0'
              ? 'json_v2'
              : (parsed as any).version === 'guide_v1'
                ? 'guide_v1'
                : 'json_v1')
            : 'raw_text',
          raw_response: parsed ? content : undefined
        },
        created_at: now,
        updated_at: now
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ [RecommendationContentService] Error inserting generated content:', insertError);
      throw new Error(`Failed to save generated content to database: ${insertError.message}`);
    }

    return {
      record: inserted as any,
      providerUsed,
      modelUsed
    };
  }

  // private callCerebras method removed

  private parseGeneratedContentJson(raw: string): GeneratedAnyJson | null {
    if (!raw || typeof raw !== 'string') return null;

    // Strategy 1: Try direct JSON parse
    try {
      const parsed = JSON.parse(raw.trim());
      if (this.isValidGeneratedContent(parsed)) {
        return this.normalizeGeneratedContent(parsed);
      } else {
        console.warn('[PARSE] Direct parse succeeded but content invalid. Version:', parsed?.version);
      }
    } catch (e) {
      console.warn('[PARSE] Strategy 1 (direct) failed:', (e as Error).message);
    }

    // Strategy 2: Extract JSON from markdown code blocks
    try {
      let cleaned = raw.trim();

      // Remove markdown code blocks
      const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        cleaned = jsonBlockMatch[1].trim();
      } else {
        // Try removing just the markers
        if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
        if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
        if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
        cleaned = cleaned.trim();
      }

      const parsed = JSON.parse(cleaned);
      if (this.isValidGeneratedContent(parsed)) {
        return this.normalizeGeneratedContent(parsed);
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 3: Extract JSON object from text (find first { ... } block)
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (this.isValidGeneratedContent(parsed)) {
          return this.normalizeGeneratedContent(parsed);
        }
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 3.5: Robust V4 Recovery (for truncated/malformed responses)
    try {
      if (raw.includes('"version":"4.0"') || raw.includes('"version": "4.0"') || raw.includes('"sections"')) {
        // Extract title
        const titleMatch = raw.match(/"contentTitle"\s*:\s*"([^"]+)"/);
        const sections: any[] = [];

        // 1. Extract the text following "sections": [
        const sectionsStartMatch = raw.match(/"sections"\s*:\s*\[([\s\S]*)/);

        if (sectionsStartMatch) {
          const sectionsStr = sectionsStartMatch[1];

          // 2. Match individual object blocks { ... } non-greedily
          // We look for { "id": ... } structure roughly
          const objectBlockRegex = /\{[\s\S]*?\}(?=\s*,|\s*\]|\s*$)/g;
          const potentialBlocks = sectionsStr.match(objectBlockRegex) || [];

          for (const block of potentialBlocks) {
            try {
              // Try clean parse first
              const validBlock = JSON.parse(block);
              sections.push(validBlock);
            } catch {
              // Regex extract fields if JSON is broken inside the block
              const idMatch = block.match(/"id"\s*:\s*"([^"]+)"/);
              const titleMatch = block.match(/"title"\s*:\s*"([^"]+)"/);
              const contentMatch = block.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
              const typeMatch = block.match(/"sectionType"\s*:\s*"([^"]+)"/);

              if (idMatch && contentMatch) {
                sections.push({
                  id: idMatch[1],
                  title: titleMatch ? titleMatch[1] : 'Section',
                  content: contentMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
                  sectionType: typeMatch ? typeMatch[1] : 'strategies'
                });
              }
            }
          }
        }

        if (sections.length > 0) {
          console.log(`✅ [RecommendationContentService] Recovered ${sections.length} sections from truncated V4 response`);
          const recovered = {
            version: '4.0' as '4.0',
            contentTitle: titleMatch ? titleMatch[1] : 'Content (Recovered)',
            sections,
            callToAction: '', // Default if missing
            requiredInputs: []
          };
          if (this.isValidGeneratedContent(recovered)) {
            return this.normalizeGeneratedContent(recovered);
          }
        }
      }
    } catch (e) {
      console.warn('[PARSE] Strategy 3.5 (V4 recovery) failed:', (e as Error).message);
    }

    // Strategy 4: Fix incomplete/truncated JSON (missing closing braces/quotes)
    try {
      let cleaned = raw.trim();

      // Remove markdown code blocks first
      const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonBlockMatch) {
        cleaned = jsonBlockMatch[1].trim();
      } else {
        // Extract JSON object (find first {, keep everything after)
        const jsonMatch = cleaned.match(/\{[\s\S]*/);
        if (jsonMatch) {
          cleaned = jsonMatch[0];
        }
      }

      // Count opening vs closing braces/brackets
      const openBraces = (cleaned.match(/\{/g) || []).length;
      const closeBraces = (cleaned.match(/\}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;

      let fixed = cleaned;

      // Fix incomplete strings - find fields that have opening quotes but no closing quotes
      // Find pattern like: "fieldName": "incomplete value... (no closing quote)
      // We'll find the last incomplete string and close it properly

      // Look for field patterns that end without a closing quote before the string ends
      // Pattern: "fieldName": "value... (end of string)
      const incompleteFieldPattern = /"([^"]+)":\s*"([^"]*)$/;
      const incompleteMatch = fixed.match(incompleteFieldPattern);

      if (incompleteMatch) {
        // We have an incomplete field - close it
        const fieldName = incompleteMatch[1];
        const incompleteValue = incompleteMatch[2];

        // Find the position where this field starts
        const fieldKey = `"${fieldName}": "`;
        const fieldStartPos = fixed.lastIndexOf(fieldKey);

        if (fieldStartPos >= 0) {
          // Extract everything before the incomplete field
          const beforeField = fixed.substring(0, fieldStartPos + fieldKey.length);
          // The incomplete value starts after the field key
          // We need to properly escape and close it
          const valueToClose = incompleteValue
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/"/g, '\\"')    // Escape quotes
            .replace(/\n/g, '\\n');  // Escape newlines

          // Reconstruct with properly closed string
          fixed = beforeField + valueToClose + '"';
        }
      }

      // Add missing closing brackets/braces
      const missingBrackets = openBrackets - closeBrackets;
      const missingBraces = openBraces - closeBraces;

      if (missingBrackets > 0) {
        fixed += ']'.repeat(missingBrackets);
      }
      if (missingBraces > 0) {
        fixed += '}'.repeat(missingBraces);
      }

      // Try to fix trailing commas
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

      try {
        const parsed = JSON.parse(fixed);
        if (this.isValidGeneratedContent(parsed)) {
          return this.normalizeGeneratedContent(parsed);
        }
      } catch (parseErr) {
        // If still fails, try Strategy 5
      }
    } catch {
      // Continue to next strategy
    }

    // Strategy 5: More aggressive truncation recovery - try to reconstruct from partial structure
    try {
      let cleaned = raw.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*/);
      if (!jsonMatch) return null;

      cleaned = jsonMatch[0];

      // Try to extract what we can and construct a minimal valid structure
      const versionMatch = cleaned.match(/"version"\s*:\s*"([^"]+)"/);
      const version = versionMatch ? versionMatch[1] : '2.0';

      const recIdMatch = cleaned.match(/"recommendationId"\s*:\s*"([^"]+)"/);
      const recId = recIdMatch ? recIdMatch[1] : '';

      const brandMatch = cleaned.match(/"brandName"\s*:\s*"([^"]+)"/);
      const brandName = brandMatch ? brandMatch[1] : '';

      const domainMatch = cleaned.match(/"domain"\s*:\s*"([^"]+)"/);
      const domain = domainMatch ? domainMatch[1] : '';

      const modeMatch = cleaned.match(/"mode"\s*:\s*"([^"]+)"/);
      const mode = modeMatch ? modeMatch[1] : 'post_on_source';

      const sourceTypeMatch = cleaned.match(/"sourceType"\s*:\s*"([^"]+)"/);
      const sourceType = sourceTypeMatch ? sourceTypeMatch[1] : 'other';

      // Try to extract email subject if present
      const emailSubjectMatch = cleaned.match(/"subjectLine"\s*:\s*"([^"]+)"/);
      const emailSubject = emailSubjectMatch ? emailSubjectMatch[1] : '';

      // Helper function to extract string value (complete or incomplete)
      const extractStringValue = (fieldName: string): string => {
        const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
        const match = cleaned.match(fieldPattern);
        if (!match) return '';

        const startPos = match.index! + match[0].length;
        let pos = startPos;
        let foundClosing = false;

        // Look for the closing quote (handle escaped characters)
        while (pos < cleaned.length) {
          if (cleaned[pos] === '\\' && pos + 1 < cleaned.length) {
            pos += 2; // Skip escaped character (\\, \", \n, etc.)
          } else if (cleaned[pos] === '"') {
            foundClosing = true;
            break;
          } else {
            pos++;
          }
        }

        // Extract the value (even if incomplete)
        const value = cleaned.substring(startPos, foundClosing ? pos : cleaned.length);

        // Unescape the value
        return value
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '\r')
          .replace(/\\\\/g, '\\');
      };

      // Extract email body (might be incomplete)
      const emailBody = extractStringValue('emailBody');

      // Try to extract content title and body
      const contentTitleMatch = cleaned.match(/"title"\s*:\s*"([^"]+)"/);
      const contentTitle = contentTitleMatch ? contentTitleMatch[1] : '';

      // Extract content body (might be incomplete)
      const content = extractStringValue('content');

      const contentTypeMatch = cleaned.match(/"type"\s*:\s*"([^"]+)"/);
      const contentType = contentTypeMatch ? contentTypeMatch[1] : 'other';

      // Only proceed if we have minimum required fields (content can be empty if truncated, we'll handle it)
      if (recId && brandName && domain) {
        const reconstructed: any = {
          version,
          recommendationId: recId,
          brandName,
          targetSource: {
            domain,
            sourceType,
            mode,
            rationale: 'Content generated from partial response'
          },
          publishableContent: {
            type: contentType,
            title: contentTitle || 'Generated Content',
            content: content || (emailBody ? 'Content was truncated. Please see collaboration email above or regenerate.' : 'Content was truncated, please regenerate.')
          },
          keyPoints: [],
          requiredInputs: [],
          complianceNotes: []
        };

        // Add collaboration email if we have subject (body can be partial/truncated)
        if (emailSubject) {
          reconstructed.collaborationEmail = {
            subjectLine: emailSubject,
            emailBody: emailBody || 'Email body was truncated. Please regenerate or contact us directly.',
            cta: emailBody ? 'Please contact us to discuss further.' : 'Please regenerate content to get the complete email body.'
          };
        }

        // Try to extract keyPoints if present
        const keyPointsMatch = cleaned.match(/"keyPoints"\s*:\s*\[(.*?)\]/s);
        if (keyPointsMatch) {
          try {
            const keyPointsStr = '[' + keyPointsMatch[1] + ']';
            reconstructed.keyPoints = JSON.parse(keyPointsStr);
          } catch {
            // Ignore if can't parse
          }
        }

        if (this.isValidGeneratedContent(reconstructed)) {
          console.log('✅ [RecommendationContentService] Successfully reconstructed JSON from partial response');
          return this.normalizeGeneratedContent(reconstructed);
        }
      }
    } catch (err) {
      console.error('❌ [RecommendationContentService] Error in truncation recovery:', err);
    }

    // Log the raw response for debugging (first 1000 chars)
    console.warn('⚠️ [RecommendationContentService] Failed to parse JSON. Raw response (first 1000 chars):', raw.substring(0, 1000));
    return null;
  }

  private isLowQualityV2(parsed: any): boolean {
    try {
      const publishable = parsed?.publishableContent;
      const content = String(publishable?.content || '');
      const title = String(publishable?.title || '');

      // Too short / obviously not a full draft
      if (content.length < 1200) return true;

      // Placeholder-ish artifacts
      if (/\[[^\]]+\]/.test(content) || /<[^>]+>/.test(content) || /\bTBD\b/i.test(content)) return true;

      // Must contain key headings (case-insensitive)
      const mustHave = ['tl;dr', 'why this matters', 'step-by-step', 'checklist', 'common mistakes', 'faq', 'cta'];
      const lower = `${title}\n${content}`.toLowerCase();
      const missing = mustHave.filter(h => !lower.includes(h));
      if (missing.length >= 2) return true;

      // Avoid introducing new org/community names (best-effort heuristic)
      // If the draft says "Case Study: X's Journey" and X is not the brand name, likely fabricated.
      const brandName = String(parsed?.brandName || '').toLowerCase();
      const caseStudyTitle = title.toLowerCase();
      if (caseStudyTitle.includes('case study:') && brandName && !caseStudyTitle.includes(brandName)) return true;

      return false;
    } catch {
      return true;
    }
  }

  private isValidGeneratedContent(parsed: any): boolean {
    if (!parsed || typeof parsed !== 'object') return false;

    // Check version
    const version = parsed.version;
    if (version !== '1.0' && version !== '2.0' && version !== '3.0' && version !== '4.0' && version !== '5.0' && version !== 'guide_v1') {
      console.warn(`[VALIDATION FAIL] Invalid version: ${version}`);
      return false;
    }

    // Common required fields - FSA assets (with assetType) and v5.0 (Unified) don't require recommendationId in the response
    const isFsaAsset = !!parsed.assetType;
    const isV5 = version === '5.0';
    if (!isFsaAsset && !isV5 && !parsed.recommendationId) {
      console.warn('[VALIDATION FAIL] Missing recommendationId (non-FSA)');
      return false;
    }
    if (!parsed.brandName) {
      console.warn('[VALIDATION FAIL] Missing brandName');
      return false;
    }

    // Content formats require targetSource; guides and v4.0 refinement don't require domain
    if (version !== 'guide_v1' && version !== '4.0') {
      if (!parsed.targetSource?.domain) return false;
      // v3.0 doesn't require 'mode' field
      if (version !== '3.0' && !parsed.targetSource?.mode) return false;
    }

    // Version-specific validation
    if (version === '1.0') {
      return !!parsed.whatToPublishOrSend?.readyToPaste;
    } else if (version === '2.0') {
      // v2.0 requires publishableContent
      if (!parsed.publishableContent?.content || !parsed.publishableContent?.type) return false;
      return true;
    } else if (version === '3.0') {
      // v3.0 simplified: requires publishableContent only
      const hasContent = parsed.publishableContent?.content && parsed.publishableContent?.type;
      return !!hasContent;
    } else if (version === '4.0') {
      // v4.0 supports both standard sectioned content AND FSA strategic assets
      const hasSections = Array.isArray(parsed.sections) && parsed.sections.length >= 1;
      const hasStandardTitle = !!parsed.contentTitle;
      const hasAssetType = !!parsed.assetType; // FSA marker

      if (hasAssetType) {
        // FSA-Specific Validation
        if (parsed.assetType === 'whitepaper') {
          if (!parsed.whitepaperMetadata) console.warn('[VALIDATION FAIL] Missing whitepaperMetadata');
          return !!parsed.whitepaperMetadata;
        }
        if (parsed.assetType === 'interactive_tool') {
          if (!parsed.toolBlueprint) console.warn('[VALIDATION FAIL] Missing toolBlueprint');
          return !!parsed.toolBlueprint;
        }
        if (parsed.assetType === 'comparison_table') {
          if (!parsed.comparisonTable) console.warn('[VALIDATION FAIL] Missing comparisonTable');
          return !!parsed.comparisonTable;
        }
        // Webinar/CaseStudy should have sections
        if (parsed.assetType === 'webinar_recap' && !hasSections) console.warn('[VALIDATION FAIL] Webinar missing sections');
        if (parsed.assetType === 'case_study' && !hasSections) console.warn('[VALIDATION FAIL] Case Study missing sections');
        return hasSections;
      }

      // Standard v4.0 requires sections and title
      if (!hasSections) console.warn('[VALIDATION FAIL] v4.0 missing sections');
      if (!hasStandardTitle) console.warn('[VALIDATION FAIL] v4.0 missing contentTitle');
      return !!(hasSections && hasStandardTitle);
    } else if (version === 'guide_v1') {
      // Guide v1: require at least an implementation plan or success criteria to be useful
      const hasPlan = Array.isArray(parsed.implementationPlan) && parsed.implementationPlan.length > 0;
      const hasSuccess = !!parsed.successCriteria;
      return hasPlan || hasSuccess;
    } else if (version === '5.0') {
      // v5.0 Unified Canvas: requires content and contentTitle
      if (!parsed.content || !parsed.contentTitle) return false;
      return true;
    }

    return false;
  }

  private normalizeGeneratedContent(parsed: Partial<GeneratedContentJsonV1 | GeneratedContentJsonV2 | GeneratedContentJsonV3 | GeneratedContentJsonV4 | GeneratedGuideJsonV1 | any>): GeneratedAnyJson {
    const version = parsed.version || '1.0';

    // Handle v5.0 (Unified Content - New System)
    if (version === '5.0') {
      const p5 = parsed as any;
      return {
        version: '5.0',
        recommendationId: String(p5.recommendationId || ''),
        brandName: String(p5.brandName || ''),
        contentTitle: String(p5.contentTitle || ''),
        content: String(p5.content || ''),
        requiredInputs: Array.isArray(p5.requiredInputs) ? p5.requiredInputs : []
      };
    }

    // Handle v4.0 (sectioned content for interactive refinement AND FSA strategic assets)
    if (version === '4.0') {
      const p4 = parsed as any; // Use any to access potential FSA fields

      // Extract title from asset-specific field if contentTitle is missing
      let extractedTitle = p4.contentTitle || '';
      if (!extractedTitle && p4.assetType) {
        if (p4.assetType === 'comparison_table' && p4.comparisonTable?.title) {
          extractedTitle = p4.comparisonTable.title;
        } else if (p4.assetType === 'interactive_tool' && p4.toolBlueprint?.toolName) {
          extractedTitle = p4.toolBlueprint.toolName;
        } else if (p4.assetType === 'whitepaper' && p4.whitepaperMetadata?.title) {
          extractedTitle = p4.whitepaperMetadata.title;
        } else if (p4.assetType === 'webinar_recap' && p4.webinarRecap?.title) {
          extractedTitle = p4.webinarRecap.title;
        } else if (p4.assetType === 'case_study' && p4.caseStudyMeta?.title) {
          extractedTitle = p4.caseStudyMeta.title;
        }
      }

      // Build base normalized structure
      const normalized: any = {
        version: '4.0',
        recommendationId: String(p4.recommendationId || ''),
        brandName: String(p4.brandName || ''),
        targetSource: {
          domain: String(p4.targetSource?.domain || ''),
          sourceType: (p4.targetSource?.sourceType as any) || 'other'
        },
        contentTitle: String(extractedTitle),
        sections: Array.isArray(p4.sections) ? p4.sections.map((s: any) => ({
          id: String(s.id || ''),
          title: String(s.title || ''),
          content: String(s.content || ''),
          sectionType: (s.sectionType as any) || 'custom'
        })) : [],
        callToAction: String(p4.callToAction || ''),
        requiredInputs: Array.isArray(p4.requiredInputs) ? p4.requiredInputs : []
      };

      // Preserve FSA asset-specific data for UI rendering (fixing key mismatches)
      if (p4.assetType) {
        normalized.assetType = p4.assetType;
        if (p4.comparisonTable) normalized.comparisonTable = p4.comparisonTable;
        if (p4.toolBlueprint) normalized.interactiveTool = p4.toolBlueprint; // Map toolBlueprint -> interactiveTool
        if (p4.whitepaperMetadata) normalized.whitepaperMeta = p4.whitepaperMetadata; // Map whitepaperMetadata -> whitepaperMeta
        if (p4.webinarRecap) normalized.webinarRecap = p4.webinarRecap;
        if (p4.caseStudyMeta) normalized.caseStudyMeta = p4.caseStudyMeta;
      }

      return normalized;
    }

    // Handle v3.0 (simplified: publishable content only)
    if (version === '3.0') {
      const p3 = parsed as Partial<GeneratedContentJsonV3>;
      return {
        version: '3.0',
        recommendationId: String(p3.recommendationId || ''),
        brandName: String(p3.brandName || ''),
        targetSource: {
          domain: String(p3.targetSource?.domain || ''),
          sourceType: (p3.targetSource?.sourceType as any) || 'other'
        },
        publishableContent: {
          type: (p3.publishableContent?.type as any) || 'other',
          title: String(p3.publishableContent?.title || ''),
          content: String(p3.publishableContent?.content || ''),
          callToAction: String(p3.publishableContent?.callToAction || '')
        },
        requiredInputs: Array.isArray(p3.requiredInputs) ? p3.requiredInputs : []
      };
    }

    // Handle guide_v1 (cold-start implementation guides)
    if (version === 'guide_v1') {
      const g = parsed as Partial<GeneratedGuideJsonV1>;
      return {
        version: 'guide_v1',
        recommendationId: String(g.recommendationId || ''),
        brandName: String(g.brandName || ''),
        summary: g.summary || undefined,
        prerequisites: Array.isArray(g.prerequisites) ? g.prerequisites : [],
        implementationPlan: Array.isArray(g.implementationPlan) ? g.implementationPlan : [],
        templatesAndExamples: Array.isArray(g.templatesAndExamples) ? g.templatesAndExamples : [],
        successCriteria: g.successCriteria || undefined,
        ifAlreadyDone: g.ifAlreadyDone || undefined,
        commonMistakes: Array.isArray(g.commonMistakes) ? g.commonMistakes : [],
        nextBestActions: Array.isArray(g.nextBestActions) ? g.nextBestActions : []
      };
    }

    // Handle v1.0 format (backward compatibility)
    if (version === '1.0') {
      const p1 = parsed as Partial<GeneratedContentJsonV1>;
      const keyPoints = Array.isArray(p1.keyPoints) ? p1.keyPoints : [];
      const h2 = Array.isArray((parsed as any).seoAeo?.h2) ? (parsed as any).seoAeo.h2 : [];
      const faq = Array.isArray((parsed as any).seoAeo?.faq) ? (parsed as any).seoAeo.faq : [];
      const requiredInputs = Array.isArray(p1.requiredInputs) ? p1.requiredInputs : [];
      const complianceNotes = Array.isArray(p1.complianceNotes) ? p1.complianceNotes : [];

      return {
        version: '1.0',
        recommendationId: String(parsed.recommendationId || ''),
        brandName: String(parsed.brandName || ''),
        targetSource: {
          domain: String((parsed as any).targetSource?.domain || ''),
          mode: (parsed as any).targetSource?.mode === 'pitch_collaboration' ? 'pitch_collaboration' : 'post_on_source',
          rationale: String((parsed as any).targetSource?.rationale || '')
        },
        deliverable: {
          type: ((parsed as any).deliverable?.type as any) || 'other',
          placement: String((parsed as any).deliverable?.placement || '')
        },
        whatToPublishOrSend: {
          ...((parsed as any).whatToPublishOrSend?.subjectLine ? { subjectLine: String((parsed as any).whatToPublishOrSend.subjectLine) } : {}),
          readyToPaste: String((parsed as any).whatToPublishOrSend?.readyToPaste || ''),
          cta: String((parsed as any).whatToPublishOrSend?.cta || '')
        },
        keyPoints: keyPoints.map(String).slice(0, 6),
        seoAeo: {
          h1: String((parsed as any).seoAeo?.h1 || ''),
          h2: h2.map(String).slice(0, 8),
          faq: faq.map(String).slice(0, 8),
          snippetSummary: String((parsed as any).seoAeo?.snippetSummary || '')
        },
        requiredInputs: requiredInputs.map(String).slice(0, 12),
        complianceNotes: complianceNotes.map(String).slice(0, 12)
      } as GeneratedContentJsonV1;
    }

    // Handle v2.0 format
    const v2Parsed = parsed as Partial<GeneratedContentJsonV2>;
    const keyPoints = Array.isArray(v2Parsed.keyPoints) ? v2Parsed.keyPoints : [];
    const requiredInputs = Array.isArray(v2Parsed.requiredInputs) ? v2Parsed.requiredInputs : [];
    const complianceNotes = Array.isArray(v2Parsed.complianceNotes) ? v2Parsed.complianceNotes : [];
    const publishableContent = v2Parsed.publishableContent || {} as any;
    const metadata = publishableContent.metadata || {};

    const normalized: GeneratedContentJsonV2 = {
      version: '2.0',
      recommendationId: String(parsed.recommendationId || ''),
      brandName: String(parsed.brandName || ''),
      targetSource: {
        domain: String(v2Parsed.targetSource?.domain || ''),
        sourceType: v2Parsed.targetSource?.sourceType || 'other',
        mode: v2Parsed.targetSource?.mode === 'pitch_collaboration' ? 'pitch_collaboration' : 'post_on_source',
        rationale: String(v2Parsed.targetSource?.rationale || '')
      },
      publishableContent: {
        type: (publishableContent.type as any) || 'other',
        title: String(publishableContent.title || ''),
        content: String(publishableContent.content || ''),
        metadata: Object.keys(metadata).length > 0 ? {
          ...(metadata.h1 ? { h1: String(metadata.h1) } : {}),
          ...(Array.isArray(metadata.h2) ? { h2: metadata.h2.map(String).slice(0, 8) } : {}),
          ...(Array.isArray(metadata.faq) ? { faq: metadata.faq.map(String).slice(0, 8) } : {}),
          ...(metadata.snippetSummary ? { snippetSummary: String(metadata.snippetSummary) } : {}),
          ...(metadata.estimatedDuration ? { estimatedDuration: String(metadata.estimatedDuration) } : {}),
          ...(Array.isArray(metadata.scenes) ? { scenes: metadata.scenes.slice(0, 20) } : {}),
          ...(Array.isArray(metadata.keyVisuals) ? { keyVisuals: metadata.keyVisuals.map(String).slice(0, 10) } : {}),
          ...(Array.isArray(metadata.onScreenText) ? { onScreenText: metadata.onScreenText.map(String).slice(0, 10) } : {})
        } : undefined
      },
      keyPoints: keyPoints.map(String).slice(0, 6),
      requiredInputs: requiredInputs.map(String).slice(0, 12),
      complianceNotes: complianceNotes.map(String).slice(0, 12)
    };

    // Add collaborationEmail if present
    if (v2Parsed.collaborationEmail) {
      normalized.collaborationEmail = {
        subjectLine: String(v2Parsed.collaborationEmail.subjectLine || ''),
        emailBody: String(v2Parsed.collaborationEmail.emailBody || ''),
        cta: String(v2Parsed.collaborationEmail.cta || '')
      };
    }

    return normalized;
  }

  /**
   * Refine content sections based on user feedback
   */
  async refineContent(
    recommendationId: string,
    sections: Array<{
      id: string;
      title: string;
      content: string;
      feedback: string;
    }>,
    references: string,
    brandName: string,
    customerId?: string
  ): Promise<GeneratedContentJsonV4 | null> {
    try {
      // Build the refinement prompt
      const sectionFeedback = sections.map(s => {
        const feedbackLine = s.feedback?.trim() ? `\nUSER FEEDBACK: "${s.feedback}"` : '\nUSER FEEDBACK: (no feedback - keep as is)';
        return `
### ${s.title}
${s.content}
${feedbackLine}`;
      }).join('\n\n');

      const refinementPrompt = `You are refining content based on user feedback. Improve each section according to the feedback while maintaining AEO optimization.

RETURN ONLY VALID JSON. No markdown, no explanations.

=== ORIGINAL SECTIONS WITH FEEDBACK ===
${sectionFeedback}

${references ? `=== ADDITIONAL REFERENCES ===\n${references}\n` : ''}

=== INSTRUCTIONS ===
1. Address ALL user feedback for each section
2. Keep sections that have no feedback mostly the same (minor polish only)
3. Maintain AEO optimization: clear headings, specific numbers, FAQ format
4. Use [FILL_IN: X] for specific data you don't know
5. Keep the same section structure (id and sectionType)

=== JSON SCHEMA v4.0 ===
{
  "version": "4.0",
  "recommendationId": "${recommendationId}",
  "brandName": "${brandName}",
  "targetSource": { "domain": "", "sourceType": "article_site" },
  "contentTitle": "<improved overall title>",
  "sections": [
    {
      "id": "<same as original>",
      "title": "<improved title>",
      "content": "<improved content addressing feedback>",
      "sectionType": "<same as original>"
    }
  ],
  "callToAction": "<improved CTA>",
  "requiredInputs": ["<list of [FILL_IN:] items>"]
}

RULES:
- Each section.content = REAL TEXT, improved based on feedback
- Escape newlines as \\\\n in JSON strings
`;

      // Call LLM using OpenRouter (same as content generation)
      const orResult = await openRouterCollectorService.executeQuery({
        collectorType: 'content',
        prompt: refinementPrompt,
        maxTokens: 4000,
        temperature: 0.5,
        topP: 0.9,
        enableWebSearch: false
      });

      if (!orResult?.response) {
        console.error('[REFINE] OpenRouter call failed');
        return null;
      }

      const resultContent = orResult.response;
      console.log('[REFINE] OpenRouter model used:', orResult.model_used);

      // Parse the response
      console.log('[REFINE] Raw result content length:', resultContent?.length);
      const parsed = this.parseGeneratedContentJson(resultContent);
      console.log('[REFINE] Parsed result:', parsed ? 'SUCCESS' : 'NULL');
      if (parsed) {
        console.log('[REFINE] Parsed version:', parsed.version);
        console.log('[REFINE] Has sections:', Array.isArray((parsed as any).sections));
        const isValid = this.isValidGeneratedContent(parsed);
        console.log('[REFINE] Is valid:', isValid);
        if (isValid && parsed.version === '4.0') {
          const normalizedContent = this.normalizeGeneratedContent(parsed) as GeneratedContentJsonV4;

          // Save the refined content to the database (update existing row)
          console.log(`[REFINE] Attempting to save refined content. customerId: ${customerId}, recommendationId: ${recommendationId}`);
          if (customerId) {
            try {
              const { data: existing, error: fetchError } = await supabaseAdmin
                .from('recommendation_generated_contents')
                .select('id')
                .eq('recommendation_id', recommendationId)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              console.log(`[REFINE] Fetch existing result - existing: ${JSON.stringify(existing)}, fetchError: ${fetchError ? JSON.stringify(fetchError) : 'null'}`);

              if (fetchError) {
                console.error('[REFINE] Error fetching existing record:', fetchError);
              } else if (!existing) {
                console.error(`[REFINE] No existing content record found for recommendation ${recommendationId} - cannot update`);
              } else {
                console.log(`[REFINE] Found existing record id: ${existing.id}, updating with normalized content...`);
                const { error: updateError } = await supabaseAdmin
                  .from('recommendation_generated_contents')
                  .update({
                    content: JSON.stringify(normalizedContent),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existing.id)
                  .eq('customer_id', customerId);

                if (updateError) {
                  console.error('[REFINE] Failed to save refined content to DB:', updateError);
                } else {
                  console.log(`✅ [REFINE] Successfully saved refined content to DB for recommendation ${recommendationId}, record id: ${existing.id}`);
                }
              }
            } catch (saveError) {
              console.error('[REFINE] Error saving refined content to DB:', saveError);
            }
          } else {
            console.error('[REFINE] No customerId provided - cannot save to DB');
          }

          return normalizedContent;
        }
      }

      console.error('[REFINE] Failed to parse refinement response');
      return null;
    } catch (error) {
      console.error('[REFINE] Error refining content:', error);
      return null;
    }
  }
  /**
   * Get content for a recommendation
   */
  async getContent(recommendationId: string, customerId: string): Promise<RecommendationContentRecord | null> {

    const { data, error } = await supabaseAdmin
      .from('recommendation_generated_contents')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching recommendation content:', error);
      return null;
    }

    return data as any;
  }

  /**
   * Save section edits (title and content) for a recommendation's generated content.
   * Updates the existing content record in-place (does not create a new row).
   */
  async saveSectionEdits(
    recommendationId: string,
    customerId: string,
    sections: Array<{ id: string; title: string; content: string; sectionType: string }>
  ): Promise<RecommendationContentRecord | null> {
    try {
      // Fetch the latest content record
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('recommendation_generated_contents')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !existing) {
        console.error('[SAVE_SECTIONS] No existing content found for recommendation:', recommendationId);
        return null;
      }

      // Parse the existing content
      let parsedContent: any;
      try {
        parsedContent = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : existing.content;
      } catch (parseErr) {
        console.error('[SAVE_SECTIONS] Failed to parse existing content:', parseErr);
        return null;
      }

      // Verify it's v4.0 format with sections
      if (parsedContent.version !== '4.0' || !Array.isArray(parsedContent.sections)) {
        console.error('[SAVE_SECTIONS] Content is not v4.0 format with sections');
        return null;
      }

      // Create a map of edits by section ID
      const editsMap = new Map(sections.map(s => [s.id, s]));

      // Update sections with edits
      parsedContent.sections = parsedContent.sections.map((existingSection: any) => {
        const edit = editsMap.get(existingSection.id);
        if (edit) {
          return {
            ...existingSection,
            title: edit.title,
            content: edit.content,
            sectionType: edit.sectionType || existingSection.sectionType
          };
        }
        return existingSection;
      });

      // Update the same row in the database
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('recommendation_generated_contents')
        .update({
          content: JSON.stringify(parsedContent),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .eq('customer_id', customerId)
        .select('*')
        .single();

      if (updateError) {
        console.error('[SAVE_SECTIONS] Failed to update content:', updateError);
        return null;
      }

      console.log(`✅ [SAVE_SECTIONS] Successfully saved ${sections.length} section edits for recommendation ${recommendationId}`);
      return updated as any;
    } catch (error) {
      console.error('[SAVE_SECTIONS] Error saving section edits:', error);
      return null;
    }
  }

  /**
   * Save unified content (v5.0) for a recommendation.
   * Updates the existing content record in-place.
   */
  async saveUnifiedContent(
    recommendationId: string,
    customerId: string,
    content: string
  ): Promise<RecommendationContentRecord | null> {
    try {
      // Fetch the latest content record
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('recommendation_generated_contents')
        .select('*')
        .eq('recommendation_id', recommendationId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError || !existing) {
        console.error('[SAVE_UNIFIED] No existing content found for recommendation:', recommendationId);
        return null;
      }

      // Parse the existing content to check version or just overwrite
      let parsedContent: any;
      try {
        parsedContent = typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : existing.content;
      } catch (parseErr) {
        // Fallback to simple object if parsing fails
        parsedContent = { version: '5.0', content: '' };
      }

      // Update content field
      parsedContent.content = content;
      // Ensure it's marked as v5.0 if we're saving unified content
      parsedContent.version = '5.0';

      // Update the same row in the database
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('recommendation_generated_contents')
        .update({
          content: JSON.stringify(parsedContent),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .eq('customer_id', customerId)
        .select('*')
        .single();

      if (updateError) {
        console.error('[SAVE_UNIFIED] Failed to update content:', updateError);
        return null;
      }

      console.log(`✅ [SAVE_UNIFIED] Successfully saved unified content for recommendation ${recommendationId}`);
      return updated as any;
    } catch (error) {
      console.error('[SAVE_UNIFIED] Error saving unified content:', error);
      return null;
    }
  }
}

export const recommendationContentService = new RecommendationContentService();

