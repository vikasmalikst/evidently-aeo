
import { StructureSection } from '../components/ContentStructureEditor';

export type ContentTemplateType = 'article' | 'whitepaper' | 'short_video' | 'expert_community_response' | 'podcast';

export const CONTENT_TEMPLATES: Record<ContentTemplateType, StructureSection[]> = {
    article: [
        {
            id: "direct_answer",
            title: "Direct Answer",
            content: "Concise answer to the primary question (80–120 words)",
            sectionType: "answer"
        },
        {
            id: "how_it_works",
            title: "How It Works",
            content: "Explain mechanism step-by-step",
            sectionType: "explanation"
        },
        {
            id: "comparison",
            title: "Comparison With Alternatives",
            content: "Objective comparison with competitors",
            sectionType: "comparison"
        },
        {
            id: "limitations",
            title: "Limitations and Trade-Offs",
            content: "What this does NOT solve",
            sectionType: "constraints"
        }
    ],
    whitepaper: [
        {
            id: "exec_summary",
            title: "Executive Summary",
            content: "High-level overview of the problem and solution",
            sectionType: "executive_summary"
        },
        {
            id: "problem",
            title: "Problem Statement",
            content: "Detailed analysis of the current industry challenge",
            sectionType: "problem_statement"
        },
        {
            id: "methodology",
            title: "Methodology / Approach",
            content: "Technical explanation of the solution architecture",
            sectionType: "methodology"
        },
        {
            id: "analysis",
            title: "Detailed Analysis",
            content: "Data-driven findings and case evidence",
            sectionType: "detailed_analysis"
        },
        {
            id: "limitations",
            title: "Strategic Limitations",
            content: "Honest assessment of where this solution applies",
            sectionType: "limitations"
        }
    ],
    short_video: [
        {
            id: "hook",
            title: "The Hook (0-3s)",
            content: "Visual/Text hook that states the specific problem immediately",
            sectionType: "hook"
        },
        {
            id: "direct_answer",
            title: "The Answer (Core Concept)",
            content: "The single, explicit answer/solution. No fluff.",
            sectionType: "answer"
        },
        {
            id: "explanation",
            title: "The Why (Explanation)",
            content: "Brief explanation of mechanism or proof (1-2 sentences)",
            sectionType: "explanation"
        },
        {
            id: "takeaway",
            title: "The Takeaway (Quotable)",
            content: "One memorable, quotable statement summarizing the value",
            sectionType: "summary"
        }
    ],
    expert_community_response: [
        {
            id: "direct_stance",
            title: "The Verdict",
            content: "Clear, decisive answer based on experience (e.g., 'Yes, but only if...')",
            sectionType: "answer"
        },
        {
            id: "experience_context",
            title: "Real-World Experience",
            content: "'In my experience...' / 'We ran this in production...'",
            sectionType: "context"
        },
        {
            id: "reasoning",
            title: "The 'Why'",
            content: "Technical or strategic reasoning behind the verdict",
            sectionType: "explanation"
        },
        {
            id: "tradeoffs",
            title: "Trade-offs & Alternatives",
            content: "Honest comparison (upsides/downsides)",
            sectionType: "comparison"
        },
        {
            id: "conclusion",
            title: "Final Recommendation",
            content: "Summing it up",
            sectionType: "summary"
        }
    ],
    podcast: [
        {
            id: "intro",
            title: "Introduction & Topic Setup",
            content: "Host introduces the core question/problem clearly",
            sectionType: "intro"
        },
        {
            id: "core_concept",
            title: "The Core Insight",
            content: "Expert defines the solution/concept explicitly",
            sectionType: "explanation"
        },
        {
            id: "deep_dive",
            title: "Deep Dive Analysis",
            content: "Discussion on the 'how' and 'why' mechanisms",
            sectionType: "discussion"
        },
        {
            id: "nuance",
            title: "Limitations & Real-World Nuance",
            content: "'It depends on...' discussion",
            sectionType: "context"
        },
        {
            id: "key_takeaways",
            title: "Key Takeaways",
            content: "Host summarizes the 3 main points",
            sectionType: "summary"
        }
    ]
};

export const getTemplateForAction = (action: string, assetType?: string): ContentTemplateType => {
    // 1. Trust assetType if explicitly provided and matches a known template
    if (assetType) {
        if (assetType === 'expert_community_response') return 'expert_community_response';
        if (assetType === 'whitepaper') return 'whitepaper';
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

    return 'article';
};
