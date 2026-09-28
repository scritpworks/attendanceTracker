const express = require('express');
const authenticateToken = require('../middleware/auth');
const { query } = require('../db');
const { createAttendanceForMeeting } = require('../utils/attendanceRows');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const MEETING_STATUSES = new Set(['scheduled', 'ongoing', 'closed', 'cancelled']);
const EDITABLE_STATUSES = new Set(['scheduled', 'ongoing']);
const ACTIVE_STATUSES_SQL = `mt.status IN ('scheduled', 'ongoing')`;

function normalizeMeetingStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  return MEETING_STATUSES.has(s) ? s : 'scheduled';
}

const mapMeetingRow = (row) => ({
  id: row.id,
  title: row.title,
  date: row.meeting_date || null,
  time: row.meeting_time || null,
  status: normalizeMeetingStatus(row.status),
  notes: row.notes || '',
  memberCount: Number(row.member_count) || 0,
  presentCount: Number(row.present_count) || 0,
  createdById: row.created_by ?? null,
  createdBy: (row.created_by_name || '').trim(),
  cancelledById: row.cancelled_by ?? null,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const MEETING_SELECT = `
  SELECT
    mt.id,
    mt.title,
    DATE_FORMAT(mt.meeting_date, '%Y-%m-%d') AS meeting_date,
    TIME_FORMAT(mt.meeting_time, '%H:%i') AS meeting_time,
    mt.status,
    mt.notes,
    mt.created_by,
    mt.cancelled_by,
    mt.cancelled_at,
    mt.created_at,
    mt.updated_at,
    TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS created_by_name,
    (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = mt.id) AS member_count,
    (SELECT COUNT(*) FROM attendance a WHERE a.meeting_id = mt.id AND a.status = 'present') AS present_count
  FROM meetings mt
  LEFT JOIN users u ON mt.created_by = u.id
`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTime(value) {
  const t = String(value || '').trim();
  if (!TIME_RE.test(t)) return null;
  return t.length === 5 ? `${t}:00` : t;
}

function displayTime(value) {
  const t = String(value || '').trim();
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function validateMeetingPayload({ title, date, time }, { allowPastDate = false } = {}) {
  if (!title?.trim()) return 'Title is required';
  if (!date || !DATE_RE.test(date)) return 'A valid meeting date is required';
  if (!time || !TIME_RE.test(time)) return 'A valid meeting time is required (HH:MM)';
  if (!allowPastDate && date < todayIso()) {
    return 'Meeting date cannot be in the past';
  }
  return null;
}

function mapMeetingReportRow(row) {
  const mapped = mapMeetingRow(row);
  return {
    id: mapped.id,
    title: mapped.title,
    date: mapped.date,
    time: mapped.time,
    status: mapped.status,
    notes: mapped.notes,
    createdBy: mapped.createdBy,
    createdById: mapped.createdById,
    cancelledAt: mapped.cancelledAt,
    createdAt: mapped.createdAt,
    memberCount: mapped.memberCount,
    presentCount: mapped.presentCount,
  };
}

function buildMeetingReportSummary(rows, today) {
  const active = rows.filter((r) => r.status === 'scheduled' || r.status === 'ongoing');
  return {
    total: rows.length,
    scheduled: rows.filter((r) => r.status === 'scheduled').length,
    ongoing: rows.filter((r) => r.status === 'ongoing').length,
    closed: rows.filter((r) => r.status === 'closed').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    upcoming: active.filter((r) => r.date >= today).length,
    past: active.filter((r) => r.date < today).length,
  };
}

function parseReportFilters(source = {}) {
  const status = String(source.status || 'all').trim().toLowerCase();
  const search = String(source.search || source.q || '').trim();
  const from = String(source.from || source.dateFrom || source.startDate || '').trim().slice(0, 10);
  const to = String(source.to || source.dateTo || source.endDate || '').trim().slice(0, 10);
  const includeCancelledRaw = source.includeCancelled;
  const includeCancelled =
    includeCancelledRaw === undefined || includeCancelledRaw === null || includeCancelledRaw === ''
      ? true
      : !['0', 'false', 'no'].includes(String(includeCancelledRaw).toLowerCase());

  const allowedStatus = new Set([
    'all',
    'scheduled',
    'ongoing',
    'closed',
    'cancelled',
    'upcoming',
    'past',
  ]);
  if (!allowedStatus.has(status)) {
    return {
      error:
        'Invalid status filter. Use all, scheduled, ongoing, closed, cancelled, upcoming, or past.',
    };
  }
  if (from && !DATE_RE.test(from)) {
    return { error: 'Invalid from date. Use YYYY-MM-DD.' };
  }
  if (to && !DATE_RE.test(to)) {
    return { error: 'Invalid to date. Use YYYY-MM-DD.' };
  }
  if (from && to && from > to) {
    return { error: 'From date cannot be after to date.' };
  }

  return { status, search, from, to, includeCancelled };
}

async function fetchMeetingReportRows(filters) {
  const today = todayIso();
  const where = [];
  const params = [];

  if (filters.status === 'cancelled') {
    where.push(`mt.status = 'cancelled'`);
  } else if (filters.status === 'closed') {
    where.push(`mt.status = 'closed'`);
  } else if (filters.status === 'ongoing') {
    where.push(`mt.status = 'ongoing'`);
  } else if (filters.status === 'scheduled') {
    where.push(`mt.status = 'scheduled'`);
  } else if (filters.status === 'upcoming' || filters.status === 'past') {
    where.push(ACTIVE_STATUSES_SQL);
    if (filters.status === 'upcoming') {
      where.push(`mt.meeting_date >= ?`);
      params.push(today);
    } else {
      where.push(`mt.meeting_date < ?`);
      params.push(today);
    }
  } else if (!filters.includeCancelled) {
    where.push(`mt.status IN ('scheduled', 'ongoing', 'closed')`);
  }

  if (filters.from) {
    where.push(`mt.meeting_date >= ?`);
    params.push(filters.from);
  }
  if (filters.to) {
    where.push(`mt.meeting_date <= ?`);
    params.push(filters.to);
  }
  if (filters.search) {
    where.push(`mt.title LIKE ?`);
    params.push(`%${filters.search}%`);
  }

  const sql = `
    ${MEETING_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY mt.meeting_date DESC, mt.meeting_time DESC, mt.id DESC
  `;

  const rows = await query(sql, params);
  return rows.map(mapMeetingReportRow);
}

/** GET /api/meetings */
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const rows = await query(
      `${MEETING_SELECT}
       ORDER BY mt.meeting_date DESC, mt.meeting_time DESC, mt.id DESC`
    );
    res.json({ success: true, data: rows.map(mapMeetingRow) });
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * GET /api/meetings/report
 * View / print all meetings with optional filters:
 *   status=all|scheduled|ongoing|closed|cancelled|upcoming|past
 *   from, to (YYYY-MM-DD)
 *   search
 *   includeCancelled=true|false (default true when status=all)
 */
router.get('/report', authenticateToken, async (req, res) => {
  const parsed = parseReportFilters(req.query || {});
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  try {
    const today = todayIso();
    const rows = await fetchMeetingReportRows(parsed);
    res.json({
      success: true,
      message: rows.length ? 'Meetings report ready' : 'No meetings match these filters',
      data: {
        rows,
        summary: buildMeetingReportSummary(rows, today),
        filters: {
          status: parsed.status,
          from: parsed.from || null,
          to: parsed.to || null,
          search: parsed.search || null,
          includeCancelled: parsed.includeCancelled,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error generating meetings report:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * POST /api/meetings/report
 * Same as GET /report but filters in JSON body (school-style report generate).
 */
router.post('/report', authenticateToken, async (req, res) => {
  const parsed = parseReportFilters(req.body || {});
  if (parsed.error) {
    return res.status(400).json({ success: false, message: parsed.error });
  }

  try {
    const today = todayIso();
    const rows = await fetchMeetingReportRows(parsed);
    res.json({
      success: true,
      message: rows.length ? 'Meetings report ready' : 'No meetings match these filters',
      data: {
        rows,
        summary: buildMeetingReportSummary(rows, today),
        filters: {
          status: parsed.status,
          from: parsed.from || null,
          to: parsed.to || null,
          search: parsed.search || null,
          includeCancelled: parsed.includeCancelled,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error generating meetings report:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * GET /api/meetings/report/:id
 * Report payload for a single meeting (list-of-one).
 */
router.get('/report/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }

    const rows = await query(`${MEETING_SELECT} WHERE mt.id = ? LIMIT 1`, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const reportRows = rows.map(mapMeetingReportRow);
    const today = todayIso();
    res.json({
      success: true,
      message: 'Meeting report ready',
      data: {
        rows: reportRows,
        summary: buildMeetingReportSummary(reportRows, today),
        filters: { meetingId: id },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Error fetching meeting report:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** GET /api/meetings/:id */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid meeting id' });
    }

    const rows = await query(`${MEETING_SELECT} WHERE mt.id = ? LIMIT 1`, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({ success: true, data: mapMeetingRow(rows[0]) });
  } catch (err) {
    console.error('Error fetching meeting:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/meetings/create */
router.post('/create', authenticateToken, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const date = String(req.body?.date ?? req.body?.meeting_date ?? '').trim().slice(0, 10);
  const timeRaw = String(req.body?.time ?? req.body?.meeting_time ?? '').trim();
  const notes = String(req.body?.notes || '').trim() || null;
  const time = normalizeTime(timeRaw);

  const validationError = validateMeetingPayload(
    { title, date, time: timeRaw },
    { allowPastDate: false }
  );
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  if (!time) {
    return res.status(400).json({ success: false, message: 'A valid meeting time is required (HH:MM)' });
  }

  const createdBy = Number(req.user?.id) || null;

  try {
    if (createdBy) {
      const staffRows = await query(
        'SELECT id FROM users WHERE id = ? AND status = 1 LIMIT 1',
        [createdBy]
      );
      if (!staffRows.length) {
        return res.status(400).json({ success: false, message: 'Invalid creator account' });
      }
    }

    const result = await query(
      `INSERT INTO meetings (
         title, meeting_date, meeting_time, status, notes, created_by
       ) VALUES (?, ?, ?, 'scheduled', ?, ?)`,
      [title, date, time, notes, createdBy]
    );

    const meetingId = result.insertId;
    const { inserted } = await createAttendanceForMeeting(meetingId);

    res.json({
      success: true,
      message: `Meeting scheduled successfully. Created ${inserted} attendance row(s) for active members.`,
      data: {
        id: meetingId,
        title,
        date,
        time: displayTime(time),
        status: 'scheduled',
        attendanceRows: inserted,
      },
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** POST /api/meetings/update */
router.post('/update', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  const title = String(req.body?.title || '').trim();
  const date = String(req.body?.date ?? req.body?.meeting_date ?? '').trim().slice(0, 10);
  const timeRaw = String(req.body?.time ?? req.body?.meeting_time ?? '').trim();
  const notes =
    req.body?.notes === undefined
      ? undefined
      : String(req.body.notes || '').trim() || null;
  const time = normalizeTime(timeRaw);

  if (!id) {
    return res.status(400).json({ success: false, message: 'Meeting id is required' });
  }

  const validationError = validateMeetingPayload(
    { title, date, time: timeRaw },
    { allowPastDate: true }
  );
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }
  if (!time) {
    return res.status(400).json({ success: false, message: 'A valid meeting time is required (HH:MM)' });
  }

  try {
    const current = await query(
      'SELECT id, status FROM meetings WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (current[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled meetings cannot be edited',
      });
    }
    if (current[0].status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Closed meetings cannot be edited',
      });
    }
    if (!EDITABLE_STATUSES.has(current[0].status)) {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled or ongoing meetings can be edited',
      });
    }

    const params = [title, date, time];
    let notesSql = '';
    if (notes !== undefined) {
      notesSql = ', notes = ?';
      params.push(notes);
    }
    params.push(id);

    const result = await query(
      `UPDATE meetings
       SET title = ?,
           meeting_date = ?,
           meeting_time = ?${notesSql},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('scheduled', 'ongoing')`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({ success: true, message: 'Meeting updated successfully' });
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** POST /api/meetings/cancel — soft cancel only; meetings are never deleted */
router.post('/cancel', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Meeting id is required' });
  }

  const cancelledBy = Number(req.user?.id) || null;

  try {
    const current = await query(
      'SELECT id, title, status FROM meetings WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (current[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is already cancelled',
      });
    }
    if (current[0].status === 'ongoing') {
      return res.status(400).json({
        success: false,
        message: 'Ongoing meetings cannot be cancelled — close the meeting instead.',
      });
    }
    if (current[0].status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Closed meetings cannot be cancelled',
      });
    }
    if (current[0].status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled meetings can be cancelled',
      });
    }

    if (cancelledBy) {
      const staffRows = await query(
        'SELECT id FROM users WHERE id = ? AND status = 1 LIMIT 1',
        [cancelledBy]
      );
      if (!staffRows.length) {
        return res.status(400).json({ success: false, message: 'Invalid canceller account' });
      }
    }

    await query(
      `UPDATE meetings
       SET status = 'cancelled',
           cancelled_by = ?,
           cancelled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'scheduled'`,
      [cancelledBy, id]
    );

    res.json({
      success: true,
      message: `“${current[0].title}” cancelled. Attendance history is kept.`,
    });
  } catch (err) {
    console.error('Error cancelling meeting:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/meetings/close — end a scheduled or ongoing meeting */
router.post('/close', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Meeting id is required' });
  }

  try {
    const current = await query(
      'SELECT id, title, status FROM meetings WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (current[0].status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Meeting is already closed',
      });
    }
    if (current[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled meetings cannot be closed',
      });
    }
    if (current[0].status !== 'scheduled' && current[0].status !== 'ongoing') {
      return res.status(400).json({
        success: false,
        message: 'Only scheduled or ongoing meetings can be closed',
      });
    }

    const result = await query(
      `UPDATE meetings
       SET status = 'closed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('scheduled', 'ongoing')`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({
      success: true,
      message: `“${current[0].title}” closed. Attendance can no longer be marked.`,
    });
  } catch (err) {
    console.error('Error closing meeting:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/meetings/reopen — reopen a closed meeting as ongoing */
router.post('/reopen', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Meeting id is required' });
  }

  try {
    const current = await query(
      'SELECT id, title, status FROM meetings WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }
    if (current[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled meetings cannot be reopened',
      });
    }
    if (current[0].status !== 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Only closed meetings can be reopened',
      });
    }

    const result = await query(
      `UPDATE meetings
       SET status = 'ongoing',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'closed'`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    res.json({
      success: true,
      message: `“${current[0].title}” reopened as Ongoing. Attendance can be marked again.`,
      data: { id, status: 'ongoing' },
    });
  } catch (err) {
    console.error('Error reopening meeting:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
