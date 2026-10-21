import { Box, Button, Chip } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoraleStatus, Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';

const NEXT_STATUS: Record<MoraleStatus, MoraleStatus | undefined> = { fleeing: 'surrendered', surrendered: undefined };

/** Squad card: Steady / Fleeing / Surrendered chip (click cycles) and a manual morale check (DMG 2014 p. 273). */
export function SquadMoraleControls({ squad }: { squad: Squad }) {
  const { state, dispatch } = useCombat();
  const status = squad.morale?.status;
  const pending = state.moralePrompts.some((p) => p.squadId === squad.id);
  const canCheck = state.phase === 'combat' && squadStandingCount(squad, state.creatures) > 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {status ? (
        <Chip
          size="small" label={status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'} color={status === 'fleeing' ? 'warning' : 'default'}
          title="Click: Fleeing → Surrendered → Steady"
          onClick={() => dispatch({ type: 'SET_MORALE_STATUS', payload: { squadId: squad.id, status: NEXT_STATUS[status] } })}
        />
      ) : (
        <Chip size="small" variant="outlined" label="⚑ Steady" />
      )}
      {canCheck && (
        <Button
          size="small" disabled={pending} title="Ask for a morale check (surprise or any other DMG trigger)"
          onClick={() => dispatch({ type: 'REQUEST_MORALE', payload: { squadId: squad.id } })}
          sx={{ minWidth: 0, px: 0.75, fontSize: '0.7rem' }}
        >
          Morale
        </Button>
      )}
    </Box>
  );
}
