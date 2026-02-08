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
  IconActivity,
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
  stepNumber?: number;
}

const navItems: NavItem[] = [
  {
    id: 'measure',
    label: 'Measure',
    icon: IconGauge,
    path: '/measure',
    stepNumber: 1,
  },
  {
    id: 'analyze',
    label: 'Analyze',
    icon: IconAnalyze,
    children: [
      { label: 'Citation Sources', path: '/analyze/citation-sources', icon: IconQuote },
      { label: 'Topics', path: '/analyze/topics', icon: IconCategory },
      { label: 'Queries', path: '/analyze/queries', icon: IconMessageQuestion },
      { label: 'Queries & Answers', path: '/analyze/queries-answers', icon: IconMessages },
      // { label: 'Keywords', path: '/analyze/keywords', icon: IconKey },
      // { label: 'Sentiment Graph', path: '/analyze/keywords-graph', icon: IconKey },
      { label: 'Domain Readiness', path: '/analyze/domain-readiness', icon: IconShieldCheck },
    ],
    stepNumber: 2,
  },
  {
    id: 'improve',
    label: 'Optimize',
    icon: IconSparkles,
    children: [
      { label: 'Opportunities', path: '/improve/discover', icon: IconBulb },
      { label: 'Plan', path: '/improve/action-plan', icon: IconChecklist },
      { label: 'Generation and Refine', path: '/improve/execute', icon: IconRocket },
      { label: 'Outcome Tracker', path: '/improve/impact', icon: IconTrendingUp },
    ],
    stepNumber: 3,
  },
  {
    id: 'executive-reporting',
    label: 'Reports',
    icon: IconChartBar,
    path: '/executive-reporting',
  },
];

const adminNavItems: NavItem[] = [
  {
    id: 'admin',
    label: 'Admin',
    icon: IconShieldCheck,
    children: [
      { label: 'Entitlements', path: '/admin/entitlements', icon: IconChecklist },
      { label: 'Scheduled Jobs', path: '/admin/scheduled-jobs', icon: IconGauge },
      { label: 'Operations', path: '/admin/operations', icon: IconActivity },
      { label: 'Data Collection Status', path: '/admin/data-collection-status', icon: IconAnalyze },
      { label: 'Collection Stats', path: '/admin/collection-stats', icon: IconChartBar },
    ],
  },
];

// Map specific paths or labels to feature entitlement keys
const getFeatureForPath = (path: string): string | null => {
  if (path.includes('/analyze/topics')) return 'analyze_topics';
  if (path.includes('/analyze/keywords')) return 'analyze_keywords';
  if (path.includes('/analyze/citation-sources')) return 'analyze_citation_sources';
  if (path.includes('/analyze/queries')) return 'analyze_queries';
  if (path.includes('/analyze/domain-readiness')) return 'analyze_domain_readiness';
  if (path.includes('/improve/')) return 'recommendations';
  if (path.includes('/executive-reporting')) return 'executive_reporting';
  if (path.includes('/measure')) return 'measure';
  return null;
};

