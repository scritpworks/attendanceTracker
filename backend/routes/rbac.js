const express = require('express');
const authenticateToken = require('../middleware/auth');
const { getUserMenuItems, isSuperAdmin } = require('../middleware/rbac');
const { query, executeTransaction, executeQuery } = require('../db');

const router = express.Router();

const MENU_GROUP_ORDER = {
  dashboard: 1,
  members: 2,
  meetings: 3,
  attendance: 4,
  reports: 5,
  settings: 6,
};

router.get('/user-menu', authenticateToken, async (req, res) => {
  try {
    let menuItems;

    if (isSuperAdmin(req.user)) {
      menuItems = await query(
        `SELECT
           mi.id,
           mi.label,
           mi.path,
           mi.icon,
           mi.group_name,
           mi.parent_id,
           mi.sort_order,
           mi.is_modal,
           mi.description,
           mg.display_name AS group_display_name,
           mg.icon AS group_icon
         FROM menu_items mi
         INNER JOIN menu_groups mg ON mi.group_name = mg.group_name
         WHERE mi.is_active = 1 AND mg.is_active = 1
         ORDER BY mg.sort_order, mi.sort_order, mi.label`
      );
    } else {
      menuItems = await getUserMenuItems(req.user.id, req.user.role);
    }

    const groups = {};
    menuItems.forEach((item) => {
      if (!groups[item.group_name]) {
        groups[item.group_name] = {
          id: item.group_name,
          title: item.group_display_name,
          icon: item.group_icon,
          items: [],
        };
      }

      groups[item.group_name].items.push({
        id: item.id,
        label: item.label,
        path: item.path,
        icon: item.icon,
        isModal: !!item.is_modal,
        description: item.description,
      });
    });

    const menuGroups = Object.values(groups).sort(
      (a, b) => (MENU_GROUP_ORDER[a.id] || 99) - (MENU_GROUP_ORDER[b.id] || 99)
    );

    res.json({
      success: true,
      menuGroups,
      totalItems: menuItems.length,
    });
  } catch (error) {
    console.error('Error fetching user menu:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user menu',
    });
  }
});

