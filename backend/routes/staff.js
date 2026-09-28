const express = require('express');
const bcrypt = require('bcryptjs');
const authenticateToken = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

const mapStaffRow = (row) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email,
  telephone: row.telephone,
  gender: row.gender,
  roleId: row.role_id,
  role: row.role_name,
  department: row.department,
  address: row.address,
  loginStatus: row.login_status,
  status: Number(row.status) === 1 ? 'active' : 'inactive',
  fresh: row.fresh,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** GET /api/staff */
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const rows = await query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.telephone,
         u.gender,
         u.role AS role_id,
         sr.role_name,
         u.department,
         u.address,
         u.login_status,
         u.status,
         u.fresh,
         u.created_at,
         u.updated_at
       FROM users u
       LEFT JOIN system_roles sr ON u.role = sr.role_id
       ORDER BY u.first_name ASC, u.last_name ASC`
    );

    res.json({ success: true, data: rows.map(mapStaffRow) });
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** GET /api/staff/:id */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid staff id' });
    }

    const rows = await query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.telephone, u.gender,
         u.role AS role_id, sr.role_name, u.department, u.address,
         u.login_status, u.status, u.fresh, u.created_at, u.updated_at
       FROM users u
       LEFT JOIN system_roles sr ON u.role = sr.role_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.json({ success: true, data: mapStaffRow(rows[0]) });
  } catch (err) {
    console.error('Error fetching staff member:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/staff/create */
router.post('/create', authenticateToken, async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    telephone,
    gender,
    role,
    loginStatus,
    status,
    address,
    department,
  } = req.body || {};

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !role) {
    return res.status(400).json({
      success: false,
      message: 'firstName, lastName, email, and role are required',
    });
  }

  try {
    const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [
      email.trim(),
    ]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const roleRows = await query(
      'SELECT role_id FROM system_roles WHERE role_id = ? LIMIT 1',
      [role]
    );
    if (!roleRows.length) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Default password = email (same pattern as school system)
    const hashedPassword = await bcrypt.hash(email.trim().toLowerCase(), 10);

    const result = await query(
      `INSERT INTO users (
         first_name, last_name, email, telephone, gender,
         role, login_status, status, address, department, password_hash, fresh, username
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        telephone || '',
        gender || '-',
        role,
        loginStatus || 'staff',
        status === 'inactive' ? 0 : 1,
        address || null,
        department || null,
        hashedPassword,
        email.trim().toLowerCase(),
      ]
    );

    res.json({
      success: true,
      message: 'Staff created successfully. Default password is the email address.',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** POST /api/staff/update */
router.post('/update', authenticateToken, async (req, res) => {
  const {
    id,
    first_name,
    last_name,
    firstName,
    lastName,
    email,
    telephone,
    gender,
    role,
    department,
    address,
    loginStatus,
  } = req.body || {};

  const staffId = Number(id);
  const fName = (first_name || firstName || '').trim();
  const lName = (last_name || lastName || '').trim();

  if (!staffId || !fName || !lName || !email?.trim() || !role) {
    return res.status(400).json({
      success: false,
      message: 'id, name, email, and role are required',
    });
  }

  try {
    const emailClash = await query(
      'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
      [email.trim().toLowerCase(), staffId]
    );
    if (emailClash.length) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use by another staff member',
      });
    }

    const result = await query(
      `UPDATE users
       SET first_name = ?,
           last_name = ?,
           email = ?,
           telephone = ?,
           gender = ?,
           role = ?,
           department = ?,
           address = ?,
           login_status = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        fName,
        lName,
        email.trim().toLowerCase(),
        telephone || '',
        gender || '-',
        role,
        department || null,
        address || null,
        loginStatus || 'staff',
        staffId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.json({ success: true, message: 'Staff updated successfully' });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
});

/** PUT /api/staff/delete */
router.put('/delete', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);

  if (!id) {
    return res.status(400).json({ success: false, message: 'Staff ID is required' });
  }

  if (Number(req.user?.id) === id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account',
    });
  }

  try {
    const result = await query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (err) {
    console.error('Error deleting staff:', err);
    res.status(500).json({ success: false, message: 'Database error while deleting staff' });
  }
});

/** POST /api/staff/activate */
router.post('/activate', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Staff ID is required' });
  }
  try {
    await query('UPDATE users SET status = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Account activated successfully' });
  } catch (err) {
    console.error('Error activating account:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/staff/deactivate */
router.post('/deactivate', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  if (!id) {
    return res.status(400).json({ success: false, message: 'Staff ID is required' });
  }
  if (Number(req.user?.id) === id) {
    return res.status(400).json({
      success: false,
      message: 'You cannot deactivate your own account',
    });
  }
  try {
    await query('UPDATE users SET status = 0 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Account deactivated successfully' });
  } catch (err) {
    console.error('Error deactivating account:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/staff/reset-password — resets to email as password */
router.post('/reset-password', authenticateToken, async (req, res) => {
  const id = Number(req.body?.id);
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!id || !email) {
    return res.status(400).json({
      success: false,
      message: 'Staff ID and email are required',
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(email, 10);
    const result = await query(
      'UPDATE users SET password_hash = ?, fresh = 1 WHERE id = ?',
      [hashedPassword, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.json({
      success: true,
      message: 'Password reset successfully. New password is the email address.',
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
