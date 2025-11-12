const axios = require('axios');

async function testSnapshotEndpoint() {
  const apiKey = '50779503a31ea1be376714904cbe4be2ed943da1ce90afd4a3d996249b78b51a';
  
  // First, let's trigger a collection to get a real snapshot_id
  console.log('🚀 Triggering Bing Copilot collection...');
  
  try {
    const scrapeResponse = await axios({
      method: 'post',
      url: 'https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_m7di5jy6s9geokz8w&notify=false&include_errors=true',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: [{
        url: 'https://copilot.microsoft.com/chats',
        prompt: 'What are the best hotels in New York?',
        index: 1,
        country: ''
      }]
    });
    
    console.log('📊 Scrape Response Status:', scrapeResponse.status);
    console.log('📊 Scrape Response Data:', JSON.stringify(scrapeResponse.data, null, 2));
    
    // Check if we got a snapshot_id
    if (scrapeResponse.status === 202) {
      const snapshotId = scrapeResponse.data.snapshot_id;
      console.log('✅ Got snapshot_id:', snapshotId);
      
      // Wait a bit for data to be ready
      console.log('⏳ Waiting 15 seconds for data to process...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Now try to fetch the snapshot
      console.log('🧪 Testing /download endpoint...');
      const downloadUrl = `https://api.brightdata.com/datasets/v3/download?snapshot_id=${snapshotId}`;
      console.log('📊 Download URL:', downloadUrl);
      
      try {
        const downloadResponse = await axios({
          method: 'get',
          url: downloadUrl,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Download Response Status:', downloadResponse.status);
        console.log('📊 Download Response Data:', JSON.stringify(downloadResponse.data, null, 2));
      } catch (downloadError) {
        console.log('❌ Download Error Status:', downloadError.response?.status);
        console.log('📊 Download Error Response:', downloadError.response?.data);
        
        // Try the alternative endpoint
        console.log('🧪 Trying alternative /snapshot endpoint...');
        const snapshotUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
        console.log('📊 Snapshot URL:', snapshotUrl);
        
        try {
          const snapshotResponse = await axios({
            method: 'get',
            url: snapshotUrl,
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ Snapshot Response Status:', snapshotResponse.status);
          console.log('📊 Snapshot Response Data:', JSON.stringify(snapshotResponse.data, null, 2));
        } catch (snapshotError) {
          console.log('❌ Snapshot Error Status:', snapshotError.response?.status);
          console.log('📊 Snapshot Error Response:', snapshotError.response?.data);
        }
      }
    } else {
      console.log('ℹ️ Synchronous response, no snapshot needed');
      console.log('📊 Response:', JSON.stringify(scrapeResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status);
    console.error('📊 Error Response:', JSON.stringify(error.response?.data, null, 2));
  }
}

testSnapshotEndpoint();
