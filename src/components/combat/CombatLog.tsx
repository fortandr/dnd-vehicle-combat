/**
 * Combat Log Component
 * Displays action log entries for the encounter
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Snackbar,
} from '@mui/material';
import IosShareIcon from '@mui/icons-material/IosShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DataObjectIcon from '@mui/icons-material/DataObject';
import DownloadIcon from '@mui/icons-material/Download';
import { useCombat } from '../../context/CombatContext';
import {
  formatLogAsMarkdown,
  formatLogAsJson,
  buildLogFilename,
  downloadText,
} from '../../utils/exportLog';

function getLogBorderColor(type: string): string {
  const colors: Record<string, string> = {
    damage: '#ef4444',
    healing: '#22c55e',
    mishap: '#eab308',
    round_start: '#ff4500',
    turn_start: '#666666',
    movement: '#3b82f6',
    scale_change: '#8b5cf6',
    system: '#666666',
  };
  return colors[type] || '#666666';
}

function LogTypeBadge({ type }: { type: string }) {
  const badges: Record<string, { label: string; color: 'error' | 'success' | 'warning' | 'primary' | 'default' }> = {
    damage: { label: 'DMG', color: 'error' },
    healing: { label: 'HEAL', color: 'success' },
    mishap: { label: 'MISHAP', color: 'warning' },
    round_start: { label: 'ROUND', color: 'primary' },
    turn_start: { label: 'TURN', color: 'default' },
    movement: { label: 'MOVE', color: 'primary' },
    scale_change: { label: 'SCALE', color: 'default' },
    system: { label: 'SYS', color: 'default' },
  };

  const badge = badges[type] || { label: type.toUpperCase(), color: 'default' as const };

  return (
    <Chip
      label={badge.label}
      size="small"
      color={badge.color}
      sx={{ height: 18, fontSize: '0.625rem' }}
    />
  );
}

function formatTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

  if (isNaN(date.getTime())) {
    return '--:--:--';
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function CombatLog() {
  const { state } = useCombat();
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const recentLogs = [...state.actionLog].reverse().slice(0, 50);
  const hasEntries = state.actionLog.length > 0;

  const closeExportMenu = () => setExportMenuAnchor(null);

  const copyToClipboard = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage(successMessage);
    } catch {
      setToastMessage('Copy failed — clipboard access denied');
    }
  };

  const handleCopyMarkdown = () => {
    copyToClipboard(formatLogAsMarkdown(state), 'Markdown copied to clipboard');
    closeExportMenu();
  };

  const handleCopyJson = () => {
    copyToClipboard(formatLogAsJson(state), 'JSON copied to clipboard');
    closeExportMenu();
  };

  const handleDownloadMarkdown = () => {
    downloadText(buildLogFilename(state, 'md'), formatLogAsMarkdown(state), 'text/markdown');
    closeExportMenu();
  };

  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Combat Log
            </Typography>
            {hasEntries && (
              <Chip label={state.actionLog.length} size="small" variant="outlined" sx={{ height: 20 }} />
            )}
          </Box>
          <Tooltip title={hasEntries ? 'Export log' : 'Nothing to export yet'}>
            <span>
              <IconButton
                size="small"
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                disabled={!hasEntries}
                aria-label="Export combat log"
              >
                <IosShareIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={closeExportMenu}
          >
            <MenuItem onClick={handleCopyMarkdown}>
              <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Copy as Markdown" secondary="Paste into Claude for a recap" />
            </MenuItem>
            <MenuItem onClick={handleCopyJson}>
              <ListItemIcon><DataObjectIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Copy as JSON" secondary="Structured, for tooling" />
            </MenuItem>
            <MenuItem onClick={handleDownloadMarkdown}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
              <ListItemText primary="Download .md" secondary="For long logs that clipboard may truncate" />
            </MenuItem>
          </Menu>
        </Box>

        {state.actionLog.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No actions yet
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
            <Stack spacing={0.5}>
              {recentLogs.map((entry) => (
                <Paper
                  key={entry.id}
                  sx={{
                    p: 1,
                    bgcolor: '#242424',
                    borderLeft: 2,
                    borderColor: getLogBorderColor(entry.type),
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ lineHeight: 1.3 }}>{entry.action}</Typography>
                      {entry.details && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {entry.details}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                        R{entry.round} {formatTime(entry.timestamp)}
                      </Typography>
                      <LogTypeBadge type={entry.type} />
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
      <Snackbar
        open={toastMessage !== null}
        autoHideDuration={2500}
        onClose={() => setToastMessage(null)}
        message={toastMessage ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Card>
  );
}
