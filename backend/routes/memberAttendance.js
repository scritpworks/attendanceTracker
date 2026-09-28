const express = require('express');
const authenticateMember = require('../middleware/authenticateMember');
const { query } = require('../db');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatRecordedAt(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function normalizeMeetingStatus(status) {
  const s = String(status || '').trim().toLowerCase();
  if (['scheduled', 'ongoing', 'closed', 'cancelled'].includes(s)) return s;
  return 'scheduled';
}

/**
 * GET /api/member/attendance
 * Own attendance history only (identity from JWT).
 * Query: from, to (YYYY-MM-DD), search (meeting title), status=all|present|absent
 * Cancelled meetings are excluded. Summary uses held meetings only (date <= today).
 */
router.get('/attendance', authenticateMember, async (req, res) => {
  const memberRowId = Number(req.user?.id);
  const from = String(req.query.from || '').trim().slice(0, 10);
  const to = String(req.query.to || '').trim().slice(0, 10);
  const search = String(req.query.search || req.query.q || '').trim();
  const status = String(req.query.status || 'all').trim().toLowerCase();

  if (!memberRowId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
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
  if (!['all', 'present', 'absent'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status filter. Use all, present, or absent.',
    });
  }

  try {
    const where = [
      'a.member_id = ?',
      `mt.status <> 'cancelled'`,
    ];
    const params = [memberRowId];

    if (from) {
      where.push('mt.meeting_date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('mt.meeting_date <= ?');
      params.push(to);
    }
    if (status === 'present' || status === 'absent') {
      where.push('a.status = ?');
      params.push(status);
    }
    if (search) {
      where.push('mt.title LIKE ?');
      params.push(`%${search}%`);
    }

    const rows = await query(
      `SELECT
         a.id AS attendance_id,
         mt.id AS meeting_id,
         mt.title,
         DATE_FORMAT(mt.meeting_date, '%Y-%m-%d') AS meeting_date,
         TIME_FORMAT(mt.meeting_time, '%H:%i') AS meeting_time,
         mt.status AS meeting_status,
         a.status AS attendance_status,
         a.recorded_at
       FROM attendance a
       INNER JOIN meetings mt ON mt.id = a.meeting_id
       WHERE ${where.join(' AND ')}
       ORDER BY mt.meeting_date DESC, mt.meeting_time DESC, mt.id DESC
       LIMIT 2000`,
      params
    );

    const today = todayIso();
    const mapped = rows.map((r) => ({
      id: r.attendance_id,
      meetingId: r.meeting_id,
      title: r.title,
      date: r.meeting_date,
      time: r.meeting_time,
      meetingStatus: normalizeMeetingStatus(r.meeting_status),
      status: r.attendance_status === 'present' ? 'present' : 'absent',
      recordedAt: formatRecordedAt(r.recorded_at),
    }));

    // Held = date has arrived (PRD 5.9) — used for percentage totals
    const held = mapped.filter((r) => r.date <= today);
    const present = held.filter((r) => r.status === 'present').length;
    const total = held.length;

    res.json({
      success: true,
      data: {
        rows: mapped,
        held,
        summary: {
          total,
          present,
          absent: total - present,
          percentage: total === 0 ? 0 : Math.round((present / total) * 100),
        },
        filters: {
          from: from || null,
          to: to || null,
          search: search || null,
          status,
        },
      },
    });
  } catch (err) {
    console.error('Error fetching member attendance:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
