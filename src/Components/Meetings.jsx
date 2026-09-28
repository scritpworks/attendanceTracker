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
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EventIcon from '@mui/icons-material/Event';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import CloseIcon from '@mui/icons-material/Close';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import RefreshIcon from '@mui/icons-material/Refresh';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_MEETINGS,
  CREATE_MEETING,
  UPDATE_MEETING,
  CANCEL_MEETING,
  CLOSE_MEETING,
  GET_MEETINGS_REPORT,
  GET_MEETING_REPORT,
  handleApiError,
} from './apiConfig';
import SnackbarMessage from './SnackbarMessage';
import MeetingsReportDialog from './reports/MeetingsReportDialog';

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

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = { title: '', date: '', time: '' };

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function statusChip(status) {
  if (status === 'cancelled') {
    return (
      <Chip
        size="small"
        label="Cancelled"
        sx={{
          bgcolor: '#FFEBEE',
          color: T.danger,
          fontWeight: 700,
          borderRadius: 1,
        }}
      />
    );
  }
  if (status === 'closed') {
    return (
      <Chip
        size="small"
        label="Closed"
        sx={{
          bgcolor: '#ECEFF1',
          color: '#546E7A',
          fontWeight: 700,
          borderRadius: 1,
        }}
      />
    );
  }
  if (status === 'ongoing') {
    return (
      <Chip
        size="small"
        label="Ongoing"
        sx={{
          bgcolor: '#FFF3E0',
          color: T.warn,
          fontWeight: 700,
          borderRadius: 1,
        }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="Scheduled"
      sx={{
        bgcolor: '#E8F5E9',
        color: T.brand,
        fontWeight: 700,
        borderRadius: 1,
      }}
    />
  );
}

function isActiveMeeting(status) {
  return status === 'scheduled' || status === 'ongoing';
}

function isTerminalMeeting(status) {
  return status === 'closed' || status === 'cancelled';
}

function Meetings() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [confirmClose, setConfirmClose] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMeeting, setMenuMeeting] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRows, setReportRows] = useState([]);
  const [reportFilters, setReportFilters] = useState({});
  const [reportSummary, setReportSummary] = useState(null);
  const [reportTitle, setReportTitle] = useState('Meetings Report');
  const [reportBusy, setReportBusy] = useState(false);

  const today = todayIso();

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const apiMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(GET_MEETINGS, { headers: authHeaders });
      if (res.data.success) {
        setMeetings(res.data.data || []);
      } else {
        notify(res.data.message || 'Failed to load meetings.', 'error');
      }
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load meetings.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [token, navigate]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const stats = useMemo(() => {
    const active = meetings.filter((m) => isActiveMeeting(m.status));
    return {
      upcoming: active.filter((m) => m.date >= today).length,
      today: active.filter((m) => m.date === today).length,
      ongoing: meetings.filter((m) => m.status === 'ongoing').length,
      closed: meetings.filter((m) => m.status === 'closed').length,
      cancelled: meetings.filter((m) => m.status === 'cancelled').length,
      total: meetings.length,
    };
  }, [meetings, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meetings
      .filter((m) => {
        if (filter === 'upcoming') return isActiveMeeting(m.status) && m.date >= today;
        if (filter === 'past') return isActiveMeeting(m.status) && m.date < today;
        if (filter === 'ongoing') return m.status === 'ongoing';
        if (filter === 'closed') return m.status === 'closed';
        if (filter === 'cancelled') return m.status === 'cancelled';
        return true;
      })
      .filter((m) => !q || m.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return a.time < b.time ? 1 : -1;
      });
  }, [meetings, search, filter, today]);

  const openCreate = () => {
    setEditMode(false);
    setCurrent(null);
    setForm({ title: '', date: today, time: '09:00' });
    setFormErrors({});
    setOpenModal(true);
  };

  const openEdit = (meeting) => {
    setEditMode(true);
    setCurrent(meeting);
    setForm({
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
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

  const openMenu = (event, meeting) => {
    setMenuAnchor(event.currentTarget);
    setMenuMeeting(meeting);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuMeeting(null);
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.date) errors.date = 'Date is required';
    if (!form.time) errors.time = 'Time is required';
    if (!editMode && form.date && form.date < today) {
      errors.date = 'Meeting date cannot be in the past';
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
          UPDATE_MEETING,
          {
            id: current.id,
            title: form.title.trim(),
            date: form.date,
            time: form.time,
          },
          { headers: authHeaders }
        );
        notify(res.data.message || 'Meeting updated successfully.');
      } else {
        const res = await axios.post(
          CREATE_MEETING,
          {
            title: form.title.trim(),
            date: form.date,
            time: form.time,
          },
          { headers: authHeaders }
        );
        notify(res.data.message || 'Meeting scheduled successfully.');
      }
      closeModal();
      fetchMeetings();
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to save meeting.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelMeeting = async () => {
    if (!confirmCancel) return;
    setBusy(true);
    try {
      const res = await axios.post(
        CANCEL_MEETING,
        { id: confirmCancel.id },
        { headers: authHeaders }
      );
      notify(res.data.message || `“${confirmCancel.title}” cancelled.`);
      setConfirmCancel(null);
      fetchMeetings();
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to cancel meeting.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseMeeting = async () => {
    if (!confirmClose) return;
    setBusy(true);
    try {
      const res = await axios.post(
        CLOSE_MEETING,
        { id: confirmClose.id },
        { headers: authHeaders }
      );
      notify(res.data.message || `“${confirmClose.title}” closed.`);
      setConfirmClose(null);
      fetchMeetings();
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to close meeting.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const goTakeAttendance = (meeting) => {
    closeMenu();
    navigate('/side/attendance', {
      state: {
        meetingId: meeting.id,
        meetingTitle: meeting.title,
      },
    });
  };

  const openMeetingReport = async (meeting) => {
    closeMenu();
    if (!meeting) return;
    setReportBusy(true);
    try {
      const res = await axios.get(GET_MEETING_REPORT(meeting.id), { headers: authHeaders });
      if (!res.data.success) {
        notify(res.data.message || 'Failed to load meeting report.', 'error');
        return;
      }
      const payload = res.data.data || {};
      setReportRows(payload.rows || []);
      setReportSummary(payload.summary || null);
      setReportFilters({
        Meeting: meeting.title,
        Date: formatDisplayDate(meeting.date),
        Time: formatTime(meeting.time),
      });
      setReportTitle(`Meeting Report — ${meeting.title}`);
      setReportOpen(true);
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load meeting report.'), 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const openFilteredMeetingsReport = async () => {
    setReportBusy(true);
    try {
      const statusParam =
        filter === 'all'
          ? 'all'
          : filter === 'cancelled'
            ? 'cancelled'
            : filter === 'closed'
              ? 'closed'
              : filter === 'ongoing'
                ? 'ongoing'
                : filter;
      const res = await axios.get(GET_MEETINGS_REPORT, {
        headers: authHeaders,
        params: {
          status: statusParam,
          search: search.trim() || undefined,
          includeCancelled:
            filter === 'all' || filter === 'cancelled' ? true : false,
        },
      });
      if (!res.data.success) {
        notify(res.data.message || 'Failed to load meetings report.', 'error');
        return;
      }
      const payload = res.data.data || {};
      const rows = payload.rows || [];
      if (!rows.length) {
        notify(res.data.message || 'No meetings in this view to report on.', 'error');
        return;
      }
      setReportRows(rows);
      setReportSummary(payload.summary || null);
      setReportFilters({
        View:
          filter === 'all'
            ? 'All meetings'
            : filter.charAt(0).toUpperCase() + filter.slice(1),
        Meetings: `${rows.length} meeting(s)`,
        Search: search.trim() || '—',
      });
      setReportTitle('Meetings Report');
      setReportOpen(true);
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load meetings report.'), 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const StatCard = ({ label, value, accent }) => (
    <Paper
      elevation={0}
      sx={{
        ...panelSx,
        p: { xs: 1.25, sm: 1.5 },
        flex: 1,
        minWidth: 0,
        height: '100%',
      }}
    >
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

  const MeetingCard = ({ meeting }) => {
    const terminal = isTerminalMeeting(meeting.status);
    const canTakeAttendance = isActiveMeeting(meeting.status);
    const borderColor =
      meeting.status === 'cancelled'
        ? T.danger
        : meeting.status === 'closed'
          ? '#90A4AE'
          : meeting.status === 'ongoing'
            ? T.warn
            : T.brand;
    return (
      <Paper
        elevation={0}
        sx={{
          ...panelSx,
          p: 1.5,
          opacity: terminal ? 0.75 : 1,
          borderLeft: `3px solid ${borderColor}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              {statusChip(meeting.status)}
              {meeting.date === today && canTakeAttendance && (
                <Chip
                  size="small"
                  label="Today"
                  sx={{ bgcolor: '#FFF3E0', color: T.warn, fontWeight: 700, borderRadius: 1 }}
                />
              )}
            </Stack>
            <Typography
              sx={{
                fontWeight: 700,
                color: T.text,
                textDecoration: meeting.status === 'cancelled' ? 'line-through' : 'none',
              }}
              noWrap
            >
              {meeting.title}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}
            >
              <Typography
                sx={{ fontSize: '0.8rem', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <EventIcon sx={{ fontSize: 14 }} />
                {formatDisplayDate(meeting.date)}
              </Typography>
              <Typography
                sx={{ fontSize: '0.8rem', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                {formatTime(meeting.time)}
              </Typography>
              <Typography
                sx={{ fontSize: '0.8rem', color: T.textMuted, display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <GroupsIcon sx={{ fontSize: 14 }} />
                {meeting.presentCount}/{meeting.memberCount} present
              </Typography>
            </Stack>
          </Box>
          <IconButton size="small" onClick={(e) => openMenu(e, meeting)} aria-label="Meeting actions">
            <MoreVertIcon />
          </IconButton>
        </Box>
        {canTakeAttendance && (
          <Button
            size="small"
            fullWidth
            startIcon={<HowToRegIcon />}
            onClick={() => goTakeAttendance(meeting)}
            sx={{
              mt: 1.25,
              textTransform: 'none',
              fontWeight: 700,
              color: T.brand,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 1.5,
              py: 0.75,
            }}
          >
            Take attendance
          </Button>
        )}
      </Paper>
    );
  };

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
              <EventIcon sx={{ color: T.brand, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 700, color: T.text }}>Meetings</Typography>
            </Box>
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ display: { xs: 'flex', sm: 'none' }, flexShrink: 0 }}
            >
              <IconButton
                onClick={fetchMeetings}
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
                onClick={openFilteredMeetingsReport}
                aria-label="View report"
                disabled={reportBusy}
                sx={{
                  color: T.brand,
                  border: `1px solid ${T.borderStrong}`,
                  borderRadius: 1.5,
                }}
              >
                {reportBusy ? <CircularProgress size={18} sx={{ color: T.brand }} /> : <DescriptionOutlinedIcon />}
              </IconButton>
              <IconButton
                onClick={openCreate}
                aria-label="New meeting"
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
              flexShrink: 0,
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <TextField
              size="small"
              placeholder="Search meetings…"
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
              sx={{
                width: { xs: '100%', sm: 300 },
              }}
            />
            <Button
              startIcon={<RefreshIcon />}
              onClick={fetchMeetings}
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
                '&:hover': { borderColor: T.brand, bgcolor: '#E8F5E9' },
              }}
            >
              Refresh
            </Button>
            <Button
              startIcon={<AddIcon />}
              onClick={openCreate}
              fullWidth={isXs}
              sx={{
                ...brandBtnSx,
                display: { xs: 'none', sm: 'inline-flex' },
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}
            >
              New meeting
            </Button>
            <Button
              variant="outlined"
              startIcon={
                reportBusy ? <CircularProgress size={16} sx={{ color: T.brand }} /> : <DescriptionOutlinedIcon />
              }
              onClick={openFilteredMeetingsReport}
              disabled={reportBusy}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: T.brand,
                borderColor: T.borderStrong,
                borderRadius: 1.5,
                display: { xs: 'none', sm: 'inline-flex' },
                flexShrink: 0,
                whiteSpace: 'nowrap',
                '&:hover': { borderColor: T.brand, bgcolor: '#E8F5E9' },
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
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
          gap: 1,
          mb: 1.5,
        }}
      >
        <StatCard label="Upcoming" value={stats.upcoming} accent={T.brand} />
        <StatCard label="Today" value={stats.today} accent={T.warn} />
        <StatCard label="Ongoing" value={stats.ongoing} accent={T.warn} />
        <StatCard label="Closed" value={stats.closed} accent="#546E7A" />
        <StatCard label="Cancelled" value={stats.cancelled} accent={T.danger} />
        <StatCard label="All meetings" value={stats.total} />
      </Box>

      <Paper
        elevation={0}
        sx={{
          ...panelSx,
          p: 0.75,
          mb: 1.5,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_e, value) => value && setFilter(value)}
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
              '&.Mui-selected': {
                bgcolor: '#E8F5E9',
                color: T.brand,
              },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="upcoming">Upcoming</ToggleButton>
          <ToggleButton value="past">Past</ToggleButton>
          <ToggleButton value="ongoing">Ongoing</ToggleButton>
          <ToggleButton value="closed">Closed</ToggleButton>
          <ToggleButton value="cancelled">Cancelled</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : isMobile ? (
        <Stack spacing={1}>
          {filtered.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
          {!filtered.length && (
            <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: T.textMuted, mb: 1.5 }}>No meetings in this view.</Typography>
              <Button startIcon={<AddIcon />} onClick={openCreate} sx={brandBtnSx}>
                Schedule one
              </Button>
            </Paper>
          )}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={panelSx}>
          <Table size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                <TableCell sx={{ fontWeight: 700, width: '32%' }}>Meeting</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '18%' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '10%' }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '12%' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700, width: '10%' }} align="right">
                  Present
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    width: 168,
                    minWidth: 168,
                    maxWidth: 168,
                    textAlign: 'center',
                    px: 1,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((meeting) => {
                const terminal = isTerminalMeeting(meeting.status);
                const canTakeAttendance = isActiveMeeting(meeting.status);
                return (
                  <TableRow
                    key={meeting.id}
                    hover
                    sx={{
                      opacity: terminal ? 0.7 : 1,
                      '&:last-child td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Typography
                        noWrap
                        sx={{
                          fontWeight: 700,
                          textDecoration:
                            meeting.status === 'cancelled' ? 'line-through' : 'none',
                        }}
                      >
                        {meeting.title}
                      </Typography>
                      {meeting.date === today && canTakeAttendance && (
                        <Chip
                          size="small"
                          label="Today"
                          sx={{
                            mt: 0.5,
                            height: 20,
                            bgcolor: '#FFF3E0',
                            color: T.warn,
                            fontWeight: 700,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{formatDisplayDate(meeting.date)}</TableCell>
                    <TableCell>{formatTime(meeting.time)}</TableCell>
                    <TableCell>{statusChip(meeting.status)}</TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {meeting.presentCount}
                        <Typography component="span" sx={{ color: T.textMuted, fontWeight: 500 }}>
                          /{meeting.memberCount}
                        </Typography>
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{
                        width: 168,
                        minWidth: 168,
                        maxWidth: 168,
                        px: 1,
                        verticalAlign: 'middle',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 36px',
                          alignItems: 'center',
                          columnGap: 0.5,
                          width: '100%',
                        }}
                      >
                        {canTakeAttendance ? (
                          <Button
                            size="small"
                            startIcon={<HowToRegIcon />}
                            onClick={() => goTakeAttendance(meeting)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              color: T.brand,
                              justifySelf: 'end',
                              minWidth: 0,
                              px: 1,
                            }}
                          >
                            Attendance
                          </Button>
                        ) : (
                          <Box />
                        )}
                        <IconButton
                          size="small"
                          onClick={(e) => openMenu(e, meeting)}
                          aria-label="More actions"
                          sx={{ justifySelf: 'center' }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: T.textMuted }}>
                    No meetings in this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Row actions */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          disabled={!isActiveMeeting(menuMeeting?.status)}
          onClick={() => menuMeeting && openEdit(menuMeeting)}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit meeting</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={!isActiveMeeting(menuMeeting?.status)}
          onClick={() => {
            if (menuMeeting) goTakeAttendance(menuMeeting);
          }}
        >
          <ListItemIcon>
            <HowToRegIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Take attendance</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={reportBusy}
          onClick={() => menuMeeting && openMeetingReport(menuMeeting)}
        >
          <ListItemIcon>
            <DescriptionOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View report</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          disabled={!isActiveMeeting(menuMeeting?.status)}
          onClick={() => {
            setConfirmClose(menuMeeting);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <LockOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Close meeting</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={menuMeeting?.status !== 'scheduled'}
          onClick={() => {
            setConfirmCancel(menuMeeting);
            closeMenu();
          }}
          sx={{ color: T.danger }}
        >
          <ListItemIcon>
            <CancelOutlinedIcon fontSize="small" sx={{ color: T.danger }} />
          </ListItemIcon>
          <ListItemText>Cancel meeting</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create / Edit */}
      <Dialog open={openModal} onClose={closeModal} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ fontWeight: 800 }}>
              {editMode ? 'Edit meeting' : 'New meeting'}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, fontWeight: 400 }}>
              {editMode
                ? 'Title, date, and time can change. Attendance rows stay linked.'
                : 'Creates a Scheduled meeting and Absent rows for every active member.'}
            </Typography>
          </Box>
          <IconButton onClick={closeModal} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              error={Boolean(formErrors.title)}
              helperText={formErrors.title}
              fullWidth
              autoFocus
              placeholder="e.g. Weekly General Assembly"
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                error={Boolean(formErrors.date)}
                helperText={formErrors.date || (!editMode ? 'Past dates are not allowed' : ' ')}
                fullWidth
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: editMode ? undefined : today }}
              />
              <TextField
                label="Time"
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                error={Boolean(formErrors.time)}
                helperText={formErrors.time || ' '}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            {!editMode && (
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                On save, the meeting is Scheduled and Absent attendance rows are created for every
                active member.
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
              'Schedule meeting'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel confirm */}
      <Dialog
        open={Boolean(confirmCancel)}
        onClose={() => !busy && setConfirmCancel(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Cancel this meeting?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted }}>
            <strong style={{ color: T.text }}>{confirmCancel?.title}</strong> will be marked
            Cancelled. Attendance rows are kept but excluded from percentages. Meetings are never
            deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setConfirmCancel(null)}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Keep scheduled
          </Button>
          <Button
            onClick={handleCancelMeeting}
            disabled={busy}
            sx={{
              ...brandBtnSx,
              bgcolor: T.danger,
              '&:hover': { bgcolor: '#B71C1C' },
            }}
          >
            {busy ? (
              <CircularProgress size={20} sx={{ color: '#fff' }} />
            ) : (
              'Cancel meeting'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close confirm */}
      <Dialog
        open={Boolean(confirmClose)}
        onClose={() => !busy && setConfirmClose(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Close this meeting?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted }}>
            <strong style={{ color: T.text }}>{confirmClose?.title}</strong> will be marked Closed.
            Attendance can no longer be marked, and it will leave the Take Attendance list. You can
            reopen it later from Attendance History.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setConfirmClose(null)}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Keep open
          </Button>
          <Button onClick={handleCloseMeeting} disabled={busy} sx={brandBtnSx}>
            {busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Close meeting'}
          </Button>
        </DialogActions>
      </Dialog>

      <MeetingsReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={reportTitle}
        rows={reportRows}
        filters={reportFilters}
        summary={reportSummary}
      />
    </Box>
  );
}

export default Meetings;
