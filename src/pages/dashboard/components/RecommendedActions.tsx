import { CheckCircle, Flame, Activity, Rocket } from 'lucide-react';
import type { ActionItem } from '../types';
import { EmptyState } from './EmptyState';

interface RecommendedActionsProps {
  actionItems: ActionItem[];
}

export const RecommendedActions = ({ actionItems }: RecommendedActionsProps) => {
  const priorityStyles: Record<ActionItem['priority'], string> = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  const categoryChip: Record<ActionItem['category'], { label: string; icon: JSX.Element; tone: string }> = {
    content: {
      label: 'Content',
      icon: <Flame size={14} />,
      tone: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    technical: {
      label: 'Technical',
      icon: <Activity size={14} />,
      tone: 'bg-slate-50 text-slate-700 border-slate-200'
    },
    distribution: {
      label: 'Distribution',
      icon: <Rocket size={14} />,
      tone: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    monitoring: {
      label: 'Monitoring',
      icon: <CheckCircle size={14} />,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-1">
            Top Priorities
          </h3>
          <p className="text-[11px] text-[#64748b]">Data-driven actions ranked by impact</p>
        </div>
        {actionItems.length > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-[#f4f5f9] text-[#475569] border border-[#e8e9ed]">
            {actionItems.length} action{actionItems.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {actionItems.length > 0 ? (
        <div className="space-y-3">
          {actionItems.slice(0, 3).map((item: ActionItem, index: number) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-4 bg-gradient-to-br from-white to-[#f8fafc] border rounded-xl shadow-[0_4px_14px_rgba(20,20,20,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(20,20,20,0.08)] ${
                index === 0 
                  ? 'border-[#0ea5e9] border-2 bg-gradient-to-br from-[#f0f9ff] to-white' 
                  : 'border-[#e8e9ed]'
              }`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold text-[13px] ${
                index === 0 
                  ? 'bg-[#0ea5e9] text-white' 
                  : index === 1
                  ? 'bg-[#06c686] text-white'
                  : 'bg-[#e8fff4] text-[#06c686]'
              }`}>
                {index === 0 ? '1' : index === 1 ? '2' : '3'}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] text-[#0f172a] font-semibold leading-snug">
                    {item.title}
                  </p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${priorityStyles[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
                <p className="text-[12px] text-[#475569] leading-relaxed">
                  {item.description}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${categoryChip[item.category].tone}`}
                  >
                    {categoryChip[item.category].icon}
                    {categoryChip[item.category].label}
                  </span>
                  {index === 0 && (
                    <span className="text-[11px] text-[#0ea5e9] font-medium">
                      ⭐ Top Priority
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No tailored recommendations yet. Check back after more data is collected." />
      )}
    </div>
  );
};

