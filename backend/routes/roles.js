const express = require('express');
const authenticateToken = require('../middleware/auth');
const { query, executeTransaction, executeQuery } = require('../db');

const router = express.Router();

/** GET /api/roles — list all roles */
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const roles = await query(
      `SELECT
         sr.role_id,
         sr.role_name,
         sr.description,
         sr.created_at,
         sr.updated_at,
         (SELECT COUNT(*) FROM users u WHERE u.role = sr.role_id) AS user_count,
         (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = sr.role_id) AS permission_count
       FROM system_roles sr
       ORDER BY sr.role_name`
    );
    res.json({ success: true, roles });
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** GET /api/roles/:roleId — single role */
router.get('/:roleId', authenticateToken, async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'Invalid role id' });
    }

    const rows = await query(
      `SELECT role_id, role_name, description, created_at, updated_at
       FROM system_roles WHERE role_id = ? LIMIT 1`,
      [roleId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, role: rows[0] });
  } catch (err) {
    console.error('Error fetching role:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/roles/add */
router.post('/add', authenticateToken, async (req, res) => {
  try {
    const { role_name, description } = req.body || {};
    if (!role_name || !String(role_name).trim()) {
      return res.status(400).json({ success: false, message: 'role_name is required' });
    }

    const result = await query(
      'INSERT INTO system_roles (role_name, description) VALUES (?, ?)',
      [String(role_name).trim(), description || null]
    );

    res.json({
      success: true,
      message: 'Role added successfully',
      id: result.insertId,
      role_id: result.insertId,
    });
  } catch (err) {
    console.error('Error adding role:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Role name already exists' });
    }
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/roles/update */
router.post('/update', authenticateToken, async (req, res) => {
  try {
    const { role_id, role_name, description } = req.body || {};
    if (!role_id || !role_name || !String(role_name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'role_id and role_name are required',
      });
    }

    const result = await query(
      'UPDATE system_roles SET role_name = ?, description = ? WHERE role_id = ?',
      [String(role_name).trim(), description || null, role_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    res.json({ success: true, message: 'Role updated successfully' });
  } catch (err) {
    console.error('Error updating role:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Role name already exists' });
    }
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/** POST /api/roles/delete — body: { id } */
router.post('/delete', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.body?.id ?? req.body?.role_id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Role id is required' });
    }

    if (id === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the Administrator role',
      });
    }

    const usage = await query(
      'SELECT COUNT(*) AS userCount FROM users WHERE role = ?',
      [id]
    );
    const userCount = Number(usage[0]?.userCount || 0);

    if (userCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role is currently in use',
        inUse: true,
        userCount,
      });
    }

    await executeTransaction(async (connection) => {
      await executeQuery(
        connection,
        'DELETE FROM role_permissions WHERE role_id = ?',
        [id]
      );
      const result = await executeQuery(
        connection,
        'DELETE FROM system_roles WHERE role_id = ?',
        [id]
      );
      if (result.affectedRows === 0) {
        const err = new Error('Role not found');
        err.status = 404;
        throw err;
      }
    });

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (err) {
    console.error('Error deleting role:', err);
    if (err.status === 404) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * GET /api/roles/:roleId/permissions
 * All system permissions with granted flag for this role.
 */
router.get('/:roleId/permissions', authenticateToken, async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'Invalid role id' });
    }

    const roleRows = await query(
      'SELECT role_id, role_name FROM system_roles WHERE role_id = ? LIMIT 1',
      [roleId]
    );
    if (!roleRows.length) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    const permissions = await query(
      `SELECT
         p.permission_id,
         p.name,
         p.description,
         p.resource,
         p.action,
         p.resource_id,
         p.is_active,
         CASE WHEN rp.role_id IS NULL THEN 0 ELSE 1 END AS granted
       FROM system_permissions p
       LEFT JOIN role_permissions rp
         ON rp.permission_id = p.permission_id AND rp.role_id = ?
       WHERE p.is_active = 1
       ORDER BY p.resource, p.name`,
      [roleId]
    );

    res.json({
      success: true,
      role: roleRows[0],
      permissions,
    });
  } catch (err) {
    console.error('Error fetching role permissions:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

/**
 * PUT /api/roles/:roleId/permissions
 * body: { permissionIds: number[] } — replaces all role_permissions for the role
 */
router.put('/:roleId/permissions', authenticateToken, async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    const permissionIds = Array.isArray(req.body?.permissionIds)
      ? req.body.permissionIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : null;

    if (!roleId) {
      return res.status(400).json({ success: false, message: 'Invalid role id' });
    }
    if (!permissionIds) {
      return res.status(400).json({
        success: false,
        message: 'permissionIds array is required',
      });
    }

    const roleRows = await query(
      'SELECT role_id FROM system_roles WHERE role_id = ? LIMIT 1',
      [roleId]
    );
    if (!roleRows.length) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await executeTransaction(async (connection) => {
      await executeQuery(connection, 'DELETE FROM role_permissions WHERE role_id = ?', [
        roleId,
      ]);

      for (const permissionId of permissionIds) {
        await executeQuery(
          connection,
          'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permissionId]
        );
      }
    });

    res.json({
      success: true,
      message: 'Role permissions updated successfully',
      count: permissionIds.length,
    });
  } catch (err) {
    console.error('Error updating role permissions:', err);
    res.status(500).json({ success: false, message: 'Database error' });
  }
});

module.exports = router;
