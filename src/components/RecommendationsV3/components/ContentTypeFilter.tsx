import { IconFileText } from '@tabler/icons-react';

interface ContentTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export const ContentTypeFilter = ({ value, onChange, options }: ContentTypeFilterProps) => {
  return (
    <div className="relative">
      <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-2">
        Content Type
      </label>
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-200 group-hover:scale-110">
          <IconFileText size={16} className="text-[#00bcdc] transition-colors duration-200" />
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Filter by content type"
          className="w-full pl-10 pr-10 py-2.5 border border-[#e2e8f0] hover:border-[#00bcdc]/40 rounded-xl text-[13px] font-medium text-[#1a1d29] bg-white cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#00bcdc]/30 focus:border-[#00bcdc] appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L10 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundSize: '10px 6px',
            backgroundPosition: 'right 12px center',
            backgroundRepeat: 'no-repeat'
          }}
        >
          <option value="all">All Types</option>
          {options.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
