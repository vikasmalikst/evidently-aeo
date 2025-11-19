/**
 * Browser Console Test Script for Prompt Management APIs
 * 
 * HOW TO USE:
 * 1. Get your BRAND_ID by running get-brand-id.sql in Supabase
 * 2. Login to your app at http://localhost:5173
 * 3. Open Browser DevTools (F12) → Console tab
 * 4. Update BRAND_ID and TOKEN below
 * 5. Copy and paste this entire file into the console
 * 6. Press Enter
 */

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const BRAND_ID = 'YOUR_BRAND_ID_HERE';
const TOKEN = 'YOUR_TOKEN_HERE'; // Get from localStorage or login response
const API_URL = 'http://localhost:3001';

// ============================================
// TEST FUNCTIONS
// ============================================

async function testGetActivePrompts() {
  console.log('\n📊 Test 1: Get Active Prompts');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts/manage`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('Brand:', data.data.brandName);
      console.log('Current Version:', data.data.currentVersion);
      console.log('Total Prompts:', data.data.summary.totalPrompts);
      console.log('Total Topics:', data.data.summary.totalTopics);
      console.log('Coverage:', data.data.summary.coverage + '%');
      console.log('Avg Visibility:', data.data.summary.avgVisibility);
      console.log('Topics:', data.data.topics.map(t => t.name).join(', '));
      return { success: true, currentVersion: data.data.currentVersion };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

async function testGetVersionHistory() {
  console.log('\n📚 Test 2: Get Version History');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts/versions`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('Current Version:', data.data.currentVersion);
      console.log('Total Versions:', data.data.versions.length);
      
      if (data.data.versions.length > 0) {
        console.log('\nVersions:');
        console.table(data.data.versions.map(v => ({
          Version: v.version,
          Active: v.isActive ? '✓' : '',
          Type: v.changeType,
          Summary: v.changeSummary,
          Date: new Date(v.createdAt).toLocaleString()
        })));
      }
      
      return { success: true, versions: data.data.versions };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

async function testCreateInitialVersion() {
  console.log('\n🎯 Test 3: Create Initial Version');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts/batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changes: { added: [], removed: [], edited: [] },
        changeSummary: 'Initial version created by test script'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('New Version:', data.data.newVersion);
      console.log('Configuration ID:', data.data.configurationId);
      return { success: true, version: data.data.newVersion };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

async function testAddPrompt() {
  console.log('\n➕ Test 4: Add New Prompt');
  console.log('='.repeat(50));
  
  const testPrompt = {
    text: 'What security certifications and compliance standards does your platform support?',
    topic: 'Security & Compliance'
  };
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPrompt)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      console.log('Prompt Added:', testPrompt.text);
      console.log('Topic:', testPrompt.topic);
      console.log('Prompt ID:', data.data.promptId);
      return { success: true, promptId: data.data.promptId };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

async function testCalculateImpact() {
  console.log('\n📈 Test 5: Calculate Impact');
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts/calculate-impact`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        changes: {
          added: [
            { text: 'How does your platform handle GDPR compliance?', topic: 'Security' },
            { text: 'What data encryption methods do you use?', topic: 'Security' }
          ],
          removed: [],
          edited: []
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      const impact = data.data.estimatedImpact;
      
      console.log('\nCoverage Impact:');
      console.log('  Current:', impact.coverage.current + '%');
      console.log('  Projected:', impact.coverage.projected + '%');
      console.log('  Change:', (impact.coverage.change > 0 ? '+' : '') + impact.coverage.change + '%');
      
      if (impact.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        impact.warnings.forEach(w => console.log('  -', w));
      }
      
      return { success: true, impact };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

async function testCompareVersions(v1, v2) {
  console.log(`\n🔍 Test 6: Compare Versions ${v1} vs ${v2}`);
  console.log('='.repeat(50));
  
  try {
    const response = await fetch(`${API_URL}/api/brands/${BRAND_ID}/prompts/versions/compare?version1=${v1}&version2=${v2}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ SUCCESS!');
      const comparison = data.data;
      
      console.log('\nChanges Summary:');
      console.log('  Added:', comparison.changes.added.length, 'prompts');
      console.log('  Removed:', comparison.changes.removed.length, 'prompts');
      console.log('  Edited:', comparison.changes.edited.length, 'prompts');
      
      console.log('\nMetrics Comparison:');
      console.log('  Prompts:', comparison.metricsComparison.prompts.v1, '→', comparison.metricsComparison.prompts.v2);
      console.log('  Topics:', comparison.metricsComparison.topics.v1, '→', comparison.metricsComparison.topics.v2);
      console.log('  Coverage:', comparison.metricsComparison.coverage.v1, '→', comparison.metricsComparison.coverage.v2);
      
      return { success: true, comparison };
    } else {
      console.error('❌ FAILED:', data.error);
      return { success: false };
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    return { success: false };
  }
}

// ============================================
// RUN ALL TESTS
// ============================================

async function runAllTests() {
  console.log('\n🧪 PROMPT MANAGEMENT API TESTS');
  console.log('='.repeat(50));
  console.log('Brand ID:', BRAND_ID);
  console.log('API URL:', API_URL);
  console.log('Token:', TOKEN.substring(0, 20) + '...');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: Get Active Prompts
  const test1 = await testGetActivePrompts();
  results.tests.push({ name: 'Get Active Prompts', ...test1 });
  if (test1.success) results.passed++; else results.failed++;
  
  // Test 2: Get Version History
  const test2 = await testGetVersionHistory();
  results.tests.push({ name: 'Get Version History', ...test2 });
  if (test2.success) results.passed++; else results.failed++;
  
  // Test 3: Create Initial Version (only if no versions exist)
  if (test2.success && test2.versions.length === 0) {
    console.log('\n💡 No versions exist, creating initial version...');
    const test3 = await testCreateInitialVersion();
    results.tests.push({ name: 'Create Initial Version', ...test3 });
    if (test3.success) results.passed++; else results.failed++;
  } else {
    console.log('\n💡 Skipping version creation (versions already exist)');
  }
  
  // Test 4: Add Prompt
  const test4 = await testAddPrompt();
  results.tests.push({ name: 'Add New Prompt', ...test4 });
  if (test4.success) results.passed++; else results.failed++;
  
  // Test 5: Calculate Impact
  const test5 = await testCalculateImpact();
  results.tests.push({ name: 'Calculate Impact', ...test5 });
  if (test5.success) results.passed++; else results.failed++;
  
  // Test 6: Compare Versions (if we have at least 2)
  if (test2.success && test2.versions.length >= 2) {
    const v1 = test2.versions[test2.versions.length - 1].version;
    const v2 = test2.versions[0].version;
    const test6 = await testCompareVersions(v1, v2);
    results.tests.push({ name: 'Compare Versions', ...test6 });
    if (test6.success) results.passed++; else results.failed++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('🏁 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log('✅ Passed:', results.passed);
  console.log('❌ Failed:', results.failed);
  console.log('Total:', results.tests.length);
  console.log('\nResults:');
  console.table(results.tests.map(t => ({
    Test: t.name,
    Status: t.success ? '✅ Pass' : '❌ Fail'
  })));
  
  if (results.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\nNext steps:');
    console.log('1. ✅ Backend is working correctly');
    console.log('2. ⏳ Connect frontend to backend APIs');
    console.log('3. ⏳ Replace mock data in ManagePrompts page');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('Check backend logs for errors:');
    console.log('  cd backend && npm run dev');
  }
  
  return results;
}

// ============================================
// AUTO-RUN IF CONFIGURED
// ============================================

if (BRAND_ID === 'YOUR_BRAND_ID_HERE' || TOKEN === 'YOUR_TOKEN_HERE') {
  console.log('\n⚠️  CONFIGURATION REQUIRED');
  console.log('='.repeat(50));
  console.log('Please update BRAND_ID and TOKEN at the top of this script.');
  console.log('\nTo get your BRAND_ID:');
  console.log('  1. Run get-brand-id.sql in Supabase SQL Editor');
  console.log('  2. Copy the brand_id from the results');
  console.log('\nTo get your TOKEN:');
  console.log('  1. Login to your app');
  console.log('  2. Run: localStorage.getItem("supabase.auth.token")');
  console.log('  3. Copy the token value');
  console.log('\nThen run: runAllTests()');
} else {
  // Auto-run tests
  runAllTests();
}

// Export test functions for manual use
window.promptTests = {
  runAllTests,
  testGetActivePrompts,
  testGetVersionHistory,
  testCreateInitialVersion,
  testAddPrompt,
  testCalculateImpact,
  testCompareVersions
};

console.log('\n💡 Tip: Run individual tests with:');
console.log('  promptTests.testGetActivePrompts()');
console.log('  promptTests.testCalculateImpact()');
console.log('  etc...');

