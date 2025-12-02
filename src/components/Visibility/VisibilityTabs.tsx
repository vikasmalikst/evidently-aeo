import { Eye, Users } from 'lucide-react';

interface VisibilityTabsProps {
  activeTab: 'brand' | 'competitive';
  onTabChange: (tab: 'brand' | 'competitive') => void;
  className?: string;
}

const TAB_DETAILS = [
  {
    id: 'brand' as const,
    label: 'Brand Visibility',
    description: 'See how your brand performs across collectors',
    Icon: Eye
  },
  {
    id: 'competitive' as const,
    label: 'Competitive Visibility',
    description: 'Benchmark against the competitors you track',
    Icon: Users
  }
];

export const VisibilityTabs = ({
  activeTab,
  onTabChange,
  className = ''
}: VisibilityTabsProps) => {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {TAB_DETAILS.map(({ id, label, description, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            aria-pressed={isActive}
            onClick={() => onTabChange(id)}
            className={`group relative flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 ${
              isActive
                ? 'border-transparent bg-gradient-to-r from-[#06b6d4] via-[#3b82f6] to-[#6366f1] text-white shadow-[0_20px_30px_rgba(15,23,42,0.22)]'
                : 'border-[#e3e7f3] bg-white/80 text-[#1f2a37] hover:border-[#06b6d4] hover:text-[#0f172a] hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
                isActive ? 'bg-white/20 text-white' : 'bg-[#eef1ff] text-[#7177a8]'
              }`}
            >
              <Icon size={18} />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">{label}</span>
              <span
                className={`text-[11px] font-medium ${
                  isActive ? 'text-white/80' : 'text-[#8f96b5]'
                }`}
              >
                {description}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
