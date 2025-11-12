/**
 * Test BrightData Integration
 * This script tests the BrightData ChatGPT collector integration
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/data-collection';

async function testBrightDataIntegration() {
  console.log('🧪 Testing BrightData Integration\n');

  try {
    // Test 1: Test ChatGPT with BrightData fallback
    console.log('1️⃣ Testing ChatGPT with BrightData fallback...');
    const chatgptQuery = {
      queryIds: ['What are the latest AI trends in 2024?'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'], // This should try Oxylabs first, then BrightData
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing ChatGPT query with fallback...');
    const chatgptResult = await axios.post(`${BASE_URL}/execute`, chatgptQuery);
    
    console.log('📊 ChatGPT Result:');
    console.log('✅ Success:', chatgptResult.data.success);
    console.log('📈 Results count:', chatgptResult.data.data?.results?.length || 0);
    
    if (chatgptResult.data.data?.results) {
      chatgptResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 ChatGPT Result ${index + 1}:`);
        console.log(`   Collector: ${result.collectorType}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.fallbackUsed) {
          console.log(`   🔄 Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`   🔗 Fallback Chain: ${result.metadata.fallbackChain?.join(' → ')}`);
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 100)}...`);
        }
      });
    }

    // Test 2: Test multiple collectors with fallback
    console.log('\n2️⃣ Testing multiple collectors with fallback...');
    const multiCollectorQuery = {
      queryIds: ['Best restaurants in New York City'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt', 'google_aio', 'perplexity'],
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing multi-collector query...');
    const multiResult = await axios.post(`${BASE_URL}/execute`, multiCollectorQuery);
    
    console.log('📊 Multi-Collector Result:');
    console.log('✅ Success:', multiResult.data.success);
    console.log('📈 Results count:', multiResult.data.data?.results?.length || 0);
    
    if (multiResult.data.data?.results) {
      multiResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Collector ${index + 1} (${result.collectorType}):`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.fallbackUsed) {
          console.log(`   🔄 Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`   🔗 Fallback Chain: ${result.metadata.fallbackChain?.join(' → ')}`);
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 100)}...`);
        }
      });
    }

    // Test 3: Test health status
    console.log('\n3️⃣ Testing health status...');
    const healthResult = await axios.get(`${BASE_URL}/health-detailed`);
    console.log('🏥 Health Status:');
    console.log('✅ Overall Health:', healthResult.data.data.overall_health);
    
    if (healthResult.data.data.collectors) {
      Object.entries(healthResult.data.data.collectors).forEach(([collector, status]) => {
        console.log(`   ${collector}: ${status.overall ? '✅' : '❌'} (${Object.keys(status.providers || {}).length} providers)`);
      });
    }

    console.log('\n🎉 BrightData integration test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the backend server is running on port 3000');
      console.log('   Run: npm run dev in the backend directory');
    } else if (error.response?.status === 500) {
      console.log('\n💡 Check your environment variables:');
      console.log('   - BRIGHTDATA_API_KEY');
      console.log('   - BRIGHTDATA_DATASET_ID');
      console.log('   - OXYLABS_API_KEY');
    }
  }
}

// Test BrightData service directly
async function testBrightDataService() {
  console.log('\n🔧 Testing BrightData Service Directly\n');

  try {
    // This would require importing the service directly
    // For now, we'll test through the API
    console.log('📝 Note: Direct service testing requires importing the service');
    console.log('   Testing through API endpoints instead...');
    
    // Test system configuration
    const configResult = await axios.get(`${BASE_URL}/system-config`);
    console.log('⚙️ System Config:', JSON.stringify(configResult.data, null, 2));

  } catch (error) {
    console.error('❌ Direct service test failed:', error.message);
  }
}

// Main test runner
async function runBrightDataTests() {
  console.log('🚀 Starting BrightData Integration Tests\n');
  
  await testBrightDataIntegration();
  await testBrightDataService();
  
  console.log('\n✨ All BrightData tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runBrightDataTests().catch(console.error);
}

module.exports = {
  testBrightDataIntegration,
  testBrightDataService,
  runBrightDataTests
};
