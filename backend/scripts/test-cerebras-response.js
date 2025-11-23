/**
 * Test script to capture real Cerebras API responses for analysis
 * This helps perfect the JSON parsing logic by saving actual LLM outputs
 */

// ============================================================================
// CONFIGURATION - Set your API key here (or leave null to use .env file)
// ============================================================================
const CEREBRAS_API_KEY = 'csk-tkky48mnnpf83y69hcwynnkdcv6mnfwkt69vhm5tv3mmr29t'; // Set to your API key string, or null to use .env
const CEREBRAS_MODEL = 'qwen-3-235b-a22b-instruct-2507';   // Set to model name, or null to use .env/default

// ============================================================================

const fs = require('fs');
const path = require('path');

require('ts-node/register');
const { loadEnvironment } = require('../dist/utils/env-utils');

loadEnvironment();

// Override environment variables if API key is set in this file
if (CEREBRAS_API_KEY) {
  process.env['CEREBRAS_API_KEY'] = CEREBRAS_API_KEY;
  console.log('🔑 Using Cerebras API key from script configuration');
}

if (CEREBRAS_MODEL) {
  process.env['CEREBRAS_MODEL'] = CEREBRAS_MODEL;
  console.log(`🤖 Using Cerebras model from script configuration: ${CEREBRAS_MODEL}`);
}

// Directory to save responses
const RESPONSES_DIR = path.join(__dirname, 'cerebras-responses');

// Ensure the directory exists
if (!fs.existsSync(RESPONSES_DIR)) {
  fs.mkdirSync(RESPONSES_DIR, { recursive: true });
  console.log(`📁 Created directory: ${RESPONSES_DIR}`);
}