export const NewSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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

  // Helper to check if a feature is enabled
  const isFeatureEnabled = (path?: string) => {
    if (!path) return true;
    const feature = getFeatureForPath(path);
    if (!feature) return true;

    // Default to true if entitlements are missing to avoid blocking by default
    return user?.settings?.entitlements?.features?.[feature] ?? true;
  };

  // Auto-expand sections when their children are active
  useEffect(() => {
    navItems.forEach(item => {
      if (item.children && isChildActive(item.children)) {
        setExpandedSections(prev => new Set(prev).add(item.id));
      }
    });
    adminNavItems.forEach(item => {
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
    setHoveredItem(null);
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

  const renderNavItem = (item: NavItem, index: number) => {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded_ = expandedSections.has(item.id);
    const active = isSectionActive(item);
    const isHovered = hoveredItem === item.id;

    // Check main path if exists
    const enabled = isFeatureEnabled(item.path);
    const isLocked = !enabled;

    if (hasChildren) {
      return (
        <li
          key={item.id}
          className="relative"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          {/* Parent item with expand/collapse */}
          <button
            onClick={() => toggleSection(item.id)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            className={`
              sidebar-item w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl
              transition-all duration-200 ease-out relative overflow-hidden group
              ${active ? 'sidebar-item-active' : ''}
              ${isHovered && !active ? 'sidebar-item-hover' : ''}
            `}
          >
            {/* Animated background glow on hover */}
            <div className={`
              absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300
              bg-gradient-to-r from-[var(--accent-primary)]/5 to-[var(--accent-primary)]/10
              ${isHovered ? 'opacity-100' : ''}
            `} />

            {/* Icon container with enhanced styling */}
            <div
              className={`
                sidebar-icon flex-shrink-0 relative z-10 rounded-xl p-2
                transition-all duration-300 ease-out
                ${active
                  ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[#3da58a] text-white shadow-lg shadow-[var(--accent-primary)]/25'
                  : 'text-[var(--text-headings)] group-hover:bg-[var(--bg-secondary)] group-hover:text-[var(--accent-primary)]'
                }
              `}
            >
              <Icon size={18} className="transition-transform duration-300 group-hover:scale-110" />
            </div>

            {/* Label with smooth slide animation */}
            {/* Label and Number wrapper */}
            <div className={`
              flex-1 flex items-center gap-2 relative z-10 overflow-hidden
              transition-all duration-300 ease-out
              ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 w-0 pointer-events-none'}
            `}>
              {item.stepNumber && (
                <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white bg-[var(--accent-primary)]">
                  {item.stepNumber}
                </span>
              )}
              <span
                className={`
                  text-left whitespace-nowrap font-medium text-[13px]
                  ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-headings)]'}
                `}
              >
                {item.label}
              </span>
            </div>

            {/* Chevron with rotation animation */}
            <span
              className={`
                flex-shrink-0 transition-all duration-300 ease-out relative z-10
                ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}
              `}
            >
              <IconChevronDown
                size={14}
                className={`
                  text-[var(--text-caption)] transition-transform duration-300 ease-out
                  ${isExpanded_ ? 'rotate-0' : '-rotate-90'}
                `}
              />
            </span>
          </button>

          {/* Child items with staggered animation */}
          <ul
            className={`
              overflow-hidden transition-all duration-400 ease-out mt-1
              ${isExpanded_ && isExpanded ? 'opacity-100' : 'opacity-0 max-h-0'}
            `}
            style={{
              maxHeight: isExpanded_ && isExpanded ? `${(item.children?.length || 0) * 44}px` : '0px',
            }}
          >
            {item.children?.map((child, childIndex) => {
              const ChildIcon = child.icon;
              const childActive = isPathActive(child.path);
              const childEnabled = isFeatureEnabled(child.path);
              const isChildLocked = !childEnabled;

              const content = (
                <>
                  {/* Connecting line indicator */}
                  <div className={`
                    absolute left-[22px] top-0 bottom-0 w-px
                    ${childActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}
                    transition-colors duration-200
                  `} />

                  {/* Active dot indicator */}
                  <div className={`
                    absolute left-[19px] top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full
                    transition-all duration-300
                    ${childActive
                      ? 'bg-[var(--accent-primary)] scale-100 shadow-lg shadow-[var(--accent-primary)]/40'
                      : 'bg-[var(--border-default)] scale-75 group-hover:scale-100 group-hover:bg-[var(--text-caption)]'
                    }
                  `} />

                  {ChildIcon && (
                    <ChildIcon
                      size={14}
                      className={`
                        flex-shrink-0 transition-all duration-200 ml-8
                        ${childActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-caption)] group-hover:text-[var(--text-body)]'}
                        ${isChildLocked ? 'opacity-40' : ''}
                      `}
                    />
                  )}
                  <span className={`
                    text-[13px] whitespace-nowrap truncate flex-1 min-w-0 transition-colors duration-200
                    ${childActive ? 'font-medium text-[var(--accent-primary)]' : ''}
                    ${isChildLocked ? 'text-[var(--text-caption)]' : 'group-hover:text-[var(--text-headings)]'}
                  `}>
                    {child.label}
                  </span>
                  {isChildLocked && (
                    <span className="ml-auto text-[9px] font-bold tracking-wider text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 px-1.5 py-0.5 rounded-md shadow-sm flex-shrink-0 uppercase">
                      Pro
                    </span>
                  )}
                </>
              );

              return (
                <li
                  key={child.path}
                  title={isChildLocked ? "Contact sales to unlock" : ""}
                  className="relative"
                  style={{ animationDelay: `${childIndex * 40}ms` }}
                >
                  {isChildLocked ? (
                    <div className="flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg cursor-not-allowed opacity-70 relative group">
                      {content}
                    </div>
                  ) : (
                    <Link
                      to={child.path}
                      className={`
                          flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg relative group
                          transition-all duration-200 ease-out
                          ${childActive
                          ? 'bg-[var(--accent-primary)]/8'
                          : 'hover:bg-[var(--bg-secondary)]'
                        }
                        `}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      );
    }

    // Simple nav item without children (e.g. Measure)
    const content = (
      <>
        {/* Animated background glow */}
        <div className={`
            absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300
            bg-gradient-to-r from-[var(--accent-primary)]/5 to-[var(--accent-primary)]/10
            ${isHovered && !active ? 'opacity-100' : ''}
          `} />

        <div
          className={`
              sidebar-icon flex-shrink-0 relative z-10 rounded-xl p-2
              transition-all duration-300 ease-out
              ${active
              ? 'bg-gradient-to-br from-[var(--accent-primary)] to-[#3da58a] text-white shadow-lg shadow-[var(--accent-primary)]/25'
              : 'text-[var(--text-headings)] group-hover:bg-[var(--bg-secondary)] group-hover:text-[var(--accent-primary)]'
            }
              ${isLocked ? 'opacity-40' : ''}
            `}
        >
          <Icon size={18} className="transition-transform duration-300 group-hover:scale-110" />
        </div>

        {/* Label and Number wrapper */}
        <div className={`
          flex-1 flex items-center gap-2 relative z-10 overflow-hidden
          transition-all duration-300 ease-out
          ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 w-0 pointer-events-none'}
        `}>
          {item.stepNumber && (
            <span className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-[10px] font-bold text-white bg-[var(--accent-primary)]">
              {item.stepNumber}
            </span>
          )}
          <span
            className={`
              whitespace-nowrap font-medium text-[13px]
              ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-headings)]'}
              ${isLocked ? 'text-[var(--text-caption)]' : ''}
            `}
          >
            {item.label}
          </span>
        </div>
        {isLocked && (
          <span className={`
                text-[9px] font-bold tracking-wider text-white 
                bg-gradient-to-r from-violet-500 to-fuchsia-500 
                px-1.5 py-0.5 rounded-md shadow-sm flex-shrink-0 uppercase
                transition-opacity duration-300 relative z-10
                ${isExpanded ? 'opacity-100' : 'opacity-0'}
              `}>
            Pro
          </span>
        )}
      </>
    );

    return (
      <li
        key={item.id}
        title={isLocked ? "Contact sales to unlock" : ""}
        className="relative"
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {isLocked ? (
          <div
            className="sidebar-item flex items-center gap-3 px-2.5 py-2.5 rounded-xl cursor-not-allowed group opacity-70 relative"
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {content}
          </div>
        ) : (
          <Link
            to={item.path!}
            className={`
                sidebar-item flex items-center gap-3 px-2.5 py-2.5 rounded-xl
                transition-all duration-200 ease-out relative overflow-hidden group
                ${active ? 'sidebar-item-active' : ''}
              `}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {content}
          </Link>
        )}
      </li>
    );
  };

  // Combine all nav items in order
  const allNavItems = [
    ...navItems,
    ...(user?.role === 'AL_ADMIN' || user?.accessLevel === 'admin' ? adminNavItems : []),
    // Add Settings as a regular nav item
    {
      id: 'settings',
      label: 'Settings',
      icon: IconSettings,
      path: '/settings',
    },
  ];

  return (
    <>
      {/* Enhanced CSS styles */}
      <style>{`
        /* Hide scrollbar */
        .sidebar-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .sidebar-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        /* Smooth sidebar expansion with spring-like effect */
        .sidebar-container {
          transition: width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        /* Nav item base styles */
        .sidebar-item {
          position: relative;
          backdrop-filter: blur(8px);
        }
        
        /* Active item glow effect */
        .sidebar-item-active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: linear-gradient(180deg, var(--accent-primary), #3da58a);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 12px var(--accent-primary);
        }
        
        /* Icon pulse animation on active */
        .sidebar-item-active .sidebar-icon {
          animation: iconPulse 2s ease-in-out infinite;
        }
        
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 4px 15px rgba(77, 182, 172, 0.25); }
          50% { box-shadow: 0 4px 20px rgba(77, 182, 172, 0.4); }
        }
        
        /* Hover lift effect */
        .sidebar-item:hover:not(.sidebar-item-active) {
          transform: translateX(4px);
        }
        
        /* User avatar subtle styling */
        .user-avatar {
          background: linear-gradient(135deg, #64748b, #475569);
          transition: all 0.3s ease;
        }
        
        .user-avatar:hover {
          background: linear-gradient(135deg, #475569, #334155);
          transform: scale(1.05);
        }
        
        /* Dropdown menu animation */
        .dropdown-menu {
          animation: dropdownSlide 0.2s ease-out;
          transform-origin: bottom left;
        }
        
        @keyframes dropdownSlide {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Staggered fade-in for nav items */
        .nav-item-enter {
          animation: navItemEnter 0.3s ease-out forwards;
        }
        
        @keyframes navItemEnter {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      <div
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="sidebar-container fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white/95 backdrop-blur-xl border-r border-[var(--border-default)]/50 flex flex-col shadow-xl shadow-black/5 z-50"
        style={{ width: isExpanded ? '260px' : '68px' }}
      >
        {/* Main navigation */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden sidebar-scrollbar">
          <ul className="space-y-1 px-2.5">
            {allNavItems.map((item, index) => renderNavItem(item, index))}
          </ul>
        </nav>

        {/* Footer section with user info only */}
        <div className="border-t border-[var(--border-default)]/50 p-2.5 bg-gradient-to-t from-[var(--bg-secondary)]/30 to-transparent">
          {/* User profile button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`
                flex items-center gap-2.5 px-2 py-2 rounded-xl w-full
                transition-all duration-200 ease-out relative group
                hover:bg-[var(--bg-secondary)]
                ${showUserMenu ? 'bg-[var(--bg-secondary)]' : ''}
              `}
            >
              {/* Avatar with subtle gray gradient */}
              <div className="user-avatar flex-shrink-0 w-7 h-7 rounded-lg text-white flex items-center justify-center text-[11px] font-semibold shadow-sm">
                {getInitials(user?.fullName || null, user?.email || '')}
              </div>

              {/* Email with truncation */}
              <div className={`
                flex-1 min-w-0 text-left transition-all duration-300 ease-out
                ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 w-0 pointer-events-none'}
              `}>
                <p className="text-[12px] font-medium text-[var(--text-headings)] truncate">
                  {user?.fullName || 'User'}
                </p>
                <p className="text-[10px] text-[var(--text-caption)] truncate">
                  {user?.email}
                </p>
              </div>

              {/* Chevron indicator */}
              <IconChevronDown
                size={14}
                className={`
                  flex-shrink-0 text-[var(--text-caption)]
                  transition-all duration-300 ease-out
                  ${isExpanded ? 'opacity-100' : 'opacity-0 w-0'}
                  ${showUserMenu ? 'rotate-180' : ''}
                `}
              />
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <div className="dropdown-menu absolute bottom-full left-2 right-2 mb-2 bg-white/95 backdrop-blur-xl border border-[var(--border-default)]/50 rounded-xl shadow-2xl shadow-black/10 overflow-hidden z-50">
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors group"
                  >
                    <IconLogout size={16} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
