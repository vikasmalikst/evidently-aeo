# Prompt Management Services

This module provides a complete versioning and management system for brand prompts.

## Overview

The prompt management system allows users to:
- Create, read, update, and delete prompts
- Track changes through versioning
- Preview impact of changes before applying
- Revert to previous configurations
- Compare different versions

## Architecture

### Service Structure

```
prompt-management/
├── index.ts                      # Central exports
├── types.ts                      # TypeScript interfaces
├── utils.ts                      # Utility functions
├── prompt-crud.service.ts        # Basic CRUD operations
├── prompt-versioning.service.ts  # Version management
├── prompt-metrics.service.ts     # Metrics calculation
├── prompt-impact.service.ts      # Impact estimation
└── prompt-comparison.service.ts  # Version comparison
```

### Data Flow

```
User Action → API Endpoint → Service Layer → Database
                                  ↓
                          Side Effects (metrics, logging)
```

## Services

### PromptCrudService

Handles basic CRUD operations for prompts.

**Methods:**
- `getActivePrompts(brandId, customerId)` - Fetch all active prompts
- `addPrompt(brandId, customerId, text, topic, metadata)` - Create prompt
- `updatePrompt(promptId, brandId, customerId, updates)` - Edit prompt
- `archivePrompt(promptId, brandId, customerId, archivedBy)` - Soft delete
- `deletePrompt(promptId, brandId, customerId)` - Hard delete
- `restorePrompt(promptId, brandId, customerId)` - Unarchive
- `getArchivedVersions(brandId)` - Fetch archived snapshots from `archived_topics_prompts`
- `saveConfigV2Rows(brandId, customerId, rows, deleteIds)` - Bulk save with auto-archiving

### Archiving System (V2)

The system maintains a historical record of all topic and prompt configurations in the `archived_topics_prompts` table.

#### Schema: `archived_topics_prompts`
- `id`: UUID (PK)
- `topic_id`: UUID (FK to `brand_topics`)
- `topic_name`: TEXT
- `prompts`: JSONB (Array of objects: `{id, query_text, locale, country, metadata, created_at}`)
- `version_tag`: TEXT (e.g., "V1", "V2")
- `brand_id`: UUID (FK to `brands`)
- `created_at`: TIMESTAMP

#### Archiving Flow:
1. When `saveConfigV2Rows` is called, the system identifies which topics are being modified or deleted.
2. For each affected topic, it fetches the current active prompts from `generated_queries`.
3. It creates an archive record in `archived_topics_prompts` with the current state and the current version tag (from `brand_topics.version`).
4. It increments the `version` in `brand_topics` for the affected topics.
5. It applies the updates/inserts/deletes to `brand_topics` and `generated_queries`.

### API Endpoints (V2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/brands/:brandId/prompts/config-v2` | Get current active topics and prompts |
| POST | `/brands/:brandId/prompts/config-v2` | Save changes (updates/inserts/deletes) and trigger archiving |
| GET | `/brands/:brandId/prompts/config-v2/archived` | Get all archived snapshots for a brand |

**Example:**
```typescript
import { promptCrudService } from './prompt-management'

// Get all prompts
const prompts = await promptCrudService.getActivePrompts(brandId, customerId)

// Add a prompt
const { promptId } = await promptCrudService.addPrompt(
  brandId,
  customerId,
  'What are the key features?',
  'Product Features'
)
```

### PromptVersioningService

Manages version creation and history.

**Methods:**
- `getCurrentVersion(brandId, customerId)` - Get active version
- `getVersionHistory(brandId, customerId)` - Get all versions
- `getVersionDetails(brandId, customerId, version)` - Get version snapshots
- `createInitialVersion(brandId, customerId, createdBy)` - Create Version 1
- `createNewVersion(brandId, customerId, changes, summary, createdBy)` - New version
- `revertToVersion(brandId, customerId, targetVersion, revertedBy)` - Revert

