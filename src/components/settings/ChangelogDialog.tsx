/**
 * Changelog Dialog Component
 * Displays version history and feature additions
 */

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
  Divider,
} from '@mui/material';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import BugReportIcon from '@mui/icons-material/BugReport';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { changelog, ChangelogEntry } from '../../data/changelog';

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

const changeTypeConfig = {
  feature: { label: 'New', color: '#22c55e' as const, icon: NewReleasesIcon },
  fix: { label: 'Fix', color: '#f59e0b' as const, icon: BugReportIcon },
  improvement: { label: 'Improved', color: '#3b82f6' as const, icon: TrendingUpIcon },
};

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '80vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <NewReleasesIcon sx={{ color: '#ff6b35' }} />
        What's New
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {changelog.map((entry, index) => (
            <Box key={entry.version}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant="h6" sx={{ color: index === 0 ? '#ff6b35' : 'text.primary' }}>
                  v{entry.version}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {entry.date}
                </Typography>
                {index === 0 && (
                  <Chip
                    label="Latest"
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      bgcolor: 'rgba(255, 107, 53, 0.2)',
                      color: '#ff6b35',
                    }}
                  />
                )}
              </Box>
              <Stack spacing={0.5}>
                {entry.changes.map((change, changeIndex) => {
                  const config = changeTypeConfig[change.type];
                  return (
                    <Box
                      key={changeIndex}
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                    >
                      <Chip
                        label={config.label}
                        size="small"
                        sx={{
                          height: 20,
                          minWidth: 65,
                          fontSize: '0.65rem',
                          bgcolor: `${config.color}22`,
                          color: config.color,
                          fontWeight: 600,
                        }}
                      />
                      <Typography variant="body2" sx={{ pt: 0.25 }}>
                        {change.description}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
              {index < changelog.length - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
