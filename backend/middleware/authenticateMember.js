const jwt = require('jsonwebtoken');
const { query } = require('../db');
require('dotenv').config();

/**
 * Verify JWT for member portal sessions (userType === 'member').
 * Sets req.user / req.member from the members table (identity from session only).
 */
const authenticateMember = (req, res, next) => {
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

    if (decoded.userType !== 'member') {
      return res.status(403).json({
        success: false,
        error: 'Member access required',
        code: 'NOT_MEMBER',
      });
    }

    try {
      const rows = await query(
        `SELECT id, member_id, full_name, phone, email, status, fresh
         FROM members
         WHERE id = ?
         LIMIT 1`,
        [decoded.id]
      );

      if (!rows.length) {
        return res.status(401).json({
          success: false,
          error: 'Member not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const dbMember = rows[0];
      if (Number(dbMember.status) !== 1) {
        return res.status(403).json({
          success: false,
          error: 'Account is not activated',
          code: 'ACCOUNT_DEACTIVATED',
        });
      }

      void query(
        `UPDATE members SET last_activity = CURRENT_TIMESTAMP WHERE id = ?`,
        [dbMember.id]
      ).catch(() => {});

      req.user = {
        id: dbMember.id,
        memberId: dbMember.member_id,
        fullName: dbMember.full_name,
        email: dbMember.email || null,
        phone: dbMember.phone || '',
        fresh: dbMember.fresh,
        userType: 'member',
        type: 'member',
      };
      req.member = req.user;
      next();
    } catch (error) {
      console.error('Member auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  });
};

module.exports = authenticateMember;
