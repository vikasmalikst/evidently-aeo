/**
 * Script to categorize citations for all existing collector_results
 * 
 * Usage:
 *   ts-node backend/src/scripts/categorize-citations-for-existing.ts
 *   OR
 *   npm run citations:categorize
 */

import { citationCategorizationService } from '../services/citations/citation-categorization.service';
import { supabaseAdmin } from '../config/database';
import { loadEnvironment } from '../utils/env-utils';

// Load environment variables
loadEnvironment();

async function categorizeCitationsForExistingResults() {
  try {
    console.log('🔍 Finding collector_results with citations...');

    // Get all collector_results that have citations
    const { data: collectorResults, error: fetchError } = await supabaseAdmin
      .from('collector_results')
      .select('id, citations, metadata')
      .not('citations', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000); // Process in batches

    if (fetchError) {
      throw new Error(`Failed to fetch collector results: ${fetchError.message}`);
    }

    if (!collectorResults || collectorResults.length === 0) {
      console.log('✅ No collector results found with citations');
      return;
    }

    console.log(`📊 Found ${collectorResults.length} collector results to process`);

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each result
    for (let i = 0; i < collectorResults.length; i++) {
      const result = collectorResults[i];
      
      try {
        console.log(`\n[${i + 1}/${collectorResults.length}] Processing result ${result.id}...`);

        if (!result.citations || !Array.isArray(result.citations) || result.citations.length === 0) {
          console.log(`⏭️  Skipping - no citations`);
          continue;
        }

        // Extract URLs from citations (citations can be strings or objects with url property)
        const urls: string[] = [];
        for (const citation of result.citations) {
          if (typeof citation === 'string') {
            urls.push(citation);
          } else if (citation && typeof citation === 'object' && citation.url) {
            urls.push(citation.url);
          }
        }

        if (urls.length === 0) {
          console.log(`⏭️  Skipping - no valid URLs found`);
          continue;
        }

        console.log(`  Found ${urls.length} citation URLs to categorize`);

        // Categorize each citation URL
        const categorizedCitations: Array<{
          url: string;
          category: string;
          domain?: string;
          pageName?: string | null;
        }> = [];

        for (let j = 0; j < urls.length; j++) {
          const url = urls[j];
          try {
            console.log(`    [${j + 1}/${urls.length}] Categorizing ${url}...`);
            const processed = await citationCategorizationService.processCitation(url, true);
            categorizedCitations.push({
              url: processed.url,
              category: processed.category,
              domain: processed.domain,
              pageName: processed.pageName
            });
            console.log(`    ✅ Categorized as: ${processed.category}`);
          } catch (error: any) {
            console.warn(`    ⚠️  Failed to categorize citation ${url}:`, error.message);
            // Continue with other citations
          }
        }

        if (categorizedCitations.length > 0) {
          // Update metadata with categorized citations
          const currentMetadata = result.metadata || {};
          const updatedMetadata = {
            ...currentMetadata,
            categorized_citations: categorizedCitations,
            citation_categories: categorizedCitations.map(c => c.category)
          };

          const { error: updateError } = await supabaseAdmin
            .from('collector_results')
            .update({ metadata: updatedMetadata })
            .eq('id', result.id);

          if (updateError) {
            throw updateError;
          }

          processed++;
          console.log(`✅ Processed ${i + 1}/${collectorResults.length}: ${categorizedCitations.length} citations categorized`);
        } else {
          console.log(`⚠️  No citations categorized for result ${result.id}`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay

      } catch (error: any) {
        failed++;
        const errorMsg = `Failed for result ${result.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        // Continue with next result
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`✅ Processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Total: ${collectorResults.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors`);
      }
    }
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
categorizeCitationsForExistingResults()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

