import { groqCompoundService, GROQ_MODELS } from '../recommendations/groq-compound.service';
import { mcpSearchService } from '../data-collection/mcp-search.service';
import axios from 'axios';
import {
    PHASE1_SYSTEM_PROMPT,
    PHASE2_SYSTEM_PROMPT,
    buildPhase1UserPrompt,
    buildPhase2UserPrompt,
} from './system-prompt';

/**
 * Shape of Phase 1 LLM output (Company + Competitors)
 */
interface Phase1Output {
    company_profile: {
        company_name: string;
        website: string;
        industry: string;
        description: string;
    };
    competitors: Array<{
        rank: number;
        company_name: string;
        domain: string;
    }>;
}

/**
 * Shape of Phase 2 LLM output (Queries)
 */
interface Phase2Output {
    queries: Array<{
        id: number;
        prompt: string;
        category: string;
        query_tag: 'branded' | 'neutral';
    }>;
}

/**
 * Mapped output aligned with BrandOnboardingData on the frontend
 */
export interface OnboardingV2Result {
    brand_name: string;
    website_url: string;
    industry: string;
    description: string;
    competitors: Array<{
        name: string;
        domain: string;
        rank: number;
        confidence_score: number;
        evidence_count: number;
        validation_status: 'validated' | 'needs_review';
    }>;
    queries: Array<{
        id: number;
        prompt: string;
        category: string;
        query_tag: 'branded' | 'neutral';
    }>;
    metadata: {
        model: string;
        research_date: string;
        tools_executed: number;
        country: string;
        phase1_duration_sec: number;
        phase2_duration_sec: number;
        competitor_validation: {
            candidates_found: number;
            validated_count: number;
            rejected_count: number;
            manual_review_required: boolean;
            strategy: string;
        };
    };
}

interface ScoredCompetitorCandidate {
    name: string;
    domain: string;
    evidenceCount: number;
    crossQueryHits: number;
    comparisonHits: number;
    geoHits: number;
    sourceDiversity: number;
    isLive: boolean;
    statusCode?: number;
    score: number;
    confidenceScore: number;
    fromPhase1: boolean;
}

type JsonRecord = Record<string, unknown>;

/**
 * Onboarding V2 Research Service
 *
 * Orchestrates a 2-phase LLM + web search pipeline:
 *   Phase 1: Company profile + competitor identification (10 iterations)
 *   Phase 2: Query generation, grounded in Phase 1 results (10 iterations)
 */
export class OnboardingV2ResearchService {

    /**
     * Domains that appear in search results but are NEVER actual competitors.
     * Includes: social media, aggregators, review sites, news/media, big tech
     * platforms, forums, Q&A, code hosting, blogging platforms, job boards, etc.
     *
     * We check both exact match and subdomain match (e.g. ell.stackexchange.com
     * matches stackexchange.com) so subdomains are covered automatically.
     */
    private readonly nonCompetitorHosts = new Set([
        // ── Social Media ──
        'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
        'linkedin.com', 'pinterest.com', 'snapchat.com', 'threads.net',
        // ── Video / Streaming ──
        'youtube.com', 'vimeo.com', 'twitch.tv', 'dailymotion.com',
        // ── Review / Comparison Aggregators ──
        'g2.com', 'capterra.com', 'trustradius.com', 'trustpilot.com',
        'softwareadvice.com', 'getapp.com', 'producthunt.com', 'alternativeto.net',
        'slant.co', 'sourceforge.net', 'saashub.com',
        // ── Q&A / Forums / Community ──
        'reddit.com', 'quora.com', 'stackexchange.com', 'stackoverflow.com',
        'superuser.com', 'serverfault.com', 'askubuntu.com', 'discourse.org',
        // ── Encyclopedias / Reference ──
        'wikipedia.org', 'wikimedia.org', 'britannica.com', 'fandom.com',
        // ── News / Media / Blogs ──
        'medium.com', 'substack.com', 'wordpress.com', 'blogspot.com',
        'techcrunch.com', 'theverge.com', 'wired.com', 'zdnet.com', 'cnet.com',
        'pcmag.com', 'mashable.com', 'engadget.com', 'arstechnica.com',
        'bbc.com', 'bbc.co.uk', 'nytimes.com', 'washingtonpost.com',
        'theguardian.com', 'reuters.com', 'apnews.com', 'forbes.com',
        'businessinsider.com', 'cnbc.com', 'bloomberg.com', 'inc.com',
        'entrepreneur.com', 'fastcompany.com', 'venturebeat.com',
        'thenextweb.com', 'gizmodo.com', 'lifehacker.com', 'howtogeek.com',
        // ── Code / Developer Platforms ──
        'github.com', 'gitlab.com', 'bitbucket.org', 'npmjs.com',
        'pypi.org', 'hub.docker.com',
        // ── Big Tech (platforms, not competitors unless user's brand IS one) ──
        'google.com', 'apple.com', 'microsoft.com', 'amazon.com',
        'play.google.com', 'apps.apple.com',
        // ── Business / Career / Data ──
        'crunchbase.com', 'glassdoor.com', 'indeed.com', 'yelp.com',
        'tripadvisor.com', 'bbb.org', 'sitejabber.com',
        // ── Education / Academic ──
        'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org',
        'scholar.google.com', 'researchgate.net', 'academia.edu',
        // ── Government / Standards ──
        'archive.org', 'w3.org', 'iana.org',
    ]);

