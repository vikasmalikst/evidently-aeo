import React, { useMemo } from 'react';
import { TopicsAnalysisData } from '../types';
import { generateKeyTakeaways, TakeawayType } from '../utils/SourcesTakeawayGenerator';
import { Sparkles, ArrowUp, ArrowDown } from 'lucide-react';

interface KeyTakeawaysProps {
    data: TopicsAnalysisData;
    metricType?: 'share' | 'visibility' | 'sentiment' | 'brandPresence';
}

export const KeyTakeaways: React.FC<KeyTakeawaysProps> = ({ data, metricType = 'share' }) => {
    const takeaways = useMemo(() => generateKeyTakeaways(data, metricType), [data, metricType]);

    // Limit to top 4 takeaways
    const displayTakeaways = takeaways.slice(0, 4);

    if (!displayTakeaways.length) return null;

    return (
        <div className="flex flex-col gap-4 bg-white rounded-xl p-5 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] mb-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-1">
                <h3 className="text-base font-semibold text-gray-900 m-0 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Key Takeaways
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayTakeaways.map((takeaway) => {
                    // Dynamic styles based on type
                    let bgClass = 'bg-gray-50';
                    let borderClass = 'border-gray-200';
                    let accentColor = '#6b7280';
                    let badgeClass = 'text-gray-700 bg-gray-100';

                    switch (takeaway.type) {
                        case 'summary':
                            bgClass = 'bg-blue-50/50';
                            borderClass = 'border-blue-100';
                            accentColor = '#3b82f6';
                            badgeClass = 'text-blue-700 bg-white/60';
                            break;
                        case 'issue':
                            bgClass = 'bg-red-50/50';
                            borderClass = 'border-red-100';
                            accentColor = '#ef4444';
                            badgeClass = 'text-red-700 bg-white/60';
                            break;
                        case 'opportunity':
                            bgClass = 'bg-orange-50/50';
                            borderClass = 'border-orange-100';
                            accentColor = '#f59e0b';
                            badgeClass = 'text-orange-700 bg-white/60';
                            break;
                        case 'insight':
                            bgClass = 'bg-gray-50';
                            borderClass = 'border-gray-200';
                            accentColor = '#6b7280';
                            badgeClass = 'text-gray-700 bg-gray-100';
                            break;
                    }

                    return (
                        <div
                            key={takeaway.id}
                            className={`rounded-lg p-4 flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-sm border border-l-4 ${bgClass} ${borderClass}`}
                            style={{ borderLeftColor: accentColor }}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <h4 className="text-sm font-semibold text-gray-900 m-0 leading-snug">
                                    {takeaway.title}
                                </h4>
                                <span className={`text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 ${badgeClass}`}>
                                    {takeaway.type}
                                </span>
                            </div>

                            <p className="text-[13px] text-gray-600 m-0 leading-normal">
                                {takeaway.description}
                            </p>

                            {takeaway.metric && (
                                <div className="flex items-center gap-2 mt-auto pt-3">
                                    <span className="text-xs text-gray-500 font-medium">
                                        {takeaway.metric.label}:
                                    </span>
                                    <span className={`text-[13px] font-semibold flex items-center gap-0.5 ${takeaway.metric.color === 'positive' ? 'text-emerald-600' :
                                        takeaway.metric.color === 'negative' ? 'text-red-600' : 'text-gray-700'
                                        }`}>
                                        {takeaway.metric.trend === 'up' && <ArrowUp className="w-3 h-3" />}
                                        {takeaway.metric.trend === 'down' && <ArrowDown className="w-3 h-3" />}
                                        {takeaway.metric.value}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
