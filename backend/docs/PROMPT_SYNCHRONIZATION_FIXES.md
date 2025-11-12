# OpenAI vs Cerebras Prompt Comparison & Synchronization

## Issues Identified

### **Prompt Format Differences**
The `buildCerebrasPrompt` function had **significantly different** prompt guidance compared to the OpenAI prompt, which could lead to inconsistent query generation quality.

### **Missing Enhanced Features**
The Cerebras prompt was missing several key improvements we added to the OpenAI prompt:
- Enhanced forbidden queries list
- Improved uniqueness requirements
- Better JSON response format
- Stronger topic-specific generation rules

## Comparison Analysis

### **Before Synchronization:**

#### **OpenAI Prompt (Enhanced):**
```typescript
QUALITY STANDARDS:
- NEVER use generic queries like "What is [brand]?" or "How does [brand] work?"
- Include specific product names, features, or use cases
- Use question formats that indicate real user intent
- Include comparison queries with specific competitors
- Add location-specific queries when relevant
- Include troubleshooting and support queries
- Make each query unique and specific to the brand and industry
- Use real-world search patterns and user language

FORBIDDEN GENERIC QUERIES:
- "What is [brand] and how does it work?"
- "Benefits and features of [brand]"
- "Introduction to [brand] for beginners"
- Any generic template queries

REQUIRED: Generate specific, brand-focused queries that real users would search for.

Return as JSON array with exactly one query per topic. Format:
[
  {
    "topic": "Topic Name",
    "query": "Specific query for this topic only",
    "intent": "awareness|comparison|purchase|support",
    "priority": 1
  }
]

CRITICAL: Return exactly one query per topic. No duplicates across topics.
```

#### **Cerebras Prompt (Outdated):**
```typescript
QUALITY STANDARDS:
- Avoid generic queries like "What is [brand]?"
- Include specific product names, features, or use cases
- Use question formats that indicate real user intent
- Include comparison queries with specific competitors
- Add location-specific queries when relevant
- Include troubleshooting and support queries

Format your response as a JSON array where each query has:
- "query": "The actual search query"
- "intent": "awareness|comparison|purchase|support"
- "topic": "Brief topic description"
- "priority": 1-5 (1 being highest priority)

Generate exactly ${topics.length > 0 ? topics.length * 2 : 8} completely unique queries in JSON format.
```

### **Key Differences:**

| Feature | OpenAI (Enhanced) | Cerebras (Old) | Impact |
|---------|------------------|----------------|---------|
| **Forbidden Queries** | ✅ Explicit list with examples | ❌ Generic "avoid" statement | **High** - Cerebras could generate generic queries |
| **Uniqueness Requirements** | ✅ Detailed uniqueness rules | ❌ Basic "unique queries" | **High** - Cerebras could generate duplicates |
| **JSON Format** | ✅ Exact format specification | ❌ Vague format description | **Medium** - Inconsistent response parsing |
| **Topic-Specific Rules** | ✅ Detailed topic rules | ✅ Same rules | **Low** - Both had this |
| **Response Validation** | ✅ "Exactly one query per topic" | ❌ "Generate exactly X queries" | **High** - Cerebras could generate wrong count |

## Solutions Implemented

### **1. Synchronized Quality Standards**
```typescript
// OLD Cerebras
QUALITY STANDARDS:
- Avoid generic queries like "What is [brand]?"

// NEW Cerebras (matches OpenAI)
QUALITY STANDARDS:
- NEVER use generic queries like "What is [brand]?" or "How does [brand] work?"
- Include specific product names, features, or use cases
- Use question formats that indicate real user intent
- Include comparison queries with specific competitors
- Add location-specific queries when relevant
- Include troubleshooting and support queries
- Make each query unique and specific to the brand and industry
- Use real-world search patterns and user language
```

### **2. Added Forbidden Queries List**
```typescript
// NEW Cerebras (matches OpenAI)
FORBIDDEN GENERIC QUERIES:
- "What is [brand] and how does it work?"
- "Benefits and features of [brand]"
- "Introduction to [brand] for beginners"
- Any generic template queries

REQUIRED: Generate specific, brand-focused queries that real users would search for.
```

