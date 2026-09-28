const express = require('express');
const bcrypt = require('bcryptjs');
const authenticateToken = require('../middleware/auth');
const { query } = require('../db');
const { createAttendanceForMemberUpcoming } = require('../utils/attendanceRows');

const router = express.Router();

const MEMBER_ID_RE = /^\d{10}$/;
const PHONE_RE = /^\d{10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapMemberRow = (row) => ({
  id: row.id,
  memberId: row.member_id,
  fullName: row.full_name,
  phone: row.phone || '',
  email: row.email || '',
  notes: row.notes || '',
  status: Number(row.status) === 1 ? 'active' : 'inactive',
  fresh: Number(row.fresh),
  joinedAt: row.joined_at || null,
  createdById: row.created_by ?? null,
  createdBy: (row.created_by_name || '').trim(),
  lastActivity: row.last_activity,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const MEMBER_SELECT = `
  SELECT
    m.id,
    m.member_id,
    m.full_name,
    m.phone,
    m.email,
    m.notes,
    m.fresh,
    m.status,
    DATE_FORMAT(m.joined_at, '%Y-%m-%d') AS joined_at,
    m.created_by,
    m.last_activity,
    m.created_at,
    m.updated_at,
    TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS created_by_name
  FROM members m
  LEFT JOIN users u ON m.created_by = u.id
`;

function normalizeMemberId(value) {
  return String(value || '').trim();
}

function normalizePhone(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  const email = String(value || '').trim();
  return email ? email.toLowerCase() : null;
}

function validateMemberPayload({ memberId, fullName, phone, email }, { requireMemberId = true } = {}) {
  if (requireMemberId && !MEMBER_ID_RE.test(memberId)) {
    return 'Member ID must be exactly 10 digits';
  }
  if (!fullName?.trim()) {
    return 'Full name is required';
  }
  if (!PHONE_RE.test(phone)) {
    return 'Phone number must be exactly 10 digits';
  }
  if (email && !EMAIL_RE.test(email)) {
    return 'Enter a valid email or leave blank';
  }
  return null;
}

/** GET /api/members */
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const rows = await query(
      `${MEMBER_SELECT}
       ORDER BY m.full_name ASC, m.member_id ASC`
    );
    res.json({ success: true, data: rows.map(mapMemberRow) });
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** GET /api/members/:id */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid member id' });
    }

    const rows = await query(`${MEMBER_SELECT} WHERE m.id = ? LIMIT 1`, [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, data: mapMemberRow(rows[0]) });
  } catch (err) {
    console.error('Error fetching member:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/members/create */
router.post('/create', authenticateToken, async (req, res) => {
  const memberId = normalizeMemberId(req.body?.memberId ?? req.body?.member_id);
  const fullName = String(req.body?.fullName ?? req.body?.full_name ?? '').trim();
  const phone = normalizePhone(req.body?.phone);
  const email = normalizeEmail(req.body?.email);
  const notes = String(req.body?.notes || '').trim() || null;
  const joinedAtRaw = req.body?.joinedAt ?? req.body?.joined_at;
  const joinedAt =
    joinedAtRaw && String(joinedAtRaw).trim()
      ? String(joinedAtRaw).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const validationError = validateMemberPayload(
    { memberId, fullName, phone, email },
    { requireMemberId: true }
  );
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) {
    return res.status(400).json({ success: false, message: 'Invalid join date' });
  }

  const createdBy = Number(req.user?.id) || null;

  try {
    // App-level check: creator must be a real staff user (no FK)
    if (createdBy) {
      const staffRows = await query(
        'SELECT id FROM users WHERE id = ? AND status = 1 LIMIT 1',
        [createdBy]
      );
      if (!staffRows.length) {
        return res.status(400).json({
          success: false,
          message: 'Invalid creator account',
        });
      }
    }

    const existing = await query(
      'SELECT id FROM members WHERE member_id = ? LIMIT 1',
      [memberId]
    );
    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: 'This Member ID is already registered',
      });
    }

    // Default password = Member ID (same idea as school student portal)
    const hashedPassword = await bcrypt.hash(memberId, 10);

    const result = await query(
      `INSERT INTO members (
         member_id, full_name, phone, email, notes,
         password_hash, fresh, status, joined_at, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      [memberId, fullName, phone, email, notes, hashedPassword, joinedAt, createdBy]
    );

    const newId = result.insertId;
    const { inserted } = await createAttendanceForMemberUpcoming(newId);

    res.json({
      success: true,
      message:
        inserted > 0
          ? `Member registered successfully. Temporary password is the Member ID. Added to ${inserted} upcoming meeting(s).`
          : 'Member registered successfully. Temporary password is the Member ID; they must change it on first login.',
      data: { id: newId, memberId, upcomingAttendanceRows: inserted },
    });
  } catch (error) {
    console.error('Error creating member:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'This Member ID is already registered',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** POST /api/members/update — Member ID cannot be changed after registration */
router.post('/update', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  const memberIdAttempt = normalizeMemberId(req.body?.memberId ?? req.body?.member_id);
  const fullName = String(req.body?.fullName ?? req.body?.full_name ?? '').trim();
  const phone = normalizePhone(req.body?.phone);
  const email = normalizeEmail(req.body?.email);
  const notes = String(req.body?.notes || '').trim() || null;

  if (!id) {
    return res.status(400).json({ success: false, message: 'Member id is required' });
  }

  const validationError = validateMemberPayload(
    { memberId: '0000000000', fullName, phone, email },
    { requireMemberId: false }
  );
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  try {
    const current = await query(
      'SELECT id, member_id FROM members WHERE id = ? LIMIT 1',
      [id]
    );
    if (!current.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (memberIdAttempt && memberIdAttempt !== current[0].member_id) {
      return res.status(400).json({
        success: false,
        message: 'Member ID cannot be edited',
      });
    }

    const result = await query(
      `UPDATE members
       SET full_name = ?,
           phone = ?,
           email = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fullName, phone, email, notes, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    res.json({ success: true, message: 'Member updated successfully' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** POST /api/members/activate */
router.post('/activate', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Member ID is required' });
  }

  try {
    const existing = await query('SELECT id FROM members WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await query(
      'UPDATE members SET status = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    const { inserted } = await createAttendanceForMemberUpcoming(id);

    res.json({
      success: true,
      message:
        inserted > 0
          ? `Member reactivated successfully. Added to ${inserted} upcoming meeting(s).`
          : 'Member reactivated successfully. They will be included in newly created meetings.',
      data: { upcomingAttendanceRows: inserted },
    });
  } catch (err) {
    console.error('Error activating member:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/members/deactivate — soft deactivate only; members are never deleted */
router.post('/deactivate', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Member ID is required' });
  }

  try {
    const existing = await query('SELECT id FROM members WHERE id = ? LIMIT 1', [id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await query(
      'UPDATE members SET status = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    res.json({
      success: true,
      message:
        'Member deactivated. Past history is kept; they cannot log in and get no new meeting rows.',
    });
  } catch (err) {
    console.error('Error deactivating member:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/members/reset-password — resets to Member ID (school student pattern) */
router.post('/reset-password', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  const memberIdBody = normalizeMemberId(req.body?.memberId ?? req.body?.member_id);

  if (!id) {
    return res.status(400).json({ success: false, message: 'Member ID is required' });
  }

  try {
    const rows = await query(
      'SELECT id, member_id FROM members WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const memberId = rows[0].member_id;
    if (memberIdBody && memberIdBody !== memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID does not match this record',
      });
    }

    const hashedPassword = await bcrypt.hash(memberId, 10);
    await query(
      `UPDATE members
       SET password_hash = ?, fresh = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [hashedPassword, id]
    );

    res.json({
      success: true,
      message:
        'Password reset successfully. Temporary password is the Member ID; they must change it on next login.',
    });
  } catch (error) {
    console.error('Error resetting member password:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
