const axios = require('axios');

async function testRealSnapshot() {
  const apiKey = '50779503a31ea1be376714904cbe4be2ed943da1ce90afd4a3d996249b78b51a';
  
  // Trigger Grok collection first
  console.log('🚀 Triggering Grok collection...');
  
  const scrapeResponse = await axios({
    method: 'post',
    url: 'https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_m8ve0u141icu75ae74&notify=false&include_errors=true',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    data: [{
      url: 'https://grok.com/',
      prompt: 'What are AI trends in 2025?',
      index: 1
    }]
  });
  
  console.log('📊 Scrape Response Status:', scrapeResponse.status);
  
  if (scrapeResponse.data.snapshot_id) {
    const snapshotId = scrapeResponse.data.snapshot_id;
    console.log('✅ Got snapshot_id:', snapshotId);
    
    // Wait 2 minutes for data to be ready
    console.log('⏳ Waiting 120 seconds for data to process...');
    await new Promise(resolve => setTimeout(resolve, 120000));
    
    // Now try to fetch using the download endpoint
    console.log('🧪 Testing /download endpoint with real snapshot_id...');
    
    try {
      const downloadResponse = await axios({
        method: 'get',
        url: `https://api.brightdata.com/datasets/v3/download?snapshot_id=${snapshotId}`,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Download Response Status:', downloadResponse.status);
      console.log('📊 Download Response:', JSON.stringify(downloadResponse.data, null, 2).substring(0, 1000));
    } catch (error) {
      console.log('❌ Download Error Status:', error.response?.status);
      console.log('📊 Download Error:', JSON.stringify(error.response?.data, null, 2));
      
      // Try the alternative snapshot endpoint
      console.log('🧪 Trying /snapshot endpoint...');
      try {
        const snapshotResponse = await axios({
          method: 'get',
          url: `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Snapshot Response Status:', snapshotResponse.status);
        console.log('📊 Snapshot Response:', JSON.stringify(snapshotResponse.data, null, 2).substring(0, 1000));
      } catch (snapshotError) {
        console.log('❌ Snapshot Error Status:', snapshotError.response?.status);
        console.log('📊 Snapshot Error:', JSON.stringify(snapshotError.response?.data, null, 2));
      }
    }
  } else {
    console.log('ℹ️ Synchronous response:', JSON.stringify(scrapeResponse.data, null, 2));
  }
}

testRealSnapshot();

