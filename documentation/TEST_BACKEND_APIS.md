# Testing Prompt Management Backend APIs

## Prerequisites

1. **Ensure migrations ran successfully**
   - Run `../test-backend-setup.sql` in Supabase SQL Editor
   - Should see all 4 new tables created
   - Should see new columns in `collector_results` and `generated_queries`

2. **Backend server is running**
   ```bash
   cd /Users/avayasharma/evidently/backend
   npm run dev
   ```

3. **Get your authentication token**
   - Login to the app
   - Open browser DevTools → Application → Local Storage
   - Copy the JWT token from `auth_token` or similar

## Step-by-Step Testing

### 1. Set Environment Variables

```bash
# In your terminal
export API_URL="http://localhost:3001"
export TOKEN="your-jwt-token-here"  # Replace with actual token
export BRAND_ID="your-brand-id"     # Get from database or API
```

### 2. Test: Get Active Prompts (Current Mock Data)

```bash
curl -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/manage" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "brandId": "...",
    "brandName": "Your Brand",
    "currentVersion": 0,
    "topics": [
      {
        "id": "topic-id",
        "name": "Product Features",
        "promptCount": 8,
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

### 3. Test: Create Initial Version (Version 1)

**Important:** This should normally be called during onboarding, but we can test it manually:

```bash
# First, let's create Version 1 from existing prompts
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "added": [],
      "removed": [],
      "edited": []
    },
    "changeSummary": "Initial setup (manual test)"
  }' \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "newVersion": 1,
    "configurationId": "uuid-here"
  },
  "message": "Changes applied successfully"
}
```

### 4. Test: Get Version History

```bash
curl -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "currentVersion": 1,
    "versions": [
      {
        "id": "config-uuid",
        "version": 1,
        "isActive": true,
        "changeType": "bulk_update",
        "changeSummary": "Initial setup (manual test)",
        "createdAt": "2025-11-18T...",
        "createdBy": "user-id",
        "metrics": {
          "totalPrompts": 79,
          "totalTopics": 10,
          "coverage": 94.0,
          "analysesCount": 0
        }
      }
    ]
  }
}
```

### 5. Test: Add a New Prompt

```bash
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "What are the main security features of your platform?",
    "topic": "Security"
  }' \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "promptId": "new-prompt-uuid"
  },
  "message": "Prompt added successfully"
}
```

### 6. Test: Calculate Impact of Changes

```bash
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/calculate-impact" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "added": [
        {
          "text": "How do you handle data privacy?",
          "topic": "Security"
        }
      ],
      "removed": [],
      "edited": []
    }
  }' \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "estimatedImpact": {
      "coverage": {
        "current": 94.0,
        "projected": 95.5,
        "change": 1.5,
        "changePercent": 1.6
      },
      "visibilityScore": {
        "current": 72.4,
        "projected": null,
        "change": null,
        "changePercent": null
      },
      "topicCoverage": {
        "increased": ["Security"],
        "decreased": [],
        "unchanged": ["Product Features", "Pricing", ...]
      },
      "affectedAnalyses": 0,
      "warnings": [
        "New prompts will require data collection before metrics are available"
      ]
    },
    "calculatedAt": "2025-11-18T..."
  }
}
```

### 7. Test: Apply Batch Changes (Create Version 2)

```bash
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/batch" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": {
      "added": [
        {
          "text": "How do you handle data privacy?",
          "topic": "Security"
        },
        {
          "text": "What compliance certifications do you have?",
          "topic": "Security"
        }
      ],
      "removed": [],
      "edited": []
    },
    "changeSummary": "Added 2 security prompts"
  }' \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "newVersion": 2,
    "configurationId": "new-config-uuid"
  },
  "message": "Changes applied successfully"
}
```

### 8. Test: Get Specific Version Details

```bash
curl -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions/1" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "config-uuid",
    "brandId": "...",
    "customerId": "...",
    "version": 1,
    "isActive": false,
    "changeType": "bulk_update",
    "changeSummary": "Initial setup (manual test)",
    "createdAt": "...",
    "snapshots": [
      {
        "id": "snapshot-uuid",
        "configurationId": "config-uuid",
        "queryId": "query-uuid",
        "topic": "Product Features",
        "queryText": "What are the key features?",
        "isIncluded": true,
        "sortOrder": 0,
        "createdAt": "..."
      }
      // ... more snapshots
    ]
  }
}
```

### 9. Test: Compare Two Versions

```bash
curl -X GET \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions/compare?version1=1&version2=2" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "version1": 1,
    "version2": 2,
    "changes": {
      "added": [
        {
          "id": "uuid",
          "text": "How do you handle data privacy?",
          "topic": "Security"
        },
        {
          "id": "uuid",
          "text": "What compliance certifications do you have?",
          "topic": "Security"
        }
      ],
      "removed": [],
      "edited": [],
      "topicChanges": {
        "added": [],
        "removed": []
      }
    },
    "metricsComparison": {
      "prompts": {
        "v1": 79,
        "v2": 81,
        "diff": 2
      },
      "topics": {
        "v1": 10,
        "v2": 10,
        "diff": 0
      },
      "coverage": {
        "v1": 94.0,
        "v2": 95.5,
        "diff": 1.5
      }
    }
  }
}
```

### 10. Test: Revert to Version 1

```bash
curl -X POST \
  "$API_URL/api/brands/$BRAND_ID/prompts/versions/1/revert" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Testing revert functionality"
  }' \
  | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "newVersion": 3,
    "configurationId": "new-config-uuid",
    "revertedTo": 1
  },
  "message": "Successfully reverted to version 1"
}
```

## Verification Steps

### Check Database State

Run in Supabase SQL Editor:

```sql
-- View all versions
SELECT 
  version,
  is_active,
  change_type,
  change_summary,
  created_at
