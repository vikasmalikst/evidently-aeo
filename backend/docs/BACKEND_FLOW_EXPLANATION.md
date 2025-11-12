# Complete Backend Flow Explanation for AnswerIntel

## 🏗️ Architecture Overview

The AnswerIntel backend is a Node.js/Express.js service that orchestrates the complete AEO (Answer Engine Optimization) workflow from user authentication through data collection.

**Key Technologies:**
- **Runtime:** Node.js with Express.js framework
- **Language:** TypeScript for type safety
- **Database:** Supabase (PostgreSQL with RLS)
- **Authentication:** JWT tokens
- **AI Services:** OpenAI, Cerebras AI, Anthropic Claude
- **Data Collectors:** Oxylabs, BrightData, DataForSEO

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── app.ts                          # Entry point - Express server setup
│   ├── config/
│   │   ├── database.ts                 # Supabase client configuration
│   │   └── environment.ts              # Environment variables
│   ├── middleware/
│   │   ├── auth.middleware.ts         # JWT authentication
│   │   └── error.middleware.ts        # Error handling
│   ├── routes/
│   │   ├── auth.routes.ts             # POST /api/auth/*
│   │   ├── brand.routes.ts            # POST/GET /api/brands/*
│   │   ├── query-generation.routes.ts # POST /api/query-generation/*
│   │   └── data-collection.routes.ts  # POST /api/data-collection/*
│   ├── services/
│   │   ├── auth.service.ts            # Authentication logic
│   │   ├── brand.service.ts           # Brand management & AI categorization
│   │   ├── query-generation.service.ts # AI query generation
│   │   ├── data-collection.service.ts # Orchestrates collectors
│   │   ├── priority-collector.service.ts # Fallback logic
│   │   ├── anthropic-collector.service.ts # Claude collector
│   │   ├── brightdata-collector.service.ts # BrightData collector
│   │   ├── dataforseo-collector.service.ts # DataForSEO collector
│   │   └── oxylabs-collector.service.ts # Oxylabs collector
│   ├── utils/
│   │   ├── jwt.ts                     # JWT token generation/verification
│   │   └── env-utils.ts               # Environment variable loader
│   └── types/
│       └── auth.ts                    # TypeScript interfaces
```

---

## 🔄 Complete Flow: Authentication → Brand → Query Generation → Data Collection

### PHASE 1: Server Initialization

**File:** `src/app.ts`

**What happens:**
1. **Line 1-15:** Import dependencies (Express, CORS, Helmet, etc.)
2. **Line 17:** Create Express app instance
3. **Line 20-21:** Add Helmet for security headers
4. **Line 23-31:** Setup rate limiting (100 requests per 15 minutes)
5. **Line 34-39:** Configure CORS for frontend (http://localhost:5173)
6. **Line 42-43:** Setup JSON body parser (10MB limit)
7. **Line 46-50:** Setup Morgan logging
8. **Line 53-60:** Health check endpoint `/health`
9. **Line 73-78:** Register route modules:
   - `/api/auth` → authRoutes
   - `/api/brands` → brandRoutes
   - `/api/query-generation` → queryGenerationRoutes
   - `/api/data-collection` → dataCollectionRoutes
10. **Line 99-100:** Error handling middleware (must be last)
11. **Line 104-109:** Start server on configured port

**Key Functions:**
```typescript
app.listen(PORT) // Starts listening on PORT (from env or default)
```

---

### PHASE 2: Authentication Flow

#### 2.1 User Login/Registration

**Route:** `POST /api/auth/login` or `POST /api/auth/register`
**File:** `src/routes/auth.routes.ts` (lines 81-110)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Flow:**
1. **Line 81-92:** Validate email & password are present
2. **Line 93-96:** Call `emailAuthService.login()`
3. **Line 98-101:** Return JWT token and user data

**Functions Called:**
```typescript
// File: src/services/auth.service.ts
createOrUpdateUser() // Creates or updates customer record
generateToken()      // Generates JWT (File: src/utils/jwt.ts)
generateRefreshToken() // Generates refresh token
```

**Database Operations:**
```sql
-- Check if customer exists
SELECT * FROM customers WHERE email = 'user@example.com';

