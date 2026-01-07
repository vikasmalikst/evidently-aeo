/**
 * Recommendation Content Service
 *
 * Generates small, actionable content drafts for a given recommendation and persists them.
 * Uses Cerebras as primary provider and OpenRouter as fallback.
 */

import { supabaseAdmin } from '../../config/database';
import { getCerebrasKey, getCerebrasModel } from '../../utils/api-key-resolver';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';
import { shouldUseOllama, callOllamaAPI } from '../scoring/ollama-client.service';

export type RecommendationContentStatus = 'generated' | 'accepted' | 'rejected';
export type RecommendationContentProvider = 'cerebras' | 'openrouter' | 'ollama';

export interface GenerateRecommendationContentRequest {
  contentType?: string; // e.g. 'draft', 'blog_intro', 'faq', 'linkedin_post'
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

type GeneratedContentJson = GeneratedContentJsonV1 | GeneratedContentJsonV2;

// Source detection utility
function detectSourceType(domain: string): 'youtube' | 'article_site' | 'collaboration_target' | 'other' {
  const domainLower = domain.toLowerCase().trim();
  
  // YouTube detection
  const youtubeDomains = ['youtube.com', 'youtu.be', 'm.youtube.com', 'www.youtube.com'];
  if (youtubeDomains.some(d => domainLower.includes(d))) {
    return 'youtube';
  }
  
  // Known editorial/article sites
  const articleSitePatterns = [
    'techcrunch', 'forbes', 'wired', 'theverge', 'engadget', 'ars-technica',
    'healthline', 'webmd', 'mayoclinic', 'nih.gov', 'medicalnewstoday',
    'medium', 'dev.to', 'hashnode', 'smashingmagazine', 'css-tricks',
    'wikipedia', 'britannica', 'encyclopedia',
    'nytimes', 'wsj', 'theguardian', 'bbc', 'cnn', 'reuters',
    'hbr', 'harvard', 'stanford', 'mit.edu',
    'reddit', 'quora', 'stackoverflow', 'stackexchange'
  ];
  
  if (articleSitePatterns.some(pattern => domainLower.includes(pattern))) {
    return 'article_site';
  }
  
  // Default to other (will be determined by mode)
  return 'other';
}

class RecommendationContentService {
  private cerebrasApiKey: string | null;
  private cerebrasModel: string;

  constructor() {
    this.cerebrasApiKey = getCerebrasKey();
    this.cerebrasModel = getCerebrasModel();
    if (!this.cerebrasApiKey) {
      console.warn('⚠️ [RecommendationContentService] CEREBRAS_API_KEY not configured');
    }
  }

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
      return null;
    }

    // Fetch brand context (lightweight)
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name, industry, summary')
      .eq('id', rec.brand_id)
      .eq('customer_id', customerId)
      .single();

    const contentType = request.contentType || 'draft';

    const projectContext = `You are generating content for AnswerIntel (Evidently): a platform that helps brands improve their visibility in AI answers.
We track brand performance across AI models (visibility, Share of Answers, sentiment) and citation sources.
Your content should help the customer's brand improve the targeted KPI by executing the recommendation.\n`;

    const recommendationContext = `Brand\n- Name: ${brand?.name || 'Unknown'}\n- Industry: ${brand?.industry || 'Unknown'}\n- Summary: ${brand?.summary || 'N/A'}\n\nRecommendation\n- Action: ${rec.action}\n- KPI: ${rec.kpi}\n- Focus area: ${rec.focus_area}\n- Priority: ${rec.priority}\n- Effort: ${rec.effort}\n- Timeline: ${rec.timeline}\n- Expected boost: ${rec.expected_boost || 'TBD'}\n\nEvidence & metrics\n- Citation source: ${rec.citation_source}\n- Impact score: ${rec.impact_score}\n- Mention rate: ${rec.mention_rate}\n- Visibility: ${rec.visibility_score}\n- SOA: ${rec.soa}\n- Sentiment: ${rec.sentiment}\n- Citations: ${rec.citation_count}\n\nFocus\n- Focus sources: ${rec.focus_sources}\n- Content focus: ${rec.content_focus}\n\nReason\n${rec.reason}\n\nExplanation\n${rec.explanation}`;

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

    // Build content description
    const contentDesc = isYouTube
      ? 'Structured video script with timing: [Scene 1: Hook 0:00-0:15] Opening hook... [Scene 2: Introduction 0:15-0:45] Introduction... [Scene 3: Main Content 0:45-4:00] Main content... [Scene 4: CTA 4:00-4:30] Call-to-action...'
      : isArticleSite
        ? 'Full article content ready to publish. Include: Compelling introduction, Well-structured body with clear sections, Conclusion. Keep it 600-800 words, citation-friendly, authoritative.'
        : 'Content ready to publish, formatted appropriately for the target source';

