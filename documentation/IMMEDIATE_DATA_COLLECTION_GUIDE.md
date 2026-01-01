# Immediate Data Collection & Historical Trends Guide

## Overview

You can now perform data collection immediately (without creating a schedule) and view historical trends for any brand.

## Quick Start

### 1. Access the Admin Page

Navigate to: `/admin/scheduled-jobs`

### 2. Select a Brand

Use the brand selector dropdown at the top of the page to choose which brand you want to work with.

### 3. Immediate Actions

Once a brand is selected, you'll see three quick action cards:

#### **Collect Data Now**
- **What it does:** Immediately starts data collection using all active queries from onboarding
- **When to use:** When you want fresh data right away, or to test data collection
- **How it works:**
  1. Fetches all active queries for the selected brand
  2. Executes them across all configured collectors
  3. Stores results in the database
  4. Returns metrics (queries executed, successful/failed)

#### **Score Now**
- **What it does:** Immediately processes and scores all unprocessed collector results
- **When to use:** After collecting data, or to re-score existing data
- **How it works:**
  1. Extracts positions from collector results
  2. Scores sentiments for brand and competitors
  3. Extracts citations
  4. Returns metrics (positions processed, sentiments processed, etc.)

#### **View Historical Trends**
- **What it does:** Opens the Search Visibility page showing trends over time
- **When to use:** To see how your brand's visibility, share, and sentiment have changed
- **Features:**
  - Time-based charts (weekly, monthly, YTD)
  - Visibility trends
  - Share of search trends
  - Sentiment trends
  - Competitor comparisons

## Step-by-Step: Collect Data Now

1. **Go to Admin Page:** `/admin/scheduled-jobs`
2. **Select Brand:** Choose the brand from the dropdown
3. **Click "Start Collection":** In the "Collect Data Now" card
4. **Confirm:** Click OK in the confirmation dialog
5. **Wait:** The collection runs in the background
6. **Check Results:** 
   - See the alert with number of queries executed
   - Check "Recent Job Runs" section at the bottom
   - Click "History" on any scheduled job to see detailed results

## Step-by-Step: View Historical Trends

### Option 1: From Admin Page
1. Select a brand in the admin page
2. Click "View Trends →" in the "View Historical Trends" card
3. The Search Visibility page opens in a new tab

### Option 2: Direct Navigation
1. Go to `/search-visibility`
2. Select your brand from the brand selector
3. Choose a timeframe (weekly, monthly, YTD)
4. View charts and metrics

### What You'll See

- **Visibility Chart:** Shows brand visibility over time
- **Share of Search:** Percentage of queries where your brand appears
- **Sentiment Trends:** How sentiment changes over time
- **Competitor Comparisons:** See how you compare to competitors
- **Top Topics:** Most mentioned topics over time

## API Endpoints (For Programmatic Access)

### Immediate Data Collection

```bash
POST /api/admin/brands/:brandId/collect-data-now
Content-Type: application/json

{
  "customer_id": "your-customer-uuid",
  "collectors": ["chatgpt", "google_aio", "perplexity"], // optional
  "locale": "en-US", // optional
  "country": "US" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "queriesExecuted": 25,
    "collectorResults": 200,
    "successfulExecutions": 195,
    "failedExecutions": 5,
    "errors": []
  }
}
```

### Immediate Scoring

```bash
POST /api/admin/brands/:brandId/score-now
Content-Type: application/json

{
  "customer_id": "your-customer-uuid",
  "since": "2025-01-01T00:00:00Z", // optional - only score data after this time
  "positionLimit": 50, // optional
  "sentimentLimit": 50, // optional
  "parallel": false // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "positionsProcessed": 150,
    "sentimentsProcessed": 200,
    "competitorSentimentsProcessed": 75,
    "citationsProcessed": 50,
    "errors": []
  }
}
```

## Workflow Examples

### Example 1: Collect and View Trends for a New Brand

1. **Collect Data:**
   - Select brand → Click "Start Collection"
   - Wait for completion (check Recent Job Runs)

2. **Score the Data:**
   - Click "Start Scoring"
   - Wait for completion

3. **View Trends:**
   - Click "View Trends →"
   - Select timeframe (weekly/monthly)
   - Analyze the charts

### Example 2: Quick Data Refresh

1. **Collect Fresh Data:**
   - Select brand → Click "Start Collection"
   - Wait 5-10 minutes for completion

2. **Score Immediately:**
   - Click "Start Scoring"
   - This processes the newly collected data

3. **Check Trends:**
   - View updated trends to see the latest data

### Example 3: Historical Analysis

1. **Navigate to Trends:**
   - Go to `/search-visibility`
   - Select your brand
   - Choose "Monthly" or "YTD" timeframe

2. **Analyze:**
   - Look for patterns in visibility
   - Check sentiment trends
   - Compare with competitors

## Tips

1. **Data Collection Timing:**
   - Data collection can take 5-30 minutes depending on number of queries
   - Check "Recent Job Runs" to see progress
   - Failed executions are logged with error messages

2. **Scoring Timing:**
   - Scoring is usually faster (1-5 minutes)
   - Only processes unprocessed data by default
   - Use `since` parameter to re-score specific time ranges

3. **Viewing Trends:**
   - Weekly view shows last 7 days
   - Monthly view shows last 30 days
   - YTD shows year-to-date data
   - Charts update automatically when new data is available

4. **Best Practices:**
   - Collect data first, then score
   - Wait for collection to complete before scoring
   - Check job run history for any errors
   - Use scheduled jobs for regular updates

## Troubleshooting

### "No active queries found"
- Make sure the brand completed onboarding
- Check that queries are marked as `is_active = true` in the database
- Verify brand_id and customer_id are correct

### Data Collection Takes Too Long
- Normal for large numbers of queries
- Check "Recent Job Runs" for progress
- Some collectors (like BrightData) can take 5+ minutes per query

### Trends Not Showing
- Make sure data collection completed successfully
- Verify scoring has been run
- Check that data exists for the selected timeframe
- Try a different timeframe (weekly vs monthly)

### Errors in Job Runs
- Click "History" on any job to see detailed error messages
- Check console logs for more details
- Verify API keys are configured for collectors
- Check database connectivity

## Next Steps

After collecting data and viewing trends:

1. **Set Up Scheduled Jobs:** Create recurring jobs for automatic updates
2. **Analyze Patterns:** Use trends to identify opportunities
3. **Optimize Queries:** Adjust onboarding queries based on results
4. **Monitor Regularly:** Check trends weekly/monthly to track progress

