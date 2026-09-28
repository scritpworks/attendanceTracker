-- Meetings table for MyApp_ATTR
-- No FOREIGN KEY constraints — validate references (created_by → users.id) in app logic.
-- Meetings are never hard-deleted.
-- Lifecycle: scheduled → ongoing (first mark) → closed (user ends meeting).
-- Cancel is only allowed while status = scheduled.
--
-- Usage:
--   mysql -u root attendance_tracker < database/meetings_schema.sql
--   or apply via MCP / phpMyAdmin

USE attendance_tracker;

-- ---------------------------------------------------------------------------
-- meetings
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS meetings (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    COMMENT 'scheduled | ongoing | closed | cancelled — never hard-delete meetings',
  notes TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL COMMENT 'staff users.id who created this meeting (no FK)',
  cancelled_by INT DEFAULT NULL COMMENT 'staff users.id who cancelled (no FK)',
  cancelled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meetings_date (meeting_date),
  KEY idx_meetings_status (status),
  KEY idx_meetings_date_status (meeting_date, status),
  KEY idx_meetings_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
