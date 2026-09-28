-- Sidebar cleanup: remove school leftovers, seed MyApp_ATTR menus
USE attendance_tracker;

-- Remove role links to old menu permissions
DELETE rp FROM role_permissions rp
INNER JOIN system_permissions sp ON rp.permission_id = sp.permission_id
WHERE sp.resource = 'menu_item';

-- Remove old menu permissions
DELETE FROM system_permissions WHERE resource = 'menu_item';

-- Clear menus
DELETE FROM menu_items;
DELETE FROM menu_groups;

-- Groups
INSERT INTO menu_groups (group_name, display_name, icon, sort_order, is_active) VALUES
('dashboard', 'Dashboard', 'fas fa-dashboard', 1, 1),
('members', 'Members', 'fas fa-users', 2, 1),
('meetings', 'Meetings', 'fas fa-calendar-alt', 3, 1),
('attendance', 'Attendance', 'fas fa-user-check', 4, 1),
('reports', 'Reports', 'fas fa-chart-bar', 5, 1),
('settings', 'Settings', 'fas fa-cog', 6, 1);

-- Items
INSERT INTO menu_items (label, path, icon, group_name, sort_order, is_modal, description, is_active) VALUES
('Dashboard', '/side', 'fas fa-dashboard', 'dashboard', 1, 0, 'Administrator dashboard', 1),
('Members', '/side/members', 'fas fa-users', 'members', 1, 0, 'Register and manage members', 1),
('Meetings', '/side/meetings', 'fas fa-calendar-alt', 'meetings', 1, 0, 'Schedule and manage meetings', 1),
('Take Attendance', '/side/attendance', 'fas fa-user-check', 'attendance', 1, 0, 'Mark attendance for a meeting', 1),
('History', '/side/attendance-history', 'fas fa-history', 'attendance', 2, 0, 'Browse attendance history by date', 1),
('Reports', '/side/reports', 'fas fa-chart-bar', 'reports', 1, 0, 'Attendance reports and exports', 1),
('System Roles', '/side/roles', 'fas fa-user-shield', 'settings', 1, 0, 'Manage system roles', 1),
('Permissions', '/side/permissions', 'fas fa-key', 'settings', 2, 0, 'Assign menu permissions to roles', 1),
('Staff Registration', '/side/staff', 'fas fa-user-tie', 'settings', 3, 0, 'Manage staff users', 1);

-- Permissions for every menu item
INSERT INTO system_permissions (name, description, resource, action, resource_id, is_active)
SELECT
  CONCAT('menu_item_', mi.id),
  CONCAT('Access to menu item: ', mi.label),
  'menu_item',
  'view',
  mi.id,
  1
FROM menu_items mi;

-- Grant Administrator (role_id = 1) all menu permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, sp.permission_id
FROM system_permissions sp
WHERE sp.resource = 'menu_item';
