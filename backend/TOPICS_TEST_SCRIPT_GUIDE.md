# Topics Page Test Script Guide

**Purpose:** Compare data from legacy schema vs new optimized schema to verify Topics page migration.

---

## 🎯 What This Script Does

1. **Extracts metrics from LEGACY schema** (`extracted_positions` table):
   - Brand metrics: SOA, Visibility, Sentiment
   - Competitor metrics: Average SOA, Visibility, Sentiment
   - Groups by topic

2. **Extracts metrics from NEW schema** (`metric_facts` + `brand_metrics` + `competitor_metrics`):
   - Same metrics as legacy
   - Uses optimized normalized tables
   - Groups by topic

3. **Compares side-by-side**:
   - Shows both datasets in tabular format
   - Highlights matches (✅) and mismatches (❌)
   - Calculates match percentage
   - Shows discrepancies for debugging

---

## 🚀 How to Run

### Option 1: Using the Shell Script (Recommended)

```bash
cd backend
chmod +x test-topics.sh
./test-topics.sh
```

### Option 2: Direct TypeScript Execution

```bash
cd backend
npx ts-node src/scripts/test-topics-comparison.ts
```

---

## 📊 What You'll See

### Example Output:

```
========================================
   TOPICS PAGE DATA COMPARISON TEST
========================================

Brand ID: 5a57c430-6940-4198-a1f5-a443cbd044dc
Customer ID: 157c845c-9e87-4146-8479-cb8d045212bf

📋 [LEGACY] Querying extracted_positions table...
✅ Found 245 rows in extracted_positions

⚡ [OPTIMIZED] Querying new schema (metric_facts + metrics tables)...
✅ Found 180 brand metric rows
✅ Found 65 competitor metric rows

📊 Found 8 unique topics

========================================
           COMPARISON RESULTS
========================================

✅ TOPIC: NOISE CANCELLATION
────────────────────────────────────────────────────────────────────────────────

📊 BRAND METRICS:
  SOA (Share of Answers):
    Legacy:       80.00  ✅
    Optimized:    80.00
  Visibility Index:
    Legacy:       75.50  ✅
    Optimized:    75.50
  Sentiment Score:
    Legacy:       85.00  ✅
    Optimized:    85.00

🏢 COMPETITOR AVERAGE METRICS:
  SOA (Share of Answers):
    Legacy:       45.50  ✅
    Optimized:    45.50
  Visibility Index:
    Legacy:       50.25  ✅
    Optimized:    50.25
  Sentiment Score:
    Legacy:       70.00  ✅
    Optimized:    70.00

  Competitor Count: 3 (legacy) vs 3 (optimized)
  Data Points: 15 (legacy) vs 15 (optimized)

❌ TOPIC: SOUND QUALITY
────────────────────────────────────────────────────────────────────────────────

📊 BRAND METRICS:
  SOA (Share of Answers):
    Legacy:       60.00  ✅
    Optimized:    60.00
  Visibility Index:
    Legacy:       65.00  ❌  <-- MISMATCH!
    Optimized:    62.50
  Sentiment Score:
    Legacy:       80.00  ✅
    Optimized:    80.00

🏢 COMPETITOR AVERAGE METRICS:
  SOA (Share of Answers):
    Legacy:       40.00  ✅
    Optimized:    40.00
  Visibility Index:
    Legacy:       45.00  ❌  <-- MISMATCH!
    Optimized:    43.00
  Sentiment Score:
    Legacy:       65.00  ✅
    Optimized:    65.00

  Competitor Count: 2 (legacy) vs 2 (optimized)
  Data Points: 12 (legacy) vs 12 (optimized)

========================================
              SUMMARY
========================================

Total Topics: 8
Perfect Matches: 7 ✅
Mismatches: 1 ❌
Match Rate: 87.5%

⚠️ WARNING: 1 topic(s) have discrepancies. Review above for details.
```

---

## 📝 Understanding the Output

### Status Icons

- ✅ **Green checkmark**: Values match (within 0.5 tolerance)
- ❌ **Red X**: Values don't match (discrepancy > 0.5)

### Metrics Shown

**For Each Topic:**

1. **Brand Metrics:**
   - SOA (Share of Answers): 0-100 scale
   - Visibility Index: 0-100 scale
   - Sentiment Score: 0-100 scale

