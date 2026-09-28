const { query } = require('../db');

/**
 * Pre-generate Absent rows for every active member on a meeting.
 * Uses INSERT IGNORE so re-runs are safe (UNIQUE meeting_id + member_id).
 */
async function createAttendanceForMeeting(meetingId, runQuery = query) {
  const id = Number(meetingId);
  if (!id) return { inserted: 0 };

  const result = await runQuery(
    `INSERT IGNORE INTO attendance (meeting_id, member_id, status, recorded_at)
     SELECT ?, m.id, 'absent', NULL
     FROM members m
     WHERE m.status = 1`,
    [id]
  );

  return { inserted: result.affectedRows || 0 };
}

/**
 * Pre-generate Absent rows for one member on all upcoming scheduled meetings.
 * Past meetings are not backfilled (PRD).
 */
async function createAttendanceForMemberUpcoming(memberId, runQuery = query) {
  const id = Number(memberId);
  if (!id) return { inserted: 0 };

  const result = await runQuery(
    `INSERT IGNORE INTO attendance (meeting_id, member_id, status, recorded_at)
     SELECT mt.id, ?, 'absent', NULL
     FROM meetings mt
     WHERE mt.status IN ('scheduled', 'ongoing')
       AND mt.meeting_date >= CURDATE()`,
    [id]
  );

  return { inserted: result.affectedRows || 0 };
}

module.exports = {
  createAttendanceForMeeting,
  createAttendanceForMemberUpcoming,
};
