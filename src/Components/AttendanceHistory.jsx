import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  CircularProgress,
  Drawer,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_ATTENDANCE_HISTORY,
  GET_ATTENDANCE_ROSTER,
  REOPEN_MEETING,
  handleApiError,
} from './apiConfig';
import SnackbarMessage from './SnackbarMessage';

const T = {
  brand: '#2E7D32',
  brandHover: '#1B5E20',
  brandMuted: '#E8F5E9',
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

const TABLE_ITEMS_PER_PAGE = 15;
const CARD_ITEMS_PER_PAGE = 10;

const todayIso = () => new Date().toISOString().slice(0, 10);

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = String(hhmm).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function meetingStatusChip(status) {
  if (status === 'closed') {
    return (
      <Chip
        size="small"
        label="Closed"
        sx={{ bgcolor: '#ECEFF1', color: '#546E7A', fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  if (status === 'ongoing') {
    return (
      <Chip
        size="small"
        label="Ongoing"
        sx={{ bgcolor: '#FFF3E0', color: T.warn, fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="Scheduled"
      sx={{ bgcolor: T.brandMuted, color: T.brand, fontWeight: 700, borderRadius: 1 }}
    />
  );
}

function attendanceChip(status) {
  if (status === 'present') {
    return (
      <Chip
        size="small"
        label="Present"
        sx={{ bgcolor: T.brandMuted, color: T.brand, fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="Absent"
      sx={{ bgcolor: T.surfaceAlt, color: T.textMuted, fontWeight: 700, borderRadius: 1 }}
    />
  );
}

function AttendanceHistory() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [from, setFrom] = useState(() => daysAgoIso(30));
  const [to, setTo] = useState(() => todayIso());
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState({
    from: daysAgoIso(30),
    to: todayIso(),
    search: '',
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmReopen, setConfirmReopen] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMeeting, setMenuMeeting] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [detailSummary, setDetailSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [attendeeFilter, setAttendeeFilter] = useState('all');
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const apiMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const fetchHistory = useCallback(
    async (filters) => {
      setLoading(true);
      try {
        const res = await axios.get(GET_ATTENDANCE_HISTORY, {
          headers: authHeaders,
          params: {
            from: filters.from || undefined,
            to: filters.to || undefined,
            search: filters.search?.trim() || undefined,
          },
        });
        if (!res.data.success) {
          notify(res.data.message || 'Failed to load history.', 'error');
          setRows([]);
          setSummary({ total: 0, present: 0, absent: 0 });
          return;
        }
        const payload = res.data.data || {};
        setRows(payload.rows || []);
        setSummary(payload.summary || { total: 0, present: 0, absent: 0 });
        setCurrentPage(1);
      } catch (err) {
        handleApiError(err, navigate);
        notify(apiMessage(err, 'Failed to load history.'), 'error');
        setRows([]);
        setSummary({ total: 0, present: 0, absent: 0 });
      } finally {
        setLoading(false);
      }
    },
    [token, navigate]
  );

  useEffect(() => {
    fetchHistory(applied);
  }, [fetchHistory, applied]);

  const applyFilters = () => {
    if (from && to && from > to) {
      notify('From date cannot be after to date.', 'error');
      return;
    }
    setApplied({
      from,
      to,
      search: search.trim(),
    });
  };

  const resetFilters = () => {
    const next = {
      from: daysAgoIso(30),
      to: todayIso(),
      search: '',
    };
    setFrom(next.from);
    setTo(next.to);
    setSearch(next.search);
    setApplied(next);
  };

  const handleReopenMeeting = async () => {
    if (!confirmReopen) return;
    setBusy(true);
    try {
      const res = await axios.post(
        REOPEN_MEETING,
        { id: confirmReopen.id },
        { headers: authHeaders }
      );
      if (!res.data.success) {
        notify(res.data.message || 'Failed to reopen meeting.', 'error');
        return;
      }
      notify(res.data.message || `“${confirmReopen.title}” reopened.`);
      setConfirmReopen(null);
      if (drawerOpen && Number(detailMeeting?.id) === Number(confirmReopen.id)) {
        closeDrawer();
      }
      fetchHistory(applied);
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to reopen meeting.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDetailMeeting(null);
    setDetailRows([]);
    setDetailSummary({ total: 0, present: 0, absent: 0 });
    setAttendeeFilter('all');
    setAttendeeSearch('');
  };

  const openMenu = (event, meeting) => {
    setMenuAnchor(event.currentTarget);
    setMenuMeeting(meeting);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuMeeting(null);
  };

  const openMeetingDetails = async (meeting) => {
    if (!meeting?.id) return;
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetailMeeting(meeting);
    setAttendeeFilter('all');
    setAttendeeSearch('');
    try {
      const res = await axios.get(GET_ATTENDANCE_ROSTER(meeting.id), {
        headers: authHeaders,
      });
      if (!res.data.success) {
        notify(res.data.message || 'Failed to load meeting details.', 'error');
        setDetailRows([]);
        setDetailSummary({ total: 0, present: 0, absent: 0 });
        return;
      }
      const payload = res.data.data || {};
      setDetailMeeting(payload.meeting || meeting);
      setDetailRows(payload.rows || []);
      setDetailSummary(
        payload.summary || {
          total: (payload.rows || []).length,
          present: (payload.rows || []).filter((r) => r.status === 'present').length,
          absent: 0,
        }
      );
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load meeting details.'), 'error');
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredAttendees = useMemo(() => {
    const q = attendeeSearch.trim().toLowerCase();
    return detailRows.filter((r) => {
      if (attendeeFilter === 'present' && r.status !== 'present') return false;
      if (attendeeFilter === 'absent' && r.status !== 'absent') return false;
      if (!q) return true;
      return (
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.id || '').includes(q)
      );
    });
  }, [detailRows, attendeeFilter, attendeeSearch]);

  const pageSize = isMobile ? CARD_ITEMS_PER_PAGE : TABLE_ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, safePage, pageSize]);

  const Stat = ({ label, value, accent }) => (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, flex: 1, minWidth: 0 }}>
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

  const MeetingCard = ({ meeting }) => (
    <Paper elevation={0} sx={{ ...panelSx, p: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
            {meetingStatusChip(meeting.status)}
          </Stack>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {meeting.title}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mt: 0.5 }}>
            {formatDisplayDate(meeting.date)} · {formatTime(meeting.time)}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mt: 0.25 }}>
            {meeting.presentCount}/{meeting.memberCount} present
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={(e) => openMenu(e, meeting)}
          aria-label="Meeting actions"
        >
          <MoreVertIcon />
        </IconButton>
      </Stack>
    </Paper>
  );

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.5, md: 2 },
        bgcolor: T.bg,
        minHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <SnackbarMessage
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
      />

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            mb: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <HistoryIcon sx={{ color: T.brand }} />
            <Typography sx={{ fontWeight: 700, color: T.text }}>Attendance History</Typography>
          </Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => fetchHistory(applied)}
            disabled={loading}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: T.brand,
              border: `1px solid ${T.borderStrong}`,
              borderRadius: 1.5,
            }}
          >
            Refresh
          </Button>
        </Box>

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.25}
          alignItems={{ md: 'flex-end' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            label="From"
            type="date"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 160 } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 160 } }}
          />
          <TextField
            size="small"
            placeholder="Search meeting title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 200 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: T.textSoft, fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button
              startIcon={<FilterListIcon />}
              onClick={applyFilters}
              disabled={loading}
              sx={{ ...brandBtnSx, flex: { xs: 1, md: 'none' } }}
            >
              Apply
            </Button>
            <Button
              onClick={resetFilters}
              disabled={loading}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: T.textMuted,
                border: `1px solid ${T.borderStrong}`,
                borderRadius: 1.5,
                flex: { xs: 1, md: 'none' },
              }}
            >
              Reset
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr 1fr', sm: 'repeat(3, 1fr)' },
          gap: 1,
          mb: 1.5,
        }}
      >
        <Stat label="Meetings" value={summary.total} />
        <Stat label="Present marks" value={summary.present} accent={T.brand} />
        <Stat label="Absent marks" value={summary.absent} accent={T.warn} />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : !rows.length ? (
        <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center', color: T.textMuted }}>
          No closed meetings for this date range.
        </Paper>
      ) : isMobile ? (
        <Stack spacing={1}>
          {paginated.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={panelSx}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  Present
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 72 }} align="center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.map((meeting) => (
                <TableRow key={meeting.id} hover>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700 }} noWrap>
                      {meeting.title}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDisplayDate(meeting.date)}</TableCell>
                  <TableCell>{formatTime(meeting.time)}</TableCell>
                  <TableCell>{meetingStatusChip(meeting.status)}</TableCell>
                  <TableCell align="right">
                    <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {meeting.presentCount}
                      <Typography component="span" sx={{ color: T.textMuted, fontWeight: 500 }}>
                        /{meeting.memberCount}
                      </Typography>
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => openMenu(e, meeting)}
                      aria-label="Meeting actions"
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            if (menuMeeting) openMeetingDetails(menuMeeting);
            closeMenu();
          }}
        >
          <ListItemIcon>
            <VisibilityOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setConfirmReopen(menuMeeting);
            closeMenu();
          }}
          sx={{ color: T.warn }}
        >
          <ListItemIcon>
            <ReplayIcon fontSize="small" sx={{ color: T.warn }} />
          </ListItemIcon>
          <ListItemText>Reopen</ListItemText>
        </MenuItem>
      </Menu>

      {!loading && rows.length > pageSize && (
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
          <Button
            size="small"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            sx={{ textTransform: 'none' }}
          >
            Previous
          </Button>
          <Typography sx={{ alignSelf: 'center', fontSize: '0.85rem', color: T.textMuted }}>
            Page {safePage} of {totalPages}
          </Typography>
          <Button
            size="small"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            sx={{ textTransform: 'none' }}
          >
            Next
          </Button>
        </Stack>
      )}

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={closeDrawer}
        sx={{
          zIndex: (t) => t.zIndex.modal + 1,
          '& .MuiDrawer-paper': {
            width: { xs: '100vw', sm: '90vw' },
            maxWidth: { xs: '100vw', sm: '90vw' },
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          <Box
            sx={{
              px: { xs: 2, md: 4 },
              py: 2,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
              borderBottom: `1px solid ${T.borderStrong}`,
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1, textAlign: { xs: 'left', sm: 'center' } }}>
              <Typography
                sx={{
                  fontWeight: 800,
                  color: T.text,
                  fontSize: { xs: '1.05rem', sm: '1.25rem' },
                }}
                noWrap
              >
                {detailMeeting?.title || 'Meeting details'}
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                justifyContent={{ xs: 'flex-start', sm: 'center' }}
                sx={{ mt: 0.75 }}
              >
                {detailMeeting?.status && meetingStatusChip(detailMeeting.status)}
              </Stack>
            </Box>
            <IconButton onClick={closeDrawer} aria-label="Close details" sx={{ flexShrink: 0 }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {detailLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress sx={{ color: T.brand }} />
            </Box>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                width: '100%',
              }}
            >
              <Box sx={{ px: { xs: 2, md: 4 }, py: 2, bgcolor: T.surfaceAlt }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={{ xs: 1, sm: 2.5 }}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Typography
                    sx={{
                      fontSize: '0.9rem',
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <EventIcon sx={{ fontSize: 18 }} />
                    {formatDisplayDate(detailMeeting?.date)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.9rem',
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <AccessTimeIcon sx={{ fontSize: 18 }} />
                    {formatTime(detailMeeting?.time)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.9rem',
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                    }}
                  >
                    <GroupsIcon sx={{ fontSize: 18 }} />
                    {detailSummary.present} present · {detailSummary.absent} absent ·{' '}
                    {detailSummary.total} total
                  </Typography>
                </Stack>
              </Box>

              <Box sx={{ px: { xs: 2, md: 4 }, py: 1.5 }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  alignItems={{ sm: 'center' }}
                >
                  <TextField
                    size="small"
                    placeholder="Search attendees"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    sx={{ flex: 1, minWidth: 220 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: T.textSoft, fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="attendee-filter-label">Show</InputLabel>
                    <Select
                      labelId="attendee-filter-label"
                      label="Show"
                      value={attendeeFilter}
                      onChange={(e) => setAttendeeFilter(e.target.value)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="present">Present</MenuItem>
                      <MenuItem value="absent">Absent</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Box>

              <Divider />

              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  px: { xs: 2, md: 4 },
                  py: 1.5,
                  width: '100%',
                }}
              >
                {!filteredAttendees.length ? (
                  <Typography sx={{ color: T.textMuted, textAlign: 'center', py: 4 }}>
                    No attendees match this filter.
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: T.surface }}>Member</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: T.surface }}>
                            Member ID
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: T.surface }}>
                            Recorded
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: T.surface }} align="center">
                            Status
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredAttendees.map((row) => (
                          <TableRow key={row.attendanceId || row.id} hover>
                            <TableCell>
                              <Typography sx={{ fontWeight: 600 }}>{row.name}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                              >
                                {row.id}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: T.textMuted }}>
                              {row.recordedAt || '—'}
                            </TableCell>
                            <TableCell align="center">{attendanceChip(row.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={Boolean(confirmReopen)}
        onClose={() => !busy && setConfirmReopen(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Reopen this meeting?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted }}>
            <strong style={{ color: T.text }}>{confirmReopen?.title}</strong> will become Ongoing
            again and appear on Take Attendance so attendance can be marked.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setConfirmReopen(null)}
            disabled={busy}
            sx={{ textTransform: 'none' }}
          >
            Keep closed
          </Button>
          <Button onClick={handleReopenMeeting} disabled={busy} sx={brandBtnSx}>
            {busy ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Reopen meeting'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AttendanceHistory;
