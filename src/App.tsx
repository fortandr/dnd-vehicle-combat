/**
 * Avernus Vehicle Combat Tracker
 * Main Application Component
 */

import { Box, Typography, CircularProgress } from '@mui/material';
import { CombatProvider } from './context/CombatContext';
import { AuthProvider, useAuth, isAuthEnabled } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';
import { RightPanel } from './components/layout/RightPanel';
import { LoginPage } from './components/auth/LoginPage';

// Inner app content - requires auth check
function AppContent() {
  const { isAuthenticated, loading } = useAuth();

  // Show loading spinner while checking auth state
  if (isAuthEnabled && loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0a',
        }}
      >
        <CircularProgress sx={{ color: '#ff6b35' }} />
      </Box>
    );
  }

  // Show login page if auth is enabled and user is not authenticated
  if (isAuthEnabled && !isAuthenticated) {
    return <LoginPage />;
  }

  // Show main app
  return (
    <CombatProvider>
      <Box
        sx={{
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateColumns: '280px 1fr 320px',
          gridTemplateAreas: `
            "header header header"
            "sidebar main panel"
            "footer footer footer"
          `,
          minHeight: '100vh',
          // Allow page to scroll - sidebars grow with content
          '& > *': {
            minHeight: 0,
          },
        }}
      >
        <Header />
        <Sidebar />
        <MainPanel />
        <RightPanel />
        <Box
          component="footer"
          sx={{
            gridArea: 'footer',
            bgcolor: '#242424',
            borderTop: 1,
            borderColor: 'divider',
            px: 4,
            py: 2,
          }}
        >
          <Typography variant="body2" color="text.disabled">
            Avernus Vehicle Combat Tracker • Based on Descent into Avernus (5e)
          </Typography>
        </Box>
      </Box>
    </CombatProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
