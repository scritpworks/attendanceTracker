import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Button,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import axios from 'axios';
import { useAuth } from '../AuthContext';
import {
  GET_ROLES,
  GET_MENU_ITEMS,
  GET_MENU_GROUPS,
  GET_ROLE_MENU_PERMISSIONS,
  BULK_ASSIGN_MENU_PERMISSIONS,
} from '../apiConfig';

const T = {
  brand: '#2E7D32',
  brandHover: '#1B5E20',
  border: '#ECECEC',
  borderStrong: '#D3D3D4',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F5',
  text: '#222222',
  textMuted: '#777777',
  bg: '#F5F5F5',
};

const panelSx = {
  borderRadius: 2,
  border: `1px solid ${T.borderStrong}`,
  bgcolor: T.surface,
  boxShadow: 'none',
};

const brandBtnSx = {
  textTransform: 'none',
  fontWeight: 700,
  bgcolor: T.brand,
  color: '#fff',
  borderRadius: 1.5,
  '&:hover': { bgcolor: T.brandHover },
  '&:disabled': { bgcolor: T.border, color: T.textMuted },
};

function RolePermissions() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [roles, setRoles] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuGroups, setMenuGroups] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, menuItemsRes, menuGroupsRes] = await Promise.all([
        axios.get(GET_ROLES, { headers: authHeaders }),
        axios.get(GET_MENU_ITEMS, { headers: authHeaders }),
        axios.get(GET_MENU_GROUPS, { headers: authHeaders }),
      ]);
      if (rolesRes.data.success) setRoles(rolesRes.data.roles || []);
      if (menuItemsRes.data.success) setMenuItems(menuItemsRes.data.menuItems || []);
      if (menuGroupsRes.data.success) setMenuGroups(menuGroupsRes.data.groups || []);
    } catch (error) {
      console.error(error);
      notify('Failed to load permissions data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchRolePermissions = async (roleId) => {
    try {
      const response = await axios.get(`${GET_ROLE_MENU_PERMISSIONS}/${roleId}`, {
        headers: authHeaders,
      });
      if (response.data.success) {
        setSelectedPermissions(
          (response.data.permissions || []).map((p) => p.menu_item_id)
        );
      }
    } catch (error) {
      console.error(error);
      setSelectedPermissions([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    fetchRolePermissions(role.role_id);
  };

  const handlePermissionToggle = (menuItemId) => {
    setSelectedPermissions((prev) =>
      prev.includes(menuItemId)
        ? prev.filter((id) => id !== menuItemId)
        : [...prev, menuItemId]
    );
  };

  const handleGroupToggle = (groupName, selectAll) => {
    const groupItemIds = menuItems
      .filter((item) => item.group_name === groupName)
      .map((item) => item.id);

    setSelectedPermissions((prev) => {
      if (selectAll) return [...new Set([...prev, ...groupItemIds])];
      return prev.filter((id) => !groupItemIds.includes(id));
    });
  };

  const handleSelectAll = () => {
    setSelectedPermissions(menuItems.map((item) => item.id));
  };

  const handleClearAll = () => {
    setSelectedPermissions([]);
  };

  const handleSave = async () => {
    if (!selectedRole) {
      notify('Select a role first.', 'warning');
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post(
        BULK_ASSIGN_MENU_PERMISSIONS,
        {
          roleId: selectedRole.role_id,
          menuItemIds: selectedPermissions,
        },
        { headers: authHeaders }
      );
      if (response.data.success) {
        notify(`Saved ${selectedPermissions.length} menu permissions.`);
        fetchData();
      } else {
        throw new Error(response.data.message);
      }
    } catch (error) {
      notify(error.response?.data?.message || 'Failed to save permissions.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const groupedMenuItems = menuGroups
    .map((group) => ({
      ...group,
      items: menuItems.filter((item) => item.group_name === group.group_name),
    }))
    .filter((group) => group.items.length > 0);

  const getGroupSelectionStatus = (groupName) => {
    const groupItems = menuItems.filter((item) => item.group_name === groupName);
    const selectedCount = groupItems.filter((item) =>
      selectedPermissions.includes(item.id)
    ).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === groupItems.length) return 'all';
    return 'partial';
  };

  if (loading) {
    return (
      <Box
        sx={{
          p: 2,
          bgcolor: T.bg,
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: T.brand }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, bgcolor: T.bg, minHeight: '100%' }}>
      <Paper elevation={0} sx={{ ...panelSx, p: 1.5, mb: 1.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon sx={{ color: T.brand }} />
            <Box>
              <Typography sx={{ fontWeight: 700, color: T.text }}>
                Role permissions
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                Choose which menu pages each role can access
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={fetchData} disabled={saving} title="Refresh">
              <RefreshIcon />
            </IconButton>
            <Button
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!selectedRole || saving}
              sx={brandBtnSx}
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 1.5,
          alignItems: 'stretch',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            width: { xs: '100%', lg: 280 },
            flexShrink: 0,
            p: 1,
            maxHeight: { lg: '70vh' },
            overflow: 'auto',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', px: 1, py: 0.75 }}>
            Roles
          </Typography>
          <List dense disablePadding>
            {roles.map((role) => {
              const selected = selectedRole?.role_id === role.role_id;
              return (
                <ListItem
                  key={role.role_id}
                  button
                  onClick={() => handleRoleSelect(role)}
                  sx={{
                    borderRadius: 1.5,
                    mb: 0.5,
                    border: `1px solid ${selected ? T.brand : T.border}`,
                    bgcolor: selected ? 'rgba(46,125,50,0.08)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <GroupIcon sx={{ color: selected ? T.brand : T.textMuted }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={role.role_name}
                    secondary={`${role.permission_count || 0} permissions`}
                    primaryTypographyProps={{
                      fontWeight: selected ? 700 : 500,
                      fontSize: '0.85rem',
                    }}
                    secondaryTypographyProps={{ fontSize: '0.72rem' }}
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            flex: 1,
            p: 1.25,
            minHeight: 320,
            maxHeight: { lg: '70vh' },
            overflow: 'auto',
          }}
        >
          {!selectedRole ? (
            <Box sx={{ py: 8, textAlign: 'center', color: T.textMuted }}>
              <SecurityIcon sx={{ fontSize: 40, mb: 1, opacity: 0.5 }} />
              <Typography>Select a role to manage its menu access</Typography>
            </Box>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>
                    {selectedRole.role_name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: T.textMuted }}>
                    {selectedPermissions.length} of {menuItems.length} menus selected
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    icon={<SelectAllIcon />}
                    label="Select all"
                    onClick={handleSelectAll}
                    clickable
                  />
                  <Chip
                    size="small"
                    icon={<ClearIcon />}
                    label="Clear"
                    onClick={handleClearAll}
                    clickable
                  />
                </Stack>
              </Stack>

              {groupedMenuItems.map((group) => {
                const status = getGroupSelectionStatus(group.group_name);
                return (
                  <Accordion
                    key={group.group_name}
                    defaultExpanded={!isMobile}
                    disableGutters
                    sx={{
                      mb: 1,
                      border: `1px solid ${T.border}`,
                      borderRadius: '8px !important',
                      boxShadow: 'none',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          width: '100%',
                          pr: 1,
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={status === 'all'}
                          indeterminate={status === 'partial'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            handleGroupToggle(group.group_name, e.target.checked)
                          }
                          sx={{
                            color: T.textMuted,
                            '&.Mui-checked, &.MuiCheckbox-indeterminate': {
                              color: T.brand,
                            },
                          }}
                        />
                        <Typography sx={{ fontWeight: 600, flex: 1 }}>
                          {group.display_name || group.group_name}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${
                            group.items.filter((i) =>
                              selectedPermissions.includes(i.id)
                            ).length
                          }/${group.items.length}`}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                      <List dense disablePadding>
                        {group.items.map((item) => (
                          <ListItem
                            key={item.id}
                            dense
                            button
                            onClick={() => handlePermissionToggle(item.id)}
                            sx={{ borderRadius: 1 }}
                          >
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <Checkbox
                                edge="start"
                                size="small"
                                checked={selectedPermissions.includes(item.id)}
                                tabIndex={-1}
                                disableRipple
                                sx={{
                                  color: T.textMuted,
                                  '&.Mui-checked': { color: T.brand },
                                }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={item.label}
                              secondary={item.path}
                              primaryTypographyProps={{ fontSize: '0.85rem' }}
                              secondaryTypographyProps={{
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                              }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </>
          )}
        </Paper>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default RolePermissions;
