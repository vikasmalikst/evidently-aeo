# Job Types Explained

## Overview

There are **3 job types** available, and you can use them in different ways:

1. **`data_collection`** - Only collects data
2. **`scoring`** - Only scores existing data
3. **`data_collection_and_scoring`** - Does both automatically in sequence

## Quick Answer

### For Scheduled Jobs:
- **Use `data_collection_and_scoring`** - This runs both automatically, so you don't need to click anything manually
- The system collects data first, then automatically scores it

### For Immediate Actions (Quick Buttons):
- **Use "Collect & Score" button** - This does both in one click automatically
- OR use separate buttons if you want to control the timing

## Detailed Explanation

### 1. Data Collection Only (`data_collection`)

**What it does:**
- Fetches all active queries from onboarding
- Executes them across collectors (ChatGPT, Google, Perplexity, etc.)
- Stores results in the database

**When to use:**
- You want to collect data more frequently than scoring
- You want to collect data but score it later manually
- Testing data collection without scoring

**Manual step required:** Yes, you need to run scoring separately after collection

### 2. Scoring Only (`scoring`)

**What it does:**
- Processes existing collector results
- Extracts positions
- Scores sentiments
- Extracts citations

**When to use:**
- You already have collected data
- You want to re-score existing data
- You collected data manually and now want to score it

**Manual step required:** No, but you need data collection to have run first

### 3. Data Collection + Scoring (`data_collection_and_scoring`) ⭐ RECOMMENDED

**What it does:**
1. First: Collects data (same as `data_collection`)
2. Then: Automatically scores the collected data (same as `scoring`)

**When to use:**
- **Most common use case** - You want the complete workflow
- Scheduled jobs - Set it and forget it
- Regular updates - Daily/weekly automated updates

**Manual step required:** **NO** - It does both automatically!

## How to Use

### Option 1: Scheduled Jobs (Automated)

When creating a scheduled job, choose:
- **Job Type:** `Data Collection + Scoring` ⭐
- **Cron:** `0 9 * * *` (daily at 9 AM)
- **Result:** System automatically collects data, then scores it - no manual clicks needed!

### Option 2: Quick Actions (Immediate)

#### Recommended: "Collect & Score" Button ⭐
- **One click** - Does both automatically
- Collects data first
- Then automatically scores it
- **No manual steps needed!**

#### Alternative: Separate Buttons
- Click "Start Collection" → Wait → Click "Start Scoring"
- More control, but requires 2 clicks

## Workflow Comparison

### ❌ Manual Workflow (2 Steps)
```
1. Click "Start Collection" → Wait 10-30 minutes
2. Click "Start Scoring" → Wait 2-5 minutes
Total: 2 clicks, 12-35 minutes
```

### ✅ Automated Workflow (1 Step)
```
1. Click "Collect & Score" → Wait 12-35 minutes
Total: 1 click, 12-35 minutes (same time, less clicks!)
```

### ✅ Scheduled Workflow (0 Clicks)
```
1. Create scheduled job with type "Data Collection + Scoring"
2. System runs automatically on schedule
Total: 0 clicks after setup!
```

## Best Practices

1. **For Regular Updates:**
   - Create a scheduled job with type `data_collection_and_scoring`
   - Set cron to run daily/weekly
   - System handles everything automatically

2. **For Immediate Needs:**
   - Use "Collect & Score" button for one-click solution
   - Or use separate buttons if you need more control

3. **For Testing:**
   - Use separate buttons to test each step individually
   - Use "Collect & Score" to test the full workflow

## FAQ

**Q: Do I need to manually click scoring after data collection?**
- **For scheduled jobs:** NO - Use `data_collection_and_scoring` type
- **For quick actions:** NO - Use "Collect & Score" button
- **Only if:** You use separate "Collect Data Now" button, then yes, you need to click "Score Now" separately

**Q: What's the difference between the job types?**
- `data_collection` = Step 1 only
- `scoring` = Step 2 only  
- `data_collection_and_scoring` = Step 1 + Step 2 automatically

**Q: Which should I use?**
- **Scheduled jobs:** Always use `data_collection_and_scoring`
- **Quick actions:** Use "Collect & Score" button (does both)

**Q: Can I run scoring on old data?**
- Yes! Use "Score Now" button or create a `scoring` only job
- It will process all unprocessed collector results

**Q: What if data collection fails?**
- If using `data_collection_and_scoring`, scoring will be skipped
- Check job run history for error details
- Fix the issue and re-run

## Summary

| Action | Job Type | Manual Steps | Best For |
|--------|----------|--------------|----------|
| Scheduled Job | `data_collection_and_scoring` | 0 (automatic) | Regular updates |
| Quick Action | "Collect & Score" button | 0 (automatic) | Immediate needs |
| Quick Action | Separate buttons | 2 (manual) | Testing/control |

**Bottom line:** Use `data_collection_and_scoring` for scheduled jobs, and "Collect & Score" button for immediate actions - both do everything automatically! 🎉

