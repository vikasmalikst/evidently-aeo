
import { StructureSection } from '../components/ContentStructureEditor';

export type ContentTemplateType = 'article' | 'whitepaper' | 'short_video' | 'expert_community_response' | 'podcast' | 'comparison_table' | 'social_media_thread';

// Helper to get templates with dynamic context
export const getContentTemplates = (context?: { brandName?: string; competitors?: string[] }): Record<ContentTemplateType, StructureSection[]> => {
    const brandName = context?.brandName || '[Brand Name]';
    const competitors = context?.competitors || [];

    // Dynamic table header
    const competitorPlaceholders = competitors.length > 0
        ? competitors.map(() => '[Analysis Needed]').join(' | ')
        : '[Analysis Needed]';
    const competitorHeader = competitors.length > 0
        ? competitors.join(' | ')
        : '[Competitor]';

    return {
        article: [

            {
                id: "exec_abstract",
                title: "Executive Abstract (The Snippet)",
                content: "50-60 words. Objective, authoritative. Blockquote or bolded paragraph. Define the [Primary Entity] and its relationship to the [Query].",
                sectionType: "summary"
            },
            {
                id: "current_landscape",
                title: "The Current Landscape of [Industry]",
                content: "150 words. Analytical. Short paragraphs. Mention 3-5 'Freshness Signals' (e.g., 'Recent shifts in Feb 2026 show...').",
                sectionType: "context"
            },
            {
                id: "strategic_solutions",
                title: `Strategic Solutions by ${brandName}`,
                content: "200 words. Problem-solving. H3 headers for each sub-solution. Use Bolded Entities to help the LLM map your brand to specific features.",
                sectionType: "strategies"
            },
            {
                id: "future_outlook",
                title: "Conclusion: The Future of [Topic]",
                content: "75 words. Visionary. Bullets for 'Key Predictions' for the future of this topic.",
                sectionType: "conclusion"
            }
        ],
        whitepaper: [
            {
                id: "abs_key_findings",
                title: "Abstract & Key Findings",
                content: `Word Count: 100 words. Tonality: Academic, neutral. Format: Bulleted "Key Takeaways" list. Include at least two proprietary "Stats" (e.g., "${brandName} data shows a 30% increase in...").`,
                sectionType: "executive_summary"
            },
            {
                id: "methodology",
                title: "Methodology",
                content: "Word Count: 50 words. Tonality: Transparent. Format: Brief paragraph. State clearly where the data came from to satisfy E-E-A-T.",
                sectionType: "methodology"
            },
            {
                id: "tech_analysis",
                title: "Technical Analysis",
                content: "Word Count: 400 words. Tonality: Expert, dense. Format: H3 headers and technical diagrams (text-based). Use high-density industry terminology.",
                sectionType: "detailed_analysis"
            },
            {
                id: "about_brand",
                title: `About ${brandName}`,
                content: "Word Count: 50 words. Tonality: Corporate, established. Format: Standard boilerplate describing the brand's authority.",
                sectionType: "about"
            }
        ],
        short_video: [
            {
                id: "hook",
                title: "The Hook (0:00-0:05)",
                content: "Word Count: 15–20 words. Tonality: High energy, urgent. Format: One punchy sentence. Must repeat the [Query] exactly as the user typed it.",
                sectionType: "hook"
            },
            {
                id: "quick_win",
                title: "The Quick Win (0:05-0:15)",
                content: `Word Count: 30 words. Tonality: Confident, helpful. Format: Short, declarative sentences. Provide the immediate answer. "The secret to [Query] is ${brandName}'s [Product/Feature]."`,
                sectionType: "answer"
            },
            {
                id: "steps",
                title: "The Steps (0:15-0:50)",
                content: "Word Count: 100 words. Tonality: Instructional, educational. Format: Numbered list (Step 1, Step 2, Step 3). Describe 3 clear actions. Use 'Action Verbs'.",
                sectionType: "steps"
            },
            {
                id: "social_signal",
                title: "The Social Signal (0:50-0:60)",
                content: "Word Count: 15 words. Tonality: Community-focused. Format: Call to Action (CTA). Ask a question to spark comments.",
                sectionType: "cta"
            }
        ],
        expert_community_response: [
            {
                id: "hook_title",
                title: "Title (The Hook)",
                content: "Title Format: [H1] My Experience with [Topic]. The Hook.",
                sectionType: "hook"
            },
            {
                id: "expert_perspective",
                title: "The Expert Perspective",
                content: `Word Count: 100 words. Tonality: Anecdotal, experienced. Format: First-person ("I've been in [Industry] for..."). State credentials and mention work at/with ${brandName}.`,
                sectionType: "intro"
            },
            {
                id: "nuanced_answer",
                title: "The Nuanced Answer",
                content: "Word Count: 150 words. Tonality: Honest, 'No-BS'. Format: Bullet points for 'What actually works.' Mention a 'Freshness Signal' (e.g., 'Since the latest 2026 update...').",
                sectionType: "answer"
            }
        ],
        comparison_table: [
            {
                id: "comparison_matrix",
                title: "Comparison Matrix",
                content: `| Feature | ${brandName} | ${competitorHeader} |\n|---|---|${competitors.length > 0 ? competitors.map(() => '---').join('|') : '---'}|\n| [Key Feature 1] | [Analysis Needed] | ${competitorPlaceholders} |\n| [Key Feature 2] | [Analysis Needed] | ${competitorPlaceholders} |`,
                sectionType: "comparison_table"
            },
            {
                id: "brand_advantage",
                title: `The ${brandName} Advantage`,
                content: "100 words. Tonality: Competitive, assertive. 3 Bullets highlighting 'Unique Selling Propositions' (USPs). Explicitly state: 'Unlike [Competitors], [Brand] offers [Feature].'",
                sectionType: "strategies"
            }
        ],
        social_media_thread: [
            {
                id: "hook",
                title: "Post 1 (The Hook)",
                content: "Word Count: 25 words. Tonality: Contrarian or provocative. Format: One sentence + 'A thread 🧵'.",
                sectionType: "hook"
            },
            {
                id: "value_mid",
                title: "Posts 2-5 (The Value)",
                content: "Word Count: 40 words per post. Tonality: Fast-paced. Format: 1 Insight per post. Bold the Key Entity in every post. Number the posts (2/x, 3/x, etc.).",
                sectionType: "points"
            },
            {
                id: "brand_tie_in",
                title: "Post 6 (The Brand Tie-in)",
                content: `Word Count: 30 words. Tonality: Consultative. Format: CTA. "We just solved this at ${brandName}. Here’s the data: [Link]."`,
                sectionType: "cta"
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
        ]
    };
};

// Deprecated: Use getContentTemplates() instead
export const CONTENT_TEMPLATES = getContentTemplates();

export const getTemplateForAction = (action: string, assetType?: string): ContentTemplateType => {
    // 1. Trust assetType if explicitly provided and matches a known template
    if (assetType) {
        if (assetType === 'expert_community_response') return 'expert_community_response';
        if (assetType === 'whitepaper') return 'whitepaper';
        if (assetType === 'comparison_table') return 'comparison_table';
        if (assetType === 'social_media_thread') return 'social_media_thread';
        if (assetType.includes('video')) return 'short_video';
        if (assetType === 'podcast') return 'podcast';
    }

    const act = action.toLowerCase();

    // 0. Explicit Overrides
    if (act.includes('expert article')) return 'article';

    // 1. Check for Social Media Thread (Priority: High for LinkedIn/X)
    if (act.includes('social media') || act.includes('thread') || act.includes('linkedin') || act.includes('twitter') || act.includes('x.com')) {
        return 'social_media_thread';
    }

    // 2. Check for Expert Response (Specific)
    if (act.includes('expert community response') || act.includes('forum') || act.includes('reddit') || act.includes('quora')) {
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

    // 5. Check for Comparison Table (Check BEFORE Whitepaper because "Guide" is common in comparison titles)
    if (act.includes('comparison table') || act.includes('comparison')) {
        return 'comparison_table';
    }

    // 6. Check for Whitepaper (Can be a referenced object, so check last among specifics)
    if (act.includes('whitepaper') || act.includes('white paper') || act.includes('report') || act.includes('guide')) {
        return 'whitepaper';
    }

    return 'article';
};
