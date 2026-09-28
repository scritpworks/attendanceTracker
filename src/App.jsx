import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import Login from './Components/Login';
import FinalSide from './Components/layout/FinalSide';
import ProtectedRoute from './Components/security/ProtectedRoute';
import PlaceholderPage from './Components/PlaceholderPage';
import NotFound from './Components/NotFound';
import SystemRoles from './Components/SystemRoles';
import RolePermissions from './Components/rbac/RolePermissions';
import StaffRegistration from './Components/StaffRegistration';
import Meetings from './Components/Meetings';
import TakeAttendance from './Components/TakeAttendance';
import AttendanceHistory from './Components/AttendanceHistory';
import Members from './Components/Members';
import Dashboard from './Components/Dashboard';
import MemberShell from './Components/member/MemberShell';
import MyAttendance from './Components/member/MyAttendance';
import { allMenuItems } from './Components/layout/sidebarMenuConfig';
import { useAuth } from './Components/AuthContext';

const realPages = {
  '/side/roles': <SystemRoles />,
  '/side/permissions': <RolePermissions />,
  '/side/staff': <StaffRegistration />,
  '/side/meetings': <Meetings />,
  '/side/attendance': <TakeAttendance />,
  '/side/attendance-history': <AttendanceHistory />,
  '/side/members': <Members />,
};

const nestedMenuRoutes = allMenuItems.filter(
  (item) => item.path && item.path !== '/side'
);

/** Bounce members away from admin shell and staff away from member shell. */
function RoleGate({ allow, children, fallback }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.type === 'member' && allow !== 'member') {
    return <Navigate to={fallback || '/member'} replace />;
  }
  if (user.type !== 'member' && allow === 'member') {
    return <Navigate to={fallback || '/side'} replace />;
  }
  return children;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/side"
          element={
            <ProtectedRoute>
              <RoleGate allow="staff">
                <FinalSide />
              </RoleGate>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          {nestedMenuRoutes.map((item) => {
            const relativePath = item.path.replace(/^\/side\/?/, '');
            if (!relativePath) return null;
            return (
              <Route
                key={item.path}
                path={relativePath}
                element={
                  realPages[item.path] || (
                    <PlaceholderPage title={item.label} />
                  )
                }
              />
            );
          })}
        </Route>

        <Route
          path="/member"
          element={
            <ProtectedRoute>
              <RoleGate allow="member">
                <MemberShell />
              </RoleGate>
            </ProtectedRoute>
          }
        >
          <Route index element={<MyAttendance />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
