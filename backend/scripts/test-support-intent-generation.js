const { createClient } = require('@supabase/supabase-js');
const { loadEnvironment, getEnvVar } = require('../dist/utils/env-utils');

loadEnvironment();
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupportIntentGeneration() {
  try {
    console.log('🧪 Testing Support Intent Generation...');
    
    // Test with OpenAI brand
    const testRequest = {
      url: 'https://openai.com',
      locale: 'en-US',
      country: 'US',
      industry: 'AI & Technology',
      competitors: 'Google DeepMind, Anthropic, Microsoft AI',
      keywords: 'artificial intelligence, machine learning, language models',
      llm_provider: 'cerebras', // Use Cerebras as primary
      brand_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      customer_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      topics: [
        'Ethical AI Development',
        'AI Model Features', 
        'Safety & Risks',
        'Use Cases & Applications',
        'Research & Publications',
        'Community Engagement'
      ]
    };
    
    console.log('📝 Test Request Topics:', testRequest.topics);
    console.log('🔧 Testing with enhanced prompts and fallback generation');
    
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
    
    console.log('\n🔍 Generated Queries by Intent:');
    const queriesByIntent = {};
    
    result.data?.queries?.forEach((query, index) => {
      const intent = query.intent || 'Unknown';
      
      if (!queriesByIntent[intent]) queriesByIntent[intent] = [];
      queriesByIntent[intent].push(query.query);
      
      console.log(`  ${index + 1}. [${intent}] ${query.query}`);
    });
    
    console.log('\n📊 Intent Coverage Analysis:');
    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    let allIntentsCovered = true;
    
    requiredIntents.forEach(intent => {
      const intentQueries = queriesByIntent[intent] || [];
      console.log(`  ${intent}: ${intentQueries.length} queries`);
      
      if (intentQueries.length === 0) {
        console.log(`    ❌ EMPTY INTENT: "${intent}" has no queries`);
        allIntentsCovered = false;
      } else if (intentQueries.length < 2) {
        console.log(`    ⚠️ LOW COVERAGE: "${intent}" has only ${intentQueries.length} query`);
      } else {
        console.log(`    ✅ GOOD COVERAGE: ${intentQueries.length} queries`);
      }
      
      // Show sample queries for each intent
      if (intentQueries.length > 0) {
        console.log(`    Sample queries:`);
        intentQueries.slice(0, 2).forEach((query, idx) => {
          console.log(`      ${idx + 1}. ${query}`);
        });
      }
    });
    
    // Check for duplicates
    const allQueries = result.data?.queries?.map(q => q.query.toLowerCase().trim()) || [];
    const duplicates = allQueries.filter((query, index) => allQueries.indexOf(query) !== index);
    
    if (duplicates.length > 0) {
      console.log('\n❌ Found duplicate queries:');
      duplicates.forEach(dup => console.log(`  - "${dup}"`));
    } else {
      console.log('\n✅ No duplicate queries found!');
    }
    
    // Summary
    const emptyIntents = requiredIntents.filter(intent => !queriesByIntent[intent] || queriesByIntent[intent].length === 0);
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Intents Required: ${requiredIntents.length}`);
    console.log(`  Intents with Queries: ${requiredIntents.length - emptyIntents.length}`);
    console.log(`  Empty Intents: ${emptyIntents.length}`);
    
    if (emptyIntents.length > 0) {
      console.log(`\n❌ STILL HAVE EMPTY INTENTS: ${emptyIntents.join(', ')}`);
      console.log('🔧 Possible causes:');
      console.log('  - AI not following prompt instructions');
      console.log('  - Fallback generation not working');
      console.log('  - Prompt needs further refinement');
    } else {
      console.log('\n✅ ALL INTENTS HAVE QUERIES!');
    }
    
    // Test support intent specifically
    const supportQueries = queriesByIntent['support'] || [];
    console.log('\n🎯 SUPPORT INTENT ANALYSIS:');
    console.log(`  Support queries count: ${supportQueries.length}`);
    
    if (supportQueries.length > 0) {
      console.log('  Support query types:');
      supportQueries.forEach((query, idx) => {
        const isSupportRelated = query.toLowerCase().includes('support') || 
                                query.toLowerCase().includes('help') || 
                                query.toLowerCase().includes('contact') ||
                                query.toLowerCase().includes('troubleshoot') ||
                                query.toLowerCase().includes('refund') ||
                                query.toLowerCase().includes('return');
        
        console.log(`    ${idx + 1}. ${isSupportRelated ? '✅' : '❌'} ${query}`);
      });
    } else {
      console.log('  ❌ NO SUPPORT QUERIES GENERATED');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSupportIntentGeneration();
