/**
 * Test script to save GA4 credentials via API (matches frontend behavior)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROPERTY_ID = '516904207';
const BRAND_ID = 'test-brand'; // Replace with actual brand ID
const CUSTOMER_ID = 'default-customer'; // Replace with actual customer ID
const JSON_FILE_PATH = 'C:\\Users\\rakit\\Downloads\\startup-444304-9384d2116ae1.json';
const API_URL = 'http://localhost:3000/api';

async function testSaveCredentials() {
  try {
    console.log('Reading service account JSON...');
    const jsonContent = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
    const serviceAccountKey = JSON.parse(jsonContent);
    
    console.log('✅ JSON loaded');
    console.log(`   Project: ${serviceAccountKey.project_id}`);
    console.log(`   Email: ${serviceAccountKey.client_email}`);
    console.log();
    
    console.log('Saving credentials via API...');
    const url = `${API_URL}/brands/${BRAND_ID}/analytics/credentials`;
    console.log(`   URL: ${url}`);
    console.log(`   Property ID: ${PROPERTY_ID}`);
    console.log();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: CUSTOMER_ID,
        property_id: PROPERTY_ID,
        service_account_key: serviceAccountKey,
      }),
    });
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    const responseText = await response.text();
    console.log(`Response Body: ${responseText}`);
    
    if (response.ok) {
      const result = JSON.parse(responseText);
      console.log();
      console.log('✅ Credentials saved successfully!');
      console.log(`   Property ID: ${result.propertyId}`);
    } else {
      console.log();
      console.log('❌ Failed to save credentials');
      try {
        const error = JSON.parse(responseText);
        console.log(`   Error: ${error.error}`);
        if (error.details) {
          console.log(`   Details: ${error.details}`);
        }
      } catch (e) {
        console.log(`   Raw response: ${responseText}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.log('Node.js version < 18 detected. Installing node-fetch...');
  console.log('Please run: npm install node-fetch@2');
  console.log('Then modify this script to use: const fetch = require("node-fetch");');
  process.exit(1);
}

testSaveCredentials();

