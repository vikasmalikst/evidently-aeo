# EvidentlyAEO Content Strategy Prompt Documentation

This document outlines the prompt engineering architecture used to generate **Content Strategies** (Template Plans) in the `TemplateGenerationService`. 

When a recommendation is approved, the system generates a "Content Plan" (or Strategy) before writing the actual prose. This ensures the content adheres to AEO best practices, brand voice, and specific structural requirements.

## 1. The Core Prompt Structure

The system uses a **Content Architect** persona to generate the strategy. The prompt is constructed dynamically in `template-generation.service.ts` (`buildPlannerPrompt`).

### System Instruction
```text
You are the Content Architect for [Brand Name].

TASK: Flesh out this Content Plan based on the provided skeleton template.
1.  Use the provided Skeleton as a base - KEEP ALL FIELDS (version, targetChannel, primary_entity, aeo_extraction_targets, structure).
2.  Rewrite 'text_template' (Headings) in the structure array to be specific to: "[Action]" and KPI: "[KPI]".
3.  Add specific 'instructions' for the writer based on the Brand Summary: "[Brand Summary]".
4.  Ensure H1 includes "2026" for freshness signals.
5.  You MAY make MINOR adjustments to section titles and descriptions if they better fit the specific recommendation, but maintain the overall template structure, word counts, tonality, and formatting guidance.
6.  [Custom User Instructions if any]

SKELETON (JSON):
[JSON Skeleton of the specific Content Type]

OUTPUT: Return ONLY valid JSON matching the 'TemplatePlan' interface. You MUST include ALL fields from the skeleton (version, targetChannel, primary_entity, aeo_extraction_targets, structure). Do NOT omit any top-level fields.
```

## 2. Content Type Skeletons (The "Instructions")

The "Skeleton" passed to the LLM defines the strict structure it must follow. Each content type has a specific skeleton defined in `content-templates.ts`.

### A. Article / Blog Post (`article`)
Designed for high-ranking SEO/AEO content (e.g., "Expert Articles").

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `exec_abstract` | **Executive Abstract (The Snippet)** | "50-60 words. Objective, authoritative. Blockquote or bolded paragraph. Define the [Primary Entity] and its relationship to the [Query]." |
| `current_landscape` | **The Current Landscape of [Industry]** | "150 words. Analytical. Short paragraphs. Mention 3-5 'Freshness Signals' (e.g., 'Recent shifts in Feb 2026 show...')." |
| `strategic_solutions` | **Strategic Solutions by [Brand]** | "200 words. Problem-solving. H3 headers for each sub-solution. Use Bolded Entities to help the LLM map your brand to specific features." |
| `future_outlook` | **Conclusion: The Future of [Topic]** | "75 words. Visionary. Bullets for 'Key Predictions' for the future of this topic." |

### B. Whitepaper / Guide (`whitepaper`)
Designed for dense, authoritative, downloadable assets.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `abs_key_findings` | **Abstract & Key Findings** | "Word Count: 100 words. Tonality: Academic, neutral. Format: Bulleted 'Key Takeaways' list. Include at least two proprietary 'Stats' (e.g., '[Brand] data shows a 30% increase in...')." |
| `methodology` | **Methodology** | "Word Count: 50 words. Tonality: Transparent. Format: Brief paragraph. State clearly where the data came from to satisfy E-E-A-T." |
| `tech_analysis` | **Technical Analysis** | "Word Count: 400 words. Tonality: Expert, dense. Format: H3 headers and technical diagrams (text-based). Use high-density industry terminology." |
| `about_brand` | **About [Brand]** | "Word Count: 50 words. Tonality: Corporate, established. Format: Standard boilerplate describing the brand's authority." |

