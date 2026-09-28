import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Paper,
  Stack,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Avatar,
  Chip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_ROLES,
  ADD_ROLE,
  UPDATE_ROLE,
  DELETE_ROLE,
  handleApiError,
} from './apiConfig';

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
};

function SystemRoles() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token } = useAuth();
  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentRole, setCurrentRole] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [formData, setFormData] = useState({ role_name: '', description: '' });
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(GET_ROLES, { headers: authHeaders });
      if (response.data.success) setRoles(response.data.roles || []);
    } catch (err) {
      handleApiError(err, navigate);
      notify('Failed to fetch roles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openCreate = () => {
    setEditMode(false);
    setCurrentRole(null);
    setFormData({ role_name: '', description: '' });
    setFormErrors({});
    setOpenModal(true);
  };

  const openEdit = (role) => {
    setEditMode(true);
    setCurrentRole(role);
    setFormData({
      role_name: role.role_name || '',
      description: role.description || '',
    });
    setFormErrors({});
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setCurrentRole(null);
    setFormErrors({});
  };

  const validate = () => {
    const errors = {};
    if (!formData.role_name.trim()) errors.role_name = 'Role name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editMode && currentRole) {
        await axios.post(
          UPDATE_ROLE,
          {
            role_id: currentRole.role_id,
            role_name: formData.role_name.trim(),
            description: formData.description.trim(),
          },
          { headers: authHeaders }
        );
        notify('Role updated successfully.');
      } else {
        await axios.post(
          ADD_ROLE,
          {
            role_name: formData.role_name.trim(),
            description: formData.description.trim(),
          },
          { headers: authHeaders }
        );
        notify('Role created successfully.');
      }
      closeModal();
      fetchRoles();
    } catch (err) {
      handleApiError(err, navigate);
      notify(err.response?.data?.message || 'Failed to save role.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await axios.post(
        DELETE_ROLE,
        { id: confirmDelete.role_id },
        { headers: authHeaders }
      );
      notify('Role deleted successfully.');
      setConfirmDelete(null);
      fetchRoles();
    } catch (err) {
      handleApiError(err, navigate);
      notify(err.response?.data?.message || 'Failed to delete role.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 }, bgcolor: T.bg, minHeight: '100%' }}>
      <Paper elevation={0} sx={{ ...panelSx, p: 1.5, mb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <ShieldOutlinedIcon sx={{ color: T.brand, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: T.text }}>
                System Roles
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                Create and manage access roles for staff accounts
              </Typography>
            </Box>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ ml: { sm: 'auto' }, flexShrink: 0 }}
          >
            <IconButton onClick={fetchRoles} disabled={loading || busy} title="Refresh">
              <RefreshIcon />
            </IconButton>
            <Button
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={brandBtnSx}
              disabled={busy}
            >
              Add role
            </Button>
          </Stack>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : isMobile ? (
        <Stack spacing={1}>
          {roles.map((role) => (
            <Paper key={role.role_id} elevation={0} sx={{ ...panelSx, p: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Avatar sx={{ bgcolor: T.surfaceAlt, color: T.textMuted }}>
                  {role.role_name?.[0]?.toUpperCase() || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {role.role_name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }} noWrap>
                    {role.description || 'No description'}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                    <Chip size="small" label={`${role.user_count || 0} users`} />
                    <Chip size="small" label={`${role.permission_count || 0} perms`} />
                  </Stack>
                </Box>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => openEdit(role)}
                  sx={{ textTransform: 'none' }}
                >
                  Edit
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled={Number(role.role_id) === 1}
                  onClick={() => setConfirmDelete(role)}
                  sx={{ textTransform: 'none' }}
                >
                  Delete
                </Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={panelSx}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  Users
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  Permissions
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.role_id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          fontSize: '0.8rem',
                          bgcolor: T.surfaceAlt,
                          color: T.textMuted,
                        }}
                      >
                        {role.role_name?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                      <Typography sx={{ fontWeight: 600 }}>{role.role_name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: T.textMuted }}>
                    {role.description || '—'}
                  </TableCell>
                  <TableCell align="center">{role.user_count || 0}</TableCell>
                  <TableCell align="center">{role.permission_count || 0}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEdit(role)} title="Edit">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={Number(role.role_id) === 1}
                      onClick={() => setConfirmDelete(role)}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!roles.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: T.textMuted }}>
                    No roles yet. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={openModal} onClose={busy ? undefined : closeModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editMode ? 'Edit role' : 'Add role'}
          <IconButton onClick={closeModal} disabled={busy} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Role name"
              fullWidth
              value={formData.role_name}
              onChange={(e) => setFormData((f) => ({ ...f, role_name: e.target.value }))}
              error={!!formErrors.role_name}
              helperText={formErrors.role_name}
              disabled={busy}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={formData.description}
              onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              disabled={busy}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={closeModal} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} sx={brandBtnSx}>
            {busy ? <CircularProgress size={20} color="inherit" /> : editMode ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmDelete} onClose={() => !busy && setConfirmDelete(null)}>
        <DialogTitle>Delete role?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{confirmDelete?.role_name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default SystemRoles;
