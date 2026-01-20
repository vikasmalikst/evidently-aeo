import { useEffect, useState } from 'react';
import { X, HelpCircle, BookOpen, Target, BarChart2, Lightbulb, LineChart, Flag, DivideCircle, Table, MousePointer2, ArrowUpDown, CheckSquare, Calendar, PieChart, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type KpiType = 'visibility' | 'share' | 'sentiment' | 'brandPresence' | 'trend-analysis' | 'table-guide' | 'source-distribution' | 'source-priority' | 'source-reputation' | 'source-growth' | 'source-monitor' | 'table-feature-guide' | 'metric-impact-score' | 'metric-mention' | 'metric-soa' | 'metric-sentiment' | 'metric-citations' | 'trend-chart-guide';

interface Section {
    title: string;
    content: React.ReactNode;
    icon: any;
    colorClass: string;
    bgClass?: string;
}

interface EducationalContent {
    title: string;
    typeLabel: string;
    sections: Section[];
}

const contentMap: Record<KpiType, EducationalContent> = {
    visibility: {
        title: 'Visibility Score',
        typeLabel: 'KPI Guide',
        sections: [
            {
                title: 'Definition',
                content: 'A composite metric that measures how prominent your brand is across AI responses. It considers both the frequency of your brand\'s appearance and its ranking position in the answers.',
                icon: BookOpen,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Why it Matters?',
                content: 'Higher visibility means your brand is more likely to be seen by users asking relevant questions, driving brand awareness and potential traffic.',
                icon: Target,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'What\'s a Good Value?',
                content: 'Values above 50 are considered strong. A score of 100 means you are dominant in every answer.',
                icon: BarChart2,
                colorClass: 'text-purple-500',
                bgClass: 'bg-gray-50 border-gray-100'
            },
            {
                title: 'How to Use This KPI?',
                content: 'Monitor this trend to see if your optimization efforts are working. A drop indicates competitors might be gaining ground or model behaviors have changed.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    share: {
        title: 'Share of Answers',
        typeLabel: 'KPI Guide',
        sections: [
            {
                title: 'Definition',
                content: 'The percentage of times your brand appears in the answers generated for your tracked keywords, relative to the total number of answers where any brand (yours or competitors) appears.',
                icon: BookOpen,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Why it Matters?',
                content: 'It directly compares your footprint against your competition. It answers "Are we winning the digital shelf?".',
                icon: Target,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'What\'s a Good Value?',
                content: 'Depends on the number of competitors. If you have 4 competitors, >25% suggests you are punching above your weight.',
                icon: BarChart2,
                colorClass: 'text-purple-500',
                bgClass: 'bg-gray-50 border-gray-100'
            },
            {
                title: 'How to Use This KPI?',
                content: 'Use it to benchmark your market share. If this drops while Visibility Score stays high, it means the market is growing but you aren\'t capturing the new share.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    sentiment: {
        title: 'Sentiment Score',
        typeLabel: 'KPI Guide',
        sections: [
            {
                title: 'Definition',
                content: 'A score from 0 to 100 reflecting the average tone of the AI\'s mention of your brand. 100 is perfectly positive, 0 is negative.',
                icon: BookOpen,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Why it Matters?',
                content: 'Visibility is useless if the AI is saying negative things. High sentiment drives conversion and trust.',
                icon: Target,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'What\'s a Good Value?',
                content: '>70 is generally positive. >90 is excellent. <50 requires immediate attention.',
                icon: BarChart2,
                colorClass: 'text-purple-500',
                bgClass: 'bg-gray-50 border-gray-100'
            },
            {
                title: 'How to Use This KPI?',
                content: 'Check this if you see a dip in conversions. Drill down to see if specific models or topics are driving negative sentiment.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    brandPresence: {
        title: 'Brand Presence',
        typeLabel: 'KPI Guide',
        sections: [
            {
                title: 'Definition',
                content: 'The percentage of total queries where your brand is mentioned at all, regardless of ranking or competitors.',
                icon: BookOpen,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Why it Matters?',
                content: 'It measures pure availability. If you aren\'t present, you can\'t be chosen.',
                icon: Target,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'What\'s a Good Value?',
                content: 'Aim for 100% on your branded keywords and >50% on generic category keywords.',
                icon: BarChart2,
                colorClass: 'text-purple-500',
                bgClass: 'bg-gray-50 border-gray-100'
            },
            {
                title: 'How to Use This KPI?',
                content: 'This is your "coverage" metric. If this is low, you need to work on fundamental content indexability and relevance.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    'trend-analysis': {
        title: 'Trend Charts',
        typeLabel: 'Feature Guide',
        sections: [
            {
                title: 'What does this chart show?',
                content: 'This interactive graph tracks your selected KPI (Visibility, Share, etc.) over time. It allows you to spot trends, seasonality, and the impact of market changes on your AI performance.',
                icon: LineChart,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'What are the vertical lines?',
                content: 'The purple dotted vertical lines mark specifically when you have completed a Recommendation using our platform. These "Recommendation Markers" allow you to directly attribute performance improvements to your actions.',
                icon: Flag,
                colorClass: 'text-purple-500',
                bgClass: 'bg-purple-50/50 border-purple-100/50'
            },
            {
                title: 'How do I compare competitors?',
                content: 'The chart automatically plots your top competitors alongside your brand. You can toggle specific competitors on/off using the "Top Performers" list or the "Compare" tab below to isolate specific rivalries.',
                icon: DivideCircle,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'Why does the score fluctuate?',
                content: 'AI models are non-deterministic and update frequently. Small daily fluctuations are normal. Look for sustained trends or sharp changes that correlate with your "Recommendation Markers" to identify real shifts in performance.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    'table-guide': {
        title: 'Detailed Breakdown & Controls',
        typeLabel: 'Feature Guide',
        sections: [
            {
                title: 'Interactive Chart Toggles',
                content: 'Use the checkboxes on the left to show or hide specific competitors on the main chart above. This allows you to focus on specific rivalries or declutter the trend view.',
                icon: CheckSquare,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Comprehensive Competitive View',
                content: 'This table provides a side-by-side comparison of ALL key metrics (Visibility, Share of Answers, Brand Presence, and Sentiment) for every competitor. It\'s your one-stop shop for benchmarking.',
                icon: Table,
                colorClass: 'text-purple-500',
                bgClass: 'bg-purple-50/50 border-purple-100/50'
            },
            {
                title: 'Context Aware Data',
                content: 'The data in this table automatically updates based on the Date Range and LLM Filters you select at the top of the page. It always reflects exactly the slice of time and models you are analyzing.',
                icon: Calendar,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'Top Topic Insights',
                content: 'The "Top Topic" column reveals the single most dominant theme for each competitor. Click on any row to expand it and see even more detailed topic breakdowns.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    'source-distribution': {
        title: 'Source Type Analysis',
        typeLabel: 'Strategic Guide',
        sections: [
            {
                title: 'Diversity is Strength',
                content: 'This bar shows the mix of sources citing your brand. A healthy brand footprint is diverse. Relying too heavily on one type creates vulnerability.',
                icon: PieChart,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Understanding Source Types',
                content: (
                    <ul className="space-y-3">
                        <li className="flex gap-2 text-sm text-gray-700">
                            <span className="font-bold text-gray-900 whitespace-nowrap">• Editorial:</span>
                            <span>News & blogs <span className="text-gray-500">(High authority, drives discovery)</span></span>
                        </li>
                        <li className="flex gap-2 text-sm text-gray-700">
                            <span className="font-bold text-gray-900 whitespace-nowrap">• Corporate:</span>
                            <span>Company websites & industry press <span className="text-gray-500">(Controlled messaging)</span></span>
                        </li>
                        <li className="flex gap-2 text-sm text-gray-700">
                            <span className="font-bold text-gray-900 whitespace-nowrap">• UGC:</span>
                            <span>Forums & social <span className="text-gray-500">(High trust, volatile sentiment)</span></span>
                        </li>
                        <li className="flex gap-2 text-sm text-gray-700">
                            <span className="font-bold text-gray-900 whitespace-nowrap">• Reference:</span>
                            <span>Wikis & databases <span className="text-gray-500">(Foundational context)</span></span>
                        </li>
                    </ul>
                ),
                icon: BookOpen,
                colorClass: 'text-purple-500',
                bgClass: 'bg-purple-50/50 border-purple-100/50'
            },
            {
                title: 'Strategic Warning Signs',
                content: '• Too much Corporate (>70%): You are "talking to yourself". You need more third-party validation.\n• Too much UGC (>50%): Your narrative is controlled by the crowd. Monitor sentiment closely.\n• Low Editorial: You lack authoritative "news" coverage.',
                icon: Target,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'Sentiment Correlation',
                content: 'Different source types tend to have different sentiment profiles. UGC is often more critical (lower sentiment), while Corporate is positive. Use this distribution to contextulaize your overall Sentiment Score.',
                icon: Users,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
            }
        ]
    },
    'source-priority': {
        title: 'Priority Partnerships (Green)',
        typeLabel: 'Strategic Analysis',
        sections: [
            {
                title: 'Definition',
                content: (
                    <div className="space-y-2">
                        <p className="text-sm"><span className="font-bold text-gray-900">Definition:</span> Sources with <span className="font-semibold text-emerald-600">High Visibility</span> and <span className="font-semibold text-emerald-600">Positive Sentiment</span>.</p>
                        <p className="text-sm"><span className="font-bold text-gray-900">Why it Matters:</span> These are your best performing channels. They are already driving valuable traffic and positive brand perception.</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Action: Maintain & Double Down</p>
                    </div>
                ),
                icon: Target,
                colorClass: 'text-emerald-500',
                bgClass: 'bg-emerald-50/50 border-emerald-100/50'
            }
        ]
    },
    'source-reputation': {
        title: 'Reputation Management (Red)',
        typeLabel: 'Strategic Analysis',
        sections: [
            {
                title: 'Definition',
                content: (
                    <div className="space-y-2">
                        <p className="text-sm"><span className="font-bold text-gray-900">Definition:</span> Sources with <span className="font-semibold text-emerald-600">High Visibility</span> but <span className="font-semibold text-rose-500">Negative/Neutral Sentiment</span>.</p>
                        <p className="text-sm"><span className="font-bold text-gray-900">Why it Matters:</span> These sources are widely seen but are damaging your brand reputation or failing to convert users (low trust).</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Action: Address Criticism & Improve Content</p>
                    </div>
                ),
                icon: Flag,
                colorClass: 'text-rose-500',
                bgClass: 'bg-rose-50/50 border-rose-100/50'
            }
        ]
    },
    'source-growth': {
        title: 'Growth Opportunities (Blue)',
        typeLabel: 'Strategic Analysis',
        sections: [
            {
                title: 'Definition',
                content: (
                    <div className="space-y-2">
                        <p className="text-sm"><span className="font-bold text-gray-900">Definition:</span> Sources with <span className="font-semibold text-blue-500">Low Visibility</span> but <span className="font-semibold text-emerald-600">Positive Sentiment</span>.</p>
                        <p className="text-sm"><span className="font-bold text-gray-900">Why it Matters:</span> These sources like your brand but don't mention you often enough. They represent the "low hanging fruit" for growth.</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Action: Increase Citations & Engagement</p>
                    </div>
                ),
                icon: LineChart,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            }
        ]
    },
    'source-monitor': {
        title: 'Monitor (Grey)',
        typeLabel: 'Strategic Analysis',
        sections: [
            {
                title: 'Definition',
                content: (
                    <div className="space-y-2">
                        <p className="text-sm"><span className="font-bold text-gray-900">Definition:</span> Sources with <span className="font-semibold text-blue-500">Low Visibility</span> and <span className="font-semibold text-rose-500">Negative/Neutral Sentiment</span>.</p>
                        <p className="text-sm"><span className="font-bold text-gray-900">Why it Matters:</span> Currently low impact, but can become risks if they grow. They are not an immediate priority for resources.</p>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-1">Action: Keep an Eye On</p>
                    </div>
                ),
                icon: CheckSquare,
                colorClass: 'text-slate-500',
                bgClass: 'bg-slate-50/50 border-slate-100/50'
            }
        ]
    },
    'table-feature-guide': {
        title: 'Top Sources Guide',
        typeLabel: 'Feature Guide',
        sections: [
            {
                title: 'Data Filtering',
                content: 'Use the top filters to refine the list by Date Range or specific Brand. The table allows effective searching by domain name to find specific partners.',
                icon: Table,
                colorClass: 'text-indigo-500',
                bgClass: 'bg-indigo-50/50 border-indigo-100/50'
            },
            {
                title: 'Heat Map Coloring',
                content: 'Cells are colored based on their relative performance. Green indicates high performance (top tier), Yellow is mid-range, and Red indicates an area for improvement.',
                icon: BarChart2,
                colorClass: 'text-emerald-500',
                bgClass: 'bg-emerald-50/50 border-emerald-100/50'
            },
            {
                title: 'Usage Context',
                content: 'Use this table to identify high-potential sources that are underperforming in specific metrics (e.g., high Impact Score but low Sentiment). Sorting by different columns reveals gaps in your strategy.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/50 border-amber-100/50'
            },
            {
                title: 'Trend Selection',
                content: 'Check the box next to any source to add it to the "Impact Score Trends" chart below. This allows you to compare the daily performance of specific competitors or partners.',
                icon: LineChart,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            }
        ]
    },
    'metric-impact-score': {
        title: 'Impact Score',
        typeLabel: 'Metric Definition',
        sections: [
            {
                title: 'Definition',
                content: 'A composite score (0-100) reflecting the overall value of a source. It combines Visibility, Share of Answer (SOA), Sentiment, and Citation volume into a single health metric.',
                icon: Target,
                colorClass: 'text-emerald-500',
                bgClass: 'bg-emerald-50/50 border-emerald-100/50'
            }
        ]
    },
    'metric-mention': {
        title: 'Mention Rate (%)',
        typeLabel: 'Metric Definition',
        sections: [
            {
                title: 'Definition',
                content: 'The percentage of AI responses for your keywords where this source appears. Higher mention rate means this source is a dominant authority in your topic.',
                icon: BarChart2,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            }
        ]
    },
    'metric-soa': {
        title: 'Share of Answer (SOA %)',
        typeLabel: 'Metric Definition',
        sections: [
            {
                title: 'Definition',
                content: 'Measures how much "space" your brand occupies in the answer when this source is cited. Usage: High Mention Rate but low SOA means the source mentions you, but only briefly.',
                icon: PieChart,
                colorClass: 'text-purple-500',
                bgClass: 'bg-purple-50/50 border-purple-100/50'
            }
        ]
    },
    'metric-sentiment': {
        title: 'Sentiment Score',
        typeLabel: 'Metric Definition',
        sections: [
            {
                title: 'Definition',
                content: 'A score from 0 (Negative) to 100 (Positive) indicating how this source portrays your brand. 50 is Neutral.',
                icon: Users,
                colorClass: 'text-rose-500',
                bgClass: 'bg-rose-50/50 border-rose-100/50'
            }
        ]
    },
    'metric-citations': {
        title: 'Citations Volume',
        typeLabel: 'Metric Definition',
        sections: [
            {
                title: 'Definition',
                content: 'The total number of times this source was cited across all AI responses. High citations indicate this source provides specific factual information that the AI relies on.',
                icon: BookOpen,
                colorClass: 'text-indigo-500',
                bgClass: 'bg-indigo-50/50 border-indigo-100/50'
            }
        ]
    },
    'trend-chart-guide': {
        title: 'Trend Analysis Guide',
        typeLabel: 'Feature Guide',
        sections: [
            {
                title: 'What\'s Being Displayed?',
                content: 'The Citation sources trend shows how the Impact/SOA/Sentiment/Citations are changing over time for selected set of Sources.',
                icon: LineChart,
                colorClass: 'text-indigo-500',
                bgClass: 'bg-indigo-50/50 border-indigo-100/50'
            },
            {
                title: 'Metric Insight',
                content: 'Metrics correlated to Citation sources indicate the Brand\'s performance across different Sources/channels.',
                icon: MousePointer2,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Strategic Value',
                content: 'A significant downward shift in these metrics will indicate potential gaps in the Brand\'s perception or Brand\'s content strategy on these channels.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/50 border-amber-100/50'
            },
            {
                title: 'Selected Sources',
                content: 'These charts reflect the specific sources you have selected in the table above (via checkboxes).',
                icon: CheckSquare,
                colorClass: 'text-emerald-500',
                bgClass: 'bg-emerald-50/50 border-emerald-100/50'
            }
        ]
    }
};

interface EducationalContentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    kpiType: KpiType | null;
}

export const EducationalContentDrawer = ({ isOpen, onClose, kpiType }: EducationalContentDrawerProps) => {
    const [content, setContent] = useState<EducationalContent | null>(null);

    useEffect(() => {
        if (kpiType) {
            setContent(contentMap[kpiType]);
        }
    }, [kpiType]);

    if (!content) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 border-l border-gray-100 overflow-y-auto"
                    >
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                        <HelpCircle size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 leading-tight">{content.title}</h2>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">{content.typeLabel}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-8">
                                {content.sections.map((section, index) => {
                                    const Icon = section.icon;
                                    return (
                                        <section key={index}>
                                            <div className={`flex items-center gap-2 mb-3 font-semibold ${section.colorClass ? section.colorClass.replace('text-', 'text-gray-900 ') : 'text-gray-900'}`}>
                                                <Icon size={18} className={section.colorClass} />
                                                <h3>{section.title}</h3>
                                            </div>
                                            {section.bgClass ? (
                                                <div className={`p-4 rounded-xl border text-sm text-gray-700 leading-relaxed ${section.bgClass}`}>
                                                    {section.content}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-600 leading-relaxed px-1">
                                                    {section.content}
                                                </p>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="mt-auto p-6 bg-gray-50 border-t border-gray-100">
                                <p className="text-xs text-center text-gray-400">
                                    Evidently AI Educational Content
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
