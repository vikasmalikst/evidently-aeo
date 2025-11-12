/**
 * Keyword Generation API Routes
 * Handles keyword generation from query answers using LLM
 */

import { Router, Request, Response } from 'express';
import { keywordGenerationService } from '../services/keywords/keyword-generation.service';
import { supabaseAdmin } from '../config/database';

const router = Router();

/**
 * POST /api/keywords/generate
 * Generate keywords from an answer using LLM and store in both tables:
 * - generated_keywords table (one row per keyword)
 * - collector_results table (keywords as comma-separated text)
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      answer,
      query_id,
      query_text,
      collector_result_id,
      brand_id,
      customer_id,
      max_keywords = 20,
      store_keywords = true
    } = req.body;

    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Answer text is required'
      });
    }

    // Generate keywords using LLM
    const keywordResponse = await keywordGenerationService.generateKeywords({
      answer,
      query_id,
      query_text,
      collector_result_id,
      brand_id,
      customer_id,
      max_keywords
    });

    // Store keywords in database if requested
    // Stores in both generated_keywords table (one row per keyword)
    // and collector_results table (comma-separated text)
    if (store_keywords && keywordResponse.keywords.length > 0) {
      await keywordGenerationService.storeKeywords(keywordResponse.keywords, {
        answer,
        query_id,
        query_text,
        collector_result_id,
        brand_id,
        customer_id
      });
    }

    return res.json({
      success: true,
      data: keywordResponse
    });
  } catch (error: any) {
    console.error('❌ Keyword generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/keywords/generate-for-existing
 * Generate keywords for existing collector_results that don't have keywords yet
 * Stores keywords in both generated_keywords table and collector_results table
 */
router.post('/generate-for-existing', async (req: Request, res: Response) => {
  try {
    const {
      collector_result_id,  // Generate for specific result (optional)
      brand_id,             // Generate for all results of a brand (optional)
      limit = 100,          // Max number of results to process
      max_keywords = 20
    } = req.body;

    console.log('🔍 Finding collector_results without keywords...');

    // Build query to find collector_results without keywords
    let query = supabaseAdmin
      .from('collector_results')
      .select('id, raw_answer, query_id, brand_id, customer_id, keywords')
      .not('raw_answer', 'is', null);

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
      .limit(limit * 2); // Get more to filter out ones with keywords

    if (fetchError) {
      console.error('❌ Error fetching collector results:', fetchError);
      throw fetchError;
    }

    if (!allResults || allResults.length === 0) {
      return res.json({
        success: true,
        message: 'No collector results found',
        processed: 0,
        total: 0
      });
    }

    // Filter to only results without keywords (NULL or empty)
    const collectorResults = (allResults || []).filter(result => 
      !result.keywords || result.keywords.trim().length === 0
    ).slice(0, limit);

    if (collectorResults.length === 0) {
      return res.json({
        success: true,
        message: 'No collector results found that need keywords',
        processed: 0,
        total: 0
      });
    }

    console.log(`📊 Found ${collectorResults.length} collector results to process`);

    // Return immediately and process in background
    res.json({
      success: true,
      message: `Started processing ${collectorResults.length} collector results in background`,
      total: collectorResults.length,
      status: 'processing'
    });

    // Process in background (don't await)
    (async () => {
      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process each result
      for (let i = 0; i < collectorResults.length; i++) {
        const result = collectorResults[i];
        
        try {
          console.log(`[${i + 1}/${collectorResults.length}] Processing result ${result.id}...`);

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
            max_keywords
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
            console.log(`✅ Processed ${i + 1}/${collectorResults.length}: ${keywordResponse.keywords.length} keywords`);
          } else {
            console.log(`⚠️  No keywords generated for result ${result.id}`);
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
    console.error('❌ Error generating keywords for existing results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

export default router;
