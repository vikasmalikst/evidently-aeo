import { CheckCircle } from 'lucide-react';
import type { ActionItem } from '../types';
import { EmptyState } from './EmptyState';

interface RecommendedActionsProps {
  actionItems: ActionItem[];
}

export const RecommendedActions = ({ actionItems }: RecommendedActionsProps) => {
  return (
    <div className="mt-5 pt-5 border-t border-[#e8e9ed]">
      <h3 className="text-[14px] font-semibold text-[#1a1d29] mb-3">Recommended Actions</h3>
      {actionItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {actionItems.slice(0, 4).map((item: ActionItem) => (
            <div key={item.id} className="flex items-start gap-2 p-3 bg-[#f9f9fb] rounded-lg">
              <CheckCircle size={16} className="text-[#06c686] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] text-[#1a1d29] font-medium">{item.title}</p>
                <p className="text-[12px] text-[#64748b]">{item.description}</p>
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

