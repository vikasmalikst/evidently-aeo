import { supabaseAdmin } from '../../config/database';
import { AeoAuditResult, TestResult, BotAccessStatus } from './types';
import * as Analyzers from './analyzers/index';
import axios from 'axios';

export type DomainReadinessBucket =
  | 'technicalCrawlability'
  | 'contentQuality'
  | 'semanticStructure'
  | 'accessibilityAndBrand'
  | 'botAccess';

export type DomainReadinessProgressEvent =
  | {
      type: 'progress';
      analyzer: string;
      bucket: Exclude<DomainReadinessBucket, 'botAccess'>;
      tests: TestResult[];
      completed: number;
      total: number;
    }
  | {
      type: 'progress';
      analyzer: string;
      bucket: 'botAccess';
      botAccessStatus: BotAccessStatus[];
      completed: number;
      total: number;
    }
  | {
      type: 'final';
      result: AeoAuditResult;
    };

export class DomainReadinessService {
  private calculateScore(tests: TestResult[]): number {
    if (tests.length === 0) return 0;
    const sum = tests.reduce((acc, t) => acc + t.score, 0);
    return Math.round(sum / tests.length);
  }

  private buildResult(params: {
    brandId: string;
    domain: string;
    userId?: string;
    techTests: TestResult[];
    contentTests: TestResult[];
    semanticTests: TestResult[];
    accessTests: TestResult[];
    botAccessStatus: BotAccessStatus[];
  }): AeoAuditResult {
    const techScore = this.calculateScore(params.techTests);
    const contentScore = this.calculateScore(params.contentTests);
    const semanticScore = this.calculateScore(params.semanticTests);
    const accessScore = this.calculateScore(params.accessTests);

    const overallScore = Math.round(
      techScore * 0.25 + contentScore * 0.35 + semanticScore * 0.25 + accessScore * 0.15
    );

    return {
      brandId: params.brandId,
      domain: params.domain,
      timestamp: new Date().toISOString(),
      overallScore,
      scoreBreakdown: {
        technicalCrawlability: techScore,
        contentQuality: contentScore,
        semanticStructure: semanticScore,
        accessibilityAndBrand: accessScore
      },
      detailedResults: {
        technicalCrawlability: { score: techScore, weight: 0.25, tests: params.techTests, recommendations: [] },
        contentQuality: { score: contentScore, weight: 0.35, tests: params.contentTests, recommendations: [] },
        semanticStructure: { score: semanticScore, weight: 0.25, tests: params.semanticTests, recommendations: [] },
        accessibilityAndBrand: { score: accessScore, weight: 0.15, tests: params.accessTests, recommendations: [] }
      },
      botAccessStatus: params.botAccessStatus,
      criticalIssues: [],
      improvementPriorities: [],
      metadata: {
        auditTrigger: 'manual',
        createdBy: params.userId,
        executionTimeMs: 0
      }
    };
  }

  private async saveAudit(params: {
    brandId: string;
    domain: string;
    overallScore: number;
    scoreBreakdown: AeoAuditResult['scoreBreakdown'];
    detailedResults: AeoAuditResult['detailedResults'];
    botAccessStatus: BotAccessStatus[];
    userId?: string;
    metadata: AeoAuditResult['metadata'];
  }): Promise<void> {
    const { error } = await supabaseAdmin.from('domain_readiness_audits').insert({
      brand_id: params.brandId,
      domain: params.domain,
      overall_score: params.overallScore,
      scores: params.scoreBreakdown,
      results: params.detailedResults,
      bot_access: params.botAccessStatus,
      created_by: params.userId,
      metadata: params.metadata
    });

    if (error) {
      throw new Error(`Failed to save domain readiness audit: ${error.message}`);
    }
  }

