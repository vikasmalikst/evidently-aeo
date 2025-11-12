/**
 * Citation Categorization Routes
 * Endpoints for categorizing citations in collector_results
 */

import { Router, Request, Response } from 'express';
import { citationCategorizationService } from '../services/citations/citation-categorization.service';
import { supabaseAdmin } from '../config/database';

const router = Router();

/**
 * POST /api/citations/categorize-for-existing
 * Categorize citations for existing collector_results that don't have categorized citations yet
 */
router.post('/categorize-for-existing', async (req: Request, res: Response) => {
  try {
    const {
      collector_result_id,  // Categorize for specific result (optional)
      brand_id,             // Categorize for all results of a brand (optional)
      limit = 100           // Max number of results to process
    } = req.body;

    console.log('🔍 Finding collector_results with uncategorized citations...');

    // Build query to find collector_results with citations
    let query = supabaseAdmin
      .from('collector_results')
      .select('id, citations, metadata')
      .not('citations', 'is', null);

    // Apply filters before fetching
    if (collector_result_id) {
      query = query.eq('id', collector_result_id);
    }

    if (brand_id) {
      query = query.eq('brand_id', brand_id);
    }

    // Fetch results
    const { data: allResults, error: fetchError } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fetchError) {
      console.error('❌ Error fetching collector results:', fetchError);
      throw fetchError;
    }

    if (!allResults || allResults.length === 0) {
      return res.json({
        success: true,
        message: 'No collector results found with citations',
        processed: 0,
        total: 0
      });
    }

    console.log(`📊 Found ${allResults.length} collector results to process`);

    // Return immediately and process in background
    res.json({
      success: true,
      message: `Started categorizing citations for ${allResults.length} collector results in background`,
      total: allResults.length,
      status: 'processing'
    });

    // Process in background (don't await)
    (async () => {
      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process each result
      for (let i = 0; i < allResults.length; i++) {
        const result = allResults[i];
        
        try {
          console.log(`[${i + 1}/${allResults.length}] Processing result ${result.id}...`);

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

          // Categorize each citation URL
          const categorizedCitations: Array<{
            url: string;
            category: string;
            domain?: string;
            pageName?: string | null;
          }> = [];

          for (const url of urls) {
            try {
              const processed = await citationCategorizationService.processCitation(url, true);
              categorizedCitations.push({
                url: processed.url,
                category: processed.category,
                domain: processed.domain,
                pageName: processed.pageName
              });
            } catch (error: any) {
              console.warn(`⚠️  Failed to categorize citation ${url}:`, error.message);
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
            console.log(`✅ Processed ${i + 1}/${allResults.length}: ${categorizedCitations.length} citations categorized`);
          } else {
            console.log(`⚠️  No citations categorized for result ${result.id}`);
          }
        } catch (error: any) {
          failed++;
          const errorMsg = `Failed for result ${result.id}: ${error.message}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
          // Continue with next result
        }
      }

      console.log(`\n✅ Completed: ${processed} processed, ${failed} failed`);
    })();

  } catch (error: any) {
    console.error('❌ Error categorizing citations for existing results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export default router;

