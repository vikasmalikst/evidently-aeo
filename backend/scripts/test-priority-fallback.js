/**
 * Test Priority-Based Fallback Mechanism
 * This script tests the new priority-based collector system with fallback logic
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/data-collection';

async function testPriorityFallback() {
  console.log('🧪 Testing Priority-Based Fallback Mechanism\n');

  try {
    // Test 1: Check system configuration
    console.log('1️⃣ Testing system configuration...');
    const systemConfig = await axios.get(`${BASE_URL}/system-config`);
    console.log('✅ System config:', JSON.stringify(systemConfig.data, null, 2));

    // Test 2: Check collector priorities for ChatGPT
    console.log('\n2️⃣ Testing ChatGPT collector priorities...');
    const chatgptPriorities = await axios.get(`${BASE_URL}/priorities/chatgpt`);
    console.log('✅ ChatGPT priorities:', JSON.stringify(chatgptPriorities.data, null, 2));

    // Test 3: Check detailed health status
    console.log('\n3️⃣ Testing detailed health status...');
    const healthStatus = await axios.get(`${BASE_URL}/health-detailed`);
    console.log('✅ Health status:', JSON.stringify(healthStatus.data, null, 2));

    // Test 4: Execute a query with priority fallback
    console.log('\n4️⃣ Testing query execution with priority fallback...');
    const testQuery = {
      queryIds: ['Test query for priority fallback mechanism'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt', 'google_aio', 'perplexity'],
      locale: 'en-US',
      country: 'US'
    };

    const executionResult = await axios.post(`${BASE_URL}/execute`, testQuery);
    console.log('✅ Execution result:', JSON.stringify(executionResult.data, null, 2));

    // Test 4.1: Test ChatGPT with BrightData fallback
    console.log('\n4.1️⃣ Testing ChatGPT with BrightData fallback...');
    const chatgptFallbackQuery = {
      queryIds: ['ChatGPT fallback test - this should trigger BrightData if Oxylabs fails'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'], // Single collector to test fallback chain
      locale: 'en-US',
      country: 'US'
    };

    const chatgptResult = await axios.post(`${BASE_URL}/execute`, chatgptFallbackQuery);
    console.log('✅ ChatGPT fallback result:', JSON.stringify(chatgptResult.data, null, 2));

    // Test 5: Test with different collector types
    console.log('\n5️⃣ Testing different collector types...');
    const multiCollectorQuery = {
      queryIds: ['Multi-collector test query'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['baidu', 'bing', 'gemini'],
      locale: 'en-US',
      country: 'US'
    };

    const multiResult = await axios.post(`${BASE_URL}/execute`, multiCollectorQuery);
    console.log('✅ Multi-collector result:', JSON.stringify(multiResult.data, null, 2));

    // Test 5.1: Test Gemini with direct API
    console.log('\n5.1️⃣ Testing Gemini with direct API...');
    const geminiQuery = {
      queryIds: ['Gemini direct API test - should use Google Gemini API directly'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['gemini'], // This should use direct Google Gemini API
      locale: 'en-US',
      country: 'US'
    };

    const geminiResult = await axios.post(`${BASE_URL}/execute`, geminiQuery);
    console.log('✅ Gemini direct API result:', JSON.stringify(geminiResult.data, null, 2));

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the backend server is running on port 3000');
      console.log('   Run: npm run dev in the backend directory');
    }
  }
}

// Test individual collector priorities
async function testCollectorPriorities() {
  console.log('\n🔍 Testing Individual Collector Priorities\n');

  const collectors = ['chatgpt', 'google_aio', 'perplexity', 'baidu', 'bing', 'gemini'];

  for (const collector of collectors) {
    try {
      console.log(`📊 Testing ${collector} priorities...`);
      const response = await axios.get(`${BASE_URL}/priorities/${collector}`);
      console.log(`✅ ${collector}:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error(`❌ ${collector} failed:`, error.response?.data || error.message);
    }
  }
}

// Test fallback chain simulation
async function testFallbackChain() {
  console.log('\n🔄 Testing Fallback Chain Simulation\n');

  try {
    // This would simulate a scenario where primary providers fail
    // and the system falls back to secondary providers
    console.log('📝 Simulating fallback scenarios...');
    
    // Test with a query that might trigger fallbacks
    const fallbackTestQuery = {
      queryIds: ['Fallback test query - this might trigger provider failures'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'], // Test single collector with multiple providers
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing fallback test query...');
    const result = await axios.post(`${BASE_URL}/execute`, fallbackTestQuery);
    
    console.log('📊 Fallback test results:');
    console.log('✅ Status:', result.data.success);
    console.log('📈 Results count:', result.data.data?.results?.length || 0);
    
    if (result.data.data?.results) {
      result.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Result ${index + 1}:`);
        console.log(`   Collector: ${result.collectorType}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.fallbackUsed) {
          console.log(`   🔄 Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`   🔗 Fallback Chain: ${result.metadata.fallbackChain?.join(' → ')}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Fallback test failed:', error.response?.data || error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Priority-Based Fallback Tests\n');
  
  await testPriorityFallback();
  await testCollectorPriorities();
  await testFallbackChain();
  
  console.log('\n✨ All priority fallback tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testPriorityFallback,
  testCollectorPriorities,
  testFallbackChain,
  runAllTests
};