    /**
     * Known two-part country-code TLDs.
     * Used by extractRootDomain() to correctly parse domains like
     * "example.co.uk" → keep 3 segments, not 2.
     */
    private readonly twoPartTLDs = new Set([
        'co.uk', 'co.in', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.id',
        'co.th', 'co.il', 'com.au', 'com.br', 'com.mx', 'com.sg',
        'com.hk', 'com.tw', 'com.ar', 'com.co', 'com.tr', 'com.pk',
        'com.ng', 'com.eg', 'com.my', 'com.ph', 'com.vn', 'com.ua',
        'org.uk', 'org.au', 'net.au', 'ac.uk', 'ac.in', 'ac.jp',
        'gov.uk', 'gov.au', 'ne.jp', 'or.jp', 'or.kr',
    ]);

    /**
     * Run the full 2-phase research pipeline.
     */
    async research(input: {
        brandName: string;
        country: string;
        websiteUrl: string;
        maxCompetitors?: number;
        maxQueries?: number;
    }): Promise<OnboardingV2Result> {
        const maxCompetitors = input.maxCompetitors ?? 10;
        let maxQueries = input.maxQueries ?? 20;

        // Ensure even number for 50/50 split
        if (maxQueries % 2 !== 0) {
            maxQueries += 1;
        }

        console.log(`🚀 [OnboardingV2] Starting 2-phase research for "${input.brandName}" (${input.country})`);
        console.log(`   Competitors: ${maxCompetitors}, Queries: ${maxQueries}`);

        let totalToolsExecuted = 0;

        // ─── Phase 1: Company Profile + Competitors ──────────────────────

        console.log(`\n📋 [OnboardingV2] ── Phase 1: Company Profile + Competitors ──`);
        const phase1Start = Date.now();

        const phase1UserPrompt = buildPhase1UserPrompt({
            brandName: input.brandName,
            websiteUrl: input.websiteUrl,
            country: input.country,
            maxCompetitors,
        });

        const phase1Response = await groqCompoundService.generateContent({
            systemPrompt: PHASE1_SYSTEM_PROMPT,
            userPrompt: phase1UserPrompt,
            model: GROQ_MODELS.LLAMA_70B,
            temperature: 0.4,
            maxTokens: 4096,
            jsonMode: false,
            enableWebSearch: true,
        });

        const phase1DurationSec = (Date.now() - phase1Start) / 1000;
        const phase1Tools = phase1Response.executedTools?.length ?? 0;
        totalToolsExecuted += phase1Tools;
        console.log(`✅ [OnboardingV2] Phase 1 complete in ${phase1DurationSec.toFixed(1)}s (${phase1Tools} tool calls)`);

        // Parse Phase 1 result
        const phase1Parsed = this.extractPhase1JSON(phase1Response.content);

        // Use ROOT domain for brand comparison (e.g. "www.example.com/page" → "example.com")
        const brandDomain = this.extractRootDomain(this.normalizeDomain(input.websiteUrl));
        const competitorSelection = await this.buildReliableCompetitorList({
            brandName: phase1Parsed.company_profile.company_name || input.brandName,
            industry: phase1Parsed.company_profile.industry || '',
            country: input.country,
            brandDomain,
            maxCompetitors,
            llmCandidates: phase1Parsed.competitors || [],
        });
        const competitors = competitorSelection.competitors;

        console.log(`   → Profile: ${phase1Parsed.company_profile.company_name} (${phase1Parsed.company_profile.industry})`);
        console.log(`   → Competitors validated: ${competitors.length}`);
        if (competitorSelection.manualReviewRequired) {
            console.warn(`   ⚠️ Competitor quality below threshold. Manual review recommended.`);
        }

        // ─── Keyword Discovery (code-level, no LLM) ─────────────────────

        console.log(`\n🔑 [OnboardingV2] ── Keyword Discovery (pre-Phase 2) ──`);
        const discoveryStart = Date.now();
        const trendingContext = await this.discoverTrendingKeywords(
            phase1Parsed.company_profile.company_name || input.brandName,
            phase1Parsed.company_profile.industry || '',
            input.country,
            competitors.slice(0, 3).map(c => c.name), // Top 3 competitors
        );
        const discoveryDurationSec = (Date.now() - discoveryStart) / 1000;
        console.log(`✅ [OnboardingV2] Keyword discovery complete in ${discoveryDurationSec.toFixed(1)}s`);

        // ─── Phase 2: Query Generation ───────────────────────────────────

        console.log(`\n🔍 [OnboardingV2] ── Phase 2: Query Generation ──`);
        const phase2Start = Date.now();

        const phase2UserPrompt = buildPhase2UserPrompt({
            brandName: phase1Parsed.company_profile.company_name || input.brandName,
            websiteUrl: phase1Parsed.company_profile.website || input.websiteUrl,
            country: input.country,
            industry: phase1Parsed.company_profile.industry || '',
            description: phase1Parsed.company_profile.description || '',
            competitors,
            maxQueries,
            trendingContext,
        });

        const phase2Response = await groqCompoundService.generateContent({
            systemPrompt: PHASE2_SYSTEM_PROMPT,
            userPrompt: phase2UserPrompt,
            model: GROQ_MODELS.LLAMA_70B,
            temperature: 0.4,
            maxTokens: 8192,
            jsonMode: false,
            enableWebSearch: true,
        });

        const phase2DurationSec = (Date.now() - phase2Start) / 1000;
        const phase2Tools = phase2Response.executedTools?.length ?? 0;
        totalToolsExecuted += phase2Tools;
        console.log(`✅ [OnboardingV2] Phase 2 complete in ${phase2DurationSec.toFixed(1)}s (${phase2Tools} tool calls)`);

        // Parse Phase 2 result
        const phase2Parsed = this.extractPhase2JSON(phase2Response.content);

        // ─── Post-process: Enforce 50/50 split ───────────────────────────
        const brandName = (phase1Parsed.company_profile.company_name || input.brandName).toLowerCase();
        const rawQueries = (phase2Parsed.queries || []).slice(0, maxQueries);
        const queries = this.enforce5050Split(rawQueries, brandName, maxQueries);

        console.log(`   → Queries generated: ${queries.length}`);
        const brandedCount = queries.filter(q => q.query_tag === 'branded').length;
        const neutralCount = queries.filter(q => q.query_tag === 'neutral').length;
        console.log(`   → Split: ${brandedCount} branded / ${neutralCount} neutral`);

        // ─── Merge Results ───────────────────────────────────────────────

        const totalDuration = phase1DurationSec + discoveryDurationSec + phase2DurationSec;
        console.log(`\n📊 [OnboardingV2] Research complete: ${competitors.length} competitors, ${queries.length} queries in ${totalDuration.toFixed(1)}s total`);

        const result: OnboardingV2Result = {
            brand_name: phase1Parsed.company_profile.company_name || input.brandName,
            website_url: phase1Parsed.company_profile.website || input.websiteUrl,
            industry: phase1Parsed.company_profile.industry || '',
            description: phase1Parsed.company_profile.description || '',
            competitors,
            queries,
            metadata: {
                model: phase1Response.model,
                research_date: new Date().toISOString().split('T')[0],
                tools_executed: totalToolsExecuted,
                country: input.country,
                phase1_duration_sec: Math.round(phase1DurationSec * 10) / 10,
                phase2_duration_sec: Math.round(phase2DurationSec * 10) / 10,
                competitor_validation: {
                    candidates_found: competitorSelection.candidatesFound,
                    validated_count: competitorSelection.validatedCount,
                    rejected_count: competitorSelection.rejectedCount,
                    manual_review_required: competitorSelection.manualReviewRequired,
                    strategy: 'retrieval-first + evidence scoring + liveness check + constrained rerank',
                },
            },
        };

        return result;
    }