  async runAudit(brandId: string, userId?: string): Promise<AeoAuditResult> {
    // 1. Fetch Brand
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, homepage_url')
      .eq('id', brandId)
      .single();

    if (error || !brand || !brand.homepage_url) {
      throw new Error('Brand not found or missing homepage URL');
    }

    const domain = brand.homepage_url;
    const brandName = brand.name;

    // 2. Fetch HTML once
    let htmlContent: string | undefined;
    try {
      const response = await axios.get(domain, { 
        timeout: 10000,
        headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' },
        validateStatus: () => true
      });
      htmlContent = typeof response.data === 'string' ? response.data : undefined;
    } catch (e) {
      console.warn('Failed to pre-fetch HTML, analyzers will try individually');
    }

    const options = { html: htmlContent, brandName };

    const [
      basicCrawl,
      robots,
      llmsTxt,
      htmlStruct,
      metadata,
      schema,
      faq,
      canonical,
      freshness,
      accessibility,
      brandConsist,
      sitemap,
      botAccess
    ] = await Promise.all([
      Analyzers.analyzeBasicCrawlability(domain),
      Analyzers.analyzeRobotsTxt(domain),
      Analyzers.analyzeLlmsTxt(domain),
      Analyzers.analyzeHtmlStructure(domain, options),
      Analyzers.analyzeMetadata(domain, options),
      Analyzers.analyzeSchema(domain, options),
      Analyzers.analyzeFaq(domain, options),
      Analyzers.analyzeCanonical(domain, options),
      Analyzers.analyzeFreshness(domain, options),
      Analyzers.analyzeAccessibility(domain, options),
      Analyzers.analyzeBrandConsistency(domain, options),
      Analyzers.analyzeSitemap(domain, options),
      Analyzers.analyzeBotAccess(domain, options)
    ]);

    const techTests = [...basicCrawl, ...robots, ...sitemap, ...canonical, ...llmsTxt];
    const contentTests = [...freshness, ...faq, ...brandConsist];
    const semanticTests = [...schema, ...htmlStruct.filter(t => t.name !== 'Content Depth')];
    const accessTests = [...accessibility, ...metadata];

    const result = this.buildResult({
      brandId,
      domain,
      userId,
      techTests,
      contentTests,
      semanticTests,
      accessTests,
      botAccessStatus: botAccess as BotAccessStatus[]
    });

    await this.saveAudit({
      brandId,
      domain,
      overallScore: result.overallScore,
      scoreBreakdown: result.scoreBreakdown,
      detailedResults: result.detailedResults,
      botAccessStatus: result.botAccessStatus,
      userId,
      metadata: result.metadata
    });

    return result;
  }

