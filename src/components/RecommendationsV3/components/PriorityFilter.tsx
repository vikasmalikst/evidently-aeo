/**
 * Priority Filter Component
 * 
 * Dropdown filter for recommendation priority (All, High, Medium, Low)
 */

import { IconFlag } from '@tabler/icons-react';

interface PriorityFilterProps {
  value: 'all' | 'High' | 'Medium' | 'Low';
  onChange: (value: 'all' | 'High' | 'Medium' | 'Low') => void;
}

export const PriorityFilter = ({ value, onChange }: PriorityFilterProps) => {
  const getLabel = () => {
    if (value === 'all') return 'All Priorities';
    return value;
  };

  return (
    <div className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8690a8] mb-2">
        Priority
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <IconFlag size={16} className="text-[#64748b]" />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as 'all' | 'High' | 'Medium' | 'Low')}
          aria-label="Filter by priority"
          className="w-full pl-10 pr-10 py-2.5 border border-[#e4e7ec] rounded-lg text-[13px] font-medium text-[#1a1d29] bg-white cursor-pointer transition-all hover:border-[#cfd4e3] focus:outline-none focus:ring-2 focus:ring-[#00bcdc] focus:border-[#00bcdc] appearance-none"
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
