import { Box, Button, Chip, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature, MoraleStatus } from '../../types';

const NEXT_STATUS: Record<MoraleStatus, MoraleStatus | undefined> = { fleeing: 'surrendered', surrendered: undefined };

/** Sidebar row: "led by", the Fleeing/Surrendered chip (click cycles), and a manual Morale check button. */
export function MoraleRowControls({ creature }: { creature: Creature }) {
  const { state, dispatch } = useCombat();
  const status = creature.morale?.status;
  const leaderId = creature.stack?.leaderId;
  const leader = leaderId ? state.creatures.find((c) => c.id === leaderId) : undefined;
  const pending = (state.moralePrompts ?? []).some((p) => p.creatureId === creature.id);
  const canCheck = state.phase === 'combat' && creature.currentHp > 0;
  if (!leader && !status && !canCheck) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      {leader && <Typography variant="caption" color="text.secondary">led by {leader.name}</Typography>}
      {status && (
        <Chip
          size="small" label={status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'} color={status === 'fleeing' ? 'warning' : 'default'}
          title="Click: Fleeing → Surrendered → cleared"
          onClick={() => dispatch({ type: 'SET_MORALE_STATUS', payload: { creatureId: creature.id, status: NEXT_STATUS[status] } })}
          sx={{ height: 18, fontSize: '0.6rem' }}
        />
      )}
      {canCheck && (
        <Button
          size="small" disabled={pending} title="Ask for a morale check (surprise or any other DMG trigger)"
          onClick={() => dispatch({ type: 'REQUEST_MORALE', payload: { creatureId: creature.id } })}
          sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: '0.65rem' }}
        >
          Morale
        </Button>
      )}
    </Box>
  );
}
