# GA4 Test Connection Debugging Guide

## Issue: "Fails to fetch" Error

If you're getting "fails to fetch" when testing the GA4 connection, follow these steps:

## Step 1: Check Browser Console

Open browser DevTools (F12) and check the Console tab. You should see:
- The URL being called
- The VITE_API_URL value
- Any network errors

## Step 2: Verify Backend is Running

```bash
# Check if backend is running
curl http://localhost:3000/health

# Should return: {"success":true,"message":"AnswerIntel Backend is healthy",...}
```

## Step 3: Check VITE_API_URL

In your `.env` file (frontend root), verify:
```bash
VITE_API_URL=http://localhost:3000/api
# OR
VITE_API_URL=http://localhost:3000
```

**Important**: After changing `.env`, restart your frontend dev server!

## Step 4: Test Endpoint Directly

Use curl or Postman to test the endpoint:

```bash
# Replace YOUR_BRAND_ID and YOUR_CUSTOMER_ID
curl -X POST "http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/test-connection?customer_id=YOUR_CUSTOMER_ID" \
  -H "Content-Type: application/json"
```

## Step 5: Check Backend Logs

When you click "Test Connection", you should see in backend console:
```
📝 POST /api/brands/:brandId/analytics/test-connection - Route hit
   Brand ID: YOUR_BRAND_ID
   Query: { customer_id: 'YOUR_CUSTOMER_ID' }
```

If you don't see this, the request isn't reaching the backend.

## Step 6: Verify Credentials are Saved

Before testing, make sure credentials are saved:
1. Enter Property ID: `516904207`
2. Paste your JSON
3. Click "Save Configuration"
4. Wait for success message
5. Then click "Test Connection"

## Step 7: Check CORS

If you see CORS errors in console:
- Backend CORS is configured in `backend/src/app.ts`
- Make sure your frontend URL is in the allowed origins list

## Step 8: Network Tab Inspection

1. Open DevTools → Network tab
2. Click "Test Connection"
3. Look for the request to `/api/brands/.../test-connection`
4. Check:
   - Status code (should be 200)
   - Response body
   - Request URL (should match expected pattern)

## Common Issues

### Issue: "Failed to fetch" immediately
**Cause**: Backend not running or wrong URL
**Fix**: 
- Start backend: `cd backend && npm run dev`
- Check VITE_API_URL in `.env`

### Issue: 404 Not Found
**Cause**: Route not registered or wrong path
**Fix**: 
- Check backend logs for route registration
- Verify route is in `backend/src/routes/analytics.routes.ts`
- Restart backend after changes

### Issue: 500 Internal Server Error
**Cause**: GA4 API error or credential issue
**Fix**:
- Check backend logs for detailed error
- Verify service account has access to property
- Check credentials are saved correctly

### Issue: CORS Error
**Cause**: Frontend origin not allowed
**Fix**:
- Add your frontend URL to CORS config in `backend/src/app.ts`
- Restart backend

## Quick Test Script

You can also test using the Python script we created:

```bash
python backend/scripts/test-ga4-realtime.py
```

If this works but the frontend doesn't, it's likely a:
- URL/network issue
- CORS issue
- Frontend configuration issue

## Still Not Working?

1. Check browser console for exact error message
2. Check backend console for route hits and errors
3. Verify both frontend and backend are running
4. Try accessing the endpoint directly with curl/Postman
5. Check network tab for the actual request/response

