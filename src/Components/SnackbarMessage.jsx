import React from 'react';
import { Snackbar, Alert, Fade } from '@mui/material';

/** Same snackbar used in the school system for API success / error messages. */
const SnackbarMessage = ({ message, severity, open, onClose }) => {
  const vertical = 'top';
  const horizontal = 'center';

  return (
    <Snackbar
      open={open}
      autoHideDuration={5000}
      onClose={onClose}
      anchorOrigin={{ vertical, horizontal }}
      TransitionComponent={Fade}
      key={vertical + horizontal}
    >
      <Alert onClose={onClose} severity={severity} variant="filled" sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
};

export default SnackbarMessage;
