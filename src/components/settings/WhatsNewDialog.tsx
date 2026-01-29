/**
 * What's New Dialog Component
 * Shows latest version changes on first load after update
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Stack,
} from '@mui/material';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import BugReportIcon from '@mui/icons-material/BugReport';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CelebrationIcon from '@mui/icons-material/Celebration';
import { changelog } from '../../data/changelog';

const LAST_SEEN_VERSION_KEY = 'avernus-combat-last-seen-version';

const changeTypeConfig = {
  feature: { label: 'New', color: '#22c55e' as const, icon: NewReleasesIcon },
  fix: { label: 'Fix', color: '#f59e0b' as const, icon: BugReportIcon },
  improvement: { label: 'Improved', color: '#3b82f6' as const, icon: TrendingUpIcon },
};

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false);
  const latestVersion = changelog[0];

  useEffect(() => {
    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);

    if (lastSeenVersion !== latestVersion.version) {
      // Show dialog after a short delay to let the app load
      const timer = setTimeout(() => {
        setOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [latestVersion.version]);

  const handleClose = () => {
    // Save the current version as seen
    localStorage.setItem(LAST_SEEN_VERSION_KEY, latestVersion.version);
    setOpen(false);
  };

  if (!latestVersion) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1e1e1e',
          border: '1px solid',
          borderColor: 'rgba(255, 107, 53, 0.3)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: 'rgba(255, 107, 53, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'rgba(255, 107, 53, 0.2)',
        }}
      >
        <CelebrationIcon sx={{ color: '#ff6b35', fontSize: 28 }} />
        <Box>
          <Typography variant="h6" sx={{ color: '#ff6b35', fontWeight: 700 }}>
            What's New in v{latestVersion.version}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Released {latestVersion.date}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={1.5}>
          {latestVersion.changes.map((change, index) => {
            const config = changeTypeConfig[change.type];
            const Icon = config.icon;
            return (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  bgcolor: '#242424',
                  borderRadius: 1,
                  borderLeft: 3,
                  borderColor: config.color,
                }}
              >
                <Icon sx={{ color: config.color, fontSize: 20, mt: 0.25 }} />
                <Box sx={{ flex: 1 }}>
                  <Chip
                    label={config.label}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor: `${config.color}22`,
                      color: config.color,
                      fontWeight: 600,
                      mb: 0.5,
                    }}
                  />
                  <Typography variant="body2" sx={{ color: '#e0e0e0' }}>
                    {change.description}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          View full changelog in Settings menu
        </Typography>
        <Button
          onClick={handleClose}
          variant="contained"
          sx={{
            bgcolor: '#ff6b35',
            '&:hover': { bgcolor: '#e55a2b' },
          }}
        >
          Got it!
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Get the current app version
 */
export function getCurrentVersion(): string {
  return changelog[0]?.version || '0.0.0';
}

/**
 * Check if user has seen the current version
 */
export function hasSeenCurrentVersion(): boolean {
  const lastSeenVersion = localStorage.getItem(LAST_SEEN_VERSION_KEY);
  return lastSeenVersion === changelog[0]?.version;
}

/**
 * Mark current version as seen (for manual dismissal)
 */
export function markVersionAsSeen(): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, changelog[0]?.version || '0.0.0');
}
