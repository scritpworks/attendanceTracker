const express = require('express');
const authenticateToken = require('../middleware/auth');
const { query, executeTransaction, executeQuery } = require('../db');

const router = express.Router();

const MEMBER_CODE_RE = /^\d{10}$/;
const MEETING_STATUSES = new Set(['scheduled', 'ongoing', 'closed', 'cancelled']);

function normalizeMeetingStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return MEETING_STATUSES.has(s) ? s : 'scheduled';
}

function formatRecordedAt(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function mapRosterRow(row) {
  return {
    attendanceId: row.attendance_id,
    memberRowId: row.member_row_id,
    id: row.member_code,
    memberCode: row.member_code,
    name: row.full_name,
    status: row.status === 'present' ? 'present' : 'absent',
    recordedAt: formatRecordedAt(row.recorded_at),
    markedById: row.marked_by ?? null,
  };
}

const ROSTER_SELECT = `
  SELECT
    a.id AS attendance_id,
    a.member_id AS member_row_id,
    m.member_id AS member_code,
    m.full_name,
    a.status,
    a.recorded_at,
    a.marked_by
  FROM attendance a
  INNER JOIN members m ON m.id = a.member_id
  WHERE a.meeting_id = ?
  ORDER BY m.full_name ASC, m.member_id ASC
`;

async function loadMeetingOrFail(meetingId) {
  const rows = await query(
    `SELECT
       id,
       title,
       DATE_FORMAT(meeting_date, '%Y-%m-%d') AS meeting_date,
       TIME_FORMAT(meeting_time, '%H:%i') AS meeting_time,
       status
     FROM meetings
     WHERE id = ?
     LIMIT 1`,
    [meetingId]
  );
  return rows[0] || null;
}

async function applyBulkMark({ meetingId, items, markedBy }) {
  const meeting = await loadMeetingOrFail(meetingId);
  if (!meeting) {
    const err = new Error('Meeting not found');
    err.status = 404;
    throw err;
  }
  const meetingStatus = normalizeMeetingStatus(meeting.status);
  if (meetingStatus === 'closed') {
    const err = new Error(
      'This meeting has been closed. Attendance can no longer be marked.'
    );
    err.status = 400;
    err.code = 'MEETING_CLOSED';
    throw err;
  }
  if (meetingStatus === 'cancelled') {
    const err = new Error('Cannot mark attendance for a cancelled meeting');
    err.status = 400;
    throw err;
  }

  if (markedBy) {
    const staff = await query(
      'SELECT id FROM users WHERE id = ? AND status = 1 LIMIT 1',
      [markedBy]
    );
    if (!staff.length) {
      const err = new Error('Invalid marker account');
      err.status = 400;
      throw err;
    }
  }

  const normalized = [];
  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i] || {};
    const status = String(raw.status || '').trim().toLowerCase();
    if (status !== 'present' && status !== 'absent') {
      const err = new Error(`Item ${i + 1}: status must be present or absent`);
      err.status = 400;
      throw err;
    }

    const memberRowId = Number(raw.memberId ?? raw.member_id ?? raw.memberRowId);
    const memberCode = String(raw.memberCode ?? raw.member_code ?? raw.id ?? '').trim();

    if (memberRowId) {
      normalized.push({ memberRowId, status });
    } else if (MEMBER_CODE_RE.test(memberCode)) {
      normalized.push({ memberCode, status });
    } else {
      const err = new Error(
        `Item ${i + 1}: provide memberId (internal) or a 10-digit memberCode`
      );
      err.status = 400;
      throw err;
    }
  }

  const codes = [...new Set(normalized.filter((n) => n.memberCode).map((n) => n.memberCode))];
  const codeMap = new Map();
  if (codes.length) {
    const placeholders = codes.map(() => '?').join(',');
    const found = await query(
      `SELECT id, member_id FROM members WHERE member_id IN (${placeholders})`,
      codes
    );
    found.forEach((r) => codeMap.set(r.member_id, r.id));
    for (const code of codes) {
      if (!codeMap.has(code)) {
        const err = new Error(`Member ID ${code} was not found`);
        err.status = 404;
        throw err;
      }
    }
  }

  const byMember = new Map();
  normalized.forEach((n) => {
    const id = n.memberRowId || codeMap.get(n.memberCode);
    byMember.set(id, n.status);
  });

  const memberIds = [...byMember.keys()];
  const existing = await query(
    `SELECT member_id FROM attendance WHERE meeting_id = ? AND member_id IN (${memberIds
      .map(() => '?')
      .join(',')})`,
    [meetingId, ...memberIds]
  );
  const existingSet = new Set(existing.map((r) => Number(r.member_id)));
  for (const mid of memberIds) {
    if (!existingSet.has(mid)) {
      const err = new Error(`No attendance row for this member in the selected meeting`);
      err.status = 400;
      throw err;
    }
  }

  let presentCount = 0;
  let absentCount = 0;

  await executeTransaction(async (conn) => {
    for (const [memberRowId, status] of byMember.entries()) {
      if (status === 'present') {
        presentCount += 1;
        await executeQuery(
          conn,
          `UPDATE attendance
           SET status = 'present',
               recorded_at = COALESCE(recorded_at, CURRENT_TIMESTAMP),
               marked_by = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE meeting_id = ? AND member_id = ?`,
          [markedBy, meetingId, memberRowId]
        );
      } else {
        absentCount += 1;
        await executeQuery(
          conn,
          `UPDATE attendance
           SET status = 'absent',
               recorded_at = NULL,
               marked_by = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE meeting_id = ? AND member_id = ?`,
          [markedBy, meetingId, memberRowId]
        );
      }
    }

    if (meetingStatus === 'scheduled') {
      await executeQuery(
        conn,
        `UPDATE meetings
         SET status = 'ongoing',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'scheduled'`,
        [meetingId]
      );
    }
  });

  const roster = await query(ROSTER_SELECT, [meetingId]);
  const mapped = roster.map(mapRosterRow);
  const present = mapped.filter((r) => r.status === 'present').length;

  return {
    meetingId,
    meetingStatus: meetingStatus === 'scheduled' ? 'ongoing' : meetingStatus,
    updated: byMember.size,
    presentCount,
    absentCount,
    rows: mapped,
    summary: {
      total: mapped.length,
      present,
      absent: mapped.length - present,
    },
  };
}

