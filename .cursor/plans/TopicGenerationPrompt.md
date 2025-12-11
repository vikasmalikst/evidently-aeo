Brand intel prompt (system+user) preview: You are a brand intelligence researcher. Given a brand name OR a URL:

Identify the brand, canonical homepage URL, short neutral summary (max 4 sentences).

Extract CEO, headquarters city+country, founded year (if public).

List top 5 competitors (global first, dedupe subsidiaries).

Assign an industry/vertical (1–3 words).

IMPORTANT: You must respond with a valid JSON object containing these exact fields:
{
  "brandName": "string",
  "homepageUrl": "string (full URL with https://)",
  "summary": "string (max 4 sentences)",
  "ceo": "string or null",
  "headquarters": "string (city, country)",
  "foundedYear": number or null,
  "industry": "string (1-3 words)",
  "competitors": ["string1", "string2", "string3", "string4", "string5"]
}

Return JSON strictly matching the BrandIntel schema. ... || user: Analyze this brand: Lara Bars
🌐 Calling OpenRouter (parasail) for brand intel with model: openai/gpt-oss-20b
🔍 OpenRouter response preview: ```json
{
  "brandName": "Lara Bars",
  "homepageUrl": "https://larabars.com",
  "summary": "Lara Bars is a brand of protein and snack bars that emphasizes natural ingredients, clean labeling, and sustainable sourcing. The company offers a variety of flavors aimed at health‑conscious consumers. Lara Bars positions itself as a convenient, on‑the‑go nutrition option for active lifestyles. The brand is part of the growing health foods market.",
  "ceo": null,
  "headquarters": null,
  "foundedYear": null,
  "industry": "Health Foods",
  "competitors": [
    "Clif Bar",
    "Kind",
    "RXBAR",
    "Quest Nutrition",
    "PowerBar"
  ]
}
```
✅ Parsed brand intel JSON: {
  brandName: 'Lara Bars',
  homepageUrl: 'https://larabars.com',
  summary: 'Lara Bars is a brand of protein and snack bars that emphasizes natural ingredients, clean labeling, and sustainable sourcing. The company offers a variety of flavors aimed at health‑conscious consumers. Lara Bars positions itself as a convenient, on‑the‑go nutrition option for active lifestyles. The brand is part of the growing health foods market.',
  ceo: null,
  headquarters: null,
  foundedYear: null,
  industry: 'Health Foods',
  competitors: [ 'Clif Bar', 'Kind', 'RXBAR', 'Quest Nutrition', 'PowerBar' ]
}