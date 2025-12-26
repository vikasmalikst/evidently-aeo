/**
 * Test script for GA4 Real-time Reports
 * Tests with property ID 516904207 and service account JSON
 * 
 * Usage:
 *   cd backend
 *   npx ts-node scripts/test-ga4-realtime.ts
 */

import { BetaAnalyticsDataClient } from '@google-analytics/data';
import * as fs from 'fs';

const PROPERTY_ID = '516904207';
const JSON_FILE_PATH = 'C:\\Users\\rakit\\Downloads\\startup-444304-9384d2116ae1.json';

// Dimensions and metrics to test
// Note: Not all dimensions are available in real-time reports
// Valid real-time dimensions: country, city, deviceCategory, operatingSystem, browser, etc.
// deviceModel might not be available in real-time
const dimensions = ['country']; // Start with just country
const metrics = ['activeUsers'];

async function testRealtimeReport() {
  let serviceAccountKey: any = null;
  
  try {
    console.log('🔍 Testing GA4 Real-time Reports...\n');
    
    // 1. Read and validate JSON file
    console.log('📄 Reading service account JSON file...');
    const jsonContent = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
    serviceAccountKey = JSON.parse(jsonContent);
    
    if (!serviceAccountKey.type || !serviceAccountKey.project_id) {
      throw new Error('Invalid service account JSON format');
    }
    
    console.log(`✅ JSON file loaded successfully`);
    console.log(`   Project ID: ${serviceAccountKey.project_id}`);
    console.log(`   Client Email: ${serviceAccountKey.client_email}\n`);
    
    // 2. Initialize GA4 client
    console.log('🔧 Initializing GA4 Analytics Data Client...');
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: serviceAccountKey,
    });
    console.log('✅ Client initialized\n');
    
    // 3. Query real-time report
    console.log('📊 Querying real-time report...');
    console.log(`   Property ID: ${PROPERTY_ID}`);
    console.log(`   Dimensions: ${dimensions.join(', ')}`);
    console.log(`   Metrics: ${metrics.join(', ')}\n`);
    
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${PROPERTY_ID}`,
      dimensions: dimensions.map(dim => ({ name: dim })),
      metrics: metrics.map(met => ({ name: met })),
      limit: 10000,
    });
    
    console.log('✅ Real-time report retrieved successfully!\n');
    
    // 4. Display results
    console.log('📈 Results:');
    console.log('─'.repeat(80));
    
    // Extract headers
    const dimensionHeaders = response.dimensionHeaders?.map(h => h.name || '') || [];
    const metricHeaders = response.metricHeaders?.map(h => h.name || '') || [];
    const headers = [...dimensionHeaders, ...metricHeaders];
    
    console.log(`Headers: ${headers.join(' | ')}`);
    console.log('─'.repeat(80));
    
    // Display rows
    if (response.rows && response.rows.length > 0) {
      console.log(`\nFound ${response.rows.length} rows:\n`);
      response.rows.forEach((row, index) => {
        const dimensionValues = row.dimensionValues?.map(dv => dv.value || '') || [];
        const metricValues = row.metricValues?.map(mv => mv.value || '0') || [];
        const values = [...dimensionValues, ...metricValues];
        console.log(`${(index + 1).toString().padStart(3)}: ${values.join(' | ')}`);
      });
    } else {
      console.log('\n⚠️  No data returned (this is normal if there are no active users right now)');
    }
    
    // Display totals
    if (response.totals && response.totals.length > 0) {
      console.log('\n─'.repeat(80));
      console.log('Totals:');
      response.totals[0].metricValues?.forEach((mv, idx) => {
        const metricName = metricHeaders[idx] || `Metric ${idx + 1}`;
        console.log(`  ${metricName}: ${mv.value || '0'}`);
      });
    }
    
    // Display row count
    console.log(`\nTotal Rows: ${response.rowCount || 0}`);
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Error testing GA4 real-time reports:');
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      
      // Check for common error codes
      if (error.message.includes('INVALID_ARGUMENT')) {
        console.error('\n💡 Possible issues:');
        console.error('   1. Property ID might be incorrect or service account lacks access');
        console.error('   2. Dimensions/metrics might not be valid for real-time reports');
        console.error('   3. Verify service account has "Viewer" access in GA4 Property Settings');
        console.error('\n   Try:');
        console.error('   - Verify property ID: 516904207');
        console.error('   - Check GA4 Property Access Management');
        console.error('   - Use simpler dimensions like: country, city');
      } else if (error.message.includes('PERMISSION_DENIED')) {
        console.error('\n💡 Permission denied:');
        console.error('   Service account needs "Viewer" role in GA4 Property Settings');
        console.error(`   Service account email: ${serviceAccountKey.client_email}`);
      }
      
      // Try to get more error details
      const grpcError = error as any;
      if (grpcError.code) {
        console.error(`   Error Code: ${grpcError.code}`);
      }
      if (grpcError.details) {
        console.error(`   Details: ${JSON.stringify(grpcError.details, null, 2)}`);
      }
    } else {
      console.error('   Unknown error:', error);
    }
    process.exit(1);
  }
}

// Run the test
testRealtimeReport();

