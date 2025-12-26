/**
 * Quick test script to verify the test-connection endpoint works
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const BRAND_ID = 'test-brand'; // Replace with your actual brand ID
const CUSTOMER_ID = 'default-customer'; // Replace with your actual customer ID

async function testEndpoint() {
  const url = `${BASE_URL}/api/brands/${BRAND_ID}/analytics/test-connection?customer_id=${CUSTOMER_ID}`;
  
  console.log('Testing endpoint:', url);
  console.log('Method: POST');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log('Status:', response.status, response.statusText);
    const text = await response.text();
    console.log('Response:', text);
    
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Response is not JSON');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEndpoint();

