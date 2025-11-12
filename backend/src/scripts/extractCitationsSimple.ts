#!/usr/bin/env ts-node
/**
 * Hybrid citation extraction script
 * Uses simple domain matching first, falls back to LLM for unknown domains
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { loadEnvironment, getEnvVar } from '../utils/env-utils';
import { citationCategorizationService } from '../services/citations/citation-categorization.service';

loadEnvironment();

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function extractPageName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    if (pathname === '/' || pathname === '') return 'Homepage';
    
    // Get last segment of path
    const segments = pathname.split('/').filter(s => s.length > 0);
    if (segments.length === 0) return 'Homepage';
    
    const lastSegment = segments[segments.length - 1];
    // Remove file extensions and clean up
    return lastSegment
      .replace(/\.(html|htm|php|asp|aspx)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .substring(0, 100);
  } catch {
    return 'Unknown';
  }
}

/**
 * Try to categorize by domain using simple rules
 * Returns null if domain is unknown and needs LLM categorization
 */
function categorizeByDomain(domain: string): string | null {
  const lowerDomain = domain.toLowerCase();
  
  // Social media
  if (['reddit.com', 'twitter.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'tiktok.com', 'pinterest.com', 'snapchat.com'].includes(lowerDomain)) {
    return 'social';
  }
  
  // Forums
  if (['quora.com', 'stackoverflow.com', 'stackexchange.com'].includes(lowerDomain) || lowerDomain.includes('forum')) {
    return 'forum';
  }
  
  // News/Media & Reviews
  if (['vogue.com', 'wwd.com', 'forbes.com', 'bloomberg.com', 'reuters.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'wsj.com', 'theguardian.com', 'fashionnetwork.com', 'teenvogue.com', 'runnersworld.com', 'runrepeat.com', 'believeintherun.com', 'fourfourtwo.com'].includes(lowerDomain) 
      || lowerDomain.includes('news') || lowerDomain.includes('magazine') || lowerDomain.includes('vogue') || lowerDomain.includes('reviews')) {
    return 'news';
  }
  
  // Academic/Research
  if (['arxiv.org', 'wikipedia.org', 'ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'tandfonline.com', 'techrxiv.org'].includes(lowerDomain) 
      || lowerDomain.includes('edu') || lowerDomain.includes('.ac.')) {
    return 'academic';
  }
  
  // E-commerce & Retail
  if (['amazon.com', 'alibaba.com', 'ebay.com', 'etsy.com', 'shopify.com', 'soccer.com', 'premiumsoccer.com', 'findmyfootwear.com', 'upandrunning.co.uk'].includes(lowerDomain) 
      || lowerDomain.includes('shop') || lowerDomain.includes('store') || lowerDomain.includes('buy') || lowerDomain.includes('soccer')) {
    return 'ecommerce';
  }
  
  // Brand official sites (major brands)
  if (['gucci.com', 'adidas.com', 'nike.com', 'prada.com', 'chanel.com', 'burberry.com', 'hermes.com', 'equilibrium.gucci.com', 'pradagroup.com'].includes(lowerDomain)) {
    return 'brand_official';
  }
  
  // Tech/Documentation
  if (['github.com', 'stackoverflow.com', 'learn.microsoft.com', 'openai.com', 'community.openai.com', 'help.openai.com', 'cdn.openai.com', 'spinningup.openai.com', 'deepmind.google'].includes(lowerDomain)
      || lowerDomain.includes('docs.') || lowerDomain.includes('developer.')) {
    return 'tech';
  }
  
  // Blogs/Media & Review Sites
  if (['medium.com', 'substack.com', 'wordpress.com', 'blogger.com', 'helpfulreviews.org'].includes(lowerDomain) 
      || lowerDomain.includes('blog') || lowerDomain.includes('.medium.com') || lowerDomain.includes('helpful')) {
    return 'blog';
  }
  
  // Unknown - needs LLM categorization
  return null;
}

async function main() {
  try {
    console.log('🚀 Starting hybrid citation extraction...\n');
    
    const stats = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      errors: 0,
      llmCategorized: 0,
      simpleCategorized: 0,
    };

    // Fetch all collector_results with citations
    const { data: results, error } = await supabase
      .from('collector_results')
      .select('id, customer_id, brand_id, query_id, execution_id, citations')
      .not('citations', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching collector_results:', error);
      throw error;
    }

    if (!results || results.length === 0) {
      console.log('✅ No collector_results with citations found');
      return;
    }

    console.log(`📊 Found ${results.length} collector_results with citations\n`);

    for (const result of results) {
      try {
        stats.processed++;

        // Parse citations (can be array of strings or array of objects)
        let citations: Array<string | { url: string; title?: string }> = [];
        
        if (typeof result.citations === 'string') {
          citations = JSON.parse(result.citations);
        } else if (Array.isArray(result.citations)) {
          citations = result.citations;
        } else {
          stats.skipped++;
          continue;
        }

        if (!Array.isArray(citations) || citations.length === 0) {
          stats.skipped++;
          continue;
        }

        // Process each citation with hybrid approach
        const citationRowsPromises = citations
          .filter((cit): cit is string | { url: string; title?: string } => {
            if (typeof cit === 'string') return cit.trim().length > 0;
            if (typeof cit === 'object' && cit !== null && typeof cit.url === 'string') return cit.url.trim().length > 0;
            return false;
          })
          .map(async (cit) => {
            // Handle both string URLs and object format
            const url = typeof cit === 'string' ? cit.trim() : cit.url.trim();
            const title = typeof cit === 'object' && cit.title ? cit.title : null;
            
            const domain = extractDomain(url);
            const pageName = title || extractPageName(url);
            
            // Try simple categorization first
            let category = categorizeByDomain(domain);
            let categorizationSource = 'simple_domain_matching';
            
            // If unknown, use LLM categorization
            if (category === null) {
              try {
                console.log(`🤖 Using LLM for unknown domain: ${domain}`);
                const processed = await citationCategorizationService.processCitation(url, true); // Enable AI
                category = processed.category;
                categorizationSource = processed.source;
                stats.llmCategorized++;
              } catch (llmError: any) {
                console.warn(`⚠️ LLM categorization failed for ${domain}: ${llmError.message}`);
                category = 'webpage'; // Default fallback
                categorizationSource = 'fallback_default';
              }
            } else {
              stats.simpleCategorized++;
            }
            
            return {
              customer_id: result.customer_id,
              brand_id: result.brand_id,
              query_id: result.query_id,
              execution_id: result.execution_id,
              collector_result_id: result.id,
              url,
              domain,
              page_name: pageName,
              category,
              usage_count: 1,
              metadata: {
                categorization_source: categorizationSource,
              }
            };
          });
        
        const citationRows = await Promise.all(citationRowsPromises);

        if (citationRows.length === 0) {
          stats.skipped++;
          continue;
        }

        // Remove duplicates within the same batch
        const uniqueCitationRows = citationRows.reduce((acc, row) => {
          const key = `${row.collector_result_id}-${row.url}`;
          if (!acc.has(key)) {
            acc.set(key, row);
          }
          return acc;
        }, new Map<string, typeof citationRows[0]>());

        const uniqueRows = Array.from(uniqueCitationRows.values());

        // Insert citations
        const { error: insertError } = await supabase
          .from('citations')
          .upsert(uniqueRows, {
            onConflict: 'collector_result_id,url',
            ignoreDuplicates: false,
          });

        if (insertError) {
          console.error(`❌ Error inserting citations for result ${result.id}:`, insertError);
          stats.errors++;
        } else {
          stats.inserted += uniqueRows.length;
          console.log(`✅ Inserted ${uniqueRows.length} citations for result ${result.id}`);
        }

      } catch (resultError: any) {
        console.error(`❌ Error processing result ${result.id}:`, resultError.message);
        stats.errors++;
      }
    }

    console.log('\n✅ Citation extraction complete!');
    console.log(`📊 Statistics:`);
    console.log(`   - Processed: ${stats.processed} collector results`);
    console.log(`   - Inserted: ${stats.inserted} citations`);
    console.log(`   - Simple categorization: ${stats.simpleCategorized} citations`);
    console.log(`   - LLM categorization: ${stats.llmCategorized} citations`);
    console.log(`   - Skipped: ${stats.skipped} results (no citations)`);
    console.log(`   - Errors: ${stats.errors}`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

