interface SourceTabsProps {
  activeTab: 'top-sources' | 'source-coverage';
  onTabChange: (tab: 'top-sources' | 'source-coverage') => void;
}

export const SourceTabs = ({ activeTab, onTabChange }: SourceTabsProps) => {
  const tabs = [
    { id: 'top-sources' as const, label: 'Top Sources' },
    { id: 'source-coverage' as const, label: 'Source Coverage' }
  ];

  return (
    <div className="flex items-center bg-white px-8">
      <div className="flex items-center gap-0">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-3
                text-sm font-medium
                border-b-2
                transition-all duration-200
                whitespace-nowrap
                ${
                  isActive
                    ? 'text-[#00bcdc] border-[#00bcdc]'
                    : 'text-[#6c7289] border-transparent hover:text-[#212534]'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