/** GET /api/attendance/meetings */
router.get('/meetings', authenticateToken, async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         mt.id,
         mt.title,
         DATE_FORMAT(mt.meeting_date, '%Y-%m-%d') AS date,
         TIME_FORMAT(mt.meeting_time, '%H:%i') AS time,
         mt.status,
         (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = mt.id) AS member_count,
         (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = mt.id AND a.status = 'present') AS present_count
       FROM meetings mt
       WHERE mt.status IN ('scheduled', 'ongoing')
       ORDER BY mt.meeting_date DESC, mt.meeting_time DESC, mt.id DESC`
    );

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        time: r.time,
        status: normalizeMeetingStatus(r.status),
        memberCount: Number(r.member_count) || 0,
        presentCount: Number(r.present_count) || 0,
      })),
    });
  } catch (err) {
    console.error('Error fetching attendance meetings:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** GET /api/attendance/meeting/:meetingId — read roster (including closed meetings) */
router.get('/meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const meetingId = Number(req.params.meetingId);
    if (!meetingId) {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }

    const meeting = await loadMeetingOrFail(meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const meetingStatus = normalizeMeetingStatus(meeting.status);

    const rows = await query(ROSTER_SELECT, [meetingId]);
    const roster = rows.map(mapRosterRow);
    const present = roster.filter((r) => r.status === 'present').length;

    res.json({
      success: true,
      data: {
        meeting: {
          id: meeting.id,
          title: meeting.title,
          date: meeting.meeting_date,
          time: meeting.meeting_time,
          status: meetingStatus,
        },
        rows: roster,
        summary: {
          total: roster.length,
          present,
          absent: roster.length - present,
        },
        readOnly: meetingStatus === 'closed' || meetingStatus === 'cancelled',
      },
    });
  } catch (err) {
    console.error('Error fetching attendance roster:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * POST /api/attendance/mark
 * Bulk mark many members for one meeting.
 * Body: { meetingId, items: [{ memberId|memberCode, status }] }
 */
router.post('/mark', authenticateToken, async (req, res) => {
  const meetingId = Number(req.body?.meetingId ?? req.body?.meeting_id);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  const markedBy = Number(req.user?.id) || null;

  if (!meetingId) {
    return res.status(400).json({ success: false, message: 'meetingId is required' });
  }
  if (!items || !items.length) {
    return res.status(400).json({
      success: false,
      message: 'items must be a non-empty array of { memberId|memberCode, status }',
    });
  }
  if (items.length > 2000) {
    return res.status(400).json({ success: false, message: 'Too many items in one request' });
  }

  try {
    const data = await applyBulkMark({ meetingId, items, markedBy });
    res.json({
      success: true,
      message: `Attendance applied — ${data.presentCount} Present, ${data.absentCount} Absent.`,
      data,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('Error marking attendance:', err);
    res.status(status).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

/**
 * POST /api/attendance/mark-one
 * Mark a single member by 10-digit Member ID.
 */
router.post('/mark-one', authenticateToken, async (req, res) => {
  const meetingId = Number(req.body?.meetingId ?? req.body?.meeting_id);
  const memberCode = String(
    req.body?.memberCode ?? req.body?.memberId ?? req.body?.member_id ?? ''
  ).trim();
  const status = String(req.body?.status || 'present').trim().toLowerCase();
  const markedBy = Number(req.user?.id) || null;

  if (!meetingId) {
    return res.status(400).json({ success: false, message: 'meetingId is required' });
  }
  if (!MEMBER_CODE_RE.test(memberCode)) {
    return res.status(400).json({
      success: false,
      message: 'Member ID must be exactly 10 digits',
    });
  }
  if (status !== 'present' && status !== 'absent') {
    return res.status(400).json({ success: false, message: 'status must be present or absent' });
  }

  try {
    const data = await applyBulkMark({
      meetingId,
      items: [{ memberCode, status }],
      markedBy,
    });
    res.json({
      success: true,
      message:
        status === 'present'
          ? `Marked Present: ${memberCode}`
          : `Marked Absent: ${memberCode}`,
      data,
    });
  } catch (err) {
    const statusCode = err.status || 500;
    if (statusCode >= 500) console.error('Error marking one attendance:', err);
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Server error',
    });
  }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/attendance/history
 * Closed/ended meetings only, filterable by date range.
 * Query: from, to (YYYY-MM-DD), search (meeting title)
 */
router.get('/history', authenticateToken, async (req, res) => {
  const from = String(req.query.from || '').trim().slice(0, 10);
  const to = String(req.query.to || '').trim().slice(0, 10);
  const search = String(req.query.search || req.query.q || '').trim();

  if (from && !DATE_RE.test(from)) {
    return res.status(400).json({ success: false, message: 'Invalid from date. Use YYYY-MM-DD.' });
  }
  if (to && !DATE_RE.test(to)) {
    return res.status(400).json({ success: false, message: 'Invalid to date. Use YYYY-MM-DD.' });
  }
  if (from && to && from > to) {
    return res.status(400).json({
      success: false,
      message: 'From date cannot be after to date.',
    });
  }

  try {
    const where = [`mt.status = 'closed'`];
    const params = [];

    if (from) {
      where.push(`mt.meeting_date >= ?`);
      params.push(from);
    }
    if (to) {
      where.push(`mt.meeting_date <= ?`);
      params.push(to);
    }
    if (search) {
      where.push(`mt.title LIKE ?`);
      params.push(`%${search}%`);
    }

    const rows = await query(
      `SELECT
         mt.id,
         mt.title,
         DATE_FORMAT(mt.meeting_date, '%Y-%m-%d') AS meeting_date,
         TIME_FORMAT(mt.meeting_time, '%H:%i') AS meeting_time,
         mt.status,
         COUNT(a.id) AS member_count,
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count
       FROM meetings mt
       LEFT JOIN attendance a ON a.meeting_id = mt.id
       WHERE ${where.join(' AND ')}
       GROUP BY mt.id, mt.title, mt.meeting_date, mt.meeting_time, mt.status
       ORDER BY mt.meeting_date DESC, mt.meeting_time DESC, mt.id DESC
       LIMIT 1000`,
      params
    );

    const mapped = rows.map((r) => {
      const memberCount = Number(r.member_count) || 0;
      const presentCount = Number(r.present_count) || 0;
      return {
        id: r.id,
        title: r.title,
        date: r.meeting_date,
        time: r.meeting_time,
        status: normalizeMeetingStatus(r.status),
        memberCount,
        presentCount,
        absentCount: Math.max(0, memberCount - presentCount),
      };
    });

    res.json({
      success: true,
      data: {
        rows: mapped,
        summary: {
          total: mapped.length,
          present: mapped.reduce((s, m) => s + m.presentCount, 0),
          absent: mapped.reduce((s, m) => s + m.absentCount, 0),
        },
        filters: {
          from: from || null,
          to: to || null,
          search: search || null,
        },
      },
    });
  } catch (err) {
    console.error('Error fetching attendance history:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
