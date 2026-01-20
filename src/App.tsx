/**
 * Avernus Vehicle Combat Tracker
 * Main Application Component
 */

import { Box, Typography } from '@mui/material';
import { CombatProvider } from './context/CombatContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';
import { RightPanel } from './components/layout/RightPanel';

function App() {
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

export default App;
