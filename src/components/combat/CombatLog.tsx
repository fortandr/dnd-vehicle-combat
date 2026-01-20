/**
 * Combat Log Component
 * Displays action log entries for the encounter
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';

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

  const recentLogs = [...state.actionLog].reverse().slice(0, 50);

  return (
    <Card>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Combat Log
          </Typography>
          {state.actionLog.length > 0 && (
            <Chip label={state.actionLog.length} size="small" variant="outlined" sx={{ height: 20 }} />
          )}
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
    </Card>
  );
}
