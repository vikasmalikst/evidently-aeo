# Manage Prompts Implementation Plan

## Executive Summary
This document outlines the comprehensive plan to convert the Manage Prompts page (`/settings/manage-prompts`) from mock data to real data integration, including a complete versioning system for prompt configurations.

## Current State Analysis

### Frontend Components
1. **ManagePrompts.tsx** - Main page container
   - Displays summary statistics (total prompts, topics, coverage, visibility score)
   - Shows configuration history timeline
   - Manages prompt selection and viewing
   - Currently uses `mockPromptsData` from `src/data/mockPromptsData.ts`

2. **ManagePromptsList.tsx** - Prompts list with edit/delete/add functionality
   - Topic-based organization with expand/collapse
   - Inline editing, deletion, and addition of prompts
   - Tracks pending changes (added, removed, edited)
   - Shows recalibration warnings and impact preview
   - Version selection dropdown to view historical configurations

3. **Mock Data Structure**:
   ```typescript
   interface Prompt {
     id: number;
     text: string;
     response: string;
     lastUpdated: string;
     sentiment: number;
     volume: number;
     keywords: {
       brand: string[];
       target: string[];
       top: string[];
     };
   }
   
   interface Topic {
     id: number;
     name: string;
     prompts: Prompt[];
   }
   ```

### Backend Services
1. **prompts-analytics.service.ts** - Currently handles analytics/viewing only
   - Fetches prompts from `generated_queries` table
   - Aggregates responses from `collector_results`
   - Extracts highlights, sentiment, visibility scores
   - Groups by topics extracted from metadata
   
2. **Existing Database Tables**:
   - `generated_queries` - Stores brand's generated prompts/queries
   - `generated_keywords` - Stores keywords for brands
   - `collector_results` - Stores LLM responses to queries
   - `extracted_positions` - Stores sentiment and visibility scores
   - `brands` - Brand configuration
   - `customers` - Customer/user data

### Gap Analysis
**What's Missing**:
1. Backend APIs for CRUD operations on prompts
2. Database schema for storing prompt configuration versions
3. Versioning logic and history tracking
4. Impact calculation/recalibration endpoints
5. Topics management (CRUD operations)
6. Change tracking and approval workflow

---

## Data Mapping Strategy

### Real Data Sources

#### 1. **Prompts** → `generated_queries` table
```sql
SELECT 
  gq.id,
  gq.query_text as text,
  gq.topic as topic_name,
  gq.brand_id,
  gq.created_at,
  gq.updated_at,
  gq.metadata
FROM generated_queries gq
WHERE gq.brand_id = ?
  AND gq.customer_id = ?
ORDER BY gq.topic, gq.created_at DESC
```

#### 2. **Topics** → Extracted from `generated_queries.topic` or `metadata`
- Currently topics are stored as strings in the `topic` column or `metadata.topic_name`
- We'll need to group prompts by their topic value
- Topic names are dynamic based on the queries

#### 3. **Responses** → `collector_results` table
```sql
SELECT 
  cr.id,
  cr.query_id,
  cr.collector_type,
  cr.raw_answer as response,
  cr.created_at,
  cr.metadata
FROM collector_results cr
WHERE cr.query_id = ?
  AND cr.brand_id = ?
ORDER BY cr.created_at DESC
LIMIT 1
```

#### 4. **Keywords/Highlights** → `generated_keywords` + metadata
```sql
SELECT 
  gk.keyword_type,
  gk.keywords
FROM generated_keywords gk
WHERE gk.brand_id = ?
  AND gk.customer_id = ?
```
Plus extract from `collector_results.metadata` and `extracted_positions`

#### 5. **Sentiment & Visibility** → `extracted_positions` table
```sql
SELECT 
  ep.query_id,
  ep.sentiment_score,
  ep.visibility_index,
  ep.rank
FROM extracted_positions ep
WHERE ep.query_id = ?
  AND ep.brand_id = ?
```

#### 6. **Volume** → Calculate from `collector_results` frequency
```sql
SELECT 
  COUNT(*) as volume_count
FROM collector_results cr
WHERE cr.query_id = ?
  AND cr.created_at >= ?
  AND cr.created_at <= ?
```

