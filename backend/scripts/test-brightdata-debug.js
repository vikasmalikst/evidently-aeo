/**
 * BrightData Debug Test
 * Tests Bing Copilot and Grok collectors with detailed logging
 */

require('dotenv').config();

const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
if (!BRIGHTDATA_API_KEY) {
  console.error('Missing BRIGHTDATA_API_KEY in environment');
  process.exit(1);
}

console.log('🔍 BrightData API Key:', BRIGHTDATA_API_KEY.substring(0, 20) + '...');
console.log('');

// Test Bing Copilot
async function testBingCopilot() {
  console.log('🔵 Testing Bing Copilot...');
  const datasetId = 'gd_m7di5jy6s9geokz8w';
  const url = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true`;
  
  const payload = [{
    url: 'https://copilot.microsoft.com/chats',
    prompt: 'What are the biggest business trends to watch in the next five years?',
    index: 1,
    country: 'US'
  }];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📡 Full Response:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Parsed Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Error Response:', responseText);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

// Test Grok
async function testGrok() {
  console.log('\n🟢 Testing Grok...');
  const datasetId = 'gd_m8ve0u141icu75ae74';
  const url = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${datasetId}&notify=false&include_errors=true`;
  
  const payload = [{
    url: 'https://grok.com/',
    prompt: 'What are the biggest business trends to watch in the next five years?',
    index: 1
  }];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BRIGHTDATA_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📡 Full Response:', responseText);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log('✅ Parsed Response:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Error Response:', responseText);
    }
  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

// Run tests
(async () => {
  await testBingCopilot();
  await testGrok();
})();
