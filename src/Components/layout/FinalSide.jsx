import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Box,
    Typography,
    IconButton,
    Avatar,
    InputBase,
    Menu,
    MenuItem,
    Divider,
    Switch,
    useMediaQuery,
} from '@mui/material';
import {
    Refresh,
    Menu as MenuIcon,
    Search as SearchIcon,
    KeyboardArrowDown,
    NotificationsNone,
    Settings,
    ExitToApp,
    BookmarkBorder,
    TrendingUp,
    Help,
    Language,
    Brightness7,
    LightMode,
    LockOutlined,
    PersonOutlined,
    HowToReg,
    Dashboard,
    People,
    Event,
    Assessment,
} from '@mui/icons-material';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { useLoading } from '../context/LoadingContext';
import PermissionBasedSidebar from './PermissionBasedSidebar';
import { ChevronLeft, ChevronRight, ClipboardCheck, X } from 'lucide-react';
import './Sidebar.css';
import { allMenuItems } from './sidebarMenuConfig';
import { normalizeMenuPath } from '../../utils/navigationUtils';
import useRouterLocationSync from '../../hooks/useRouterLocationSync';
import { useRouteLayoutDebug } from '../../utils/routeDebug';

/** Product name — keep in sync with Login.jsx */
const PRODUCT_NAME = 'Attendance Tracker';

/** Quick-access header ribbons */
const HEADER_RIBBONS = [
    { id: 'dashboard', label: 'Dashboard', path: '/side', Icon: Dashboard },
    { id: 'members', label: 'Members', path: '/side/members', Icon: People },
    { id: 'meetings', label: 'Meetings', path: '/side/meetings', Icon: Event },
    { id: 'attendance', label: 'Attendance', path: '/side/attendance', Icon: HowToReg },
    { id: 'reports', label: 'Reports', path: '/side/reports', Icon: Assessment },
];

/** Rotating headlines (after refresh) */
const HEADER_TAGLINES = [
    'Track presence, check-ins, and daily attendance in one place.',
    'Clear dashboards, reports, and role-based access for your team.',
    'Built for attendance — fast capture, history, and oversight.',
];
/** Full name for sidebar profile row */
const getSidebarProfileName = (u) => {
    if (!u) return 'Guest';
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return full || u.email?.split('@')[0] || 'User';
};

