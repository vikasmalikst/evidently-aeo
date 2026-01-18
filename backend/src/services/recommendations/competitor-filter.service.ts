/**
 * Competitor Filter Service
 * 
 * Provides utilities for filtering out competitor references from recommendations.
 * Used in Layer 1 (Pre-Generation Filtering) to prevent competitor leakage.
 */

export interface CompetitorExclusionList {
  names: Set<string>;           // Competitor names (normalized)
  domains: Set<string>;          // Competitor domains (normalized)
  nameVariations: Set<string>;   // Common variations of competitor names
  baseDomains: Set<string>;      // Base domain names (without TLD) for fuzzy matching
  brandName?: string;            // Brand's own name (to whitelist)
  brandDomain?: string;          // Brand's own domain (to whitelist)
}

/**
 * Common platform domains that should NEVER be flagged as competitors
 * These are content platforms where brands publish content, not competitors
 */
const PLATFORM_DOMAINS_WHITELIST = new Set([
  'reddit.com',
  'reddit',
  'youtube.com',
  'youtube',
  'twitter.com',
  'twitter',
  'x.com',
  'facebook.com',
  'facebook',
  'linkedin.com',
  'linkedin',
  'instagram.com',
  'instagram',
  'tiktok.com',
  'tiktok',
  'quora.com',
  'quora',
  'medium.com',
  'medium',
  'wordpress.com',
  'wordpress',
  'blogger.com',
  'blogger',
  'wikipedia.org',
  'wikipedia',
  'stackoverflow.com',
  'stackoverflow',
  'github.com',
  'github'
]);

/**
 * Common TLD variations to check when a competitor domain is found
 * If we have "gosearch.com", we should also check for "gosearch.ai", "gosearch.io", etc.
 */
const COMMON_TLDS = [
  'com',
  'ai',
  'io',
  'co',
  'org',
  'net',
  'app',
  'dev',
  'tech',
  'cloud',
  'online',
  'site',
  'xyz',
  'info'
];

/**
 * Extract base domain name (without TLD)
 * e.g., "gosearch.com" -> "gosearch"
 */
function extractBaseDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length <= 1) return domain;

  // Remove TLD (last part) and any subdomain (first parts)
  // For "www.gosearch.com", we want "gosearch"
  // For "gosearch.ai", we want "gosearch"
  if (parts.length === 2) {
    return parts[0]; // "gosearch.com" -> "gosearch"
  } else if (parts.length > 2) {
    // "www.gosearch.com" -> "gosearch"
    // Take the second-to-last part (usually the main domain)
    return parts[parts.length - 2];
  }
  return domain;
}

/**
 * Normalize a string for comparison (lowercase, trim, remove common suffixes)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[.,;:!?]/g, ''); // Remove punctuation
}

/**
 * Normalize a domain for comparison (lowercase, remove www, remove protocol)
 */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')  // Remove protocol
    .replace(/^www\./, '')         // Remove www
    .replace(/\/.*$/, '')         // Remove path
    .replace(/^www\./, '');       // Remove www again in case it was after protocol
}

/**
 * Generate name variations for a competitor name
 * e.g., "Acme Corp" -> ["acme", "acme corp", "acme corporation"]
 */
function generateNameVariations(name: string): string[] {
  const normalized = normalizeString(name);
  const variations = new Set<string>([normalized]);

  // Add without common suffixes (e.g. "Acme Corp" -> "Acme")
  const withoutSuffixes = normalized
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co|limited)$/i, '')
    .trim();

  if (withoutSuffixes && withoutSuffixes !== normalized && withoutSuffixes.length >= 3) {
    variations.add(withoutSuffixes);
  }

  // REMOVED: Individual word splitting (e.g., "Event Industry" -> "event", "industry")
  // This was causing over-filtering of generic industry terms like 'event' and 'travel'.
  // We now only match against the FULL name or its direct business variant.

  return Array.from(variations);
}

/**
 * Build a comprehensive competitor exclusion list from competitor data
 * @param competitors - Array of competitor data
 * @param brandDomain - Brand's own domain (to whitelist, optional)
 * @param brandName - Brand's own name (to whitelist, optional)
 */