---

## Database Schema Design

### New Tables Needed

#### 1. **`prompt_configurations` table**
Stores versioned configurations of prompts for each brand.

```sql
CREATE TABLE public.prompt_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL, -- Auto-incremented version number
  is_active BOOLEAN NOT NULL DEFAULT true,
  change_type TEXT NOT NULL, -- 'initial_setup', 'prompt_added', 'prompt_removed', 'prompt_edited', 'bulk_update'
  change_summary TEXT, -- Human-readable description of changes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  metadata JSONB, -- Additional metadata about the configuration
  
  -- Ensure only one active configuration per brand
  CONSTRAINT unique_active_config 
    EXCLUDE (brand_id WITH =, customer_id WITH =) 
    WHERE (is_active = true),
  
  -- Ensure version uniqueness per brand
  CONSTRAINT unique_version_per_brand 
    UNIQUE (brand_id, customer_id, version)
);

CREATE INDEX idx_prompt_configs_brand ON prompt_configurations(brand_id, customer_id);
CREATE INDEX idx_prompt_configs_active ON prompt_configurations(brand_id, customer_id, is_active);
CREATE INDEX idx_prompt_configs_version ON prompt_configurations(brand_id, customer_id, version DESC);
```

#### 2. **`prompt_configuration_snapshots` table**
Stores the actual prompt data for each version (snapshot).

```sql
CREATE TABLE public.prompt_configuration_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  query_id UUID NOT NULL REFERENCES public.generated_queries(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  query_text TEXT NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT true, -- Whether this prompt is active in this version
  sort_order INTEGER, -- Order within the topic
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_query_per_config UNIQUE (configuration_id, query_id)
);

CREATE INDEX idx_config_snapshots_config ON prompt_configuration_snapshots(configuration_id);
CREATE INDEX idx_config_snapshots_query ON prompt_configuration_snapshots(query_id);
CREATE INDEX idx_config_snapshots_topic ON prompt_configuration_snapshots(configuration_id, topic);
```

#### 3. **`prompt_change_log` table**
Detailed change tracking for audit purposes.

```sql
CREATE TABLE public.prompt_change_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  query_id UUID REFERENCES public.generated_queries(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL, -- 'added', 'removed', 'edited', 'topic_changed'
  old_value TEXT, -- JSON string of old state
  new_value TEXT, -- JSON string of new state
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_change_log_config ON prompt_change_log(configuration_id);
CREATE INDEX idx_change_log_query ON prompt_change_log(query_id);
```

#### 4. Update `generated_queries` table
Add columns to support versioning:

```sql
ALTER TABLE public.generated_queries
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES public.users(id);

CREATE INDEX idx_generated_queries_active ON generated_queries(brand_id, customer_id, is_active);
```

#### 5. **`prompt_metrics_snapshots` table**
Store calculated metrics at the time of each version for comparison.

```sql
CREATE TABLE public.prompt_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  configuration_id UUID NOT NULL REFERENCES public.prompt_configurations(id) ON DELETE CASCADE,
  total_prompts INTEGER NOT NULL,
  total_topics INTEGER NOT NULL,
  coverage_score DECIMAL(5,2), -- 0-100
  avg_visibility_score DECIMAL(5,2),
  avg_sentiment_score DECIMAL(5,2),
  analyses_count INTEGER DEFAULT 0, -- Number of times this config was used
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metrics_data JSONB, -- Additional computed metrics
  
  CONSTRAINT unique_metrics_per_config UNIQUE (configuration_id)
);

CREATE INDEX idx_metrics_snapshots_config ON prompt_metrics_snapshots(configuration_id);
```

---

## Backend API Endpoints

### 1. **Prompt Management APIs**

#### GET `/api/brands/:brandId/prompts/manage`
Get all prompts for a brand with full details for management.

**Query Parameters:**
- `includeArchived` (boolean) - Include archived prompts
- `version` (number) - Get specific version snapshot

**Response:**
```json
{
  "success": true,
  "data": {
    "brandId": "uuid",
    "brandName": "string",
    "currentVersion": 3,
    "topics": [
      {
        "id": "string",
        "name": "Product Features",
        "promptCount": 8,
        "prompts": [
          {
            "id": "uuid",
            "text": "What are the key features?",
            "topic": "Product Features",
            "response": "Latest AI response...",
            "lastUpdated": "2025-01-28T00:00:00Z",
            "sentiment": 4.5,
            "visibilityScore": 72.3,
            "volumeCount": 45,
            "keywords": {
              "brand": ["BrandName"],
              "products": ["ProductName"],
              "keywords": ["feature", "quality"],
              "competitors": ["Zomato"]
            },
            "source": "custom",
            "isActive": true
          }
        ]
      }
    ],
    "summary": {
      "totalPrompts": 72,
      "totalTopics": 9,
      "coverage": 94.0,
      "avgVisibility": 68.5,
      "avgSentiment": 4.2
    }
  }
}
```

#### POST `/api/brands/:brandId/prompts`
Add a new prompt to a brand.

**Request Body:**
```json
{
  "text": "How does X compare to Y?",
  "topic": "Product Features",
  "metadata": {
    "source": "custom",
    "priority": "high"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "promptId": "uuid",
    "message": "Prompt added successfully"
  }
}
```

#### PUT `/api/brands/:brandId/prompts/:promptId`
Edit an existing prompt.

**Request Body:**
```json
{
  "text": "Updated prompt text",
  "topic": "New Topic Name"
}
```

#### DELETE `/api/brands/:brandId/prompts/:promptId`
Archive (soft delete) a prompt.

**Query Parameters:**
- `permanent` (boolean) - Hard delete if true

### 2. **Version Management APIs**

#### GET `/api/brands/:brandId/prompts/versions`
Get version history for a brand's prompt configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentVersion": 3,
    "versions": [
      {
        "id": "config-uuid",
        "version": 3,
        "isActive": true,
        "changeType": "prompt_edited",
        "changeSummary": "Updated 3 prompts in Product Features topic",
        "createdAt": "2025-11-01T10:30:00Z",
        "createdBy": "User Name",
        "metrics": {
          "totalPrompts": 72,
          "totalTopics": 9,
          "coverage": 94.0,
          "analysesCount": 12
        }
      },
      {
        "id": "config-uuid-2",
        "version": 2,
        "isActive": false,
        "changeType": "prompt_added",
        "changeSummary": "Added 5 prompts in Security topic",
        "createdAt": "2025-10-15T14:20:00Z",
        "createdBy": "User Name",
        "metrics": {
          "totalPrompts": 69,
          "totalTopics": 9,
          "coverage": 92.0,
          "analysesCount": 28
        }
      }
    ]
  }
}
```

#### GET `/api/brands/:brandId/prompts/versions/:version`
Get specific version details including all prompts.

#### POST `/api/brands/:brandId/prompts/versions/:version/revert`
Revert to a specific version.

**Request Body:**
```json
{
  "changeSummary": "Reverted to version 2 due to...",
  "reason": "Performance issues with version 3"
}
```

#### GET `/api/brands/:brandId/prompts/versions/compare`
Compare two versions.

**Query Parameters:**
- `version1` (number)
- `version2` (number)

**Response:**
```json
{
  "success": true,
  "data": {
    "version1": 2,
    "version2": 3,
    "changes": {
      "added": [
        {"id": "uuid", "text": "New prompt", "topic": "Security"}
      ],
      "removed": [
        {"id": "uuid", "text": "Old prompt", "topic": "Pricing"}
      ],
      "edited": [
        {
          "id": "uuid",
          "oldText": "Old version",
          "newText": "New version",
          "topic": "Product Features"
        }
      ],
      "topicChanges": {
        "added": ["New Topic"],
        "removed": ["Old Topic"]
      }
    },
    "metricsComparison": {
      "prompts": {"v1": 69, "v2": 72, "diff": +3},
      "topics": {"v1": 8, "v2": 9, "diff": +1},
      "coverage": {"v1": 92.0, "v2": 94.0, "diff": +2.0}
    }
  }
}
```

### 3. **Batch Update APIs**

#### POST `/api/brands/:brandId/prompts/batch`
Apply multiple changes and create a new version atomically.

**Request Body:**
```json
{
  "changes": {
    "added": [
      {"text": "New prompt 1", "topic": "Topic A"},
      {"text": "New prompt 2", "topic": "Topic B"}
    ],
    "removed": ["prompt-uuid-1", "prompt-uuid-2"],
    "edited": [
      {"id": "prompt-uuid-3", "text": "Updated text"},
      {"id": "prompt-uuid-4", "topic": "New Topic"}
    ]
  },
  "changeSummary": "Q1 2025 prompt refresh",
  "changeType": "bulk_update"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "newVersion": 4,
    "configurationId": "config-uuid",
    "appliedChanges": {
      "added": 2,
      "removed": 2,
      "edited": 2
    },
    "newMetrics": {
      "totalPrompts": 72,
      "totalTopics": 9,
      "coverage": 94.5
    }
  }
}
```

### 4. **Impact Calculation APIs**

#### POST `/api/brands/:brandId/prompts/calculate-impact`
Calculate estimated impact of pending changes before applying.

**Request Body:**
```json
{
  "changes": {
    "added": [...],
    "removed": [...],
    "edited": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "estimatedImpact": {
      "coverage": {
        "current": 94.0,
        "projected": 96.5,
        "change": +2.5,
        "changePercent": +2.7
      },
      "visibilityScore": {
        "current": 68.5,
        "projected": 65.2,
        "change": -3.3,
        "changePercent": -4.8
      },
      "topicCoverage": {
        "increased": ["Security", "Performance"],
        "decreased": ["Pricing"],
        "unchanged": ["Product Features", "Support"]
      },
      "affectedAnalyses": 0,
      "warnings": [
        "Removing prompts may reduce historical comparison accuracy"
      ]
    },
    "calculatedAt": "2025-11-18T10:00:00Z"
  }
}
```

---

## Versioning Strategy

### When to Create Versions

#### 1. **Initial Setup (Onboarding) - Version 1**
**Trigger:** When a brand completes the onboarding wizard and generates their first set of prompts.

**Onboarding Steps:**
1. User enters brand information (Step 1)
2. User enters product details and competitors (Step 2)
3. User selects topics of interest (Step 3)
4. **System generates initial prompts** (Step 4)
5. User reviews and customizes generated prompts (Step 5)
6. **→ User clicks "Complete Setup" → CREATE VERSION 1**

**Version 1 Characteristics:**
- `change_type`: `'initial_setup'`
- `change_summary`: "Initial prompt configuration setup"
- `is_active`: `true`
- Includes all prompts selected/created during onboarding

**Implementation Point:**
```typescript
// In onboarding completion handler
async function completeOnboarding(brandId: string, customerId: string, prompts: Prompt[]) {
  // 1. Save all prompts to generated_queries
  // 2. Create prompt_configuration with version = 1
  // 3. Create prompt_configuration_snapshots for all prompts
  // 4. Calculate and store initial metrics
  // 5. Mark onboarding as complete
}
```

#### 2. **Subsequent Changes - Version 2, 3, 4...**
**Trigger:** When user makes changes in the Manage Prompts page and clicks "Apply Changes"

**Change Types:**
- `'prompt_added'` - One or more prompts added
- `'prompt_removed'` - One or more prompts removed
- `'prompt_edited'` - One or more prompts edited
- `'bulk_update'` - Mixed changes or large-scale updates
- `'version_revert'` - Reverted to a previous version

**Versioning Rules:**
1. Changes are NOT saved immediately - they're tracked as "pending changes"
2. User sees impact preview before confirming
3. Only when user clicks "Confirm & Apply" → create new version
4. New version becomes active, previous version is archived
5. All collector runs after this point use the new version

**Version Increment Logic:**
```typescript
async function createNewVersion(
  brandId: string,
  customerId: string,
  changes: PendingChanges,
  changeSummary: string
) {
  // 1. Get current active version
  const currentVersion = await getCurrentVersion(brandId, customerId);
  
  // 2. Set current version to inactive
  await setVersionInactive(currentVersion.id);
  
  // 3. Create new version (version = currentVersion.version + 1)
  const newVersion = await createConfiguration({
    brandId,
    customerId,
    version: currentVersion.version + 1,
    isActive: true,
    changeType: determineChangeType(changes),
    changeSummary,
  });
  
  // 4. Apply changes to generated_queries
  await applyChanges(changes);
  
  // 5. Create snapshots for new version
  await createSnapshots(newVersion.id, getAllActivePrompts(brandId));
  
  // 6. Calculate and store metrics
  await calculateMetrics(newVersion.id);
  
  // 7. Log detailed changes
  await logChanges(newVersion.id, changes);
  
  return newVersion;
}
```

#### 3. **Automatic Versioning (Optional Future Enhancement)**
- **Scheduled Versioning:** Auto-create version snapshots weekly/monthly for audit trail
- **Performance-based:** Auto-create version when metrics change significantly
- **Before Bulk Operations:** Auto-create version before system-wide updates

### Version Management Rules

1. **Immutability:** Once created, versions cannot be modified
2. **Active Version:** Only one version can be active at a time per brand
3. **Historical Preservation:** All versions are kept for audit trail
4. **Revert Creates New Version:** Reverting to v2 creates v4 with v2's configuration
5. **Analysis Association:** Each collector result references the active version at runtime

### Data Retention Strategy

**Keep Forever:**
- All `prompt_configurations` records
- All `prompt_configuration_snapshots` records
- All `prompt_change_log` records

**Can Archive (after 90 days):**
- Individual `collector_results` for old versions
- Detailed metrics snapshots (keep summary only)

**Benefits:**
- Complete audit trail for compliance
- Ability to analyze effectiveness of different configurations
- Rollback capability without data loss
- Understanding of prompt evolution over time

---

## Implementation Phases

### Phase 1: Database Schema & Migration (Week 1)
**Tasks:**
1. Create migration files for new tables
2. Update existing tables (generated_queries)
3. Write seed data scripts for testing
4. Test migrations in development environment

**Deliverables:**
- Migration SQL files
- Rollback scripts
- Database documentation

### Phase 2: Backend Services (Week 2-3)
**Tasks:**
1. Create `prompt-management.service.ts`
   - CRUD operations for prompts
   - Topic management
   - Data validation

2. Create `prompt-versioning.service.ts`
   - Version creation and management
   - Snapshot creation
   - Change logging
   - Metrics calculation

3. Create `prompt-impact.service.ts`
   - Impact estimation algorithms
   - Coverage calculation
   - Comparison logic

4. Update `prompts-analytics.service.ts`
   - Integrate version awareness
   - Add management endpoints

**Deliverables:**
- Service modules
- Unit tests
- API documentation

### Phase 3: API Routes (Week 3)
**Tasks:**
1. Create `prompt-management.routes.ts`
2. Add authentication/authorization middleware
3. Add input validation
4. Add error handling
5. Write integration tests

**Deliverables:**
- Route handlers
- API tests
- Postman collection

### Phase 4: Frontend Integration (Week 4-5)
**Tasks:**
1. Create API client methods in `/src/lib/apiClient.ts`
2. Update type definitions in `/src/types/prompts.ts`
3. Create hooks:
   - `usePromptManagement.ts`
   - `usePromptVersioning.ts`
   - `useImpactCalculation.ts` (already exists, update)

4. Update components:
   - Remove mock data imports
   - Connect to real APIs
   - Handle loading/error states
   - Add optimistic updates

**Deliverables:**
- API integration
- Updated components
- Loading skeletons
- Error boundaries

### Phase 5: Versioning UI (Week 5-6)
**Tasks:**
1. Enhance version dropdown with real data
2. Implement version comparison modal
3. Add version revert workflow
4. Show version impact metrics
5. Add change history timeline

**Deliverables:**
- Version UI components
- Comparison visualization
- User flows

### Phase 6: Onboarding Integration (Week 6)
**Tasks:**
1. Update onboarding completion handler
2. Add Version 1 creation logic
3. Add welcome message for first version
4. Test end-to-end onboarding flow

**Deliverables:**
- Updated onboarding flow
- Version 1 creation
- E2E tests

### Phase 7: Testing & Polish (Week 7)
**Tasks:**
1. End-to-end testing
2. Performance optimization
3. UI/UX refinements
4. Documentation updates
5. Security audit

**Deliverables:**
- Test reports
- Performance benchmarks
- User documentation
- Admin documentation

### Phase 8: Deployment (Week 8)
**Tasks:**
1. Staging deployment
2. Data migration for existing brands
3. Production deployment
4. Monitoring setup
5. User training materials

**Deliverables:**
- Deployed application
- Migration reports
- Monitoring dashboards
- Training videos

---

## Technical Considerations

### 1. **Performance**
- **Pagination:** Large brands may have 100+ prompts
- **Caching:** Cache version data and metrics
- **Lazy Loading:** Load responses on-demand
- **Indexing:** Proper database indexes for version queries

### 2. **Concurrency**
- **Optimistic Locking:** Prevent concurrent version creation
- **Transaction Management:** Atomic version creation
- **Conflict Resolution:** Handle simultaneous edits

### 3. **Data Migration**
- **Existing Brands:** Create Version 1 retroactively for existing brands
- **Historical Data:** Associate existing collector_results with Version 1
- **Backward Compatibility:** Ensure analytics still work during migration

### 4. **Security**
- **Authorization:** Only brand owners can modify prompts
- **Audit Trail:** Log all changes with user info
- **Rate Limiting:** Prevent abuse of version creation
- **Input Sanitization:** Prevent XSS/injection attacks

### 5. **User Experience**
- **Auto-save Drafts:** Save pending changes to localStorage
- **Undo/Redo:** Support undo for recent changes
- **Keyboard Shortcuts:** Power user features
- **Bulk Operations:** Select multiple prompts for bulk actions
- **Search/Filter:** Find prompts quickly in large lists

---

## API Response Examples (Full)

### Complete Prompt Object
```typescript
interface ManagedPrompt {
  id: string;
  queryId: string;
  text: string;
  topic: string;
  response: string | null;
  lastUpdated: string;
  createdAt: string;
  
  // Metrics
  sentiment: number | null;
  visibilityScore: number | null;
  volumeCount: number;
  
  // Highlights
  keywords: {
    brand: string[];
    products: string[];
    keywords: string[];
    competitors: string[];
  };
  
  // Metadata
  source: 'generated' | 'custom';
  isActive: boolean;
  collectorTypes: string[];
  
  // Version info
  includedInVersions: number[];
  firstVersionIncluded: number;
}
```

### Complete Configuration Object
```typescript
interface PromptConfiguration {
  id: string;
  brandId: string;
  customerId: string;
  version: number;
  isActive: boolean;
  changeType: 'initial_setup' | 'prompt_added' | 'prompt_removed' | 'prompt_edited' | 'bulk_update' | 'version_revert';
  changeSummary: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  
  // Metrics at the time of this version
  metrics: {
    totalPrompts: number;
    totalTopics: number;
    coverage: number;
    avgVisibility: number;
    avgSentiment: number;
    analysesCount: number; // How many times this version was used
  };
  
  // Included prompts snapshot
  prompts: ManagedPrompt[];
  
  // Changes from previous version
  changeDetails?: {
    added: string[]; // Prompt IDs
    removed: string[];
    edited: string[];
  };
}
```

---

## Testing Strategy

### Unit Tests
- Service method tests
- Validation logic tests
- Calculation accuracy tests
- Edge case handling

### Integration Tests
- API endpoint tests
- Database transaction tests
- Version creation flow tests
- Revert workflow tests

### E2E Tests
- Complete onboarding flow → Version 1 creation
- Add prompt → Create version → Verify impact
- Edit prompt → Preview → Apply → Verify
- Delete prompt → Confirm → New version
- Revert to old version → Verify state
- Compare two versions → Verify diff

### Performance Tests
- Load test with 100+ prompts
- Concurrent version creation
- Large batch updates
- Query optimization

---

## Success Metrics

### Technical Metrics
1. API response time < 500ms for list endpoints
2. Version creation < 2 seconds
3. Impact calculation < 3 seconds
4. Zero data loss during version transitions
5. 99.9% uptime

### User Experience Metrics
1. Time to add a prompt < 30 seconds
2. Time to create a version < 2 minutes
3. User satisfaction score > 4/5
4. Feature adoption rate > 80%
5. Support tickets < 5% of users

### Business Metrics
1. Increased prompt quality (measured by LLM responses)
2. Reduced manual prompt management time
3. Improved brand visibility scores
4. Higher user engagement with prompts feature

---

## Future Enhancements

### Short Term (Next Quarter)
1. **Prompt Templates Library:** Pre-built prompts for common industries
2. **AI-Powered Suggestions:** Suggest prompt improvements based on performance
3. **Collaborative Editing:** Multiple users can edit prompts with conflict resolution
4. **Advanced Filtering:** Filter prompts by performance, topic, date, etc.

### Medium Term (6 Months)
1. **A/B Testing:** Test different prompt versions simultaneously
2. **Prompt Analytics Dashboard:** Detailed performance metrics per prompt
3. **Automated Optimization:** AI automatically suggests and applies improvements
4. **Import/Export:** Share prompt configurations between brands

### Long Term (1 Year)
1. **Prompt Marketplace:** Share and discover prompts from other users
2. **Natural Language Editing:** Edit prompts using natural language commands
3. **Predictive Analysis:** Predict prompt performance before deployment
4. **Multi-brand Management:** Manage prompts across multiple brands centrally

---

## Risk Mitigation

### Risk 1: Data Migration Complexity
**Mitigation:**
- Phased rollout (pilot users first)
- Extensive testing with production-like data
- Rollback plan ready
- Manual fallback option

### Risk 2: Version Explosion
**Mitigation:**
- Educate users on best practices
- Discourage frequent minor changes
- Batch changes into meaningful versions
- Archive old versions after 1 year

### Risk 3: Performance Degradation
**Mitigation:**
- Implement pagination early
- Cache aggressively
- Monitor query performance
- Optimize indexes proactively

### Risk 4: User Confusion
**Mitigation:**
- Clear onboarding tutorial
- Tooltips and help text
- Video tutorials
- In-app guidance

---

## Appendix

### A. Database ER Diagram
```
brands
  ├── generated_queries (prompts)
  ├── prompt_configurations (versions)
  │     ├── prompt_configuration_snapshots
  │     ├── prompt_metrics_snapshots
  │     └── prompt_change_log
  ├── collector_results (responses)
  └── extracted_positions (metrics)
```

### B. State Machine: Version Lifecycle
```
[Draft] → [Pending Preview] → [Active] → [Archived]
                ↓
          [Cancelled]
```

### C. Prompt Lifecycle State Machine
```
[Created] → [Active] → [Edited] → [Active]
              ↓            ↓
          [Archived]  [Archived]
```

### D. References
- Existing `prompts-analytics.service.ts`
- Frontend types in `src/types/prompts.ts`
- Mock data structure in `src/data/mockPromptsData.ts`
- Onboarding flow (TBD)

---

## Summary

This implementation plan provides a comprehensive roadmap to convert the Manage Prompts page from mock data to real data integration with a robust versioning system. The phased approach ensures we can deliver incremental value while maintaining system stability.

**Key Deliverables:**
1. ✅ Complete database schema for prompt versioning
2. ✅ Backend APIs for prompt CRUD and version management
3. ✅ Frontend integration with real data
4. ✅ Onboarding integration for Version 1 creation
5. ✅ Version comparison and revert functionality
6. ✅ Impact calculation and preview
7. ✅ Comprehensive testing and documentation

**Timeline:** 8 weeks from kickoff to production deployment

**Next Steps:**
1. Review and approve this plan
2. Create detailed technical specification documents
3. Begin Phase 1 implementation
4. Set up project tracking and milestones

