import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockResetIcon from '@mui/icons-material/LockReset';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_STAFF,
  CREATE_STAFF,
  UPDATE_STAFF,
  DELETE_STAFF,
  ACTIVATE_STAFF,
  DEACTIVATE_STAFF,
  RESET_STAFF_PASSWORD,
  GET_ROLES,
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

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  telephone: '',
  gender: '',
  role: '',
  department: '',
  address: '',
  status: 'active',
};

function StaffRegistration() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentStaff, setCurrentStaff] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuStaff, setMenuStaff] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, rolesRes] = await Promise.all([
        axios.get(GET_STAFF, { headers: authHeaders }),
        axios.get(GET_ROLES, { headers: authHeaders }),
      ]);
      if (staffRes.data.success) setStaff(staffRes.data.data || []);
      if (rolesRes.data.success) setRoles(rolesRes.data.roles || []);
    } catch (err) {
      handleApiError(err, navigate);
      notify('Failed to load staff.', 'error');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) =>
      [s.firstName, s.lastName, s.email, s.role, s.department, s.telephone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [staff, search]);

  const openCreate = () => {
    setEditMode(false);
    setCurrentStaff(null);
    setFormData(emptyForm);
    setFormErrors({});
    setOpenModal(true);
  };

  const openEdit = (member) => {
    setEditMode(true);
    setCurrentStaff(member);
    setFormData({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      telephone: member.telephone || '',
      gender: member.gender && member.gender !== '-' ? member.gender : '',
      role: member.roleId || '',
      department: member.department || '',
      address: member.address || '',
      status: member.status || 'active',
    });
    setFormErrors({});
    setOpenModal(true);
    closeMenu();
  };

  const closeModal = () => {
    setOpenModal(false);
    setCurrentStaff(null);
    setFormErrors({});
  };

  const openMenu = (event, member) => {
    setMenuAnchor(event.currentTarget);
    setMenuStaff(member);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuStaff(null);
  };

  const validate = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'Required';
    if (!formData.lastName.trim()) errors.lastName = 'Required';
    if (!formData.email.trim()) errors.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Invalid email';
    }
    if (!formData.role) errors.role = 'Select a role';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editMode && currentStaff) {
        await axios.post(
          UPDATE_STAFF,
          {
            id: currentStaff.id,
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            telephone: formData.telephone.trim(),
            gender: formData.gender || '-',
            role: formData.role,
            department: formData.department.trim(),
            address: formData.address.trim(),
            loginStatus: 'staff',
          },
          { headers: authHeaders }
        );
        notify('Staff updated successfully.');
      } else {
        await axios.post(
          CREATE_STAFF,
          {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            telephone: formData.telephone.trim(),
            gender: formData.gender || '-',
            role: formData.role,
            department: formData.department.trim(),
            address: formData.address.trim(),
            status: formData.status,
            loginStatus: 'staff',
          },
          { headers: authHeaders }
        );
        notify(
          `Staff created. Default password is their email: ${formData.email.trim().toLowerCase()}`
        );
      }
      closeModal();
      fetchAll();
    } catch (err) {
      handleApiError(err, navigate);
      notify(err.response?.data?.message || 'Failed to save staff.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, member } = confirmAction;
    setBusy(true);
    try {
      if (type === 'delete') {
        await axios.put(DELETE_STAFF, { id: member.id }, { headers: authHeaders });
        notify('Staff deleted.');
      } else if (type === 'activate') {
        await axios.post(ACTIVATE_STAFF, { id: member.id }, { headers: authHeaders });
        notify('Account activated.');
      } else if (type === 'deactivate') {
        await axios.post(DEACTIVATE_STAFF, { id: member.id }, { headers: authHeaders });
        notify('Account deactivated.');
      } else if (type === 'reset') {
        await axios.post(
          RESET_STAFF_PASSWORD,
          { id: member.id, email: member.email },
          { headers: authHeaders }
        );
        notify(`Password reset. New password is: ${member.email}`);
      }
      setConfirmAction(null);
      fetchAll();
    } catch (err) {
      handleApiError(err, navigate);
      notify(err.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const isSelf = (member) => Number(member?.id) === Number(user?.id);

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
            <PeopleIcon sx={{ color: T.brand, flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, color: T.text }}>
                Staff Registration
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                Add and manage staff users for the system
              </Typography>
            </Box>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="flex-end"
            sx={{ ml: { sm: 'auto' }, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            <TextField
              size="small"
              placeholder="Search staff…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: T.textMuted, fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: { xs: '100%', sm: 220 } }}
            />
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
              <IconButton onClick={fetchAll} disabled={loading || busy} title="Refresh">
                <RefreshIcon />
              </IconButton>
              <Button
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={brandBtnSx}
                disabled={busy}
              >
                Add staff
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : isMobile ? (
        <Stack spacing={1}>
          {filtered.map((member) => (
            <Paper key={member.id} elevation={0} sx={{ ...panelSx, p: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Avatar sx={{ bgcolor: T.surfaceAlt, color: T.textMuted }}>
                  {member.firstName?.[0]?.toUpperCase() || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {member.firstName} {member.lastName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }} noWrap>
                    {member.email}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                    <Chip size="small" label={member.role || 'No role'} />
                    <Chip
                      size="small"
                      color={member.status === 'active' ? 'success' : 'default'}
                      label={member.status}
                    />
                  </Stack>
                </Box>
                <IconButton size="small" onClick={(e) => openMenu(e, member)}>
                  <MoreVertIcon />
                </IconButton>
              </Box>
            </Paper>
          ))}
          {!filtered.length && (
            <Paper elevation={0} sx={{ ...panelSx, p: 3, textAlign: 'center', color: T.textMuted }}>
              No staff found.
            </Paper>
          )}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={panelSx}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Department</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((member) => (
                <TableRow key={member.id} hover>
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
                        {member.firstName?.[0]?.toUpperCase() || '?'}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {member.firstName} {member.lastName}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: T.textMuted }}>
                          {member.telephone || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.85rem' }}>{member.email}</TableCell>
                  <TableCell>
                    <Chip size="small" label={member.role || '—'} />
                  </TableCell>
                  <TableCell sx={{ color: T.textMuted }}>
                    {member.department || '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={member.status === 'active' ? 'success' : 'default'}
                      label={member.status}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => openMenu(e, member)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: T.textMuted }}>
                    No staff found. Click “Add staff” to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            openEdit(menuStaff);
          }}
        >
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        {menuStaff?.status === 'active' ? (
          <MenuItem
            disabled={isSelf(menuStaff)}
            onClick={() => {
              setConfirmAction({ type: 'deactivate', member: menuStaff });
              closeMenu();
            }}
          >
            <BlockIcon fontSize="small" sx={{ mr: 1 }} /> Deactivate
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setConfirmAction({ type: 'activate', member: menuStaff });
              closeMenu();
            }}
          >
            <CheckCircleIcon fontSize="small" sx={{ mr: 1 }} /> Activate
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setConfirmAction({ type: 'reset', member: menuStaff });
            closeMenu();
          }}
        >
          <LockResetIcon fontSize="small" sx={{ mr: 1 }} /> Reset password
        </MenuItem>
        <MenuItem
          disabled={isSelf(menuStaff)}
          onClick={() => {
            setConfirmAction({ type: 'delete', member: menuStaff });
            closeMenu();
          }}
          sx={{ color: '#b91c1c' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      <Dialog open={openModal} onClose={busy ? undefined : closeModal} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {editMode ? 'Edit staff' : 'Add staff'}
          <IconButton onClick={closeModal} disabled={busy} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="First name"
                fullWidth
                value={formData.firstName}
                onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))}
                error={!!formErrors.firstName}
                helperText={formErrors.firstName}
                disabled={busy}
              />
              <TextField
                label="Last name"
                fullWidth
                value={formData.lastName}
                onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))}
                error={!!formErrors.lastName}
                helperText={formErrors.lastName}
                disabled={busy}
              />
            </Stack>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              error={!!formErrors.email}
              helperText={
                formErrors.email ||
                (!editMode ? 'Default password will be this email address' : '')
              }
              disabled={busy}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Telephone"
                fullWidth
                value={formData.telephone}
                onChange={(e) => setFormData((f) => ({ ...f, telephone: e.target.value }))}
                disabled={busy}
              />
              <FormControl fullWidth disabled={busy}>
                <InputLabel>Gender</InputLabel>
                <Select
                  label="Gender"
                  value={formData.gender}
                  onChange={(e) => setFormData((f) => ({ ...f, gender: e.target.value }))}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth error={!!formErrors.role} disabled={busy}>
                <InputLabel>Role</InputLabel>
                <Select
                  label="Role"
                  value={formData.role}
                  onChange={(e) => setFormData((f) => ({ ...f, role: e.target.value }))}
                >
                  {roles.map((role) => (
                    <MenuItem key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </MenuItem>
                  ))}
                </Select>
                {formErrors.role && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mt: 0.5, ml: 1.5 }}>
                    {formErrors.role}
                  </Typography>
                )}
              </FormControl>
              <TextField
                label="Department"
                fullWidth
                value={formData.department}
                onChange={(e) => setFormData((f) => ({ ...f, department: e.target.value }))}
                disabled={busy}
              />
            </Stack>
            <TextField
              label="Address"
              fullWidth
              multiline
              minRows={2}
              value={formData.address}
              onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
              disabled={busy}
            />
            {!editMode && (
              <FormControl fullWidth disabled={busy}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.value }))}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={closeModal} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} sx={brandBtnSx}>
            {busy ? (
              <CircularProgress size={20} color="inherit" />
            ) : editMode ? (
              'Update'
            ) : (
              'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmAction} onClose={() => !busy && setConfirmAction(null)}>
        <DialogTitle>
          {confirmAction?.type === 'delete' && 'Delete staff?'}
          {confirmAction?.type === 'activate' && 'Activate account?'}
          {confirmAction?.type === 'deactivate' && 'Deactivate account?'}
          {confirmAction?.type === 'reset' && 'Reset password?'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmAction?.type === 'delete' && (
              <>
                Delete <strong>{confirmAction.member.firstName} {confirmAction.member.lastName}</strong>?
                This cannot be undone.
              </>
            )}
            {confirmAction?.type === 'activate' && (
              <>Activate account for <strong>{confirmAction.member.email}</strong>?</>
            )}
            {confirmAction?.type === 'deactivate' && (
              <>Deactivate account for <strong>{confirmAction.member.email}</strong>?</>
            )}
            {confirmAction?.type === 'reset' && (
              <>
                Reset password for <strong>{confirmAction.member.email}</strong>?
                New password will be their email address.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={busy} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmAction?.type === 'delete' ? 'error' : 'primary'}
            onClick={runConfirmAction}
            disabled={busy}
            sx={{
              textTransform: 'none',
              ...(confirmAction?.type !== 'delete'
                ? { bgcolor: T.brand, '&:hover': { bgcolor: T.brandHover } }
                : {}),
            }}
          >
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4500}
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

export default StaffRegistration;
