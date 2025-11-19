# 🚀 Quick Start: Testing Prompt Management Backend

You're currently seeing the **mock data page**. Here's how to test the real backend!

## Step 1: Run Database Migration

Open your Supabase SQL Editor and run:

```bash
# Navigate to Supabase migrations
cd /Users/avayasharma/evidently/supabase/migrations
```

Then in **Supabase SQL Editor**, copy and paste the contents of:
`20251118000000_create_prompt_versioning_tables.sql`

This creates:
- ✅ `prompt_configurations` table
- ✅ `prompt_configuration_snapshots` table
- ✅ `prompt_change_log` table
- ✅ `prompt_metrics_snapshots` table
- ✅ Adds versioning columns to `generated_queries`
- ✅ Adds versioning columns to `collector_results`

### Verify Migration Worked

Run this in Supabase SQL Editor:

```sql
-- Should return 4 tables
SELECT table_name 
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'prompt_configurations',
    'prompt_configuration_snapshots',
    'prompt_change_log',
    'prompt_metrics_snapshots'
  );
```

## Step 2: Start Backend Server

```bash
cd /Users/avayasharma/evidently/backend
npm run dev
```

Should see:
```
🚀 Backend server running on port 3001
```

## Step 3: Get Your Authentication

1. Login to your app at `http://localhost:5173`
2. Open **Browser DevTools** (F12)
3. Go to **Application** → **Local Storage** → `http://localhost:5173`
4. Copy the value of your auth token (usually stored as `auth_token` or in cookies)

## Step 4: Set Environment Variables

```bash
# In a new terminal window
export API_URL="http://localhost:3001"
export TOKEN="paste-your-token-here"  # From step 3
export BRAND_ID="your-brand-id"       # Get from your database
```

### How to Get Your Brand ID

Run in Supabase:
```sql
SELECT id, name FROM brands LIMIT 5;
```

Copy the `id` of your test brand.

## Step 5: Run Quick Test

```bash
cd /Users/avayasharma/evidently

# Test if backend is responding
curl -X GET \
  "http://localhost:3001/api/brands/$BRAND_ID/prompts/manage" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected:** JSON response with `"success": true`

## Step 6: Run Full Test Suite

```bash
./test-prompt-apis.sh
```

This will test:
1. ✅ Get active prompts
2. ✅ Get version history
3. ✅ Add a test prompt
4. ✅ Calculate impact
5. ✅ Create initial version

## Common Scenarios

### Scenario A: Fresh Start (No Versions Yet)

```bash
# 1. Create initial version from existing prompts
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {"added": [], "removed": [], "edited": []},
    "changeSummary": "Initial setup"
  }'

# Should return: {"success": true, "data": {"newVersion": 1, ...}}
```

### Scenario B: Add New Prompts

```bash
# 2. Add a new prompt
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What are your security certifications?",
    "topic": "Security"
  }'

# 3. Apply changes (creates version 2)
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "added": [
        {"text": "What are your security certifications?", "topic": "Security"}
      ],
      "removed": [],
      "edited": []
    },
    "changeSummary": "Added security prompt"
  }'
```

### Scenario C: Revert to Previous Version

```bash
# 4. Revert to version 1 (creates version 3 with v1's config)
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions/1/revert" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Testing revert"}'

# Should return: {"success": true, "data": {"newVersion": 3, ...}}
```

### Scenario D: Compare Two Versions

```bash
# 5. Compare version 1 vs version 2
curl -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions/compare?version1=1&version2=2" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

## Verify Everything Works

### Database Checks

Run in Supabase SQL Editor:

```sql
-- View all versions for your brand
SELECT 
  version,
  is_active,
  change_type,
  change_summary,
  created_at,
  metrics_snapshot
FROM prompt_configurations
WHERE brand_id = 'your-brand-id'
ORDER BY version DESC;

-- Count prompts in each version
SELECT 
  pc.version,
  COUNT(pcs.id) as prompt_count
FROM prompt_configurations pc
LEFT JOIN prompt_configuration_snapshots pcs ON pcs.configuration_id = pc.id
WHERE pc.brand_id = 'your-brand-id'
GROUP BY pc.version
ORDER BY pc.version DESC;

-- View change log
SELECT 
  pc.version,
  pcl.change_type,
  pcl.prompt_text,
  pcl.topic,
  pcl.changed_at
FROM prompt_change_log pcl
JOIN prompt_configurations pc ON pc.id = pcl.configuration_id
WHERE pc.brand_id = 'your-brand-id'
ORDER BY pcl.changed_at DESC
LIMIT 10;
```

## What Success Looks Like

### ✅ API Response (Get Prompts)
```json
{
  "success": true,
  "data": {
    "brandId": "...",
    "brandName": "Your Brand",
    "currentVersion": 1,
    "topics": [
      {
        "id": "...",
        "name": "Product Features",
        "promptCount": 15,
        "prompts": [...]
      }
    ],
    "summary": {
      "totalPrompts": 79,
      "totalTopics": 10,
      "coverage": 94.0,
      "avgVisibility": 72.4,
      "avgSentiment": 4.2
    }
  }
}
```

### ✅ Database State
```
prompt_configurations:
version | is_active | change_type  | change_summary
--------+-----------+--------------+------------------
3       | true      | version_revert| Reverted to v1
2       | false     | prompt_added | Added security prompt
1       | false     | bulk_update  | Initial setup
```

## Troubleshooting

### ❌ "Unauthorized" or "Invalid token"
**Fix:** Get a fresh token from the browser after logging in

### ❌ "Brand not found"
**Fix:** Verify your BRAND_ID with:
```sql
SELECT id, name FROM brands WHERE customer_id = 'your-customer-id';
```

### ❌ "Table does not exist"
**Fix:** Run the migration SQL in Supabase

### ❌ "Cannot read properties of null"
**Fix:** Make sure you have data in `generated_queries` table:
```sql
SELECT COUNT(*) FROM generated_queries WHERE brand_id = 'your-brand-id';
```

### ❌ "Failed to load prompts"
**Fix:** Check backend logs:
```bash
# In backend terminal
# Look for error messages
```

## Next Steps

Once backend is working:

1. ✅ **Backend APIs tested** ← You are here
2. ⏳ **Connect frontend** to real APIs (next phase)
3. ⏳ **Remove mock data** from `ManagePrompts.tsx`
4. ⏳ **Update frontend** to use new API endpoints
5. ⏳ **Integrate with onboarding** flow
6. ⏳ **Test end-to-end** in UI

---

## Files Reference

- **Migration:** `supabase/migrations/20251118000000_create_prompt_versioning_tables.sql`
- **Rollback:** `supabase/migrations/20251118000001_rollback_prompt_versioning.sql`
- **Backend Services:** `backend/src/services/prompt-management/*`
- **API Routes:** `backend/src/routes/prompt-management.routes.ts`
- **Full Testing Guide:** `TEST_BACKEND_APIS.md`
- **Database Verification:** `test-backend-setup.sql`
- **Automated Tests:** `test-prompt-apis.sh`
- **Implementation Plan:** `MANAGE_PROMPTS_REVISED_APPROACH.md`
- **Status Document:** `IMPLEMENTATION_SUMMARY.md`

## Questions?

Check these docs:
- `IMPLEMENTATION_SUMMARY.md` - Complete overview
- `TEST_BACKEND_APIS.md` - Detailed API testing
- `backend/src/services/prompt-management/README.md` - Developer docs

---

**Ready to proceed?** Start with Step 1 above! 🚀

