
import { StructureSection } from '../components/ContentStructureEditor';

export type ContentTemplateType = 'article' | 'whitepaper' | 'short_video' | 'expert_community_response' | 'podcast' | 'comparison_table';

export const CONTENT_TEMPLATES: Record<ContentTemplateType, StructureSection[]> = {
    article: [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "Provide a direct, standalone answer to the main user question immediately (80-120 words). Optimize for 'featured snippet' extraction. Bold key concepts.",
            sectionType: "answer"
        },
        {
            id: "how_it_works",
            title: "How It Works",
            content: "Break down the mechanism or process into clear, numbered steps. Focus on 'why' it works, not just 'what' it is to build semantic depth.",
            sectionType: "explanation"
        },
        {
            id: "comparison",
            title: "Comparison With Alternatives",
            content: "Objectively compare with 2-3 main alternatives. Highlight unique differentiators without marketing fluff. Use contrastive language (e.g., 'Unlike X, Y does...').",
            sectionType: "comparison"
        },
        {
            id: "limitations",
            title: "Limitations and Trade-Offs",
            content: "Explicitly state 1-2 limitations or trade-offs. This increases trust and prevents 'too good to be true' penalties in AI scoring.",
            sectionType: "constraints"
        }
    ],
    whitepaper: [
        {
            id: "exec_summary",
            title: "Executive Summary",
            content: "A complete, self-contained summary of the entire paper (200-300 words). Must address the Problem, Solution, and Key Outcome. Optimized for executive skimming.",
            sectionType: "executive_summary"
        },
        {
            id: "problem",
            title: "Problem Statement",
            content: "Define the industry problem with precision. Use specific terminology and avoid generalizations. Establish the 'cost of inaction'.",
            sectionType: "problem_statement"
        },
        {
            id: "methodology",
            title: "Methodology / Approach",
            content: "Explain the technical or research approach used to derive insights. Build authority by showing the 'work' behind the claims.",
            sectionType: "methodology"
        },
        {
            id: "analysis",
            title: "Detailed Analysis",
            content: "Deep-dive analysis with causal reasoning. Connect data points to conclusions using 'if-then' logic to demonstrate expertise.",
            sectionType: "detailed_analysis"
        },
        {
            id: "limitations",
            title: "Strategic Limitations",
            content: "Rigorous, honest assessment of scope and constraints. Define exactly where this solution applies and where it doesn't.",
            sectionType: "limitations"
        }
    ],
    short_video: [
        {
            id: "transcript",
            title: "Full Audio Transcript",
            content: "Verbatim spoken-word script (approx 150 words). USE LINE BREAKS between sections:\n\n**[0-5s] Hook:** <Hook text>\n**[5-20s] Answer:** <Direct answer>\n**[20-50s] Explanation:** <Details>\n**[50-60s] Takeaway:** <Final thought>",
            sectionType: "transcript"
        },
        {
            id: "production_tips",
            title: "Production Guidelines",
            content: "Strategic visual direction. Use a Bulleted List:\n* **Visuals:** <Camera angles/B-roll>\n* **Text Overlay:** <Keywords to show>\n* **Tone:** <Speaker emotion>",
            sectionType: "tips"
        }
    ],
    expert_community_response: [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "Give the clear stance immediately in 2–3 sentences. Include the core recommendation and key condition without introductions.",
            sectionType: "answer"
        },
        {
            id: "experience_context",
            title: "Experience Context",
            content: "Provide first-hand practitioner context using 'I' or 'We'. Mention real constraints such as time, cost, scale, integrations, or failures.",
            sectionType: "context"
        },
        {
            id: "reasoning_evidence",
            title: "Reasoning & Evidence",
            content: "Explain the technical and practical reasoning behind the stance. Be specific about mechanisms, trade-offs, and measurable factors.",
            sectionType: "explanation"
        },
        {
            id: "tradeoffs_limits",
            title: "Trade-offs & When Not To Use",
            content: "Explain scenarios where the opposite choice is better. Acknowledge downsides and edge cases candidly.",
            sectionType: "comparison"
        }
    ],
    podcast: [
        {
            id: "intro",
            title: "Introduction & Topic Setup",
            content: "Host establishes the specific problem/topic immediately. No long preambles. Hook the listener with a counter-intuitive insight.",
            sectionType: "intro"
        },
        {
            id: "core_concept",
            title: "The Core Insight",
            content: "Guest explicitly defines the core concept. Use analogies or metaphors to make complex ideas sticky and transcript-friendly.",
            sectionType: "explanation"
        },
        {
            id: "deep_dive",
            title: "Deep Dive Analysis",
            content: "In-depth discussion of mechanics. Host asks probing 'how-to' questions. Guest provides tactical details, not just high-level theory.",
            sectionType: "discussion"
        },
        {
            id: "nuance",
            title: "Limitations & Real-World Nuance",
            content: "Explore edge cases and 'gotchas'. Host challenges assumptions. Guest nuances their advice for different contexts.",
            sectionType: "context"
        },
        {
            id: "key_takeaways",
            title: "Key Takeaways",
            content: "Host summarizes 3 specific, actionable takeaways, phrasing them as 'rules of thumb' for easy memorization and extraction.",
            sectionType: "summary"
        }
    ],
    comparison_table: [
        {
            id: "overview",
            title: "Overview",
            content: "A neutral, high-level summary of the comparison landscape (300-400 words). Define the criteria used for evaluation.",
            sectionType: "context"
        },
        {
            id: "table",
            title: "Comparison Table",
            content: `| Feature | [Brand Name] | [Competitor] |\n|---|---|---|\n| [Feature 1] | [Value] | [Value] |`,
            sectionType: "comparison_table"
        },
        {
            id: "detailed_analysis",
            title: "Deep Dive Analysis",
            content: "Prose analysis explaining the 'why' behind the table ratings. Focus on nuances that don't fit in the grid. 400-600 words.",
            sectionType: "strategies"
        },
        {
            id: "verdict",
            title: "Final Verdict",
            content: "A 'Who is this for?' conclusion. Define the ideal user profile for each option rather than declaring a universal winner.",
            sectionType: "cta"
        }
    ]
};

export const getTemplateForAction = (action: string, assetType?: string): ContentTemplateType => {
    // 1. Trust assetType if explicitly provided and matches a known template
    if (assetType) {
        if (assetType === 'expert_community_response') return 'expert_community_response';
        if (assetType === 'whitepaper') return 'whitepaper';
        if (assetType === 'comparison_table') return 'comparison_table';
        if (assetType.includes('video')) return 'short_video';
        if (assetType === 'podcast') return 'podcast';
    }

    const act = action.toLowerCase();

    // 0. Explicit Overrides
    if (act.includes('expert article')) return 'article';

    // 2. Check for Expert Response first (Specific)
    if (act.includes('expert community response') || act.includes('forum') || act.includes('reddit')) {
        return 'expert_community_response';
    }

    // 3. Check for Podcast (Specific)
    if (act.includes('podcast') || act.includes('audio')) {
        return 'podcast';
    }

    // 4. Check for Video (Specific)
    if (act.includes('video') || act.includes('short') || act.includes('tiktok') || act.includes('reel')) {
        return 'short_video';
    }

    // 5. Check for Whitepaper (Can be a referenced object, so check last among specifics)
    if (act.includes('whitepaper') || act.includes('white paper') || act.includes('report') || act.includes('guide')) {
        return 'whitepaper';
    }

    // 6. Check for Comparison Table
    if (act.includes('comparison table') || act.includes('comparison')) {
        return 'comparison_table';
    }

    return 'article';
};
