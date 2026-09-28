-- Members table for MyApp_ATTR
-- No FOREIGN KEY constraints — validate references (created_by → users.id) in app logic.
-- Credentials live on members (same idea as school stut_acc, without a second table).
--
-- Usage:
--   mysql -u root attendance_tracker < database/members_schema.sql
--   or apply via MCP / phpMyAdmin

USE attendance_tracker;

-- ---------------------------------------------------------------------------
-- members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS members (
  id INT NOT NULL AUTO_INCREMENT,
  member_id CHAR(10) NOT NULL COMMENT 'Exactly 10 digits; unique Member ID used for login',
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL DEFAULT '',
  email VARCHAR(150) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  password_hash TEXT NOT NULL,
  fresh TINYINT NOT NULL DEFAULT 1 COMMENT '1 = must change password on first login',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '1 = active, 0 = inactive (soft delete)',
  joined_at DATE NOT NULL,
  created_by INT DEFAULT NULL COMMENT 'staff users.id who registered this member (no FK)',
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_members_member_id (member_id),
  KEY idx_members_status (status),
  KEY idx_members_full_name (full_name),
  KEY idx_members_created_by (created_by),
  KEY idx_members_joined_at (joined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
