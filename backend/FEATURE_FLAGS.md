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

### Prompt Metrics Service

**`USE_OPTIMIZED_PROMPT_METRICS`** (default: `false`)

Controls whether prompt metrics calculations use the optimized new schema or the legacy `extracted_positions` table.

- `true`: Query `metric_facts` + `brand_metrics` + `brand_sentiment` (optimized, single query)
- `false`: Query `extracted_positions` (legacy, 2 separate queries)

**Usage:**
```bash
# Enable optimization
USE_OPTIMIZED_PROMPT_METRICS=true

# Disable (default)
USE_OPTIMIZED_PROMPT_METRICS=false
```

**Impact:** MEDIUM (prompt metrics page)  
**Risk:** LOW (simple aggregations)

**Benefits:**
- Single query vs 2 separate queries
- 10-15x faster
- Fetches both visibility and sentiment in one go

### Keywords Analytics Service

**`USE_OPTIMIZED_KEYWORDS_QUERY`** (default: `false`)

Controls whether keywords analytics uses the optimized new schema or the legacy `extracted_positions` table.

- `true`: Query `metric_facts` + `brand_metrics` (optimized)
- `false`: Query `extracted_positions` (legacy, current behavior)

**Usage:**
```bash
# Enable optimization
USE_OPTIMIZED_KEYWORDS_QUERY=true

# Disable (default)
USE_OPTIMIZED_KEYWORDS_QUERY=false
```

**Impact:** MEDIUM (keywords page)  
**Risk:** LOW (simple brand presence check)

**Benefits:**
- Direct JOIN on indexed tables
- 10-15x faster
- Simpler query structure

---

## Migration Status

| Service | Flag | Status | Enabled |
|---------|------|--------|---------|
| Position Extraction | `USE_OPTIMIZED_POSITION_CHECK` | ✅ Implemented | ⏳ Testing |
| Sentiment Services | `USE_OPTIMIZED_SENTIMENT_QUERY` | ✅ Implemented | ⏳ Testing |
| Prompt Metrics | `USE_OPTIMIZED_PROMPT_METRICS` | ✅ Implemented | ⏳ Testing |
| Keywords Analytics | `USE_OPTIMIZED_KEYWORDS_QUERY` | ✅ Implemented | ⏳ Testing |
| Source Attribution | TBD | ⏳ Pending (Phase 3.3) | - |
| Brand Topics | TBD | ⏳ Pending (Phase 3.4) | - |

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

