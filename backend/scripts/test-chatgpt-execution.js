/**
 * Test ChatGPT Collector Execution
 * Verifies that ChatGPT collector is properly configured and executing
 */

const { DataCollectionService } = require('../dist/services/data-collection.service.js');

async function testChatGPTExecution() {
  console.log('🧪 Testing ChatGPT Collector Execution...\n');

  try {
    const dataCollectionService = new DataCollectionService();
    
    // Test query execution request
    const testRequest = {
      queryId: 'test-chatgpt-' + Date.now(),
      brandId: 'test-brand',
      customerId: 'test-customer',
      queryText: 'What are the best features of Zara clothing?',
      intent: 'awareness',
      locale: 'en-US',
      country: 'US',
      collectors: ['chatgpt'] // Only test ChatGPT
    };

    console.log('📋 Test Request:', {
      queryId: testRequest.queryId,
      queryText: testRequest.queryText,
      collectors: testRequest.collectors
    });

    // Execute the query
    console.log('\n🔄 Executing ChatGPT collector...');
    const startTime = Date.now();
    
    const results = await dataCollectionService.executeQuery(testRequest);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`\n✅ Execution completed in ${executionTime}ms`);
    console.log('📊 Results:', results);

    if (results && results.length > 0) {
      const chatgptResult = results.find(r => r.collectorType === 'chatgpt');
      if (chatgptResult) {
        console.log('\n🎉 ChatGPT execution successful!');
        console.log('📝 Response:', chatgptResult.response?.substring(0, 100) + '...');
        console.log('🔗 Citations:', chatgptResult.citations?.length || 0);
        console.log('🌐 URLs:', chatgptResult.urls?.length || 0);
        console.log('⏱️ Execution Time:', chatgptResult.executionTimeMs + 'ms');
        console.log('🏷️ Provider:', chatgptResult.metadata?.provider);
        console.log('🔄 Fallback Used:', chatgptResult.metadata?.fallbackUsed);
        console.log('🔗 Fallback Chain:', chatgptResult.metadata?.fallbackChain);
      } else {
        console.log('\n❌ No ChatGPT result found in results');
      }
    } else {
      console.log('\n❌ No results returned');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testChatGPTExecution().catch(console.error);
