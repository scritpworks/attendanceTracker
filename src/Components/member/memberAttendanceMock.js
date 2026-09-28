/** Mock attendance history for the member My Attendance page (PRD 5.9). */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDays(iso, delta) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Seed mix: past present/absent, cancelled, and future (excluded from held).
 */
export function buildMockMemberHistory() {
  const today = todayIso();
  return [
    {
      id: 1,
      title: 'Weekly General Assembly',
      date: shiftDays(today, -28),
      time: '09:00',
      meetingStatus: 'scheduled',
      status: 'present',
      recordedAt: '09:12',
    },
    {
      id: 2,
      title: 'Committee Briefing',
      date: shiftDays(today, -21),
      time: '14:30',
      meetingStatus: 'scheduled',
      status: 'absent',
      recordedAt: null,
    },
    {
      id: 3,
      title: 'Orientation Session',
      date: shiftDays(today, -14),
      time: '10:00',
      meetingStatus: 'scheduled',
      status: 'present',
      recordedAt: '10:05',
    },
    {
      id: 4,
      title: 'Emergency Committee Call',
      date: shiftDays(today, -10),
      time: '16:00',
      meetingStatus: 'cancelled',
      status: 'absent',
      recordedAt: null,
    },
    {
      id: 5,
      title: 'Monthly Review',
      date: shiftDays(today, -7),
      time: '11:00',
      meetingStatus: 'scheduled',
      status: 'present',
      recordedAt: '11:18',
    },
    {
      id: 6,
      title: 'Welfare Meeting',
      date: shiftDays(today, -3),
      time: '15:00',
      meetingStatus: 'scheduled',
      status: 'absent',
      recordedAt: null,
    },
    {
      id: 7,
      title: 'Midweek Gathering',
      date: today,
      time: '09:30',
      meetingStatus: 'scheduled',
      status: 'present',
      recordedAt: '09:41',
    },
    {
      id: 8,
      title: 'Planning Workshop',
      date: shiftDays(today, 5),
      time: '13:00',
      meetingStatus: 'scheduled',
      status: 'absent',
      recordedAt: null,
    },
    {
      id: 9,
      title: 'Quarterly Assembly',
      date: shiftDays(today, 12),
      time: '10:00',
      meetingStatus: 'scheduled',
      status: 'absent',
      recordedAt: null,
    },
    {
      id: 10,
      title: 'Training Session',
      date: shiftDays(today, -35),
      time: '08:30',
      meetingStatus: 'scheduled',
      status: 'present',
      recordedAt: '08:45',
    },
  ];
}

/** Held = not cancelled and date <= today (PRD). */
export function getHeldMeetings(rows, today = todayIso()) {
  return (rows || [])
    .filter((r) => r.meetingStatus !== 'cancelled' && r.date <= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(a.time || '') < String(b.time || '') ? 1 : -1;
    });
}

export function summarizeAttendance(held) {
  const total = held.length;
  const present = held.filter((r) => r.status === 'present').length;
  const absent = total - present;
  const percentage = total === 0 ? 0 : Math.round((present / total) * 100);
  return { total, present, absent, percentage };
}