    // ─── Competitor Reliability Pipeline (Phase A+B+C) ───────────────────────

    private async buildReliableCompetitorList(input: {
        brandName: string;
        industry: string;
        country: string;
        brandDomain: string;
        maxCompetitors: number;
        llmCandidates: Array<{ rank: number; company_name: string; domain: string }>;
    }): Promise<{
        competitors: Array<{
            name: string;
            domain: string;
            rank: number;
            confidence_score: number;
            evidence_count: number;
            validation_status: 'validated' | 'needs_review';
        }>;
        candidatesFound: number;
        validatedCount: number;
        rejectedCount: number;
        manualReviewRequired: boolean;
    }> {
        // ── Candidate map keyed by ROOT domain (not full hostname) ──
        const candidateMap = new Map<string, ScoredCompetitorCandidate>();
        const sourceIdsByCandidate = new Map<string, Set<string>>();
        const brandRoot = this.extractRootDomain(input.brandDomain);

        /**
         * Register or update a competitor candidate.
         *
         * KEY DESIGN DECISIONS:
         * 1. We key by ROOT domain so "ell.stackexchange.com" and
         *    "stackexchange.com" merge into ONE candidate.
         * 2. Phase 1 (LLM) names are ALWAYS preferred over domain-inferred
         *    names because the LLM provides proper company names like
         *    "Spotify" while domain inference might give "Spotify" or worse.
         * 3. Phase 1 candidates get a large initial evidence boost (+4)
         *    because the LLM actually identified them as competitors
         *    vs search results that might be informational pages.
         */
        const ensureCandidate = (
            name: string,
            domainInput: string,
            fromPhase1: boolean,
        ): ScoredCompetitorCandidate | null => {
            const fullDomain = this.normalizeDomain(domainInput);
            const rootDomain = this.extractRootDomain(fullDomain);

            // Use root domain for the stored domain (cleaner for display)
            const domain = rootDomain;
            const cleanName = this.normalizeCompanyName(name || this.domainToCompanyName(domain));

            if (!domain || !cleanName) return null;
            if (domain === brandRoot || fullDomain === input.brandDomain) return null;
            if (!this.isLikelyDomain(domain)) return null;
            if (this.isKnownAggregatorHost(domain)) return null;

            const key = rootDomain;
            if (!candidateMap.has(key)) {
                candidateMap.set(key, {
                    name: cleanName,
                    domain,
                    // Phase 1 candidates start with more evidence because
                    // the LLM explicitly named them as competitors.
                    evidenceCount: fromPhase1 ? 4 : 1,
                    crossQueryHits: 0,
                    comparisonHits: 0,
                    geoHits: 0,
                    sourceDiversity: 0,
                    isLive: false,
                    score: 0,
                    confidenceScore: 0,
                    fromPhase1,
                });
                sourceIdsByCandidate.set(key, new Set<string>());
            } else {
                const existing = candidateMap.get(key)!;
                if (fromPhase1 && !existing.fromPhase1) {
                    // Upgrade: this candidate was found via search first,
                    // but the LLM also identified it → use LLM name + boost.
                    existing.fromPhase1 = true;
                    existing.name = cleanName; // Prefer LLM-provided name
                    existing.evidenceCount += 3;
                } else if (fromPhase1) {
                    existing.evidenceCount += 2;
                }
            }

            return candidateMap.get(key)!;
        };

        // ── Step 1: Seed candidates from Phase 1 LLM output ──
        console.log(`   🔬 [Competitor Pipeline] Seeding ${input.llmCandidates.length} candidates from Phase 1 LLM`);
        for (const c of input.llmCandidates) {
            const added = ensureCandidate(c.company_name, c.domain, true);
            if (added) {
                console.log(`      ✅ LLM candidate: "${added.name}" (${added.domain})`);
            } else {
                console.log(`      ❌ LLM candidate rejected: "${c.company_name}" (${c.domain})`);
            }
        }

        // ── Step 2: Enrich with web search evidence ──
        const searchQueries = [
            `${input.brandName} alternatives ${input.country}`,
            `${input.brandName} vs competitors ${input.country}`,
            `top ${input.industry || input.brandName} companies ${input.country}`,
            `best alternatives to ${input.brandName}`,
            `${input.brandName} competitors`,
        ];

        console.log(`   🔍 [Competitor Pipeline] Running ${searchQueries.length} evidence searches...`);
        const searchResponses = await Promise.allSettled(
            searchQueries.map((q) => mcpSearchService.quickSearch(q, 6)),
        );

        for (let i = 0; i < searchResponses.length; i++) {
            const queryId = `q${i + 1}`;
            const response = searchResponses[i];
            if (response.status !== 'fulfilled') continue;

            for (const result of response.value.results) {
                const fullDomain = this.normalizeDomain(result.url);
                const rootDomain = this.extractRootDomain(fullDomain);

                if (!rootDomain || rootDomain === brandRoot) continue;
                if (this.isKnownAggregatorHost(fullDomain)) continue;

                // Use domain-inferred name for search-discovered candidates.
                // If this root domain already exists from Phase 1, the LLM
                // name is preserved (see ensureCandidate logic above).
                const inferredName = this.domainToCompanyName(rootDomain);
                const candidate = ensureCandidate(inferredName, rootDomain, false);
                if (!candidate) continue;

                candidate.evidenceCount += 1;
                const sourceSet = sourceIdsByCandidate.get(this.extractRootDomain(candidate.domain))!;
                if (sourceSet && !sourceSet.has(queryId)) {
                    sourceSet.add(queryId);
                    candidate.crossQueryHits += 1;
                }

                const text = `${result.title} ${result.content}`.toLowerCase();
                if (text.includes(' vs ') || text.includes('alternative')) {
                    candidate.comparisonHits += 1;
                }
                if (text.includes(input.country.toLowerCase())) {
                    candidate.geoHits += 1;
                }
            }
        }

        // ── Step 3: Validate domains + score ──
        const candidates = Array.from(candidateMap.values());
        console.log(`   📊 [Competitor Pipeline] ${candidates.length} unique candidates. Checking liveness...`);

        await Promise.all(candidates.map(async (candidate) => {
            const rootKey = this.extractRootDomain(candidate.domain);
            const liveCheck = await this.checkDomainLiveness(candidate.domain);
            candidate.isLive = liveCheck.isLive;
            candidate.statusCode = liveCheck.statusCode;
            candidate.sourceDiversity = sourceIdsByCandidate.get(rootKey)?.size || 0;
            candidate.score = this.scoreCandidate(candidate);
            candidate.confidenceScore = this.scoreToConfidence(candidate.score);
        }));

        // Log scoring for debugging
        for (const c of candidates) {
            console.log(`      ${c.isLive ? '✅' : '❌'} ${c.name} (${c.domain}) → score=${c.score} conf=${c.confidenceScore} live=${c.isLive} phase1=${c.fromPhase1} evidence=${c.evidenceCount}`);
        }

        // ── Step 4: Filter, rerank, trim ──
        const validated = candidates
            .filter((c) => c.isLive && c.confidenceScore >= 45)
            .sort((a, b) => b.score - a.score);

        console.log(`   ✅ [Competitor Pipeline] ${validated.length} candidates passed validation (${candidates.length - validated.length} rejected)`);

        const rejectedCount = candidates.length - validated.length;
        const reranked = await this.rerankCompetitorsWithLLM(input.brandName, validated, input.maxCompetitors);
        const trimmed = reranked.slice(0, input.maxCompetitors);

        const manualReviewRequired =
            trimmed.length < Math.max(3, Math.ceil(input.maxCompetitors * 0.6)) ||
            trimmed.some((c) => c.confidenceScore < 60);

        return {
            competitors: trimmed.map((c, idx) => ({
                name: c.name,
                domain: c.domain,
                rank: idx + 1,
                confidence_score: c.confidenceScore,
                evidence_count: c.evidenceCount,
                validation_status: c.confidenceScore >= 60 ? 'validated' : 'needs_review',
            })),
            candidatesFound: candidates.length,
            validatedCount: trimmed.length,
            rejectedCount,
            manualReviewRequired,
        };
    }

