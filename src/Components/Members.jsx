import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Divider,
  Avatar,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockResetIcon from '@mui/icons-material/LockReset';
import CloseIcon from '@mui/icons-material/Close';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import RefreshIcon from '@mui/icons-material/Refresh';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_MEMBERS,
  CREATE_MEMBER,
  UPDATE_MEMBER,
  ACTIVATE_MEMBER,
  DEACTIVATE_MEMBER,
  RESET_MEMBER_PASSWORD,
  handleApiError,
} from './apiConfig';
import SnackbarMessage from './SnackbarMessage';
import MembersReportDialog from './reports/MembersReportDialog';

const T = {
  brand: '#2E7D32',
  brandHover: '#1B5E20',
  brandMuted: '#E8F5E9',
  border: '#ECECEC',
  borderStrong: '#D3D3D4',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F5',
  text: '#222222',
  textMuted: '#777777',
  textSoft: '#9E9E9E',
  bg: '#F5F5F5',
  warn: '#E65100',
  danger: '#C62828',
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

const TABLE_ITEMS_PER_PAGE = 10;
const CARD_ITEMS_PER_PAGE = 10;

const paginationOutlinedBtnSx = {
  borderRadius: 1.25,
  textTransform: 'none',
  fontSize: '0.75rem',
  minWidth: 30,
  height: 28,
  boxShadow: 'none',
  borderColor: T.borderStrong,
  color: T.brand,
  bgcolor: T.surface,
  '&:hover': { borderColor: T.brand, bgcolor: T.surfaceAlt, boxShadow: 'none' },
  '&:disabled': { borderColor: T.border, color: T.textSoft },
};

const activeOutlinedBtnSx = {
  ...paginationOutlinedBtnSx,
  borderColor: T.brand,
  bgcolor: T.brandMuted,
  fontWeight: 700,
  '&:hover': { borderColor: T.brandHover, bgcolor: T.brandMuted, boxShadow: 'none' },
};

const emptyForm = {
  memberId: '',
  fullName: '',
  phone: '',
  email: '',
  notes: '',
};

function formatJoined(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusChip(status) {
  if (status === 'active') {
    return (
      <Chip
        size="small"
        label="Active"
        sx={{ bgcolor: T.brandMuted, color: T.brand, fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="Inactive"
      sx={{ bgcolor: '#FFEBEE', color: T.danger, fontWeight: 700, borderRadius: 1 }}
    />
  );
}

function Members() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { token } = useAuth();
  const navigate = useNavigate();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMember, setMenuMember] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [reportOpen, setReportOpen] = useState(false);

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const apiMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(GET_MEMBERS, { headers: authHeaders });
      if (res.data.success) {
        setMembers(res.data.data || []);
      } else {
        notify(res.data.message || 'Failed to load members.', 'error');
      }
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load members.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const pageSize = isMobile ? CARD_ITEMS_PER_PAGE : TABLE_ITEMS_PER_PAGE;

  const stats = useMemo(() => {
    const active = members.filter((m) => m.status === 'active').length;
    return {
      active,
      inactive: members.length - active,
      total: members.length,
    };
  }, [members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => {
        if (statusFilter === 'active') return m.status === 'active';
        if (statusFilter === 'inactive') return m.status === 'inactive';
        return true;
      })
      .filter((m) => {
        if (!q) return true;
        return (
          m.fullName.toLowerCase().includes(q) ||
          m.memberId.includes(q) ||
          (m.phone || '').includes(q) ||
          (m.email || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openMembersReport = () => {
    if (!filtered.length) {
      notify('No members in this view to report on.', 'error');
      return;
    }
    setReportOpen(true);
  };

  const reportRows = useMemo(
    () =>
      filtered.map((m) => ({
        memberId: m.memberId,
        fullName: m.fullName,
        phone: m.phone || '',
        email: m.email || '',
        status: m.status,
        joinedAt: formatJoined(m.joinedAt),
        createdBy: m.createdBy || '',
      })),
    [filtered]
  );

  const reportFilters = useMemo(
    () => ({
      Status:
        statusFilter === 'all'
          ? 'All members'
          : statusFilter === 'active'
            ? 'Active only'
            : 'Inactive only',
      Search: search.trim() || '—',
      Count: `${filtered.length} member(s)`,
    }),
    [statusFilter, search, filtered.length]
  );

  const openCreate = () => {
    setEditMode(false);
    setCurrent(null);
    setForm(emptyForm);
    setFormErrors({});
    setOpenModal(true);
  };

  const openEdit = (member) => {
    setEditMode(true);
    setCurrent(member);
    setForm({
      memberId: member.memberId,
      fullName: member.fullName,
      phone: member.phone || '',
      email: member.email || '',
      notes: member.notes || '',
    });
    setFormErrors({});
    setOpenModal(true);
    closeMenu();
  };

  const closeModal = () => {
    setOpenModal(false);
    setCurrent(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const openMenu = (event, member) => {
    setMenuAnchor(event.currentTarget);
    setMenuMember(member);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuMember(null);
  };

  const validate = () => {
    const errors = {};
    const id = form.memberId.trim();
    const name = form.fullName.trim();
    const phone = form.phone.trim();

    if (!editMode && !/^\d{10}$/.test(id)) {
      errors.memberId = 'Member ID must be exactly 10 digits';
    }

    if (!name) errors.fullName = 'Full name is required';
    if (!phone) errors.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(phone)) errors.phone = 'Use a 10-digit phone number';

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email or leave blank';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (editMode && current) {
        const res = await axios.post(
          UPDATE_MEMBER,
          {
            id: current.id,
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            notes: form.notes.trim(),
          },
          { headers: authHeaders }
        );
        notify(res.data.message || 'Member updated successfully.');
      } else {
        const res = await axios.post(
          CREATE_MEMBER,
          {
            memberId: form.memberId.trim(),
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            notes: form.notes.trim(),
          },
          { headers: authHeaders }
        );
        notify(
          res.data.message ||
            `Member registered. Temporary password is Member ID: ${form.memberId.trim()}`
        );
      }
      closeModal();
      fetchMembers();
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to save member.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, member } = confirmAction;
    setBusy(true);
    try {
      if (type === 'deactivate') {
        const res = await axios.post(
          DEACTIVATE_MEMBER,
          { id: member.id },
          { headers: authHeaders }
        );
        notify(res.data.message || `${member.fullName} deactivated.`);
      } else if (type === 'reactivate') {
        const res = await axios.post(
          ACTIVATE_MEMBER,
          { id: member.id },
          { headers: authHeaders }
        );
        notify(res.data.message || `${member.fullName} reactivated.`);
      } else if (type === 'reset') {
        const res = await axios.post(
          RESET_MEMBER_PASSWORD,
          { id: member.id, memberId: member.memberId },
          { headers: authHeaders }
        );
        notify(
          res.data.message ||
            `Password reset. Temporary password is Member ID: ${member.memberId}`
        );
      }
      setConfirmAction(null);
      fetchMembers();
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Action failed.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    setTimeout(() => {
      document.getElementById('members-list-anchor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  const renderPagination = (compact = false) => {
    const endIndex = Math.min(startIndex + pageSize, filtered.length);
    return (
      <>
        {totalPages > 1 && (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              alignItems: 'center',
              mt: compact ? 1.5 : 2,
              mb: compact ? 0.5 : 1,
              gap: 1,
            }}
          >
            <Button
              variant="outlined"
              size="small"
              onClick={() => handlePageChange(safePage - 1)}
              disabled={safePage === 1}
              sx={paginationOutlinedBtnSx}
            >
              Previous
            </Button>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mx: { xs: 0, sm: 1 } }}>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) pageNum = i + 1;
                else if (safePage <= 3) pageNum = i + 1;
                else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = safePage - 2 + i;
                return (
                  <Button
                    key={pageNum}
                    size="small"
                    variant="outlined"
                    onClick={() => handlePageChange(pageNum)}
                    sx={
                      safePage === pageNum
                        ? { ...paginationOutlinedBtnSx, ...activeOutlinedBtnSx }
                        : paginationOutlinedBtnSx
                    }
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handlePageChange(safePage + 1)}
              disabled={safePage === totalPages}
              sx={paginationOutlinedBtnSx}
            >
              Next
            </Button>
          </Box>
        )}
        <Box
          sx={{
            textAlign: 'center',
            mt: compact ? 1 : 1.5,
            mb: compact ? 0 : 1,
            color: T.textMuted,
            fontSize: '0.8rem',
          }}
        >
          Showing {filtered.length === 0 ? 0 : startIndex + 1}-
          {Math.min(startIndex + pageSize, filtered.length)} of {filtered.length} members
          {totalPages > 1 && ` (Page ${safePage} of ${totalPages})`}
        </Box>
      </>
    );
  };

  const Stat = ({ label, value, accent }) => (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '1.35rem', sm: '1.5rem' },
          fontWeight: 800,
          color: accent || T.text,
          mt: 0.25,
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
    </Paper>
  );

  const MemberCard = ({ member }) => (
    <Paper
      elevation={0}
      sx={{
        ...panelSx,
        p: 1.25,
        opacity: member.status === 'inactive' ? 0.78 : 1,
        borderLeft: `3px solid ${member.status === 'active' ? T.brand : T.danger}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Avatar sx={{ bgcolor: T.brandMuted, color: T.brand, fontWeight: 700 }}>
          {member.fullName?.[0]?.toUpperCase() || '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.35 }}>
            {statusChip(member.status)}
            {member.fresh === 1 && (
              <Chip
                size="small"
                label="First login"
                sx={{ bgcolor: '#FFF3E0', color: T.warn, fontWeight: 700, borderRadius: 1 }}
              />
            )}
          </Stack>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {member.fullName}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, fontFamily: 'monospace' }}>
            {member.memberId}
          </Typography>
          <Stack direction="row" spacing={1.25} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: T.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 0.35,
              }}
            >
              <PhoneIcon sx={{ fontSize: 13 }} />
              {member.phone || '—'}
            </Typography>
            {member.email ? (
              <Typography
                sx={{
                  fontSize: '0.78rem',
                  color: T.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.35,
                }}
                noWrap
              >
                <EmailIcon sx={{ fontSize: 13 }} />
                {member.email}
              </Typography>
            ) : null}
          </Stack>
          <Typography sx={{ fontSize: '0.72rem', color: T.textSoft, mt: 0.5 }}>
            Joined {formatJoined(member.joinedAt)} · by {member.createdBy}
          </Typography>
        </Box>
        <IconButton size="small" onClick={(e) => openMenu(e, member)} aria-label="Member actions">
          <MoreVertIcon />
        </IconButton>
      </Box>
    </Paper>
  );

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.5, md: 2 },
        bgcolor: T.bg,
        minHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <SnackbarMessage
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, mb: 1.5, width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: { xs: 1.25, sm: 1.5 },
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              width: '100%',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <PeopleIcon sx={{ color: T.brand, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 700, color: T.text }}>Members</Typography>
            </Box>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ display: { xs: 'flex', sm: 'none' }, flexShrink: 0 }}
            >
              <IconButton
                onClick={fetchMembers}
                aria-label="Refresh"
                disabled={loading}
                sx={{
                  color: T.brand,
                  border: `1px solid ${T.borderStrong}`,
                  borderRadius: 1.5,
                }}
              >
                <RefreshIcon />
              </IconButton>
              <IconButton
                onClick={openMembersReport}
                aria-label="View report"
                sx={{
                  color: T.brand,
                  border: `1px solid ${T.borderStrong}`,
                  borderRadius: 1.5,
                }}
              >
                <DescriptionOutlinedIcon />
              </IconButton>
              <IconButton
                onClick={openCreate}
                aria-label="Register member"
                sx={{
                  bgcolor: T.brand,
                  color: '#fff',
                  borderRadius: 1.5,
                  '&:hover': { bgcolor: T.brandHover },
                }}
              >
                <AddIcon />
              </IconButton>
            </Stack>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              marginLeft: { sm: 'auto' },
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <TextField
              size="small"
              placeholder="Search name, ID, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth={isXs}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: T.textMuted, fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{ width: { xs: '100%', sm: 300 } }}
            />
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchMembers}
              disabled={loading}
              variant="outlined"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: T.brand,
                borderColor: T.borderStrong,
                borderRadius: 1.5,
                display: { xs: 'none', sm: 'inline-flex' },
                flexShrink: 0,
                '&:hover': { borderColor: T.brand, bgcolor: T.brandMuted },
              }}
            >
              Refresh
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{
                ...brandBtnSx,
                display: { xs: 'none', sm: 'inline-flex' },
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Register member
            </Button>
            <Button
              variant="outlined"
              startIcon={<DescriptionOutlinedIcon />}
              onClick={openMembersReport}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: T.brand,
                borderColor: T.borderStrong,
                borderRadius: 1.5,
                display: { xs: 'none', sm: 'inline-flex' },
                flexShrink: 0,
                whiteSpace: 'nowrap',
                '&:hover': { borderColor: T.brand, bgcolor: T.brandMuted },
              }}
            >
              View report
            </Button>
          </Box>
        </Box>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr 1fr', sm: 'repeat(3, 1fr)' },
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stat label="Active" value={stats.active} accent={T.brand} />
        <Stat label="Inactive" value={stats.inactive} accent={T.danger} />
        <Stat label="Total" value={stats.total} />
      </Box>

      <Paper
        id="members-list-anchor"
        elevation={0}
        sx={{ ...panelSx, p: 0.75, mb: 1.5, overflowX: 'auto' }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={statusFilter}
          onChange={(_e, value) => value && setStatusFilter(value)}
          sx={{
            display: 'flex',
            width: '100%',
            '& .MuiToggleButtonGroup-grouped': {
              flex: { xs: 1, sm: 'none' },
              border: 'none !important',
              margin: 0,
            },
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 600,
              px: { xs: 1, sm: 1.5 },
              py: 0.75,
              fontSize: { xs: '0.75rem', sm: '0.8125rem' },
              border: 'none',
              borderRadius: '8px !important',
              color: T.textMuted,
              whiteSpace: 'nowrap',
              '&.Mui-selected': { bgcolor: T.brandMuted, color: T.brand },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="inactive">Inactive</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : isMobile ? (
        <>
          <Stack spacing={1}>
            {paginated.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
            {!filtered.length && (
              <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center' }}>
                <Typography sx={{ color: T.textMuted, mb: 1.5 }}>No members in this view.</Typography>
                <Button startIcon={<AddIcon />} onClick={openCreate} sx={brandBtnSx}>
                  Register one
                </Button>
              </Paper>
            )}
          </Stack>
          {filtered.length > 0 && renderPagination(true)}
        </>
      ) : (        <>
          <TableContainer component={Paper} elevation={0} sx={panelSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                  <TableCell sx={{ fontWeight: 700, width: '26%' }}>Member</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Member ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '18%' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '10%' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '12%' }}>Joined</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 56, textAlign: 'center' }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((member) => (
                  <TableRow
                    key={member.id}
                    hover
                    sx={{ opacity: member.status === 'inactive' ? 0.72 : 1 }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: T.brandMuted,
                            color: T.brand,
                            fontSize: '0.85rem',
                            fontWeight: 700,
                          }}
                        >
                          {member.fullName?.[0]?.toUpperCase() || '?'}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {member.fullName}
                          </Typography>
                          {member.fresh === 1 && (
                            <Typography sx={{ fontSize: '0.7rem', color: T.warn, fontWeight: 600 }}>
                              First-login password pending
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {member.memberId}
                      </Typography>
                    </TableCell>
                    <TableCell>{member.phone || '—'}</TableCell>
                    <TableCell>
                      <Typography noWrap sx={{ fontSize: '0.85rem' }}>
                        {member.email || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{statusChip(member.status)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.85rem' }}>
                        {formatJoined(member.joinedAt)}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: T.textMuted }}>
                        by {member.createdBy}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={(e) => openMenu(e, member)}
                        aria-label="More actions"
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: T.textMuted }}>
                      No members in this view.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtered.length > 0 && <Box sx={{ mt: 1 }}>{renderPagination(true)}</Box>}
        </>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem onClick={() => menuMember && openEdit(menuMember)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit member</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setConfirmAction({ type: 'reset', member: menuMember });
            closeMenu();
          }}
        >
          <ListItemIcon>
            <LockResetIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset password</ListItemText>
        </MenuItem>
        <Divider />
        {menuMember?.status === 'active' ? (
          <MenuItem
            onClick={() => {
              setConfirmAction({ type: 'deactivate', member: menuMember });
              closeMenu();
            }}
            sx={{ color: T.danger }}
          >
            <ListItemIcon>
              <BlockIcon fontSize="small" sx={{ color: T.danger }} />
            </ListItemIcon>
            <ListItemText>Deactivate</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => {
              setConfirmAction({ type: 'reactivate', member: menuMember });
              closeMenu();
            }}
            sx={{ color: T.brand }}
          >
            <ListItemIcon>
              <CheckCircleIcon fontSize="small" sx={{ color: T.brand }} />
            </ListItemIcon>
            <ListItemText>Reactivate</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create / Edit */}
      <Dialog open={openModal} onClose={closeModal} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>
              {editMode ? 'Edit member' : 'Register member'}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, fontWeight: 400 }}>
              {editMode
                ? 'Member ID must stay unique. History is never deleted.'
                : 'Creates an Active member with a first-login password change.'}
            </Typography>
          </Box>
          <IconButton onClick={closeModal} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Member ID"
              value={form.memberId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  memberId: e.target.value.replace(/\D/g, '').slice(0, 10),
                }))
              }
              error={Boolean(formErrors.memberId)}
              helperText={
                formErrors.memberId ||
                (editMode ? 'Member ID cannot be edited' : 'Exactly 10 digits')
              }
              fullWidth
              disabled={editMode}
              autoFocus={!editMode}
              inputProps={{ inputMode: 'numeric', maxLength: 10 }}
              placeholder="1000000001"
            />
            <TextField
              label="Full name"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              error={Boolean(formErrors.fullName)}
              helperText={formErrors.fullName}
              fullWidth
              autoFocus={editMode}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
                error={Boolean(formErrors.phone)}
                helperText={formErrors.phone || '10 digits'}
                fullWidth
                inputProps={{ inputMode: 'numeric', maxLength: 10 }}
              />
              <TextField
                label="Email (optional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email || ' '}
                fullWidth
              />
            </Stack>
            <TextField
              label="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            {!editMode && (
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                On save, the member is Active. Temporary password = Member ID (must change on first
                login). Attendance rows are added for upcoming meetings only.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={closeModal}
            disabled={busy}
            sx={{ textTransform: 'none', color: T.textMuted }}
          >
            Discard
          </Button>
          <Button onClick={handleSave} disabled={busy} sx={brandBtnSx}>
            {busy ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : editMode ? (
              'Save changes'
            ) : (
              'Register member'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm soft actions */}
      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => !busy && setConfirmAction(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirmAction?.type === 'deactivate' && 'Deactivate member?'}
          {confirmAction?.type === 'reactivate' && 'Reactivate member?'}
          {confirmAction?.type === 'reset' && 'Reset password?'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted }}>
            {confirmAction?.type === 'deactivate' && (
              <>
                <strong style={{ color: T.text }}>{confirmAction?.member?.fullName}</strong> will
                become Inactive. Past attendance stays in reports. They get no new meeting rows and
                cannot log in. Members are never deleted.
              </>
            )}
            {confirmAction?.type === 'reactivate' && (
              <>
                <strong style={{ color: T.text }}>{confirmAction?.member?.fullName}</strong> will
                become Active again and will be included in newly created meetings.
              </>
            )}
            {confirmAction?.type === 'reset' && (
              <>
                Temporary password for{' '}
                <strong style={{ color: T.text }}>{confirmAction?.member?.fullName}</strong> will be
                their Member ID. They must change it on next login.
              </>
            )}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setConfirmAction(null)}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            disabled={busy}
            sx={{
              ...brandBtnSx,
              ...(confirmAction?.type === 'deactivate'
                ? { bgcolor: T.danger, '&:hover': { bgcolor: '#B71C1C' } }
                : {}),
            }}
          >
            {busy ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              <>
                {confirmAction?.type === 'deactivate' && 'Deactivate'}
                {confirmAction?.type === 'reactivate' && 'Reactivate'}
                {confirmAction?.type === 'reset' && 'Reset password'}
              </>
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <MembersReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Members Report"
        rows={reportRows}
        filters={reportFilters}
      />
    </Box>
  );
}

export default Members;