export function buildCompetitorExclusionList(
  competitors: Array<{
    competitor_name: string;
    competitor_url?: string | null;
    metadata?: {
      domain?: string;
      [key: string]: unknown;
    } | null;
  }>,
  brandDomain?: string,
  brandName?: string
): CompetitorExclusionList {
  const names = new Set<string>();
  const domains = new Set<string>();
  const nameVariations = new Set<string>();
  const baseDomains = new Set<string>();

  // Normalize brand domain and name for comparison
  const normalizedBrandDomain = brandDomain ? normalizeDomain(brandDomain) : undefined;
  const normalizedBrandName = brandName ? normalizeString(brandName) : undefined;

  console.log(`🔍 [CompetitorFilter] Building exclusion list with brand whitelist: domain="${normalizedBrandDomain}", name="${normalizedBrandName}"`);

  for (const comp of competitors) {
    const name = comp.competitor_name;
    if (!name) continue;

    // Add normalized name (skip if it's the brand itself)
    const normalizedName = normalizeString(name);
    if (normalizedBrandName && normalizedName === normalizedBrandName) {
      console.log(`✅ [CompetitorFilter] Skipping brand name "${normalizedName}" from competitor exclusion list`);
    } else {
      names.add(normalizedName);

      // Generate and add name variations (skip if they match the brand)
      const variations = generateNameVariations(name);
      variations.forEach(v => {
        if (normalizedBrandName && v === normalizedBrandName) return;
        nameVariations.add(v);
      });
    }

    // Extract and normalize domain
    let domain: string | null = null;

    // Try metadata.domain first
    if (comp.metadata?.domain) {
      // Normalize immediately to ensure consistent format
      domain = normalizeDomain(comp.metadata.domain);
      console.log(`🔍 [CompetitorFilter] Extracted domain from metadata for "${name}": ${comp.metadata.domain} → normalized: ${domain}`);
    }
    // Try extracting from competitor_url
    else if (comp.competitor_url) {
      try {
        // If competitor_url is a full URL, extract hostname
        if (comp.competitor_url.startsWith('http://') || comp.competitor_url.startsWith('https://')) {
          const url = new URL(comp.competitor_url);
          domain = url.hostname;
        } else {
          // If it's just a domain name, use it directly
          domain = comp.competitor_url;
        }
        domain = normalizeDomain(domain);
        console.log(`🔍 [CompetitorFilter] Extracted domain from competitor_url for "${name}": ${domain}`);
      } catch (e) {
        // If URL parsing fails, try normalizing directly
        domain = normalizeDomain(comp.competitor_url);
        console.log(`🔍 [CompetitorFilter] Extracted domain (fallback) for "${name}": ${domain}`);
      }
    }

    if (!domain) {
      console.warn(`⚠️ [CompetitorFilter] No domain found for competitor "${name}" - competitor_name will still be added to exclusion list`);
    }

    if (domain) {
      // Domain is already normalized from extraction above
      const normalizedDomain = domain; // Already normalized

      // Skip platform domains - these should never be in the exclusion list
      // But still add the competitor name to the exclusion list (in case name appears in text)
      if (PLATFORM_DOMAINS_WHITELIST.has(normalizedDomain)) {
        console.warn(`⚠️ [CompetitorFilter] Skipping platform domain "${normalizedDomain}" from competitor exclusion list (competitor: ${name}) - but keeping competitor name in exclusion list`);
        // Don't add domain, but continue to next competitor (name already added above)
        continue;
      }

      // Check if domain contains any platform domain
      let isPlatform = false;
      for (const platform of PLATFORM_DOMAINS_WHITELIST) {
        if (normalizedDomain.includes(platform) || platform.includes(normalizedDomain)) {
          console.warn(`⚠️ [CompetitorFilter] Skipping platform-related domain "${normalizedDomain}" from competitor exclusion list (competitor: ${name}) - but keeping competitor name in exclusion list`);
          isPlatform = true;
          break;
        }
      }

      if (!isPlatform) {
        // Skip if it's the brand domain
        if (normalizedBrandDomain && normalizedDomain === normalizedBrandDomain) {
          console.log(`✅ [CompetitorFilter] Skipping brand domain "${normalizedDomain}" from competitor exclusion list`);
          continue;
        }

        domains.add(normalizedDomain);
        console.log(`✅ [CompetitorFilter] Added competitor domain to exclusion list: "${normalizedDomain}" (competitor: ${name})`);

        // Extract base domain name (e.g., "gosearch" from "gosearch.com")
        const baseDomain = extractBaseDomain(normalizedDomain);
        if (baseDomain && baseDomain !== normalizedDomain && baseDomain.length > 2) {
          baseDomains.add(baseDomain);
          console.log(`✅ [CompetitorFilter] Added base domain for TLD variation matching: "${baseDomain}" (from ${normalizedDomain})`);

          // Add common TLD variations (e.g., if we have "gosearch.com", also add "gosearch.ai", "gosearch.io", etc.)
          for (const tld of COMMON_TLDS) {
            const variation = `${baseDomain}.${tld}`;
            if (variation !== normalizedDomain && !PLATFORM_DOMAINS_WHITELIST.has(variation)) {
              domains.add(variation);
              console.log(`✅ [CompetitorFilter] Added TLD variation: "${variation}" (from ${normalizedDomain})`);
            }
          }
        }

        // Also add domain without TLD for partial matching (legacy support)
        const domainWithoutTld = normalizedDomain.split('.').slice(0, -1).join('.');
        if (domainWithoutTld && domainWithoutTld !== normalizedDomain && !PLATFORM_DOMAINS_WHITELIST.has(domainWithoutTld)) {
          domains.add(domainWithoutTld);
          console.log(`✅ [CompetitorFilter] Added domain without TLD for partial matching: "${domainWithoutTld}" (from ${normalizedDomain})`);
        }
      }
    }
  }

  return {
    names,
    domains,
    nameVariations,
    baseDomains,
    brandName: normalizedBrandName,
    brandDomain: normalizedBrandDomain
  };
}

