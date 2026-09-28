import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from './AuthContext';
import {
  GET_MEMBERS,
  GET_MEETINGS,
  GET_ATTENDANCE_MEETINGS,
  GET_ATTENDANCE_ROSTER,
  handleApiError,
} from './apiConfig';
import SnackbarMessage from './SnackbarMessage';

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
  absent: '#FB8C00',
};

const panelSx = {
  borderRadius: 2,
  border: `1px solid ${T.borderStrong}`,
  bgcolor: T.surface,
  boxShadow: 'none',
};

const chartTooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${T.borderStrong}`,
  fontSize: 12,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function shortMeetingLabel(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Dashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [attendanceMeetings, setAttendanceMeetings] = useState([]);
  const [recentRecords, setRecentRecords] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'error',
  });

  const notify = (message, severity = 'error') =>
    setSnackbar({ open: true, message, severity });

  const stats = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'active').length;
    const activeMeetings = meetings.filter(
      (m) => m.status === 'scheduled' || m.status === 'ongoing'
    );
    const today = todayIso();
    const upcoming = activeMeetings.filter((m) => m.date >= today).length;
    return {
      totalMembers: members.length,
      activeMembers,
      inactiveMembers: members.length - activeMembers,
      scheduledMeetings: activeMeetings.length,
      upcomingMeetings: upcoming,
    };
  }, [members, meetings]);

  /** Line chart: present / absent counts across recent held meetings (school-style trend). */
  const attendanceTrend = useMemo(() => {
    const today = todayIso();
    return [...attendanceMeetings]
      .filter((m) => m.date <= today)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return String(a.time || '') < String(b.time || '') ? -1 : 1;
      })
      .slice(-8)
      .map((m) => {
        const total = Number(m.memberCount) || 0;
        const present = Number(m.presentCount) || 0;
        const absent = Math.max(0, total - present);
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;
        return {
          label: shortMeetingLabel(m.date),
          title: m.title,
          present,
          absent,
          rate,
          total,
        };
      });
  }, [attendanceMeetings]);

  /** Pie chart: active vs inactive members (membership health). */
  const memberMix = useMemo(() => {
    const data = [
      { name: 'Active', value: stats.activeMembers, color: T.brand },
      { name: 'Inactive', value: stats.inactiveMembers, color: T.danger },
    ].filter((d) => d.value > 0);
    return data.length ? data : [{ name: 'No members', value: 1, color: T.borderStrong }];
  }, [stats.activeMembers, stats.inactiveMembers]);

  const memberMixEmpty = stats.totalMembers === 0;

  const buildRecentRecords = useCallback(
    async (meetingList) => {
      const today = todayIso();
      const ordered = [...(meetingList || [])].sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return String(a.time || '') < String(b.time || '') ? 1 : -1;
      });

      const candidates = ordered.filter((m) => m.date <= today).slice(0, 3);
      const fallback = candidates.length ? candidates : ordered.slice(0, 2);

      const recent = [];
      for (const meeting of fallback) {
        try {
          const res = await axios.get(GET_ATTENDANCE_ROSTER(meeting.id), {
            headers: authHeaders,
          });
          if (!res.data.success) continue;
          const rows = res.data.data?.rows || [];
          rows
            .filter((r) => r.status === 'present')
            .forEach((r) => {
              recent.push({
                key: `${meeting.id}-${r.id}`,
                memberName: r.name,
                memberId: r.id,
                meetingTitle: meeting.title,
                meetingDate: meeting.date,
                recordedAt: r.recordedAt || '',
              });
            });
        } catch {
          /* skip */
        }
        if (recent.length >= 12) break;
      }

      recent.sort((a, b) => {
        if (a.meetingDate !== b.meetingDate) {
          return a.meetingDate < b.meetingDate ? 1 : -1;
        }
        return String(b.recordedAt || '') > String(a.recordedAt || '') ? 1 : -1;
      });

      setRecentRecords(recent.slice(0, 12));
    },
    [token]
  );

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, meetingsRes, attMeetingsRes] = await Promise.all([
        axios.get(GET_MEMBERS, { headers: authHeaders }),
        axios.get(GET_MEETINGS, { headers: authHeaders }),
        axios.get(GET_ATTENDANCE_MEETINGS, { headers: authHeaders }),
      ]);

      const memberList = membersRes.data.success ? membersRes.data.data || [] : [];
      const meetingList = meetingsRes.data.success ? meetingsRes.data.data || [] : [];
      const attList = attMeetingsRes.data.success
        ? attMeetingsRes.data.data || []
        : [];

      setMembers(memberList);
      setMeetings(meetingList);
      setAttendanceMeetings(attList);
      await buildRecentRecords(attList);
    } catch (err) {
      handleApiError(err, navigate);
      notify(err.response?.data?.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token, navigate, buildRecentRecords]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const StatCard = ({ label, value, icon, accent }) => (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.5, sm: 2 }, height: '100%' }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            width: 40,
            height: 40,
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
          <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: '1.4rem', sm: '1.75rem' },
              fontWeight: 800,
              color: T.text,
              lineHeight: 1.2,
              mt: 0.25,
            }}
          >
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );

  const AttendanceTrendTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    return (
      <Paper elevation={0} sx={{ ...panelSx, p: 1.25, minWidth: 160 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>
          {row?.title || row?.label}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: T.brand }}>
          Present: {row?.present ?? 0}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: T.absent }}>
          Absent: {row?.absent ?? 0}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: T.textMuted, mt: 0.35 }}>
          Rate: {row?.rate ?? 0}%
        </Typography>
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
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <DashboardIcon sx={{ color: T.brand }} />
            <Box>
              <Typography sx={{ fontWeight: 800, color: T.text }}>Dashboard</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                Welcome{user?.firstName ? `, ${user.firstName}` : ''}. Live totals from your
                register.
              </Typography>
            </Box>
          </Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchDashboard}
            disabled={loading}
            variant="outlined"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: T.brand,
              borderColor: T.borderStrong,
              borderRadius: 1.5,
              alignSelf: { xs: 'stretch', sm: 'auto' },
              '&:hover': { borderColor: T.brand, bgcolor: T.brandMuted },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: T.brand }} />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                md: 'repeat(4, 1fr)',
              },
              gap: 1.25,
              mb: 1.5,
            }}
          >
            <StatCard
              label="Registered members"
              value={stats.totalMembers}
              icon={<PeopleIcon fontSize="small" />}
            />
            <StatCard
              label="Active members"
              value={stats.activeMembers}
              icon={<PeopleIcon fontSize="small" />}
            />
            <StatCard
              label="Scheduled meetings"
              value={stats.scheduledMeetings}
              icon={<EventIcon fontSize="small" />}
            />
            <StatCard
              label="Upcoming meetings"
              value={stats.upcomingMeetings}
              icon={<EventIcon fontSize="small" />}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr' },
              gap: 1.25,
              mb: 1.5,
              alignItems: 'stretch',
            }}
          >
            {/* Line chart — attendance trend (school Finance trends style) */}
            <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.5, sm: 2 } }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ mb: 0.5 }}
              >
                <Typography sx={{ fontWeight: 800 }}>Attendance trend</Typography>
                {attendanceTrend.length > 0 && (
                  <Chip
                    size="small"
                    label={`Avg ${Math.round(
                      attendanceTrend.reduce((s, r) => s + r.rate, 0) / attendanceTrend.length
                    )}%`}
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      bgcolor: T.brandMuted,
                      color: T.brand,
                    }}
                  />
                )}
              </Stack>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mb: 1.5 }}>
                Present vs absent across recent held meetings
              </Typography>

              {!attendanceTrend.length ? (
                <Typography
                  sx={{ py: 8, textAlign: 'center', fontSize: '0.85rem', color: T.textMuted }}
                >
                  No held meetings with attendance yet.
                </Typography>
              ) : (
                <Box sx={{ height: { xs: 240, sm: 280 }, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={attendanceTrend}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={T.border} />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: T.textMuted }}
                        padding={{ left: 8, right: 8 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                        tick={{ fontSize: 10, fill: T.textMuted }}
                      />
                      <RechartsTooltip content={<AttendanceTrendTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={28}
                        wrapperStyle={{ fontSize: 12, color: T.textMuted }}
                      />
                      <Line
                        type="monotone"
                        dataKey="present"
                        name="Present"
                        stroke={T.brand}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: T.brand, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="absent"
                        name="Absent"
                        stroke={T.absent}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: T.absent, strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            {/* Pie chart — member mix (school Payment mix style) */}
            <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.5, sm: 2 } }}>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Member status</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mb: 1.5 }}>
                Active vs inactive on the register
              </Typography>

              <Box
                sx={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberMix}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={memberMixEmpty ? 0 : 3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {memberMix.map((entry, i) => (
                        <Cell key={entry.name + i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name) => [
                        memberMixEmpty ? '—' : value,
                        name,
                      ]}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {(memberMixEmpty
                  ? [{ name: 'No members yet', value: 0, color: T.borderStrong }]
                  : [
                      { name: 'Active', value: stats.activeMembers, color: T.brand },
                      { name: 'Inactive', value: stats.inactiveMembers, color: T.danger },
                    ]
                ).map((d) => (
                  <Stack
                    key={d.name}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: d.color,
                          flexShrink: 0,
                        }}
                      />
                      <Typography sx={{ fontSize: '0.78rem', color: T.text }}>{d.name}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: T.brand }}>
                      {d.value}
                      {!memberMixEmpty && stats.totalMembers > 0
                        ? ` · ${Math.round((d.value / stats.totalMembers) * 100)}%`
                        : ''}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ ...panelSx, p: { xs: 1.25, sm: 1.5 } }}>
            <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Recent attendance</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mb: 1.5 }}>
              Latest Present marks from recent held meetings
            </Typography>

            {!recentRecords.length ? (
              <Typography sx={{ color: T.textMuted, py: 2, textAlign: 'center' }}>
                No recent Present records yet. Mark attendance to see them here.
              </Typography>
            ) : isMobile ? (
              <Stack spacing={1}>
                {recentRecords.map((r) => (
                  <Paper
                    key={r.key}
                    elevation={0}
                    sx={{
                      p: 1.25,
                      border: `1px solid ${T.borderStrong}`,
                      borderRadius: 1.5,
                    }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip
                        size="small"
                        label="Present"
                        sx={{
                          bgcolor: T.brandMuted,
                          color: T.brand,
                          fontWeight: 700,
                          borderRadius: 1,
                        }}
                      />
                      <Typography sx={{ fontSize: '0.75rem', color: T.textMuted }}>
                        {r.recordedAt || '—'}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700 }}>{r.memberName}</Typography>
                    <Typography
                      sx={{ fontSize: '0.8rem', color: T.textMuted, fontFamily: 'monospace' }}
                    >
                      {r.memberId}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: T.textMuted, mt: 0.5 }}>
                      {r.meetingTitle} · {formatDisplayDate(r.meetingDate)}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: T.surfaceAlt }}>
                      <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Member ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Meeting</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Recorded</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentRecords.map((r) => (
                      <TableRow key={r.key} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{r.memberName}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {r.memberId}
                        </TableCell>
                        <TableCell>{r.meetingTitle}</TableCell>
                        <TableCell>{formatDisplayDate(r.meetingDate)}</TableCell>
                        <TableCell sx={{ color: T.textMuted }}>{r.recordedAt || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label="Present"
                            sx={{
                              bgcolor: T.brandMuted,
                              color: T.brand,
                              fontWeight: 700,
                              borderRadius: 1,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}

export default Dashboard;