-- If not exists, create:
INSERT INTO customers (id, email, name, slug) VALUES (...);

-- Return customer + tokens
```

---

#### 2.2 JWT Token Generation

**File:** `src/utils/jwt.ts`

**Function:** `generateToken(payload)`
- **Line 8-16:** Signs JWT with secret from environment
- **Payload:** `{ sub: userId, email, customer_id }`
- **Expiration:** 24 hours (configurable)
- **Issuer:** answerintel-backend
- **Audience:** answerintel-frontend

**Function:** `verifyToken(token)`
- **Line 25-42:** Verifies JWT signature and expiration
- **Throws:** AuthError if invalid/expired

---

#### 2.3 Authentication Middleware

**File:** `src/middleware/auth.middleware.ts`

**Function:** `authenticateToken()` (lines 23-77)
- **Line 29:** Extracts token from `Authorization: Bearer <token>` header
- **Line 40:** Verifies token using `verifyToken()`
- **Line 43:** Gets user profile from database
- **Line 54-58:** Attaches user to request object
- **Line 60:** Calls `next()` to proceed to route handler

**Used on routes:**
```typescript
// Example: src/routes/brand.routes.ts
router.post('/', authenticateToken, async (req, res) => {
  // User is authenticated
  const customerId = req.user!.customer_id;
});
```

---

### PHASE 3: Brand Onboarding

#### 3.1 Create Brand

**Route:** `POST /api/brands`
**File:** `src/routes/brand.routes.ts` (lines 13-40)

**Request:**
```json
{
  "brand_name": "Nike",
  "website_url": "https://nike.com",
  "industry": "Apparel",
  "description": "Global athletic brand",
  "aeo_topics": ["Pricing", "Product quality", "Brand history"],
  "competitors": ["Adidas", "Reebok"]
}
```

**Flow:**
1. **Line 13:** Middleware `authenticateToken` ensures user is logged in
2. **Line 16:** Extract brand data from request body
3. **Line 16:** Get customer_id from `req.user.customer_id` (set by middleware)
4. **Line 18:** Call `brandService.createBrand()`

---

#### 3.2 Brand Service - Create Brand

**File:** `src/services/brand.service.ts`

**Function:** `createBrand()` (lines 15-242)

**Step-by-step:**

1. **Line 21:** Validate brand data (name, URL format)
2. **Line 24-32:** Verify customer exists in database
3. **Line 35-44:** Check for duplicate brand (same customer + name)
4. **Line 47-66:** Create brand record in Supabase:
```typescript
const newBrand = await supabaseAdmin
  .from('brands')
  .insert({
    id: brandId,
    customer_id: customerId,
    name: brandData.brand_name,
    slug: brandSlug,
    homepage_url: brandData.website_url,
    ...
  })
