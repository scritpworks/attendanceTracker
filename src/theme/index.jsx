import { createTheme } from '@mui/material/styles';

const themeOptions = {
  palette: {
    primary: {
      lighter: '#E8F5E9',
      light: '#81C784',
      main: '#2E7D32',
      dark: '#1B5E20',
      darker: '#0A280B',
      contrastText: '#fff',
    },
    background: {
      default: '#FFFFFF',
      paper: '#FFFFFF',
      neutral: '#F5F5F5'
    },
    text: {
      primary: '#2D3748',
      secondary: '#718096'
    },
    divider: '#E2E8F0'
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 600,
  },
  shape: {
    borderRadius: 8
  }
};

const theme = createTheme(themeOptions);


theme.components = {
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
      }
    }
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        '&.Mui-selected': {
          backgroundColor: theme.palette.primary.lighter,
          '&:hover': {
            backgroundColor: theme.palette.primary.lighter,
          }
        },
        [`@media (max-width: ${theme.breakpoints.values.md}px)`]: {
          paddingTop: theme.spacing(2),
          paddingBottom: theme.spacing(2)
        }
      }
    }
  },
  MuiListItemIcon: {
    styleOverrides: {
      root: {
        [`@media (max-width: ${theme.breakpoints.values.md}px)`]: {
          minWidth: 56
        }
      }
    }
  },
  MuiToolbar: {
    styleOverrides: {
      root: {
        [`@media (max-width: ${theme.breakpoints.values.sm}px)`]: {
          paddingLeft: 8,
          paddingRight: 8
        }
      }
    }
  }
};

export default theme;