/**
 * Priority Filter Component
 * 
 * Dropdown filter for recommendation priority (All, High, Medium, Low)
 * Enhanced with modern styling, shadows, and dynamic colors
 */

import { IconFlag } from '@tabler/icons-react';

interface PriorityFilterProps {
  value: 'all' | 'High' | 'Medium' | 'Low';
  onChange: (value: 'all' | 'High' | 'Medium' | 'Low') => void;
}

export const PriorityFilter = ({ value, onChange }: PriorityFilterProps) => {
  const getIconColor = () => {
    switch (value) {
      case 'High':
        return 'text-[#ef4444]';
      case 'Medium':
        return 'text-[#f59e0b]';
      case 'Low':
        return 'text-[#06c686]';
      default:
        return 'text-[#00bcdc]';
    }
  };

  const getBorderColor = () => {
    switch (value) {
      case 'High':
        return 'border-[#ef4444]/30 hover:border-[#ef4444]/50';
      case 'Medium':
        return 'border-[#f59e0b]/30 hover:border-[#f59e0b]/50';
      case 'Low':
        return 'border-[#06c686]/30 hover:border-[#06c686]/50';
      default:
        return 'border-[#e2e8f0] hover:border-[#00bcdc]/40';
    }
  };

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-2">
        Priority
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-hover:scale-110">
          <IconFlag size={16} className={`${getIconColor()} transition-colors duration-200`} />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as 'all' | 'High' | 'Medium' | 'Low')}
          aria-label="Filter by priority"
          className={`w-full pl-10 pr-10 py-2.5 border ${getBorderColor()} rounded-xl text-[13px] font-medium text-[#1a1d29] bg-white cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/30 focus:border-[#00bcdc] appearance-none`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L10 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundSize: '10px 6px',
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
    </div>
  );
};
