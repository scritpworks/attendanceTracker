import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PercentIcon from '@mui/icons-material/Percent';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { GET_MEMBER_ATTENDANCE, handleApiError } from '../apiConfig';
import SnackbarMessage from '../SnackbarMessage';

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
  warn: '#E65100',
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

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
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

/**
 * PRD 5.9 — member's own attendance (read-only, session identity).
 */
function MyAttendance() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [from, setFrom] = useState(() => daysAgoIso(90));
  const [to, setTo] = useState(() => todayIso());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [applied, setApplied] = useState({
    from: daysAgoIso(90),
    to: todayIso(),
    search: '',
    status: 'all',
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    present: 0,
    absent: 0,
    percentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const apiMessage = (err, fallback) =>
    err?.response?.data?.message || err?.response?.data?.error || fallback;

  const fetchAttendance = useCallback(
    async (filters) => {
      setLoading(true);
      try {
        const res = await axios.get(GET_MEMBER_ATTENDANCE, {
          headers: authHeaders,
          params: {
            from: filters.from || undefined,
            to: filters.to || undefined,
            search: filters.search?.trim() || undefined,
            status: filters.status || 'all',
          },
        });
        if (!res.data.success) {
          notify(res.data.message || 'Failed to load attendance.', 'error');
          setRows([]);
          setSummary({ total: 0, present: 0, absent: 0, percentage: 0 });
          return;
        }
        const payload = res.data.data || {};
        setRows(payload.held || payload.rows || []);
        setSummary(
          payload.summary || { total: 0, present: 0, absent: 0, percentage: 0 }
        );
      } catch (err) {
        handleApiError(err, navigate);
        notify(apiMessage(err, 'Failed to load attendance.'), 'error');
        setRows([]);
        setSummary({ total: 0, present: 0, absent: 0, percentage: 0 });
      } finally {
        setLoading(false);
      }
    },
    [token, navigate]
  );

  useEffect(() => {
    fetchAttendance(applied);
  }, [fetchAttendance, applied]);

  const applyFilters = () => {
    if (from && to && from > to) {
      notify('From date cannot be after to date.', 'error');
      return;
    }
    setApplied({
      from,
      to,
      search: search.trim(),
      status,
    });
  };

  const resetFilters = () => {
    const next = {
      from: daysAgoIso(90),
      to: todayIso(),
      search: '',
      status: 'all',
    };
    setFrom(next.from);
    setTo(next.to);
    setSearch(next.search);
    setStatus(next.status);
    setApplied(next);
  };

  const StatCard = ({ label, value, icon, accent }) => (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 }, height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: T.brandMuted,
            color: accent || T.brand,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', color: T.textMuted, fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.25rem', sm: '1.5rem' },
              fontWeight: 800,
              color: T.text,
              lineHeight: 1.2,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );

  return (
    <Box
      sx={{
        p: { xs: 1.25, sm: 2 },
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
          <Box>
            <Typography sx={{ fontWeight: 800, color: T.text, fontSize: '1.15rem' }}>
              My Attendance
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: T.textMuted }}>
              Read-only history. Cancelled and future meetings are excluded from totals.
            </Typography>
          </Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => fetchAttendance(applied)}
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
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 } }}>
            <InputLabel id="member-status-filter">Status</InputLabel>
            <Select
              labelId="member-status-filter"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="present">Present</MenuItem>
              <MenuItem value="absent">Absent</MenuItem>
            </Select>
          </FormControl>
          <TextField
            size="small"
            placeholder="Search meeting"
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
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
          gap: 1,
          mb: 1.5,
        }}
      >
        <StatCard
          label="Meetings held"
          value={summary.total}
          icon={<EventIcon fontSize="small" />}
        />
        <StatCard
          label="Present"
          value={summary.present}
          icon={<CheckCircleIcon fontSize="small" />}
          accent={T.brand}
        />
        <StatCard
          label="Absent"
          value={summary.absent}
          icon={<CancelIcon fontSize="small" />}
          accent={T.warn}
        />
        <StatCard
          label="Attendance %"
          value={`${summary.percentage}%`}
          icon={<PercentIcon fontSize="small" />}
        />
      </Box>

      <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 } }}>
        <Typography sx={{ fontWeight: 800, mb: 0.35 }}>History</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mb: 1.5 }}>
          One row per held meeting — no edits
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress sx={{ color: T.brand }} />
          </Box>
        ) : !rows.length ? (
          <Typography sx={{ color: T.textMuted, textAlign: 'center', py: 4 }}>
            No held meetings match these filters.
          </Typography>
        ) : isMobile ? (
          <Stack spacing={1}>
            {rows.map((row) => (
              <Paper
                key={row.id}
                elevation={0}
                sx={{
                  p: 1.25,
                  border: `1px solid ${T.borderStrong}`,
                  borderRadius: 1.5,
                  borderLeft: `3px solid ${
                    row.status === 'present' ? T.brand : T.borderStrong
                  }`,
                }}
              >
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                  {statusChip(row.status)}
                  <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>
                    {row.recordedAt || '—'}
                  </Typography>
                </Stack>
                <Typography sx={{ fontWeight: 700, mb: 0.35 }}>{row.title}</Typography>
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.35,
                    }}
                  >
                    <EventIcon sx={{ fontSize: 14 }} />
                    {formatDisplayDate(row.date)}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      color: T.textMuted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.35,
                    }}
                  >
                    <AccessTimeIcon sx={{ fontSize: 14 }} />
                    {formatTime(row.time)}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                  <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Recorded</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{row.title}</TableCell>
                    <TableCell>{formatDisplayDate(row.date)}</TableCell>
                    <TableCell>{formatTime(row.time)}</TableCell>
                    <TableCell>{statusChip(row.status)}</TableCell>
                    <TableCell sx={{ color: T.textMuted }}>
                      {row.status === 'present' ? row.recordedAt || '—' : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}

export default MyAttendance;