router.get('/menu-items', authenticateToken, async (_req, res) => {
  try {
    const menuItems = await query(
      `SELECT
         mi.*,
         mg.display_name AS group_display_name,
         mg.icon AS group_icon
       FROM menu_items mi
       LEFT JOIN menu_groups mg ON mi.group_name = mg.group_name
       ORDER BY mg.sort_order, mi.sort_order, mi.label`
    );
    res.json({ success: true, menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch menu items' });
  }
});

router.get('/menu-groups', authenticateToken, async (_req, res) => {
  try {
    const groups = await query(
      `SELECT * FROM menu_groups ORDER BY sort_order, display_name`
    );
    res.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching menu groups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch menu groups' });
  }
});

/** All system permissions (for admin UI) */
router.get('/permissions', authenticateToken, async (_req, res) => {
  try {
    const permissions = await query(
      `SELECT permission_id, name, description, resource, action, resource_id, is_active
       FROM system_permissions
       WHERE is_active = 1
       ORDER BY resource, name`
    );
    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch permissions' });
  }
});

/**
 * Menu tree with granted flags for a role — useful for permissions UI.
 * GET /api/rbac/role-menu-matrix/:roleId
 */
router.get('/role-menu-matrix/:roleId', authenticateToken, async (req, res) => {
  try {
    const roleId = Number(req.params.roleId);
    if (!roleId) {
      return res.status(400).json({ success: false, message: 'Invalid role id' });
    }

    const rows = await query(
      `SELECT
         mi.id AS menu_item_id,
         mi.label,
         mi.path,
         mi.icon,
         mi.group_name,
         mi.sort_order,
         mg.display_name AS group_display_name,
         mg.icon AS group_icon,
         mg.sort_order AS group_sort_order,
         CASE WHEN rp.role_id IS NULL THEN 0 ELSE 1 END AS granted,
         p.permission_id
       FROM menu_items mi
       INNER JOIN menu_groups mg ON mi.group_name = mg.group_name
       LEFT JOIN system_permissions p
         ON p.resource = 'menu_item' AND p.resource_id = mi.id AND p.is_active = 1
       LEFT JOIN role_permissions rp
         ON rp.permission_id = p.permission_id AND rp.role_id = ?
       WHERE mi.is_active = 1 AND mg.is_active = 1
       ORDER BY mg.sort_order, mi.sort_order, mi.label`,
      [roleId]
    );

    const groups = {};
    rows.forEach((row) => {
      if (!groups[row.group_name]) {
        groups[row.group_name] = {
          id: row.group_name,
          title: row.group_display_name,
          icon: row.group_icon,
          sortOrder: row.group_sort_order,
          items: [],
        };
      }
      groups[row.group_name].items.push({
        menuItemId: row.menu_item_id,
        label: row.label,
        path: row.path,
        icon: row.icon,
        granted: Number(row.granted) === 1,
        permissionId: row.permission_id,
      });
    });

    const menuGroups = Object.values(groups).sort(
      (a, b) => (a.sortOrder || 99) - (b.sortOrder || 99)
    );

    res.json({ success: true, roleId, menuGroups });
  } catch (error) {
    console.error('Error fetching role menu matrix:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch role menu matrix' });
  }
});

/** Assign one menu permission to a role */
router.post('/assign-menu-permission', authenticateToken, async (req, res) => {
  const { roleId, menuItemId, permissionName } = req.body || {};

  if (!roleId || !menuItemId) {
    return res.status(400).json({
      success: false,
      message: 'roleId and menuItemId are required',
    });
  }

  try {
    await executeTransaction(async (connection) => {
      await executeQuery(
        connection,
        `INSERT IGNORE INTO system_permissions (name, description, resource, action, resource_id)
         VALUES (?, ?, 'menu_item', 'view', ?)`,
        [
          permissionName || `menu_item_${menuItemId}`,
          `Access to menu item ID ${menuItemId}`,
          menuItemId,
        ]
      );

      const permissions = await executeQuery(
        connection,
        `SELECT permission_id FROM system_permissions
         WHERE resource = 'menu_item' AND resource_id = ?
         LIMIT 1`,
        [menuItemId]
      );

      if (!permissions.length) {
        throw new Error('Failed to create or find permission');
      }

      await executeQuery(
        connection,
        `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleId, permissions[0].permission_id]
      );
    });

    res.json({ success: true, message: 'Menu permission assigned successfully' });
  } catch (error) {
    console.error('Error assigning menu permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign menu permission',
    });
  }
});

/** Remove one menu permission from a role */
router.delete('/remove-menu-permission', authenticateToken, async (req, res) => {
  const { roleId, menuItemId } = req.body || {};

  if (!roleId || !menuItemId) {
    return res.status(400).json({
      success: false,
      message: 'roleId and menuItemId are required',
    });
  }

  try {
    await executeTransaction(async (connection) => {
      await executeQuery(connection, 'SET SESSION innodb_lock_wait_timeout = 5');
      await executeQuery(
        connection,
        `DELETE rp FROM role_permissions rp
         INNER JOIN system_permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = ? AND p.resource = 'menu_item' AND p.resource_id = ?`,
        [roleId, menuItemId]
      );
    });

    res.json({ success: true, message: 'Menu permission removed successfully' });
  } catch (error) {
    console.error('Error removing menu permission:', error);
    if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return res.status(409).json({
        success: false,
        message: 'Operation timed out due to concurrent access. Please try again.',
        code: 'LOCK_TIMEOUT',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to remove menu permission',
    });
  }
});

/** List menu permissions currently granted to a role */
router.get('/role-menu-permissions/:roleId', authenticateToken, async (req, res) => {
  const roleId = Number(req.params.roleId);
  if (!roleId) {
    return res.status(400).json({ success: false, message: 'Invalid role id' });
  }

  try {
    const permissions = await query(
      `SELECT
         mi.id AS menu_item_id,
         mi.label,
         mi.path,
         mi.group_name,
         p.permission_id,
         p.name AS permission_name
       FROM menu_items mi
       INNER JOIN system_permissions p ON p.resource = 'menu_item' AND p.resource_id = mi.id
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE rp.role_id = ? AND mi.is_active = 1
       ORDER BY mi.group_name, mi.sort_order, mi.label`,
      [roleId]
    );

    res.json({ success: true, permissions });
  } catch (error) {
    console.error('Error fetching role menu permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch role menu permissions',
    });
  }
});

/**
 * Replace all menu permissions for a role.
 * body: { roleId, menuItemIds: number[] }
 */
router.post('/bulk-assign-menu-permissions', authenticateToken, async (req, res) => {
  const roleId = Number(req.body?.roleId);
  const menuItemIds = Array.isArray(req.body?.menuItemIds)
    ? req.body.menuItemIds.map(Number).filter((n) => Number.isFinite(n) && n > 0)
    : null;

  if (!roleId) {
    return res.status(400).json({ success: false, message: 'roleId is required' });
  }
  if (!menuItemIds) {
    return res.status(400).json({
      success: false,
      message: 'menuItemIds array is required',
    });
  }

  try {
    const roleRows = await query(
      'SELECT role_id FROM system_roles WHERE role_id = ? LIMIT 1',
      [roleId]
    );
    if (!roleRows.length) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    await executeTransaction(async (connection) => {
      await executeQuery(connection, 'SET SESSION innodb_lock_wait_timeout = 10');

      await executeQuery(
        connection,
        `DELETE rp FROM role_permissions rp
         INNER JOIN system_permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = ? AND p.resource = 'menu_item'`,
        [roleId]
      );

      for (const menuItemId of menuItemIds) {
        await executeQuery(
          connection,
          `INSERT IGNORE INTO system_permissions (name, description, resource, action, resource_id)
           VALUES (?, ?, 'menu_item', 'view', ?)`,
          [`menu_item_${menuItemId}`, `Access to menu item ID ${menuItemId}`, menuItemId]
        );

        const permissions = await executeQuery(
          connection,
          `SELECT permission_id FROM system_permissions
           WHERE resource = 'menu_item' AND resource_id = ?
           LIMIT 1`,
          [menuItemId]
        );

        if (permissions.length) {
          await executeQuery(
            connection,
            `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
            [roleId, permissions[0].permission_id]
          );
        }
      }
    });

    res.json({
      success: true,
      message: 'Menu permissions assigned successfully',
      count: menuItemIds.length,
    });
  } catch (error) {
    console.error('Error bulk assigning menu permissions:', error);
    if (error.code === 'ER_LOCK_WAIT_TIMEOUT') {
      return res.status(409).json({
        success: false,
        message: 'Operation timed out due to concurrent access. Please try again.',
        code: 'LOCK_TIMEOUT',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to assign menu permissions',
    });
  }
});

router.post('/check-access', authenticateToken, async (req, res) => {
  const { path } = req.body || {};

  try {
    if (isSuperAdmin(req.user)) {
      return res.json({ success: true, hasAccess: true });
    }

    const access = await query(
      `SELECT mi.id
       FROM menu_items mi
       INNER JOIN system_permissions p ON p.resource = 'menu_item' AND p.resource_id = mi.id
       INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
       WHERE mi.path = ? AND rp.role_id = ? AND mi.is_active = 1`,
      [path, req.user.role]
    );

    res.json({
      success: true,
      hasAccess: access.length > 0,
    });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check access',
    });
  }
});

module.exports = router;