### C. Short Video Script (`short_video`)
Designed for TikTok / Reels / YouTube Shorts.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `hook` | **The Hook (0:00-0:05)** | "Word Count: 15–20 words. Tonality: High energy, urgent. Format: One punchy sentence. Must repeat the [Query] exactly as the user typed it." |
| `quick_win` | **The Quick Win (0:05-0:15)** | "Word Count: 30 words. Tonality: Confident, helpful. Format: Short, declarative sentences. Provide the immediate answer. 'The secret to [Query] is [Brand]'s [Product/Feature].'" |
| `steps` | **The Steps (0:15-0:50)** | "Word Count: 100 words. Tonality: Instructional, educational. Format: Numbered list (Step 1, Step 2, Step 3). Describe 3 clear actions. Use 'Action Verbs'." |
| `social_signal` | **The Social Signal (0:50-0:60)** | "Word Count: 15 words. Tonality: Community-focused. Format: Call to Action (CTA). Ask a question to spark comments." |

### D. Expert Community Response (`expert_community_response`)
Designed for Reddit, Quora, or Forum replies.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `hook_title` | **Title (The Hook)** | "Title Format: [H1] My Experience with [Topic]. The Hook." |
| `expert_perspective` | **The Expert Perspective** | "Word Count: 100 words. Tonality: Anecdotal, experienced. Format: First-person ('I've been in [Industry] for...'). State credentials and mention work at/with [Brand]." |
| `nuanced_answer` | **The Nuanced Answer** | "Word Count: 150 words. Tonality: Honest, 'No-BS'. Format: Bullet points for 'What actually works.' Mention a 'Freshness Signal' (e.g., 'Since the latest 2026 update...')." |

### E. Comparison Table (`comparison_table`)
Designed to win "Best X vs Y" queries.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `comparison_matrix` | **Comparison Matrix** | *Generates a Markdown Table structure comparing Brand vs Competitors* |
| `brand_advantage` | **The [Brand] Advantage** | "100 words. Tonality: Competitive, assertive. 3 Bullets highlighting 'Unique Selling Propositions' (USPs). Explicitly state: 'Unlike [Competitors], [Brand] offers [Feature].'" |

### F. Social Media Thread (`social_media_thread`)
Designed for LinkedIn or X (Twitter) threads.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `hook` | **Post 1 (The Hook)** | "Word Count: 25 words. Tonality: Contrarian or provocative. Format: One sentence + 'A thread 🧵'." |
| `value_mid` | **Posts 2-5 (The Value)** | "Word Count: 40 words per post. Tonality: Fast-paced. Format: 1 Insight per post. Bold the Key Entity in every post. Number the posts (2/x, 3/x, etc.)." |
| `brand_tie_in` | **Post 6 (The Brand Tie-in)** | "Word Count: 30 words. Tonality: Consultative. Format: CTA. 'We just solved this at [Brand]. Here's the data: [Link].'" |

### G. Podcast Script (`podcast`)
Designed for audio content scripts.

| Section ID | Title Template | Instructions Passed to LLM |
|------------|----------------|----------------------------|
| `intro` | **Introduction & Topic Setup** | "Host establishes the specific problem/topic immediately. No long preambles. Hook the listener with a counter-intuitive insight." |
| `core_concept` | **The Core Insight** | "Guest explicitly defines the core concept. Use analogies or metaphors to make complex ideas sticky and transcript-friendly." |
| `deep_dive` | **Deep Dive Analysis** | "In-depth discussion of mechanics. Host asks probing 'how-to' questions. Guest provides tactical details, not just high-level theory." |
| `nuance` | **Limitations & Real-World Nuance** | "Explore edge cases and 'gotchas'. Host challenges assumptions. Guest nuances their advice for different contexts." |
| `key_takeaways` | **Key Takeaways** | "Host summarizes 3 specific, actionable takeaways, phrasing them as 'rules of thumb' for easy memorization and extraction." |

## 3. AEO Extraction Targets

In addition to the visible content structure, the system injects hidden **AEO Extraction Targets** into the prompt. These instruct the LLM on which *metadata* or *HTML structures* are critical for Answer Engine visibility for that specific format.

| Content Type | Snippet Target | List Target | Table Target |
|--------------|----------------|-------------|--------------|
| **Article** | "Optimize for featured snippet extraction" | Optional | Optional |
| **Whitepaper** | "Executive summary snippet" | "Key findings list" | Optional |
| **Short Video** | "Video description snippet" | Optional | Optional |
| **Comparison** | "Winner declaration" | "Top picks list" | "Feature comparison table" |
| **Podcast** | "Episode summary" | "Key takeaways" | Optional |
