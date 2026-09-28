import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: 700, color: '#2D3748' }}>
        404
      </Typography>
      <Typography sx={{ color: '#718096' }}>Page not found</Typography>
      <Button
        variant="contained"
        onClick={() => navigate('/side')}
        sx={{ bgcolor: '#2E7D32', '&:hover': { bgcolor: '#1B5E20' } }}
      >
        Go to dashboard
      </Button>
    </Box>
  );
};

export default NotFound;