    private async rerankCompetitorsWithLLM(
        brandName: string,
        candidates: ScoredCompetitorCandidate[],
        maxCompetitors: number,
    ): Promise<ScoredCompetitorCandidate[]> {
        if (candidates.length <= 1) return candidates;

        try {
            const prompt = `Brand: ${brandName}
MaxCompetitors: ${maxCompetitors}

Candidates (use ONLY these IDs, do not invent new competitors):
${candidates.map((c, idx) => `${idx + 1}. ${c.name} (${c.domain}) score=${c.score} confidence=${c.confidenceScore}`).join('\n')}

Return JSON only in this format:
{"ranked_ids":[1,2,3]}

Rules:
- Use only existing IDs.
- No duplicates.
- Prefer higher score/confidence and direct competitive relevance.
- Return at most MaxCompetitors IDs.`;

            const response = await groqCompoundService.generateContent({
                systemPrompt: 'You are a strict ranking assistant. Never create new entities. Only reorder provided IDs.',
                userPrompt: prompt,
                model: GROQ_MODELS.LLAMA_70B,
                temperature: 0.1,
                maxTokens: 512,
                jsonMode: true,
                enableWebSearch: false,
            });

            const parsed = this.extractRawJSON(response.content);
            const rankedIds = Array.isArray(parsed.ranked_ids)
                ? parsed.ranked_ids.map((v: unknown) => Number(v)).filter((v: number) => Number.isInteger(v))
                : [];

            const selected: ScoredCompetitorCandidate[] = [];
            const used = new Set<number>();
            for (const id of rankedIds) {
                if (id < 1 || id > candidates.length || used.has(id)) continue;
                selected.push(candidates[id - 1]);
                used.add(id);
                if (selected.length >= maxCompetitors) break;
            }

            if (selected.length === 0) return candidates.sort((a, b) => b.score - a.score);
            return selected;
        } catch (error) {
            console.warn('⚠️ [OnboardingV2] LLM rerank failed, using deterministic ranking.', error);
            return candidates.sort((a, b) => b.score - a.score);
        }
    }

