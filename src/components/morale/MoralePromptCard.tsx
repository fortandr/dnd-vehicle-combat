import { useState } from 'react';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoralePrompt } from '../../types';
import { moraleSaver, rollMorale, formatMoraleLog, moraleTriggerText, MORALE_DC, type MoraleOutcome } from '../../utils/morale';
import { rollDie } from '../../utils/diceEngine';

/** One open morale check (DMG 2014 p. 273): Roll, Fails automatically, or Dismiss. */
export function MoralePromptCard({ prompt, onResolved }: { prompt: MoralePrompt; onResolved: (text: string, fled: boolean) => void }) {
  const { state, dispatch } = useCombat();
  const [disadvantage, setDisadvantage] = useState(false);
  const creature = state.creatures.find((c) => c.id === prompt.creatureId);
  if (!creature) return null;

  const { saver, bonus, usingLeader } = moraleSaver(creature, state.creatures);
  const reason = moraleTriggerText(prompt, creature);
  const bonusText = `WIS ${bonus < 0 ? '−' : '+'}${Math.abs(bonus)}`;
  const who = usingLeader
    ? `${saver.name} saves for the squad: ${bonusText}`
    : creature.stack
      ? `No leader standing — the squad saves (VVTT rule): ${bonusText}`
      : `${bonusText} save`;

  const resolve = (outcome: MoraleOutcome) => {
    const fled = outcome.kind === 'auto' || !outcome.success;
    const log = formatMoraleLog(creature.name, reason, outcome);
    dispatch({ type: 'RESOLVE_MORALE', payload: { promptId: prompt.id, fled, log } });
    onResolved(log, fled);
  };

  const handleRoll = () => {
    const r = rollMorale({ bonus, disadvantage, roll: rollDie });
    resolve({ kind: 'roll', saverName: saver.name, bonus, ...r });
  };

  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={600}>{creature.name}: {reason}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {who} · DC {MORALE_DC} (DMG 2014 p. 273)
      </Typography>
      {prompt.trigger === 'half-size' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          DMG: only if the other side has had no losses — dismiss otherwise.
        </Typography>
      )}
      <FormControlLabel
        control={<Switch size="small" checked={disadvantage} onChange={(e) => setDisadvantage(e.target.checked)} />}
        label={<Typography variant="caption">Disadvantage (overwhelming opposition)</Typography>}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={handleRoll}>Roll</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => resolve({ kind: 'auto' })}>Fails automatically</Button>
        <Button size="small" onClick={() => dispatch({ type: 'DISMISS_MORALE', payload: { promptId: prompt.id } })}>Dismiss</Button>
      </Stack>
    </Box>
  );
}
