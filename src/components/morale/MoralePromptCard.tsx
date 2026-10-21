import { useState } from 'react';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoralePrompt } from '../../types';
import { moraleSaver, squadMoraleSaver, rollMorale, formatMoraleLog, moraleTriggerText, MORALE_DC, type MoraleOutcome } from '../../utils/morale';
import { squadStandingCount } from '../../utils/squads';
import { rollDie } from '../../utils/diceEngine';

/** One open morale check (DMG 2014 p. 273) for a squad or a standalone creature: Roll, Fails automatically, or Dismiss. */
export function MoralePromptCard({ prompt, onResolved }: { prompt: MoralePrompt; onResolved: (text: string, fled: boolean) => void }) {
  const { state, dispatch } = useCombat();
  const [disadvantage, setDisadvantage] = useState(false);
  const squad = prompt.squadId ? state.squads.find((s) => s.id === prompt.squadId) : undefined;
  const creature = !squad && prompt.creatureId ? state.creatures.find((c) => c.id === prompt.creatureId) : undefined;
  if (!squad && !creature) return null;

  const squadSaver = squad ? squadMoraleSaver(squad, state.creatures) : undefined;
  const saverInfo = squad ? squadSaver : creature ? moraleSaver(creature) : undefined;
  const strength = squad
    ? { standing: squadStandingCount(squad, state.creatures), starting: squad.startingCount }
    : creature?.stack ? { standing: creature.stack.bodies, starting: creature.stack.size } : undefined;
  const name = squad?.name ?? creature?.name ?? '';
  const reason = moraleTriggerText(prompt, strength);
  const bonus = saverInfo?.bonus ?? 0;
  const bonusText = `WIS ${bonus < 0 ? '−' : '+'}${Math.abs(bonus)}`;
  const who = !saverInfo
    ? 'No one standing can save: dismiss it, or mark it as failing'
    : squadSaver?.usingLeader
      ? `${saverInfo.saver.name} (leader) saves for the squad: ${bonusText}`
      : squad
        ? `Leader down: ${saverInfo.saver.name} saves (VVTT rule: largest standing stack): ${bonusText}`
        : `${bonusText} save`;

  const resolve = (outcome: MoraleOutcome) => {
    const fled = outcome.kind === 'auto' || !outcome.success;
    const log = formatMoraleLog(name, reason, outcome);
    dispatch({ type: 'RESOLVE_MORALE', payload: { promptId: prompt.id, fled, log } });
    onResolved(log, fled);
  };

  const handleRoll = () => {
    if (!saverInfo) return;
    const r = rollMorale({ bonus, disadvantage, roll: rollDie });
    resolve({ kind: 'roll', saverName: saverInfo.saver.name, bonus, ...r });
  };

  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={600}>{name}: {reason}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {who} · DC {MORALE_DC} (DMG 2014 p. 273)
      </Typography>
      {prompt.trigger === 'half-size' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {squad ? 'VVTT rule: half strength counts each stack body and each individual as 1. ' : ''}DMG: only if the other side has had no losses — dismiss otherwise.
        </Typography>
      )}
      <FormControlLabel
        control={<Switch size="small" checked={disadvantage} onChange={(e) => setDisadvantage(e.target.checked)} />}
        label={<Typography variant="caption">Disadvantage (overwhelming opposition)</Typography>}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={handleRoll} disabled={!saverInfo}>Roll</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => resolve({ kind: 'auto' })}>Fails automatically</Button>
        <Button size="small" onClick={() => dispatch({ type: 'DISMISS_MORALE', payload: { promptId: prompt.id } })}>Dismiss</Button>
      </Stack>
    </Box>
  );
}
