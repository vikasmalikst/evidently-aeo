const { createClient } = require('@supabase/supabase-js');
const { loadEnvironment, getEnvVar } = require('../dist/utils/env-utils');

loadEnvironment();
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueryGeneration() {
  try {
    console.log('🧪 Testing Query Generation...');
    
    // Test with Nike brand
    const testRequest = {
      url: 'https://nike.com',
      locale: 'en-US',
      country: 'US',
      industry: 'Sports & Fashion',
      competitors: 'Adidas, Puma, Under Armour',
      keywords: 'athletic wear, running shoes, sports apparel',
      llm_provider: 'openai',
      brand_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      customer_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      topics: [
        'Nike Air Max running shoes',
        'Nike Dri-FIT technology',
        'Nike sustainability initiatives',
        'Nike vs Adidas comparison'
      ]
    };
    
    console.log('📝 Test Request:', JSON.stringify(testRequest, null, 2));
    
    // Call the query generation API
    const response = await fetch('http://localhost:3000/api/query-generation/seed-queries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getEnvVar('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(testRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ Query Generation Result:');
    console.log('📊 Total Queries:', result.data?.total_queries);
    console.log('📈 Queries by Intent:', result.data?.queries_by_intent);
    
    console.log('\n🔍 Generated Queries:');
    result.data?.queries?.forEach((query, index) => {
      console.log(`  ${index + 1}. [${query.intent}] ${query.query}`);
    });
    
    // Check for generic queries
    const genericQueries = result.data?.queries?.filter(q => 
      q.query.includes('What is') && q.query.includes('how does it work') ||
      q.query.includes('Benefits and features') ||
      q.query.includes('Introduction to')
    );
    
    if (genericQueries && genericQueries.length > 0) {
      console.log('\n❌ Found generic fallback queries:');
      genericQueries.forEach(q => console.log(`  - ${q.query}`));
    } else {
      console.log('\n✅ No generic fallback queries found - all queries are AI-generated!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQueryGeneration();