async function testWithCerebras(brandName) {
  // Declare variables outside try block so they're accessible in catch
  let rawCerebrasText = null;
  let parsedResult = null;
  let parseStrategy = null;
  let parseError = null;
  
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 Testing Cerebras API with brand: ${brandName}`);
    console.log('='.repeat(80));
    
    // Load the service
    const { onboardingIntelService } = require('../src/services/onboarding');
    
    // Store original method
    const originalExtractJson = onboardingIntelService['extractJsonFromText'];
    
    // Wrap the method to capture raw response
    onboardingIntelService['extractJsonFromText'] = function(text) {
      rawCerebrasText = text;
      console.log('\n📥 Captured raw Cerebras response');
      console.log(`   Length: ${text.length} characters`);
      
      try {
        const result = originalExtractJson.call(this, text);
        parsedResult = result;
        
        // Try to determine which strategy was used based on logs
        if (text.includes('{') && text.includes('}')) {
          try {
            JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
            parseStrategy = 'Strategy 1: As-is';
          } catch {
            parseStrategy = 'Strategy 2 or higher: Enhanced parsing';
          }
        } else {
          parseStrategy = 'Strategy 4: Regex extraction';
        }
        
        return result;
      } catch (error) {
        parseError = error.message;
        throw error;
      }
    };
    
    console.log('\n📞 Calling onboarding intel service...\n');
    
    const result = await onboardingIntelService.lookupBrandIntel({
      input: brandName,
      locale: 'en-US',
      country: 'US',
    });
    
    // Restore original method
    onboardingIntelService['extractJsonFromText'] = originalExtractJson;
    
    console.log('\n✅ Service call successful!');
    console.log(`   Brand: ${result.brand?.companyName}`);
    console.log(`   Competitors: ${result.competitors?.length || 0}`);
    
    // Save the raw response to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${brandName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
    const filepath = path.join(RESPONSES_DIR, filename);
    
    const analysisData = {
      metadata: {
        brand: brandName,
        timestamp: new Date().toISOString(),
        parseStrategy: parseStrategy,
        parseError: parseError,
        success: !parseError,
        rawTextLength: rawCerebrasText?.length || 0,
        competitorsExtracted: result.competitors?.length || 0,
      },
      rawCerebrasResponse: rawCerebrasText,
      parsedResult: parsedResult,
      finalResult: {
        brand: result.brand,
        competitors: result.competitors,
      },
    };
    
    fs.writeFileSync(filepath, JSON.stringify(analysisData, null, 2), 'utf-8');
    
    console.log(`\n💾 Response saved to: ${filename}`);
    console.log(`   Parse strategy: ${parseStrategy}`);
    
    // Display competitors
    if (result.competitors && result.competitors.length > 0) {
      console.log(`\n🏆 Extracted Competitors (${result.competitors.length}):`);
      result.competitors.slice(0, 10).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (${c.domain || 'no domain'})`);
        console.log(`      Industry: ${c.industry}, Relevance: ${c.relevance}`);
      });
    }
    
    // Show raw response preview
    console.log(`\n📄 Raw Response Preview (first 500 chars):`);
    console.log('─'.repeat(80));
    console.log(rawCerebrasText?.substring(0, 500) || 'N/A');
    console.log('─'.repeat(80));
    
    return { success: true, filepath, data: analysisData };
    
  } catch (error) {
    console.error(`\n❌ Error testing ${brandName}:`, error.message);
    
    // Save error details too (including raw response if captured)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ERROR_${brandName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.json`;
    const filepath = path.join(RESPONSES_DIR, filename);
    
    const errorData = {
      metadata: {
        brand: brandName,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        rawTextLength: rawCerebrasText?.length || 0,
      },
      rawCerebrasResponse: rawCerebrasText || 'Not captured - error occurred before response capture',
      parseStrategy: parseStrategy || 'N/A',
      parseError: parseError || error.message,
    };
    
    fs.writeFileSync(filepath, JSON.stringify(errorData, null, 2), 'utf-8');
    console.log(`\n💾 Error details saved to: ${filename}`);
    
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Cerebras API Response Capture Tool\n');
  console.log('This tool captures raw Cerebras responses for JSON parsing analysis\n');
  
  // Check if Cerebras API key is configured
  const cerebrasKey = process.env['CEREBRAS_API_KEY'];
  if (!cerebrasKey) {
    console.error('❌ CEREBRAS_API_KEY is not configured!');
    console.error('   Option 1: Set CEREBRAS_API_KEY at the top of this script file');
    console.error('   Option 2: Set CEREBRAS_API_KEY in your backend/.env file');
    process.exit(1);
  }
  
  console.log('✅ Cerebras API key found');
  console.log(`   Model: ${process.env['CEREBRAS_MODEL'] || 'llama3.1-8b'}`);
  console.log(`   Source: ${CEREBRAS_API_KEY ? 'Script configuration' : '.env file'}\n`);
  
  // Test with different brands to capture various response patterns
  const testBrands = [
    "Levi's",           // As requested
    // Add more brands here to test different scenarios
    // "Nike",
    // "Apple",
    // "Tesla",
  ];
  
  const results = [];
  
  for (const brand of testBrands) {
    const result = await testWithCerebras(brand);
    results.push({ brand, ...result });
    
    // Small delay between requests to be respectful to the API
    if (testBrands.indexOf(brand) < testBrands.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  ✅ Successful: ${results.filter(r => r.success).length}`);
  console.log(`  ❌ Failed: ${results.filter(r => !r.success).length}`);
  console.log(`\n📁 All responses saved to: ${RESPONSES_DIR}`);
  console.log('='.repeat(80));
  
  // Show saved files
  const files = fs.readdirSync(RESPONSES_DIR);
  console.log(`\n💾 Saved Response Files (${files.length}):`);
  files.forEach(file => {
    const stats = fs.statSync(path.join(RESPONSES_DIR, file));
    console.log(`   - ${file} (${Math.round(stats.size / 1024)}KB)`);
  });
  
  console.log('\n✨ Done! Review the saved JSON files to perfect your parsing logic.\n');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testWithCerebras,
  runTests,
};

