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
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Alert,
  Divider,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import SearchIcon from '@mui/icons-material/Search';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ClearIcon from '@mui/icons-material/Clear';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  GET_ATTENDANCE_MEETINGS,
  GET_ATTENDANCE_ROSTER,
  MARK_ATTENDANCE,
  handleApiError,
} from './apiConfig';
import SnackbarMessage from './SnackbarMessage';
import AttendanceReportDialog from './reports/AttendanceReportDialog';
import { mapRosterToReportRows } from './reports/attendanceReportData';

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

/** Same pattern as school Students.jsx */
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

function statusChip(status) {
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

function meetingStatusChip(status) {
  if (status === 'ongoing') {
    return (
      <Chip
        size="small"
        label="Ongoing"
        sx={{ bgcolor: '#FFF3E0', color: T.warn, fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  if (status === 'scheduled') {
    return (
      <Chip
        size="small"
        label="Scheduled"
        sx={{ bgcolor: T.brandMuted, color: T.brand, fontWeight: 700, borderRadius: 1 }}
      />
    );
  }
  return null;
}

const CLOSED_MEETING_MSG =
  'This meeting has been closed. Attendance can no longer be marked.';

function isClosedMeetingError(errOrMessage) {
  if (typeof errOrMessage === 'string') {
    return (
      errOrMessage.includes('closed') &&
      errOrMessage.toLowerCase().includes('attendance')
    );
  }
  const data = errOrMessage?.response?.data;
  if (data?.code === 'MEETING_CLOSED') return true;
  const msg = data?.message || '';
  return msg.includes('closed') && msg.toLowerCase().includes('attendance');
}

function TakeAttendance() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [meetings, setMeetings] = useState([]);
  const [meetingId, setMeetingId] = useState(location.state?.meetingId || '');
  const [meeting, setMeeting] = useState({
    id: '',
    title: '',
    date: '',
    time: '',
    status: '',
  });
  const [rows, setRows] = useState([]);
  const [checked, setChecked] = useState([]);
  const [listFilter, setListFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [closedDialog, setClosedDialog] = useState({ open: false, message: '' });
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

  const applyRoster = (rosterRows) => {
    const next = rosterRows || [];
    setRows(next);
    setChecked(next.filter((r) => r.status === 'present').map((r) => r.id));
  };

  const clearMeetingSelection = () => {
    setMeetingId('');
    setMeeting({ id: '', title: '', date: '', time: '', status: '' });
    applyRoster([]);
  };

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await axios.get(GET_ATTENDANCE_MEETINGS, { headers: authHeaders });
      if (!res.data.success) {
        notify(res.data.message || 'Failed to load meetings.', 'error');
        return [];
      }
      const list = res.data.data || [];
      setMeetings(list);
      return list;
    } catch (err) {
      handleApiError(err, navigate);
      notify(apiMessage(err, 'Failed to load meetings.'), 'error');
      return [];
    }
  }, [token, navigate]);

  const handleClosedMeeting = useCallback(
    async (message, closedId) => {
      setClosedDialog({
        open: true,
        message: message || CLOSED_MEETING_MSG,
      });
      const list = await fetchMeetings();
      const idNum = Number(closedId);
      const stillThere = list.some((m) => Number(m.id) === idNum);
      if (!stillThere) {
        clearMeetingSelection();
      }
    },
    [fetchMeetings]
  );

  const fetchRoster = useCallback(
    async (id) => {
      if (!id) {
        setMeeting({ id: '', title: '', date: '', time: '', status: '' });
        applyRoster([]);
        return;
      }
      setLoading(true);
      try {
        const res = await axios.get(GET_ATTENDANCE_ROSTER(id), { headers: authHeaders });
        if (!res.data.success) {
          if (isClosedMeetingError(res.data.message)) {
            await handleClosedMeeting(res.data.message, id);
            return;
          }
          notify(res.data.message || 'Failed to load roster.', 'error');
          return;
        }
        const payload = res.data.data || {};
        setMeeting(
          payload.meeting || {
            id,
            title: '',
            date: '',
            time: '',
            status: '',
          }
        );
        applyRoster(payload.rows || []);
        setSearch('');
        setListFilter('all');
        setCurrentPage(1);
      } catch (err) {
        handleApiError(err, navigate);
        if (isClosedMeetingError(err)) {
          await handleClosedMeeting(apiMessage(err, CLOSED_MEETING_MSG), id);
        } else {
          notify(apiMessage(err, 'Failed to load roster.'), 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [token, navigate, handleClosedMeeting]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchMeetings();
      if (cancelled) return;
      const preferred = Number(location.state?.meetingId);
      const initial =
        (preferred && list.find((m) => Number(m.id) === preferred)?.id) ||
        list[0]?.id ||
        '';
      setMeetingId(initial || '');
      if (initial) {
        await fetchRoster(initial);
      } else {
        setLoading(false);
        applyRoster([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMeetings, fetchRoster, location.state?.meetingId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, listFilter]);

  const pageSize = isMobile ? CARD_ITEMS_PER_PAGE : TABLE_ITEMS_PER_PAGE;

  const counts = useMemo(() => {
    const present = rows.filter((r) => r.status === 'present').length;
    return {
      present,
      absent: rows.length - present,
      total: rows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (listFilter === 'present' && r.status !== 'present') return false;
      if (listFilter === 'absent' && r.status !== 'absent') return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || String(r.id).includes(q);
    });
  }, [rows, search, listFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginated = filtered.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const toggleChecked = (id) => {
    setChecked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const pageIds = paginated.map((r) => r.id);
  const pageAllChecked =
    pageIds.length > 0 && pageIds.every((id) => checked.includes(id));
  const pageSomeChecked = pageIds.some((id) => checked.includes(id));

  const togglePage = (select) => {
    if (select) {
      setChecked((prev) => [...new Set([...prev, ...pageIds])]);
    } else {
      setChecked((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  const applyCheckedAttendance = async () => {
    if (!meetingId || !rows.length) return;
    setBusy(true);
    try {
      const checkedSet = new Set(checked);
      const items = rows.map((r) => ({
        memberCode: r.id,
        status: checkedSet.has(r.id) ? 'present' : 'absent',
      }));
      const res = await axios.post(
        MARK_ATTENDANCE,
        { meetingId: Number(meetingId), items },
        { headers: authHeaders }
      );
      if (!res.data.success) {
        if (isClosedMeetingError(res.data.message)) {
          await handleClosedMeeting(res.data.message, meetingId);
          return;
        }
        notify(res.data.message || 'Failed to mark attendance.', 'error');
        return;
      }
      applyRoster(res.data.data?.rows || []);
      const nextStatus = res.data.data?.meetingStatus || 'ongoing';
      setMeeting((prev) => ({ ...prev, status: nextStatus }));
      setMeetings((prev) =>
        prev.map((m) =>
          Number(m.id) === Number(meetingId) ? { ...m, status: nextStatus } : m
        )
      );
      notify(res.data.message || 'Attendance applied.');
      fetchMeetings();
    } catch (err) {
      handleApiError(err, navigate);
      if (isClosedMeetingError(err)) {
        await handleClosedMeeting(apiMessage(err, CLOSED_MEETING_MSG), meetingId);
      } else {
        notify(apiMessage(err, 'Failed to mark attendance.'), 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleMeetingChange = async (nextId) => {
    setMeetingId(nextId);
    await fetchRoster(nextId);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    setTimeout(() => {
      document.getElementById('attendance-list-anchor')?.scrollIntoView({
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
          Showing {filtered.length === 0 ? 0 : startIndex + 1}-{endIndex} of {filtered.length}{' '}
          members
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

  const MemberCard = ({ row }) => {
    const isChecked = checked.includes(row.id);
    return (
      <Paper
        elevation={0}
        sx={{
          ...panelSx,
          p: 1.25,
          borderLeft: `3px solid ${isChecked ? T.brand : T.borderStrong}`,
        }}
      >
        <Box
          sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', cursor: 'pointer' }}
          onClick={() => toggleChecked(row.id)}
        >
          <Checkbox
            size="small"
            checked={isChecked}
            onChange={() => toggleChecked(row.id)}
            onClick={(e) => e.stopPropagation()}
            sx={{ p: 0.5, mt: -0.25 }}
            inputProps={{ 'aria-label': `Present ${row.name}` }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              {statusChip(row.status)}
              {isChecked && row.status !== 'present' && (
                <Chip
                  size="small"
                  label="Will mark present"
                  sx={{ bgcolor: '#FFF8E1', color: T.warn, fontWeight: 700, borderRadius: 1 }}
                />
              )}
            </Stack>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {row.name}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, fontFamily: 'monospace' }}>
              {row.id}
            </Typography>
            {row.recordedAt && (
              <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.5 }}>
                Recorded {row.recordedAt}
              </Typography>
            )}
          </Box>
        </Box>
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

      <Alert
        severity="info"
        sx={{
          mb: 1.5,
          borderRadius: 2,
          border: `1px solid ${T.borderStrong}`,
          bgcolor: T.brandMuted,
          color: T.text,
          py: { xs: 0.5, sm: 1 },
          '& .MuiAlert-icon': { color: T.brand },
          '& .MuiAlert-message': { fontSize: { xs: '0.8rem', sm: '0.875rem' } },
        }}
      >
        Check members who are Present, then click Mark selected. Unchecked members are marked
        Absent. Many members are saved in one request.
      </Alert>

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <HowToRegIcon sx={{ color: T.brand, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 700, color: T.text }}>Take Attendance</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 280 } }}>
            <InputLabel id="meeting-select-label">Meeting</InputLabel>
            <Select
              labelId="meeting-select-label"
              label="Meeting"
              value={meetingId || ''}
              onChange={(e) => handleMeetingChange(e.target.value)}
              disabled={!meetings.length || loading}
            >
              {meetings.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.title}
                  {m.status === 'ongoing' ? ' (Ongoing)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ mt: 1.5 }}
          alignItems={{ sm: 'center' }}
          divider={!isXs ? <Divider orientation="vertical" flexItem /> : undefined}
        >
          {meetingStatusChip(meeting.status)}
          <Typography
            sx={{
              fontSize: '0.85rem',
              color: T.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <EventIcon sx={{ fontSize: 16 }} />
            {formatDisplayDate(meeting.date)}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.85rem',
              color: T.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <AccessTimeIcon sx={{ fontSize: 16 }} />
            {formatTime(meeting.time)}
          </Typography>
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
        <Stat label="Present" value={counts.present} accent={T.brand} />
        <Stat label="Absent" value={counts.absent} accent={T.warn} />
        <Stat label="Total" value={counts.total} />
      </Box>

      {/* List toolbar */}
      <Paper
        id="attendance-list-anchor"
        elevation={0}
        sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, mb: 1.5 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <TextField
            size="small"
            placeholder="Search name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: T.textMuted, fontSize: 18 }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ width: { xs: '100%', sm: 280 } }}
          />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {['all', 'absent', 'present'].map((key) => (
              <Chip
                key={key}
                label={key === 'all' ? 'All' : key === 'absent' ? 'Absent' : 'Present'}
                onClick={() => setListFilter(key)}
                sx={{
                  fontWeight: 700,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor: listFilter === key ? T.brandMuted : T.surfaceAlt,
                  color: listFilter === key ? T.brand : T.textMuted,
                }}
              />
            ))}
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ mt: 1.25 }}
          alignItems={{ sm: 'center' }}
        >
          <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
            {checked.length} checked (Present)
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={<DescriptionOutlinedIcon />}
            onClick={() => setReportOpen(true)}
            disabled={!rows.length || busy}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: T.brand,
              borderColor: T.borderStrong,
              borderRadius: 1.5,
              width: { xs: '100%', sm: 'auto' },
              '&:hover': { borderColor: T.brand, bgcolor: T.brandMuted },
            }}
          >
            View report
          </Button>
          <Button
            startIcon={
              busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <HowToRegIcon />
            }
            onClick={applyCheckedAttendance}
            disabled={busy || !meetingId || !rows.length}
            sx={{
              ...brandBtnSx,
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            Mark selected
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : !meetings.length ? (
        <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center', color: T.textMuted }}>
          No scheduled or ongoing meetings. Create a meeting, or reopen Take Attendance after
          closing finished ones from Meetings.
        </Paper>
      ) : isMobile ? (
        <>
          <Stack spacing={1}>
            {paginated.map((row) => (
              <MemberCard key={row.id} row={row} />
            ))}
            {!filtered.length && (
              <Paper elevation={0} sx={{ ...panelSx, p: 4, textAlign: 'center', color: T.textMuted }}>
                No members match this filter.
              </Paper>
            )}
          </Stack>
          {filtered.length > 0 && renderPagination(true)}
        </>
      ) : (
        <>
          <TableContainer component={Paper} elevation={0} sx={panelSx}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                  <TableCell padding="checkbox" sx={{ width: 72 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Checkbox
                        size="small"
                        indeterminate={pageSomeChecked && !pageAllChecked}
                        checked={pageAllChecked}
                        onChange={(e) => togglePage(e.target.checked)}
                        inputProps={{ 'aria-label': 'Check page as Present' }}
                      />
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: T.textMuted }}>
                        Present
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '32%' }}>Member</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '22%' }}>Member ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: '14%' }}>Recorded</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((row) => {
                  const isChecked = checked.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      hover
                      selected={isChecked}
                      onClick={() => toggleChecked(row.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          size="small"
                          checked={isChecked}
                          onChange={() => toggleChecked(row.id)}
                          inputProps={{ 'aria-label': `Present ${row.name}` }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {row.id}
                        </Typography>
                      </TableCell>
                      <TableCell>{statusChip(row.status)}</TableCell>
                      <TableCell sx={{ color: T.textMuted }}>{row.recordedAt || '—'}</TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 6, color: T.textMuted }}>
                      No members match this filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtered.length > 0 && (
            <Box sx={{ mt: 1 }}>{renderPagination(true)}</Box>
          )}
        </>
      )}

      <AttendanceReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Attendance Report — ${meeting.title || 'Meeting'}`}
        rows={mapRosterToReportRows(rows, meeting)}
        filters={{
          Meeting: meeting.title || '—',
          Date: formatDisplayDate(meeting.date),
          Time: formatTime(meeting.time),
          Filter: listFilter === 'all' ? 'All members' : listFilter,
        }}
      />

      <Dialog
        open={closedDialog.open}
        onClose={() => setClosedDialog({ open: false, message: '' })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Meeting closed</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: T.textMuted }}>
            {closedDialog.message || CLOSED_MEETING_MSG}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setClosedDialog({ open: false, message: '' })}
            sx={brandBtnSx}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TakeAttendance;
