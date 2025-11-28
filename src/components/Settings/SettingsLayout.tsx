import { useLocation, useNavigate } from 'react-router-dom';

interface SettingsNavItem {
  id: string;
  label: string;
  path: string;
}

const settingsNavItems: SettingsNavItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
  },
  {
    id: 'manage-prompts',
    label: 'Prompts & Topics',
    path: '/settings/manage-prompts',
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

  return (
    <div className="flex" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Settings Navigation Sidebar */}
      <div className="w-64 bg-white border-r border-[var(--border-default)] flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-[var(--border-default)]">
          <h2 className="text-lg font-semibold text-[var(--text-headings)]">Settings</h2>
        </div>
        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {settingsNavItems.map((item) => {
              const active = isActive(item.path);

              return (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center px-3 py-2.5 transition-all text-left ${
                      active
                        ? 'text-[var(--text-headings)]'
                        : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)] rounded-lg'
                    }`}
                  >
                    <span className="text-sm relative">
                      {item.label}
                      {active && (
                        <span className="absolute left-0 h-0.5 bg-[#00bcdc]" style={{ width: '100%', bottom: '-2px' }}></span>
                      )}
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
        {children}
      </div>
    </div>
  );
};

