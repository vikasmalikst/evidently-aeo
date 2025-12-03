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
    <div className={`flex items-center gap-0 ${className}`}>
      {TAB_DETAILS.map(({ id, label, Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            aria-pressed={isActive}
            onClick={() => onTabChange(id)}
            className={`
              px-4 py-3
              text-sm font-medium
              border-b-2
              transition-all duration-200
              whitespace-nowrap
              flex items-center gap-2
              ${
                isActive
                  ? 'text-[#00bcdc] border-[#00bcdc]'
                  : 'text-[#6c7289] border-transparent hover:text-[#212534]'
              }
            `}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
};