**Example:**
```typescript
import { promptVersioningService } from './prompt-management'

// Create initial version (during onboarding)
const v1 = await promptVersioningService.createInitialVersion(
  brandId,
  customerId,
  userId
)

// Apply changes and create new version
const changes = {
  added: [{ text: 'New prompt', topic: 'Features' }],
  removed: [{ id: 'uuid', text: 'Old prompt' }],
  edited: [{ id: 'uuid', oldText: 'Old', newText: 'New' }]
}

const v2 = await promptVersioningService.createNewVersion(
  brandId,
  customerId,
  changes,
  'Added security prompts',
  userId
)

// Revert to previous version
const v3 = await promptVersioningService.revertToVersion(
  brandId,
  customerId,
  1, // target version
  userId
)
```

### PromptMetricsService

Calculates and stores metrics for versions.

**Methods:**
- `calculateAndStoreMetrics(configId, brandId, customerId)` - Calculate metrics
- `getMetrics(configurationId)` - Fetch metrics
- `recalculateMetrics(configId, brandId, customerId)` - Recalculate
- `incrementAnalysesCount(configurationId)` - Update count

**Example:**
```typescript
import { promptMetricsService } from './prompt-management'

// Calculate metrics after version creation
const metrics = await promptMetricsService.calculateAndStoreMetrics(
  configurationId,
  brandId,
  customerId
)

console.log({
  prompts: metrics.totalPrompts,
  topics: metrics.totalTopics,
  coverage: metrics.coverageScore,
  visibility: metrics.avgVisibilityScore,
  sentiment: metrics.avgSentimentScore
})
```

### PromptImpactService

Estimates impact of pending changes.

**Methods:**
- `calculateImpact(brandId, customerId, changes)` - Estimate impact

**Example:**
```typescript
import { promptImpactService } from './prompt-management'

const changes = {
  added: [{ text: 'New prompt', topic: 'Security' }],
  removed: [],
  edited: []
}

const impact = await promptImpactService.calculateImpact(
  brandId,
  customerId,
  changes
)

console.log({
  coverage: impact.coverage, // current vs projected
  topicChanges: impact.topicCoverage, // increased/decreased topics
  warnings: impact.warnings, // potential issues
  affectedAnalyses: impact.affectedAnalyses
})
```

### PromptComparisonService

Compares two versions.

**Methods:**
- `compareVersions(brandId, customerId, v1, v2)` - Compare versions
- `getRevertChanges(brandId, customerId, targetVersion)` - Preview revert

**Example:**
```typescript
import { promptComparisonService } from './prompt-management'

const comparison = await promptComparisonService.compareVersions(
  brandId,
  customerId,
  1, // version 1
  3  // version 3
)

console.log({
  added: comparison.changes.added,
  removed: comparison.changes.removed,
  edited: comparison.changes.edited,
  metrics: comparison.metricsComparison
})
```

## Types

### Key Interfaces

```typescript
// Managed prompt with all metadata
interface ManagedPrompt {
  id: string
  queryId: string
  text: string
  topic: string
  response: string | null
  sentiment: number | null
  visibilityScore: number | null
  volumeCount: number
  keywords: {
    brand: string[]
    products: string[]
    keywords: string[]
    competitors: string[]
  }
  isActive: boolean
  collectorTypes: string[]
}

// Configuration version
interface PromptConfiguration {
  id: string
  brandId: string
  customerId: string
  version: number
  isActive: boolean
  changeType: ChangeType
  changeSummary: string | null
  createdAt: string
}

// Pending changes
interface PendingChanges {
  added: Array<{ text: string; topic: string }>
  removed: Array<{ id: string; text: string }>
  edited: Array<{ id: string; oldText: string; newText: string }>
}
```

See `types.ts` for complete interface definitions.

## Utility Functions

### Common Utilities

```typescript
import {
  determineChangeType,
  generateChangeSummary,
  calculatePercentChange,
  calculateCoverageScore,
  slugify,
  roundToPrecision
} from './utils'

// Determine change type from pending changes
const changeType = determineChangeType(changes)
// Returns: 'prompt_added' | 'prompt_removed' | 'prompt_edited' | 'bulk_update'

// Generate human-readable summary
const summary = generateChangeSummary(changes)
// Returns: "Added 3 prompts, Removed 1 prompt, Edited 2 prompts"

// Calculate percentage change
const percent = calculatePercentChange(oldValue, newValue)

// Calculate coverage score
const coverage = calculateCoverageScore(promptCount, topicCount)

// Create slug from string
const topicId = slugify('Product Features') // 'product-features'

// Round to precision
const rounded = roundToPrecision(123.456, 2) // 123.46
```

