# 🚀 Quick API Testing Guide

## Prerequisites

✅ Migration completed (4 tables created)
✅ Backend server running (`npm run dev` in `/backend`)

## Step 1: Get Your Brand ID

Run `../get-brand-id.sql` in **Supabase SQL Editor**:

```sql
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  (SELECT COUNT(*) FROM generated_queries WHERE brand_id = b.id AND is_active = true) as active_prompts_count
FROM brands b
JOIN customers c ON c.id = b.customer_id
ORDER BY b.created_at DESC
LIMIT 5;
```

**Copy the `brand_id`** from the results.

## Step 2: Get Your Auth Token

1. Open your app at `http://localhost:5173`
2. Login if not already
3. Open **Browser DevTools** (Press F12)
4. Go to **Console** tab
5. Paste and run:

```javascript
// Get your token
localStorage.getItem('supabase.auth.token') || 
sessionStorage.getItem('supabase.auth.token') ||
document.cookie
```

**Copy the token value** (the JWT string, not the whole JSON)

## Step 3: Test API in Browser Console

Replace `YOUR_BRAND_ID` and `YOUR_TOKEN` with your actual values:

### Test 1: Get Active Prompts

```javascript
const BRAND_ID = 'YOUR_BRAND_ID';
const TOKEN = 'YOUR_TOKEN';

fetch(`http://localhost:3001/api/brands/${BRAND_ID}/prompts/manage`, {
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Success!', data);
  console.log('Total Prompts:', data.data?.summary?.totalPrompts);
  console.log('Total Topics:', data.data?.summary?.totalTopics);
  console.log('Current Version:', data.data?.currentVersion);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Output:**
```
✅ Success! {success: true, data: {...}}
Total Prompts: 79
Total Topics: 10
Current Version: 0
```

### Test 2: Create Initial Version

```javascript
fetch(`http://localhost:3001/api/brands/${BRAND_ID}/prompts/batch`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    changes: { added: [], removed: [], edited: [] },
    changeSummary: 'Initial setup from existing prompts'
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Version Created!', data);
  console.log('New Version:', data.data?.newVersion);
  console.log('Config ID:', data.data?.configurationId);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Output:**
```
✅ Version Created! {success: true, data: {...}}
New Version: 1
Config ID: [some-uuid]
```

### Test 3: Get Version History

```javascript
fetch(`http://localhost:3001/api/brands/${BRAND_ID}/prompts/versions`, {
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ Version History:', data);
  console.table(data.data?.versions);
})
.catch(err => console.error('❌ Error:', err));
```

**Expected Output:**
```
✅ Version History: {success: true, data: {...}}
[Table showing all versions]
```

### Test 4: Add a New Prompt

```javascript
fetch(`http://localhost:3001/api/brands/${BRAND_ID}/prompts`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: 'What security certifications does your platform have?',
    topic: 'Security'
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Prompt Added!', data);
  console.log('Prompt ID:', data.data?.promptId);
})
.catch(err => console.error('❌ Error:', err));
```

### Test 5: Calculate Impact

```javascript
fetch(`http://localhost:3001/api/brands/${BRAND_ID}/prompts/calculate-impact`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    changes: {
      added: [
        { text: 'How do you handle GDPR compliance?', topic: 'Security' }
      ],
      removed: [],
      edited: []
    }
  })
})
.then(r => r.json())
.then(data => {
  console.log('✅ Impact Calculated!', data);
  console.log('Coverage Impact:', data.data?.estimatedImpact?.coverage);
})
.catch(err => console.error('❌ Error:', err));
```

## Step 4: Verify in Database

Run in **Supabase SQL Editor**:

```sql
-- Check versions
SELECT 
  version,
  is_active,
  change_type,
  change_summary,
  created_at
FROM prompt_configurations
WHERE brand_id = 'YOUR_BRAND_ID'
ORDER BY version DESC;

-- Check snapshots
SELECT 
  pc.version,
  COUNT(pcs.id) as prompt_count
FROM prompt_configurations pc
LEFT JOIN prompt_configuration_snapshots pcs ON pcs.configuration_id = pc.id
WHERE pc.brand_id = 'YOUR_BRAND_ID'
GROUP BY pc.version
ORDER BY pc.version DESC;

-- Check metrics
SELECT 
  pc.version,
  pms.total_prompts,
  pms.total_topics,
  pms.coverage_score,
  pms.avg_visibility_score
FROM prompt_configurations pc
LEFT JOIN prompt_metrics_snapshots pms ON pms.configuration_id = pc.id
WHERE pc.brand_id = 'YOUR_BRAND_ID'
ORDER BY pc.version DESC;
```

## Alternative: Use Postman or Thunder Client

If you prefer a REST client:

### GET Active Prompts
```
GET http://localhost:3001/api/brands/YOUR_BRAND_ID/prompts/manage
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
```

### POST Create Version
```
POST http://localhost:3001/api/brands/YOUR_BRAND_ID/prompts/batch
Headers:
  Authorization: Bearer YOUR_TOKEN
  Content-Type: application/json
Body (JSON):
{
  "changes": {
    "added": [],
    "removed": [],
    "edited": []
  },
  "changeSummary": "Initial setup"
}
```

## Common Issues

### ❌ "Unauthorized" or 401 Error
**Fix:** Your token expired. Get a fresh one by:
1. Logout and login again
2. Run the token script in console again

### ❌ "Brand not found"
**Fix:** Verify your brand_id with the SQL query

### ❌ CORS Error
**Fix:** Make sure backend is running on port 3001:
```bash
cd backend
npm run dev
```

### ❌ "Failed to fetch"
**Fix:** Backend not running. Check:
```bash
lsof -i :3001  # Should show node process
```

## What Success Looks Like

✅ All API calls return `{"success": true, ...}`
✅ Version 1 created in database
✅ Snapshots stored for all prompts
✅ Metrics calculated and saved
✅ No errors in backend console

## Next Steps

Once backend is working:
1. ✅ Backend APIs tested
2. ⏳ Connect frontend to real APIs
3. ⏳ Replace mock data
4. ⏳ Test full workflow in UI

---

**Need help?** Check backend logs for detailed error messages:
```bash
cd backend
npm run dev
# Watch the console output
```

