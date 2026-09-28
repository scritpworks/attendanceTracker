export const BASE_URL = String(
  (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.apiUrl) ||
    'http://localhost:5001'
).replace(/\/$/, '');

export const handleApiError = (error, navigate) => {
  if (error.response) {
    if (error.response.status === 401 || error.response.status === 403) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch {
        /* ignore */
      }
      if (navigate) navigate('/login');
    } else {
      console.error(
        'API Error:',
        error.response.data?.message || error.response.data?.error || error.response.statusText
      );
    }
  } else {
    console.error('Network or other error:', error);
  }
};

export const LOGIN_ENDPOINT = `${BASE_URL}/api/login`;
export const MEMBER_LOGIN_ENDPOINT = `${BASE_URL}/api/member/login`;
export const UPDATE_USER_PASSWORD = `${BASE_URL}/api/user/profile/password`;
export const UPDATE_MEMBER_PASSWORD = `${BASE_URL}/api/member/profile/password`;
export const GET_USER_FRESH = `${BASE_URL}/api/user/fresh`;
export const GET_MEMBER_FRESH = `${BASE_URL}/api/member/fresh`;
export const GET_MEMBER_ATTENDANCE = `${BASE_URL}/api/member/attendance`;
export const GET_USER_MENU = `${BASE_URL}/api/rbac/user-menu`;
export const GET_MENU_ITEMS = `${BASE_URL}/api/rbac/menu-items`;
export const GET_MENU_GROUPS = `${BASE_URL}/api/rbac/menu-groups`;
export const GET_PERMISSIONS = `${BASE_URL}/api/rbac/permissions`;
export const CHECK_ACCESS = `${BASE_URL}/api/rbac/check-access`;
export const ASSIGN_MENU_PERMISSION = `${BASE_URL}/api/rbac/assign-menu-permission`;
export const REMOVE_MENU_PERMISSION = `${BASE_URL}/api/rbac/remove-menu-permission`;
export const GET_ROLE_MENU_PERMISSIONS = `${BASE_URL}/api/rbac/role-menu-permissions`;
export const GET_ROLE_MENU_MATRIX = `${BASE_URL}/api/rbac/role-menu-matrix`;
export const BULK_ASSIGN_MENU_PERMISSIONS = `${BASE_URL}/api/rbac/bulk-assign-menu-permissions`;

export const GET_ROLES = `${BASE_URL}/api/roles`;
export const GET_ROLE = (roleId) => `${BASE_URL}/api/roles/${roleId}`;
export const ADD_ROLE = `${BASE_URL}/api/roles/add`;
export const UPDATE_ROLE = `${BASE_URL}/api/roles/update`;
export const DELETE_ROLE = `${BASE_URL}/api/roles/delete`;
export const GET_ROLE_PERMISSIONS = (roleId) =>
  `${BASE_URL}/api/roles/${roleId}/permissions`;
export const UPDATE_ROLE_PERMISSIONS = (roleId) =>
  `${BASE_URL}/api/roles/${roleId}/permissions`;

export const GET_STAFF = `${BASE_URL}/api/staff`;
export const CREATE_STAFF = `${BASE_URL}/api/staff/create`;
export const UPDATE_STAFF = `${BASE_URL}/api/staff/update`;
export const DELETE_STAFF = `${BASE_URL}/api/staff/delete`;
export const ACTIVATE_STAFF = `${BASE_URL}/api/staff/activate`;
export const DEACTIVATE_STAFF = `${BASE_URL}/api/staff/deactivate`;
export const RESET_STAFF_PASSWORD = `${BASE_URL}/api/staff/reset-password`;

export const GET_MEMBERS = `${BASE_URL}/api/members`;
export const GET_MEMBER = (id) => `${BASE_URL}/api/members/${id}`;
export const CREATE_MEMBER = `${BASE_URL}/api/members/create`;
export const UPDATE_MEMBER = `${BASE_URL}/api/members/update`;
export const ACTIVATE_MEMBER = `${BASE_URL}/api/members/activate`;
export const DEACTIVATE_MEMBER = `${BASE_URL}/api/members/deactivate`;
export const RESET_MEMBER_PASSWORD = `${BASE_URL}/api/members/reset-password`;

export const GET_MEETINGS = `${BASE_URL}/api/meetings`;
export const GET_MEETING = (id) => `${BASE_URL}/api/meetings/${id}`;
export const CREATE_MEETING = `${BASE_URL}/api/meetings/create`;
export const UPDATE_MEETING = `${BASE_URL}/api/meetings/update`;
export const CANCEL_MEETING = `${BASE_URL}/api/meetings/cancel`;
export const CLOSE_MEETING = `${BASE_URL}/api/meetings/close`;
export const REOPEN_MEETING = `${BASE_URL}/api/meetings/reopen`;
export const GET_MEETINGS_REPORT = `${BASE_URL}/api/meetings/report`;
export const GENERATE_MEETINGS_REPORT = `${BASE_URL}/api/meetings/report`;
export const GET_MEETING_REPORT = (id) => `${BASE_URL}/api/meetings/report/${id}`;

export const GET_ATTENDANCE_MEETINGS = `${BASE_URL}/api/attendance/meetings`;
export const GET_ATTENDANCE_ROSTER = (meetingId) =>
  `${BASE_URL}/api/attendance/meeting/${meetingId}`;
export const GET_ATTENDANCE_HISTORY = `${BASE_URL}/api/attendance/history`;
export const MARK_ATTENDANCE = `${BASE_URL}/api/attendance/mark`;
export const MARK_ATTENDANCE_ONE = `${BASE_URL}/api/attendance/mark-one`;
