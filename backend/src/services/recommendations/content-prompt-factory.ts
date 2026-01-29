/**
 * Content Prompt Factory (FSA Framework v2026.2)
 *
 * Centralizes all content generation prompt logic, separating it from the
 * service orchestration. Implements the "Container + Payload" model:
 * - Platform (Container): Where does it live? (Blog, YouTube, LinkedIn).
 *   Determined by `citationSource`.
 * - Asset (Payload): What is it? (Table, Tool, Webinar Recap).
 *   Determined by `action`.
 *
 * FSA Priorities:
 * 1. FRESHNESS: Inject temporal markers (current year, recent events).
 * 2. STRUCTURE: Enforce "Tired Machine" protocol (headers, bullets, direct answers).
 * 3. AUTHORITY: Entity-centric language (mention brand near key terms).
 */

import {
  ContentAssetType,
  ContentSectionType,
  InteractiveToolBlueprint,
  ComparisonTableData,
  WhitepaperMetadata,
  RecommendationV3,
  BrandContextV3,
} from './recommendation.types';

// ============================================================================
// FSA FRAMEWORK CONSTANTS
// ============================================================================

const FSA_FRESHNESS_INSTRUCTIONS = (currentYear: number) => `
FRESHNESS:
- Inject temporal markers: "Updated for ${currentYear}", "The ${currentYear} guide to..."
- Reference recent industry trends where applicable.
- Avoid evergreen phrasing that sounds dated.
`;

const FSA_STRUCTURE_INSTRUCTIONS = `
STRUCTURE ("Tired Machine" Protocol):
- AI engines SCAN, they don't read. Optimize for machine parsing.
- HEADER STRATEGY: Use QUESTIONS or DIRECT INTENT as headers (e.g., "How does X work?", "What is the best X for Y?").
- DIRECT ANSWER: The first sentence under any header must be the DIRECT ANSWER. No prefatory text.
- CHUNKING: No paragraph > 3 sentences. Use bullets for lists.
- MAX PARAGRAPH LENGTH: Each prose block <= 100 words.
`;

const FSA_AUTHORITY_INSTRUCTIONS = (brandName: string) => `
AUTHORITY (Entity Bond):
- Mention "${brandName}" in proximity to key terms to strengthen the entity-topic bond.
- State expertise explicitly (e.g., "As a platform specializing in...").
- Avoid generic claims without evidence.
`;

// ============================================================================
// ASSET TYPE DETECTION
// ============================================================================

interface AssetDetectionResult {
  asset: ContentAssetType;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detects the Content Asset Type from the recommendation action string.
 * 
 * Priority Order:
 * 1. Explicit content type keywords (article, whitepaper) - HIGHEST priority
 * 2. Specific asset types (calculator, tool, case study, webinar, video)
 * 3. Fallback to comparison if 'vs' present
 * 4. Default to article
 */
export function detectContentAsset(action: string): AssetDetectionResult {
  const actionLower = action.toLowerCase();

  // 1. EXPLICIT ARTICLE/BLOG - Highest priority
  // If the action explicitly says "article", "blog", or similar, treat it as an article
  // even if it contains comparison keywords like "vs"
  const articleKeywords = ['standard article', 'publish article', 'blog post', 'guest post', 'write article'];
  if (articleKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'article', confidence: 'high' };
  }