### **3. Enhanced JSON Response Format**
```typescript
// OLD Cerebras
Format your response as a JSON array where each query has:
- "query": "The actual search query"
- "intent": "awareness|comparison|purchase|support"
- "topic": "Brief topic description"
- "priority": 1-5 (1 being highest priority)

// NEW Cerebras (matches OpenAI)
Return as JSON array with exactly one query per topic. Format:
[
  {
    "topic": "Topic Name",
    "query": "Specific query for this topic only",
    "intent": "awareness|comparison|purchase|support",
    "priority": 1
  }
]

CRITICAL: Return exactly one query per topic. No duplicates across topics.
```

### **4. Enhanced Query Diversity Requirements**
```typescript
// NEW Cerebras (matches OpenAI)
QUERY DIVERSITY REQUIREMENTS:
- Generate completely unique queries - avoid any repetition or similarity
- Each query should target a different aspect of the brand
- Use different query structures and keywords for each query
- Ensure queries are distinct and don't overlap in content or intent
- Cover different user intents: informational, navigational, transactional, commercial
- NEVER use generic fallback queries like "What is [brand] and how does it work?"
- Make each query specific to the brand's products, services, or industry
- Use real user search patterns and language

CRITICAL: Generate ONLY specific, brand-focused queries. Do not use any generic templates or fallback queries.
```

## Expected Results

### **Before Synchronization:**
- ❌ **Inconsistent Quality**: OpenAI generated better queries than Cerebras
- ❌ **Different Formats**: Different JSON response structures
- ❌ **Generic Queries**: Cerebras could fall back to generic queries
- ❌ **Duplicate Risk**: Cerebras had weaker uniqueness requirements

### **After Synchronization:**
- ✅ **Consistent Quality**: Both providers generate the same quality queries
- ✅ **Unified Format**: Same JSON response structure
- ✅ **No Generic Queries**: Both providers forbid generic queries
- ✅ **Strong Uniqueness**: Both providers enforce uniqueness requirements

## Provider Usage

### **Current Setup:**
- **Primary Provider**: OpenAI (GPT-4o-mini)
- **Fallback Provider**: Cerebras AI
- **Last Resort**: Guided queries (if both AI providers fail)

### **Why Both Providers:**
1. **Redundancy**: If OpenAI fails, Cerebras provides backup
2. **Cost Optimization**: Cerebras might be cheaper for some use cases
3. **Performance**: Different providers might have different response times
4. **Reliability**: Multiple providers reduce single points of failure

## Testing Recommendations

### **Test Both Providers:**
```bash
# Test OpenAI (primary)
curl -X POST http://localhost:3000/api/query-generation/seed-queries \
  -H "Content-Type: application/json" \
  -d '{"llm_provider": "openai", "topics": ["Topic1", "Topic2"]}'

# Test Cerebras (fallback)
curl -X POST http://localhost:3000/api/query-generation/seed-queries \
  -H "Content-Type: application/json" \
  -d '{"llm_provider": "cerebras", "topics": ["Topic1", "Topic2"]}'
```

### **Expected Results:**
- ✅ Both providers generate exactly 1 query per topic
- ✅ Both providers avoid generic queries
- ✅ Both providers return consistent JSON format
- ✅ Both providers enforce uniqueness requirements

## Configuration Changes

### **Cerebras Prompt Updates:**
```typescript
// Enhanced quality standards (matches OpenAI)
// Added forbidden queries list
// Improved JSON response format
// Enhanced uniqueness requirements
// Better query diversity rules
```

### **Consistency Achieved:**
- ✅ **Same Quality Standards**: Both providers use identical quality requirements
- ✅ **Same Forbidden Queries**: Both providers forbid the same generic queries
- ✅ **Same JSON Format**: Both providers return identical response structure
- ✅ **Same Uniqueness Rules**: Both providers enforce identical uniqueness requirements

## Performance Impact

### **Query Quality:**
- **Before**: OpenAI > Cerebras (inconsistent quality)
- **After**: OpenAI = Cerebras (consistent quality)
- **Improvement**: Unified high-quality query generation

### **System Reliability:**
- **Before**: Fallback provider could generate inferior queries
- **After**: Fallback provider generates same quality as primary
- **Improvement**: More reliable fallback system

### **User Experience:**
- **Before**: Inconsistent results depending on provider
- **After**: Consistent results regardless of provider
- **Improvement**: Predictable, high-quality query generation

The system now ensures **consistent, high-quality query generation** regardless of which AI provider is used!
