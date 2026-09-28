-- Attendance table for MyApp_ATTR
-- No FOREIGN KEY constraints — validate meeting_id / member_id / marked_by in app logic.
--
-- Rules (PRD):
--   - One row per member per meeting (UNIQUE)
--   - Rows are pre-generated (default status = absent, recorded_at NULL)
--   - Never hard-delete attendance rows
--
-- Usage:
--   mysql -u root attendance_tracker < database/attendance_schema.sql
--   or apply via MCP / phpMyAdmin

USE attendance_tracker;

-- ---------------------------------------------------------------------------
-- attendance
-- member_id  = members.id (internal PK)
-- meeting_id = meetings.id
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS attendance (
  id INT NOT NULL AUTO_INCREMENT,
  meeting_id INT NOT NULL COMMENT 'meetings.id (no FK)',
  member_id INT NOT NULL COMMENT 'members.id internal PK (no FK)',
  status VARCHAR(20) NOT NULL DEFAULT 'absent'
    COMMENT 'present | absent — only these two values',
  recorded_at TIMESTAMP NULL DEFAULT NULL
    COMMENT 'When marked Present; NULL while Absent',
  marked_by INT DEFAULT NULL COMMENT 'staff users.id who last set Present/Absent (no FK)',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_meeting_member (meeting_id, member_id),
  KEY idx_attendance_meeting (meeting_id),
  KEY idx_attendance_member (member_id),
  KEY idx_attendance_status (status),
  KEY idx_attendance_meeting_status (meeting_id, status),
  KEY idx_attendance_marked_by (marked_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