  // 2. EXPLICIT WHITEPAPER/REPORT - High priority
  const whitepaperKeywords = ['whitepaper', 'white paper', 'research report', 'industry report', 'ebook'];
  if (whitepaperKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'whitepaper', confidence: 'high' };
  }

  // 3. Interactive Tool Keywords
  const toolKeywords = ['calculator', 'widget', 'tool', 'estimate', 'roi calculator', 'quiz'];
  if (toolKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'interactive_tool', confidence: 'high' };
  }

  // 4. Case Study Keywords
  const caseStudyKeywords = ['case study', 'success story', 'customer story'];
  if (caseStudyKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'case_study', confidence: 'high' };
  }

  // 5. Webinar Keywords
  const webinarKeywords = ['webinar', 'recap', 'event summary', 'presentation', 'talk'];
  if (webinarKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'webinar_recap', confidence: 'high' };
  }

  // 6. Video/YouTube Keywords
  const videoKeywords = ['video', 'youtube', 'script', 'vlog'];
  if (videoKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'video_script', confidence: 'high' };
  }

  // 7. Comparison Table - Only if EXPLICITLY requested as a TABLE/COMPARISON
  // "comparison table", "create a comparison", "release a comparison table"
  const explicitComparisonKeywords = ['comparison table', 'create a comparison', 'release a comparison'];
  if (explicitComparisonKeywords.some(k => actionLower.includes(k))) {
    return { asset: 'comparison_table', confidence: 'high' };
  }

  // 8. Guide keyword (could be article or whitepaper depending on context)
  if (actionLower.includes('guide')) {
    // If it's a "selection guide", "buying guide" - treat as article with comparison elements
    return { asset: 'article', confidence: 'medium' };
  }

  // 9. Default to article
  return { asset: 'article', confidence: 'low' };
}

/**
 * Detects the Platform (Container) from the citation source domain.
 */
export type ContentPlatform =
  | 'reddit'
  | 'linkedin'
  | 'youtube'
  | 'dev_to'
  | 'owned_site'
  | 'article_site'
  | 'other';

export function detectPlatform(citationSource: string, brandDomain?: string): ContentPlatform {
  const sourceLower = citationSource.toLowerCase().trim();

  if (sourceLower.includes('youtube.com') || sourceLower.includes('youtu.be')) return 'youtube';
  if (sourceLower.includes('reddit.com')) return 'reddit';
  if (sourceLower.includes('linkedin.com')) return 'linkedin';
  if (sourceLower.includes('dev.to')) return 'dev_to';
  if (sourceLower === 'owned-site' || (brandDomain && sourceLower.includes(brandDomain.toLowerCase()))) return 'owned_site';

  // Known editorial sites
  const articlePatterns = [
    'techcrunch', 'forbes', 'wired', 'medium', 'hashnode', 'smashingmagazine',
    'wikipedia', 'quora', 'stackoverflow', 'hubspot', 'atlassian'
  ];
  if (articlePatterns.some(p => sourceLower.includes(p))) return 'article_site';

  return 'other';
}

// ============================================================================
// PROMPT GENERATION
// ============================================================================

export interface ContentPromptContext {
  recommendation: RecommendationV3;
  brandContext: BrandContextV3;
  assetType: ContentAssetType;
  platform: ContentPlatform;
}

/**
 * Main factory method: Returns the full prompt for a given content generation context.
 */
export function getContentPrompt(ctx: ContentPromptContext): string {
  const currentYear = new Date().getFullYear();
  const brandName = ctx.brandContext.brandName || 'Brand';

  // Build base instructions
  const systemPreamble = `You are EvidentlyAEO, an expert AI content generator specializing in "Generative Engine Optimization" (GEO).
You are generating content for AnswerIntel: a platform that helps brands improve their visibility in AI answers.

${FSA_FRESHNESS_INSTRUCTIONS(currentYear)}
${FSA_STRUCTURE_INSTRUCTIONS}
${FSA_AUTHORITY_INSTRUCTIONS(brandName)}
`;

  // Assemble recommendation context
  const recContext = buildRecommendationContext(ctx);

  // Constraint: If platform is YouTube, ASSET MUST BE VIDEO SCRIPT
  // This overrides the detected asset type (e.g. if action said "guide" but source is YT, make it a script)
  const effectiveAssetType = ctx.platform === 'youtube' ? 'video_script' : ctx.assetType;

  // Get asset-specific instructions
  const assetInstructions = getAssetSpecificInstructions(effectiveAssetType, brandName, ctx.recommendation, currentYear);

  return `${systemPreamble}

RECOMMENDATION DETAILS:
${recContext}

${assetInstructions}

CRITICAL RULES:
- Return ONLY valid JSON. No markdown code blocks.
- Escape newlines as \\n in JSON strings.
- Do NOT invent customer names, quotes, or hard numbers. Use [FILL_IN: description] for missing specifics.
- Do NOT mention any competitor domains as publishing destinations.
`;
}

