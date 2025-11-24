# Topics Query Generation Service - Explanation

## 📋 What It Does

The `TopicsQueryGenerationService` is responsible for **generating AEO (Answer Engine Optimization) topics and search queries** for a brand during the onboarding process.

## 🎯 Purpose

When a customer onboards with their brand, this service:
1. **Generates relevant topics** that users might search for related to the brand
2. **Creates natural-language queries** (questions users would type) for each topic
3. **Organizes topics by intent archetypes** (how users search)
4. **Prioritizes topics** based on relevance and business value

## 🔄 How It Works

### Input (What It Needs)
- **Brand Name**: e.g., "Stripe"
- **Industry**: e.g., "Financial Technology"
- **Competitors**: e.g., ["PayPal", "Square"]
- **Description**: Brand description (optional)
- **Max Topics**: How many topics to generate (default: 20, max: 50)

### Process

1. **Determines Primary Domain**
   - Identifies the brand's main area of value (product category, service, content domain, etc.)
   - Example: For "Stripe" → "Payment processing and financial infrastructure"

2. **Generates Topics by Intent Archetypes**
   - Uses 10 intent archetypes to categorize how users search:
     - `best_of` - Finding the best option
     - `comparison` - Comparing options
     - `alternatives` - Looking for alternatives
     - `pricing_or_value` - Price/value questions
     - `use_case` - Specific use cases
     - `how_to` - How-to questions
     - `problem_solving` - Problem-solving queries
     - `beginner_explain` - Beginner explanations
     - `expert_explain` - Expert explanations
     - `technical_deep_dive` - Technical deep dives

3. **Creates Queries for Each Topic**
   - Generates natural-language questions users would ask
   - **Critical**: Queries do NOT include the brand name (neutral, user-focused)
   - Example Topic: "Payment processing integration"
   - Example Query: "How do I integrate payment processing into my website?"

4. **Prioritizes Topics**
   - Assigns priority scores (1-5) based on:
     - Relevance to brand's primary domain
     - Likely user search volume
     - Business value potential

5. **Filters to Top Topics**
   - Ranks by priority
   - Returns top N topics (default: 20)

### Output (What It Returns)

```typescript
{
  primaryDomain: "Payment processing and financial infrastructure",
  topics: [
    {
      intentArchetype: "how_to",
      topic: "Payment integration setup",
      description: "Steps to integrate payment processing...",
      query: "How do I integrate payment processing into my website?",
      priority: 5
    },
    {
      intentArchetype: "comparison",
      topic: "Payment processor comparison",
      description: "Comparing different payment processors...",
      query: "Which payment processor has the lowest fees?",
      priority: 4
    },
    // ... more topics
  ]
}
```

## 🔌 API Used

- **Provider**: Cerebras
- **API Key**: `CEREBRAS_API_KEY` (generic, not numbered)
- **Model**: `qwen-3-235b-a22b-instruct-2507`
- **Endpoint**: `https://api.cerebras.ai/v1/chat/completions`

## 📍 Where It's Used

1. **Brand Onboarding Flow** (`/onboarding/topics` endpoint)
   - Called when generating topics for a new brand
   - Creates topics that will be used for data collection

2. **Query Generation**
   - The queries generated here become the prompts sent to AI collectors
   - Each query is executed across selected collectors (ChatGPT, Claude, Gemini, etc.)

3. **Brand Settings**
   - Topics can be managed in brand settings
   - New topics can be generated and added

## 🎨 Example Flow

```
User onboards with brand "Stripe"
  ↓
TopicsQueryGenerationService.generateTopicsAndQueries()
  ↓
Generates 20 topics like:
  - "Payment integration setup" (query: "How do I integrate payments?")
  - "Payment processor fees" (query: "Which payment processor has lowest fees?")
  - "Stripe vs PayPal" (query: "What are the differences between payment processors?")
  ↓
Topics stored in database (brand_topics table)
Queries stored in database (generated_queries table)
  ↓
Data collection runs these queries against AI collectors
  ↓
Results analyzed and displayed in dashboard
```

## 🔑 Key Features

1. **Intent-Based Organization**: Topics organized by how users search
2. **Brand-Neutral Queries**: Queries don't mention brand name (for better search results)
3. **Priority Ranking**: Most relevant topics ranked first
4. **Flexible Count**: Generates 3-7 topics per intent (not fixed)
5. **Quality Over Quantity**: Filters to top 15-20 most relevant topics

## 🆚 Difference from Scoring Services

**This service is NOT a scoring service** - it's a **generation service** that:
- Runs **during onboarding** (once per brand)
- Creates topics and queries **before** data collection
- Uses generic `CEREBRAS_API_KEY` (not numbered)

**Scoring services** run **after** data collection and use numbered keys:
- Position Extraction (KEY_1)
- Sentiment Scoring (KEY_2)
- Citation Categorization (KEY_3)

