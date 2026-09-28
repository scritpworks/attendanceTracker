const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { writeLoginLog, getRequestMeta } = require('../utils/loginLogWriter');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { ipAddress, userAgent } = getRequestMeta(req);
  const { email, password } = req.body || {};
  const loginUsername = String(email || '').trim().toLowerCase();

  if (!loginUsername || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required',
    });
  }

  try {
    const results = await query(
      `SELECT
         u.id, u.email, u.password_hash, u.first_name, u.last_name,
         u.role, u.status, u.department, u.fresh,
         sr.role_name
       FROM users u
       LEFT JOIN system_roles sr ON u.role = sr.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!results.length) {
      await writeLoginLog({
        username: loginUsername,
        status: 'failed',
        failureReason: 'invalid_username',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = results[0];

    if (Number(user.status) !== 1) {
      await writeLoginLog({
        username: loginUsername,
        status: 'failed',
        failureReason: 'account_not_activated',
        ipAddress,
        userAgent,
      });
      return res.status(403).json({
        success: false,
        message: 'Account is not activated',
      });
    }

    if (!user.password_hash) {
      await writeLoginLog({
        username: loginUsername,
        status: 'failed',
        failureReason: 'invalid_password',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await writeLoginLog({
        username: loginUsername,
        status: 'failed',
        failureReason: 'invalid_password',
        ipAddress,
        userAgent,
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await writeLoginLog({
      username: loginUsername,
      status: 'success',
      ipAddress,
      userAgent,
    });

    await query(
      `UPDATE users
       SET session_revoked_at = NULL,
           last_seen_at = NOW(),
           presence_status = 'online'
       WHERE id = ?`,
      [user.id]
    );

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        userType: 'staff',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        roleName: user.role_name || 'Staff',
        department: user.department,
        fresh: user.fresh,
        userType: 'staff',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    await writeLoginLog({
      username: loginUsername,
      status: 'failed',
      failureReason: 'server_error',
      ipAddress,
      userAgent,
    });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
