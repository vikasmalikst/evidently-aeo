/**
 * Test BrightData ChatGPT Trigger API Integration
 * This script tests the BrightData ChatGPT trigger API (asynchronous)
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/data-collection';

async function testBrightDataChatGPTTrigger() {
  console.log('🧪 Testing BrightData ChatGPT Trigger API Integration\n');

  try {
    // Test 1: Test ChatGPT with BrightData trigger fallback
    console.log('1️⃣ Testing ChatGPT with BrightData trigger fallback...');
    const chatgptQuery = {
      queryIds: ['What are the top hotels in New York City?'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'], // This should try Oxylabs first, then BrightData trigger
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing ChatGPT query with BrightData trigger fallback...');
    const startTime = Date.now();
    const chatgptResult = await axios.post(`${BASE_URL}/execute`, chatgptQuery);
    const endTime = Date.now();
    
    console.log('📊 ChatGPT BrightData Trigger Result:');
    console.log('✅ Success:', chatgptResult.data.success);
    console.log('⏱️ Total Time:', `${endTime - startTime}ms`);
    console.log('📈 Results count:', chatgptResult.data.data?.results?.length || 0);
    
    if (chatgptResult.data.data?.results) {
      chatgptResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 ChatGPT Result ${index + 1}:`);
        console.log(`   Collector: ${result.collectorType}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.provider) {
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.metadata?.job_id) {
          console.log(`   📋 Job ID: ${result.metadata.job_id}`);
        }
        if (result.metadata?.fallbackUsed) {
          console.log(`   🔄 Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`   🔗 Fallback Chain: ${result.metadata.fallbackChain?.join(' → ')}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 200)}...`);
        }
      });
    }

    // Test 2: Test multiple ChatGPT queries with trigger API
    console.log('\n2️⃣ Testing multiple ChatGPT queries with trigger API...');
    const multiQuery = {
      queryIds: [
        'What are the biggest business trends to watch in the next five years?',
        'Analyze the key factors that influence customer buying decisions in online marketplaces.',
        'What are the latest developments in artificial intelligence?'
      ],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'],
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing multiple ChatGPT queries with trigger API...');
    const multiStartTime = Date.now();
    const multiResult = await axios.post(`${BASE_URL}/execute`, multiQuery);
    const multiEndTime = Date.now();
    
    console.log('📊 Multi-Query ChatGPT Trigger Result:');
    console.log('✅ Success:', multiResult.data.success);
    console.log('⏱️ Total Time:', `${multiEndTime - multiStartTime}ms`);
    console.log('📈 Results count:', multiResult.data.data?.results?.length || 0);
    
    if (multiResult.data.data?.results) {
      multiResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Query ${index + 1} Result:`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.provider) {
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.metadata?.job_id) {
          console.log(`   📋 Job ID: ${result.metadata.job_id}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 150)}...`);
        }
      });
    }

    // Test 3: Test ChatGPT fallback scenario
    console.log('\n3️⃣ Testing ChatGPT fallback scenario...');
    const fallbackQuery = {
      queryIds: ['Test ChatGPT fallback - this should try Oxylabs first, then BrightData trigger'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['chatgpt'], // Should try Oxylabs first, then BrightData trigger, then OpenAI direct
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing ChatGPT fallback test...');
    const fallbackStartTime = Date.now();
    const fallbackResult = await axios.post(`${BASE_URL}/execute`, fallbackQuery);
    const fallbackEndTime = Date.now();
    
    console.log('📊 ChatGPT Fallback Result:');
    console.log('✅ Success:', fallbackResult.data.success);
    console.log('⏱️ Total Time:', `${fallbackEndTime - fallbackStartTime}ms`);
    
    if (fallbackResult.data.data?.results) {
      fallbackResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Fallback Result ${index + 1}:`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.fallbackUsed) {
          console.log(`   🔄 Fallback Used: ${result.metadata.fallbackUsed}`);
          console.log(`   🔗 Fallback Chain: ${result.metadata.fallbackChain?.join(' → ')}`);
        }
        if (result.metadata?.provider) {
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.metadata?.job_id) {
          console.log(`   📋 Job ID: ${result.metadata.job_id}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 150)}...`);
        }
      });
    }

    console.log('\n🎉 BrightData ChatGPT Trigger API test completed!');

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

// Test BrightData trigger API directly
async function testBrightDataTriggerDirectly() {
  console.log('\n🔧 Testing BrightData Trigger API Directly\n');

  try {
    // This would require the actual API key to test directly
    console.log('📝 Note: Direct API testing requires valid BrightData credentials');
    console.log('   Testing through the data collection service instead...');
    
    // Test system configuration
    const configResult = await axios.get(`${BASE_URL}/system-config`);
    console.log('⚙️ System Config:', JSON.stringify(configResult.data, null, 2));

    // Test ChatGPT priorities
    const prioritiesResult = await axios.get(`${BASE_URL}/priorities/chatgpt`);
    console.log('🎯 ChatGPT Priorities:', JSON.stringify(prioritiesResult.data, null, 2));

  } catch (error) {
    console.error('❌ Direct API test failed:', error.message);
  }
}

// Main test runner
async function runBrightDataChatGPTTests() {
  console.log('🚀 Starting BrightData ChatGPT Trigger API Tests\n');
  
  await testBrightDataChatGPTTrigger();
  await testBrightDataTriggerDirectly();
  
  console.log('\n✨ All BrightData ChatGPT trigger tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runBrightDataChatGPTTests().catch(console.error);
}

module.exports = {
  testBrightDataChatGPTTrigger,
  testBrightDataTriggerDirectly,
  runBrightDataChatGPTTests
};
