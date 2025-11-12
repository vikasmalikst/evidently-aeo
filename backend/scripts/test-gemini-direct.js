/**
 * Test Gemini Direct API Integration
 * This script tests the direct Google Gemini API integration
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/data-collection';

async function testGeminiDirect() {
  console.log('🧪 Testing Gemini Direct API Integration\n');

  try {
    // Test 1: Test Gemini collector with direct API
    console.log('1️⃣ Testing Gemini collector with direct API...');
    const geminiQuery = {
      queryIds: ['What are the latest trends in artificial intelligence?'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['gemini'], // This should use direct Google Gemini API
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing Gemini query with direct API...');
    const geminiResult = await axios.post(`${BASE_URL}/execute`, geminiQuery);
    
    console.log('📊 Gemini Direct API Result:');
    console.log('✅ Success:', geminiResult.data.success);
    console.log('📈 Results count:', geminiResult.data.data?.results?.length || 0);
    
    if (geminiResult.data.data?.results) {
      geminiResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Gemini Result ${index + 1}:`);
        console.log(`   Collector: ${result.collectorType}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.provider) {
          console.log(`   🏢 Provider: ${result.metadata.provider}`);
        }
        if (result.metadata?.model) {
          console.log(`   🤖 Model: ${result.metadata.model}`);
        }
        if (result.metadata?.usage) {
          console.log(`   📊 Usage: ${JSON.stringify(result.metadata.usage)}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 200)}...`);
        }
      });
    }

    // Test 2: Test Gemini with multiple queries
    console.log('\n2️⃣ Testing Gemini with multiple queries...');
    const multiQuery = {
      queryIds: [
        'What is machine learning?',
        'Explain neural networks',
        'What are the benefits of AI?'
      ],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['gemini'],
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing multiple Gemini queries...');
    const multiResult = await axios.post(`${BASE_URL}/execute`, multiQuery);
    
    console.log('📊 Multi-Query Gemini Result:');
    console.log('✅ Success:', multiResult.data.success);
    console.log('📈 Results count:', multiResult.data.data?.results?.length || 0);
    
    if (multiResult.data.data?.results) {
      multiResult.data.data.results.forEach((result, index) => {
        console.log(`\n📋 Query ${index + 1} Result:`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Execution Time: ${result.executionTimeMs}ms`);
        if (result.metadata?.model) {
          console.log(`   🤖 Model: ${result.metadata.model}`);
        }
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 150)}...`);
        }
      });
    }

    // Test 3: Test Gemini fallback scenario
    console.log('\n3️⃣ Testing Gemini fallback scenario...');
    const fallbackQuery = {
      queryIds: ['Test Gemini fallback - this should try direct API first'],
      brandId: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      collectors: ['gemini'], // Should try direct API first, then BrightData, then Oxylabs
      locale: 'en-US',
      country: 'US'
    };

    console.log('🚀 Executing Gemini fallback test...');
    const fallbackResult = await axios.post(`${BASE_URL}/execute`, fallbackQuery);
    
    console.log('📊 Gemini Fallback Result:');
    console.log('✅ Success:', fallbackResult.data.success);
    
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
        if (result.error) {
          console.log(`   ❌ Error: ${result.error}`);
        } else if (result.response) {
          console.log(`   📝 Response: ${result.response.substring(0, 150)}...`);
        }
      });
    }

    console.log('\n🎉 Gemini Direct API test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 Make sure the backend server is running on port 3000');
      console.log('   Run: npm run dev in the backend directory');
    } else if (error.response?.status === 500) {
      console.log('\n💡 Check your environment variables:');
      console.log('   - GOOGLE_GEMINI_API_KEY');
      console.log('   - GOOGLE_GEMINI_MODEL (optional, defaults to gemini-2.5-flash)');
    }
  }
}

// Test Gemini API configuration
async function testGeminiConfig() {
  console.log('\n🔧 Testing Gemini Configuration\n');

  try {
    // Test system configuration
    const configResult = await axios.get(`${BASE_URL}/system-config`);
    console.log('⚙️ System Config:', JSON.stringify(configResult.data, null, 2));

    // Test Gemini priorities
    const prioritiesResult = await axios.get(`${BASE_URL}/priorities/gemini`);
    console.log('🎯 Gemini Priorities:', JSON.stringify(prioritiesResult.data, null, 2));

  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
  }
}

// Main test runner
async function runGeminiTests() {
  console.log('🚀 Starting Gemini Direct API Tests\n');
  
  await testGeminiConfig();
  await testGeminiDirect();
  
  console.log('\n✨ All Gemini tests completed!');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runGeminiTests().catch(console.error);
}

module.exports = {
  testGeminiDirect,
  testGeminiConfig,
  runGeminiTests
};
