/**
 * Test AEO Topic Generation
 * Verifies that exactly 8 topics are generated with balanced distribution
 */

const { QueryGenerationService } = require('../dist/services/query-generation.service.js');

async function testAEOTopicGeneration() {
  console.log('🧪 Testing AEO Topic Generation...\n');

  try {
    const queryGenerationService = new QueryGenerationService();
    
    // Test query generation request
    const testRequest = {
      url: 'https://zara.com',
      locale: 'en-US',
      country: 'US',
      industry: 'Fashion',
      competitors: 'H&M, Uniqlo, Gap',
      keywords: 'clothing, fashion, style',
      llm_provider: 'openai',
      brand_id: 'test-brand-id',
      customer_id: 'test-customer-id',
      guided_prompts: [],
      topics: []
    };

    console.log('📋 Test Request:', {
      url: testRequest.url,
      industry: testRequest.industry,
      competitors: testRequest.competitors
    });

    // Generate queries
    console.log('\n🔄 Generating AEO topics...');
    const startTime = Date.now();
    
    const result = await queryGenerationService.generateSeedQueries(testRequest);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`\n✅ Generation completed in ${executionTime}ms`);
    console.log('📊 Result Summary:', {
      total_queries: result.total_queries,
      queries_by_intent: result.queries_by_intent,
      processing_time_seconds: result.processing_time_seconds
    });

    // Analyze the results
    const queries = result.queries;
    console.log(`\n📋 Generated Queries (${queries.length} total):`);
    
    // Group by intent
    const intentGroups = queries.reduce((acc, q) => {
      if (!acc[q.intent]) acc[q.intent] = [];
      acc[q.intent].push(q);
      return acc;
    }, {});

    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    
    console.log('\n🎯 Intent Distribution:');
    requiredIntents.forEach(intent => {
      const count = intentGroups[intent]?.length || 0;
      const status = count >= 1 ? '✅' : '❌';
      console.log(`  ${status} ${intent}: ${count} queries`);
      
      if (intentGroups[intent]) {
        intentGroups[intent].forEach((query, index) => {
          console.log(`    ${index + 1}. ${query.query}`);
        });
      }
    });

    // Validation
    console.log('\n🔍 Validation Results:');
    const totalQueries = queries.length;
    const hasAllIntents = requiredIntents.every(intent => (intentGroups[intent]?.length || 0) >= 1);
    const isBalanced = requiredIntents.every(intent => (intentGroups[intent]?.length || 0) >= 1);
    
    console.log(`  Total Queries: ${totalQueries} ${totalQueries === 8 ? '✅' : '❌'} (expected: 8)`);
    console.log(`  All Intents Covered: ${hasAllIntents ? '✅' : '❌'}`);
    console.log(`  Balanced Distribution: ${isBalanced ? '✅' : '❌'}`);
    
    if (totalQueries === 8 && hasAllIntents && isBalanced) {
      console.log('\n🎉 AEO Topic Generation Test PASSED!');
      console.log('✅ Exactly 8 topics generated');
      console.log('✅ All 4 intents covered (awareness, comparison, purchase, support)');
      console.log('✅ Balanced distribution achieved');
    } else {
      console.log('\n❌ AEO Topic Generation Test FAILED!');
      console.log('❌ Requirements not met');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testAEOTopicGeneration().catch(console.error);
