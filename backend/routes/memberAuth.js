const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { writeLoginLog, getRequestMeta } = require('../utils/loginLogWriter');

const router = express.Router();

const MEMBER_ID_RE = /^\d{10}$/;

/**
 * Member portal login (school student-style).
 * POST /api/member/login
 * body: { memberId, password }
 */
router.post('/login', async (req, res) => {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const memberId = String(req.body?.memberId ?? req.body?.member_id ?? '').trim();
  const password = req.body?.password;

  if (!MEMBER_ID_RE.test(memberId) || !password) {
    return res.status(400).json({
      success: false,
      message: 'Member ID (10 digits) and password are required',
    });
  }

  try {
    const results = await query(
      `SELECT
         id,
         member_id,
         full_name,
         phone,
         email,
         password_hash,
         fresh,
         status
       FROM members
       WHERE member_id = ?
       LIMIT 1`,
      [memberId]
    );

    if (!results.length) {
      await writeLoginLog({
        username: memberId,
        status: 'failed',
        failureReason: 'invalid_username',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const member = results[0];

    if (Number(member.status) !== 1) {
      await writeLoginLog({
        username: memberId,
        status: 'failed',
        failureReason: 'account_not_activated',
        ipAddress,
        userAgent,
      });
      return res.status(403).json({
        success: false,
        message: 'Account is not activated. Contact an administrator.',
      });
    }

    if (!member.password_hash) {
      await writeLoginLog({
        username: memberId,
        status: 'failed',
        failureReason: 'invalid_password',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(String(password), member.password_hash);
    if (!validPassword) {
      await writeLoginLog({
        username: memberId,
        status: 'failed',
        failureReason: 'invalid_password',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await writeLoginLog({
      username: memberId,
      status: 'success',
      ipAddress,
      userAgent,
    });

    // Touch last_activity (best-effort)
    void query(
      `UPDATE members SET last_activity = CURRENT_TIMESTAMP WHERE id = ?`,
      [member.id]
    ).catch(() => {});

    const token = jwt.sign(
      {
        id: member.id,
        memberId: member.member_id,
        userType: 'member',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: member.id,
        memberId: member.member_id,
        fullName: member.full_name,
        phone: member.phone || '',
        email: member.email || null,
        fresh: member.fresh,
        type: 'member',
        userType: 'member',
      },
    });
  } catch (error) {
    console.error('Member login error:', error);
    await writeLoginLog({
      username: memberId,
      status: 'failed',
      failureReason: 'server_error',
      ipAddress,
      userAgent,
    });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * First-login / forced password change (school student pattern).
 * POST /api/member/profile/password
 * body: { memberId, new_password }
 */
router.post('/profile/password', async (req, res) => {
  const memberId = String(req.body?.memberId ?? req.body?.member_id ?? '').trim();
  const newPassword = req.body?.new_password ?? req.body?.newPassword;

  if (!MEMBER_ID_RE.test(memberId) || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Member ID and new password are required',
    });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
    });
  }

  // Do not allow keeping the Member ID as the password after first change
  if (String(newPassword) === memberId) {
    return res.status(400).json({
      success: false,
      message: 'Choose a password different from your Member ID',
    });
  }

  try {
    const existing = await query(
      'SELECT id, status FROM members WHERE member_id = ? LIMIT 1',
      [memberId]
    );
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    if (Number(existing[0].status) !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Account is not activated',
      });
    }

    const hashedPassword = await bcrypt.hash(String(newPassword), 10);
    await query(
      `UPDATE members
       SET password_hash = ?,
           fresh = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE member_id = ?`,
      [hashedPassword, memberId]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating member password:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password',
    });
  }
});

/**
 * Check fresh status
 * GET /api/member/fresh?memberId=
 */
router.get('/fresh', async (req, res) => {
  const memberId = String(req.query.memberId || req.query.member_id || '').trim();
  if (!MEMBER_ID_RE.test(memberId)) {
    return res.status(400).json({
      success: false,
      message: 'A valid 10-digit Member ID is required',
    });
  }

  try {
    const results = await query(
      'SELECT fresh, status FROM members WHERE member_id = ? LIMIT 1',
      [memberId]
    );
    if (!results.length) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }
    res.json({
      success: true,
      fresh: results[0].fresh,
      status: Number(results[0].status) === 1 ? 'active' : 'inactive',
    });
  } catch (err) {
    console.error('Error checking member fresh status:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
