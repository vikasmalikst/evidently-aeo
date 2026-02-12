
import { RecommendationV3 } from '../../recommendation.types';
import { StructureConfig } from '../../new-content-factory';

export function buildUnifiedSocialPrompt(
    systemContext: string,
    recContext: string,
    brandName: string,
    currentYear: number,
    rec: RecommendationV3,
    structureConfig?: StructureConfig
): string {

    let template = "";

    if (structureConfig?.sections && structureConfig.sections.length > 0) {
        template = structureConfig.sections.map(section => {
            return `[H2] ${section.title}\n> INSTRUCTIONS FOR THIS SECTION: ${section.content}`;
        }).join('\n\n');

        // Social threads usually don't have a main H1 Title in the content body as they are a series of posts, 
        // but the unified renderer expects H2 splits. The H1 below is for the "Content Title" meta-field or just context.
        // Actually, the prompt says "Output a single, cohesive Markdown document". 
        // We'll add a generic H1 hook instruction.
        template = `[H1] Title: Thread Hook / Main Topic\n\n` + template;
    } else {
        // Social Media Thread Template (from improvedContentTemplates.md)
        template = `
[H2] Post 1 (The Hook)
> INSTRUCTIONS: Word Count: 25 words. Tonality: Contrarian or provocative.
Format: One sentence + "A thread 🧵".

[H2] Posts 2-5 (The Value)
> INSTRUCTIONS: Word Count: 40 words per post. Tonality: Fast-paced.
Format: 1 Insight per post. Bold the Key Entity in every post.
Number the posts (2/x, 3/x, etc.).

[H2] Post 6 (The Brand Tie-in)
> INSTRUCTIONS: Word Count: 30 words. Tonality: Consultative.
Format: CTA. "We just solved this at [Brand]. Here’s the data: [Link]."
`;
    }

    return `
You are a Viral Social Media Strategist and Copywriter for ${brandName}.
Your goal is to write a high-engagement thread that stops the scroll, delivers immediate value, and drives action.

**CONTEXT:**
- **Brand:** ${brandName}
- **Task:** Write a social media thread about "${rec.contentFocus || rec.action}"
- **Year:** ${currentYear}
- **Goal:** Maximize engagement (likes, retweets, shares) and click-throughs.

**CORE WRITING GUIDELINES (STRICT):**
1.  **The Hook is Everything:** The first line must be provocative, surprising, or promise a specific benefit. No "Hello everyone" or "Today we are talking about."
2.  **Write for the Eye:** Use short sentences, line breaks, and emojis (sparingly but effectively) to create "white space."
3.  **Punchy & Direct:** Remove all passive voice. Use strong verbs.
4.  **Value-First:** Every post in the thread must stand alone as a valuable insight.
5.  **The "Slippery Slope":** Each post should naturally lead the reader to the next one.

**DO vs DON'T:**
- **DO:** "Stop doing X. Do Y instead. Here's why: 🧵"
- **DON'T:** "In this thread, I will discuss the differences between X and Y."
- **DO:** "3 steps to fix your ROI:"
- **DON'T:** "Here are some tips for improving your return on investment."

${systemContext}
${recContext}

**THE STRUCTURE (MANDATORY):**
${template}

**INSTRUCTIONS:**
Generate the social thread adhering strictly to the structure above.
- **Tone:** Energetic, Confident, Native to the Platform (Twitter/LinkedIn style).
- **Voice:** Direct address ("You").
- **Formatting:** Markdown. Use "---" references to separate posts if needed, but output as one continuous markdown stream.

**OUTPUT FORMAT (JSON v5.0):**
Return a SINGLE VALID JSON object. The 'content' field must contain the ENTIRE markdown document as a single string.

{
  "version": "5.0",
  "brandName": "${brandName}",
  "contentTitle": "<Viral Hook / Thread Title>",
  "content": "<FULLMARKDOWN STRING...>",
  "requiredInputs": []
}
`;
}
