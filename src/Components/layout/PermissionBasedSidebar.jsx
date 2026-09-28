import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    LayoutDashboard,
    GraduationCap,
    Users,
    UserPlus,
    UserCheck,
    Calendar,
    History,
    QrCode,
    Bus,
    BarChart3,
    Warehouse,
    Store,
    Tags,
    Bell,
    MessageSquare,
    CreditCard,
    Settings,
    Key,
    User,
    Clock,
    Home,
    Circle,
    ChevronDown,
    Shield,
    AlertTriangle,
    Pencil,
    Briefcase,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../AuthContext';

const mapFontAwesomeToLucide = (iconClass) => {
    const value = (iconClass || '').toLowerCase();
    if (value.includes('dashboard')) return LayoutDashboard;
    if (value.includes('user-graduate') || value.includes('chalkboard-teacher')) return GraduationCap;
    if (value.includes('user-tie')) return Briefcase;
    if (value.includes('users') || value.includes('user-friends')) return Users;
    if (value.includes('user-plus')) return UserPlus;
    if (value.includes('user-check') || value.includes('check-circle')) return UserCheck;
    if (value.includes('user-shield')) return Shield;
    if (value.includes('calendar')) return Calendar;
    if (value.includes('history')) return History;
    if (value.includes('edit') || value.includes('pencil')) return Pencil;
    if (value.includes('qrcode')) return QrCode;
    if (value.includes('bus')) return Bus;
    if (value.includes('chart')) return BarChart3;
    if (value.includes('warehouse')) return Warehouse;
    if (value.includes('store')) return Store;
    if (value.includes('tags') || value.includes('price')) return Tags;
    if (value.includes('bell') || value.includes('notification')) return Bell;
    if (value.includes('comments') || value.includes('whatsapp')) return MessageSquare;
    if (value.includes('money')) return CreditCard;
    if (value.includes('cog') || value.includes('setting')) return Settings;
    if (value.includes('key')) return Key;
    if (value.includes('clock')) return Clock;
    if (value.includes('home')) return Home;
    if (value.includes('user')) return User;
    return Circle;
};

