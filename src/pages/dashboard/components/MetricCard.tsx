import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { MetricCardProps } from '../types';
import { InfoTooltip } from './InfoTooltip';

export const MetricCard = ({ title, value, subtitle, trend, icon, color, linkTo, description }: MetricCardProps) => (
  <div className="bg-white border border-[#e8e9ed] rounded-lg shadow-sm p-5 flex flex-col">
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div className="flex items-center gap-1.5 flex-1">
        <div className="text-[14px] font-semibold text-[#1a1d29]">{title}</div>
        {description && <InfoTooltip description={description} />}
      </div>
    </div>
    <div className="flex items-end gap-2 mb-1">
      <div className="text-[28px] font-bold text-[#1a1d29] leading-none">{value}</div>
      {trend.direction !== 'stable' && (
        <div className={`flex items-center gap-0.5 text-[11px] font-semibold pb-1 ${
          trend.direction === 'up' ? 'text-[#06c686]' : 'text-[#f94343]'
        }`}>
          {trend.direction === 'up' ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    {subtitle && <div className="text-[12px] text-[#64748b] mb-auto">{subtitle}</div>}
    <div className="mt-4 pt-3 border-t border-[#e8e9ed]">
      <Link
        to={linkTo}
        className="text-[12px] text-[#64748b] hover:text-[#00bcdc] transition-colors"
      >
        See analysis →
      </Link>
    </div>
  </div>
);

