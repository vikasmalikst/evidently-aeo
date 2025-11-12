/**
 * Script to generate keywords for all existing collector_results
 * 
 * Usage:
 *   ts-node backend/src/scripts/generate-keywords-for-existing.ts
 *   OR
 *   npm run generate-keywords
 */

import { keywordGenerationService } from '../services/keywords/keyword-generation.service';
import { supabaseAdmin } from '../config/database';
import { loadEnvironment } from '../utils/env-utils';

// Load environment variables
loadEnvironment();

async function generateKeywordsForExistingResults() {
  try {
    console.log('🔍 Finding collector_results without keywords...');

    // Get all collector_results that don't have keywords yet
    const { data: collectorResults, error: fetchError } = await supabaseAdmin
      .from('collector_results')
      .select('id, raw_answer, query_id, brand_id, customer_id, keywords')
      .not('raw_answer', 'is', null)
      .or('keywords.is.null,keywords.eq.')
      .order('created_at', { ascending: false })
      .limit(1000); // Process in batches

    if (fetchError) {
      throw new Error(`Failed to fetch collector results: ${fetchError.message}`);
    }

    if (!collectorResults || collectorResults.length === 0) {
      console.log('✅ No collector results found that need keywords');
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

        // Skip if already has keywords
        if (result.keywords && result.keywords.trim().length > 0) {
          console.log(`⏭️  Skipping - already has keywords`);
          continue;
        }

        // Get query text if query_id exists
        let queryText = null;
        if (result.query_id) {
          const { data: queryData } = await supabaseAdmin
            .from('generated_queries')
            .select('query_text')
            .eq('id', result.query_id)
            .single();
          
          queryText = queryData?.query_text || null;
        }

        // Generate keywords using LLM
        const keywordResponse = await keywordGenerationService.generateKeywords({
          answer: result.raw_answer,
          query_id: result.query_id || undefined,
          query_text: queryText || undefined,
          collector_result_id: result.id?.toString() || undefined,
          brand_id: result.brand_id || undefined,
          customer_id: result.customer_id || undefined,
          max_keywords: 20
        });

        // Store keywords in both tables
        if (keywordResponse.keywords.length > 0) {
          await keywordGenerationService.storeKeywords(keywordResponse.keywords, {
            answer: result.raw_answer,
            query_id: result.query_id || undefined,
            query_text: queryText || undefined,
            collector_result_id: result.id?.toString() || undefined,
            brand_id: result.brand_id || undefined,
            customer_id: result.customer_id || undefined
          });

          processed++;
          console.log(`✅ Generated and stored ${keywordResponse.keywords.length} keywords`);
        } else {
          console.log(`⚠️  No keywords generated`);
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
generateKeywordsForExistingResults()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

