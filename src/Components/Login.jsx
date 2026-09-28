import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import { useAuth } from './AuthContext';
import { LOGIN_ENDPOINT, MEMBER_LOGIN_ENDPOINT } from './apiConfig';
import FirstLoginDialog from './FirstLoginDialog';

const PRODUCT_NAME = 'Attendance Tracker';
const MEMBER_ID_RE = /^\d{10}$/;

const fieldSx = {
  mb: 2,
  '& .MuiOutlinedInput-root': { bgcolor: '#fff' },
  '& .MuiOutlinedInput-input': {
    color: '#2c3e50',
    WebkitTextFillColor: '#2c3e50',
  },
  '& .MuiInputLabel-root': { color: '#718096' },
};

const Login = () => {
  const navigate = useNavigate();
  const { login, token, user } = useAuth();
  const [loginType, setLoginType] = useState('staff');
  const [email, setEmail] = useState('admin@attendance.local');
  const [memberId, setMemberId] = useState('');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showFirstLoginDialog, setShowFirstLoginDialog] = useState(false);
  const [pendingLogin, setPendingLogin] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  if (token && user && !showFirstLoginDialog) {
    const dest = user.type === 'member' ? '/member' : '/side';
    return <Navigate to={dest} replace />;
  }

  const handleTabChange = (_e, next) => {
    setLoginType(next);
    setError('');
    setPassword(next === 'staff' ? 'admin123' : '');
    if (next === 'staff') {
      setEmail('admin@attendance.local');
    } else {
      setMemberId('');
    }
  };

  const handleStaffSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    const { data } = await axios.post(LOGIN_ENDPOINT, {
      email: email.trim(),
      password,
    });

    if (!data.success || !data.token) {
      setError(data.message || 'Login failed.');
      return;
    }

    const staffUser = { ...data.user, type: 'staff' };

    if (Number(staffUser?.fresh) === 1) {
      setPendingLogin({ token: data.token, user: staffUser, mode: 'staff' });
      setShowFirstLoginDialog(true);
      return;
    }

    login(data.token, staffUser);
    navigate('/side', { replace: true });
  };

  const handleMemberSubmit = async () => {
    const id = memberId.trim();
    if (!MEMBER_ID_RE.test(id)) {
      setError('Member ID must be exactly 10 digits.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    const { data } = await axios.post(MEMBER_LOGIN_ENDPOINT, {
      memberId: id,
      password,
    });

    if (!data.success || !data.token) {
      setError(data.message || 'Login failed.');
      return;
    }

    const memberUser = {
      ...data.user,
      type: 'member',
      userType: 'member',
    };

    if (Number(memberUser?.fresh) === 1) {
      setPendingLogin({ token: data.token, user: memberUser, mode: 'member' });
      setShowFirstLoginDialog(true);
      return;
    }

    login(data.token, memberUser);
    navigate('/member', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (loginType === 'member') {
        await handleMemberSubmit();
      } else {
        await handleStaffSubmit();
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        'Login failed. Is the API running on port 5001?';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSuccess = () => {
    setShowFirstLoginDialog(false);
    if (pendingLogin) {
      const { token: authToken, user: authUser, mode } = pendingLogin;
      const nextUser = { ...authUser, fresh: 0 };
      login(authToken, nextUser);
      setPendingLogin(null);
      setSnackbar({
        open: true,
        message: 'Password changed successfully!',
        severity: 'success',
      });
      const dest = mode === 'member' ? '/member' : '/side';
      setTimeout(() => navigate(dest, { replace: true }), 800);
    }
  };

  const handleFirstLoginClose = () => {
    setShowFirstLoginDialog(false);
    setPendingLogin(null);
  };

  const firstLoginAccountId =
    pendingLogin?.mode === 'member'
      ? pendingLogin?.user?.memberId || memberId.trim()
      : pendingLogin?.user?.email || email.trim();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        background:
          'linear-gradient(160deg, #E8F5E9 0%, #FAFAFA 45%, #F1F8F4 100%)',
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 420,
          bgcolor: '#fff',
          borderRadius: 2,
          p: { xs: 3, sm: 4 },
          boxShadow: '0 8px 32px rgba(46, 125, 50, 0.12)',
          border: '1px solid rgba(46, 125, 50, 0.12)',
        }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: '#1B5E20', mb: 0.5 }}
        >
          {PRODUCT_NAME}
        </Typography>
        <Typography variant="body2" sx={{ color: '#718096', mb: 2 }}>
          {loginType === 'staff'
            ? 'Sign in with your staff account'
            : 'Sign in with your Member ID'}
        </Typography>

        <Tabs
          value={loginType}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            mb: 2.5,
            minHeight: 40,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              minHeight: 40,
            },
            '& .Mui-selected': { color: '#2E7D32 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#2E7D32' },
          }}
        >
          <Tab label="Staff" value="staff" />
          <Tab label="Member" value="member" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loginType === 'staff' ? (
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="login-text-field"
            sx={fieldSx}
            autoComplete="username"
          />
        ) : (
          <TextField
            label="Member ID"
            fullWidth
            value={memberId}
            onChange={(e) =>
              setMemberId(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
            className="login-text-field"
            sx={fieldSx}
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            placeholder="1000000001"
            helperText="Exactly 10 digits. Temporary password is your Member ID."
            autoComplete="username"
          />
        )}

        <TextField
          label="Password"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-text-field"
          sx={{ ...fieldSx, mb: 3 }}
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={loading}
          sx={{
            py: 1.25,
            bgcolor: '#2E7D32',
            '&:hover': { bgcolor: '#1B5E20' },
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign in'}
        </Button>
      </Box>

      <FirstLoginDialog
        open={showFirstLoginDialog}
        mode={pendingLogin?.mode || 'staff'}
        accountId={firstLoginAccountId}
        onClose={handleFirstLoginClose}
        onSuccess={handlePasswordChangeSuccess}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Login;