/**
 * Check if a domain belongs to a competitor
 */
export function isCompetitorDomain(
  domain: string,
  exclusionList: CompetitorExclusionList
): boolean {
  const normalized = normalizeDomain(domain);

  // BRAND WHITELIST: Never flag brand's own domain as competitor
  if (exclusionList.brandDomain && normalized === exclusionList.brandDomain) {
    console.log(`✅ [CompetitorFilter] Whitelisted brand domain: "${normalized}"`);
    return false;
  }

  // Never flag common platform domains as competitors
  if (PLATFORM_DOMAINS_WHITELIST.has(normalized)) {
    return false;
  }

  // Check if any part of the normalized domain matches a whitelisted platform
  for (const platform of PLATFORM_DOMAINS_WHITELIST) {
    if (normalized.includes(platform) || platform.includes(normalized)) {
      return false;
    }
  }

  // Exact match
  if (exclusionList.domains.has(normalized)) {
    console.log(`🎯 [CompetitorFilter] Exact domain match found: "${normalized}" is a competitor domain`);
    return true;
  }

  // Base domain match (TLD variation matching)
  // If we have "gosearch.com" in exclusion list, "gosearch.ai" should also match
  const baseDomain = extractBaseDomain(normalized);
  if (baseDomain && baseDomain.length > 2 && exclusionList.baseDomains.has(baseDomain)) {
    console.log(`🎯 [CompetitorFilter] Base domain match found: "${normalized}" matches competitor base domain "${baseDomain}" (TLD variation)`);
    return true;
  }

  // Partial match (check if competitor domain is contained in this domain or vice versa)
  // But only if it's not a platform domain
  for (const compDomain of exclusionList.domains) {
    // Skip if the competitor domain itself is a platform (shouldn't happen, but safety check)
    if (PLATFORM_DOMAINS_WHITELIST.has(compDomain)) {
      continue;
    }

    if (normalized.includes(compDomain) || compDomain.includes(normalized)) {
      console.log(`🎯 [CompetitorFilter] Partial domain match found: "${normalized}" matches competitor domain "${compDomain}"`);
      return true;
    }
  }

  return false;
}

