# Cerebras API Response Captures

This directory contains raw Cerebras API responses captured for JSON parsing analysis.

## Purpose

The test script captures actual LLM outputs to help identify and fix JSON parsing issues.

## File Format

Each JSON file contains:
```json
{
  "metadata": {
    "brand": "Brand name tested",
    "timestamp": "ISO timestamp",
    "parseStrategy": "Which strategy successfully parsed the JSON",
    "parseError": "Error message if parsing failed",
    "success": true/false,
    "rawTextLength": "Length of raw response",
    "competitorsExtracted": "Number of competitors found"
  },
  "rawCerebrasResponse": "The exact text returned by Cerebras",
  "parsedResult": "The result after JSON extraction",
  "finalResult": {
    "brand": { /* brand intel */ },
    "competitors": [ /* competitor array */ ]
  }
}
```

## How to Use

### Setup

You have two options to configure your Cerebras API key:

**Option 1: Set API key in the script file (Quick & Easy)**
1. Open `backend/scripts/test-cerebras-response.js`
2. Set your API key at the top:
   ```javascript
   const CEREBRAS_API_KEY = "your-api-key-here";
   const CEREBRAS_MODEL = "llama3.1-8b"; // Optional
   ```

**Option 2: Use .env file**
1. Set `CEREBRAS_API_KEY` in `backend/.env`
2. Optionally set `CEREBRAS_MODEL`

### Run the test

```bash
cd backend
node scripts/test-cerebras-response.js
```

Review the generated JSON files to:
1. See what Cerebras is actually returning
2. Identify common malformed JSON patterns
3. Improve the parsing strategies in `onboarding-intel.service.ts`

## Adding More Test Cases

Edit `test-cerebras-response.js` and add brands to the `testBrands` array:
```javascript
const testBrands = [
  "Levi's",
  "Nike",
  "Apple",
  // Add more...
];
```

