/**
 * Avernus Vehicle Combat Tracker
 * Main Application Component
 */

import { useState } from 'react';
import { Box, Typography, CircularProgress, Drawer, IconButton, useMediaQuery, useTheme, BottomNavigation, BottomNavigationAction } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MapIcon from '@mui/icons-material/Map';
import GroupIcon from '@mui/icons-material/Group';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { CombatProvider } from './context/CombatContext';
import { AuthProvider, useAuth, isAuthEnabled } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';
import { RightPanel } from './components/layout/RightPanel';
import { LoginPage } from './components/auth/LoginPage';

// Inner app content - requires auth check
function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px

  // Mobile drawer states
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(0); // 0=map, 1=creatures, 2=vehicles

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

  // Mobile layout
  if (isMobile) {
    return (
      <CombatProvider>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: '100vh',
            bgcolor: '#1a1a1a',
          }}
        >
          <Header />

          {/* Main content area - switches based on bottom nav */}
          <Box sx={{ flex: 1, overflow: 'auto', pb: 7 }}>
            {mobileNav === 0 && <MainPanel />}
            {mobileNav === 1 && (
              <Box sx={{ p: 1, height: '100%', overflow: 'auto' }}>
                <Sidebar />
              </Box>
            )}
            {mobileNav === 2 && (
              <Box sx={{ p: 1, height: '100%', overflow: 'auto' }}>
                <RightPanel />
              </Box>
            )}
          </Box>

          {/* Bottom navigation for mobile */}
          <BottomNavigation
            value={mobileNav}
            onChange={(_, newValue) => setMobileNav(newValue)}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: '#242424',
              borderTop: 1,
              borderColor: 'divider',
              '& .Mui-selected': {
                color: '#ff6b35 !important',
              },
            }}
          >
            <BottomNavigationAction label="Map" icon={<MapIcon />} />
            <BottomNavigationAction label="Creatures" icon={<GroupIcon />} />
            <BottomNavigationAction label="Vehicles" icon={<DirectionsCarIcon />} />
          </BottomNavigation>
        </Box>
      </CombatProvider>
    );
  }

  // Desktop layout
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
    <SettingsProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
