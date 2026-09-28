const express = require('express');
const bcrypt = require('bcryptjs');
const authenticateToken = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

/**
 * First-login / forced password change (same pattern as school system).
 * POST /api/user/profile/password
 * body: { email, new_password }
 */
router.post('/profile/password', async (req, res) => {
  const { email, new_password } = req.body || {};

  if (!email || !new_password) {
    return res.status(400).json({
      success: false,
      message: 'Email and new password are required',
    });
  }

  if (String(new_password).length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(String(new_password), 10);
    const results = await query(
      `UPDATE users
       SET password_hash = ?,
           fresh = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE email = ?`,
      [hashedPassword, String(email).trim().toLowerCase()]
    );

    if (results.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password',
    });
  }
});

/**
 * Check fresh status
 * GET /api/user/fresh?email=
 */
router.get('/fresh', authenticateToken, async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const results = await query('SELECT fresh FROM users WHERE email = ? LIMIT 1', [email]);
    if (!results.length) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, fresh: results[0].fresh });
  } catch (err) {
    console.error('Error checking fresh status:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
