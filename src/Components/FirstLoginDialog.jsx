import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
  CircularProgress,
  InputAdornment,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import axios from 'axios';
import { UPDATE_USER_PASSWORD, UPDATE_MEMBER_PASSWORD } from './apiConfig';

const BRAND = '#2E7D32';
const BRAND_HOVER = '#1B5E20';

/**
 * First-login password change.
 * mode: 'staff' | 'member'
 * accountId: email (staff) or Member ID (member)
 */
function FirstLoginDialog({ open, mode = 'staff', accountId, onClose, onSuccess }) {
  const isMember = mode === 'member';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose?.();
  };

  const handleSubmit = async () => {
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isMember && newPassword === String(accountId || '')) {
      setError('Choose a password different from your Member ID');
      return;
    }

    try {
      setLoading(true);
      const response = isMember
        ? await axios.post(UPDATE_MEMBER_PASSWORD, {
            memberId: accountId,
            new_password: newPassword,
          })
        : await axios.post(UPDATE_USER_PASSWORD, {
            email: accountId,
            new_password: newPassword,
          });

      if (response.data.success) {
        resetForm();
        onSuccess?.();
      } else {
        setError(response.data.message || 'Failed to update password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          bgcolor: BRAND,
          color: 'white',
          py: 1.5,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
          Change Your Password
        </Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          disabled={loading}
          sx={{ color: 'white', '&:hover': { color: '#D9F1E1' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Typography variant="body2" sx={{ mb: 2.5, color: '#555' }}>
          This appears to be your first login. For security reasons, please change
          your password before continuing.
        </Typography>

        <TextField
          fullWidth
          label={isMember ? 'Member ID' : 'Email'}
          value={accountId || ''}
          disabled
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="New Password"
          type={showNewPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-input': {
              color: '#2c3e50',
              WebkitTextFillColor: '#2c3e50',
            },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle new password visibility"
                  onClick={() => setShowNewPassword((v) => !v)}
                  edge="end"
                >
                  {showNewPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          label="Confirm New Password"
          type={showConfirmPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-input': {
              color: '#2c3e50',
              WebkitTextFillColor: '#2c3e50',
            },
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle confirm password visibility"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  edge="end"
                >
                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          fullWidth
          sx={{
            bgcolor: BRAND,
            textTransform: 'none',
            fontWeight: 700,
            py: 1.1,
            '&:hover': { bgcolor: BRAND_HOVER },
          }}
        >
          {loading ? <CircularProgress size={22} color="inherit" /> : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FirstLoginDialog;
