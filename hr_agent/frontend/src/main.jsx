import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CustomThemeProvider, useTheme } from './context/ThemeContext.jsx';
import './styles.css';

// Define a function to get the theme options based on the mode
const getTheme = (mode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light mode palette
          primary: { main: '#264653' },
          secondary: { main: '#2a9d8f' },
          error: { main: '#e76f51' },
          background: { default: '#f8f9fa', paper: '#ffffff' },
          text: { primary: '#212529', secondary: '#6c757d' },
        }
      : {
          // Dark mode palette
          primary: { main: '#e9c46a' }, // Sandy Brown
          secondary: { main: '#2a9d8f' }, // Persian Green
          error: { main: '#e76f51' }, // Burnt Sienna
          background: { default: '#121212', paper: '#1e1e1e' },
          text: { primary: '#ffffff', secondary: '#adb5bd' },
        }),
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: ({ theme }) => ({
          borderColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)',
        }),
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: 'inherit' },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          '&:not(:last-child)': { borderBottom: 0 },
          '&:before': { display: 'none' },
        }),
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600 } },
    },
  },
});

// A new wrapper component is needed to use the theme context
const AppWrapper = () => {
  const { mode } = useTheme();
  const theme = React.useMemo(() => createTheme(getTheme(mode)), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CustomThemeProvider>
      <AppWrapper />
    </CustomThemeProvider>
  </React.StrictMode>
);
