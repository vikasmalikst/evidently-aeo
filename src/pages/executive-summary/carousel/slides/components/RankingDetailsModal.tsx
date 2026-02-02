import React from 'react';
import { X, Trophy } from 'lucide-react';

export interface RankingDetailItem {
    kpi: string;
    target: { value: number; operator: '>' | '<'; label: string };
    avg: number;
    status: 'green' | 'yellow' | 'red';
    rank: number;
    compAvg: number;
    unit?: string;
}

interface RankingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    data: RankingDetailItem[];
    headerContent?: React.ReactNode;
}

export const RankingDetailsModal: React.FC<RankingDetailsModalProps> = ({ isOpen, onClose, title, description, data, headerContent }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Modal Panel */}
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        {headerContent}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                <Trophy className="w-6 h-6 mr-3 text-blue-600" />
                                {title}
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                {description}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Table Content */}
                <div className="p-8 overflow-auto bg-gray-50/50">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                                    <th className="px-6 py-4">KPI</th>
                                    <th className="px-6 py-4">Target</th>
                                    <th className="px-6 py-4">Avg (Brand)</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Rank</th>
                                    <th className="px-6 py-4 text-center">Competitor Avg</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.map((row, index) => (
                                    <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {row.kpi}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {row.target.label}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">
                                            {row.avg.toFixed(1)}{row.unit || ''}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto shadow-sm
                                                ${row.status === 'green' ? 'bg-green-500 shadow-green-200' :
                                                    row.status === 'yellow' ? 'bg-yellow-400 shadow-yellow-200' :
                                                        'bg-red-500 shadow-red-200'}`}
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 font-bold text-gray-700 text-sm border border-gray-200">
                                                {row.rank}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600 font-medium">
                                            {row.compAvg.toFixed(1)}{row.unit || ''}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 text-xs text-gray-400 text-center">
                        *Rank is calculated based on performance against all tracked competitors for the selected period.
                    </div>
                </div>
            </div>
        </div>
    );
};