function buildRecommendationContext(ctx: ContentPromptContext): string {
  const rec = ctx.recommendation;
  const brand = ctx.brandContext;

  return `- Brand: ${brand.brandName}
- Industry: ${brand.industry || 'Not specified'}
- Recommendation Action: ${rec.action}
- Target Source (Platform): ${rec.citationSource}
- KPI Focus: ${rec.kpi || 'Visibility Index'}
- Focus Area: ${rec.focusArea}
- Content Focus (Hint): ${rec.contentFocus || 'N/A'}
- Priority: ${rec.priority}
- Effort: ${rec.effort}
- Timeline: ${rec.timeline || '2-4 weeks'}
- Reason: ${rec.reason || 'N/A'}
- Explanation: ${rec.explanation || 'N/A'}`;
}

function getAssetSpecificInstructions(
  asset: ContentAssetType,
  brandName: string,
  rec: RecommendationV3,
  currentYear: number
): string {
  switch (asset) {
    case 'interactive_tool':
      return getInteractiveToolInstructions(brandName, rec);
    case 'comparison_table':
      return getComparisonTableInstructions(brandName, rec);
    case 'whitepaper':
      return getWhitepaperInstructions(brandName, rec);
    case 'webinar_recap':
      return getWebinarRecapInstructions(brandName, rec);
    case 'video_script':
      return getVideoScriptInstructions(brandName, rec);
    case 'case_study':
      return getCaseStudyInstructions(brandName, rec);
    default:
      return getStandardArticleInstructions(brandName, rec, currentYear);
  }
}

// --- Asset-Specific Prompt Templates ---

function getInteractiveToolInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: INTERACTIVE TOOL BLUEPRINT ===
You are generating a DETAILED BLUEPRINT/SPECIFICATION for a web-based interactive tool.
This is NOT executable code. It is a comprehensive document for a developer to implement.

QUALITY REQUIREMENTS:
- Provide SPECIFIC, actionable input/output definitions
- Include realistic default values and examples
- Write compelling introduction text (200-300 words)
- Define clear, understandable calculation logic in plain English

