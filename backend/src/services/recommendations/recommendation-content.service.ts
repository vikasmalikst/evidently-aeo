/**
 * Recommendation Content Service
 *
 * Generates small, actionable content drafts for a given recommendation and persists them.
 * Uses Cerebras as primary provider and OpenRouter as fallback.
 */

import { supabaseAdmin } from '../../config/database';
import { getCerebrasKey, getCerebrasModel } from '../../utils/api-key-resolver';
import { openRouterCollectorService } from '../data-collection/openrouter-collector.service';

export type RecommendationContentStatus = 'generated' | 'accepted' | 'rejected';
export type RecommendationContentProvider = 'cerebras' | 'openrouter';

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

type GeneratedContentJson = {
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
  requiredInputs: string[]; // what the marketer needs to fill in / verify
  complianceNotes: string[];
};

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

    const instructions = `You are a senior marketing consultant and AEO strategist.

Return ONLY valid JSON (no markdown, no prose outside JSON).

GOAL:
- The user wants something they can ACTUALLY do: either (A) content they can post directly on the target source, or (B) a collaboration pitch they can send to the target source to get placement.
- Prefer (B) when the target source is an external editorial site (like WebMD, Healthline, etc.). Prefer (A) when the target source is brand-owned or realistically controllable.

STRICT FORMAT (must match exactly):
{
  "version": "1.0",
  "recommendationId": "<string>",
  "brandName": "<string>",
  "targetSource": {
    "domain": "<string>",
    "mode": "post_on_source" | "pitch_collaboration",
    "rationale": "<1-2 sentences explaining why this mode is best>"
  },
  "deliverable": {
    "type": "guest_article" | "expert_quote" | "faq" | "product_page_update" | "press_pitch" | "other",
    "placement": "<where this goes, e.g. 'Healthline guest post', 'Email pitch to WebMD editor', 'Brand site FAQ page'>"
  },
  "whatToPublishOrSend": {
    "subjectLine": "<required if mode=pitch_collaboration, otherwise omit>",
    "readyToPaste": "<the exact copy the user should paste/send. Keep it concise, max ~350 words. No placeholders in the main body unless unavoidable.>",
    "cta": "<single sentence: the next action to take>"
  },
  "keyPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
  "seoAeo": {
    "h1": "<string>",
    "h2": ["<string>", "<string>", "<string>"],
    "faq": ["<question 1>", "<question 2>"],
    "snippetSummary": "<1-2 sentences, snippet-worthy>"
  },
  "requiredInputs": ["<facts/links the marketer must verify or add, e.g. clinical study URLs, certification proof>"],
  "complianceNotes": ["<brand-safe constraints, no medical claims, etc.>"]
}

CONSTRAINTS:
- Do NOT invent clinical studies, certifications, or regulatory claims. If needed, put them under requiredInputs.
- Do NOT promise outcomes; speak in probabilities.
- Do NOT mention internal tool/provider names.
- Keep content aligned to the recommendation, KPI, focus area, and citation source.

Populate recommendationId with the provided recommendation id. Content type: ${contentType}`;

    const prompt = `${projectContext}\nRecommendation ID: ${rec.id}\n\n${recommendationContext}\n\n${instructions}`;

    // Call providers
    let content: string | null = null;
    let providerUsed: RecommendationContentProvider | undefined;
    let modelUsed: string | undefined;

    if (this.cerebrasApiKey) {
      const result = await this.callCerebras(prompt);
      if (result?.content) {
        content = result.content;
        providerUsed = 'cerebras';
        modelUsed = result.model;
      }
    }

    if (!content) {
      try {
        const or = await openRouterCollectorService.executeQuery({
          collectorType: 'content',
          prompt,
          maxTokens: 900,
          temperature: 0.6,
          topP: 0.9,
          enableWebSearch: false
        });
        content = or.response;
        providerUsed = 'openrouter';
        modelUsed = or.model_used;
      } catch (e) {
        console.error('❌ [RecommendationContentService] OpenRouter fallback failed:', e);
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
          format: parsed ? 'json_v1' : 'raw_text',
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
          max_tokens: 900,
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
    try {
      let cleaned = raw.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
      if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
      if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned) as Partial<GeneratedContentJson>;

      // Minimal validation + normalization
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.version !== '1.0') return null;
      if (!parsed.recommendationId || !parsed.brandName) return null;
      if (!parsed.targetSource?.domain || !parsed.targetSource?.mode || !parsed.whatToPublishOrSend?.readyToPaste) return null;

      // Ensure arrays exist
      const keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [];
      const h2 = Array.isArray(parsed.seoAeo?.h2) ? parsed.seoAeo!.h2 : [];
      const faq = Array.isArray(parsed.seoAeo?.faq) ? parsed.seoAeo!.faq : [];
      const requiredInputs = Array.isArray(parsed.requiredInputs) ? parsed.requiredInputs : [];
      const complianceNotes = Array.isArray(parsed.complianceNotes) ? parsed.complianceNotes : [];

      return {
        version: '1.0',
        recommendationId: String(parsed.recommendationId),
        brandName: String(parsed.brandName),
        targetSource: {
          domain: String(parsed.targetSource.domain),
          mode: parsed.targetSource.mode === 'pitch_collaboration' ? 'pitch_collaboration' : 'post_on_source',
          rationale: String(parsed.targetSource.rationale || '')
        },
        deliverable: {
          type: (parsed.deliverable?.type as any) || 'other',
          placement: String(parsed.deliverable?.placement || '')
        },
        whatToPublishOrSend: {
          ...(parsed.whatToPublishOrSend?.subjectLine ? { subjectLine: String(parsed.whatToPublishOrSend.subjectLine) } : {}),
          readyToPaste: String(parsed.whatToPublishOrSend.readyToPaste),
          cta: String(parsed.whatToPublishOrSend.cta || '')
        },
        keyPoints: keyPoints.map(String).slice(0, 6),
        seoAeo: {
          h1: String(parsed.seoAeo?.h1 || ''),
          h2: h2.map(String).slice(0, 8),
          faq: faq.map(String).slice(0, 8),
          snippetSummary: String(parsed.seoAeo?.snippetSummary || '')
        },
        requiredInputs: requiredInputs.map(String).slice(0, 12),
        complianceNotes: complianceNotes.map(String).slice(0, 12)
      };
    } catch {
      return null;
    }
  }
}

export const recommendationContentService = new RecommendationContentService();
