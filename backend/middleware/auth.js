const jwt = require('jsonwebtoken');
const { query } = require('../db');
require('dotenv').config();

/**
 * Verify JWT and confirm the staff user is still active / not revoked.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied',
      code: 'NO_TOKEN',
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired, please log in again',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
    }

    try {
      if (decoded.userType === 'member') {
        return res.status(403).json({
          success: false,
          error: 'Staff access required',
          code: 'NOT_STAFF',
        });
      }

      const rows = await query(
        `SELECT id, email, role, status, session_revoked_at, first_name, last_name
         FROM users WHERE id = ? LIMIT 1`,
        [decoded.id]
      );

      if (!rows.length) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const dbUser = rows[0];
      if (Number(dbUser.status) !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Account is not activated',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      if (dbUser.session_revoked_at) {
        const revokedAt = new Date(dbUser.session_revoked_at).getTime();
        const iatMs = (decoded.iat || 0) * 1000;
        if (revokedAt > iatMs) {
          return res.status(401).json({
            success: false,
            error: 'Session revoked. Please log in again.',
            code: 'SESSION_REVOKED',
          });
        }
      }

      // Touch presence (best-effort)
      void query(
        `UPDATE users SET last_seen_at = NOW(), presence_status = 'online' WHERE id = ?`,
        [dbUser.id]
      ).catch(() => {});

      req.user = {
        ...decoded,
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
      };
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  });
};

module.exports = authenticateToken;