OUTPUT SCHEMA (InteractiveToolBlueprint):
{
  "version": "4.0",
  "assetType": "interactive_tool",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}", "sourceType": "owned_site" },
  "contentTitle": "<Tool Name - e.g., '${brandName} ROI Calculator'>",
  "toolBlueprint": {
    "toolName": "<Descriptive name>",
    "toolDescription": "<3-4 sentences explaining what the tool does and who it's for>",
    "inputs": [
      { 
        "name": "<camelCaseName>", 
        "label": "<User-Facing Label>", 
        "type": "number|text|select|range", 
        "defaultValue": "<realistic default>", 
        "validation": "<min/max or pattern>",
        "helpText": "<Tooltip explaining this input>",
        "options": ["<for select type only>"] 
      }
    ],
    "formula": "<Plain-English description of ALL calculation steps. Be specific: 'Step 1: Multiply monthly cost by 12 to get annual cost. Step 2: Calculate savings by...'>",
    "outputs": [
      { 
        "name": "<outputId>", 
        "label": "<User-Facing Label>", 
        "format": "currency|percentage|number|text",
        "description": "<What this output means>"
      }
    ],
    "seoSchema": { 
      "@type": "SoftwareApplication", 
      "name": "<Tool name>", 
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web Browser"
    }
  },
  "sections": [
    { "id": "intro", "title": "About This Tool", "content": "<200-300 word introduction explaining the tool's value proposition and why it solves a specific user problem>", "sectionType": "context" },
    { "id": "how_to_use", "title": "How to Use", "content": "<Detailed step-by-step instructions in numbered list>", "sectionType": "strategies" },
    { "id": "methodology", "title": "Our Methodology", "content": "<Explain the calculation approach and why it's reliable>", "sectionType": "context" },
    { "id": "cta", "title": "Next Steps", "content": "<What to do after using the tool>", "sectionType": "cta" }
  ],
  "requiredInputs": ["[FILL_IN: industry-specific benchmarks]", "[FILL_IN: typical customer values]"]
}
`;
}

function getComparisonTableInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: COMPARISON TABLE/GUIDE ===
You are generating a structured comparison between products/options.
This should be FAIR and BALANCED - not just marketing for ${brandName}.

QUALITY REQUIREMENTS:
- Compare 5-7 realistic features/criteria in DEPTH
- Be HONEST about where competitors might excel
- **CRITICAL:** The 'Detailed Analysis' section must be a FULL ARTICLE (600+ words) analyzing the differences.
- Do NOT just list features. Explain WHY they matter.

OUTPUT SCHEMA (ComparisonTableData):
{
  "version": "4.0",
  "assetType": "comparison_table",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}" },
  "contentTitle": "<Descriptive comparison title>",
  "comparisonTable": {
    "title": "<e.g., ${brandName} vs [Competitor]: Full Feature Comparison for [Year]>",
    "lastUpdated": "<current year>",
    "products": [
      { "name": "${brandName}", "description": "<Detailed positioning statement>" },
      { "name": "<Competitor>", "description": "<Detailed positioning statement>" }
    ],
    "criteria": [
      {
        "category": "<Category name>",
        "feature": "<Specific feature>",
        "values": {
          "${brandName}": "<specific capability or rating>",
          "<Competitor>": "<specific capability or rating>"
        },
        "winner": "<which is better or 'Tie'>",
        "notes": "<brief explanation>"
      }
    ],
    "verdict": "<3-4 sentences: who should choose which option>"
  },
  "sections": [
    { "id": "overview", "title": "Overview", "content": "<300-400 words introducing the comparison. Discuss market context and why this comparison matters now.>", "sectionType": "context" },
    { "id": "detailed_analysis", "title": "Deep Dive: Feature-by-Feature Analysis", "content": "<CRITICAL: This must be a comprehensive prose analysis (400-600 words). Go through each major difference. Explain the trade-offs. Use subheaders like '### Price vs Value', '### Durability Concerns'.>", "sectionType": "strategies" },
    { "id": "use_cases", "title": "Which Should You Choose?", "content": "<Detailed recommendations by user type/use case>\n\n**Choose ${brandName} if:**\n<bullet points with explanations>\n\n**Choose [Competitor] if:**\n<bullet points with explanations>", "sectionType": "summary" },
    { "id": "conclusion", "title": "Final Verdict", "content": "<Balanced conclusion summarizing key takeaways>", "sectionType": "cta" }
  ],
  "requiredInputs": ["[FILL_IN: specific pricing if available]", "[FILL_IN: competitor's latest features]"]
}

CRITICAL: Include BOTH the structured comparisonTable AND the prose sections. The prose should NOT just repeat the table but EXPAND upon it significantly.
`;
}

function getWhitepaperInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: WHITEPAPER / RESEARCH REPORT ===
You are generating COMPREHENSIVE CONTENT for a whitepaper.
This should be publication-ready content with significant depth and insights.

QUALITY REQUIREMENTS:
- Write FULL content for each chapter (MINIMUM 500-700 words per chapter)
- Each chapter must explore its topic thoroughly
- Include data points, statistics, and research insights
- Maintain authoritative, research-backed tone
- Use [FILL_IN:] for specific data that needs real research

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "assetType": "whitepaper",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}" },
  "contentTitle": "<Report Title: Descriptive and SEO-Optimized>",
  "whitepaperMetadata": {
    "subtitle": "<Compelling subtitle>",
    "targetAudience": "<Who should read this>",
    "keyFindings": ["<Finding 1>", "<Finding 2>", "<Finding 3>", "<Finding 4>"],
    "estimatedReadTime": "<e.g., 20-30 minutes>"
  },
  "sections": [
    { 
      "id": "executive_summary", 
      "title": "Executive Summary", 
      "content": "<4-5 paragraph summary covering: the problem, key findings, and recommended actions. Must be comprehensive.>", 
      "sectionType": "summary" 
    },
    { 
      "id": "introduction", 
      "title": "Introduction: The State of [Topic] in [Year]", 
      "content": "<Set the context. Why does this topic matter now? Include industry trends, market size, or recent developments. (400+ words)>", 
      "sectionType": "context" 
    },
    { 
      "id": "chapter_1", 
      "title": "<Chapter 1: Problem Definition>", 
      "content": "<Deep dive into the problem or opportunity. Use subheadings, bullet points, and examples. (600+ words)>", 
      "sectionType": "context" 
    },
    { 
      "id": "chapter_2", 
      "title": "<Chapter 2: Analysis & Insights>", 
      "content": "<Present research findings, data analysis, or case studies. Include: '### Key Insight 1\\n<content>\\n### Key Insight 2\\n<content>'. (600+ words)>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "chapter_3", 
      "title": "<Chapter 3: Best Practices & Recommendations>", 
      "content": "<Actionable recommendations based on research. Numbered list with detailed explanations for each point. (600+ words)>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "conclusion", 
      "title": "Conclusion & Next Steps", 
      "content": "<Summary of key takeaways + call to action for implementing recommendations (300+ words)>", 
      "sectionType": "cta" 
    },
    { 
      "id": "methodology", 
      "title": "Methodology", 
      "content": "<Note on how the research was conducted - adds credibility>", 
      "sectionType": "context" 
    }
  ],
  "callToAction": "<Clear CTA - download full report, contact for consultation, etc.>",
  "requiredInputs": ["[FILL_IN: specific industry statistics]", "[FILL_IN: survey data or research sources]", "[FILL_IN: case study company names]"]
}

