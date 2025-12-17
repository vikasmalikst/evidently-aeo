# Cron Jobs Setup Guide for Data Collection and Scoring

This guide will help you set up automated scheduled jobs (cron jobs) for data collection and scoring from the admin page.

## 📋 Table of Contents
1. [Accessing the Admin Page](#accessing-the-admin-page)
2. [Understanding Job Types](#understanding-job-types)
3. [Creating a Scheduled Job](#creating-a-scheduled-job)
4. [Cron Expression Format](#cron-expression-format)
5. [Managing Scheduled Jobs](#managing-scheduled-jobs)
6. [Monitoring Job Runs](#monitoring-job-runs)
7. [Important Notes](#important-notes)

---

## 🚀 Accessing the Admin Page

1. Navigate to the **Scheduled Jobs** page in your application
   - URL: `/admin/scheduled-jobs` or look for "Scheduled Jobs" in the navigation menu
2. Make sure you're logged in with admin access
3. Select your brand from the dropdown at the top of the page

---

## 📊 Understanding Job Types

There are three types of scheduled jobs you can create:

### 1. **Data Collection** (`data_collection`)
- **What it does**: Collects data from AI models (ChatGPT, Claude, Perplexity, etc.) for your brand's queries
- **When to use**: When you only want to collect data, but score it later manually
- **Duration**: Typically 10-20 minutes depending on number of queries

### 2. **Scoring** (`scoring`)
- **What it does**: Processes and scores already collected data (position extraction, sentiment analysis, citation extraction)
- **When to use**: After you've collected data and want to score it
- **Duration**: Typically 5-15 minutes depending on data volume

### 3. **Data Collection + Scoring** ⭐ **RECOMMENDED** (`data_collection_and_scoring`)
- **What it does**: Collects data first, then automatically scores it
- **When to use**: For daily/weekly automated workflows (most common use case)
- **Duration**: Typically 15-35 minutes (collection + scoring combined)
- **Why recommended**: One job does everything automatically - no manual steps needed!

---

## ➕ Creating a Scheduled Job

### Step-by-Step Instructions:

1. **Click "Create Scheduled Job" button** (blue button at the top right)

2. **Fill in the form**:
   - **Brand**: Select the brand you want to schedule jobs for
   - **Job Type**: Choose one of the three types (recommended: "Data Collection + Scoring")
   - **Cron Expression**: Enter when you want the job to run (see [Cron Expression Format](#cron-expression-format) below)
   - **Timezone**: Enter timezone (e.g., "UTC", "America/New_York", "Europe/London")
   - **Active**: Check this box to enable the job immediately

3. **Click "Create"**

4. **Verify**: The job will appear in the jobs table below

### Example: Daily Job at 9 AM UTC

```
Brand: Your Brand Name
Job Type: Data Collection + Scoring
Cron Expression: 0 9 * * *
Timezone: UTC
Active: ✓ (checked)
```

This will run every day at 9:00 AM UTC, collecting data and scoring it automatically.

---

## ⏰ Cron Expression Format

Cron expressions use 5 fields separated by spaces:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Common Examples:

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily at 9 AM | `0 9 * * *` | Every day at 9:00 AM |
| Daily at midnight | `0 0 * * *` | Every day at 12:00 AM |
| Every 6 hours | `0 */6 * * *` | At 00:00, 06:00, 12:00, 18:00 |
| Every Monday at 9 AM | `0 9 * * 1` | Every Monday at 9:00 AM |
| Twice daily | `0 9,21 * * *` | At 9:00 AM and 9:00 PM |
| Weekly on Sunday | `0 9 * * 0` | Every Sunday at 9:00 AM |
| Monthly on 1st | `0 9 1 * *` | First day of every month at 9:00 AM |
| Every 30 minutes | `*/30 * * * *` | Every 30 minutes |

### Special Characters:

- `*` = any value (matches all)
- `,` = list separator (e.g., `9,21` = 9 AM and 9 PM)
- `-` = range (e.g., `9-17` = 9 AM to 5 PM)
- `/` = step values (e.g., `*/6` = every 6 hours, `0-59/15` = every 15 minutes)

### Timezone Considerations:

- **UTC** (recommended): `0 9 * * *` = 9:00 AM UTC
- **EST**: `0 9 * * *` with timezone `America/New_York` = 9:00 AM EST
- **PST**: `0 9 * * *` with timezone `America/Los_Angeles` = 9:00 AM PST

**Tip**: Use UTC for consistency, especially if you have multiple brands in different timezones.

---

## 🔧 Managing Scheduled Jobs

### Viewing Jobs

All scheduled jobs are displayed in a table showing:
- **Brand**: Which brand the job is for
- **Job Type**: Type of job (Data Collection, Scoring, or Both)
- **Schedule**: The cron expression
- **Next Run**: When the job will run next
- **Status**: Active or Inactive

### Actions Available:

1. **Activate/Deactivate**: Toggle the job on/off without deleting it
2. **Trigger**: Manually trigger the job to run immediately (for testing)
3. **History**: View past job runs and their results
4. **Trends**: View historical data trends for the brand
5. **Delete**: Permanently remove the job

### Editing Jobs

Currently, jobs cannot be edited directly. To change a job:
1. Deactivate or delete the old job
2. Create a new job with the updated settings

---

## 📈 Monitoring Job Runs

### Viewing Recent Runs

Scroll down to the **"Recent Job Runs"** section to see:
- Job execution status (pending, processing, completed, failed)
- Execution time and duration
- Error messages (if any)
- Metrics (queries executed, positions processed, etc.)

### Job Statuses:

- **pending**: Job is scheduled but not yet started
- **processing**: Job is currently running
- **completed**: Job finished successfully
- **failed**: Job encountered an error
- **cancelled**: Job was cancelled

### Viewing Detailed History

1. Click **"History"** button next to any job
2. View detailed information about each run:
   - Start and finish times
   - Duration
   - Success/failure status
   - Error messages
   - Detailed metrics

---

## ⚠️ Important Notes

### Collectors Configuration

✅ **Automatic Collector Selection**: The system now automatically uses the collectors you selected during onboarding for each brand. You don't need to manually configure collectors in the job metadata.

- If you selected ChatGPT, Claude, and Perplexity during onboarding, those are the collectors that will be used
- The system fetches your brand's `ai_models` from the database and maps them to collectors
- If no collectors were selected during onboarding, the system uses default collectors

### Job Execution

- **Background Processing**: Jobs run in the background and won't block other operations
- **Automatic Retry**: Failed jobs don't automatically retry - you'll need to manually trigger them or wait for the next scheduled run
- **Resource Usage**: Large jobs (many queries) may take 30+ minutes to complete

### Best Practices

1. **Start with Daily Jobs**: Begin with a daily schedule (`0 9 * * *`) to ensure everything works correctly
2. **Use "Data Collection + Scoring"**: This is the recommended job type for automated workflows
3. **Monitor First Few Runs**: Check the job history after the first few runs to ensure everything is working
4. **Set Realistic Schedules**: Don't schedule jobs too frequently (e.g., every hour) unless necessary - daily or weekly is usually sufficient
5. **Use UTC Timezone**: For consistency across different regions

### Troubleshooting

**Job not running?**
- Check if the job is marked as "Active"
- Verify the cron expression is correct
- Check the "Next Run" time - has it passed?
- Ensure the job worker is running (check backend logs)

**Job failing?**
- Check the error message in the job run history
- Verify the brand has active queries (`is_active = true` in `generated_queries` table)
- Check if collectors are properly configured for the brand
- Review backend logs for detailed error information

**Job taking too long?**
- This is normal for large datasets
- Check the metrics to see how many queries/positions are being processed
- Consider splitting into separate collection and scoring jobs if needed

---

## 🎯 Quick Start Example

Here's a complete example for setting up a daily automated data collection and scoring job:

1. **Navigate to**: Admin → Scheduled Jobs
2. **Select your brand** from the dropdown
3. **Click**: "Create Scheduled Job"
4. **Fill in**:
   ```
   Brand: [Your Brand Name]
   Job Type: Data Collection + Scoring
   Cron Expression: 0 9 * * *
   Timezone: UTC
   Active: ✓
   ```
5. **Click**: "Create"
6. **Verify**: Job appears in the table with "Next Run" showing tomorrow at 9:00 AM UTC
7. **Wait**: For the first run to complete
8. **Check**: Job run history to confirm it worked

That's it! Your brand will now automatically collect and score data every day at 9 AM UTC.

---

## 📞 Need Help?

If you encounter issues:
1. Check the job run history for error messages
2. Review backend logs for detailed error information
3. Verify your brand has active queries
4. Ensure the job worker process is running

---

**Last Updated**: January 2025
**Version**: 1.0
