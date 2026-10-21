import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';

/** Sidebar heading for a squad's members (indented under it). The squad itself is managed in the Squads tab. */
export function SquadListGroup({ squad, children }: { squad: Squad; children: ReactNode }) {
  const { state } = useCombat();
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 0.5 }} title="Manage in the Squads tab">
        ⚑ {squad.name} · {squadStandingCount(squad, state.creatures)}/{squad.startingCount} standing
      </Typography>
      <Stack spacing={0.5} sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>{children}</Stack>
    </Box>
  );
}