    /**
     * Score a competitor candidate based on evidence signals.
     *
     * Weight rationale:
     * - fromPhase1 (+8): The LLM explicitly identified this as a competitor.
     *   This is the strongest signal — the model had context about the brand
     *   and named this company. Worth more than any single search hit.
     * - evidenceCount (x2): Raw count of times this domain appeared across
     *   all sources (LLM seed + search results).
     * - crossQueryHits (x3): Number of DIFFERENT search queries that
     *   surfaced this domain. High diversity = strong signal.
     * - sourceDiversity (x2): Similar to crossQueryHits but counts unique
     *   query IDs in the source set.
     * - comparisonHits (x2): Appeared in "vs" or "alternatives" context —
     *   direct competitive intent signal.
     * - geoHits (x1): Mentioned alongside the target country.
     * - isLive (+6 / -8): Domain responds to HTTP. Dead domains are
     *   heavily penalized since they can't be real competitors.
     */
    private scoreCandidate(candidate: ScoredCompetitorCandidate): number {
        let score = 0;
        score += candidate.evidenceCount * 2;
        score += candidate.crossQueryHits * 3;
        score += candidate.sourceDiversity * 2;
        score += candidate.comparisonHits * 2;
        score += candidate.geoHits;
        // Phase 1 LLM identification is a high-value signal
        if (candidate.fromPhase1) score += 8;
        score += candidate.isLive ? 6 : -8;
        return score;
    }