FROM prompt_configurations
WHERE brand_id = 'your-brand-id'
ORDER BY version DESC;

-- View metrics for each version
SELECT 
  pc.version,
  pms.total_prompts,
  pms.total_topics,
  pms.coverage_score,
  pms.analyses_count
FROM prompt_configurations pc
LEFT JOIN prompt_metrics_snapshots pms ON pms.configuration_id = pc.id
WHERE pc.brand_id = 'your-brand-id'
ORDER BY pc.version DESC;

-- View change log
SELECT 
  pc.version,
  pcl.change_type,
  pcl.old_value,
  pcl.new_value,
  pcl.changed_at
FROM prompt_change_log pcl
JOIN prompt_configurations pc ON pc.id = pcl.configuration_id
WHERE pc.brand_id = 'your-brand-id'
ORDER BY pcl.changed_at DESC
LIMIT 20;

-- View active version
SELECT 
  version,
  change_summary,
  created_at,
  (
    SELECT COUNT(*) 
    FROM prompt_configuration_snapshots 
    WHERE configuration_id = pc.id
  ) as snapshot_count
FROM prompt_configurations pc
WHERE brand_id = 'your-brand-id'
  AND is_active = true;
```

## Common Issues & Solutions

### Issue 1: "Unauthorized" Error
**Solution:** Make sure your JWT token is valid. Get a fresh one by logging in.

### Issue 2: "Brand not found"
**Solution:** Replace `$BRAND_ID` with your actual brand ID from the database.

### Issue 3: "Failed to load prompts"
**Solution:** Check if you have `generated_queries` data for your brand.

### Issue 4: Tables not found
**Solution:** Run the forward migration (`20251118000000_create_prompt_versioning_tables.sql`)

### Issue 5: Backend not responding
**Solution:** 
```bash
cd backend
npm run dev
# Check logs for errors
```

## What Success Looks Like

✅ All API endpoints return `"success": true`
✅ Version numbers increment correctly (1, 2, 3...)
✅ Only one version is marked `"isActive": true`
✅ Snapshots are created for each version
✅ Metrics are calculated and stored
✅ Change log tracks all modifications
✅ Revert creates new version (doesn't reactivate old one)

## Next Steps

Once backend testing is complete:
1. ✅ Backend works with real data
2. ⏳ Connect frontend to backend APIs
3. ⏳ Remove mock data from frontend
4. ⏳ Test end-to-end workflow in UI
5. ⏳ Integrate with onboarding
6. ⏳ Update data collection to store version info

---

**Note:** The frontend page you're seeing still uses mock data from `src/data/mockPromptsData.ts`. After verifying the backend works, we'll connect the frontend to use these real APIs!

