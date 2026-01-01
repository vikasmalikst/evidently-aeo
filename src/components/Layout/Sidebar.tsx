import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IconEye, IconForms, IconKey, IconSettings, IconLogout, IconFolderSearch, IconLayoutDashboard, IconTargetArrow, IconBulb, IconSparkles, IconBrandGoogleAnalytics } from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../lib/auth';
import { useManualBrandDashboard } from '../../manual-dashboard';
import { prefetchNow } from '../../lib/prefetch';

interface NavItem {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: IconLayoutDashboard, label: 'Performance Overview', path: '/' },
  { icon: IconEye, label: 'Metrics Analysis', path: '/search-visibility' },
  { icon: IconTargetArrow, label: 'Citations Sources', path: '/search-sources' },
  { icon: IconFolderSearch, label: 'Topics', path: '/topics' },
  { icon: IconForms, label: 'Prompts', path: '/prompts' },
  { icon: IconKey, label: 'Keywords', path: '/keywords' },
  { icon: IconBulb, label: 'Recommendations', path: '/recommendations' },
  { icon: IconSparkles, label: 'Recommendations V3', path: '/recommendations-v3' },
  { icon: IconBrandGoogleAnalytics, label: 'Google Analytics', path: '/google-analytics' },
];

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { selectedBrandId } = useManualBrandDashboard();

  const isActive = (path: string) => location.pathname === path;

  // Generate prefetch endpoints for each nav item
  const getPrefetchEndpoint = (path: string): string | null => {
    if (!selectedBrandId) return null;
    
    // Normalize dates to avoid cache misses due to changing timestamps.
    // This prevents hammering the backend with unique URLs on every hover.
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCHours(0, 0, 0, 0);
    const toDateOnly = (d: Date) => d.toISOString().split('T')[0];
    
    switch (path) {
      case '/':
        start.setDate(start.getDate() - 29);
        return `/brands/${selectedBrandId}/dashboard?startDate=${toDateOnly(start)}&endDate=${toDateOnly(end)}`;
      case '/search-visibility':
        start.setDate(start.getDate() - 6);
        // SearchVisibility uses ISO timestamps; keep them stable (midnight -> end-of-day)
        return `/brands/${selectedBrandId}/dashboard?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      case '/search-sources':
        start.setDate(start.getDate() - 30);
        // SearchSources uses date-only params
        return `/brands/${selectedBrandId}/sources?startDate=${toDateOnly(start)}&endDate=${toDateOnly(end)}`;
      case '/topics':
        // Match Topics page default range so prefetch warms the correct cache key
        start.setDate(start.getDate() - 29);
        return `/brands/${selectedBrandId}/topics?startDate=${toDateOnly(start)}&endDate=${toDateOnly(end)}`;
      case '/prompts':
        start.setDate(start.getDate() - 30);
        // Prompts uses ISO timestamps (page normalizes to day bounds)
        return `/brands/${selectedBrandId}/prompts?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
      default:
        return null;
    }
  };

  const handleNavHover = (path: string) => {
    // Prefetch-on-hover can overwhelm local dev backend and make pages appear “stuck”.
    // Disable it in dev completely. (Production build is unaffected.)
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV) {
      return;
    }
    const endpoint = getPrefetchEndpoint(path);
    if (endpoint) {
      prefetchNow(endpoint, {}, { requiresAuth: true });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const handleMouseEnter = () => {
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    setIsExpanded(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/auth');
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email ? email[0].toUpperCase() : '?';
  };

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-[var(--border-default)] flex flex-col shadow-sm z-50 transition-all duration-300 ease-in-out"
      style={{ width: isExpanded ? '240px' : '72px' }}
    >
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onMouseEnter={() => handleNavHover(item.path)}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 ease-in-out relative overflow-hidden group hover:bg-[var(--bg-secondary)]"
                >
                  <div
                    className={`flex-shrink-0 relative z-10 transition-all duration-300 rounded-lg p-1.5 ${
                      active
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'text-[var(--text-headings)] group-hover:bg-[var(--border-default)]'
                    }`}
                  >
                    <Icon size={20} className="transition-colors duration-300" />
                  </div>

                  <span
                    className={`whitespace-nowrap font-medium text-sm relative z-10 transition-all duration-300 ease-in-out text-[var(--text-headings)] ${
                      isExpanded
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-[var(--border-default)] p-3 space-y-2">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-3 rounded-lg w-full transition-all duration-300 ease-in-out ${
            isActive('/settings') || location.pathname.startsWith('/settings')
              ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
              : 'text-[var(--text-headings)] hover:bg-[var(--bg-secondary)]'
          }`}
        >
          <div className="flex-shrink-0 relative z-10">
            <IconSettings size={24} className="transition-colors duration-300" />
          </div>
          <span
            className={`whitespace-nowrap font-medium text-sm relative z-10 transition-all duration-300 ease-in-out ${
              isExpanded
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
            }`}
          >
            Settings
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-3 rounded-lg w-full transition-all duration-300 ease-in-out text-[var(--text-body)] hover:bg-[var(--bg-secondary)] min-w-0 overflow-hidden"
          >
            <div className="flex-shrink-0 relative z-10">
              <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-xs font-semibold">
                {getInitials(user?.fullName || null, user?.email || '')}
              </div>
            </div>
            <span
              className={`font-medium text-sm relative z-10 transition-all duration-300 ease-in-out ${
                isExpanded
                  ? 'opacity-100 translate-x-0 flex-1 min-w-0 truncate block'
                  : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
              }`}
              title={user?.email || ''}
            >
              {user?.email}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-[var(--border-default)] rounded-lg shadow-lg overflow-hidden z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-body)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <IconLogout size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
