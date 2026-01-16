import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IconGauge,
  IconAnalyze,
  IconSparkles,
  IconChartBar,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconChevronRight,
  IconQuote,
  IconCategory,
  IconMessageQuestion,
  IconKey,
  IconShieldCheck,
  IconBulb,
  IconChecklist,
  IconRocket,
  IconTrendingUp,
  IconMessages,
} from '@tabler/icons-react';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../lib/auth';

interface NavChild {
  label: string;
  path: string;
  icon?: React.ComponentType<{ size?: number | string; className?: string }>;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  path?: string;
  children?: NavChild[];
}

const navItems: NavItem[] = [
  {
    id: 'measure',
    label: 'Measure',
    icon: IconGauge,
    path: '/measure',
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: IconAnalyze,
    children: [
      { label: 'Top Citation Sources', path: '/analyze/citation-sources', icon: IconQuote },
      { label: 'Topics', path: '/analyze/topics', icon: IconCategory },
      { label: 'Queries', path: '/analyze/queries', icon: IconMessageQuestion },
      { label: 'Queries & Answers', path: '/analyze/queries-answers', icon: IconMessages },
      { label: 'Keywords', path: '/analyze/keywords', icon: IconKey },
      { label: 'Domain Readiness', path: '/analyze/domain-readiness', icon: IconShieldCheck },
    ],
  },
  {
    id: 'improve',
    label: 'Improve Outcomes',
    icon: IconSparkles,
    children: [
      { label: 'Discover Opportunities', path: '/improve/discover', icon: IconBulb },
      { label: 'To-Do List', path: '/improve/action-plan', icon: IconChecklist },
      { label: 'Review and Refine', path: '/improve/execute', icon: IconRocket },
      { label: 'Track Outcomes', path: '/improve/impact', icon: IconTrendingUp },
    ],
  },
  {
    id: 'executive-reporting',
    label: 'Executive Reporting',
    icon: IconChartBar,
    path: '/executive-reporting',
  },
];

export const NewSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Check if a path or any of its children are active
  const isPathActive = (path: string) => location.pathname === path;

  const isChildActive = (children?: NavChild[]) => {
    if (!children) return false;
    return children.some(child => location.pathname === child.path);
  };

  const isSectionActive = (item: NavItem) => {
    if (item.path) return isPathActive(item.path);
    return isChildActive(item.children);
  };

  // Auto-expand sections when their children are active
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && isChildActive(item.children)) {
        setExpandedSections(prev => new Set(prev).add(item.id));
      }
    });
  }, [location.pathname]);

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

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
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

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded_ = expandedSections.has(item.id);
    const active = isSectionActive(item);

    if (hasChildren) {
      return (
        <li key={item.id}>
          {/* Parent item with expand/collapse */}
          <button
            onClick={() => toggleSection(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 ease-in-out relative overflow-hidden group hover:bg-[var(--bg-secondary)] ${active ? 'bg-[var(--bg-secondary)]' : ''
              }`}
          >
            <div
              className={`flex-shrink-0 relative z-10 transition-all duration-300 rounded-lg p-1.5 ${active
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-headings)] group-hover:bg-[var(--border-default)]'
                }`}
            >
              <Icon size={20} className="transition-colors duration-300" />
            </div>

            <span
              className={`flex-1 text-left whitespace-nowrap font-medium text-sm relative z-10 transition-all duration-300 ease-in-out text-[var(--text-headings)] ${isExpanded
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                }`}
            >
              {item.label}
            </span>

            {/* Chevron for expand/collapse */}
            <span
              className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'
                }`}
            >
              {isExpanded_ ? (
                <IconChevronDown size={16} className="text-[var(--text-caption)]" />
              ) : (
                <IconChevronRight size={16} className="text-[var(--text-caption)]" />
              )}
            </span>
          </button>

          {/* Child items */}
          <ul
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded_ && isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
          >
            {item.children?.map((child) => {
              const ChildIcon = child.icon;
              const childActive = isPathActive(child.path);

              return (
                <li key={child.path}>
                  <Link
                    to={child.path}
                    className={`flex items-center gap-3 pl-10 pr-3 py-2.5 rounded-lg transition-all duration-200 ${childActive
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium'
                        : 'text-[var(--text-body)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-headings)]'
                      }`}
                  >
                    {ChildIcon && (
                      <ChildIcon
                        size={16}
                        className={`flex-shrink-0 ${childActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-caption)]'
                          }`}
                      />
                    )}
                    <span className="text-sm whitespace-nowrap">{child.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </li>
      );
    }

    // Simple nav item without children
    return (
      <li key={item.id}>
        <Link
          to={item.path!}
          className="flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-300 ease-in-out relative overflow-hidden group hover:bg-[var(--bg-secondary)]"
        >
          <div
            className={`flex-shrink-0 relative z-10 transition-all duration-300 rounded-lg p-1.5 ${active
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-headings)] group-hover:bg-[var(--border-default)]'
              }`}
          >
            <Icon size={20} className="transition-colors duration-300" />
          </div>

          <span
            className={`whitespace-nowrap font-medium text-sm relative z-10 transition-all duration-300 ease-in-out text-[var(--text-headings)] ${isExpanded
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
              }`}
          >
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-[var(--border-default)] flex flex-col shadow-sm z-50 transition-all duration-300 ease-in-out"
      style={{ width: isExpanded ? '260px' : '72px' }}
    >
      <nav className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {navItems.map(renderNavItem)}
        </ul>
      </nav>

      <div className="border-t border-[var(--border-default)] p-3 space-y-2">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-3 rounded-lg w-full transition-all duration-300 ease-in-out ${isPathActive('/settings') || location.pathname.startsWith('/settings')
              ? 'bg-[var(--bg-secondary)] text-[var(--accent-primary)]'
              : 'text-[var(--text-headings)] hover:bg-[var(--bg-secondary)]'
            }`}
        >
          <div className="flex-shrink-0 relative z-10">
            <IconSettings size={24} className="transition-colors duration-300" />
          </div>
          <span
            className={`whitespace-nowrap font-medium text-sm relative z-10 transition-all duration-300 ease-in-out ${isExpanded
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
              className={`font-medium text-sm relative z-10 transition-all duration-300 ease-in-out ${isExpanded
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
