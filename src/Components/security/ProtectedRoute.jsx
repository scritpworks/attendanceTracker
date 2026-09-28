import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Container,
} from '@mui/material';
import { usePermissions } from '../context/PermissionContext';
import { useAuth } from '../AuthContext';

const ProtectedRoute = ({ children, requiredPath }) => {
  const { hasAccess, loading, isSuperAdmin, verifyAccess } = usePermissions();
  const { user, token } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(!!requiredPath);
  const [authorized, setAuthorized] = useState(!requiredPath);

  useEffect(() => {
    const checkAccess = async () => {
      if (!token || !user) {
        setAuthorized(false);
        setChecking(false);
        return;
      }

      if (!requiredPath) {
        setAuthorized(true);
        setChecking(false);
        return;
      }

      if (loading) return;

      if (isSuperAdmin()) {
        setAuthorized(true);
        setChecking(false);
        return;
      }

      const localAccess = hasAccess(requiredPath);
      if (localAccess) {
        try {
          const serverAccess = await verifyAccess(requiredPath);
          setAuthorized(serverAccess);
        } catch {
          setAuthorized(localAccess);
        }
      } else {
        setAuthorized(false);
      }
      setChecking(false);
    };

    checkAccess();
  }, [requiredPath, hasAccess, loading, isSuperAdmin, token, user, verifyAccess]);

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (checking || (requiredPath && loading)) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ mb: 2 }} />
        <Typography>Verifying access…</Typography>
      </Container>
    );
  }

  if (requiredPath && !authorized) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Access denied
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          You do not have permission to view this page.
        </Typography>
        <Button variant="contained" href="/side" sx={{ bgcolor: '#2E7D32' }}>
          Back to dashboard
        </Button>
      </Box>
    );
  }

  return children;
};

export default ProtectedRoute;
