import axios from 'axios';
import * as cheerio from 'cheerio';
import { ensureHttps, stripProtocol } from './onboarding/utils/string-utils';

export interface WebsiteScrapeResult {
  resolvedUrl: string;
  title?: string;
  metaDescription?: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  navItems: string[];
  /**
   * Condensed, cleaned homepage context intended for LLM prompts.
   */
  websiteContent: string;
  /**
   * Best-effort keywords derived from headings/nav that likely map to branded
   * terms (uses the provided brandName heuristic).
   */
  brandKeywords: string[];
  /**
   * Best-effort category/industry keywords derived from headings/nav.
   */
  industryKeywords: string[];
}

type ScrapeOptions = {
  brandName?: string;
  timeoutMs?: number;
  maxChars?: number;
  maxKeywords?: number;
};

function uniqCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v.trim());
  }
  return out;
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\|\s+/g, ' | ')
    .trim();
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1).trim()}…`;
}

const NAV_STOPWORDS = new Set(
  [
    'home',
    'about',
    'about us',
    'pricing',
    'plans',
    'blog',
    'docs',
    'documentation',
    'contact',
    'contact us',
    'careers',
    'login',
    'log in',
    'sign in',
    'signup',
    'sign up',
    'get started',
    'request demo',
    'book a demo',
    'demo',
    'support',
    'help',
    'resources',
    'customers',
    'security',
    'privacy',
    'terms',
    'legal',
    'start free trial',
    'free trial',
    'start trial',
  ].map((s) => s.toLowerCase())
);

// Generic keywords that don't add value for topic generation
const GENERIC_KEYWORDS = new Set(
  [
    'frequently asked questions',
    'faq',
    'products',
    'product',
    'ebook',
    'ebooks',
    'blog',
    'resources',
    'legal',
    'about',
    'contact',
    'support',
    'help',
    'documentation',
    'docs',
  ].map((s) => s.toLowerCase())
);

function splitCandidatePhrases(text: string): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  // Split on common separators used in nav/headings.
  // Important: do NOT split on hyphen-minus "-" because it breaks hyphenated words
  // (e.g. "follow-up", "decision-makers").
  const primary = cleaned.split(/[|•·–—:>/]+/g);
  const secondary = primary.flatMap((s) => s.split(/\s-\s/g));

  return secondary.map((s) => cleanText(s)).filter(Boolean);
}

function isGoodKeywordCandidate(phrase: string): boolean {
  const p = cleanText(phrase);
  if (!p) return false;
  if (p.length < 2 || p.length > 70) return false;

  // Avoid questions/prompts as "keywords"
  if (p.includes('?')) return false;

  const lower = p.toLowerCase();
  if (NAV_STOPWORDS.has(lower)) return false;
  if (GENERIC_KEYWORDS.has(lower)) return false;

  const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which', 'explain', 'tell', 'describe', 'compare'];
  if (questionWords.some((qw) => lower === qw || lower.startsWith(`${qw} `))) return false;

  // Avoid pure punctuation/numbers
  const alphaNumCount = (p.match(/[a-z0-9]/gi) || []).length;
  if (alphaNumCount < Math.min(3, p.length)) return false;

  // Avoid super-long phrases
  const words = p.split(/\s+/g).filter(Boolean);
  if (words.length > 8) return false;

  // Filter out overly generic phrases
  if (words.length === 1 && ['product', 'products', 'feature', 'features', 'solution', 'solutions'].includes(lower)) {
    return false;
  }

  return true;
}

/**
 * Extract brand name from domain or title
 */
function extractBrandNameFromDomain(url: string): string | null {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.replace('www.', '');
    const domainParts = hostname.split('.');
    if (domainParts.length > 0) {
      const brandPart = domainParts[0];
      // Capitalize first letter
      return brandPart.charAt(0).toUpperCase() + brandPart.slice(1);
    }
  } catch {
    // Invalid URL, try to extract from string
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\.]+)/);
    if (match && match[1]) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
  }
  return null;
}

/**
 * Extract brand name from title (usually after | or - separator)
 */
function extractBrandNameFromTitle(title: string): string | null {
  if (!title) return null;

  // Try patterns like "Product | Brand" or "Product - Brand"
  const patterns = [
    /\|\s*([^|]+)$/,  // "Product | Brand"
    /–\s*([^–]+)$/,   // "Product – Brand"
    /-\s*([^-]+)$/,   // "Product - Brand"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const brand = cleanText(match[1]);
      if (brand.length > 0 && brand.length < 50) {
        return brand;
      }
    }
  }

  return null;
}

function buildKeywords(params: {
  candidates: string[];
  brandName?: string;
  domain?: string;
  title?: string;
  maxKeywords: number;
}): { brandKeywords: string[]; industryKeywords: string[] } {
  const { candidates, brandName, domain, title, maxKeywords } = params;

  // Try to determine brand name from multiple sources
  let effectiveBrandName = brandName;
  if (!effectiveBrandName && title) {
    effectiveBrandName = extractBrandNameFromTitle(title) || undefined;
  }
  if (!effectiveBrandName && domain) {
    effectiveBrandName = extractBrandNameFromDomain(domain) || undefined;
  }

  const brandNeedle = cleanText(effectiveBrandName || '').toLowerCase();
  const brandKeywords: string[] = [];
  const industryKeywords: string[] = [];

  for (const raw of candidates) {
    for (const phrase of splitCandidatePhrases(raw)) {
      if (!isGoodKeywordCandidate(phrase)) continue;

      const normalized = cleanText(phrase);
      const lower = normalized.toLowerCase();

      // Check if it's a brand keyword
      let isBrand = false;
      if (brandNeedle.length > 0) {
        // Direct match
        if (lower.includes(brandNeedle)) {
          isBrand = true;
        }
        // Also check if brand name appears as a standalone word
        const brandRegex = new RegExp(`\\b${brandNeedle}\\b`, 'i');
        if (brandRegex.test(normalized)) {
          isBrand = true;
        }
      }

      if (isBrand) {
        brandKeywords.push(normalized);
      } else {
        industryKeywords.push(normalized);
      }
    }
  }

  // De-dupe and cap
  const dedupedBrand = uniqCaseInsensitive(brandKeywords).slice(0, Math.max(5, Math.floor(maxKeywords * 0.4)));
  const dedupedIndustry = uniqCaseInsensitive(industryKeywords).slice(0, maxKeywords);

  return {
    brandKeywords: dedupedBrand,
    industryKeywords: dedupedIndustry,
  };
}

class WebsiteScraperService {
  async scrapeHomepage(urlOrDomain: string, options?: ScrapeOptions): Promise<WebsiteScrapeResult> {
    const timeoutMs = options?.timeoutMs ?? 8000;
    const maxChars = options?.maxChars ?? 3500;
    const maxKeywords = options?.maxKeywords ?? 25;

    const input = (urlOrDomain || '').trim();
    if (!input) {
      throw new Error('scrapeHomepage: urlOrDomain is required');
    }

    // Normalize: accept full URL or bare domain
    const resolvedUrl = ensureHttps(input);
    const displayDomain = stripProtocol(resolvedUrl);

    // Launch puppeteer to handle WAFs (like Akamai) and dynamic content
    let browser;
    let html = '';

    try {
      // Lazy load puppeteer to avoid require overhead if not used
      const puppeteer = await import('puppeteer');

      browser = await puppeteer.default.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });

      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
      });

      // Navigate with timeout
      await page.goto(resolvedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: timeoutMs
      });

      // Get page content
      html = await page.content();

    } catch (error) {
      // Fallback or rethrow? 
      // For now, if puppeteer fails (e.g. timeout), generic error
      if (error instanceof Error) {
        throw new Error(`Scraping failed: ${error.message}`);
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close().catch(() => { });
      }
    }
    const $ = cheerio.load(html);

    const title = cleanText($('title').first().text());
    const metaDescription = cleanText($('meta[name="description"]').attr('content') || '');

    // Remove noisy nodes before text extraction
    $('script, style, noscript, svg, iframe').remove();

    const h1 = uniqCaseInsensitive(
      $('h1')
        .toArray()
        .map((el) => cleanText($(el).text()))
        .filter((t) => t.length > 0 && t.length <= 120)
    );
    const h2 = uniqCaseInsensitive(
      $('h2')
        .toArray()
        .map((el) => cleanText($(el).text()))
        .filter((t) => t.length > 0 && t.length <= 120)
    );
    const h3 = uniqCaseInsensitive(
      $('h3')
        .toArray()
        .map((el) => cleanText($(el).text()))
        .filter((t) => t.length > 0 && t.length <= 120)
    );

    // Try multiple selectors for navigation items
    const navSelectors = [
      'nav a',
      'header nav a',
      'header a',
      '[role="navigation"] a',
      '.nav a',
      '.navigation a',
      '.menu a',
      '.header-menu a',
    ];

    const navItemsSet = new Set<string>();
    for (const selector of navSelectors) {
      $(selector).each((_, el) => {
        const text = cleanText($(el).text());
        if (text && text.length > 0 && text.length <= 60) {
          navItemsSet.add(text);
        }
      });
    }

    const navItems = uniqCaseInsensitive(Array.from(navItemsSet))
      .filter((t) => !NAV_STOPWORDS.has(t.toLowerCase()));

    // Extract additional semantic content
    // Get button text (often contains CTAs with product features)
    const buttonTexts = uniqCaseInsensitive(
      $('button, [role="button"], .btn, .button')
        .toArray()
        .map((el) => cleanText($(el).text()))
        .filter((t) => t.length > 3 && t.length <= 50 && !t.toLowerCase().includes('click') && !t.toLowerCase().includes('submit'))
    );

    // Get list items from feature lists (often in ul/ol)
    const listItems = uniqCaseInsensitive(
      $('ul li, ol li')
        .toArray()
        .map((el) => cleanText($(el).text()))
        .filter((t) => {
          const lower = t.toLowerCase();
          return t.length > 5 &&
            t.length <= 80 &&
            !lower.includes('cookie') &&
            !lower.includes('privacy') &&
            !lower.includes('terms') &&
            !lower.startsWith('©');
        })
        .slice(0, 20) // Limit to avoid too many generic items
    );

    const keywordCandidates = [
      title,
      metaDescription,
      ...h1,
      ...h2,
      ...h3,
      ...navItems,
      ...buttonTexts.slice(0, 10), // Limit button texts
      ...listItems.slice(0, 15),   // Limit list items
    ].filter(Boolean);

    const { brandKeywords, industryKeywords } = buildKeywords({
      candidates: keywordCandidates,
      brandName: options?.brandName,
      domain: displayDomain,
      title: title,
      maxKeywords,
    });

    // Build websiteContent as a compact keyword-only list (not long context)
    // This keeps the prompt small while providing signal
    const topKeywords = [...industryKeywords.slice(0, 12), ...brandKeywords.slice(0, 5)];
    const websiteContent = topKeywords.length > 0
      ? `Website keywords: ${topKeywords.join(', ')}`
      : '';

    return {
      resolvedUrl,
      title: title || undefined,
      metaDescription: metaDescription || undefined,
      headings: { h1, h2, h3 },
      navItems,
      websiteContent,
      brandKeywords,
      industryKeywords,
    };
  }
}

export const websiteScraperService = new WebsiteScraperService();