    private scoreToConfidence(score: number): number {
        return Math.max(0, Math.min(100, Math.round(20 + score * 4)));
    }

    // ─── Domain & Name Utilities ────────────────────────────────────────────

    /**
     * Clean a raw URL/domain string down to a bare hostname.
     * Example: "https://www.app.tophat.com/page?x=1" → "app.tophat.com"
     */
    private normalizeDomain(input: string): string {
        if (!input) return '';
        let normalized = input.trim().toLowerCase();
        normalized = normalized.replace(/^https?:\/\//, '').replace(/^www\./, '');
        normalized = normalized.split('/')[0].split('?')[0].split('#')[0];
        return normalized;
    }

    /**
     * Extract the registerable root domain from a full hostname.
     * Handles common two-part country-code TLDs (co.uk, com.au, etc.).
     *
     * Examples:
     *   "ell.stackexchange.com" → "stackexchange.com"
     *   "app.tophat.com"        → "tophat.com"
     *   "blog.example.co.uk"    → "example.co.uk"
     *   "spotify.com"           → "spotify.com"
     */
    private extractRootDomain(domain: string): string {
        const parts = domain.split('.');
        if (parts.length <= 2) return domain;

        // Check for two-part TLDs like co.uk, com.au
        const lastTwo = parts.slice(-2).join('.');
        if (this.twoPartTLDs.has(lastTwo)) {
            return parts.slice(-3).join('.');
        }

        // Default: keep last 2 segments (e.g. tophat.com)
        return parts.slice(-2).join('.');
    }

    /**
     * Derive a human-readable company name from a root domain.
     * Example: "tophat.com" → "Tophat", "sound-hound.io" → "Sound Hound"
     */
    private domainToCompanyName(domain: string): string {
        const root = this.extractRootDomain(domain);
        const base = (root || '').split('.')[0] || '';
        return base
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (ch) => ch.toUpperCase())
            .trim();
    }

