/**
 * Combat Summary Component
 * Displays a summary of completed combat organized by round
 */

import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { LogEntry, LogEntryType } from '../../types';
import { CombatArchive } from '../../services/storageService';
import { withOpacity } from '../../theme/customColors';

interface CombatSummaryProps {
  archive: CombatArchive;
}

// Color mapping for log entry types
const logTypeColors: Record<LogEntryType, string> = {
  attack: '#ef4444',
  damage: '#f97316',
  healing: '#22c55e',
  mishap: '#eab308',
  complication: '#a855f7',
  movement: '#3b82f6',
  ability: '#6366f1',
  condition: '#a78bfa',
  scale_change: '#06b6d4',
  round_start: '#64748b',
  turn_start: '#94a3b8',
  system: '#71717a',
};

// Icon/prefix for log entry types
const logTypeLabels: Record<LogEntryType, string> = {
  attack: 'Attack',
  damage: 'Damage',
  healing: 'Healing',
  mishap: 'Mishap',
  complication: 'Complication',
  movement: 'Movement',
  ability: 'Ability',
  condition: 'Condition',
  scale_change: 'Scale',
  round_start: 'Round',
  turn_start: 'Turn',
  system: 'System',
};

export function CombatSummary({ archive }: CombatSummaryProps) {
  const actionLog = archive.actionLog as LogEntry[];

  // Group log entries by round
  const logsByRound = actionLog.reduce((acc, entry) => {
    const round = entry.round || 0;
    if (!acc[round]) {
      acc[round] = [];
    }
    acc[round].push(entry);
    return acc;
  }, {} as Record<number, LogEntry[]>);

  const rounds = Object.keys(logsByRound)
    .map(Number)
    .sort((a, b) => a - b);

  // Count significant events
  const damageEvents = actionLog.filter((e) => e.type === 'damage').length;
  const healingEvents = actionLog.filter((e) => e.type === 'healing').length;
  const mishapEvents = actionLog.filter((e) => e.type === 'mishap').length;
  const movementEvents = actionLog.filter((e) => e.type === 'movement').length;

  return (
    <Box>
      {/* Header Summary */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: withOpacity('#ff4500', 0.1) }}>
        <Typography variant="h6" gutterBottom>
          {archive.encounterName}
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Completed: {new Date(archive.completedAt).toLocaleString()}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Chip
            label={`${archive.totalRounds} Round${archive.totalRounds !== 1 ? 's' : ''}`}
            size="small"
            sx={{ bgcolor: withOpacity('#3b82f6', 0.2), color: '#3b82f6' }}
          />
          <Chip
            label={`${damageEvents} Damage`}
            size="small"
            sx={{ bgcolor: withOpacity('#f97316', 0.2), color: '#f97316' }}
          />
          <Chip
            label={`${healingEvents} Healing`}
            size="small"
            sx={{ bgcolor: withOpacity('#22c55e', 0.2), color: '#22c55e' }}
          />
          <Chip
            label={`${mishapEvents} Mishaps`}
            size="small"
            sx={{ bgcolor: withOpacity('#eab308', 0.2), color: '#eab308' }}
          />
          <Chip
            label={`${movementEvents} Movements`}
            size="small"
            sx={{ bgcolor: withOpacity('#3b82f6', 0.2), color: '#3b82f6' }}
          />
        </Stack>
      </Paper>

      {/* Participants */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Participants
        </Typography>
        <Stack direction="row" spacing={4}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Party
            </Typography>
            <Typography variant="body2">
              {archive.summary.partyVehicles.length > 0
                ? archive.summary.partyVehicles.join(', ')
                : 'No vehicles'}
            </Typography>
            {archive.summary.partyCreatures.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Crew: {archive.summary.partyCreatures.join(', ')}
              </Typography>
            )}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Enemy
            </Typography>
            <Typography variant="body2">
              {archive.summary.enemyVehicles.length > 0
                ? archive.summary.enemyVehicles.join(', ')
                : 'No vehicles'}
            </Typography>
            {archive.summary.enemyCreatures.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Crew: {archive.summary.enemyCreatures.join(', ')}
              </Typography>
            )}
          </Box>
        </Stack>

        {/* Casualties */}
        {(archive.summary.vehiclesDestroyed.length > 0 ||
          archive.summary.creaturesKilled.length > 0) && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="error.main" gutterBottom>
              Casualties
            </Typography>
            {archive.summary.vehiclesDestroyed.length > 0 && (
              <Typography variant="body2">
                Vehicles Destroyed: {archive.summary.vehiclesDestroyed.join(', ')}
              </Typography>
            )}
            {archive.summary.creaturesKilled.length > 0 && (
              <Typography variant="body2">
                Creatures Killed: {archive.summary.creaturesKilled.join(', ')}
              </Typography>
            )}
          </>
        )}
      </Paper>

      {/* Round-by-Round Log */}
      <Typography variant="subtitle2" gutterBottom>
        Combat Log
      </Typography>
      {rounds.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No events recorded.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {rounds.map((round) => (
            <Accordion key={round} defaultExpanded={round === rounds[rounds.length - 1]}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>
                  {round === 0 ? 'Pre-Combat' : `Round ${round}`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                  ({logsByRound[round].length} event{logsByRound[round].length !== 1 ? 's' : ''})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={0.5}>
                  {logsByRound[round].map((entry) => (
                    <LogEntryRow key={entry.id} entry={entry} />
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
    </Box>
  );
}

interface LogEntryRowProps {
  entry: LogEntry;
}

function LogEntryRow({ entry }: LogEntryRowProps) {
  const color = logTypeColors[entry.type] || '#71717a';
  const label = logTypeLabels[entry.type] || entry.type;

  // Skip round_start and turn_start entries as they're redundant in this view
  if (entry.type === 'round_start') {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        py: 0.5,
        borderLeft: 2,
        borderColor: color,
        pl: 1,
      }}
    >
      <Chip
        label={label}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          bgcolor: withOpacity(color, 0.2),
          color: color,
          minWidth: 70,
        }}
      />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2">{entry.action}</Typography>
        {entry.details && (
          <Typography variant="caption" color="text.secondary">
            {entry.details}
          </Typography>
        )}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
        {new Date(entry.timestamp).toLocaleTimeString()}
      </Typography>
    </Box>
  );
}