```
5. **Line 99-118:** Insert competitors into `brand_competitors` table
6. **Line 164-228:** Insert AEO topics into `brand_topics` table
   - **Line 195-218:** AI categorization with guaranteed fallback:
     ```typescript
     try {
       await this.categorizeTopicsWithAI(brandId, topics);
     } catch (error) {
       await this.categorizeTopicsWithRules(brandId, topics);
     }
     ```

---

#### 3.3 AI Topic Categorization

**File:** `src/services/brand.service.ts`

**Function:** `categorizeTopicsWithAI()` (lines 727-775)

**Flow:**
1. **Line 732-734:** Get API keys (OpenAI or Cerebras)
2. **Line 737-742:** Try Cerebras first (primary)
3. **Line 751-764:** If fails, fallback to OpenAI
4. **Line 768:** If both fail, use rule-based categorization

**Function:** `categorizeWithOpenAI()` (lines 892-960)
- Builds prompt with topics and 4 categories
- Calls OpenAI API
- Parses JSON response
- Updates `brand_topics` table with categories

**Function:** `categorizeWithCerebras()` (lines 780-887)
- Similar to OpenAI but uses Cerebras API
- More robust JSON parsing (multiple extraction methods)

**Function:** `categorizeTopicByRules()` (lines 691-722)
- Rule-based fallback (lines 692-721):
  - Keywords like "brand", "trust" → awareness
  - Keywords like "comparison", "competitor" → comparison
  - Keywords like "pricing", "cost" → purchase
  - Keywords like "support", "complaint" → post-purchase support

---

### PHASE 4: Query Generation

#### 4.1 Generate Queries Request

**Route:** `POST /api/query-generation/seed-queries`
**File:** `src/routes/query-generation.routes.ts` (lines 11-100)

**Request:**
```json
{
  "url": "https://nike.com",
  "locale": "en-US",
  "country": "US",
  "industry": "Apparel",
  "competitors": "Adidas, Reebok",
  "keywords": "athletic shoes",
  "llm_provider": "cerebras",
  "brand_id": "uuid-here",
  "guided_prompts": ["What is Nike's pricing?", "Compare Nike vs Adidas"]
}
```

**Flow:**
1. **Line 26-31:** Validate URL is present
2. **Line 33-38:** Validate LLM provider (cerebras or openai)
3. **Line 41-47:** Get customer_id from authenticated user
4. **Line 50-71:** If no brand_id provided, get first brand for customer
5. **Line 86:** Call `queryGenerationService.generateSeedQueries()`

---

#### 4.2 Query Generation Service

**File:** `src/services/query-generation.service.ts`

**Function:** `generateSeedQueries()` (lines 57-210)

**Step-by-step:**

1. **Line 58-59:** Record start time and generate unique ID
2. **Line 63:** Extract brand name from URL
3. **Line 66-112:** Generate queries using AI:
   ```typescript
   if (provider === 'openai') {
     queries = await this.generateWithOpenAI(...);
   } else if (provider === 'cerebras') {
     queries = await this.generateWithCerebras(...);
   } else {
     // Default to Cerebras as primary
     queries = await this.generateWithCerebras(...);
   }
   ```

**Function:** `generateWithCerebras()` (lines 215-262)
- **Line 226:** Builds comprehensive prompt with:
  - Brand name, industry, competitors
  - Topic list (if provided)
  - Quality standards and forbidden generic queries
- **Line 228-241:** Calls Cerebras API with prompt
- **Line 255:** Parses response into structured queries

**Function:** `generateWithOpenAI()` (lines 425-475)
- Similar to Cerebras but uses OpenAI API
- Uses GPT-3.5-turbo model
- Chat completions format

**Line 115:** Save to database:
```typescript
await this.saveGenerationToDatabase(generationId, request, queries, provider);
```

**Line 121-164:** Validate and deduplicate queries
- Checks topic coverage
- Checks intent distribution (awareness, comparison, purchase, support)
- Removes duplicates

**Line 177-204:** Format response:
```json
{
  "total_queries": 8,
  "queries_by_intent": {
    "awareness": 2,
    "comparison": 2,
    "purchase": 2,
    "support": 2
  },
  "queries": [...]
}
```

---

### PHASE 5: Data Collection

#### 5.1 Execute Data Collection

**Route:** `POST /api/data-collection/execute`
**File:** `src/routes/data-collection.routes.ts` (lines 31-172)

**Request:**
```json
{
  "queryIds": ["What is Nike's pricing?", "Compare Nike vs Adidas"],
  "brandId": "uuid-here",
  "collectors": ["chatgpt", "google_aio", "perplexity", "claude", "baidu", "bing", "gemini"],
  "locale": "en-US",
  "country": "US"
}
```

**Flow:**
1. **Line 41-46:** Validate queryIds array is not empty
2. **Line 48-53:** Validate brandId
3. **Line 89-109:** Create generation record in database
4. **Line 112-134:** Insert queries into `generated_queries` table
5. **Line 139-148:** Build execution requests array
6. **Line 152:** Call `dataCollectionService.executeQueries()`

---

#### 5.2 Data Collection Service

**File:** `src/services/data-collection.service.ts`

**Function:** `executeQueries()` (lines 178-219)

**Flow:**
1. **Line 180:** BATCH_SIZE = 3 (process 3 queries at a time)
2. **Line 185-215:** Process queries in batches:
   ```typescript
   for (let i = 0; i < requests.length; i += BATCH_SIZE) {
     const batch = requests.slice(i, i + BATCH_SIZE);
     await Promise.all(batch.map(request => executeQuery(request)));
   }
   ```
3. **Line 213:** 1-second pause between batches
4. **Line 198:** For each query, calls `executeQueryAcrossCollectors()`

---

#### 5.3 Execute Query Across Collectors

**File:** `src/services/data-collection.service.ts`

**Function:** `executeQueryAcrossCollectors()` (lines 253-334)

**Flow:**
1. **Line 224-247:** Create query execution record in database
2. **Line 258-260:** Filter enabled collectors
3. **Line 263-265:** Call `executeWithPriorityFallback()` for each collector
4. **Line 267:** Use `Promise.allSettled()` to handle failures gracefully

---

#### 5.4 Priority-Based Execution

**File:** `src/services/data-collection.service.ts`

**Function:** `executeWithPriorityFallback()` (lines 336-370)

**Flow:**
1. **Line 338:** Call `priorityCollectorService.executeWithFallback()`
2. This service manages the fallback chain for each collector type

---

#### 5.5 Priority Collector Service

**File:** `src/services/priority-collector.service.ts`

**Function:** `executeWithFallback()` (lines 297-494)

**Flow:**
1. **Line 299-305:** Get collector configuration
2. **Line 307-310:** Get priority providers for this collector type
3. **Line 313-345:** Try each provider in priority order:
   ```typescript
   for (const provider of providers) {
     try {
       result = await this.executeProvider(...);
       break; // Success, stop trying
     } catch (error) {
       // Try next provider
     }
   }
   ```

**Priority Chains for Each Collector:**

**ChatGPT (collector type: 'chatgpt'):**
1. Oxylabs ChatGPT (priority 1, timeout 30s)
2. BrightData ChatGPT (priority 2, timeout 30s) - Disabled
3. OpenAI Direct (priority 3, timeout 30s)

**Google AIO:**
1. Oxylabs Google AIO (priority 1, timeout 45s)
2. BrightData Google AIO (priority 2, timeout 45s)
3. Google AIO Direct (priority 3, timeout 30s)

**Perplexity:**
1. Oxylabs Perplexity (priority 1, timeout 60s)
2. BrightData Perplexity (priority 2, timeout 60s)
3. Perplexity Direct (priority 3, timeout 45s)

**Claude:**
1. DataForSEO Claude (priority 1, timeout 60s)
2. Anthropic Direct (priority 2, timeout 60s)
3. Oxylabs Claude (priority 3, timeout 60s)

**Baidu/Bing:**
1. DataForSEO (priority 1)

**Gemini:**
1. DataForSEO Gemini (priority 1, timeout 45s)
2. Google AIO Direct (priority 2, timeout 30s)
3. Oxylabs Gemini (priority 3, timeout 45s)

---

#### 5.6 Provider Execution

**File:** `src/services/priority-collector.service.ts`

**Function:** `executeProvider()` (lines 496-750)

**Flow:**
1. **Line 500-505:** Create execution metadata
2. **Line 507-742:** Route to specific provider based on name:
   - `oxylabs_*` → `oxylabsCollectorService.execute()`
   - `dataforseo_*` → `dataForSeoCollectorService.execute()`
   - `brightdata_*` → `brightDataCollectorService.execute()`
   - `anthropic_direct` → `anthropicCollectorService.execute()`
   - `openai_direct` → OpenAI API
   - `google_aio_direct` → Google AIO API
   - `perplexity_direct` → Perplexity API

3. **Line 710-741:** Handle success/error, build result object

---

#### 5.7 Store Results

**Functions:** Various provider services

**Example - Oxylabs Collector:**
```typescript
// File: src/services/oxylabs-collector.service.ts
async execute(request) {
  const response = await fetch('https://api.oxylabs.io/v1/queries', {
    body: JSON.stringify({ query: request.queryText })
  });
  
  // Parse response
  // Store in collector_results table
  await supabase.from('collector_results').insert({
    query_id: request.queryId,
    collector_type: 'Oxylabs',
    response: parsedResponse,
    citations: [...],
    urls: [...]
  });
}
```

---

## 📊 Database Tables Used

### Core Tables:
1. **customers** - Customer/tenant records
2. **brands** - Brand profiles
3. **brand_topics** - AEO topics with categories
4. **brand_competitors** - Competitor lists
5. **query_generations** - Query generation batches
6. **generated_queries** - Individual queries
7. **query_executions** - Execution records
8. **collector_results** - Collector responses
9. **onboarding_artifacts** - BrandIntel artifacts

---

## 🔑 Key Functions Summary

### Authentication:
- `generateToken()` - Creates JWT tokens
- `verifyToken()` - Validates JWT tokens
- `authenticateToken()` - Express middleware for auth
- `createOrUpdateUser()` - Creates customer record

### Brand Management:
- `createBrand()` - Creates brand + topics + competitors
- `categorizeTopicsWithAI()` - AI categorization with fallback
- `categorizeTopicByRules()` - Rule-based categorization
- `getBrandTopics()` - Fetches topics for brand

### Query Generation:
- `generateSeedQueries()` - Main entry point
- `generateWithCerebras()` - Cerebras AI integration
- `generateWithOpenAI()` - OpenAI integration
- `buildCerebrasPrompt()` - Creates AI prompt
- `saveGenerationToDatabase()` - Persists queries

### Data Collection:
- `executeQueries()` - Orchestrates query execution
- `executeWithPriorityFallback()` - Manages fallback chain
- `executeProvider()` - Routes to specific provider
- Various collector services execute API calls

---

## 🎯 Complete Request Flow Example

### Example: User generates queries for Nike brand

1. **User logs in** → `POST /api/auth/login`
   - Gets JWT token
   - Returns customer_id

2. **User creates brand** → `POST /api/brands`
   - Creates Nike brand in database
   - Inserts topics: ["Pricing", "Product quality", "Brand history"]
   - AI categorizes topics into 4 categories
   - Stores in brand_topics table

3. **User generates queries** → `POST /api/query-generation/seed-queries`
   - AI generates 8 queries (2 per intent)
   - Queries saved to generated_queries table
   - Returns formatted query list

4. **User executes data collection** → `POST /api/data-collection/execute`
   - For each query:
     - ChatGPT tries Oxylabs → BrightData → OpenAI Direct
     - Google AIO tries Oxylabs → BrightData → Direct
     - Perplexity tries Oxylabs → BrightData → Direct
     - Claude tries DataForSEO → Anthropic → Oxylabs
   - Results stored in collector_results table
   - Returns aggregated results

---

## 🔧 Error Handling

All services use try-catch blocks and throw specific error types:
- `AuthError` - Authentication failures
- `ValidationError` - Input validation failures
- `DatabaseError` - Database operation failures

Errors are caught by `error.middleware.ts` (line 99-100 in app.ts) and returned as JSON responses.

---

## 📝 Environment Variables Required

```bash
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
CEREBRAS_API_KEY=...
CEREBRAS_MODEL=qwen-3-235b-a22b-instruct-2507
ANTHROPIC_API_KEY=...
OXYLABS_API_KEY=...
BRIGHTDATA_API_KEY=...
DATAFORSEO_USERNAME=...
DATAFORSEO_PASSWORD=...
JWT_SECRET=...
```

---

## 🚀 Starting the Backend

```bash
cd backend
npm install
npm run dev  # Development mode with hot reload
```

Server starts on port 8001 by default (or PORT from .env).

---

This completes the entire backend flow from authentication through data collection!
