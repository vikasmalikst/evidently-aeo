import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const huggingFaceToken = process.env.HUGGINGFACE_API_TOKEN;
const huggingFaceModelUrl =
  process.env.HF_SENTIMENT_MODEL_URL ??
  'https://router.huggingface.co/hf-inference/models/distilbert/distilbert-base-uncased-finetuned-sst-2-english';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
}

if (!huggingFaceToken) {
  throw new Error('Missing Hugging Face credentials (HUGGINGFACE_API_TOKEN)');
}

interface SentimentResult {
  label: string;
  score: number;
}

interface SentimentAnalysis extends SentimentResult {
  positiveSentences: string[];
  negativeSentences: string[];
}

export interface SentimentScoreOptions {
  customerId?: string;
  brandIds?: string[];
  since?: string;
  limit?: number;
}

const DEFAULT_SENTIMENT_LIMIT = 50;

export class SentimentScoringService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  }

  /**
   * Score sentiment for extracted_positions rows that do not yet have a sentiment result.
   * Returns the number of rows updated.
   */
  public async scorePending(options: SentimentScoreOptions = {}): Promise<number> {
    const limit = Math.max(options.limit ?? DEFAULT_SENTIMENT_LIMIT, 1);
    if (options.customerId) {
    }
    if (options.brandIds?.length) {
    }
    if (options.since) {
    }
    let query = this.supabase
      .from('extracted_positions')
      .select(
        'id, raw_answer, sentiment_label, sentiment_score, sentiment_positive_sentences, sentiment_negative_sentences'
      )
      .is('sentiment_label', null)
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }
    if (options.brandIds && options.brandIds.length > 0) {
      query = query.in('brand_id', options.brandIds);
    }
    if (options.since) {
      query = query.gte('processed_at', options.since);
    }

    const { data: rows, error } = await query;

    if (error) {
      throw error;
    }

    if (!rows || rows.length === 0) {
      return 0;
    }

    let processed = 0;

    for (const row of rows) {
      try {
        const sentiment = await this.analyzeSentiment(row.raw_answer ?? '');

        const { error: updateError } = await this.supabase
          .from('extracted_positions')
          .update({
            sentiment_label: sentiment.label,
            sentiment_score: sentiment.score,
            sentiment_positive_sentences: JSON.stringify(sentiment.positiveSentences),
            sentiment_negative_sentences: JSON.stringify(sentiment.negativeSentences),
          })
          .eq('id', row.id);

        if (updateError) {
          throw updateError;
        }

        processed += 1;
      } catch (scoringError) {
        const message =
          scoringError instanceof Error ? scoringError.message : String(scoringError);
        console.error(
          `❌ Failed sentiment scoring for extracted_positions.id=${row.id}: ${message}`
        );
      }
    }
    return processed;
  }

  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    if (!text || text.trim().length === 0) {
      return { label: 'NEUTRAL', score: 0, positiveSentences: [], negativeSentences: [] };
    }

    const chunks = this.chunkTextForModel(text);
    const chunkScores: number[] = [];

    for (const chunk of chunks) {
      const result = await this.callModel(chunk);
      const normalized = this.normalizeScore(result.label, result.score);
      chunkScores.push(normalized);
    }

    const sentences = this.extractSentences(text);
    const sentenceResults = await this.scoreSentences(sentences);

    const aggregatedScore =
      chunkScores.length === 0
        ? 0
        : chunkScores.reduce((sum, score) => sum + score, 0) / chunkScores.length;

    const label =
      aggregatedScore > 0.1 ? 'POSITIVE' : aggregatedScore < -0.1 ? 'NEGATIVE' : 'NEUTRAL';

    return {
      label,
      score: Math.round(aggregatedScore * 100) / 100,
      positiveSentences: sentenceResults.positive,
      negativeSentences: sentenceResults.negative,
    };
  }

  private extractTopCandidate(payload: any): { label: string; score: number } | null {
    if (Array.isArray(payload)) {
      if (payload.length === 0) {
        return null;
      }

      const first = payload[0];
      if (Array.isArray(first) && first.length > 0) {
        return typeof first[0] === 'object' ? first[0] : null;
      }

      if (typeof first === 'object' && first !== null) {
        return first as { label: string; score: number };
      }
    }

    if (payload?.label && payload?.score !== undefined) {
      return payload as { label: string; score: number };
    }

    return null;
  }

  private normalizeScore(label: string, score: number): number {
    const upperLabel = label.toUpperCase();
    const boundedScore = Math.max(0, Math.min(1, score ?? 0));

    if (upperLabel.includes('NEG')) {
      return -boundedScore;
    }

    if (upperLabel.includes('POS')) {
      return boundedScore;
    }

    return 0;
  }

  private truncateToWordLimit(text: string, limit = 480): string {
    const words = text.split(/\s+/);
    if (words.length <= limit) {
      return text;
    }
    return words.slice(0, limit).join(' ');
  }

  private chunkTextForModel(text: string, maxTokensPerChunk = 450): string[] {
    const sentences = this.extractSentences(text);
    if (sentences.length === 0) {
      return [];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      const candidate =
        currentChunk.length > 0 ? `${currentChunk} ${sentence}` : sentence;
      if (candidate.split(/\s+/).length > maxTokensPerChunk) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        currentChunk = sentence;
      } else {
        currentChunk = candidate;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private async scoreSentences(sentences: string[]): Promise<{
    positive: string[];
    negative: string[];
  }> {
    const positive: string[] = [];
    const negative: string[] = [];

    const limitedSentences = sentences.slice(0, 12);

    for (const sentence of limitedSentences) {
      const trimmed = sentence.trim();
      if (!trimmed) continue;

      try {
        const result = await this.callModel(trimmed);
        const normalized = this.normalizeScore(result.label, result.score);

        if (normalized >= 0.3) {
          positive.push(trimmed);
        } else if (normalized <= -0.3) {
          negative.push(trimmed);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
      }
    }

    return { positive, negative };
  }

  private async callModel(text: string): Promise<{ label: string; score: number }> {
    const truncated = this.truncateToWordLimit(text, 450);

    const response = await fetch(huggingFaceModelUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${huggingFaceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: truncated }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const candidate = this.extractTopCandidate(data);
    if (!candidate) {
      return { label: 'UNKNOWN', score: 0 };
    }
    return candidate;
  }

  private extractSentences(text: string): string[] {
    return text
      .replace(/\r?\n+/g, ' ')
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }
}

export const sentimentScoringService = new SentimentScoringService();