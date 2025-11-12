const { createClient } = require('@supabase/supabase-js');
const { loadEnvironment, getEnvVar } = require('../dist/utils/env-utils');

loadEnvironment();
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEmptyTopicsFix() {
  try {
    console.log('🧪 Testing Empty Topics Fix...');
    
    // Test with OpenAI brand and specific topics that might cause empty results
    const testRequest = {
      url: 'https://openai.com',
      locale: 'en-US',
      country: 'US',
      industry: 'AI & Technology',
      competitors: 'Google DeepMind, Anthropic, Microsoft AI',
      keywords: 'artificial intelligence, machine learning, language models',
      llm_provider: 'openai',
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
    console.log('🔧 Testing with increased token limit (4000) and enhanced prompts');
    
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
    
    console.log('\n🔍 Generated Queries by Topic and Intent:');
    const queriesByTopic = {};
    const queriesByIntent = {};
    
    result.data?.queries?.forEach((query, index) => {
      const topic = query.evidence_snippet?.split(' ').slice(-1)[0] || 'Unknown';
      const intent = query.intent || 'Unknown';
      
      if (!queriesByTopic[topic]) queriesByTopic[topic] = [];
      if (!queriesByIntent[intent]) queriesByIntent[intent] = [];
      
      queriesByTopic[topic].push(query.query);
      queriesByIntent[intent].push(query.query);
      
      console.log(`  ${index + 1}. [${intent}] [${topic}] ${query.query}`);
    });
    
    console.log('\n📋 Topic Coverage Analysis:');
    testRequest.topics.forEach(topic => {
      const topicQueries = queriesByTopic[topic] || [];
      console.log(`  ${topic}: ${topicQueries.length} queries`);
      if (topicQueries.length === 0) {
        console.log(`    ❌ EMPTY TOPIC: "${topic}" has no queries`);
      } else if (topicQueries.length > 1) {
        console.log(`    ⚠️ Multiple queries for "${topic}": ${topicQueries.length}`);
      } else {
        console.log(`    ✅ Perfect: 1 unique query`);
      }
    });
    
    console.log('\n📊 Intent Coverage Analysis:');
    const requiredIntents = ['awareness', 'comparison', 'purchase', 'support'];
    requiredIntents.forEach(intent => {
      const intentQueries = queriesByIntent[intent] || [];
      console.log(`  ${intent}: ${intentQueries.length} queries`);
      if (intentQueries.length === 0) {
        console.log(`    ❌ EMPTY INTENT: "${intent}" has no queries`);
      } else {
        console.log(`    ✅ ${intentQueries.length} queries found`);
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
    const emptyTopics = testRequest.topics.filter(topic => !queriesByTopic[topic] || queriesByTopic[topic].length === 0);
    const emptyIntents = requiredIntents.filter(intent => !queriesByIntent[intent] || queriesByIntent[intent].length === 0);
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Total Topics: ${testRequest.topics.length}`);
    console.log(`  Topics with Queries: ${testRequest.topics.length - emptyTopics.length}`);
    console.log(`  Empty Topics: ${emptyTopics.length}`);
    console.log(`  Empty Intents: ${emptyIntents.length}`);
    
    if (emptyTopics.length > 0) {
      console.log(`\n❌ STILL HAVE EMPTY TOPICS: ${emptyTopics.join(', ')}`);
      console.log('🔧 Possible causes:');
      console.log('  - Token limit still insufficient');
      console.log('  - AI struggling with specific topics');
      console.log('  - Prompt needs further refinement');
    } else {
      console.log('\n✅ ALL TOPICS HAVE QUERIES!');
    }
    
    if (emptyIntents.length > 0) {
      console.log(`\n❌ STILL HAVE EMPTY INTENTS: ${emptyIntents.join(', ')}`);
    } else {
      console.log('\n✅ ALL INTENTS HAVE QUERIES!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testEmptyTopicsFix();