2. **Competitor Average Metrics:**
   - Average SOA across all competitors
   - Average Visibility across all competitors
   - Average Sentiment across all competitors

3. **Metadata:**
   - Competitor Count: Number of distinct competitors for this topic
   - Data Points: Total number of data rows (brand + competitor)

### Tolerance

- Values are considered matching if they're within **0.5** of each other
- This accounts for floating-point rounding differences
- Can be adjusted in the script if needed

---

## 🐛 Troubleshooting

### Issue: "No topics found"

**Check:**
1. Does the brand have data in `extracted_positions`?
   ```sql
   SELECT COUNT(*), topic FROM extracted_positions 
   WHERE brand_id = '5a57c430-6940-4198-a1f5-a443cbd044dc'
   GROUP BY topic;
   ```

2. Does the brand have data in `metric_facts`?
   ```sql
   SELECT COUNT(*), topic FROM metric_facts 
   WHERE brand_id = '5a57c430-6940-4198-a1f5-a443cbd044dc'
   GROUP BY topic;
   ```

### Issue: "Large discrepancies in values"

**Possible causes:**
1. **Visibility normalization**: Check if one schema has 0-1 scale and other has 0-100
2. **Missing joins**: Competitor data might not be joined correctly
3. **Filtering differences**: Check if date ranges or filters are applied differently

**Debug:**
- Look at raw data for a specific topic in both schemas
- Check if competitor exclusion logic is working (current brand shouldn't appear as competitor)

### Issue: "Competitor count mismatch"

**Possible causes:**
1. Current brand appearing as competitor in one schema but not the other
2. Competitor names not normalized (case sensitivity)
3. Missing competitor data in one schema

---

## 🎯 Success Criteria

**What indicates a successful migration:**

- ✅ Match Rate: **100%** (all topics match perfectly)
- ✅ Brand SOA matches for all topics
- ✅ Brand Visibility matches for all topics
- ✅ Brand Sentiment matches for all topics
- ✅ Competitor averages match for all topics
- ✅ Competitor counts match
- ✅ No null values where data should exist

**What's acceptable:**

- ⚠️ Match Rate: **95%+** (minor discrepancies in 1-2 topics)
- ⚠️ Small differences (<0.5) due to rounding
- ⚠️ Different data point counts if some data wasn't migrated (document why)

**What needs fixing:**

- ❌ Match Rate: **<95%** (significant discrepancies)
- ❌ Null values in optimized where legacy has data
- ❌ Large differences (>5) in any metric
- ❌ Wrong competitor counts

---

## 🔧 Customization

### Change Test Brand/Customer

Edit `src/scripts/test-topics-comparison.ts`:

```typescript
const BRAND_ID = 'your-brand-id-here';
const CUSTOMER_ID = 'your-customer-id-here';
```

### Change Tolerance

Edit the `valuesMatch` function:

```typescript
function valuesMatch(val1: number | null, val2: number | null, tolerance: number = 0.5)
```

Change `tolerance` parameter (e.g., `tolerance = 1.0` for more lenient matching).

### Add Date Range Filtering

Add date filters to both schema queries:

```typescript
.gte('processed_at', 'start-date')
.lte('processed_at', 'end-date')
```

---

## 📊 Exporting Results

### To Save Output to File:

```bash
./test-topics.sh > topics-test-results.txt
```

### To Save and View:

```bash
./test-topics.sh | tee topics-test-results.txt
```

---

## 🔄 Next Steps Based on Results

### If Match Rate = 100%:

1. ✅ Migration is successful
2. ✅ Enable `USE_OPTIMIZED_TOPICS_QUERY=true` in production
3. ✅ Monitor for 1 week
4. ✅ Remove legacy code

### If Match Rate = 95-99%:

1. ⚠️ Review specific discrepancies
2. ⚠️ Determine if acceptable (rounding, minor differences)
3. ⚠️ If acceptable, document and proceed
4. ⚠️ If not, investigate and fix

### If Match Rate < 95%:

1. ❌ Do NOT enable in production
2. ❌ Debug discrepancies using output
3. ❌ Fix issues in optimized queries
4. ❌ Re-run test until 95%+ match

---

## 📞 Support

If you encounter issues:

1. Check the raw SQL queries in both schemas
2. Verify data exists in both schemas
3. Look for filtering or join differences
4. Check visibility normalization (0-1 vs 0-100)
5. Report specific discrepancies with topic names and values