    // Build metadata template
    const metadataTemplate = isYouTube
      ? '"estimatedDuration": "<e.g., 4:30>", "scenes": [{"start": "0:00", "end": "0:15", "type": "hook", "content": "<hook>"}], "keyVisuals": ["<visual 1>"], "onScreenText": ["<text 1>"]'
      : isArticleSite
        ? '"h1": "<main heading>", "h2": ["<subheading 1>", "<subheading 2>"], "faq": ["<FAQ 1>"], "snippetSummary": "<summary>"'
        : '';

    // Build collaboration email section
    const collaborationEmailSection = preferredMode === 'pitch_collaboration'
      ? '"collaborationEmail": {"subjectLine": "<compelling subject>", "emailBody": "<professional email body, 200-300 words>", "cta": "<clear call-to-action>"},'
      : '';

    // Build content constraints
    const contentConstraints = isYouTube
      ? 'Video script must be engaging, visual, and include clear timing/scenes.'
      : isArticleSite
        ? 'Article must be authoritative, well-researched, and citation-friendly with proper structure.'
        : '';

    const instructions = `You are a senior marketing consultant and AEO strategist.

CRITICAL: You MUST return ONLY valid JSON. Do NOT include markdown code blocks, do NOT include any text before or after the JSON, do NOT include explanations. Return ONLY the raw JSON object starting with { and ending with }.

SOURCE TYPE: ${sourceTypeDesc}

GOAL:
- Generate TWO separate sections: (1) Collaboration Email (for pitching/outreach) and (2) Publishable Content (ready to publish/post)
- For YouTube: Generate video script with scenes and timing
- For article sites: Generate full article with H1/H2/FAQ structure
- For collaboration targets: Generate professional email pitch + article content

STRICT FORMAT v2.0 (must match exactly):
{
  "version": "2.0",
  "recommendationId": "${rec.id}",
  "brandName": "${brand?.name || 'Brand'}",
  "targetSource": {
    "domain": "${rec.citation_source || ''}",
    "sourceType": "${detectedSourceType}",
    "mode": "${preferredMode}",
    "rationale": "<1-2 sentences explaining mode selection>"
  },
  ${collaborationEmailSection}
  "publishableContent": {
    "type": "${contentTypeValue}",
    "title": "<compelling title for the content>",
    "content": "${contentDesc}",
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
- **CRITICAL**: Do NOT mention any competitor names in the generated content. Do NOT include competitor names in the collaboration email, publishable content, key points, or any other field. Focus solely on the brand's own value proposition, features, and benefits.
- Keep content aligned to the recommendation, KPI, focus area, and citation source.
${contentConstraints ? `- ${contentConstraints}` : ''}
- Collaboration email should be professional, concise, and value-focused.`;

    const prompt = `${projectContext}\nRecommendation ID: ${rec.id}\n\n${recommendationContext}\n\n${instructions}`;

    // Call providers - Ollama (if enabled) → OpenRouter → Cerebras
    let content: string | null = null;
    let providerUsed: RecommendationContentProvider | undefined;
    let modelUsed: string | undefined;

