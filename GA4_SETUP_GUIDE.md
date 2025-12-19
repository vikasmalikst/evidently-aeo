# GA4 Analytics - Complete Setup Guide

## 📍 Where to Access

### In Your Application:
- **Settings Page**: Navigate to `/settings` → Click "Google Analytics 4"
- **Direct URL**: `/analytics`

The page shows:
- **If not configured**: Setup form to add credentials
- **If configured**: Analytics dashboard with charts

---

## 🔑 Getting GA4 Credentials

### Part 1: Get Your GA4 Property ID

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **Admin** (gear icon, bottom left)
3. In the **Property** column, click **Property Settings**
4. Copy your **Property ID** (looks like: `123456789`)

### Part 2: Create Service Account in Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Enable **Google Analytics Data API**:
   - Search for "Google Analytics Data API" in the search bar
   - Click **Enable**

4. Create a Service Account:
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **+ CREATE SERVICE ACCOUNT**
   - Name: `ga4-readonly-service`
   - Description: `Read-only access to GA4 data`
   - Click **CREATE AND CONTINUE**
   - Skip role assignment (we'll add it in GA4)
   - Click **DONE**

5. Create JSON Key:
   - Click on the service account you just created
   - Go to **Keys** tab
   - Click **ADD KEY** → **Create new key**
   - Choose **JSON**
   - Click **CREATE**
   - Save the downloaded JSON file

### Part 3: Grant Access in GA4

1. Copy the **service account email** (from the JSON file or Cloud Console)
   - Looks like: `ga4-readonly-service@your-project.iam.gserviceaccount.com`

2. Go back to [Google Analytics](https://analytics.google.com/)
3. Click **Admin** (gear icon)
4. In the **Property** column, click **Property Access Management**
5. Click **+** (top right)
6. Add the service account email
7. Assign role: **Viewer**
8. Click **Add**

---

## 🚀 Setup in Your Application

### Step 1: Navigate to GA4 Setup
- Go to `/analytics` in your app
- OR Settings → Google Analytics 4

### Step 2: Enter Credentials

1. **GA4 Property ID**: Paste the property ID (e.g., `123456789`)

2. **Service Account JSON**: Either:
   - **Upload** the JSON file you downloaded
   - **Or paste** the JSON content directly

3. Click **"Save Configuration"**

### Step 3: Test Connection
- Click **"Test Connection"** button
- Should see: ✅ "Connection test successful! GA4 is working correctly."

### Step 4: View Analytics
- The page will automatically show your analytics dashboard
- Select date range: 7, 30, or 90 days
- View:
  - Event count trends
  - Top 10 events
  - Traffic sources breakdown

---

## 📊 Example API Usage

Since the API doesn't require authentication, you can call it directly:

### Example: Save Credentials (POST)
```bash
curl -X POST http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "YOUR_CUSTOMER_ID",
    "property_id": "123456789",
    "service_account_key": {
      "type": "service_account",
      "project_id": "your-project",
      "private_key_id": "...",
      "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
      "client_email": "ga4-readonly-service@your-project.iam.gserviceaccount.com",
      "client_id": "...",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": "..."
    }
  }'
```

### Example: Get Analytics Data (GET)
```bash
curl "http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/reports?customer_id=YOUR_CUSTOMER_ID&days=7"
```

---

## 🗄️ Current Data Storage

**Currently using FILE-BASED storage:**
- Credentials: `backend/src/data/ga4-credentials.json`
- Cache: `backend/src/data/ga4-cache.json`

### Data Structure:

**ga4-credentials.json:**
```json
{
  "credentials": [
    {
      "brand_id": "brand-uuid",
      "customer_id": "customer-uuid",
      "property_id": "123456789",
      "service_account_key": { ... },
      "configured_at": "2025-12-18T10:30:00Z"
    }
  ]
}
```

**ga4-cache.json:**
```json
{
  "cache": [
    {
      "brand_id": "brand-uuid",
      "cache_key": "eventCount:7d",
      "data": { ... },
      "expires_at": "2025-12-18T10:35:00Z"
    }
  ]
}
```

---

## 🔗 Connecting to Your Database

If you want to store credentials in your Supabase database instead of JSON files, here's what to change:

### Option A: Create Supabase Tables (Recommended)

1. Create migration file: `supabase/migrations/20251218_ga4_credentials.sql`

```sql
-- GA4 Credentials Table
CREATE TABLE brand_ga4_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  property_id VARCHAR(255) NOT NULL,
  service_account_key JSONB NOT NULL,
  configured_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(brand_id, customer_id)
);

-- GA4 Cache Table
CREATE TABLE ga4_report_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL,
  cache_key VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  cached_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(brand_id, cache_key)
);

-- Indexes
CREATE INDEX idx_ga4_credentials_brand ON brand_ga4_credentials(brand_id);
CREATE INDEX idx_ga4_cache_brand ON ga4_report_cache(brand_id);
CREATE INDEX idx_ga4_cache_expires ON ga4_report_cache(expires_at);
```

2. Update `backend/src/services/ga4-analytics.service.ts` to use Supabase instead of file operations

### Option B: Keep File Storage (Current Implementation)

**Pros:**
- ✅ Simple and fast
- ✅ Easy to backup (just copy files)
- ✅ No database migrations needed
- ✅ Easy to inspect/edit manually

**Cons:**
- ❌ Not suitable for multi-instance deployments
- ❌ File system access required
- ❌ No built-in encryption

---

## 🔒 Security Notes

### Current Implementation
- Credentials stored in plain JSON files
- No encryption at rest
- File system permissions control access

### Recommendations for Production
1. **Use database storage** with encrypted columns
2. **Add API key authentication** if exposing publicly
3. **Implement IP whitelisting** for API access
4. **Enable audit logging** for credential access
5. **Use environment-based secrets** for sensitive data

---

## 🧪 Testing Checklist

- [ ] Backend server running (`npm run dev`)
- [ ] Frontend running (`npm run dev`)
- [ ] Navigate to `/analytics`
- [ ] See setup form (if first time)
- [ ] Upload service account JSON
- [ ] Enter GA4 Property ID
- [ ] Click "Save Configuration"
- [ ] Click "Test Connection"
- [ ] See success message
- [ ] View analytics charts
- [ ] Try different date ranges (7/30/90 days)
- [ ] Verify data matches GA4 web interface

---

## 📸 Visual Guide

### 1. Settings Page
```
Settings
└── [Card] Google Analytics 4
    └── "Connect your GA4 property to view analytics..."
    └── Click → redirects to /analytics
```

### 2. Setup Page
```
GA4 Configuration
├── Property ID: [_____________]
├── Service Account JSON:
│   ├── [Upload File] button
│   └── [Text area for paste]
└── [Save Configuration] button
```

### 3. Dashboard Page
```
📊 GA4 Analytics Dashboard
├── Date Range: [Last 7 days ▼]
├── Event Count Over Time (Line Chart)
├── Top Events (Bar Chart)
└── Traffic Sources (Horizontal Bar + Table)
```

---

## 🆘 Troubleshooting

### "GA4 not configured for this brand"
- Make sure you saved credentials first
- Check `backend/src/data/ga4-credentials.json` exists
- Verify brand_id and customer_id match

### "Failed to fetch analytics data"
- Verify service account has "Viewer" role in GA4
- Check GA4 Data API is enabled in Google Cloud
- Verify property_id is correct
- Check backend logs for detailed error

### "Invalid service account JSON"
- Make sure the JSON is complete (no truncation)
- Verify it contains: `type`, `project_id`, `private_key`, `client_email`
- Try downloading a fresh key from Google Cloud

### Charts not showing
- Wait 24-48 hours after GA4 property creation
- Verify your site has GA4 tracking code installed
- Check GA4 web interface to confirm data is collecting

---

## 🎯 Quick Start Commands

```bash
# 1. Install dependencies
cd backend && npm install
cd .. && npm install

# 2. Start backend
cd backend && npm run dev

# 3. Start frontend (in new terminal)
npm run dev

# 4. Open browser
http://localhost:5173/analytics
```

---

## 📞 Support

- GA4 setup issues: [Google Analytics Help](https://support.google.com/analytics)
- Service account help: [Google Cloud Documentation](https://cloud.google.com/iam/docs/service-accounts)
- API issues: Check backend logs in terminal


