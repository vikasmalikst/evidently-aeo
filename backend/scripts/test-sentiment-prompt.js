/**
 * Test script to validate sentiment scoring prompt with Cerebras API
 * 
 * Usage:
 *   node scripts/test-sentiment-prompt.js
 * 
 * This script allows you to test the exact prompt used for brand/competitor
 * sentiment analysis to validate scores.
 */

require('dotenv').config();

const cerebrasApiKey = process.env.CEREBRAS_API_KEY_2 || process.env.CEREBRAS_API_KEY;
const cerebrasModel = process.env.CEREBRAS_MODEL || 'qwen-3-235b-a22b-instruct-2507';

if (!cerebrasApiKey) {
  console.error('❌ Error: CEREBRAS_API_KEY_2 or CEREBRAS_API_KEY not found in environment');
  process.exit(1);
}

/**
 * Truncate text to word limit (same as in sentiment-scoring.service.ts)
 */
function truncateToWordLimit(text, limit = 20000) {
  const words = text.split(/\s+/);
  if (words.length <= limit) {
    return text;
  }
  return words.slice(0, limit).join(' ');
}

/**
 * Test sentiment prompt with Cerebras
 */
async function testSentimentPrompt(text, brandName, competitorNames) {
  // Truncate to 20k words max (same as in service)
  const maxWords = 20000;
  const truncated = truncateToWordLimit(text, maxWords);

  const entities = [brandName, ...competitorNames];
  const entitiesList = entities.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

  const prompt = `Analyze the sentiment for each of the following entities mentioned in the text below.

Entities to analyze:
${entitiesList}

For each entity, provide:
1. Sentiment label: POSITIVE, NEGATIVE, or NEUTRAL
2. Sentiment score: A precise decimal number from -1.0 (very negative) to 1.0 (very positive)
   - Use granular scores like 0.23, -0.45, 0.67, -0.12, 0.89, etc.
   - Avoid rounding to common values like 0.80, 0.70, 0.00
   - Calculate based on how the entity is discussed in the text
3. List of positive sentences mentioning this entity
4. List of negative sentences mentioning this entity

Text to analyze:
${truncated}

Respond with ONLY valid JSON in this exact format:
{
  "entities": [
    {
      "entityName": "${brandName}",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0 (precise decimal),
      "positiveSentences": ["sentence 1", "sentence 2"],
      "negativeSentences": ["sentence 1", "sentence 2"]
    },
    {
      "entityName": "CompetitorName",
      "label": "POSITIVE|NEGATIVE|NEUTRAL",
      "score": -1.0 to 1.0 (precise decimal),
      "positiveSentences": ["sentence 1"],
      "negativeSentences": ["sentence 1"]
    }
  ]
}`;

  const fullPrompt = `You are a sentiment analysis expert. Always respond with valid JSON only, no explanations.

${prompt}`;

  console.log('\n📤 Sending request to Cerebras API...');
  console.log(`   Model: ${cerebrasModel}`);
  console.log(`   Brand: ${brandName}`);
  console.log(`   Competitors: ${competitorNames.join(', ')}`);
  console.log(`   Text length: ${truncated.length} chars (${truncated.split(/\s+/).length} words)\n`);

  try {
    const response = await fetch('https://api.cerebras.ai/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cerebrasApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cerebrasModel,
        prompt: fullPrompt,
        temperature: 0.3,
        max_tokens: 3000,
        stop: ['---END---']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cerebras API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.text || data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in Cerebras response');
    }

    console.log('📥 Raw response:');
    console.log('─'.repeat(80));
    console.log(content);
    console.log('─'.repeat(80));

    // Extract JSON from response (same logic as in service)
    let jsonStr = '';
    let cleanContent = content.trim();
    if (cleanContent.includes('```json')) {
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    } else if (cleanContent.includes('```')) {
      cleanContent = cleanContent.replace(/```\s*/g, '');
    }
    
    // Find JSON object by counting braces
    let braceCount = 0;
    let startIdx = -1;
    for (let i = 0; i < cleanContent.length; i++) {
      if (cleanContent[i] === '{') {
        if (startIdx === -1) startIdx = i;
        braceCount++;
      } else if (cleanContent[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          jsonStr = cleanContent.substring(startIdx, i + 1);
          break;
        }
      }
    }
    
    if (!jsonStr) {
      const jsonMatch = cleanContent.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }
    
    if (!jsonStr) {
      console.error('❌ No valid JSON found in response');
      return null;
    }

    const result = JSON.parse(jsonStr);
    
    console.log('\n✅ Parsed JSON result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n📊 Sentiment Summary:');
    if (result.entities && Array.isArray(result.entities)) {
      result.entities.forEach(entity => {
        console.log(`   ${entity.entityName}:`);
        console.log(`      Label: ${entity.label}`);
        console.log(`      Score: ${entity.score}`);
        console.log(`      Positive sentences: ${entity.positiveSentences?.length || 0}`);
        console.log(`      Negative sentences: ${entity.negativeSentences?.length || 0}`);
      });
    }

    if (data.usage) {
      console.log('\n🔢 Token usage:');
      console.log(`   Prompt tokens: ${data.usage.prompt_tokens || data.usage.promptTokens || 'N/A'}`);
      console.log(`   Completion tokens: ${data.usage.completion_tokens || data.usage.completionTokens || 'N/A'}`);
      console.log(`   Total tokens: ${data.usage.total_tokens || data.usage.totalTokens || 'N/A'}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

// Example usage
if (require.main === module) {
  // You can modify these test values
  const testText = `I've been using BrandName for a while now and I'm really impressed with their product quality. The features are excellent and the customer support is top-notch. However, CompetitorA has been making some interesting moves lately with their new pricing strategy. BrandName's latest update was disappointing though - it removed some features I relied on. CompetitorB seems to be gaining traction in the market.`;

  const testBrandName = 'BrandName';
  const testCompetitorNames = ['CompetitorA', 'CompetitorB'];

  console.log('🧪 Testing Sentiment Scoring Prompt');
  console.log('='.repeat(80));

  testSentimentPrompt(testText, testBrandName, testCompetitorNames)
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSentimentPrompt };

