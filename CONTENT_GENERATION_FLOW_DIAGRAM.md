# Content Generation Flow Diagram

## Visual Flow Map

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRY POINT                                   │
│              /improve/discover                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   DiscoverPage Component      │
         │   (src/pages/Improve/)        │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   RecommendationsV3 Component │
         │   (3,629 lines - TOO LARGE!)  │
         │   initialStep={1}             │
         └───────────────┬───────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────┐
    │         STEP 1: DISCOVER                   │
    │         (Generate & Review)               │
    └────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│ Fetch Recs      │            │ User Actions    │
│ by Step 1       │            │                 │
│                 │            │ • Approve       │
│ Filter by:      │            │ • Reject        │
│ - pending       │            │ • Remove        │
│ - approved      │            │                 │
│ - rejected      │            │                 │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   PATCH /status                │
         │   Backend Updates:            │
         │   - review_status              │
         │   - is_approved                │
         └───────────────┬───────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────┐
    │         STEP 2: CONTENT GENERATION         │
    │         (Two-Phase Workflow)              │
    └────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│ PHASE 2A:           │        │ PHASE 2B:           │
│ Generate Plan        │        │ Generate Content    │
│                      │        │                     │
│ User clicks          │        │ User approves plan  │
│ "Generate Plan"      │        │                     │
└──────────┬───────────┘        └──────────┬──────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│ POST /generate-plan │        │ POST /generate-     │
│                      │        │   content/step2     │
│ • Fetch rec + brand  │        │                     │
│ • Check cache        │        │ • Fetch rec + brand│
│ • Build skeleton     │        │ • Build drafter     │
│ • Call LLM           │        │   prompt            │
│   (llama-3.3-70b)    │        │ • Call LLM          │
│ • Parse TemplatePlan │        │   (llama-3.3-70b)   │
│ • Save to DB         │        │ • Parse JSON v4.0   │
│   (content_type=     │        │ • Save to DB        │
│    'template_plan')  │        │   (content_type=    │
│                      │        │    'article')       │
└──────────┬───────────┘        └──────────┬──────────┘
           │                               │
           ▼                               ▼
┌─────────────────────┐        ┌─────────────────────┐
│ Plan Review Modal   │        │ Content Generated   │
│                      │        │                     │
│ • Display structure  │        │ • is_content_      │
│ • Edit sections      │        │   generated = true  │
│ • Upload context     │        │ • Moves to Step 3   │
│ • Quick notes        │        │                     │
│ • Approve/Reject     │        │                     │
└─────────────────────┘        └─────────────────────┘
           │
           │ (User approves)
           │
           └───────────────────┐
                               │
                               ▼
    ┌────────────────────────────────────────────┐
    │         STEP 3: REFINE                     │
    │         (Review & Edit)                   │
    └────────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│ Display Content │            │ User Actions    │
│                 │            │                 │
│ • Sections      │            │ • Edit sections │
│ • AEO Score     │            │ • Regenerate    │
│ • SEO Score     │            │ • Complete      │
└────────┬────────┘            └────────┬────────┘
         │                               │
         └───────────────┬───────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   PATCH /complete              │
         │   Backend:                     │
         │   - Captures KPI values        │
         │   - Sets is_completed = true   │
         │   - Stores kpi_before_value    │
         └───────────────┬───────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────────┐
    │         STEP 4: OUTCOME TRACKER            │
    │         (Impact Measurement)              │
    └────────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────┐
         │   Display Before/After KPIs   │
         │   • kpi_before_value           │
         │   • kpi_after_value            │
         │   • Benchmark metrics           │
         └───────────────────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE TABLES                            │
└─────────────────────────────────────────────────────────────┘

recommendations
├── id
├── generation_id
├── brand_id
├── customer_id
├── action
├── citation_source
├── kpi_id
├── review_status (pending_review | approved | rejected)
├── is_approved (boolean)
├── is_content_generated (boolean)
├── is_completed (boolean)
├── kpi_before_value
├── kpi_after_value
└── metadata (JSON)

recommendation_generated_contents
├── id
├── recommendation_id
├── generation_id
├── brand_id
├── customer_id
├── content_type (template_plan | article | draft | cold_start_guide)
├── content (JSON string)
├── status (generated | accepted | rejected)
├── model_provider (openrouter | cerebras | ollama)
├── model_name
└── metadata (JSON)

recommendation_v3_kpis
├── id
├── generation_id
├── kpi_name
├── kpi_description
├── current_value
├── target_value
└── display_order
```

## API Endpoints Map

```
Frontend → Backend API Flow:

STEP 1 (Discover):
  GET  /recommendations-v3/:generationId/steps/1?reviewStatus=...
  PATCH /recommendations-v3/:recommendationId/status

STEP 2A (Generate Plan):
  POST /recommendations-v3/:recommendationId/generate-plan
  PUT  /recommendations-v3/:recommendationId/template-plan
  POST /recommendations-v3/:recommendationId/upload-context (file/text)
  DELETE /recommendations-v3/:recommendationId/context/:fileId

STEP 2B (Generate Content):
  POST /recommendations-v3/:recommendationId/generate-content/step2
  POST /recommendations-v3/generate-content-bulk (legacy path)

STEP 3 (Refine):
  GET  /recommendations-v3/:recommendationId/content
  POST /recommendations-v3/:recommendationId/content/save-sections
  POST /recommendations-v3/:recommendationId/regenerate
  PATCH /recommendations-v3/:recommendationId/complete

STEP 4 (Outcome):
  GET  /recommendations-v3/:generationId/steps/4
```

## LLM Provider Flow

```
Content Generation Provider Selection:

┌─────────────────────────────────────┐
│  Step 2A: Generate Plan              │
│  ───────────────────────────────────  │
│  Provider: OpenRouter                │
│  Model: meta-llama/llama-3.3-70b     │
│  MaxTokens: 1500                     │
│  Temperature: 0.4                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Step 2B: Generate Content           │
│  ───────────────────────────────────  │
│  Provider: OpenRouter                │
│  Model: meta-llama/llama-3.3-70b     │
│  MaxTokens: 3000                     │
│  Temperature: 0.5                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Legacy Path (generateContent)      │
│  ───────────────────────────────────  │
│  Try: Cerebras (primary)             │
│  Fallback: OpenRouter                │
│  Fallback: Ollama (if enabled)       │
└─────────────────────────────────────┘
```

## State Management Flow

```
RecommendationsV3 Component State:

┌─────────────────────────────────────┐
│  Core State                         │
│  • currentStep (1-4)                │
│  • generationId                    │
│  • recommendations[]                │
│  • allRecommendations[]             │
│  • selectedIds Set                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Content State                       │
│  • contentMap Map<recId, content>    │
│  • guideMap Map<recId, guide>        │
│  • refinedContent Map<recId, content>│
│  • customizedStructures Map         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Plan State                          │
│  • currentPlan (TemplatePlan)        │
│  • isPlanModalOpen                   │
│  • isProcessingPlan                  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  UI State                            │
│  • expandedRecId                     │
│  • editingId                         │
│  • generatingContentIds Set          │
│  • refiningIds Set                   │
│  • savingIds Set                     │
└─────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────┐
│  LLM Call                            │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────┐    ┌──────────┐
│ Success  │    │ Failure  │
└────┬─────┘    └────┬─────┘
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Parse    │    │ Retry?   │
│ JSON     │    │          │
└────┬─────┘    └────┬─────┘
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Validate │    │ Error    │
│ Schema   │    │ Message  │
└────┬─────┘    └────┬─────┘
     │               │
     ▼               ▼
┌──────────┐    ┌──────────┐
│ Save DB  │    │ Show UI  │
└──────────┘    └──────────┘
```

---

**End of Flow Diagram**
