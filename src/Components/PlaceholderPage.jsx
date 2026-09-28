import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { allMenuItems } from './layout/sidebarMenuConfig';

const PlaceholderPage = ({ title }) => {
  const location = useLocation();
  const matched = allMenuItems.find((item) => item.path === location.pathname);
  const heading = title || matched?.label || 'Module';

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        maxWidth: 640,
      }}
    >
      <Typography
        variant="overline"
        sx={{ color: '#2E7D32', fontWeight: 700, letterSpacing: 1.2 }}
      >
        Coming soon
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, color: '#2D3748', mb: 1 }}>
        {heading}
      </Typography>
      <Typography variant="body1" sx={{ color: '#718096' }}>
        This module shell is ready. Feature screens will be built here next.
      </Typography>
      <Typography
        variant="caption"
        sx={{ mt: 2, color: '#A0AEC0', fontFamily: 'monospace' }}
      >
        {location.pathname}
      </Typography>
    </Box>
  );
};

export default PlaceholderPage;
