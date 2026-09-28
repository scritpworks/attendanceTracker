-- Add Attendance History menu item (idempotent)
USE attendance_tracker;

INSERT INTO menu_items (label, path, icon, group_name, sort_order, is_modal, description, is_active)
SELECT 'History', '/side/attendance-history', 'fas fa-history', 'attendance', 2, 0,
       'Browse attendance history by date', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items WHERE path = '/side/attendance-history'
);

INSERT INTO system_permissions (name, description, resource, action, resource_id, is_active)
SELECT
  CONCAT('menu_item_', mi.id),
  CONCAT('Access to menu item: ', mi.label),
  'menu_item',
  'view',
  mi.id,
  1
FROM menu_items mi
WHERE mi.path = '/side/attendance-history'
  AND NOT EXISTS (
    SELECT 1 FROM system_permissions sp
    WHERE sp.resource = 'menu_item' AND sp.resource_id = mi.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, sp.permission_id
FROM system_permissions sp
INNER JOIN menu_items mi ON sp.resource_id = mi.id AND sp.resource = 'menu_item'
WHERE mi.path = '/side/attendance-history'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 1 AND rp.permission_id = sp.permission_id
  );
