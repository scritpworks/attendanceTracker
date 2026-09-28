import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import { GET_USER_MENU, CHECK_ACCESS } from '../apiConfig';

const PermissionContext = createContext(null);

export const PermissionProvider = ({ children }) => {
  const { user, token, logout } = useAuth();
  const [permissions, setPermissions] = useState({
    menuGroups: [],
    menuItems: [],
    loading: true,
    error: null,
  });
  const [accessCache, setAccessCache] = useState(new Map());

  const fetchUserPermissions = useCallback(async () => {
    if (!token || !user) {
      setPermissions({
        menuGroups: [],
        menuItems: [],
        loading: false,
        error: null,
      });
      return;
    }

    // Members use a separate shell — no staff RBAC menu
    if (user.type === 'member') {
      setPermissions({
        menuGroups: [],
        menuItems: [],
        loading: false,
        error: null,
      });
      setAccessCache(new Map());
      return;
    }

    try {
      setPermissions((prev) => ({ ...prev, loading: true, error: null }));

      const response = await axios.get(GET_USER_MENU, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        const { menuGroups } = response.data;
        const allMenuItems = [];
        (menuGroups || []).forEach((group) => {
          (group.items || []).forEach((item) => {
            allMenuItems.push({
              ...item,
              groupId: group.id,
              groupTitle: group.title,
            });
          });
        });

        setPermissions({
          menuGroups: menuGroups || [],
          menuItems: allMenuItems,
          loading: false,
          error: null,
        });
        setAccessCache(new Map());
      } else {
        throw new Error(response.data.message || 'Failed to fetch permissions');
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      if (error.response?.status === 401) {
        logout();
      }
      setPermissions({
        menuGroups: [],
        menuItems: [],
        loading: false,
        error: error.response?.data?.message || error.message || 'Failed to load permissions',
      });
    }
  }, [token, user, logout]);

  useEffect(() => {
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const isSuperAdmin = useCallback(() => {
    if (!user) return false;
    const role = String(user.role ?? '').toLowerCase();
    const roleName = String(user.roleName || '').toLowerCase();
    return (
      role === '1' ||
      role === 'super_admin' ||
      roleName === 'administrator' ||
      roleName === 'super_admin'
    );
  }, [user]);

  const hasAccess = useCallback(
    (path) => {
      if (!path) return false;
      if (accessCache.has(path)) return accessCache.get(path);
      const hasPathAccess = permissions.menuItems.some((item) => item.path === path);
      setAccessCache((prev) => new Map(prev).set(path, hasPathAccess));
      return hasPathAccess;
    },
    [accessCache, permissions.menuItems]
  );

  const hasGroupAccess = useCallback(
    (groupId) => permissions.menuGroups.some((group) => group.id === groupId),
    [permissions.menuGroups]
  );

  const getGroupMenuItems = useCallback(
    (groupId) => {
      const group = permissions.menuGroups.find((g) => g.id === groupId);
      return group ? group.items : [];
    },
    [permissions.menuGroups]
  );

  const verifyAccess = useCallback(
    async (path) => {
      try {
        const response = await axios.post(
          CHECK_ACCESS,
          { path },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        return response.data.success && response.data.hasAccess;
      } catch (error) {
        console.error('Error verifying access:', error);
        return false;
      }
    },
    [token]
  );

  const refreshPermissions = useCallback(() => {
    setAccessCache(new Map());
    fetchUserPermissions();
  }, [fetchUserPermissions]);

  const getAccessibleMenuGroups = useCallback(
    () => permissions.menuGroups.filter((group) => (group.items || []).length > 0),
    [permissions.menuGroups]
  );

  const hasAnyAccess = useCallback(
    () => permissions.menuItems.length > 0 || isSuperAdmin(),
    [permissions.menuItems, isSuperAdmin]
  );

  const contextValue = {
    permissions: permissions.menuGroups,
    menuItems: permissions.menuItems,
    loading: permissions.loading,
    error: permissions.error,
    hasAccess,
    hasGroupAccess,
    verifyAccess,
    hasAnyAccess,
    isSuperAdmin,
    getGroupMenuItems,
    getAccessibleMenuGroups,
    refreshPermissions,
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

export const PermissionGate = ({ path, children, fallback = null }) => {
  const { hasAccess, loading, isSuperAdmin } = usePermissions();
  if (loading) return fallback;
  if (isSuperAdmin() || hasAccess(path)) return children;
  return fallback;
};

export default PermissionContext;
