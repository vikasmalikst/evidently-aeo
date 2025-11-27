import { MessageSquare, Activity, ExternalLink } from 'lucide-react';
import { ActionCard } from './ActionCard';

export const QuickActions = () => {
  return (
    <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[18px] font-semibold text-[#1a1d29]">
          Quick Actions
        </h2>
      </div>

      <div className="space-y-3">
        <ActionCard
          title="Analyze Prompts"
          description="Review AI responses to tracked queries"
          link="/prompts"
          icon={<MessageSquare size={18} />}
          color="#498cf9"
        />
        <ActionCard
          title="Track Keywords"
          description="Monitor keyword impact and associations"
          link="/keywords"
          icon={<Activity size={18} />}
          color="#06c686"
        />
        <ActionCard
          title="Citation Sources"
          description="Explore domains citing your brand"
          link="/search-sources"
          icon={<ExternalLink size={18} />}
          color="#fa8a40"
        />
      </div>
    </div>
  );
};