    // Try Ollama first (if enabled for this brand)
    const useOllama = await shouldUseOllama(rec.brand_id);
    if (useOllama) {
      try {
        console.log('🦙 [RecommendationContentService] Attempting Ollama API (primary for this brand)...');
        const systemMessage = 'You are a senior marketing consultant and AEO strategist. Generate content for recommendations. Respond only with valid JSON, no markdown code blocks, no explanations.';
        const ollamaResponse = await callOllamaAPI(systemMessage, prompt, rec.brand_id);
        
        // Ollama returns JSON string, may need parsing
        let parsedContent = ollamaResponse;
        
        // Remove markdown code blocks if present
        if (parsedContent.includes('```json')) {
          parsedContent = parsedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        } else if (parsedContent.includes('```')) {
          parsedContent = parsedContent.replace(/```\s*/g, '');
        }
        
        // Extract JSON object if wrapped in other text
        const jsonMatch = parsedContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedContent = jsonMatch[0];
        }
        
        content = parsedContent;
        if (content) {
          providerUsed = 'ollama';
          modelUsed = 'ollama'; // Ollama model name is in config, not returned in response
          console.log('✅ [RecommendationContentService] Ollama API succeeded');
        } else {
          console.warn('⚠️ [RecommendationContentService] Ollama returned empty content');
        }
      } catch (e: any) {
        console.error('❌ [RecommendationContentService] Ollama API failed:', e.message || e);
        console.log('🔄 [RecommendationContentService] Falling back to OpenRouter...');
      }
    }

    // Try OpenRouter if Ollama not enabled or failed
    if (!content) {
      try {
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 2000, // Increased from 900 to handle v2.0 format with multiple sections
          temperature: 0.6,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response;
        providerUsed = 'openrouter';
        modelUsed = or.model_used;
      } catch (e) {
        console.error('❌ [RecommendationContentService] OpenRouter failed, trying Cerebras fallback:', e);
      }
    }

    // Fallback to Cerebras if both Ollama and OpenRouter failed
    if (!content && this.cerebrasApiKey) {
      const result = await this.callCerebras(prompt);
      if (result?.content) {
        content = result.content;
        providerUsed = 'cerebras';
        modelUsed = result.model;
      }
    }

    if (!content) return null;

    const parsed = this.parseGeneratedContentJson(content);
    if (!parsed) {
      console.warn('⚠️ [RecommendationContentService] LLM did not return valid JSON. Storing raw response.');
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
          format: parsed ? (parsed.version === '2.0' ? 'json_v2' : 'json_v1') : 'raw_text',
          raw_response: parsed ? content : undefined
        },
        created_at: now,
        updated_at: now
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ [RecommendationContentService] Error inserting generated content:', insertError);
      return null;
    }

    return {
      record: inserted as any,
      providerUsed,
      modelUsed
    };
  }

  private async callCerebras(prompt: string): Promise<{ content: string; model: string } | null> {
    if (!this.cerebrasApiKey) return null;

    try {
      const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cerebrasApiKey}`
        },
        body: JSON.stringify({
          model: this.cerebrasModel,
          messages: [
            {
              role: 'system',
              content: 'You are a senior content strategist. Produce concise, brand-safe drafts optimized for answer engines (AEO).'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2000, // Increased to handle v2.0 format with multiple sections
          temperature: 0.6
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [RecommendationContentService] Cerebras API error:', response.status, errorText);
        return null;
      }

      const data = (await response.json()) as CerebrasChatResponse;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return null;

      return { content, model: this.cerebrasModel };
    } catch (e) {
      console.error('❌ [RecommendationContentService] Cerebras call failed:', e);
      return null;
    }
  }

  private parseGeneratedContentJson(raw: string): GeneratedContentJson | null {
    if (!raw || typeof raw !== 'string') return null;

    // Strategy 1: Try direct JSON parse
    try {
      const parsed = JSON.parse(raw.trim());
      if (this.isValidGeneratedContent(parsed)) {
        return this.normalizeGeneratedContent(parsed);
      }
    } catch {
      // Continue to next strategy
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

  private isValidGeneratedContent(parsed: any): boolean {
    if (!parsed || typeof parsed !== 'object') return false;
    
    // Check version
    const version = parsed.version;
    if (version !== '1.0' && version !== '2.0') return false;
    
    // Common required fields
    if (!parsed.recommendationId || !parsed.brandName) return false;
    if (!parsed.targetSource?.domain || !parsed.targetSource?.mode) return false;
    
    // Version-specific validation
    if (version === '1.0') {
      return !!parsed.whatToPublishOrSend?.readyToPaste;
    } else if (version === '2.0') {
      // v2.0 requires publishableContent
      if (!parsed.publishableContent?.content || !parsed.publishableContent?.type) return false;
      // Collaboration email is optional even for collaboration mode
      return true;
    }
    
    return false;
  }

  private normalizeGeneratedContent(parsed: Partial<GeneratedContentJsonV1 | GeneratedContentJsonV2>): GeneratedContentJson {
    const version = parsed.version || '1.0';
    
    // Handle v1.0 format (backward compatibility)
    if (version === '1.0') {
      const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      const h2 = Array.isArray((parsed as any).seoAeo?.h2) ? (parsed as any).seoAeo.h2 : [];
      const faq = Array.isArray((parsed as any).seoAeo?.faq) ? (parsed as any).seoAeo.faq : [];
      const requiredInputs = Array.isArray(parsed.requiredInputs) ? parsed.requiredInputs : [];
      const complianceNotes = Array.isArray(parsed.complianceNotes) ? parsed.complianceNotes : [];

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
    const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
    const requiredInputs = Array.isArray(parsed.requiredInputs) ? parsed.requiredInputs : [];
    const complianceNotes = Array.isArray(parsed.complianceNotes) ? parsed.complianceNotes : [];
    
    const v2Parsed = parsed as Partial<GeneratedContentJsonV2>;
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
}

export const recommendationContentService = new RecommendationContentService();
