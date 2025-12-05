# Product Extraction Prompt Refinement Request for ChatGPT

## Project Overview

I'm working on a **brand intelligence and competitive analysis platform** called Evidently. The system analyzes search results and text content to track brand mentions, competitor mentions, and product mentions. 

**Key Use Case:**
- We collect answers/responses from various sources (web scraping, APIs, etc.)
- We need to identify where specific brands and their products are mentioned in text
- We use this data to calculate brand visibility, share of voice, and competitive positioning
- Product names are critical because they help us track not just brand mentions, but specific product mentions (e.g., "Excedrin Migraine" vs just "Excedrin")

## Current Problem

Our product extraction prompt is generating **incorrect product names** that are not commercially associated with the brand. Specifically:

**Example Issue:**
- **Brand:** Excedrin
- **Current Output:** `["Excedrin Migraine", "Excedrin side effects", "Ibuprofen", "Naproxen", "Aspirin", "Acetaminophen", "Aspirin/Acetaminophen/Caffeine", "Excedrin"]`
- **Problem:** The LLM is including generic ingredients (Ibuprofen, Naproxen, Aspirin, Acetaminophen) as if they were Excedrin products. These are NOT Excedrin products - they're generic ingredients that may be used in various medications.

**What We Need:**
- Only actual Excedrin product names like: "Excedrin Migraine", "Excedrin Extra Strength", "Excedrin PM", "Excedrin Tension Headache", etc.
- NO generic ingredients
- NO competitor products
- NO side effects or medical conditions
- Only products that are commercially branded and sold by the brand

## Current Prompt (Lines 479-529)

```typescript
private async extractProductNamesWithLLM(
  brandName: string,
  metadata: any,
  rawAnswer: string
): Promise<string[]> {
  const metadataStr = metadata ? JSON.stringify(metadata, null, 2).substring(0, 600) : 'No metadata provided';

  const prompt = `You are helping map brand mentions to product names.

Brand: "${brandName}"
Context (metadata, may be empty):
${metadataStr}
Collector answer snippet (may contain product names):
${rawAnswer}

Task: List popular or relevant products that belong to "${brandName}". Use BOTH your knowledge and the provided context. Include specific models or collections if present in the snippet. Only return a JSON array of product names (max 12 items). If absolutely nothing is known, return [].

Example response:
["Product 1", "Product 2"]`;

  // ... rest of the function
}
```

## Your Task

Please modify this prompt to ensure it **ONLY** returns product names that are:
1. **Commercially branded products** sold by the brand (e.g., "Excedrin Migraine", "Nike Air Max", "iPhone 15 Pro")
2. **NOT generic ingredients** (e.g., NOT "Ibuprofen", "Acetaminophen", "Cotton", "Rubber")
3. **NOT competitor products** (e.g., if brand is "Excedrin", don't include "Tylenol" or "Advil")
4. **NOT side effects or medical conditions** (e.g., NOT "Excedrin side effects", "headache relief")
5. **NOT generic product categories** (e.g., NOT "pain reliever", "analgesic", "sneakers", "smartphone")
6. **Actual product SKUs/models/names** that consumers would recognize as specific products from that brand

The prompt should be strict and explicit about these exclusions. It should emphasize that only commercially branded, trademarked, or specifically named products should be included.

## Expected Output Format

The function expects a JSON array of strings, like:
```json
["Product Name 1", "Product Name 2", "Product Name 3"]
```

## Additional Context

- The `rawAnswer` parameter may contain text that mentions ingredients, competitors, or generic terms
- The LLM should use its knowledge to filter out these non-product terms
- If the brand is a pharmaceutical/medical brand, be especially careful to exclude generic drug names and ingredients
- If the brand is a consumer goods brand, exclude generic materials or components
- The goal is to identify products that would appear in brand marketing, product catalogs, or official brand websites

---

**Please provide the improved prompt that addresses these requirements.**






