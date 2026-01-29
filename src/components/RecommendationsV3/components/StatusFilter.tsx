/**
 * Status Filter Component
 * 
 * Dropdown filter for recommendation status (All, Pending Review, Approved, Rejected)
 * Enhanced with modern styling, shadows, and dynamic icons
 */

import { IconFilter, IconCheck, IconClock, IconX } from '@tabler/icons-react';

interface StatusFilterProps {
  value: 'all' | 'pending_review' | 'approved' | 'rejected';
  onChange: (value: 'all' | 'pending_review' | 'approved' | 'rejected') => void;
}

export const StatusFilter = ({ value, onChange }: StatusFilterProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <IconCheck size={16} className="text-[#06c686]" />;
      case 'rejected':
        return <IconX size={16} className="text-[#ef4444]" />;
      case 'pending_review':
        return <IconClock size={16} className="text-[#f59e0b]" />;
      default:
        return <IconFilter size={16} className="text-[#00bcdc]" />;
    }
  };

  const getBorderColor = () => {
    switch (value) {
      case 'approved':
        return 'border-[#06c686]/30 hover:border-[#06c686]/50';
      case 'rejected':
        return 'border-[#ef4444]/30 hover:border-[#ef4444]/50';
      case 'pending_review':
        return 'border-[#f59e0b]/30 hover:border-[#f59e0b]/50';
      default:
        return 'border-[#e2e8f0] hover:border-[#00bcdc]/40';
    }
  };

  return (
    <div className="relative">
      <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-2">
        Filter by Status
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-hover:scale-110">
          {getStatusIcon(value)}
        </div>
        <select
          id="status-filter"
          value={value}
          onChange={(e) => onChange(e.target.value as 'all' | 'pending_review' | 'approved' | 'rejected')}
          aria-label="Filter by status"
          className={`w-full pl-10 pr-10 py-2.5 border ${getBorderColor()} rounded-xl text-[13px] font-medium text-[#1a1d29] bg-white cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/30 focus:border-[#00bcdc] appearance-none`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L10 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundSize: '10px 6px',
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <option value="all">All Status</option>
          <option value="pending_review">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  );
};
