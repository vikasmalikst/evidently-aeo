import { useLocation, useNavigate } from 'react-router-dom';

interface SettingsNavItem {
  id: string;
  label: string;
  path: string;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    id: 'manage-brands',
    label: 'Manage Brands',
    path: '/settings/manage-brands',
  },
  {
    id: 'manage-competitors',
    label: 'Manage Competitors',
    path: '/settings/manage-competitors',
  },
  {
    id: 'topics-prompts-config-v2',
    label: 'Manage Topics & Prompts',
    path: '/settings/topics-prompts-config-v2',
  },
  {
    id: 'manage-collectors',
    label: 'Manage Collectors',
    path: '/settings/manage-collectors',
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export const SettingsLayout = ({ children }: SettingsLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/settings') {
      // For the main Settings page, check if we're exactly on /settings
      return location.pathname === '/settings';
    }
    // For other paths, use exact match
    return location.pathname === path;
  };

  // No filtering needed anymore
  const visibleNavItems = settingsNavItems;

  return (
    <div className="flex bg-[var(--bg-secondary)]" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Settings Navigation Sidebar */}
      <div className="w-64 bg-white border-r border-[var(--border-default)] flex-shrink-0 flex flex-col shadow-sm">
        <div className="p-6 border-b border-[var(--border-default)] bg-white">
          <h2 className="text-lg font-bold text-[var(--text-headings)] tracking-tight">Settings</h2>
          <p className="text-xs text-[var(--text-caption)] mt-1">Configure your workspace</p>
        </div>
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const active = isActive(item.path);

              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center px-4 py-3 transition-all duration-200 text-left rounded-lg group ${
                      active
                        ? 'bg-[var(--accent-primary)]/5 text-[var(--accent-primary)] font-semibold border-r-4 border-[var(--accent-primary)]'
                        : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-headings)]'
                    }`}
                  >
                    <span className="text-sm">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto py-8 px-8">
          {children}
        </div>
      </div>
    </div>
  );
};
