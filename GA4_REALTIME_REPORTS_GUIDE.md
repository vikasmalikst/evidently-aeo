# GA4 Real-Time Reports Implementation

## Overview

Real-time reports show data from the last 30 minutes, providing instant insights into current user activity on your website or app.

## Implementation

This implementation mirrors the Python `GA4RealTimeReport` class functionality in TypeScript/Node.js.

### Features

- ✅ Query real-time analytics data
- ✅ Support multiple dimensions and metrics
- ✅ Configurable row limits (up to 100,000)
- ✅ Short-term caching (30 seconds) for performance
- ✅ Flexible dimension/metric selection
- ✅ Structured response format

## API Endpoint

```
GET /api/brands/:brandId/analytics/realtime
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `customer_id` | string | Yes | - | Customer ID |
| `dimensions` | string | No | - | Comma-separated list of dimensions (e.g., `city,country`) |
| `metrics` | string | No | `activeUsers` | Comma-separated list of metrics |
| `limit` | number | No | `10000` | Maximum number of rows to return (1-100,000) |

### Example Request

```bash
# Get active users by city in real-time
curl "http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/realtime?customer_id=YOUR_CUSTOMER_ID&dimensions=city&metrics=activeUsers"

# Get multiple dimensions and metrics
curl "http://localhost:3000/api/brands/YOUR_BRAND_ID/analytics/realtime?customer_id=YOUR_CUSTOMER_ID&dimensions=city,country&metrics=activeUsers,eventCount"
```

### Response Format

```json
{
  "success": true,
  "data": {
    "dimensions": ["city"],
    "metrics": ["activeUsers"],
    "headers": ["city", "activeUsers"],
    "rows": [
      {
        "dimensions": ["New York"],
        "metrics": ["150"],
        "data": {
          "city": "New York",
          "activeUsers": "150"
        }
      },
      {
        "dimensions": ["Los Angeles"],
        "metrics": ["89"],
        "data": {
          "city": "Los Angeles",
          "activeUsers": "89"
        }
      }
    ],
    "totals": [
      {
        "metric": "activeUsers",
        "value": 239
      }
    ],
    "rowCount": 2,
    "timestamp": "2025-01-15T10:30:00.000Z",
    "cached": false,
    "cachedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

## Available Dimensions

Common real-time dimensions:
- `city` - User city
- `country` - User country
- `deviceCategory` - Device type (desktop, mobile, tablet)
- `operatingSystem` - OS name
- `browser` - Browser name
- `eventName` - Event name
- `pagePath` - Page path
- `pageTitle` - Page title
- `source` - Traffic source
- `medium` - Traffic medium

## Available Metrics

Common real-time metrics:
- `activeUsers` - Number of active users (last 30 minutes)
- `eventCount` - Total number of events
- `screenPageViews` - Number of page views
- `conversions` - Number of conversions
- `userEngagementDuration` - Total engagement time

## Code Examples

### TypeScript/Node.js

```typescript
// Using the service directly
import { ga4AnalyticsService } from './services/ga4-analytics.service';

const report = await ga4AnalyticsService.getRealtimeReport(
  'brand-id',
  'customer-id',
  ['city', 'country'], // dimensions
  ['activeUsers', 'eventCount'], // metrics
  10000 // row limit
);

console.log('Active users:', report.totals);
console.log('Rows:', report.rows);
```

### JavaScript/Frontend

```javascript
// Fetch real-time data
const response = await fetch(
  `${API_URL}/api/brands/${brandId}/analytics/realtime?` +
  `customer_id=${customerId}&` +
  `dimensions=city,country&` +
  `metrics=activeUsers,eventCount`
);

const result = await response.json();
if (result.success) {
  const { rows, totals, headers } = result.data;
  // Process real-time data
}
```

### Comparison with Python Implementation

| Feature | Python | TypeScript/Node.js |
|---------|--------|-------------------|
| Class-based | ✅ `GA4RealTimeReport` | ✅ `getRealtimeReport()` function |
| Multiple dimensions | ✅ | ✅ |
| Multiple metrics | ✅ | ✅ |
| Row limit | ✅ | ✅ |
| Caching | ❌ | ✅ (30 seconds) |
| Quota tracking | ✅ | ❌ (can be added) |

## Caching Behavior

- **Cache TTL**: 30 seconds (much shorter than regular reports which use 5 minutes)
- **Cache Key**: Based on dimensions and metrics combination
- **Why**: Real-time data changes frequently, but short caching reduces API calls while keeping data fresh

## Performance Considerations

1. **Limit rows**: Use `limit` parameter to control response size
2. **Cache is enabled**: Responses are cached for 30 seconds to reduce API calls
3. **Quota limits**: Real-time API has separate quota from regular reports
4. **Data freshness**: Data reflects last 30 minutes of activity

## Error Handling

Common errors:
- `GA4 not configured`: Credentials not set up for this brand
- `Invalid dimensions/metrics`: Check GA4 documentation for valid values
- `Quota exceeded`: Too many requests - wait before retrying
- `Property not found`: Verify property_id is correct

## Use Cases

1. **Live Dashboard**: Show current active users
2. **Real-time Monitoring**: Monitor traffic spikes
3. **Event Tracking**: Track events as they happen
4. **Geographic Monitoring**: See where users are coming from right now
5. **A/B Testing**: Monitor test variations in real-time

## Next Steps

- ✅ Real-time reports implemented
- ⏳ Add quota usage tracking (like Python version)
- ⏳ Add filtering capabilities
- ⏳ Add ordering/sorting options
- ⏳ Frontend component for real-time dashboard

