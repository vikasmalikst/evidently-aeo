import { useEffect, useState } from 'react';
import { X, HelpCircle, BookOpen, Target, BarChart2, Lightbulb, LineChart, Flag, DivideCircle, Table, MousePointer2, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type KpiType = 'visibility' | 'share' | 'sentiment' | 'brandPresence' | 'trend-analysis' | 'table-guide';

interface Section {
    title: string;
    content: string;
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
        title: 'Detailed Breakdown',
        typeLabel: 'Feature Guide',
        sections: [
            {
                title: 'What data is in this table?',
                content: 'This table provides a granular breakdown of performance by individual LLM model (e.g., GPT-4, Claude 3) or by Brand, depending on your view settings. It helps you identify exactly which models are driving your performance up or down.',
                icon: Table,
                colorClass: 'text-blue-500',
                bgClass: 'bg-blue-50/50 border-blue-100/50'
            },
            {
                title: 'Can I see more details?',
                content: 'Yes! Click on any row to expand it. Expanding a row reveals "Top Topics" associated with that model/brand, giving you insight into context—what are people actually asking when your brand appears?',
                icon: MousePointer2,
                colorClass: 'text-purple-500',
                bgClass: 'bg-purple-50/50 border-purple-100/50'
            },
            {
                title: 'How do I sort the data?',
                content: 'Clicking on any column header (like "Visibility Score" or "Sentiment") will sort the table by that metric. This is useful for quickly finding your best and worst performing areas.',
                icon: ArrowUpDown,
                colorClass: 'text-emerald-500'
            },
            {
                title: 'What do the "Change" indicators mean?',
                content: 'Next to metrics like Score and Share, you\'ll often see small arrows with percentages. These show the change compared to the previous period. Green indicates improvement, red indicates a decline.',
                icon: Lightbulb,
                colorClass: 'text-amber-500',
                bgClass: 'bg-amber-50/30 border-amber-100/50'
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