/**
 * Check if text contains a competitor reference
 */
export function containsCompetitorReference(
  text: string,
  exclusionList: CompetitorExclusionList
): boolean {
  if (!text) return false;

  const normalizedText = normalizeString(text);

  // BRAND WHITELIST MASKING:
  // We want to "hide" brand mentions from the text before checking for competitors.
  // This solves two problems:
  // 1. If the brand itself is accidentally in the exclusion list (e.g. data issue).
  // 2. If a competitor name is a substring of the brand name (e.g. brand "InsiderSports", competitor "Sports").

  let textToCheck = normalizedText;

  // Create a list of brand strings to mask (normalized for string search)
  const brandStrings = new Set<string>();
  if (exclusionList.brandName) {
    brandStrings.add(exclusionList.brandName); // brandName is already normalized in buildCompetitorExclusionList
  }
  if (exclusionList.brandDomain) {
    // Also mask the brand domain (normalized for text search by removing dots)
    brandStrings.add(normalizeString(exclusionList.brandDomain));
  }

  // Also mask the literal domain with dots in case it appears in text
  if (exclusionList.brandDomain) {
    brandStrings.add(exclusionList.brandDomain);
  }

  // Perform masking
  for (const brandStr of brandStrings) {
    // Only mask if the string is substantial to avoid over-masking common words
    if (brandStr.length >= 3) {
      // Use split/join for global replacement without regex overhead
      const parts = textToCheck.split(brandStr);
      if (parts.length > 1) {
        console.log(`✅ [CompetitorFilter] Masked brand reference "${brandStr}" in text`);
        textToCheck = parts.join(' [whitelisted_brand] ');
      }
    }
  }

  // Check against normalized names
  for (const name of exclusionList.names) {
    if (textToCheck.includes(name)) {
      console.log(`🎯 [CompetitorFilter] Found competitor name match: "${name}"`);
      return true;
    }
  }

  // Check against name variations
  for (const variation of exclusionList.nameVariations) {
    // Only check if variation is substantial (at least 3 chars) to avoid false positives
    if (variation.length >= 3 && textToCheck.includes(variation)) {
      console.log(`🎯 [CompetitorFilter] Found competitor variation match: "${variation}"`);
      return true;
    }
  }

  // Check against domains
  for (const domain of exclusionList.domains) {
    if (textToCheck.includes(domain)) {
      console.log(`🎯 [CompetitorFilter] Found competitor domain match: "${domain}"`);
      return true;
    }
  }

  return false;
}

/**
 * Filter source metrics to exclude competitor domains
 */
export function filterCompetitorSources<T extends { domain: string }>(
  sources: T[],
  exclusionList: CompetitorExclusionList
): T[] {
  return sources.filter(source => {
    const isCompetitor = isCompetitorDomain(source.domain, exclusionList);
    if (isCompetitor) {
      console.log(`🚫 [CompetitorFilter] Filtered out competitor source: ${source.domain}`);
    }
    return !isCompetitor;
  });
}

/**
 * Check if a recommendation contains any competitor references
 * Checks all text fields: action, reason, explanation, contentFocus, citationSource, focusSources
 */
export interface FilterOptions {
  allowTextMentions?: boolean;
}

/**
 * Check if a recommendation contains any competitor references
 * Checks all text fields: action, reason, explanation, contentFocus, citationSource, focusSources
 */
