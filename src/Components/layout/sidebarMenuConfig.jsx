import React from 'react';

/**
 * Fallback menu config (used by stubs / search).
 * Live sidebar comes from DB via /api/rbac/user-menu — keep these in sync when seeding.
 */
export const allMenuItems = [
  // Dashboard
  { label: 'Dashboard', path: '/side', icon: 'fas fa-dashboard', group: 'dashboard' },

  // Members
  { label: 'Members', path: '/side/members', icon: 'fas fa-users', group: 'members' },

  // Meetings
  { label: 'Meetings', path: '/side/meetings', icon: 'fas fa-calendar-alt', group: 'meetings' },

  // Attendance
  { label: 'Take Attendance', path: '/side/attendance', icon: 'fas fa-user-check', group: 'attendance' },
  { label: 'History', path: '/side/attendance-history', icon: 'fas fa-history', group: 'attendance' },

  // Reports
  { label: 'Reports', path: '/side/reports', icon: 'fas fa-chart-bar', group: 'reports' },

  // Settings / access
  { label: 'System Roles', path: '/side/roles', icon: 'fas fa-user-shield', group: 'settings' },
  { label: 'Permissions', path: '/side/permissions', icon: 'fas fa-key', group: 'settings' },
  { label: 'Staff Registration', path: '/side/staff', icon: 'fas fa-user-tie', group: 'settings' },
];

export function getMenuGroups(menuItems) {
  const groupTitles = {
    dashboard: 'Dashboard',
    members: 'Members',
    meetings: 'Meetings',
    attendance: 'Attendance',
    reports: 'Reports',
    settings: 'Settings',
  };

  const groupIcons = {
    dashboard: <i className="fas fa-dashboard" style={{ fontSize: '1.2rem' }} />,
    members: <i className="fas fa-users" style={{ fontSize: '1.2rem' }} />,
    meetings: <i className="fas fa-calendar-alt" style={{ fontSize: '1.2rem' }} />,
    attendance: <i className="fas fa-user-check" style={{ fontSize: '1.2rem' }} />,
    reports: <i className="fas fa-chart-bar" style={{ fontSize: '1.2rem' }} />,
    settings: <i className="fas fa-cog" style={{ fontSize: '1.2rem' }} />,
  };

  return Object.keys(groupTitles).map((id) => ({
    id,
    title: groupTitles[id],
    icon: groupIcons[id],
    items: menuItems.filter((item) => item.group === id),
  }));
}

export default allMenuItems;