    /**
     * Clean a raw company name string (strip URLs, TLDs, normalize spaces).
     */
    private normalizeCompanyName(name: string): string {
        return (name || '')
            .replace(/https?:\/\//gi, '')
            .replace(/^www\./i, '')
            .replace(/\.[a-z]{2,}$/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Basic regex check that a string looks like a valid domain.
     */
    private isLikelyDomain(domain: string): boolean {
        return /^([a-z0-9][a-z0-9-]{0,62}\.)+[a-z]{2,24}$/i.test(domain);
    }

    /**
     * Check if a domain (or any subdomain of it) belongs to a known
     * non-competitor host (aggregator, social, news, etc.).
     * Uses the ROOT domain for matching, so "ell.stackexchange.com"
     * correctly matches "stackexchange.com" in the blocklist.
     */
    private isKnownAggregatorHost(domain: string): boolean {
        const host = this.normalizeDomain(domain);
        const root = this.extractRootDomain(host);
        // Check both the full hostname and its root against the blocklist
        for (const blocked of this.nonCompetitorHosts) {
            if (
                host === blocked || host.endsWith(`.${blocked}`) ||
                root === blocked || root.endsWith(`.${blocked}`)
            ) {
                return true;
            }
        }
        return false;
    }

    private async checkDomainLiveness(domain: string): Promise<{ isLive: boolean; statusCode?: number }> {
        const targets = [`https://${domain}`, `http://${domain}`];

        for (const target of targets) {
            try {
                const head = await axios.head(target, {
                    timeout: 3500,
                    maxRedirects: 5,
                    validateStatus: () => true,
                });
                if (head.status >= 200 && head.status < 400) {
                    return { isLive: true, statusCode: head.status };
                }
            } catch {
                // Fall through to GET.
            }

            try {
                const get = await axios.get(target, {
                    timeout: 3500,
                    maxRedirects: 5,
                    validateStatus: () => true,
                });
                if (get.status >= 200 && get.status < 400) {
                    return { isLive: true, statusCode: get.status };
                }
            } catch {
                // Try next target.
            }
        }

        return { isLive: false };
    }

    // ─── Keyword Discovery (pre-Phase 2, no LLM call) ───────────────────────

    private async discoverTrendingKeywords(
        brandName: string,
        industry: string,
        country: string,
        topCompetitors: string[],
    ): Promise<string> {
        const year = new Date().getFullYear();

        // Build targeted search queries
        const searchQueries = [
            `${brandName} reviews ${year}`,
            `best ${industry} tools ${year}`,
            `${brandName} vs ${topCompetitors[0] || 'competitors'}`,
            `${brandName} alternatives reddit`,
            `${industry} trends ${year} ${country}`,
            `${brandName} pricing features comparison`,
        ];

        console.log(`   → Running ${searchQueries.length} keyword discovery searches...`);

        // Run all searches in parallel
        const searchResults = await Promise.allSettled(
            searchQueries.map(q => mcpSearchService.quickSearch(q, 3))
        );

        // Collect formatted context from successful results
        const contextParts: string[] = [];

        for (let i = 0; i < searchResults.length; i++) {
            const result = searchResults[i];
            if (result.status === 'fulfilled' && result.value.results.length > 0) {
                const formatted = mcpSearchService.formatContext(result.value);
                if (formatted) {
                    contextParts.push(formatted);
                }
                console.log(`   ✅ [${i + 1}/${searchQueries.length}] "${searchQueries[i]}" → ${result.value.results.length} results`);
            } else {
                console.log(`   ⚠️ [${i + 1}/${searchQueries.length}] "${searchQueries[i]}" → no results`);
            }
        }

        if (contextParts.length === 0) {
            console.log(`   ⚠️ No keyword discovery results. Phase 2 will rely on LLM's own search.`);
            return '';
        }

        console.log(`   → Collected trending context from ${contextParts.length}/${searchQueries.length} searches.`);
        return contextParts.join('\n\n');
    }

    // ─── Post-processing: Enforce 50/50 split ────────────────────────────────

    private enforce5050Split(
        queries: Array<{ id: number; prompt: string; category: string; query_tag: 'branded' | 'neutral' }>,
        brandNameLower: string,
        maxQueries: number,
    ): Array<{ id: number; prompt: string; category: string; query_tag: 'branded' | 'neutral' }> {
        const halfCount = Math.floor(maxQueries / 2);

        // Correct query_tag based on actual content (brand name presence)
        const corrected = queries.map((q, idx) => {
            const mentionsBrand = q.prompt.toLowerCase().includes(brandNameLower);
            const correctedTag: 'branded' | 'neutral' = mentionsBrand ? 'branded' : 'neutral';

            if (correctedTag !== q.query_tag) {
                console.log(`   🔧 Corrected query #${q.id}: "${q.query_tag}" → "${correctedTag}"`);
            }

            return { ...q, id: idx + 1, query_tag: correctedTag };
        });

        // Sort: branded first, neutral second
        const branded = corrected.filter(q => q.query_tag === 'branded');
        const neutral = corrected.filter(q => q.query_tag === 'neutral');

        // Take up to halfCount from each, re-index
        const finalBranded = branded.slice(0, halfCount);
        const finalNeutral = neutral.slice(0, halfCount);
        const combined = [...finalBranded, ...finalNeutral].map((q, idx) => ({ ...q, id: idx + 1 }));

        console.log(`   📊 Post-processing: ${finalBranded.length} branded + ${finalNeutral.length} neutral = ${combined.length} total`);

        return combined;
    }

    // ─── Phase 1 JSON Extraction ─────────────────────────────────────────────

    private extractPhase1JSON(content: string): Phase1Output {
        const raw = this.extractRawJSON(content);

        const profileRaw = raw.company_profile ?? raw.companyprofile ?? raw.companyProfile;
        const profile = this.asRecord(profileRaw);
        const competitors = Array.isArray(raw.competitors) ? raw.competitors : [];

        return {
            company_profile: {
                company_name: this.asString(profile.company_name) || this.asString(profile.companyname) || this.asString(profile.name),
                website: this.asString(profile.website) || this.asString(profile.url),
                industry: this.asString(profile.industry),
                description: this.asString(profile.description),
            },
            competitors: competitors.map((candidate) => {
                const c = this.asRecord(candidate);
                return {
                    rank: this.asNumber(c.rank),
                    company_name: this.asString(c.company_name) || this.asString(c.companyname) || this.asString(c.name),
                    domain: this.asString(c.domain) || this.asString(c.url) || this.asString(c.website),
                };
            }),
        };
    }

    // ─── Phase 2 JSON Extraction ─────────────────────────────────────────────

    private extractPhase2JSON(content: string): Phase2Output {
        const raw = this.extractRawJSON(content);

        // Queries might be in flat array or nested format
        let queries: unknown[] = Array.isArray(raw.queries) ? raw.queries : [];

        // Handle biased/blind prompt format fallback
        if (queries.length === 0) {
            const biased = this.asRecord(raw.biasedprompts ?? raw.biased_prompts);
            const blind = this.asRecord(
                raw.blindprompts ?? raw.blind_prompts ?? raw.neutralprompts ?? raw.neutral_prompts,
            );

            const collectPrompts = (section: JsonRecord, tag: 'branded' | 'neutral'): unknown[] => {
                const collected: unknown[] = [];
                for (const [key, value] of Object.entries(section)) {
                    if (key === 'totalcount' || key === 'total_count') continue;
                    if (Array.isArray(value)) {
                        collected.push(
                            ...value.map((q) => ({
                                ...this.asRecord(q),
                                query_tag: tag,
                            })),
                        );
                    }
                }
                return collected;
            };

            queries = [
                ...collectPrompts(biased, 'branded'),
                ...collectPrompts(blind, 'neutral'),
            ];
        }

        return {
            queries: queries.map((queryValue: unknown, idx: number) => {
                const q = this.asRecord(queryValue);
                const category = this.asString(q.category) || this.asString(q.intent);
                const rawTag = this.asString(q.query_tag) || this.asString(q.tag);
                const inferredTag: 'branded' | 'neutral' =
                    category.toLowerCase().includes('brand') ? 'branded' : 'neutral';
                const queryTag: 'branded' | 'neutral' =
                    rawTag === 'branded' || rawTag === 'neutral' ? rawTag : inferredTag;

                return {
                    id: this.asNumber(q.id, idx + 1),
                    prompt: this.asString(q.prompt) || this.asString(q.text) || this.asString(q.query),
                    category,
                    query_tag: queryTag,
                };
            }),
        };
    }

    // ─── Shared JSON Extraction (handles markdown fences, brace-balancing) ───

    private extractRawJSON(content: string): JsonRecord {
        let jsonStr = content.trim();

        // 1. Try to find JSON in markdown code fences
        const fencedMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fencedMatch) {
            jsonStr = fencedMatch[1].trim();
        }

        // 2. Initial attempt: Parse as-is
        try {
            return this.asRecord(JSON.parse(jsonStr));
        } catch (e) {
            // fall through
        }

        // 3. Strategy: Find the outermost curly braces
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const candidate = jsonStr.substring(firstBrace, lastBrace + 1);
            try {
                return this.asRecord(JSON.parse(candidate));
            } catch (e) {
                // still failed
            }
        }

        // 4. Strategy: Clean trailing commas
        try {
            const cleaned = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            return this.asRecord(JSON.parse(cleaned));
        } catch (e) {
            // failed
        }

        console.error('❌ [OnboardingV2] Failed to parse LLM JSON output.');
        console.error('❌ [OnboardingV2] Raw content (first 500 chars):', content.substring(0, 500));

        throw new Error('Failed to parse research results from LLM. Please try again.');
    }

    private asRecord(value: unknown): JsonRecord {
        if (value && typeof value === 'object') {
            return value as JsonRecord;
        }
        return {};
    }

    private asString(value: unknown): string {
        return typeof value === 'string' ? value : '';
    }

    private asNumber(value: unknown, fallback = 0): number {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
}

export const onboardingV2ResearchService = new OnboardingV2ResearchService();
