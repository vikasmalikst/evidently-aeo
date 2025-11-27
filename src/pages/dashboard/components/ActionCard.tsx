import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ActionCardProps } from '../types';

export const ActionCard = ({ title, description, link, icon, color }: ActionCardProps) => (
  <Link
    to={link}
    className="block p-3 border border-[#e8e9ed] rounded-lg hover:border-[#00bcdc] hover:bg-[#f9fbfc] transition-all group"
  >
    <div className="flex items-start gap-3">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-medium text-[#1a1d29] mb-1 group-hover:text-[#00bcdc] transition-colors">
          {title}
        </h3>
        <p className="text-[12px] text-[#64748b]">{description}</p>
      </div>
      <ArrowRight size={16} className="text-[#c6c9d2] group-hover:text-[#00bcdc] transition-colors flex-shrink-0 mt-1" />
    </div>
  </Link>
);