  async runAuditStream(
    brandId: string,
    userId: string | undefined,
    onEvent: (event: DomainReadinessProgressEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, homepage_url')
      .eq('id', brandId)
      .single();

    if (error || !brand || !brand.homepage_url) {
      throw new Error('Brand not found or missing homepage URL');
    }

    const domain = brand.homepage_url;
    const brandName = brand.name;

    let htmlContent: string | undefined;
    try {
      const response = await axios.get(domain, {
        timeout: 10000,
        headers: { 'User-Agent': 'EvidentlyAEO-Auditor/1.0' },
        validateStatus: () => true
      });
      htmlContent = typeof response.data === 'string' ? response.data : undefined;
    } catch {
      htmlContent = undefined;
    }

    const options = { html: htmlContent, brandName };

    const total = 13;
    let completed = 0;

    const ensureNotAborted = () => {
      if (signal?.aborted) {
        const err = new Error('Client aborted');
        err.name = 'AbortError';
        throw err;
      }
    };

    const emitTests = (analyzer: string, bucket: Exclude<DomainReadinessBucket, 'botAccess'>, tests: TestResult[]) => {
      completed += 1;
      onEvent({ type: 'progress', analyzer, bucket, tests, completed, total });
    };

    const emitBotAccess = (analyzer: string, botAccessStatus: BotAccessStatus[]) => {
      completed += 1;
      onEvent({ type: 'progress', analyzer, bucket: 'botAccess', botAccessStatus, completed, total });
    };

    ensureNotAborted();
    const basicCrawl = await Analyzers.analyzeBasicCrawlability(domain);
    emitTests('analyzeBasicCrawlability', 'technicalCrawlability', basicCrawl);

    ensureNotAborted();
    const robots = await Analyzers.analyzeRobotsTxt(domain);
    emitTests('analyzeRobotsTxt', 'technicalCrawlability', robots);

    ensureNotAborted();
    const sitemap = await Analyzers.analyzeSitemap(domain, options);
    emitTests('analyzeSitemap', 'technicalCrawlability', sitemap);

    ensureNotAborted();
    const canonical = await Analyzers.analyzeCanonical(domain, options);
    emitTests('analyzeCanonical', 'technicalCrawlability', canonical);

    ensureNotAborted();
    const llmsTxt = await Analyzers.analyzeLlmsTxt(domain);
    emitTests('analyzeLlmsTxt', 'technicalCrawlability', llmsTxt);

    ensureNotAborted();
    const freshness = await Analyzers.analyzeFreshness(domain, options);
    emitTests('analyzeFreshness', 'contentQuality', freshness);

    ensureNotAborted();
    const faq = await Analyzers.analyzeFaq(domain, options);
    emitTests('analyzeFaq', 'contentQuality', faq);

    ensureNotAborted();
    const brandConsist = await Analyzers.analyzeBrandConsistency(domain, options);
    emitTests('analyzeBrandConsistency', 'contentQuality', brandConsist);

    ensureNotAborted();
    const schema = await Analyzers.analyzeSchema(domain, options);
    emitTests('analyzeSchema', 'semanticStructure', schema);

    ensureNotAborted();
    const htmlStruct = await Analyzers.analyzeHtmlStructure(domain, options);
    emitTests('analyzeHtmlStructure', 'semanticStructure', htmlStruct);

    ensureNotAborted();
    const accessibility = await Analyzers.analyzeAccessibility(domain, options);
    emitTests('analyzeAccessibility', 'accessibilityAndBrand', accessibility);

    ensureNotAborted();
    const metadata = await Analyzers.analyzeMetadata(domain, options);
    emitTests('analyzeMetadata', 'accessibilityAndBrand', metadata);

    ensureNotAborted();
    const botAccess = await Analyzers.analyzeBotAccess(domain, options);
    emitBotAccess('analyzeBotAccess', botAccess as BotAccessStatus[]);

    const techTests = [...basicCrawl, ...robots, ...sitemap, ...canonical, ...llmsTxt];
    const contentTests = [...freshness, ...faq, ...brandConsist];
    const semanticTests = [...schema, ...htmlStruct.filter(t => t.name !== 'Content Depth')];
    const accessTests = [...accessibility, ...metadata];

    const result = this.buildResult({
      brandId,
      domain,
      userId,
      techTests,
      contentTests,
      semanticTests,
      accessTests,
      botAccessStatus: botAccess as BotAccessStatus[]
    });

    await this.saveAudit({
      brandId,
      domain,
      overallScore: result.overallScore,
      scoreBreakdown: result.scoreBreakdown,
      detailedResults: result.detailedResults,
      botAccessStatus: result.botAccessStatus,
      userId,
      metadata: result.metadata
    });

    onEvent({ type: 'final', result });
  }

  async getLatestAudit(brandId: string): Promise<AeoAuditResult | null> {
    const { data, error } = await supabaseAdmin
      .from('domain_readiness_audits')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      brandId: data.brand_id,
      domain: data.domain,
      timestamp: data.created_at,
      overallScore: data.overall_score,
      scoreBreakdown: data.scores,
      detailedResults: data.results,
      botAccessStatus: data.bot_access,
      criticalIssues: [],
      improvementPriorities: [],
      metadata: data.metadata
    };
  }
}

export const domainReadinessService = new DomainReadinessService();