## Database Schema

### Tables

1. **prompt_configurations** - Version metadata
2. **prompt_configuration_snapshots** - Prompt snapshots per version
3. **prompt_change_log** - Detailed change audit trail
4. **prompt_metrics_snapshots** - Metrics for each version

### Key Relationships

```
prompt_configurations (1) ─┬─ (N) prompt_configuration_snapshots
                            ├─ (N) prompt_change_log
                            └─ (1) prompt_metrics_snapshots

generated_queries (1) ─── (N) prompt_configuration_snapshots
```

## API Integration

### Calling from Routes

```typescript
import { promptCrudService, promptVersioningService } from '../services/prompt-management'

// In route handler
router.post('/brands/:brandId/prompts/batch', async (req, res) => {
  try {
    const { brandId } = req.params
    const { changes } = req.body
    const customerId = req.user?.customerId

    const newVersion = await promptVersioningService.createNewVersion(
      brandId,
      customerId,
      changes,
      req.body.changeSummary,
      req.user?.userId
    )

    return res.json({
      success: true,
      data: { newVersion: newVersion.version }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    })
  }
})
```

## Error Handling

All services throw `DatabaseError` on failure. Always wrap calls in try-catch:

```typescript
try {
  const result = await promptCrudService.getActivePrompts(brandId, customerId)
  // Handle success
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database error:', error.message)
  }
  // Handle error
}
```

## Testing

### Unit Test Example

```typescript
import { promptVersioningService } from './prompt-versioning.service'

describe('PromptVersioningService', () => {
  it('should create initial version', async () => {
    const version = await promptVersioningService.createInitialVersion(
      'brand-id',
      'customer-id',
      'user-id'
    )

    expect(version.version).toBe(1)
    expect(version.isActive).toBe(true)
    expect(version.changeType).toBe('initial_setup')
  })
})
```

## Performance Considerations

### Optimizations

1. **Batch Operations**: Use `batch` endpoint instead of multiple individual calls
2. **Metrics Caching**: Metrics are cached in `prompt_metrics_snapshots`
3. **Lazy Loading**: Snapshots are only loaded when viewing specific versions
4. **Indexes**: All foreign keys and frequently queried columns are indexed

### Scaling Tips

- For brands with >100 prompts, consider pagination
- Metrics calculation can be async for large datasets
- Version history can be archived after 1 year

## Best Practices

### 1. Always Use Transactions
The versioning service handles transactions internally. Don't mix direct DB calls.

### 2. Validate Input
Always validate changes before calling services:

```typescript
if (!changes.added || !Array.isArray(changes.added)) {
  throw new Error('Invalid changes format')
}
```

### 3. Log Important Actions
Services log to change_log table. For additional logging:

```typescript
console.log(`Creating version for brand ${brandId}`, {
  changes,
  userId
})
```

### 4. Handle Edge Cases
- Empty changes
- Non-existent prompts
- Concurrent updates
- Missing permissions

## Troubleshooting

### Common Issues

**Issue:** Version creation fails
**Solution:** Check if current version exists and is active

**Issue:** Metrics not calculating
**Solution:** Ensure `collector_results` and `extracted_positions` have data

**Issue:** Revert not working
**Solution:** Verify target version exists and has snapshots

## Migration Guide

### From Mock Data

1. Remove mock data imports:
```typescript
// Remove this:
import { mockPromptsData } from './data/mockPromptsData'

// Add this:
import { promptCrudService } from './services/prompt-management'
```

2. Update data fetching:
```typescript
// Old:
const prompts = mockPromptsData

// New:
const result = await promptCrudService.getActivePrompts(brandId, customerId)
const prompts = result.topics.flatMap(t => t.prompts)
```

3. Connect version management:
```typescript
const history = await promptVersioningService.getVersionHistory(brandId, customerId)
```

## Future Enhancements

Planned features:
- [ ] Bulk import/export
- [ ] Prompt templates library
- [ ] AI-powered suggestions
- [ ] A/B testing support
- [ ] Collaborative editing
- [ ] Advanced analytics

## Support

For issues or questions:
1. Check service code comments
2. Review type definitions
3. Examine test cases
4. Consult main documentation

---

**Version:** 1.0.0
**Last Updated:** November 18, 2025
**Maintainer:** Development Team

