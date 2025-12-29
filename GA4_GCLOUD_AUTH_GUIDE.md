# GA4 Analytics - gcloud Application Default Credentials Guide

## Overview

The GA4 Analytics service now supports multiple authentication methods:
1. **Service Account JSON** (original method) - Recommended for production
2. **gcloud Application Default Credentials** - Good for development/local testing
3. **Bearer Token** - For custom authentication flows

## Using gcloud Application Default Credentials

This method uses your local gcloud CLI credentials instead of a service account JSON file.

### Step 1: Install and Setup gcloud CLI

```bash
# Install gcloud CLI if not already installed
# See: https://cloud.google.com/sdk/docs/install

# Login to your Google account
gcloud auth login

# Set up application default credentials
gcloud auth application-default login

# Set your project
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Configure GA4 in the Application

Instead of uploading a service account JSON, you can now configure GA4 using gcloud auth:

#### Via API:

```bash
curl -X POST http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "YOUR_CUSTOMER_ID",
    "property_id": "123456789",
    "auth_type": "gcloud",
    "project_id": "YOUR_PROJECT_ID"
  }'
```

#### Via Frontend:

The frontend will be updated to support this method. For now, use the API directly.

### Step 3: Using Bearer Token (Alternative)

If you want to use a bearer token directly (like in your curl example):

```bash
# Get access token
ACCESS_TOKEN=$(gcloud auth application-default print-access-token)
PROJECT_ID="your-project-id"
PROPERTY_ID="123456789"

# Configure with bearer token
curl -X POST http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "YOUR_CUSTOMER_ID",
    "property_id": "123456789",
    "auth_type": "bearer_token",
    "bearer_token": "'"$ACCESS_TOKEN"'"
  }'
```

**Note:** Bearer tokens expire. You'll need to refresh them periodically or use service account auth for long-term use.

## Direct REST API Calls (Your curl Example)

If you prefer to make direct REST API calls to Google Analytics Data API:

```bash
PROJECT_ID="your-project-id"
PROPERTY_ID="123456789"
ACCESS_TOKEN=$(gcloud auth application-default print-access-token)

curl -X POST \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "dateRanges": [
      {
        "startDate": "2025-01-01",
        "endDate": "2025-02-01"
      }
    ],
    "dimensions": [
      {
        "name": "country"
      }
    ],
    "metrics": [
      {
        "name": "activeUsers"
      }
    ]
  }' \
  "https://analyticsdata.googleapis.com/v1beta/properties/$PROPERTY_ID:runReport"
```

**However**, using the built-in service methods is recommended because:
- ✅ Automatic caching (5-minute TTL)
- ✅ Error handling
- ✅ Response transformation
- ✅ Integration with your application

## Authentication Methods Comparison

| Method | Best For | Pros | Cons |
|--------|----------|------|------|
| **Service Account JSON** | Production | ✅ No expiration<br>✅ Secure<br>✅ Works everywhere | ❌ Requires JSON file management |
| **gcloud ADC** | Development/Local | ✅ Easy setup<br>✅ No file management | ❌ Requires gcloud CLI<br>❌ Tied to user account |
| **Bearer Token** | Temporary/Testing | ✅ Quick setup | ❌ Tokens expire<br>❌ Manual refresh needed |

## Troubleshooting

### gcloud ADC Not Working

1. **Check if credentials are set:**
   ```bash
   gcloud auth application-default print-access-token
   ```
   Should return a token, not an error.

2. **Re-authenticate if needed:**
   ```bash
   gcloud auth application-default login
   ```

3. **Verify project is set:**
   ```bash
   gcloud config get-value project
   ```

4. **Check environment variable (optional):**
   ```bash
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```
   If set, it will use that file instead of ADC.

### API Errors

- **403 Forbidden**: Make sure your Google account has access to the GA4 property
- **401 Unauthorized**: Re-run `gcloud auth application-default login`
- **404 Not Found**: Verify the property_id is correct

## Migration from Service Account to gcloud ADC

To switch from service account to gcloud auth:

1. Delete existing credentials:
   ```bash
   DELETE /api/brands/{brandId}/analytics/credentials?customer_id={customerId}
   ```

2. Set up gcloud auth:
   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. Save new credentials with `auth_type: "gcloud"`

## Code Implementation

The service automatically detects the auth type and uses the appropriate method:

```typescript
// Service account (default)
const client = new BetaAnalyticsDataClient({
  credentials: serviceAccountKey
});

// gcloud ADC (when auth_type is 'gcloud')
const client = new BetaAnalyticsDataClient({
  // No credentials provided - uses application default credentials
});

// Bearer token (when auth_type is 'bearer_token')
const client = new BetaAnalyticsDataClient({
  credentials: {
    getAccessToken: async () => ({ token: bearerToken })
  }
});
```

## Next Steps

1. ✅ Test with gcloud ADC locally
2. ⏳ Update frontend UI to support auth type selection
3. ⏳ Add automatic token refresh for bearer token auth
4. ⏳ Document migration process