TONE: Authoritative, research-backed, professional. Avoid marketing fluff.
`;
}

function getWebinarRecapInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: WEBINAR RECAP / EVENT SUMMARY ===
You are generating a COMPREHENSIVE recap of a webinar or event.

QUALITY REQUIREMENTS:
- **CRITICAL:** Do NOT write thin content. This recap must be valuable enough to stand alone.
- Write detailed summaries of key discussion points (not just brief bullets)
- Include formatted Q&A section with detailed answers
- Provide actionable takeaways readers can implement
- Make it scannable with clear headers but substantive in content

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "assetType": "webinar_recap",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}" },
  "contentTitle": "<Webinar Title Recap: [Key Topic]>",
  "webinarRecap": {
    "eventDate": "[FILL_IN: Date]",
    "speakers": ["[FILL_IN: Speaker Name, Title]"],
    "duration": "<e.g., 45 minutes>",
    "attendees": "[FILL_IN: number or 'Available on-demand']"
  },
  "sections": [
    { 
      "id": "key_takeaways", 
      "title": "Key Takeaways at a Glance", 
      "content": "<7-10 bullet points summarizing the most valuable insights>", 
      "sectionType": "summary" 
    },
    { 
      "id": "overview", 
      "title": "What This Webinar Covered", 
      "content": "<3-4 paragraphs (300+ words) introducing the topic, why it was timely, who the speakers were>", 
      "sectionType": "context" 
    },
    { 
      "id": "segment_1", 
      "title": "<Topic Segment 1 Title>", 
      "content": "<Detailed summary of this segment (400+ words): What was discussed? Key points? Examples given?>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "segment_2", 
      "title": "<Topic Segment 2 Title>", 
      "content": "<Detailed summary of this segment (400+ words)>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "segment_3", 
      "title": "<Topic Segment 3 Title>", 
      "content": "<Detailed summary of this segment (400+ words)>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "qa_highlights", 
      "title": "Audience Q&A Highlights", 
      "content": "<Format as:\\n\\n**Q: [Question]?**\\nA: [Detailed answer from speaker, at least 1-2 paragraphs per answer]\\n\\nRepeat for 5+ key questions>", 
      "sectionType": "faq" 
    },
    { 
      "id": "resources", 
      "title": "Resources Mentioned", 
      "content": "<Bullet list of any tools, reports, or resources mentioned during the webinar>", 
      "sectionType": "structured_list" 
    },
    { 
      "id": "watch_replay", 
      "title": "Watch the Full Replay", 
      "content": "<CTA to watch the recording or attend the next event>", 
      "sectionType": "cta" 
    }
  ],
  "callToAction": "<Link to recording or signup for next event>",
  "requiredInputs": ["[FILL_IN: event date]", "[FILL_IN: speaker names and titles]", "[FILL_IN: specific statistics or examples mentioned]"]
}
`;
}

function getCaseStudyInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: CASE STUDY ===
You are generating a DETAILED case study showcasing how ${brandName} helped a client.
Use [FILL_IN:] placeholders for client-specific details that need real input.

QUALITY REQUIREMENTS:
- Follow the Problem → Solution → Results narrative arc
- Include SPECIFIC metrics and outcomes (use [FILL_IN:] for real numbers)
- Write in a storytelling format, not bullet points
- Total content length should be substantial (1000+ words equivalent)

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "assetType": "case_study",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}" },
  "contentTitle": "Case Study: How [FILL_IN: Client Name] [Achieved X] with ${brandName}",
  "caseStudyMeta": {
    "clientName": "[FILL_IN: Client Name]",
    "industry": "[FILL_IN: Client Industry]",
    "companySize": "[FILL_IN: e.g., Mid-market, 200 employees]",
    "timeline": "[FILL_IN: e.g., 6 months]",
    "keyMetric": "[FILL_IN: e.g., 47% increase in...]"
  },
  "sections": [
    { 
      "id": "snapshot", 
      "title": "At a Glance", 
      "content": "**Client:** [FILL_IN: Client Name]\\n**Industry:** [FILL_IN: Industry]\\n**Challenge:** <1-line summary>\\n**Solution:** ${brandName} <1-line summary>\\n**Result:** [FILL_IN: Key metric improvement]", 
      "sectionType": "summary" 
    },
    { 
      "id": "challenge", 
      "title": "The Challenge", 
      "content": "<4-5 paragraphs describing in detail:\\n- Who is the client and what do they do?\\n- What problem were they facing?\\n- What was the business impact of this problem?\\n- What had they tried before that didn't work?>", 
      "sectionType": "context" 
    },
    { 
      "id": "solution", 
      "title": "The Solution", 
      "content": "<4-5 paragraphs describing in detail:\\n- How did ${brandName} approach the problem?\\n- What specific features/services were implemented?\\n- How was the implementation process?\\n- Any unique customizations or integrations?>", 
      "sectionType": "strategies" 
    },
    { 
      "id": "implementation", 
      "title": "Implementation Journey", 
      "content": "<3-4 paragraphs on the implementation timeline, any challenges overcome, training provided, etc.>", 
      "sectionType": "context" 
    },
    { 
      "id": "results", 
      "title": "The Results", 
      "content": "**Key Outcomes:**\\n\\n- [FILL_IN: X%] improvement in [metric]\\n- [FILL_IN: $X] saved/earned annually\\n- [FILL_IN: Time saved or efficiency gained]\\n\\n<4-5 paragraphs elaborating on these results and their business impact. Include qualitative benefits as well.>", 
      "sectionType": "case_study" 
    },
    { 
      "id": "testimonial", 
      "title": "What They Said", 
      "content": "> \\"[FILL_IN: Client testimonial quote about their experience with ${brandName}]\\"\\n>\\n> — [FILL_IN: Name, Title at Company]", 
      "sectionType": "summary" 
    },
    { 
      "id": "cta", 
      "title": "Ready to See Similar Results?", 
      "content": "<CTA inviting readers to contact ${brandName} for a consultation or demo>", 
      "sectionType": "cta" 
    }
  ],
  "callToAction": "Contact ${brandName} to learn how we can help your business achieve similar results.",
  "requiredInputs": ["[FILL_IN: Client Name]", "[FILL_IN: Industry]", "[FILL_IN: Key metrics - before/after]", "[FILL_IN: Client quote]", "[FILL_IN: Implementation timeline]"]
}

