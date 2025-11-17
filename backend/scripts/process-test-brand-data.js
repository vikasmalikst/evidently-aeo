const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testBrandId = 'ac98643c-771e-4add-ba88-9d9b961a63d7';
const devCustomerId = '123e4567-e89b-12d3-a456-426614174001';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processTestBrandData() {
  console.log('🔄 Processing Test Brand data...\n');

  // 1. Check collector results
  const { data: collectorResults, error: crError } = await supabase
    .from('collector_results')
    .select('id, query_id, collector_type, question, brand, competitors, raw_answer, created_at')
    .eq('brand_id', testBrandId)
    .not('query_id', 'is', null) // Only get results with query_id
    .limit(50);

  if (crError) {
    console.error('Error fetching collector results:', crError);
    return;
  }

  console.log(`📊 Found ${collectorResults?.length || 0} collector results`);

  if (!collectorResults || collectorResults.length === 0) {
    console.log('❌ No collector results found. Cannot process data.');
    return;
  }

  // 2. Get competitors
  const { data: competitors } = await supabase
    .from('brand_competitors')
    .select('competitor_name')
    .eq('brand_id', testBrandId)
    .order('priority', { ascending: true });

  const competitorNames = competitors?.map(c => c.competitor_name) || ['Competitor A', 'Competitor B', 'Competitor C'];
  console.log(`🏆 Found ${competitorNames.length} competitors: ${competitorNames.join(', ')}`);

  // 3. Create extracted_positions from collector_results
  console.log('\n📍 Creating extracted_positions...');
  let positionsCreated = 0;

  for (const result of collectorResults) {
    // Check if already processed
    const { data: existing } = await supabase
      .from('extracted_positions')
      .select('id')
      .eq('collector_result_id', result.id)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️  Already processed collector_result ${result.id}`);
      continue;
    }

    // Extract brand name from result or use default
    const brandName = result.brand || 'Test Brand';
    
    // Parse competitors from result
    let resultCompetitors = [];
    if (result.competitors) {
      if (Array.isArray(result.competitors)) {
        resultCompetitors = result.competitors.map(c => 
          typeof c === 'string' ? c : (c.competitor_name || c.name || c)
        ).filter(Boolean);
      }
    }
    
    // Use competitors from result or fallback to brand_competitors
    const competitorsToUse = resultCompetitors.length > 0 
      ? resultCompetitors.filter(c => competitorNames.includes(c))
      : competitorNames;

    // Simple text analysis to find brand and competitor mentions
    const rawAnswer = result.raw_answer || '';
    const answerLower = rawAnswer.toLowerCase();
    const brandNameLower = brandName.toLowerCase();
    
    // Count brand mentions
    const brandMentions = (answerLower.match(new RegExp(brandNameLower, 'g')) || []).length;
    const hasBrandPresence = brandMentions > 0;
    
    // Find approximate positions (simplified - just use word positions)
    const words = rawAnswer.split(/\s+/);
    const brandPositions = [];
    words.forEach((word, idx) => {
      if (word.toLowerCase().includes(brandNameLower)) {
        brandPositions.push(idx + 1);
      }
    });

    // Calculate simple metrics
    const totalWords = words.length;
    const visibilityIndex = hasBrandPresence ? 0.5 + Math.random() * 0.3 : 0;
    const shareOfAnswers = hasBrandPresence ? 10 + Math.random() * 15 : 0;
    const sentimentScore = hasBrandPresence ? 0.2 + Math.random() * 0.6 : 0;

    // Skip if no query_id (required field)
    if (!result.query_id) {
      console.log(`   ⏭️  Skipping result ${result.id} - no query_id`);
      continue;
    }

    // Skip if no raw_answer (required field)
    if (!result.raw_answer) {
      console.log(`   ⏭️  Skipping result ${result.id} - no raw_answer`);
      continue;
    }

    // Create brand position (no competitor)
    const brandPositionData = {
      brand_id: testBrandId,
      customer_id: devCustomerId,
      brand_name: brandName,
      query_id: result.query_id, // Required field
      collector_result_id: result.id,
      collector_type: result.collector_type,
      competitor_name: null,
      raw_answer: result.raw_answer, // Required field
      visibility_index: Math.round(visibilityIndex * 100) / 100,
      share_of_answers_brand: Math.round(shareOfAnswers * 10) / 10,
      sentiment_score: Math.round(sentimentScore * 100) / 100,
      sentiment_label: sentimentScore > 0.3 ? 'positive' : sentimentScore < -0.3 ? 'negative' : 'neutral',
      total_brand_mentions: brandMentions,
      brand_positions: JSON.stringify(brandPositions.slice(0, 10)), // Limit to first 10 positions
      has_brand_presence: hasBrandPresence,
      processed_at: result.created_at || new Date().toISOString()
    };

    const { error: brandError, data: brandData } = await supabase
      .from('extracted_positions')
      .insert(brandPositionData)
      .select('id');

    if (brandError) {
      console.error(`   ❌ Error creating brand position for result ${result.id}:`, brandError.message);
      console.error('   Data:', JSON.stringify(brandPositionData, null, 2));
    } else {
      positionsCreated++;
      console.log(`   ✅ Created brand position for ${result.collector_type} (result ${result.id})`);
    }

    // Create competitor positions
    for (const competitorName of competitorsToUse.slice(0, 2)) { // Limit to 2 competitors per result
      const competitorLower = competitorName.toLowerCase();
      const competitorMentions = (answerLower.match(new RegExp(competitorLower, 'g')) || []).length;
      
      const competitorPositions = [];
      words.forEach((word, idx) => {
        if (word.toLowerCase().includes(competitorLower)) {
          competitorPositions.push(idx + 1);
        }
      });

      const competitorVisibility = competitorMentions > 0 ? 0.4 + Math.random() * 0.25 : 0;
      const competitorShare = competitorMentions > 0 ? 8 + Math.random() * 12 : 0;

      const competitorPositionData = {
        brand_id: testBrandId,
        customer_id: devCustomerId,
        brand_name: brandName,
        query_id: result.query_id, // Required field
        collector_result_id: result.id,
        collector_type: result.collector_type,
        competitor_name: competitorName,
        raw_answer: result.raw_answer, // Required field
        visibility_index: Math.round(visibilityIndex * 100) / 100,
        visibility_index_competitor: Math.round(competitorVisibility * 100) / 100,
        share_of_answers_brand: Math.round(shareOfAnswers * 10) / 10,
        share_of_answers_competitor: Math.round(competitorShare * 10) / 10,
        sentiment_score: Math.round(sentimentScore * 100) / 100,
        sentiment_label: 'neutral',
        total_brand_mentions: brandMentions,
        competitor_mentions: competitorMentions,
        brand_positions: JSON.stringify(brandPositions.slice(0, 10)),
        competitor_positions: JSON.stringify(competitorPositions.slice(0, 10)),
        has_brand_presence: hasBrandPresence,
        processed_at: result.created_at || new Date().toISOString()
      };

      const { error: compError } = await supabase
        .from('extracted_positions')
        .insert(competitorPositionData);

      if (compError) {
        console.error(`   ❌ Error creating competitor position for ${competitorName}:`, compError.message);
      } else {
        positionsCreated++;
      }
    }
  }

  console.log(`   ✅ Created ${positionsCreated} extracted position records`);

  // 4. Create topics if missing
  console.log('\n📝 Checking topics...');
  const { data: existingTopics } = await supabase
    .from('brand_topics')
    .select('topic_name')
    .eq('brand_id', testBrandId);

  if (!existingTopics || existingTopics.length === 0) {
    console.log('   Creating default topics...');
    const defaultTopics = [
      'AI Tools',
      'Productivity',
      'Developer Tools',
      'Business Solutions',
      'Customer Service'
    ];

    const topicRecords = defaultTopics.map(topic => ({
      brand_id: testBrandId,
      topic_name: topic,
      description: `Topic: ${topic}`,
      category: 'awareness'
    }));

    const { error: topicError } = await supabase
      .from('brand_topics')
      .insert(topicRecords);

    if (topicError) {
      console.error('   Error creating topics:', topicError.message);
    } else {
      console.log(`   ✅ Created ${defaultTopics.length} topics`);
    }
  } else {
    console.log(`   ✅ Found ${existingTopics.length} existing topics`);
  }

  console.log('\n✅ Processing complete!');
  console.log('\n📊 Summary:');
  console.log(`   - Collector Results: ${collectorResults.length}`);
  console.log(`   - Extracted Positions Created: ${positionsCreated}`);
  console.log(`   - Competitors: ${competitorNames.length}`);
  console.log(`   - Topics: ${existingTopics?.length || 0}`);
  console.log('\n🔄 Refresh your browser to see the data!');
}

processTestBrandData().catch(console.error);

