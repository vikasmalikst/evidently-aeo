import React from 'react';
import { Info, ChevronRight, Trophy } from 'lucide-react';

interface RankingRowProps {
    rank: number;
    kpiName: string;
    kpiDefinition: string;
    color?: string; // Hex color for the circle
}

export const RankingRow: React.FC<RankingRowProps> = ({ rank, kpiName, kpiDefinition, color = '#3b82f6' }) => {
    return (
        <div className="flex items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
            {/* Rank Circle */}
            <div className="flex-shrink-0 mr-6 text-center">
                <div
                    className="w-16 h-16 rounded-full flex flex-col items-center justify-center text-white shadow-lg mx-auto"
                    style={{ backgroundColor: color }}
                >
                    <span className="text-[10px] font-bold uppercase opacity-80 leading-none mb-0.5">Rank</span>
                    <span className="text-2xl font-bold leading-none">{rank}</span>
                </div>
            </div>

            {/* Text Content */}
            <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center">
                    {kpiName}
                    {rank === 1 && <Trophy className="w-5 h-5 text-yellow-500 ml-2" />}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-2xl">
                    {kpiDefinition}
                </p>
            </div>
        </div>
    );
};
