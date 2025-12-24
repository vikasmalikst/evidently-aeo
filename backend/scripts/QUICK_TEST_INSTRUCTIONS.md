# Quick Test Instructions - Disable extracted_positions Table

## 🚀 Method 1: Supabase SQL Editor (Easiest)

### Step 1: Disable the Table

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and paste this SQL:

```sql
-- Disable extracted_positions table
ALTER TABLE IF EXISTS extracted_positions 
RENAME TO extracted_positions_disabled_test;

-- Disable compatibility view (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'extracted_positions_compat'
    ) THEN
        ALTER MATERIALIZED VIEW extracted_positions_compat 
        RENAME TO extracted_positions_compat_disabled_test;
    END IF;
END $$;
```

4. Click **Run** or press `Ctrl+Enter`
5. You should see: "Success. No rows returned"

### Step 2: Verify Table is Disabled

Run this query to confirm:

```sql
-- This should FAIL (table doesn't exist)
SELECT * FROM extracted_positions LIMIT 1;
```

Expected: Error like "relation 'extracted_positions' does not exist"

### Step 3: Run Tests

```bash
cd backend
npx ts-node scripts/test-services-without-extracted-positions.ts
```

### Step 4: Restore Table (if needed)

If tests fail, restore the table:

```sql
-- Restore extracted_positions table
ALTER TABLE IF EXISTS extracted_positions_disabled_test 
RENAME TO extracted_positions;

-- Restore compatibility view (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_matviews 
        WHERE schemaname = 'public' 
        AND matviewname = 'extracted_positions_compat_disabled_test'
    ) THEN
        ALTER MATERIALIZED VIEW extracted_positions_compat_disabled_test 
        RENAME TO extracted_positions_compat;
    END IF;
END $$;
```

---

## 🖥️ Method 2: Terminal (psql)

If you have `psql` installed and `DATABASE_URL` set:

```bash
# Disable table
psql $DATABASE_URL -f backend/scripts/test-without-extracted-positions-direct.sql

# Run tests
cd backend
npx ts-node scripts/test-services-without-extracted-positions.ts

# Restore table (if needed)
psql $DATABASE_URL -f backend/scripts/rollback-extracted-positions-direct.sql
```

---

## 📋 What Each Method Does

Both methods do the same thing:
- **Rename** `extracted_positions` → `extracted_positions_disabled_test`
- **Rename** `extracted_positions_compat` → `extracted_positions_compat_disabled_test`
- Makes the table **inaccessible** (queries will fail)
- **Reversible** (can restore by renaming back)

---

## ✅ Success Indicators

After disabling the table:

1. ✅ This query should **FAIL**:
   ```sql
   SELECT * FROM extracted_positions LIMIT 1;
   ```

2. ✅ This query should **SUCCEED**:
   ```sql
   SELECT * FROM extracted_positions_disabled_test LIMIT 1;
   ```

3. ✅ Test script should **PASS** all tests

---

## ⚠️ Important Notes

- **Safe Operation:** Only renames table (no data loss)
- **Reversible:** Can restore in seconds
- **No Downtime:** Services continue working with new schema
- **Test First:** Always test in staging before production

---

## 🎯 Next Steps After Successful Test

If all tests pass:
1. ✅ System works without `extracted_positions`
2. ✅ Safe to drop table permanently
3. ✅ Migration is 100% complete

