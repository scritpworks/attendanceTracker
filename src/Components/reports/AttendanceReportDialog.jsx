import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  CircularProgress,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';

const T = {
  brand: '#2E7D32',
  brandHover: '#1B5E20',
  brandMuted: '#E8F5E9',
  borderStrong: '#D3D3D4',
  surfaceAlt: '#F5F5F5',
  text: '#222222',
  textMuted: '#777777',
};

const DEFAULT_COLUMNS = {
  showMemberName: true,
  showMemberId: true,
  showMeetingDate: true,
  showMeetingTime: true,
  showAttendanceTime: true,
  showStatus: true,
};

/**
 * School-style printable preview dialog (same pattern as JERP AttendanceReportDialog).
 * rows: [{ memberId, memberName, meetingDate, meetingTime, attendanceTime, status }]
 * filters: { Meeting, Date, Status, ... }
 */
function AttendanceReportDialog({ open, onClose, title = 'Attendance Report', rows = [], filters = {} }) {
  const [zoom, setZoom] = useState(1);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSettings, setPrintSettings] = useState({
    showHeader: true,
    showFooter: true,
    showPageNumbers: false,
    showDate: true,
    orientation: 'portrait',
  });
  const [columnVisibility, setColumnVisibility] = useState(DEFAULT_COLUMNS);

  useEffect(() => {
    if (!open) return undefined;
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        #printable-attr-attendance-report, #printable-attr-attendance-report * { visibility: visible; }
        #printable-attr-attendance-report {
          position: absolute;
          left: 0; top: 0; width: 100%; max-width: 1100px; margin: 0 auto; background: #fff;
        }
        @page { size: A4 ${printSettings.orientation}; margin: 7mm 6mm; }
        table { width: 100% !important; border-collapse: collapse !important; }
        th, td {
          font-size: 11px !important;
          border: 1px solid #888 !important;
          padding: 4px 2px !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, [open, printSettings.orientation]);

  const handlePrint = () => {
    setIsPrinting(true);
    setShowPrintDialog(false);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const filterSummary = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v != null && String(v).trim() !== '');
    if (!active.length) return 'No filters applied';
    return active
      .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`)
      .join(' · ');
  }, [filters]);

  const presentCount = rows.filter((r) => String(r.status).toLowerCase() === 'present').length;
  const absentCount = rows.filter((r) => String(r.status).toLowerCase() !== 'present').length;

  const handleColumnToggle = (col) => {
    setColumnVisibility((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth fullScreen={false}>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          '@media print': { display: 'none' },
        }}
      >
        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
        <IconButton onClick={onClose} aria-label="Close report">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 2,
            border: `1px solid ${T.borderStrong}`,
            bgcolor: T.surfaceAlt,
            '@media print': { display: 'none' },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
              gap: 0.5,
            }}
          >
            {[
              ['showMemberName', 'Member name'],
              ['showMemberId', 'Member ID'],
              ['showMeetingDate', 'Meeting date'],
              ['showMeetingTime', 'Meeting time'],
              ['showAttendanceTime', 'Attendance time'],
              ['showStatus', 'Status'],
            ].map(([key, label]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    size="small"
                    checked={columnVisibility[key]}
                    onChange={() => handleColumnToggle(key)}
                    sx={{ color: T.brand, '&.Mui-checked': { color: T.brand } }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.85rem' }}>{label}</Typography>}
              />
            ))}
          </Box>
        </Paper>

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          mb={1.5}
          sx={{ '@media print': { display: 'none' } }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {rows.length} row{rows.length === 1 ? '' : 's'}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Tooltip title="Zoom out">
              <IconButton
                size="small"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                disabled={isPrinting}
              >
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom in">
              <IconButton
                size="small"
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                disabled={isPrinting}
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print settings">
              <IconButton
                size="small"
                onClick={() => setShowPrintDialog(true)}
                disabled={isPrinting}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={
                isPrinting ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />
              }
              onClick={handlePrint}
              disabled={isPrinting || !rows.length}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: T.brand,
                '&:hover': { bgcolor: T.brandHover },
              }}
            >
              {isPrinting ? 'Preparing…' : 'Print'}
            </Button>
          </Stack>
        </Stack>

        <Dialog open={showPrintDialog} onClose={() => setShowPrintDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Print settings</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} sx={{ mt: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printSettings.showHeader}
                    onChange={(e) =>
                      setPrintSettings((p) => ({ ...p, showHeader: e.target.checked }))
                    }
                  />
                }
                label="Show header"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printSettings.showFooter}
                    onChange={(e) =>
                      setPrintSettings((p) => ({ ...p, showFooter: e.target.checked }))
                    }
                  />
                }
                label="Show footer"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={printSettings.showDate}
                    onChange={(e) =>
                      setPrintSettings((p) => ({ ...p, showDate: e.target.checked }))
                    }
                  />
                }
                label="Show print date"
              />
              <FormControl component="fieldset">
                <FormLabel component="legend">Orientation</FormLabel>
                <RadioGroup
                  value={printSettings.orientation}
                  onChange={(e) =>
                    setPrintSettings((p) => ({ ...p, orientation: e.target.value }))
                  }
                >
                  <FormControlLabel value="portrait" control={<Radio />} label="Portrait" />
                  <FormControlLabel value="landscape" control={<Radio />} label="Landscape" />
                </RadioGroup>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPrintDialog(false)} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handlePrint}
              disabled={isPrinting}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: T.brand,
                '&:hover': { bgcolor: T.brandHover },
              }}
            >
              Print
            </Button>
          </DialogActions>
        </Dialog>

        <div
          id="printable-attr-attendance-report"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s',
            maxWidth: 1100,
            margin: '0 auto',
            background: '#fff',
            padding: 8,
          }}
        >
          {printSettings.showHeader && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: T.brand }}>
                Attendance Tracker
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: T.textMuted }}>
                MyApp_ATTR · Attendance report
              </Typography>
            </Box>
          )}

          <Typography
            align="center"
            sx={{
              fontWeight: 800,
              letterSpacing: 1,
              textDecoration: 'underline',
              mb: 1.5,
              fontSize: '1.1rem',
            }}
          >
            {title.toUpperCase()}
          </Typography>

          <Paper
            elevation={0}
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: T.brandMuted,
              borderRadius: 2,
              textAlign: 'center',
              border: `1px solid ${T.borderStrong}`,
            }}
          >
            <Typography sx={{ color: T.brand, fontWeight: 700, fontSize: '0.9rem', mb: 0.25 }}>
              Filters applied
            </Typography>
            <Typography sx={{ color: T.text, fontSize: '0.85rem' }}>{filterSummary}</Typography>
          </Paper>

          <TableContainer sx={{ mb: 1 }}>
            <Table
              size="small"
              sx={{
                borderCollapse: 'collapse',
                border: '1px solid #333',
                '& th, & td': {
                  border: '1px solid #333 !important',
                  py: 0.75,
                  px: 1,
                },
                '& th': { bgcolor: '#f5f5f5', fontWeight: 700 },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell align="center">#</TableCell>
                  {columnVisibility.showMemberName && <TableCell>Member name</TableCell>}
                  {columnVisibility.showMemberId && <TableCell>Member ID</TableCell>}
                  {columnVisibility.showMeetingDate && <TableCell>Meeting date</TableCell>}
                  {columnVisibility.showMeetingTime && <TableCell>Meeting time</TableCell>}
                  {columnVisibility.showAttendanceTime && <TableCell>Attendance time</TableCell>}
                  {columnVisibility.showStatus && <TableCell>Status</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={`${row.memberId}-${row.meetingDate}-${idx}`}>
                    <TableCell align="center">{idx + 1}</TableCell>
                    {columnVisibility.showMemberName && (
                      <TableCell>{row.memberName || '—'}</TableCell>
                    )}
                    {columnVisibility.showMemberId && (
                      <TableCell sx={{ fontFamily: 'monospace' }}>{row.memberId || '—'}</TableCell>
                    )}
                    {columnVisibility.showMeetingDate && (
                      <TableCell>{row.meetingDate || '—'}</TableCell>
                    )}
                    {columnVisibility.showMeetingTime && (
                      <TableCell>{row.meetingTime || '—'}</TableCell>
                    )}
                    {columnVisibility.showAttendanceTime && (
                      <TableCell>{row.attendanceTime || '—'}</TableCell>
                    )}
                    {columnVisibility.showStatus && (
                      <TableCell>
                        {String(row.status || 'absent').charAt(0).toUpperCase() +
                          String(row.status || 'absent').slice(1)}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No records for this report.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ maxWidth: 420, mx: 'auto', mt: 2 }}>
            <Paper elevation={0} sx={{ p: 1.5, bgcolor: T.surfaceAlt, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1, color: T.brand }}>Summary</Typography>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  py: 0.5,
                  borderBottom: '1px dashed #bbb',
                }}
              >
                <Typography>Present</Typography>
                <Typography sx={{ fontWeight: 700 }}>{presentCount}</Typography>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  py: 0.5,
                  borderBottom: '1px dashed #bbb',
                }}
              >
                <Typography>Absent</Typography>
                <Typography sx={{ fontWeight: 700 }}>{absentCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography>Total</Typography>
                <Typography sx={{ fontWeight: 700 }}>{rows.length}</Typography>
              </Box>
            </Paper>
          </Box>

          {printSettings.showFooter && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              {printSettings.showDate && (
                <Typography variant="caption">
                  Printed on: {new Date().toLocaleString()}
                </Typography>
              )}
              <Typography variant="caption">Attendance Tracker</Typography>
            </Box>
          )}
        </div>
      </DialogContent>
      <DialogActions sx={{ '@media print': { display: 'none' } }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AttendanceReportDialog;
