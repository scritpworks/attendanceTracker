/** Shared mock roster for attendance reports (aligned with Take Attendance seed). */

export const REPORT_MEMBER_SEED = [
  ['1000000001', 'Ama Mensah', 'absent'],
  ['1000000002', 'Kwame Boateng', 'present'],
  ['1000000003', 'Efua Asante', 'absent'],
  ['1000000004', 'Kojo Owusu', 'present'],
  ['1000000005', 'Abena Darko', 'absent'],
  ['1000000006', 'Yaw Adjei', 'absent'],
  ['1000000007', 'Akosua Frimpong', 'present'],
  ['1000000008', 'Kofi Amponsah', 'absent'],
  ['1000000009', 'Adwoa Sarpong', 'absent'],
  ['1000000010', 'Nana Osei', 'absent'],
  ['1000000011', 'Serwaa Boateng', 'absent'],
  ['1000000012', 'Fiifi Mensah', 'present'],
  ['1000000013', 'Maame Esi', 'absent'],
  ['1000000014', 'Kwesi Appiah', 'absent'],
  ['1000000015', 'Ama Serwaa', 'absent'],
  ['1000000016', 'Papa Yaw', 'present'],
  ['1000000017', 'Akua Nyarko', 'absent'],
  ['1000000018', 'Kwadwo Manu', 'absent'],
  ['1000000019', 'Afia Konadu', 'absent'],
  ['1000000020', 'Kwabena Sarpong', 'absent'],
  ['1000000021', 'Esi Badu', 'present'],
  ['1000000022', 'Kojo Bonsu', 'absent'],
  ['1000000023', 'Abena Korkor', 'absent'],
  ['1000000024', 'Yaw Poku', 'absent'],
  ['1000000025', 'Adwoa Mansa', 'absent'],
];

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
  const [h, m] = String(hhmm).split(':').map(Number);
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Build PRD-shaped report rows for one or more meetings. */
export function buildAttendanceReportRows(meetings = []) {
  const list = Array.isArray(meetings) ? meetings : [meetings];
  const rows = [];
  list.forEach((meeting) => {
    if (!meeting || meeting.status === 'cancelled') return;
    REPORT_MEMBER_SEED.forEach(([memberId, memberName, status]) => {
      rows.push({
        memberId,
        memberName,
        meetingDate: formatDisplayDate(meeting.date),
        meetingTime: formatTime(meeting.time),
        attendanceTime: status === 'present' ? '14:35' : '',
        status,
        meetingTitle: meeting.title,
      });
    });
  });
  return rows;
}

/** Map live Take Attendance roster rows into report shape. */
export function mapRosterToReportRows(roster = [], meeting = {}) {
  return roster.map((r) => ({
    memberId: r.id,
    memberName: r.name,
    meetingDate: formatDisplayDate(meeting.date),
    meetingTime: formatTime(meeting.time),
    attendanceTime: r.recordedAt || '',
    status: r.status,
  }));
}
