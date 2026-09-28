const { query } = require('../db');

const getUserPermissions = async (_userId, roleId) => {
  const permissionsQuery = `
    SELECT DISTINCT
      p.permission_id,
      p.name,
      p.description,
      p.resource,
      p.action,
      p.resource_id
    FROM system_permissions p
    INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
    WHERE rp.role_id = ? AND p.is_active = 1
    ORDER BY p.name
  `;

  const permissions = await query(permissionsQuery, [roleId]);

  const permissionMap = {
    menu_items: [],
    api_endpoints: [],
    features: [],
    all: permissions.map((p) => p.name),
  };

  permissions.forEach((permission) => {
    if (permission.resource === 'menu_item') {
      permissionMap.menu_items.push(permission.resource_id);
    } else if (permission.resource === 'api_endpoint') {
      permissionMap.api_endpoints.push(permission.resource_id);
    } else if (permission.resource === 'feature') {
      permissionMap.features.push(permission.name);
    }
  });

  return permissionMap;
};

const getUserMenuItems = async (_userId, roleId) => {
  const menuQuery = `
    SELECT DISTINCT
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
      mg.icon AS group_icon,
      mg.sort_order AS group_sort_order
    FROM menu_items mi
    INNER JOIN menu_groups mg ON mi.group_name = mg.group_name
    INNER JOIN system_permissions p ON p.resource = 'menu_item' AND p.resource_id = mi.id
    INNER JOIN role_permissions rp ON p.permission_id = rp.permission_id
    WHERE rp.role_id = ?
      AND mi.is_active = 1
      AND mg.is_active = 1
      AND p.is_active = 1
    ORDER BY mg.sort_order, mi.sort_order, mi.label
  `;

  return query(menuQuery, [roleId]);
};

const isSuperAdmin = (user) => {
  if (!user) return false;
  const role = String(user.role ?? '').toLowerCase();
  const roleName = String(user.roleName || user.role_name || '').toLowerCase();
  return (
    role === '1' ||
    role === 'super_admin' ||
    roleName === 'administrator' ||
    roleName === 'super_admin'
  );
};

module.exports = {
  getUserPermissions,
  getUserMenuItems,
  isSuperAdmin,
};
