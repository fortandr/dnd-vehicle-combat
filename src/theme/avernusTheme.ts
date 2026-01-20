/**
 * Material UI Theme for Avernus Vehicle Combat Tracker
 * Dark infernal theme with fire/ember accents
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff4500',      // Fire orange
      light: '#ff6b35',     // Ember
      dark: '#cc3700',      // Dark fire
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ff8c00',      // Lava orange
      light: '#ffb347',
      dark: '#cc7000',
    },
    background: {
      default: '#0f0f0f',   // Primary bg
      paper: '#1a1a1a',     // Secondary bg / cards
    },
    text: {
      primary: '#e5e5e5',
      secondary: '#a0a0a0',
      disabled: '#666666',
    },
    success: {
      main: '#22c55e',      // Health green
      dark: '#16a34a',
    },
    warning: {
      main: '#eab308',      // Damage/warning yellow
      dark: '#f59e0b',
    },
    error: {
      main: '#ef4444',      // Danger red
      dark: '#dc2626',
    },
    info: {
      main: '#3b82f6',      // Mana/info blue
    },
    divider: '#333333',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    h4: { fontSize: '1rem', fontWeight: 600 },
    body2: { color: '#a0a0a0' },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 4, // Base 4px spacing (xs=4, sm=8, md=16, lg=24, xl=32)
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0f0f0f',
          minHeight: '100vh',
          scrollbarWidth: 'thin',
          '&::-webkit-scrollbar': { width: 8, height: 8 },
          '&::-webkit-scrollbar-track': { background: '#242424' },
          '&::-webkit-scrollbar-thumb': { background: '#333333', borderRadius: 4 },
          '&::-webkit-scrollbar-thumb:hover': { background: '#444444' },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
        containedPrimary: {
          '&:hover': {
            boxShadow: '0 0 20px rgba(255, 69, 0, 0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          border: '1px solid #333333',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '0.75rem' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#242424',
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#444444' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff4500' },
          },
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          backgroundColor: '#242424',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a1a',
          border: '1px solid #333333',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { backgroundColor: '#242424', borderRadius: 4, height: 8 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #333333',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 69, 0, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(255, 69, 0, 0.25)',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255, 69, 0, 0.1)',
          },
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 69, 0, 0.2)',
            color: '#ff4500',
            '&:hover': {
              backgroundColor: 'rgba(255, 69, 0, 0.3)',
            },
          },
        },
      },
    },
  },
};

export const avernusTheme = createTheme(themeOptions);

// Additional color tokens not in standard MUI palette
export const extendedColors = {
  bgTertiary: '#242424',
  bgCard: '#1e1e1e',
  bgHover: '#2a2a2a',
  ember: '#ff6b35',
  lava: '#ff8c00',
};
