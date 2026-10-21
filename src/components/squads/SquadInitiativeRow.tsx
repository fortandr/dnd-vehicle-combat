import { Box, Paper, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';
import { factionColors, withOpacity } from '../../theme/customColors';

/** A squad's single slot in the initiative tracker. "↳" means it acts right after its commander (VVTT rule). */
export function SquadInitiativeRow({ squad, isActive }: { squad: Squad; isActive: boolean }) {
  const { state } = useCombat();
  const standing = squadStandingCount(squad, state.creatures);
  const commander = squad.commanderId ? state.creatures.find((c) => c.id === squad.commanderId) : undefined;
  const color = squad.faction === 'party' ? factionColors.party : factionColors.enemy;
  const out = standing === 0;
  return (
    <Paper sx={{ p: 1, bgcolor: isActive ? withOpacity(color, 0.15) : '#242424', borderLeft: 3, borderColor: color, opacity: out ? 0.6 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" fontFamily="monospace" sx={{ minWidth: 24 }}>{commander ? '↳' : (squad.initiative ?? '—')}</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ textDecoration: out ? 'line-through' : 'none' }}>⚑ {squad.name}</Typography>
          {commander && <Typography variant="caption" color="text.secondary">directed by {commander.name}</Typography>}
          {squad.morale?.status && (
            <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
              {squad.morale.status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" fontFamily="monospace">{standing}/{squad.startingCount}</Typography>
      </Box>
    </Paper>
  );
}