NARRATIVE TONE: Storytelling, credible, focused on client success (not ${brandName} features).
`;
}

function getStandardArticleInstructions(brandName: string, rec: RecommendationV3, currentYear: number): string {
  // Check if the action contains comparison elements for context
  const hasComparison = rec.action?.toLowerCase().includes('vs') || rec.action?.toLowerCase().includes('versus');
  const comparisonNote = hasComparison
    ? `\nNOTE: This article includes a COMPARISON element. Present the comparison in PROSE PARAGRAPHS, NOT tables. Describe each option's strengths/weaknesses in flowing text with clear headers.`
    : '';

  return `
=== ASSET TYPE: STANDARD ARTICLE (v4.0 Sectioned) ===
You are generating a structured article optimized for AEO/GEO.
${comparisonNote}

CRITICAL FORMATTING RULES:
- Write PROSE PARAGRAPHS, not markdown tables
- INCREASE LENGTH AND DEPTH: Each section should be SUBSTANTIAL (300-500 words per section)
- Use headers, bullets, and numbered lists for structure
- DO NOT use markdown table syntax (|---|---|) 
- Comparisons should be written as flowing prose with clear subheadings

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "brandName": "${brandName}",
  "targetSource": { "domain": "${rec.citationSource}", "sourceType": "<detect type>" },
  "contentTitle": "<Compelling title - Should include main topic, e.g., 'Marathon Shoe Buying Guide: A ${currentYear} Selection Guide'>",
  "sections": [
    { "id": "executive_summary", "title": "Quick Takeaways", "content": "<5-7 bullet points summarizing key insights>", "sectionType": "summary" },
    { "id": "introduction", "title": "<Direct Question or Statement>", "content": "<3-4 paragraphs (300+ words) introducing the topic, why it matters, who this is for>", "sectionType": "context" },
    { "id": "main_content", "title": "<Main Topic Header>", "content": "<In-depth analysis in prose. If comparing products, describe each option's pros/cons in flowing paragraphs with headers for each option. Aim for 500+ words within this section.>", "sectionType": "strategies" },
    { "id": "expert_insights", "title": "Expert Analysis: What to Look For", "content": "<Professional insights about the topic. Weave in ${brandName}'s expertise where relevant (300+ words)>", "sectionType": "context" },
    { "id": "recommendations", "title": "Our Recommendations for ${currentYear}", "content": "<Final recommendations based on different use cases or user types (300+ words)>", "sectionType": "strategies" },
    { "id": "faq", "title": "Frequently Asked Questions", "content": "<5-6 Q&As in H3 format: ### Question?\\n\\nAnswer paragraph (substantial answer)>", "sectionType": "faq" },
    { "id": "conclusion", "title": "Final Thoughts", "content": "<Summary + Call to action>", "sectionType": "cta" }
  ],
  "callToAction": "<Clear next step for the reader>",
  "requiredInputs": ["<[FILL_IN: X] placeholders used in content>"]
}

CONTENT QUALITY REQUIREMENTS:
- Write REAL sentences, not placeholders like "this section should cover..."
- Each section should be self-contained and valuable
- Avoid generic filler - be specific and actionable
- If making comparisons, compare fairly without bashing competitors
`;
}


// ============================================================================
// FACTORY EXPORT
// ============================================================================

function getVideoScriptInstructions(brandName: string, rec: RecommendationV3): string {
  return `
=== ASSET TYPE: VIDEO SCRIPT (YouTube) ===
You are generating a TIMED VIDEO SCRIPT optimized for engagement and retention.

OUTPUT SCHEMA (GeneratedContentJsonV4):
{
  "version": "4.0",
  "assetType": "video_script",
  "brandName": "${brandName}",
  "targetSource": { "domain": "youtube.com", "sourceType": "youtube" },
  "contentTitle": "<Video Title - Clickable/Punchy>",
  "sections": [
    { "id": "hook", "title": "Hook (0:00-0:45)", "content": "<Scene description + Script used to hook the viewer>", "sectionType": "intro" },
    { "id": "intro", "title": "Intro & Validation", "content": "<Who we are, why listen>", "sectionType": "context" },
    { "id": "part1", "title": "Key Point 1", "content": "<Main content>", "sectionType": "script_segment" },
    { "id": "part2", "title": "Key Point 2", "content": "<Main content>", "sectionType": "script_segment" },
    { "id": "part3", "title": "Key Point 3", "content": "<Main content>", "sectionType": "script_segment" },
    { "id": "cta", "title": "Outro & CTA", "content": "<Subscribe/Link in description>", "sectionType": "cta" }
  ],
  "callToAction": "<Description box link>",
  "requiredInputs": ["[FILL_IN: B-Roll footage description]"]
}
`;
}

export const contentPromptFactory = {
  detectContentAsset,
  detectPlatform,
  getContentPrompt,
};