const FinalSide = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showLoading, hideLoading } = useLoading();
    const [activeItem, setActiveItem] = useState('Overview');
    const [userMenuAnchor, setUserMenuAnchor] = useState(null);
    const { user, logout, setUser } = useAuth();
    const { refreshPermissions, getAccessibleMenuGroups, hasAccess, isSuperAdmin } = usePermissions();
    useRouterLocationSync();
    useRouteLayoutDebug('FinalSide');
    const [expandedItems, setExpandedItems] = useState({});
    const [settingsAnchor, setSettingsAnchor] = useState(null);
    const [isCompactMode, setIsCompactMode] = useState(false);
    const [desktopSidebarMode, setDesktopSidebarMode] = useState('full');
    // Always use light theme; disable dark mode toggling
    const [isLightTheme, setIsLightTheme] = useState(true);
    const isMobile = useMediaQuery('(max-width:768px)');
    const [isSidebarVisible, setIsSidebarVisible] = useState(!isMobile);
    const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
    const [hoverMenu, setHoverMenu] = useState({ show: false, items: [], x: 0, y: 0 });
    const [notificationCount, setNotificationCount] = useState(3);
    const [messageCount, setMessageCount] = useState(5);
    const [searchValue, setSearchValue] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
    const [quickActionsAnchor, setQuickActionsAnchor] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [profileMenuSearch, setProfileMenuSearch] = useState('');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [headerTaglineDisplay, setHeaderTaglineDisplay] = useState('');

    const menuGroups = useMemo(() => {
        const groups = typeof getAccessibleMenuGroups === 'function' ? getAccessibleMenuGroups() : [];
        return Array.isArray(groups) ? groups : [];
    }, [getAccessibleMenuGroups, user]);

    const accessibleMenuItems = useMemo(
        () => menuGroups.flatMap(group => Array.isArray(group.items) ? group.items : []),
        [menuGroups]
    );

    const accessiblePathSet = useMemo(() => {
        const paths = new Set(
            accessibleMenuItems
                .map((item) => item?.path)
                .filter((path) => typeof path === 'string' && path.length > 0)
                .map((path) => normalizeMenuPath(path))
        );
        return paths;
    }, [accessibleMenuItems]);

    const canAccessPath = useCallback(
        (path) => {
            if (!path) return false;
            if (typeof isSuperAdmin === 'function' && isSuperAdmin()) return true;
            const normalized = normalizeMenuPath(path);
            if (accessiblePathSet.has(normalized)) return true;
            if (typeof hasAccess === 'function' && hasAccess(normalized)) return true;
            return false;
        },
        [accessiblePathSet, hasAccess, isSuperAdmin]
    );

    // Top-bar quick nav: only show ribbons the user can open (RBAC)
    const visibleHeaderRibbons = useMemo(
        () => HEADER_RIBBONS.filter((ribbon) => canAccessPath(ribbon.path)),
        [canAccessPath]
    );

    const hideHeaderTagline = visibleHeaderRibbons.length > 0;

    const showTooltip = useCallback((text, event) => {
        if (isCompactMode && !hoverMenu.show && event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            setTooltip({
                show: true,
                text,
                x: rect.right + 10,
                y: rect.top + (rect.height / 2),
            });
        }
    }, [isCompactMode, hoverMenu.show]);

    const hideTooltip = useCallback(() => {
        setTooltip(prev => ({ ...prev, show: false }));
    }, []);

    const showHoverMenu = useCallback((group, event) => {
        if (isCompactMode && event.currentTarget) {
            hideTooltip();
            const rect = event.currentTarget.getBoundingClientRect();
            const menuWidth = 220;
            const menuHeight = Math.min((group.items?.length || 0) * 40 + 60, 60 * 8);
            const itemCount = group.items?.length || 0;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            let x = rect.right + 5;
            let y = rect.top;
            if (x + menuWidth > viewportWidth - 20) {
                x = rect.left - menuWidth - 5;
            }
            if (y + menuHeight > viewportHeight - 20) {
                y = Math.max(20, viewportHeight - menuHeight - 20);
            }
            if (y < 20) y = 20;
            setHoverMenu({
                show: true,
                items: group.items || [],
                parentItem: {
                    title: group.title,
                    icon: group.icon,
                    path: group.path,
                },
                x,
                y,
                itemCount,
            });
        }
    }, [isCompactMode, hideTooltip]);

    const hideHoverMenu = useCallback(() => {
        setHoverMenu(prev => ({ ...prev, show: false }));
        hideTooltip();
    }, [hideTooltip]);
    
    // Never keep desktop sidebar hidden after switching from mobile.
    useEffect(() => {
        if (!isMobile) {
            setIsSidebarVisible(true);
        }
    }, [isMobile]);

    // Mobile always uses full sidebar layout (not compact icon-only mode).
    useEffect(() => {
        if (isMobile) {
            setIsCompactMode(false);
        }
    }, [isMobile]);

    // Sync activeItem with current location path on component mount and location change
    useEffect(() => {
        // Get the last segment of the path to use as activeItem
        const pathSegments = location.pathname.split('/').filter(Boolean);
        if (pathSegments.length > 0) {
            // Get the last meaningful path segment
            const lastSegment = pathSegments[pathSegments.length - 1];
            // Convert kebab-case to title case (e.g., 'daily-earnings' -> 'Daily Earnings')
            const title = lastSegment
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            setActiveItem(title || 'Dashboard');
        } else {
            setActiveItem('Overview');
        }
    }, [location.pathname]);

    useEffect(() => {
        hideLoading();
        hideHoverMenu();
    }, [location.pathname, hideLoading, hideHoverMenu]);

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    /** Header subtitle: type forward, pause, delete, rotate phrases */
    useEffect(() => {
        const reduceMotion =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (reduceMotion) {
            setHeaderTaglineDisplay(HEADER_TAGLINES[0]);
            return undefined;
        }

        let cancelled = false;
        let phraseIndex = 0;
        let i = 0;
        let tid;

        const runType = () => {
            if (cancelled) return;
            const phrase = HEADER_TAGLINES[phraseIndex];
            if (i < phrase.length) {
                setHeaderTaglineDisplay(phrase.slice(0, i + 1));
                i += 1;
                tid = setTimeout(runType, 44);
            } else {
                tid = setTimeout(runDelete, 2600);
            }
        };

        const runDelete = () => {
            if (cancelled) return;
            const phrase = HEADER_TAGLINES[phraseIndex];
            if (i > 0) {
                setHeaderTaglineDisplay(phrase.slice(0, i - 1));
                i -= 1;
                tid = setTimeout(runDelete, 26);
            } else {
                phraseIndex = (phraseIndex + 1) % HEADER_TAGLINES.length;
                tid = setTimeout(runType, 480);
            }
        };

        runType();
        return () => {
            cancelled = true;
            clearTimeout(tid);
        };
    }, []);

    // Keyboard shortcut for search (Ctrl+K)
    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                const searchInput = document.querySelector('.header-search-input');
                if (searchInput) {
                    searchInput.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleNavigation = (path, title) => {
        const target = normalizeMenuPath(path);
        if (title) setActiveItem(title);
        hideHoverMenu();
        if (isMobile) {
            setIsSidebarVisible(false);
        }
        if (location.pathname !== target) {
            if (import.meta.env.DEV || (typeof window !== 'undefined' && window.localStorage?.getItem('debugRoutes') === '1')) {
                console.log('[route-debug] handleNavigation', {
                    from: location.pathname,
                    to: target,
                    historyKey: location.key,
                });
            }
            navigate(target);
        }
    };

    const handleBrandRefresh = useCallback(() => {
        if (refreshPermissions) {
            refreshPermissions();
        }
        setActiveItem('Dashboard');
        try {
            const raw = localStorage.getItem('user');
            const userData = raw ? JSON.parse(raw) : {};
            if (userData && typeof userData === 'object' && Object.keys(userData).length > 0) {
                setUser({ ...userData });
            }
        } catch {
            /* ignore invalid stored JSON */
        }
    }, [refreshPermissions, setUser]);

    const handleUserMenuClick = (event) => {
        event.stopPropagation();
        setUserMenuAnchor(event.currentTarget);
    };

    const handleUserMenuClose = () => {
        setUserMenuAnchor(null);
    };

    const handleLogout = async () => {
        handleUserMenuClose();
        showLoading('Logging out...');
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            navigate('/');
        }
    };

    const handleNavItemClick = (group) => {
        if (group.items && group.items.length > 0) {
            setExpandedItems(prev => {
                const isCurrentlyExpanded = !!prev[group.title];
                // Collapse all, then expand only the clicked one if it was not already expanded
                return isCurrentlyExpanded ? {} : { [group.title]: true };
            });
        } else if (group.path) {
            handleNavigation(group.path, group.title);
        }
    };

    const handleSubItemClick = (parentTitle, item) => {
        if (item.modal) {
            // Handle modal items if needed
            return;
        }
        handleNavigation(item.path, item.label);
    };

    const handleSettingsClick = (event) => {
        setSettingsAnchor(event.currentTarget);
    };

    const handleSettingsClose = () => {
        setSettingsAnchor(null);
    };

    const handleDesktopSidebarMode = (mode) => {
        if (isMobile) return;
        setDesktopSidebarMode(mode);
        if (mode === 'compact') {
            setIsCompactMode(true);
        } else if (mode === 'auto') {
            setIsCompactMode(true);
        } else {
            setIsCompactMode(false);
        }
        if (!isSidebarVisible) {
            setIsSidebarVisible(true);
        }
    };

    const handleSidebarMouseEnter = () => {
        if (isMobile) return;
        if (desktopSidebarMode === 'auto') {
            setIsCompactMode(false);
        }
    };

    const handleSidebarMouseLeave = () => {
        if (isMobile) return;
        if (desktopSidebarMode === 'auto') {
            setIsCompactMode(true);
            hideTooltip();
            hideHoverMenu();
        }
    };

    const handleThemeChange = () => {
        // Theme toggle disabled - always light
        return;
    };

    const toggleSidebar = () => {
        if (isMobile) {
            setIsSidebarVisible(!isSidebarVisible);
        }
    };

    const handleOverlayClick = () => {
        if (isMobile) {
            setIsSidebarVisible(false);
        }
    };

    const isPathActive = (path) => {
        return location.pathname === path;
    };

    const hasActiveChild = (group) => {
        if (!group.items) return false;
        return group.items.some(item => isPathActive(item.path));
    };

    const handleQuickActionsClick = (event) => {
        setQuickActionsAnchor(event.currentTarget);
    };

    const handleQuickActionsClose = () => {
        setQuickActionsAnchor(null);
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setSearchValue(value);

        if (value.trim()) {
            // Filter menu items based on search query
            const sourceItems = accessibleMenuItems.length > 0 ? accessibleMenuItems : allMenuItems;
            const filtered = sourceItems.filter(item =>
                item.label.toLowerCase().includes(value.toLowerCase()) ||
                (item.group || item.groupTitle || '').toLowerCase().includes(value.toLowerCase())
            ).slice(0, 8); // Limit to 8 results

            setSearchResults(filtered);
            setShowSearchResults(true);
            setSelectedSearchIndex(-1);
        } else {
            setSearchResults([]);
            setShowSearchResults(false);
            setSelectedSearchIndex(-1);
        }
    };

    const handleSearchFocus = () => {
        setSearchFocused(true);
        if (searchValue.trim() && searchResults.length > 0) {
            setShowSearchResults(true);
        }
    };

    const handleSearchBlur = () => {
        // Delay hiding results to allow clicking on them
        setTimeout(() => {
            setSearchFocused(false);
            setShowSearchResults(false);
            setSelectedSearchIndex(-1);
        }, 200);
    };

    const handleSearchKeyDown = (event) => {
        if (!showSearchResults || searchResults.length === 0) return;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setSelectedSearchIndex(prev =>
                    prev < searchResults.length - 1 ? prev + 1 : 0
                );
                break;
            case 'ArrowUp':
                event.preventDefault();
                setSelectedSearchIndex(prev =>
                    prev > 0 ? prev - 1 : searchResults.length - 1
                );
                break;
            case 'Enter':
                event.preventDefault();
                if (selectedSearchIndex >= 0 && searchResults[selectedSearchIndex]) {
                    handleSearchResultClick(searchResults[selectedSearchIndex]);
                }
                break;
            case 'Escape':
                setShowSearchResults(false);
                setSelectedSearchIndex(-1);
                event.target.blur();
                break;
        }
    };

    const handleSearchResultClick = (item) => {
        if (item.path && !item.modal) {
            handleNavigation(item.path, item.label);
            setSearchValue('');
            setShowSearchResults(false);
            setSelectedSearchIndex(-1);
        }
    };

    const clearSearch = () => {
        setSearchValue('');
        setSearchResults([]);
        setShowSearchResults(false);
        setSelectedSearchIndex(-1);
    };

    const highlightSearchTerm = (text, searchTerm) => {
        if (!searchTerm.trim()) return text;

        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part) ?
                <span key={index} className="search-highlight">{part}</span> :
                part
        );
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    };


    return (
        <div className="sidebar-box sidebar-shell-soft !flex">
            {/* Overlay for mobile */}
            {isMobile && isSidebarVisible && (
                <div 
                    className={`sidebar-overlay ${isSidebarVisible ? 'visible' : ''}`}
                    onClick={handleOverlayClick}
                />
            )}

            {/* Tooltip (compact sidebar) */}
            {tooltip.show && (
                <div
                    className={`nav-tooltip ${tooltip.show ? 'visible' : ''}`}
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.text}
                </div>
            )}

            {/* Hover menu (compact sidebar) */}
            {hoverMenu.show && (
                <div
                    className={`hover-menu ${hoverMenu.show ? 'visible' : ''} ${hoverMenu.itemCount > 8 ? 'scrollable' : ''}`}
                    style={{ left: hoverMenu.x, top: hoverMenu.y }}
                    onMouseEnter={() => setHoverMenu(prev => ({ ...prev, show: true }))}
                    onMouseLeave={hideHoverMenu}
                >
                    <div
                        className="hover-menu-item parent-item"
                        onClick={() => {
                            if (hoverMenu.parentItem) {
                                handleNavigation(hoverMenu.parentItem.path, hoverMenu.parentItem.title);
                            }
                            hideHoverMenu();
                        }}
                    >
                        {hoverMenu.parentItem?.icon}
                        <span>{hoverMenu.parentItem?.title}</span>
                    </div>
                    {hoverMenu.items?.length > 0 && (
                        <div className={`hover-submenu ${hoverMenu.itemCount > 6 ? 'scrollable' : ''}`}>
                            {hoverMenu.items.map((item, index) => (
                                <div
                                    key={index}
                                    className={`hover-menu-item ${isPathActive(item.path) ? 'active' : ''}`}
                                    onClick={() => {
                                        handleNavigation(item.path, item.label);
                                        hideHoverMenu();
                                    }}
                                >
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Sidebar */}
            <div
                className={`medicore-sidebar sidebar-light hospital-theme sidebar-soft-ui ${isMobile ? (isSidebarVisible ? 'mobile-visible' : '') : (!isSidebarVisible ? 'hidden' : '')} ${!isMobile && isCompactMode ? 'compact-mode' : ''}`}
                onMouseEnter={handleSidebarMouseEnter}
                onMouseLeave={handleSidebarMouseLeave}
            >
                <div className="sidebar-header sidebar-header-rich border-b border-gray-200/90">
                    <div className="header-content flex items-center justify-between gap-2 px-3 py-3.5">
                        <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${isMobile || !isCompactMode ? '' : 'justify-center'}`}>
                            {(!isCompactMode || isMobile) && (
                                <div className="sidebar-brand-mark" aria-hidden>
                                    <ClipboardCheck className="h-4 w-4" strokeWidth={2.5} />
                                </div>
                            )}
                            {!isCompactMode && (
                                <div className="min-w-0">
                                    <div className="sidebar-brand-title truncate">
                                        {PRODUCT_NAME}
                                    </div>
                                    <div className="sidebar-brand-subtitle truncate">
                                        Attendance management
                                    </div>
                                </div>
                            )}
                        </div>
                        {!isMobile && !isCompactMode && (
                            <button
                                type="button"
                                title="Collapse sidebar"
                                onClick={() => {
                                    setDesktopSidebarMode('compact');
                                    setIsCompactMode(true);
                                }}
                                className="sidebar-chrome-btn inline-flex h-8 w-8 shrink-0 items-center justify-center"
                            >
                                <ChevronLeft className="h-4 w-4" aria-hidden />
                            </button>
                        )}
                        {!isMobile && isCompactMode && (
                            <div className="compact-expand-control flex shrink-0 justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDesktopSidebarMode('full');
                                        setIsCompactMode(false);
                                    }}
                                    title="Expand sidebar"
                                    className="expand-sidebar-btn sidebar-chrome-btn inline-flex h-9 w-9 items-center justify-center"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Search Section - Webuzo Style */}
                <div className="search-section">
                    <div className="search-wrapper">
                        <SearchIcon className="search-icon" />
                        <input
                            type="text"
                            className="search-input header-search-input"
                            placeholder="Search Now (/)"
                            value={searchValue}
                            onChange={handleSearchChange}
                            onFocus={handleSearchFocus}
                            onBlur={handleSearchBlur}
                            onKeyDown={handleSearchKeyDown}
                        />
                        {searchValue && (
                            <button
                                className="search-clear-btn inline-flex items-center justify-center"
                                onClick={clearSearch}
                                type="button"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4" aria-hidden />
                            </button>
                        )}
                    </div>
                    {!isMobile && !isCompactMode && (
                        <div className={`sidebar-mode-switch ${isCompactMode ? 'is-compact' : ''}`}>
                            {['full', 'compact', 'auto'].map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    className={`sidebar-mode-option ${desktopSidebarMode === mode ? 'active' : ''}`}
                                    onClick={() => handleDesktopSidebarMode(mode)}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mobile Separator */}
                {isMobile && (
                    <div className="mobile-sidebar-separator px-3 py-2">
                        <div className="h-px rounded-full bg-gray-200" />
                    </div>
                )}

                {/* Permission-Based Navigation Menu */}
                <div className="nav-menu">
                    <PermissionBasedSidebar
                        isCollapsed={!isMobile && isCompactMode}
                        searchValue={searchValue}
                        onItemClick={(item) => {
                            if (item.isModal) {
                                // Handle modal items - you can customize this
                                console.log('Modal item clicked:', item);
                            } else if (item.path) {
                                handleNavigation(item.path, item.label);
                            }
                        }}
                        showGroupIcons={true}
                        showItemCounts={false}
                    />
                </div>

                {/* Fixed Footer */}
                <div className="sidebar-footer">
                    <button
                        type="button"
                        className={`sidebar-soft-user-card ${!isMobile && isCompactMode ? 'sidebar-soft-user-card--compact' : ''}`}
                        onClick={handleUserMenuClick}
                        aria-haspopup="true"
                        aria-label="Open account menu"
                        title={!isMobile && isCompactMode ? getSidebarProfileName(user) : undefined}
                    >
                        <div className="sidebar-soft-user-avatar" aria-hidden>
                            <PersonOutlined sx={{ fontSize: 22 }} />
                            <span className="sidebar-soft-user-status" />
                        </div>
                        {!(!isMobile && isCompactMode) ? (
                            <>
                                <div className="sidebar-soft-user-meta">
                                    <span className="sidebar-soft-user-name">{getSidebarProfileName(user)}</span>
                                    <span className="sidebar-soft-user-role">
                                        {user?.roleName || user?.role || 'Team member'}
                                    </span>
                                </div>
                                <KeyboardArrowDown className="sidebar-soft-user-caret" sx={{ fontSize: 18 }} />
                            </>
                        ) : null}
                    </button>
                </div>

                {/* User Menu Dropdown */}
                <Menu
                    id="user-menu"
                    anchorEl={userMenuAnchor}
                    open={Boolean(userMenuAnchor)}
                    onClose={handleUserMenuClose}
                    PaperProps={{
                        className: 'user-dropdown-menu',
                        sx: {
                            width: '320px',
                            marginTop: '12px',
                            borderRadius: '16px',
                            '& .MuiList-root': {
                                padding: 0,
                            }
                        },
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    TransitionProps={{
                        timeout: 200
                    }}
                >
                    <Box className="user-menu-shell" onClick={(e) => e.stopPropagation()}>
                        <Box className="user-menu-profile-header">
                            <Avatar className="user-menu-profile-avatar">
                                {user?.firstName?.[0]?.toUpperCase() ||
                                    user?.email?.[0]?.toUpperCase() ||
                                    'U'}
                            </Avatar>
                            <Box className="user-menu-profile-text">
                                <Typography component="div" className="user-menu-profile-kicker">
                                    Account
                                </Typography>
                                <Typography className="user-menu-profile-name" noWrap title={getSidebarProfileName(user)}>
                                    {getSidebarProfileName(user)}
                                </Typography>
                                <Typography className="user-menu-profile-role" noWrap>
                                    {user?.roleName || user?.role || 'Team member'}
                                </Typography>
                            </Box>
                        </Box>

                        <div className="user-menu-search">
                            <SearchIcon sx={{ fontSize: 18 }} />
                            <InputBase
                                placeholder="Search profile options"
                                value={profileMenuSearch}
                                onChange={(e) => setProfileMenuSearch(e.target.value)}
                            />
                        </div>

                        <div className="user-menu-upgrade-card">
                            <Typography className="upgrade-title">Daily reminder</Typography>
                            <Typography className="upgrade-subtitle">Review today&apos;s attendance records and open sessions before end of day.</Typography>
                            <Typography className="user-menu-note-meta">Admin reminder</Typography>
                        </div>

                        <div className="user-menu-toggle-card">
                            <div className="user-menu-toggle-row">
                                <span>Allow Notifications</span>
                                <Switch size="small" checked={notificationsEnabled} onChange={(e) => setNotificationsEnabled(e.target.checked)} />
                            </div>
                        </div>

                        <div className="user-menu-links">
                            <button type="button" className="user-menu-link-btn" onClick={() => { handleUserMenuClose(); setSettingsAnchor(userMenuAnchor); }}>
                                <Settings sx={{ fontSize: 18 }} />
                                <span>Account Settings</span>
                            </button>
                            <button type="button" className="user-menu-link-btn locked" disabled>
                                <LockOutlined sx={{ fontSize: 18 }} />
                                <span>Linked Accounts (Locked)</span>
                            </button>
                            <button type="button" className="user-menu-link-btn danger" onClick={handleLogout}>
                                <ExitToApp sx={{ fontSize: 18 }} />
                                <span>Logout</span>
                            </button>
                        </div>
                    </Box>
                </Menu>

                {/* Quick Actions Menu */}
                <Menu
                    anchorEl={quickActionsAnchor}
                    open={Boolean(quickActionsAnchor)}
                    onClose={handleQuickActionsClose}
                    onClick={handleQuickActionsClose}
                    PaperProps={{
                        sx: {
                            width: '220px',
                            mt: 1,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                            borderRadius: '12px',
                            '& .MuiList-root': {
                                padding: '8px',
                            },
                            '& .MuiMenuItem-root': {
                                borderRadius: '8px',
                                margin: '2px 0',
                                color: 'white',
                                '&:hover': {
                                    background: 'rgba(255, 255, 255, 0.1)',
                                }
                            }
                        }
                    }}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <MenuItem onClick={() => navigate('/side/bookmarks')}>
                        <BookmarkBorder sx={{ mr: 2 }} />
                        Bookmarks
                    </MenuItem>
                    <MenuItem onClick={() => navigate('/side/analytics')}>
                        <TrendingUp sx={{ mr: 2 }} />
                        Analytics
                    </MenuItem>
                    <MenuItem onClick={() => navigate('/side/help')}>
                        <Help sx={{ mr: 2 }} />
                        Help Center
                    </MenuItem>
                    <MenuItem onClick={() => window.open('/docs', '_blank')}>
                        <Language sx={{ mr: 2 }} />
                        Documentation
                    </MenuItem>
                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.2)', my: 1 }} />
                    <MenuItem disabled>
                        <Brightness7 sx={{ mr: 2 }} />
                        Light Mode
                    </MenuItem>
                </Menu>

                {/* Settings Menu - Only available in desktop mode */}
                {!isMobile && (
                    <Menu
                        anchorEl={settingsAnchor}
                        open={Boolean(settingsAnchor)}
                        onClose={handleSettingsClose}
                        onClick={handleSettingsClose}
                        PaperProps={{
                            className: 'settings-menu',
                            sx: {
                                width: '280px',
                                mt: 1,
                                background: '#1E2024',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                                '& .MuiList-root': {
                                    padding: '8px',
                                },
                            }
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        TransitionProps={{
                            timeout: 200
                        }}
                    >
                        <Typography
                            sx={{
                                padding: '12px 16px',
                                color: 'rgba(255, 255, 255, 0.5)',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase'
                            }}
                        >
                            Interface Settings
                        </Typography>

                        <MenuItem className={`settings-menu-item ${isLightTheme ? 'active' : ''}`}> 
                            <div className="settings-menu-content">
                                <div className="settings-menu-icon">
                                    <LightMode />
                                </div>
                                <div className="settings-menu-text">Light Theme</div>
                            </div>
                            <Switch
                                size="medium"
                                checked={true}
                                disabled
                                className="settings-switch"
                            />
                        </MenuItem>
                    </Menu>
                )}
            </div>

            {/* Enhanced Main Header */}
            <div className={`main-header enhanced ${isMobile ? 'mobile' : ''} ${!isMobile && !isSidebarVisible ? 'sidebar-hidden' : ''} ${!isMobile && isCompactMode ? 'compact-mode' : ''} ${isLightTheme ? 'light-theme' : 'dark-theme'}`}>
                {/* Left Section */}
                <div className="header-left-section">
                    {isMobile && (
                        <div className="header-menu-slot">
                            <div className="menu-trigger" onClick={toggleSidebar} aria-label="Open menu">
                                <MenuIcon />
                            </div>
                        </div>
                    )}

                    <div className="header-brand-toolbar">
                        <div className="header-brand header-brand-lockup header-brand-text-only">
                            <div className="header-brand-text">
                                <Typography className="header-brand-title" noWrap>
                                    {PRODUCT_NAME}
                                </Typography>
                                {!isMobile ? (
                                    <Typography className="header-brand-subtitle" noWrap>
                                        Learning Platform
                                    </Typography>
                                ) : null}
                            </div>
                        </div>
                        {!isMobile ? (
                            <>
                                <span className="header-brand-toolbar-divider" aria-hidden />
                                <div className="header-brand-messages">
                                    <IconButton
                                        size="small"
                                        onClick={handleBrandRefresh}
                                        title="Refresh menu & permissions"
                                        className="header-brand-refresh"
                                    >
                                        <Refresh />
                                    </IconButton>
                                    {visibleHeaderRibbons.length > 0 ? (
                                        <nav className="header-ribbons" aria-label="Quick navigation">
                                            {visibleHeaderRibbons.map((ribbon) => {
                                                const active =
                                                    ribbon.path === '/side'
                                                        ? location.pathname === '/side'
                                                        : location.pathname === ribbon.path ||
                                                          location.pathname.startsWith(`${ribbon.path}/`);
                                                const Icon = ribbon.Icon;
                                                return (
                                                    <button
                                                        key={ribbon.id}
                                                        type="button"
                                                        className={`header-ribbon${active ? ' is-active' : ''}`}
                                                        onClick={() => handleNavigation(ribbon.path, ribbon.label)}
                                                        title={ribbon.label}
                                                    >
                                                        <Icon className="header-ribbon-icon" />
                                                        <span className="header-ribbon-label">{ribbon.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </nav>
                                    ) : !hideHeaderTagline ? (
                                        <div className="header-brand-tagline-shell">
                                            <Typography
                                                component="div"
                                                className="header-brand-tagline header-brand-typewriter"
                                                aria-live="polite"
                                                aria-label="Product highlights"
                                            >
                                                {headerTaglineDisplay}
                                            </Typography>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Right Section */}
                <div className="header-right-section">
                    <div className="header-user-actions-cluster">
                        {isMobile ? (
                            <IconButton
                                size="small"
                                onClick={handleBrandRefresh}
                                title="Refresh menu & permissions"
                                aria-label="Refresh menu and permissions"
                                className="header-mobile-refresh-btn"
                            >
                                <Refresh sx={{ fontSize: 20 }} />
                            </IconButton>
                        ) : null}
                        <div className="header-icon-button notifications soft" aria-label="Notifications">
                            <NotificationsNone sx={{ fontSize: '18px' }} />
                        </div>

                        <div
                            className={`header-profile enhanced pill ${isMobile ? 'mobile-compact' : ''}`}
                            onClick={handleUserMenuClick}
                            role="button"
                            tabIndex={0}
                            aria-label="Account menu"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleUserMenuClick(e);
                                }
                            }}
                        >
                            <Avatar className="header-pill-avatar">
                                {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                            </Avatar>
                            {!isMobile ? (
                                <>
                                    <Settings sx={{ fontSize: '16px' }} />
                                    <KeyboardArrowDown sx={{ fontSize: '16px' }} className="dropdown-arrow" />
                                </>
                            ) : (
                                <KeyboardArrowDown sx={{ fontSize: '14px' }} className="dropdown-arrow mobile-only" />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isMobile && visibleHeaderRibbons.length > 0 ? (
                <div className="header-ribbons-mobile-bar" aria-label="Quick navigation">
                    <nav className="header-ribbons header-ribbons--mobile">
                        {visibleHeaderRibbons.map((ribbon) => {
                            const active =
                                ribbon.path === '/side'
                                    ? location.pathname === '/side'
                                    : location.pathname === ribbon.path ||
                                      location.pathname.startsWith(`${ribbon.path}/`);
                            const Icon = ribbon.Icon;
                            return (
                                <button
                                    key={ribbon.id}
                                    type="button"
                                    className={`header-ribbon${active ? ' is-active' : ''}`}
                                    onClick={() => handleNavigation(ribbon.path, ribbon.label)}
                                    title={ribbon.label}
                                >
                                    <Icon className="header-ribbon-icon" />
                                    <span className="header-ribbon-label">{ribbon.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            ) : null}

            {/* Main Content */}
            <div className={`main-content ${isMobile ? 'mobile' : ''} ${!isMobile && !isSidebarVisible ? 'sidebar-hidden' : ''} ${!isMobile && isCompactMode ? 'compact-mode' : ''}`}>
                <div
                    className="content-body"
                    key={`${location.pathname}:${location.key}`}
                    data-route-pathname={location.pathname}
                >
                    <Outlet />
                </div>
            </div>

        </div>
    );
};

export default FinalSide;