export function recommendationContainsCompetitor<T extends {
  action?: string;
  reason?: string;
  explanation?: string;
  contentFocus?: string;
  citationSource?: string;
  focusSources?: string;
}>(
  recommendation: T,
  exclusionList: CompetitorExclusionList,
  options: FilterOptions = {}
): boolean {
  // If text mentions are allowed, we ONLY check the source fields for domain matches
  // We do NOT check the semantic text fields for competitor names
  if (options.allowTextMentions) {
    // Strict check: citationSource MUST NOT be a competitor domain
    if (recommendation.citationSource && isCompetitorDomain(recommendation.citationSource, exclusionList)) {
      return true;
    }

    // Strict check: focusSources MUST NOT contain competitor domains
    if (recommendation.focusSources && containsCompetitorReference(recommendation.focusSources, exclusionList)) {
      return true;
    }

    // Strategic Check: Even if text mentions are allowed, we might want to block excessive promotion
    // For now, we trust the prompt engineering "Marketing Strategist" to compare, not promote.

    return false;
  }

  // DEFAULT BEHAVIOR (Strict): Check all text fields
  const fieldsToCheck = [
    recommendation.action,
    recommendation.reason,
    recommendation.explanation,
    recommendation.contentFocus,
    recommendation.citationSource,
    recommendation.focusSources
  ].filter(Boolean) as string[];

  for (const field of fieldsToCheck) {
    if (containsCompetitorReference(field, exclusionList)) {
      return true;
    }
  }

  // Also check if citationSource is a competitor domain
  if (recommendation.citationSource && isCompetitorDomain(recommendation.citationSource, exclusionList)) {
    return true;
  }

  return false;
}

/**
 * Filter recommendations to remove any that contain competitor references
 * LAYER 2: Post-generation hard filter (safety net)
 */
export function filterCompetitorRecommendations<T extends {
  action?: string;
  reason?: string;
  explanation?: string;
  contentFocus?: string;
  citationSource?: string;
  focusSources?: string;
}>(
  recommendations: T[],
  exclusionList: CompetitorExclusionList,
  options: FilterOptions = {}
): { filtered: T[]; removed: Array<{ recommendation: T; reason: string }> } {
  const filtered: T[] = [];
  const removed: Array<{ recommendation: T; reason: string }> = [];

  for (const rec of recommendations) {
    const containsCompetitor = recommendationContainsCompetitor(rec, exclusionList, options);

    if (containsCompetitor) {
      // Determine which field triggered the filter
      let reason = 'Contains competitor reference';
      const fieldsToCheck = [
        { name: 'action', value: rec.action },
        { name: 'reason', value: rec.reason },
        { name: 'explanation', value: rec.explanation },
        { name: 'contentFocus', value: rec.contentFocus },
        { name: 'citationSource', value: rec.citationSource },
        { name: 'focusSources', value: rec.focusSources }
      ];

      for (const field of fieldsToCheck) {
        if (field.value && containsCompetitorReference(field.value, exclusionList)) {
          // Find WHICH competitor matched for logging
          let matchInfo = 'competitor reference';
          const normField = normalizeString(field.value);

          // Re-mask for logging (a bit redundant but helpful for debugging)
          let masked = normField;
          if (exclusionList.brandName) masked = masked.split(exclusionList.brandName).join(' ');
          if (exclusionList.brandDomain) masked = masked.split(normalizeString(exclusionList.brandDomain)).join(' ');

          for (const name of exclusionList.names) {
            if (masked.includes(name)) { matchInfo = `name "${name}"`; break; }
          }
          if (matchInfo === 'competitor reference') {
            for (const v of exclusionList.nameVariations) {
              if (v.length >= 3 && masked.includes(v)) { matchInfo = `variation "${v}"`; break; }
            }
          }
          if (matchInfo === 'competitor reference') {
            for (const d of exclusionList.domains) {
              if (masked.includes(d)) { matchInfo = `domain "${d}"`; break; }
            }
          }

          reason = `Contains ${matchInfo} in ${field.name}`;
          break;
        }
      }

      if (rec.citationSource && isCompetitorDomain(rec.citationSource, exclusionList)) {
        reason = `Citation source is competitor domain: ${rec.citationSource}`;
      }

      removed.push({ recommendation: rec, reason });
      console.log(`🚫 [CompetitorFilter Layer 2] Filtered out recommendation: ${reason}`);
    } else {
      filtered.push(rec);
    }
  }

  if (removed.length > 0) {
    console.log(`🚫 [CompetitorFilter Layer 2] Filtered out ${removed.length} recommendation(s) containing competitor references`);
    removed.forEach(({ reason }) => {
      console.log(`   - ${reason}`);
    });
  }

  return { filtered, removed };
}

