# Customer Entitlements Implementation Plan

## Goal
Enforce customer entitlements configured in the Admin UI across the backend services. This ensures that customers are restricted to their assigned tier limits (Free, Enterprise, Agency) regarding brands, queries, collectors, and feature access.

## Current State
- **UI**: `/admin/entitlements` allows configuration.
- **Data**: Stored in `customers.settings` JSONB column.
- **Enforcement**: None. Backend currently allows unlimited usage.

## Implementation Phases

### Phase 1: Enforce Brand Creation Limits
**Goal**: Prevent creating more brands than allowed by the plan.

1.  **Modify `BrandService.createBrand`**
    - Location: `backend/src/services/brand.service.ts`
    - Logic:
        - Before creation, fetch the current count of brands for the `customer_id`.
        - valid `max_brands` from `CustomerEntitlementsService`.
        - If `current_count >= max_brands`, throw a `ValidationError` with a clear message (e.g., "Brand limit reached for your plan").

### Phase 2: Enforce Data Collection Restrictions
**Goal**: Ensure users only use allowed AI collectors, countries, and adhere to scheduling limits.

1.  **Modify `DataCollectionJobService.executeDataCollection`**
    - Location: `backend/src/services/jobs/data-collection-job.service.ts`
    - Logic:
        - Fetch `enabled_collectors` list from entitlements.
        - Fetch `enabled_countries` list from entitlements.
        - Filter the job's requested collectors/countries.
        - If the job accepts a list of collectors, filter out disallowed ones.
        - If the job is for a disallowed country, reject the job or default to 'US' (if allowed).

2.  **Modify `JobSchedulerService.createScheduledJob`**
    - Location: `backend/src/services/jobs/job-scheduler.service.ts`
    - Logic:
        - Validate the input `cron_expression`.
        - Compare against the Entitlement `run_frequency` (e.g., Daily, Weekly, Monthly).
        - If a user tries to schedule "Daily" but is only allowed "Weekly", throw a `ValidationError`.

### Phase 3: Enforce Query Usage Limits
**Goal**: Limit the number of active queries per brand to control costs.

1.  **Modify `DataCollectionJobService` (Validation)**
    - Location: `backend/src/services/jobs/data-collection-job.service.ts`
    - Logic:
        - Before running a job, count the number of *active* queries for the brand.
        - Fetch `max_queries_per_brand` from entitlements.
        - If `active_queries > max_queries`, do one of the following (decide on policy):
            - **Strict**: Fail the job with an error.
            - **Soft**: Only execute the first `max_queries` and warn.
        - *Recommendation*: Strict failure or partial execution with a logged warning is usually better for clarity.

### Phase 4: Enforce Feature Access (API Barriers)
**Goal**: completely block access to modules (Reporting, Recommendations, etc.) if not included in the plan.

1.  **Create Middleware `requireFeatureEntitlement`**
    - Location: `backend/src/middleware/auth.middleware.ts` (or new `entitlements.middleware.ts`)
    - Logic:
        - Factory function accepting a `featureName` (e.g., 'recommendations').
        - Checks `request.user.customer_id` -> load entitlements.
        - If `features[featureName]` is false, return 403 Forbidden.

2.  **Apply to Routes**
    - `backend/src/routes/recommendations.routes.ts`: Apply `requireFeatureEntitlement('recommendations')`
    - `backend/src/routes/executive-reporting.routes.ts`: Apply `requireFeatureEntitlement('executive_reporting')`
    - `backend/src/routes/measure.routes.ts`: Apply `requireFeatureEntitlement('measure')`
    - `backend/src/routes/analyze-*.routes.ts`: Apply corresponding analyze flag.

## Verification
- [ ] Attempt to create (Max+1) brands -> Expect Error.
- [ ] Attempt to run collection with disallowed collector (e.g. 'Grok') -> Expect Filtered/Error.
- [ ] Attempt to schedule Daily job on Weekly plan -> Expect Error.
- [ ] Add 500 queries on a 100-query plan -> Expect Job Failure/Warning.
- [ ] Access `/api/reports` when Reporting is disabled -> Expect 403.
