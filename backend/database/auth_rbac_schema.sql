-- Attendance Tracker — auth + RBAC tables (mirrors JERP / online_sch structure)
-- Usage:
--   1. CREATE DATABASE attendance_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   2. mysql -u root attendance_tracker < database/auth_rbac_schema.sql
--   or: npm run db:setup

CREATE DATABASE IF NOT EXISTS attendance_tracker
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendance_tracker;

-- ---------------------------------------------------------------------------
-- Core auth
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_roles (
  role_id INT NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id),
  UNIQUE KEY role_name (role_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  telephone VARCHAR(15) NOT NULL DEFAULT '',
  gender VARCHAR(100) DEFAULT '-',
  status INT DEFAULT 1,
  fresh INT DEFAULT 1,
  role VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  pass TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  image BLOB DEFAULT NULL,
  username VARCHAR(100) DEFAULT NULL,
  password_hash TEXT DEFAULT NULL,
  state INT DEFAULT 0,
  login_status VARCHAR(100) DEFAULT NULL,
  department VARCHAR(100) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  session_revoked_at DATETIME DEFAULT NULL,
  last_seen_at DATETIME DEFAULT NULL,
  presence_status VARCHAR(20) NOT NULL DEFAULT 'offline',
  account_expires_at DATETIME DEFAULT NULL,
  login_time_start VARCHAR(5) DEFAULT NULL,
  login_time_end VARCHAR(5) DEFAULT NULL,
  allowed_login_days JSON DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS loginlogs (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  status ENUM('success', 'failed') NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  failure_reason VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_loginlogs_username (username),
  KEY idx_loginlogs_status (status),
  KEY idx_loginlogs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Menu-path RBAC
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_groups (
  id INT NOT NULL AUTO_INCREMENT,
  group_name VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  icon VARCHAR(100) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  description TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY group_name (group_name),
  KEY idx_active (is_active),
  KEY idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT NOT NULL AUTO_INCREMENT,
  label VARCHAR(100) NOT NULL,
  path VARCHAR(255) NOT NULL,
  icon VARCHAR(100) DEFAULT NULL,
  group_name VARCHAR(50) NOT NULL,
  parent_id INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  is_modal TINYINT(1) DEFAULT 0,
  component_name VARCHAR(100) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_group (group_name),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS system_permissions (
  permission_id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource_id INT DEFAULT NULL,
  icon VARCHAR(100) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (permission_id),
  UNIQUE KEY name (name),
  KEY idx_resource (resource, resource_id),
  KEY idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INT NOT NULL DEFAULT 0,
  permission_id INT NOT NULL DEFAULT 0,
  PRIMARY KEY (role_id, permission_id),
  KEY permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seed: roles
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO system_roles (role_id, role_name, description) VALUES
(1, 'Administrator', 'Full system access — super admin bypass'),
(2, 'Manager', 'Operational manager'),
(3, 'Staff', 'Standard staff access');

-- ---------------------------------------------------------------------------
-- Seed: menu groups (aligned with frontend sidebarMenuConfig)
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO menu_groups (group_name, display_name, icon, sort_order) VALUES
('dashboard', 'Dashboard', 'fas fa-dashboard', 1),
('members', 'Members', 'fas fa-users', 2),
('meetings', 'Meetings', 'fas fa-calendar-alt', 3),
('attendance', 'Attendance', 'fas fa-user-check', 4),
('reports', 'Reports', 'fas fa-chart-bar', 5),
('settings', 'Settings', 'fas fa-cog', 6);

-- ---------------------------------------------------------------------------
-- Seed: menu items
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO menu_items (label, path, icon, group_name, sort_order, is_modal, description) VALUES
('Dashboard', '/side', 'fas fa-dashboard', 'dashboard', 1, 0, 'Administrator dashboard'),
('Members', '/side/members', 'fas fa-users', 'members', 1, 0, 'Register and manage members'),
('Meetings', '/side/meetings', 'fas fa-calendar-alt', 'meetings', 1, 0, 'Schedule and manage meetings'),
('Take Attendance', '/side/attendance', 'fas fa-user-check', 'attendance', 1, 0, 'Mark attendance for a meeting'),
('History', '/side/attendance-history', 'fas fa-history', 'attendance', 2, 0, 'Browse attendance history by date'),
('Reports', '/side/reports', 'fas fa-chart-bar', 'reports', 1, 0, 'Attendance reports and exports'),
('System Roles', '/side/roles', 'fas fa-user-shield', 'settings', 1, 0, 'Manage system roles'),
('Permissions', '/side/permissions', 'fas fa-key', 'settings', 2, 0, 'Assign menu permissions to roles'),
('Staff Registration', '/side/staff', 'fas fa-user-tie', 'settings', 3, 0, 'Manage staff users');

-- Permissions for every menu item
INSERT IGNORE INTO system_permissions (name, description, resource, action, resource_id, is_active)
SELECT
  CONCAT('menu_item_', mi.id),
  CONCAT('Access to menu item: ', mi.label),
  'menu_item',
  'view',
  mi.id,
  1
FROM menu_items mi;

-- Grant Administrator (role_id = 1) all menu permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, sp.permission_id
FROM system_permissions sp
WHERE sp.resource = 'menu_item';

-- ---------------------------------------------------------------------------
-- Seed: default admin user
-- Email: admin@attendance.local
-- Password: admin123
-- role stores system_roles.role_id as string (same pattern as JERP)
-- ---------------------------------------------------------------------------

INSERT IGNORE INTO users (
  id, first_name, last_name, email, telephone, status, fresh, role, password_hash, username
) VALUES (
  1,
  'Admin',
  'User',
  'admin@attendance.local',
  '0000000000',
  1,
  0,
  '1',
  '$2b$10$bQ/OGsrVAzk9rNPhIX39jupNF3xjnVDs0LLsH09ka5EjNFqFNceKK',
  'admin'
);
