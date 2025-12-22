# Feature Flags

## Phase 3.2: Optimized Query Migration Feature Flags

These environment variables control the gradual rollout of optimized queries from the new schema.

### Position Extraction Service

**`USE_OPTIMIZED_POSITION_CHECK`** (default: `false`)

Controls whether position extraction uses the optimized `metric_facts` table or the legacy `extracted_positions` table for existence checks.

- `true`: Query `metric_facts` (optimized, 5-10x faster)
- `false`: Query `extracted_positions` (legacy, current behavior)

**Usage:**
```bash
# Enable optimization
USE_OPTIMIZED_POSITION_CHECK=true

# Disable (default)
USE_OPTIMIZED_POSITION_CHECK=false
```

**Impact:** LOW (internal check only, not user-facing)  
**Risk:** VERY LOW (simple existence check)

### Sentiment Services (Deprecated)

**`USE_OPTIMIZED_SENTIMENT_QUERY`** (default: `false`)

Controls whether sentiment services use the optimized new schema or the legacy `extracted_positions` table for finding rows without sentiment.

- `true`: Query `metric_facts` + `brand_metrics` / `competitor_metrics` (optimized)
- `false`: Query `extracted_positions` (legacy, current behavior)

**Usage:**
```bash
# Enable optimization
USE_OPTIMIZED_SENTIMENT_QUERY=true

# Disable (default)
USE_OPTIMIZED_SENTIMENT_QUERY=false
```

**Impact:** LOW (deprecated services, using consolidated analysis now)  
**Risk:** VERY LOW (backfill only)

**Services affected:**
- `combined-sentiment.service.ts`
- `competitor-sentiment.service.ts`

**Note:** These services are deprecated. New data uses consolidated analysis which writes directly to the new schema (`brand_sentiment` and `competitor_sentiment` tables).

---

## Migration Status

| Service | Flag | Status | Enabled |
|---------|------|--------|---------|
| Position Extraction | `USE_OPTIMIZED_POSITION_CHECK` | ✅ Implemented | ⏳ Testing |
| Sentiment Services | `USE_OPTIMIZED_SENTIMENT_QUERY` | ✅ Implemented | ⏳ Testing |
| Prompt Metrics | TBD | ⏳ Pending | - |
| Keywords Analytics | TBD | ⏳ Pending | - |
| Source Attribution | TBD | ⏳ Pending | - |
| Brand Topics | TBD | ⏳ Pending | - |

---

## Rollout Process

1. **Implementation**: Add feature flag code
2. **Testing**: Run with flag enabled in dev/staging
3. **Validation**: Compare results and performance
4. **Gradual Rollout**: Enable for production gradually
5. **Monitor**: Watch for errors and performance
6. **Finalize**: Remove flag and legacy code after 1 week

---

## Monitoring

All optimized queries log:
- Which path was used (optimized vs legacy)
- Query duration
- Results returned

Check logs for performance comparison:
```bash
grep "optimized\|legacy" logs/*.log
```

