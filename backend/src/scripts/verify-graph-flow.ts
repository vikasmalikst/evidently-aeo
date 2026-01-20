import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { graphRecommendationService } from '../services/recommendations/graph-recommendation.service';

// Load environment variables
// Load environment variables from CWD (backend directory)
const envPath = path.resolve(process.cwd(), '.env');
console.log(`Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function verifyGraphFlow(brandNameInput: string) {
    console.log(`\n🔍 Verifying Graph Flow for brand: "${brandNameInput}"...\n`);

    try {
        // 1. Get Brand ID
        const { data: brand } = await supabaseAdmin
            .from('brands')
            .select('id, name')
            .ilike('name', `%${brandNameInput}%`)
            .single();

        if (!brand) {
            console.error(`❌ Brand "${brandNameInput}" not found.`);
            return;
        }

        console.log(`✅ Found Brand: ${brand.name} (${brand.id})`);

        // 2. Get Competitors
        // 2. Get Competitors
        const { data: competitors } = await supabaseAdmin
            .from('brand_competitors')
            .select('competitor_name')
            .eq('brand_id', brand.id);

        const competitorNames = competitors?.map(c => c.competitor_name) || [];
        console.log(`✅ Found ${competitorNames.length} Competitors: ${competitorNames.join(', ')}`);

        // 3. Fetch Data (Mimic Service)
        console.log('📊 Fetching Analysis Data...');
        const { data: cacheData, error } = await supabaseAdmin
            .from('consolidated_analysis_cache')
            .select(`
          collector_result_id, 
          keywords, 
          sentiment, 
          products, 
          quotes,
          narrative, 
          collector_results!inner(brand_id)
        `)
            .eq('collector_results.brand_id', brand.id)
            .limit(2000);

        if (!cacheData || cacheData.length === 0) {
            console.warn('⚠️ No analysis data found. Cannot build graph.');
            return;
        }
        console.log(`✅ Fetched ${cacheData.length} records.`);

        // 4. Build Graph (Mimic Service)
        console.log('🕸️ Building Graph and Running Algorithms...');
        const graphResults = cacheData.map(row => ({
            id: row.collector_result_id,
            analysis: {
                keywords: row.keywords || [],
                sentiment: row.sentiment || {},
                products: row.products || {},
                quotes: row.quotes || [],
                citations: {}
            } as any,
            competitorNames
        }));

        graphRecommendationService.buildGraph(brand.name, graphResults);
        graphRecommendationService.runAlgorithms();

        // 5. Extract Insights
        console.log('\n🧠 Extracting Insights (What will be sent to Prompt):');

        // A. OPPORTUNITY GAPS
        const opportunityGaps = competitorNames.flatMap(c => graphRecommendationService.getOpportunityGaps(c));
        console.log(`\n🔵 CATEGORY: OPPORTUNITY GAPS (Found: ${opportunityGaps.length})`);
        console.log('   (Proof: Where competitor has negative sentiment but we don\'t)');
        opportunityGaps.slice(0, 5).forEach((gap, idx) => {
            console.log(`   ${idx + 1}. GAP: "${gap.topic}" (Score: ${gap.score.toFixed(4)})`);
            console.log(`      Context: ${gap.context}`);
            if (gap.evidence && gap.evidence.length > 0) {
                console.log(`      Proof/Evidence:`);
                gap.evidence.slice(0, 2).forEach(e => console.log(`         "${e}"`));
            } else {
                console.log(`      (No direct text evidence found on edges)`);
            }
        });

        // B. BATTLEGROUNDS
        const battlegrounds = competitorNames.flatMap(c => graphRecommendationService.getBattlegrounds(brand.name, c));
        console.log(`\n🔴 CATEGORY: BATTLEGROUNDS (Found: ${battlegrounds.length})`);
        console.log('   (Proof: High activity for both Brand and Competitor)');
        battlegrounds.slice(0, 5).forEach((bg, idx) => {
            console.log(`   ${idx + 1}. BATTLEGROUND: "${bg.topic}" (Score: ${bg.score.toFixed(4)})`);
            // Assuming getBattlegrounds doesn't populate evidence by default in service, 
            // but if it did, we'd print it. Let's print context at least.
            console.log(`      Context: ${bg.context}`);
        });

        // C. COMPETITOR STRONGHOLDS
        const strongholds = competitorNames.flatMap(c => graphRecommendationService.getCompetitorStrongholds(c));
        console.log(`\n🏰 CATEGORY: COMPETITOR STRONGHOLDS (Found: ${strongholds.length})`);
        console.log('   (Proof: Competitor dominates with Positive Sentiment)');
        strongholds.slice(0, 5).forEach((sh, idx) => {
            console.log(`   ${idx + 1}. STRONGHOLD: "${sh.topic}" (Score: ${sh.score.toFixed(4)})`);
            console.log(`      Context: ${sh.context}`);
            if (sh.evidence && sh.evidence.length > 0) {
                console.log(`      Proof/Evidence:`);
                sh.evidence.slice(0, 2).forEach(e => console.log(`         "${e}"`));
            }
        });

        // 6. Test Loop of Prompt Injection
        console.log('\n📝 Simulating Prompt Injection Context:');
        let graphContextParts: string[] = [];

        if (opportunityGaps.length > 0) {
            graphContextParts.push(`CONFIRMED COMPETITOR WEAKNESSES (Attack these gaps):\n${opportunityGaps.slice(0, 3).map(g => `- Weakness: "${g.topic}" (Score: ${g.score.toFixed(4)})\n  Context: ${g.context}\n  Evidence: "${g.evidence[0] || 'N/A'}"`).join('\n')}`);
        }

        if (strongholds.length > 0) {
            graphContextParts.push(`COMPETITOR STRONGHOLDS (Learn from their success):\n${strongholds.slice(0, 3).map(g => `- Strength: "${g.topic}" (Score: ${g.score.toFixed(4)})\n  Context: ${g.context}`).join('\n')}`);
        }

        if (graphContextParts.length > 0) {
            console.log('--------------------------------------------------');
            console.log(graphContextParts.join('\n\n'));
            console.log('--------------------------------------------------');
        } else {
            console.log('(No specific graph insights strong enough to inject)');
        }

        console.log('\n✅ Verification Complete: Graph Logic is working and generating actionable text for the prompt.');

    } catch (err) {
        console.error('❌ Error during verification:', err);
    }
}

// Run for a default brand if not provided
const brandArg = process.argv[2] || 'Nike'; // Default to Nike or similar if no arg
verifyGraphFlow(brandArg);
