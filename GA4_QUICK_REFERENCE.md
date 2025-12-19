# GA4 Analytics - Quick Reference Card

## 🎯 Access the Page

| Method | URL |
|--------|-----|
| **Direct** | `http://localhost:5173/analytics` |
| **Via Settings** | Settings → Click "Google Analytics 4" card |

---

## 📦 Current Setup

✅ **Storage:** File-based (JSON)  
✅ **Auth:** None (simple API)  
✅ **Status:** Ready to use  

**Files:**
- `backend/src/data/ga4-credentials.json`
- `backend/src/data/ga4-cache.json`

---

## 🔄 Switch to Database (Optional)

```bash
# 1. Run migration
supabase migration up

# 2. Edit: backend/src/routes/analytics.routes.ts
# Change line 2:
# FROM: import { ga4AnalyticsService } from '../services/ga4-analytics.service';
# TO:   import { ga4AnalyticsService } from '../services/ga4-analytics-supabase.service';

# 3. Restart backend
cd backend && npm run dev
```

---

## 🔗 How It Connects to Your Brand

```
Brand Record in Database
  ↓
  id: "brand-123"
  customer_id: "customer-456"
  ↓
GA4 Credentials Linked By:
  brand_id: "brand-123"
  customer_id: "customer-456"
  property_id: "123456789"
  service_account_key: {...}
```

**One GA4 config per brand** ✅

---

## 📡 API Endpoints (No Auth Required)

```bash
# Save credentials
POST /api/brands/:brandId/analytics/credentials
Body: { customer_id, property_id, service_account_key }

# Get reports
GET /api/brands/:brandId/analytics/reports?customer_id=X&days=7

# Get top events
GET /api/brands/:brandId/analytics/top-events?customer_id=X&days=7

# Get traffic sources
GET /api/brands/:brandId/analytics/traffic-sources?customer_id=X&days=7

# Check config status
GET /api/brands/:brandId/analytics/credentials?customer_id=X

# Delete config
DELETE /api/brands/:brandId/analytics/credentials?customer_id=X
```

---

## 🔑 "API Key" = Service Account JSON

Your external "API key" = **Google Cloud Service Account JSON**

**Generated at:** Google Cloud Console  
**Format:** JSON with `private_key`, `client_email`, etc.  
**Stored as:** Part of GA4 credentials record  
**Used for:** Authenticating with GA4 Data API  

---

## 🚀 5-Minute Setup

```bash
# 1. Start servers
cd backend && npm run dev
cd .. && npm run dev

# 2. Open browser
http://localhost:5173/analytics

# 3. If not configured, you'll see setup form
# 4. Get GA4 credentials (see GA4_SETUP_GUIDE.md)
# 5. Paste Property ID and Service Account JSON
# 6. Click "Save Configuration"
# 7. Click "Test Connection"
# 8. View your analytics! 📊
```

---

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Page not loading | Check backend running on port 3000 |
| "No brands found" | Complete onboarding or create test brand |
| "GA4 not configured" | Normal! Follow setup steps |
| Credentials not saving | Check file permissions or database tables |
| Charts show no data | Wait 24-48hrs after GA4 setup, verify tracking |

---

## 📚 Full Documentation

| Guide | Purpose |
|-------|---------|
| `GA4_SETUP_GUIDE.md` | **⭐ Start here** - Complete setup walkthrough |
| `GA4_ACCESS_AND_DATABASE_SETUP.md` | Database migration & access details |
| `GA4_IMPLEMENTATION_SUMMARY.md` | Technical implementation details |
| `GA4_AUTH_REMOVAL_SUMMARY.md` | How auth was removed |

---

## ✅ What You Have Now

✅ GA4 analytics page at `/analytics`  
✅ Setup form for credentials  
✅ Dashboard with 3 chart types  
✅ 5-minute cache (reduces API calls)  
✅ No authentication required  
✅ File storage (easy to migrate to database)  
✅ One config per brand  
✅ API-ready for external integrations  

**You're ready to go!** 🎉

