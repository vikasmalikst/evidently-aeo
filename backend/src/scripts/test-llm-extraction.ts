
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ConsolidatedAnalysisService, ConsolidatedAnalysisOptions } from '../services/scoring/consolidated-analysis.service';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Instantiate Service
    // Note: Service relies on env vars which we just loaded.
    const analysisService = new ConsolidatedAnalysisService();

    console.log('🔍 Finding a collector_result with raw content...');

    // Find a result that actually has an answer to analyze
    // We join with collector_task to get the raw html/content, but wait...
    // The service expects `rawAnswer`.
    // Usually this comes from `collector_results.raw_html` or `extracted_content`.
    // Let's check `collector_results` schema or usage.
    // Actually, usually `collector_results` stores the ANSWER from the LLM if it's an LLM collector, 
    // OR we might need to look at `raw_response` or similar.
    // BUT `ConsolidatedAnalysisService` is called with `rawAnswer`. 
    // In `brand-scoring.orchestrator.ts`, it passes `result.answer` (if LLM) or citation text.

    // The service uses `raw_answer`
    const { data: results } = await supabase
        .from('collector_results')
        .select('id, question, raw_answer, brand_id, brand:brands(name, customer_id)')
        .not('raw_answer', 'is', null) // Must have raw_answer
        .order('created_at', { ascending: false })
        .limit(1);

    if (!results || results.length === 0) {
        console.error('❌ No collector results with raw_answer found.');
        return;
    }

    const result = results[0];
    const brandName = (result.brand as any)?.name || 'Unknown Brand';
    const brandId = result.brand_id;
    const customerId = (result.brand as any)?.customer_id;

    console.log(`✅ Testing with Result ID: ${result.id}`);
    console.log(`   Brand: ${brandName}`);
    console.log(`   Question: ${result.question?.substring(0, 50)}...`);
    console.log(`   Answer Length: ${result.raw_answer?.length}`);

    if (!result.raw_answer) {
        console.error('❌ Raw Answer is empty.');
        return;
    }

    // 2. Prepare Options
    // We need competitor names. Let's fetch them.
    const { data: competitors } = await supabase
        .from('competitors')
        .select('name')
        .eq('brand_id', brandId)
        .limit(3);

    const competitorNames = (competitors || []).map(c => c.name);

    const options: ConsolidatedAnalysisOptions = {
        brandName: brandName,
        competitorNames: competitorNames,
        rawAnswer: result.raw_answer,
        citations: [], // Not validating citations here, just extraction
        // collectorResultId: result.id, // Commented out to FORCE fresh analysis (bypass cache)
        brandId: brandId,
        customerId: customerId,
        // Add dummy metadata if needed
        brandProducts: {
            brand_synonyms: [],
            brand_products: [],
            competitor_data: {}
        }
    };

    // 3. Run Analysis
    console.log('\n🚀 Running Consolidated Analysis (OpenRouter/Ollama)...');
    console.log('(This triggers the LLM with the NEW prompt asking for Quotes & Narratives)');

    try {
        // Force OpenRouter by accessing private methods
        // We do this because the default config might be pointing to a local Ollama instance which isn't running.
        console.log('🔄 Forcing OpenRouter API (bypassing default provider config)...');

        // @ts-ignore
        const prompt = analysisService.buildPrompt(options);
        // @ts-ignore
        const analysisResult = await analysisService.callOpenRouterAPI(prompt);

        console.log('\n--- 📊 Analysis Result ---');
        console.log(`LLM Provider used: ${analysisResult.metrics ? 'Unknown' : 'See Service Logs'}`);

        console.log('\n🔹 Keywords extracted:');
        if (analysisResult.keywords && analysisResult.keywords.length > 0) {
            analysisResult.keywords.forEach(k => console.log(`   - ${k.keyword} (${k.relevance_score})`));
        } else {
            console.log('   (dNone)');
        }

        console.log('\n🔹 Quotes extracted:');
        if (analysisResult.quotes && analysisResult.quotes.length > 0) {
            analysisResult.quotes.forEach(q => console.log(`   - "${q.text}" [${q.sentiment}]`));
        } else {
            console.log('   (None)');
        }

        console.log('\n🔹 Narrative:');
        if (analysisResult.narrative) {
            console.log(`   Brand: ${analysisResult.narrative.brand_summary}`);
            console.log(`   Competitors: ${analysisResult.narrative.competitor_highlight}`);
        } else {
            console.log('   (None)');
        }

        // Check if it persists to DB (optional, but good to know)
        // The service `analyze` calls `storeAnalysisInDB` internally.
        console.log('\n✅ Analysis complete. Check the output above.');

    } catch (err) {
        console.error('❌ Error running analysis:', err);
    }

    process.exit(0);
}

main().catch(console.error);