/** Parent row icons — modest size next to ~13.5px labels */
const iconBtnClass = (isParent) => (isParent ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5');

const PermissionBasedSidebar = ({
    isCollapsed = false,
    searchValue = '',
    onItemClick,
    showGroupIcons = true,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const {
        permissions,
        loading,
        error,
        getAccessibleMenuGroups,
        isSuperAdmin,
        refreshPermissions,
    } = usePermissions();

    const [expandedGroups, setExpandedGroups] = useState({});
    const [activeItem, setActiveItem] = useState('');
    const [flyout, setFlyout] = useState(null);
    const hoverCloseTimerRef = useRef(null);

    useEffect(() => {
        setActiveItem(location.pathname);
        setFlyout(null);
    }, [location.pathname, location.key]);

    useEffect(() => {
        if (!isCollapsed) {
            setFlyout(null);
        }
    }, [isCollapsed]);

    useEffect(() => {
        if (permissions.length > 0) {
            const activeGroup = permissions.find((group) =>
                group.items.some((item) => item.path === location.pathname)
            );

            if (activeGroup) {
                setExpandedGroups((prev) => ({
                    ...prev,
                    [activeGroup.id]: true,
                }));
            }
        }
    }, [permissions, location.pathname]);

    const handleGroupToggle = (groupId) => {
        setExpandedGroups((prev) => ({
            ...prev,
            [groupId]: !prev[groupId],
        }));
    };

    const handleItemClick = (item) => {
        if (item.isModal) {
            if (onItemClick) {
                onItemClick(item);
            }
            return;
        }
        if (!item.path) return;
        setActiveItem(item.path);
        if (onItemClick) {
            onItemClick(item);
        } else {
            navigate(item.path);
        }
    };

    const clearHoverCloseTimer = () => {
        if (hoverCloseTimerRef.current) {
            clearTimeout(hoverCloseTimerRef.current);
            hoverCloseTimerRef.current = null;
        }
    };

    const closeFlyout = () => {
        setFlyout(null);
    };

    const closeFlyoutSoon = () => {
        clearHoverCloseTimer();
        hoverCloseTimerRef.current = setTimeout(closeFlyout, 480);
    };

    const computeFlyoutPosition = (rect) => {
        const panelWidth = 260;
        const gap = 8;
        let left = rect.right + gap;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        if (left + panelWidth > vw - 16) {
            left = Math.max(16, rect.left - panelWidth - gap);
        }
        let top = rect.top;
        const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.72 : 400;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
        if (top + maxH > vh - 16) {
            top = Math.max(16, vh - maxH - 16);
        }
        return { left, top };
    };

    const openFlyout = (event, group, filteredItems) => {
        if (!isCollapsed || filteredItems.length === 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const pos = computeFlyoutPosition(rect);
        if (
            flyout &&
            flyout.anchorEl === event.currentTarget &&
            flyout.group?.id === group.id
        ) {
            return;
        }
        clearHoverCloseTimer();
        setFlyout({
            group,
            items: filteredItems,
            left: pos.left,
            top: pos.top,
            anchorEl: event.currentTarget,
        });
    };

    /** Stroke tuned for 16px icons (hospital-style Lucide weight) */
    const strokeNavParent = 2.35;
    const strokeNavDefault = 2;

    const renderIcon = (iconString, isParent = false) => {
        const sw = isParent ? strokeNavParent : strokeNavDefault;
        const sizeCls = `${iconBtnClass(isParent)} shrink-0`;

        if (!iconString) {
            return <Circle className={sizeCls} strokeWidth={sw} aria-hidden />;
        }

        if (
            typeof iconString === 'string' &&
            (iconString.startsWith('fas ') || iconString.startsWith('fab '))
        ) {
            const Cmp = mapFontAwesomeToLucide(iconString);
            return <Cmp className={sizeCls} strokeWidth={sw} aria-hidden />;
        }

        if (React.isValidElement(iconString)) {
            const className = iconString?.props?.className || '';
            if (
                iconString?.type === 'i' ||
                className.includes('fa-') ||
                className.includes('fas ') ||
                className.includes('fab ')
            ) {
                const Cmp = mapFontAwesomeToLucide(className);
                return <Cmp className={sizeCls} strokeWidth={sw} aria-hidden />;
            }
            return React.cloneElement(iconString, {
                ...iconString.props,
                strokeWidth: sw,
                className: `${iconString.props.className || ''} ${sizeCls}`.trim(),
            });
        }

        return <Circle className={sizeCls} strokeWidth={sw} aria-hidden />;
    };

    if (loading) {
        return (
            <div className="space-y-4 px-3 py-2">
                {[1, 2, 3, 4].map((index) => (
                    <div key={index} className="space-y-2">
                        <div className="h-10 animate-pulse rounded-xl bg-gray-200/90" />
                        <div className="ml-2 space-y-2">
                            <div className="h-8 animate-pulse rounded-lg bg-gray-100" />
                            <div className="h-8 animate-pulse rounded-lg bg-gray-100" />
                            <div className="h-8 animate-pulse rounded-lg bg-gray-100" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="m-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Permission error
                </div>
                <p className="mb-3 text-red-700">{error}</p>
                <button
                    type="button"
                    onClick={refreshPermissions}
                    className="rounded-lg bg-red-600 px-3 py-2 text-white transition-colors hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    const accessibleGroups = getAccessibleMenuGroups();
    const searchQuery = searchValue.trim().toLowerCase();
    const hasSearchMatches =
        searchQuery === '' ||
        accessibleGroups.some((group) =>
            group.items.some((item) => item.label.toLowerCase().includes(searchQuery))
        );

    if (!isSuperAdmin() && accessibleGroups.length === 0) {
        return (
            <div className="p-6 text-center text-slate-600">
                <Shield className="mx-auto mb-3 h-12 w-12 text-slate-400" strokeWidth={1.5} />
                <h3 className="mb-2 text-lg font-semibold text-slate-800">No access</h3>
                <p className="text-sm leading-relaxed">
                    You don&apos;t have access to any menu items. Please contact your administrator.
                </p>
                {user && (
                    <p className="mt-4 text-xs text-slate-500">
                        User: {user.firstName} {user.lastName}
                        <br />
                        Role: {user.roleName || user.role}
                    </p>
                )}
            </div>
        );
    }

    const flyoutPanel =
        flyout && flyout.items?.length > 0 ? (
            <div
                role="menu"
                className="sidebar-submenu-flyout fixed z-[1100] max-h-[72vh] w-72 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_12px_40px_rgba(15,23,42,0.1)] ring-1 ring-slate-100/80 scrollbar-thin"
                style={{
                    left: flyout.left,
                    top: flyout.top,
                    scrollbarWidth: 'thin',
                }}
                onMouseEnter={clearHoverCloseTimer}
                onMouseLeave={closeFlyoutSoon}
            >
                <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {flyout.group.title}
                </p>
                <ul className="space-y-1 p-0">
                    {flyout.items.map((item) => {
                        const selected = activeItem === item.path;
                        return (
                            <li key={`flyout-${item.id}`}>
                                <button
                                    type="button"
                                    className={`nav-submenu-child flex w-full rounded-lg py-2 pl-2 pr-3 text-left text-[13px] leading-snug transition-colors duration-200 ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                                        selected
                                            ? 'sidebar-submenu-active bg-white font-semibold text-slate-900 shadow-sm'
                                            : 'font-normal text-slate-600 shadow-none hover:bg-white/80 hover:text-slate-900'
                                    }`}
                                    onClick={() => {
                                        handleItemClick(item);
                                        closeFlyout();
                                    }}
                                >
                                    {item.label}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ) : null;

    return (
        <div
            className="sidebar-nav-scroll h-full w-full min-h-0 overflow-visible"
            onMouseEnter={clearHoverCloseTimer}
            onMouseLeave={() => {
                if (isCollapsed) closeFlyoutSoon();
            }}
        >
            {typeof document !== 'undefined' && flyoutPanel
                ? createPortal(flyoutPanel, document.body)
                : null}

            {isSuperAdmin() && (
                <div className="mb-3 px-2 pt-1">
                    <span className="flex items-center justify-center gap-1.5 rounded-lg border border-green-200/90 bg-green-50 px-2 py-1.5 text-xs font-semibold text-green-900">
                        <Shield className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Super Admin
                    </span>
                </div>
            )}

            {hasSearchMatches ? (
            <nav
                className="sidebar-nav-tw flex flex-col space-y-1.5 px-1 pb-2 pt-1"
                aria-label="Main navigation"
            >
                {accessibleGroups.map((group) => {
                    const filteredItems =
                        searchValue.trim() === ''
                            ? group.items
                            : group.items.filter((item) =>
                                  item.label.toLowerCase().includes(searchValue.toLowerCase())
                              );

                    if (searchValue.trim() !== '' && filteredItems.length === 0) {
                        return null;
                    }

                    const hasActiveItem = filteredItems.some((item) => activeItem === item.path);
                    const expanded = !!expandedGroups[group.id];
                    /** Brand tint only when this section contains the current route — not merely expanded */
                    const parentHighlight = hasActiveItem;

                    const parentBase =
                        'sidebar-nav-parent group flex w-full gap-2 rounded-[8px] border-0 text-left text-[13.5px] font-medium leading-snug shadow-none outline-none transition-all duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9fafb]';

                    const parentState = parentHighlight
                        ? 'bg-white/70 text-slate-800 hover:bg-white/90'
                        : 'text-slate-700 hover:bg-white/55';

                    return (
                        <div key={group.id} className="dropdown-container min-w-0">
                            <div onMouseEnter={(e) => openFlyout(e, group, filteredItems)}>
                                <button
                                    type="button"
                                    aria-expanded={!isCollapsed ? expanded : undefined}
                                    className={`${parentBase} ${parentState} ${
                                        isCollapsed
                                            ? 'items-center justify-center px-1.5 py-2.5'
                                            : 'items-start justify-between px-2 py-2'
                                    } ${isCollapsed && hasActiveItem ? 'bg-white/80 text-slate-800 shadow-sm' : ''}`}
                                    onClick={() => {
                                        if (isCollapsed) return;
                                        handleGroupToggle(group.id);
                                    }}
                                >
                                    {showGroupIcons && (
                                        <span
                                            className={`shrink-0 pt-0.5 ${
                                                parentHighlight || (isCollapsed && hasActiveItem)
                                                    ? '[&_svg]:text-[var(--theme-brand)]'
                                                    : '[&_svg]:text-slate-600 group-hover:[&_svg]:text-slate-800'
                                            }`}
                                        >
                                            {renderIcon(group.icon, true)}
                                        </span>
                                    )}
                                    {!isCollapsed && (
                                        <>
                                            <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug pr-0.5">
                                                {group.title}
                                            </span>
                                            <span
                                                className={`shrink-0 pt-0.5 transition-colors duration-200 ${
                                                    parentHighlight
                                                        ? 'text-slate-600'
                                                        : 'text-slate-400 group-hover:text-slate-600'
                                                }`}
                                            >
                                                <ChevronDown
                                                    className={`h-3.5 w-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none ${
                                                        expanded ? 'rotate-180' : 'rotate-0'
                                                    }`}
                                                    strokeWidth={2}
                                                    aria-hidden
                                                />
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {!isCollapsed && (
                                <div
                                    className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
                                        expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                    }`}
                                >
                                    <div className="min-h-0">
                                        <div className="ml-1 mt-2 space-y-2.5 pb-1">
                                            {filteredItems.map((item) => {
                                                const selected = activeItem === item.path;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        title={isCollapsed ? item.label : undefined}
                                                        className={`nav-submenu-child w-full rounded-[7px] py-2 pl-2 pr-2 text-left text-[13px] leading-snug outline-none transition-colors duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-green-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9fafb] ${
                                                            selected
                                                                ? 'sidebar-submenu-active bg-white font-semibold text-slate-900 shadow-sm'
                                                                : 'font-normal text-slate-600 hover:bg-white/70 hover:text-slate-900'
                                                        }`}
                                                        onClick={() => handleItemClick(item)}
                                                    >
                                                        <span className="block min-w-0 whitespace-normal break-words leading-snug">
                                                            {item.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>
            ) : (
                <div className="mx-2 rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-8 text-center">
                    <p className="text-sm font-medium text-slate-800">No menu matches</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Try a different word or clear the search box.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PermissionBasedSidebar;
