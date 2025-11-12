const { createClient } = require('@supabase/supabase-js');
const { loadEnvironment, getEnvVar } = require('../dist/utils/env-utils');

loadEnvironment();
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTopicBasedQueryGeneration() {
  try {
    console.log('🧪 Testing Topic-Based Query Generation...');
    
    // Test with Discord brand and specific topics
    const testRequest = {
      url: 'https://discord.com',
      locale: 'en-US',
      country: 'US',
      industry: 'Communication & Gaming',
      competitors: 'Slack, Teams, Zoom',
      keywords: 'voice chat, gaming community, server management',
      llm_provider: 'openai',
      brand_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      customer_id: '8ce361f9-6120-4c64-a441-5ec33a1dfc77',
      topics: [
        'Community Building',
        'Voice & Video Features', 
        'User Privacy & Security',
        'Server Customization'
      ]
    };
    
    console.log('📝 Test Request Topics:', testRequest.topics);
    
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
    
    console.log('\n🔍 Generated Queries by Topic:');
    const queriesByTopic = {};
    result.data?.queries?.forEach((query, index) => {
      const topic = query.evidence_snippet?.split(' ').slice(-1)[0] || 'Unknown';
      if (!queriesByTopic[topic]) queriesByTopic[topic] = [];
      queriesByTopic[topic].push(query.query);
      console.log(`  ${index + 1}. [${topic}] ${query.query}`);
    });
    
    // Check for duplicates
    const allQueries = result.data?.queries?.map(q => q.query.toLowerCase().trim()) || [];
    const duplicates = allQueries.filter((query, index) => allQueries.indexOf(query) !== index);
    
    console.log('\n📋 Topic Coverage Analysis:');
    testRequest.topics.forEach(topic => {
      const topicQueries = queriesByTopic[topic] || [];
      console.log(`  ${topic}: ${topicQueries.length} queries`);
      if (topicQueries.length === 0) {
        console.log(`    ❌ No queries generated for "${topic}"`);
      } else if (topicQueries.length > 1) {
        console.log(`    ⚠️ Multiple queries for "${topic}": ${topicQueries.length}`);
      } else {
        console.log(`    ✅ Perfect: 1 unique query`);
      }
    });
    
    if (duplicates.length > 0) {
      console.log('\n❌ Found duplicate queries:');
      duplicates.forEach(dup => console.log(`  - "${dup}"`));
    } else {
      console.log('\n✅ No duplicate queries found!');
    }
    
    // Check if queries are topic-specific
    console.log('\n🎯 Topic Specificity Check:');
    result.data?.queries?.forEach((query, index) => {
      const queryText = query.query.toLowerCase();
      const isGeneric = queryText.includes('what is') && queryText.includes('how does it work');
      if (isGeneric) {
        console.log(`  ❌ Query ${index + 1} is generic: "${query.query}"`);
      } else {
        console.log(`  ✅ Query ${index + 1} is specific: "${query.query}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testTopicBasedQueryGeneration();
