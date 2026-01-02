/**
 * Status Filter Component
 * 
 * Dropdown filter for recommendation status (All, Pending Review, Approved, Rejected)
 * Enhanced with modern styling and icons
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
        return <IconFilter size={16} className="text-[#64748b]" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'all':
        return 'All Status';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'pending_review':
        return 'Pending Review';
      default:
        return status;
    }
  };

  return (
    <div className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8690a8] mb-2">
        Filter by Status
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {getStatusIcon(value)}
        </div>
        <select
          id="status-filter"
          value={value}
          onChange={(e) => onChange(e.target.value as 'all' | 'pending_review' | 'approved' | 'rejected')}
          aria-label="Filter by status"
          className="w-full pl-10 pr-10 py-2.5 border border-[#e4e7ec] rounded-lg text-[13px] font-medium text-[#1a1d29] bg-white cursor-pointer transition-all hover:border-[#cfd4e3] focus:outline-none focus:ring-2 focus:ring-[#00bcdc] focus:border-[#00bcdc] appearance-none"
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

