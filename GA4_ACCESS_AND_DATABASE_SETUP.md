# GA4 Analytics - Access & Database Setup Guide

## 🎯 Quick Answer

### Where to See the GA4 Page?

**Option 1: Through Settings (Recommended)**
```
1. Go to Settings page: http://localhost:5173/settings
2. Click "Google Analytics 4" card
3. Redirects to: http://localhost:5173/analytics
```

**Option 2: Direct URL**
```
http://localhost:5173/analytics
```

---

## 🗄️ Data Storage: File vs Database

### Current Implementation: FILE STORAGE ✅

**Location:**
- `backend/src/data/ga4-credentials.json`
- `backend/src/data/ga4-cache.json`

**Using:**
- `backend/src/services/ga4-analytics.service.ts`

**Status:** ✅ **Working & Ready to Use**

---

## 🔄 Switch to Database Storage (Optional)

If you want to store GA4 credentials in your **Supabase database** instead of JSON files:

### Step 1: Run the Migration

```bash
# Option A: Using Supabase CLI
supabase migration up

# Option B: Manually in Supabase Studio
# 1. Go to SQL Editor in Supabase Dashboard
# 2. Copy contents of: supabase/migrations/20251218000000_create_ga4_tables.sql
# 3. Run the SQL
```

This creates 3 tables:
- `brand_ga4_credentials` - Stores credentials per brand
- `ga4_report_cache` - Caches API responses (5-min TTL)
- `ga4_audit_log` - Tracks who configured/accessed GA4

### Step 2: Update Service Import

Edit: `backend/src/routes/analytics.routes.ts`

**Change line 2 from:**
```typescript
import { ga4AnalyticsService } from '../services/ga4-analytics.service';
```

**To:**
```typescript
import { ga4AnalyticsService } from '../services/ga4-analytics-supabase.service';
```

### Step 3: Restart Backend

```bash
cd backend
npm run dev
```

That's it! Now using database storage 🎉

---

## 📊 Comparison: File vs Database

| Feature | File Storage | Database Storage |
|---------|-------------|------------------|
| **Setup** | ✅ Ready (no migration) | ⚠️ Requires migration |
| **Performance** | ⚡ Fast (direct file I/O) | ⚡ Fast (indexed queries) |
| **Multi-Instance** | ❌ No (file locking issues) | ✅ Yes (shared database) |
| **Backup** | ✅ Easy (copy files) | ✅ Supabase backups |
| **Audit Trail** | ❌ None | ✅ Full audit log |
| **Encryption** | ❌ Plain text | ⚠️ Encrypt at app level |
| **Scalability** | ⚠️ Limited | ✅ Unlimited |
| **Inspect/Debug** | ✅ Easy (JSON editor) | ✅ SQL queries |
| **Security** | ⚠️ File permissions | ✅ RLS policies |

---

## 🔗 Connecting GA4 to Brand

### Current Approach (Both Versions)

GA4 credentials are **linked to brand** via:
- `brand_id` - UUID of the brand
- `customer_id` - UUID of the customer

```json
{
  "brand_id": "123e4567-e89b-12d3-a456-426614174000",
  "customer_id": "789e0123-e45b-67c8-d901-234567890abc",
  "property_id": "123456789",
  "service_account_key": {...}
}
```

### How It Works

1. **User configures GA4** for their brand
2. System stores credentials linked to `brand_id`
3. When viewing analytics, system:
   - Gets `brand_id` from URL/session
   - Looks up credentials by `brand_id`
   - Queries GA4 API with those credentials

### Example Flow

```
User → /analytics
    ↓
Frontend fetches brands (GET /api/brands)
    ↓
Gets first brand: { id: "brand-123", customer_id: "customer-456" }
    ↓
Checks if GA4 configured:
  GET /api/brands/brand-123/analytics/credentials?customer_id=customer-456
    ↓
If configured: Shows dashboard
If not: Shows setup form
    ↓
User configures GA4:
  POST /api/brands/brand-123/analytics/credentials
  Body: { customer_id, property_id, service_account_key }
    ↓
Credentials saved (linked to brand-123)
    ↓
Dashboard loads data using those credentials
```

---

## 🔑 About "API Key Generated Elsewhere"

Based on your mention of "API key generated elsewhere," here's how it fits:

### GA4 Service Account = Your "API Key"

The **service account JSON** from Google Cloud is effectively your API key for GA4.

**Where it's generated:**
- Google Cloud Console (external to your app)
- Downloaded as JSON file
- Contains: `private_key`, `client_email`, etc.

**How it's used:**
- User uploads/pastes it in your app
- App stores it (file or database)
- App uses it to authenticate with GA4 API

### Integration Example

If you're generating the service account elsewhere (e.g., automated provisioning):

```typescript
// Automated setup via your backend/admin tool
async function setupGA4ForBrand(brandId: string, customerId: string) {
  // 1. Your external system generates GA4 service account
  const serviceAccountKey = await yourExternalSystem.generateGA4ServiceAccount();
  
  // 2. Call your API to save it
  await fetch(`/api/brands/${brandId}/analytics/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_id: customerId,
      property_id: '123456789',
      service_account_key: serviceAccountKey
    })
  });
  
  console.log('GA4 configured for brand:', brandId);
}
```

---

## 🚀 Complete Setup Walkthrough

### 1. Start Your App

```bash
# Terminal 1: Backend
cd backend
npm install  # First time only
npm run dev

# Terminal 2: Frontend
npm install  # First time only
npm run dev
```

### 2. Access GA4 Setup

Open browser: `http://localhost:5173/analytics`

### 3. You'll See

**If NOT configured:**
```
┌─────────────────────────────────────┐
│ Google Analytics 4 Configuration   │
├─────────────────────────────────────┤
│ GA4 Property ID: [___________]      │
│                                     │
│ Service Account JSON:               │
│ [ Upload File ] or paste below      │
│ [_____________________________]     │
│ [_____________________________]     │
│                                     │
│ [ Save Configuration ]              │
└─────────────────────────────────────┘
```

**If configured:**
```
┌─────────────────────────────────────┐
│ ✅ GA4 Connected                    │
│ Property ID: 123456789              │
│ [ Test Connection ]                 │
└─────────────────────────────────────┘

📊 GA4 Analytics Dashboard
Date Range: [ Last 7 days ▼ ]

[Event Count Line Chart]
[Top Events Bar Chart]
[Traffic Sources Charts]
```

### 4. Setup GA4 Credentials

Follow: `GA4_SETUP_GUIDE.md` for detailed instructions

**Quick version:**
1. Get GA4 Property ID from Google Analytics
2. Create service account in Google Cloud
3. Download JSON key
4. Paste in your app
5. Click "Save Configuration"

### 5. View Analytics

Once configured, you'll see:
- **Event count trends** (line chart)
- **Top 10 events** (bar chart)
- **Traffic sources** (horizontal bars + table)
- Date range selector (7/30/90 days)

---

## 🔍 Verifying Database Storage

If you switched to database storage, verify it's working:

### Check Tables Exist

```sql
-- In Supabase SQL Editor
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE '%ga4%';

-- Should return:
-- brand_ga4_credentials
-- ga4_report_cache
-- ga4_audit_log
```

### Check Data After Setup

```sql
-- View saved credentials
SELECT 
  brand_id,
  customer_id,
  property_id,
  configured_at
FROM brand_ga4_credentials;

-- View cache entries
SELECT 
  brand_id,
  cache_key,
  expires_at,
  cached_at
FROM ga4_report_cache;

-- View audit trail
SELECT 
  brand_id,
  action,
  performed_by,
  created_at
FROM ga4_audit_log
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛠️ Troubleshooting

### Can't Access /analytics Page

**Check:**
1. Backend running? (http://localhost:3000/health should work)
2. Frontend running? (http://localhost:5173 should load)
3. Route registered? Check `src/App.tsx` for `/analytics` route

### "No brands found"

**Fix:**
1. Complete onboarding first (create a brand)
2. Or manually insert a brand in Supabase:
```sql
INSERT INTO brands (id, customer_id, name, url)
VALUES (
  'test-brand-id',
  'test-customer-id',
  'Test Brand',
  'https://example.com'
);
```

### "GA4 not configured"

**This is normal!** Just means you haven't set up GA4 yet.
- Click setup button
- Follow configuration steps

### Credentials Not Saving

**File Storage:**
- Check `backend/src/data/` folder exists
- Check file write permissions
- Look at backend terminal for errors

**Database Storage:**
- Check migration ran successfully
- Check table exists: `SELECT * FROM brand_ga4_credentials;`
- Check RLS policies aren't blocking inserts

---

## 📚 Related Files

| File | Purpose |
|------|---------|
| `GA4_SETUP_GUIDE.md` | Detailed GA4 setup instructions |
| `GA4_IMPLEMENTATION_SUMMARY.md` | Original implementation details |
| `GA4_AUTH_REMOVAL_SUMMARY.md` | How token auth was removed |
| `supabase/migrations/20251218000000_create_ga4_tables.sql` | Database migration |
| `backend/src/services/ga4-analytics.service.ts` | File storage version |
| `backend/src/services/ga4-analytics-supabase.service.ts` | Database version |

---

## 🎯 Summary

✅ **Access page at:** `/analytics` or through Settings  
✅ **Currently using:** File storage (works out of the box)  
✅ **To switch to database:** Run migration + change import  
✅ **Credentials linked to:** `brand_id` in your database  
✅ **Service account:** Your "API key" from Google Cloud  
✅ **No auth required:** Simple API calls with `customer_id` parameter  

You're all set! 🎉

