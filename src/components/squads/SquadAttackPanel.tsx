import { useMemo, useState } from 'react';
import { Box, Button, Collapse, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';
import {
  parseActionDamage, parseMultiattackCount, rollGroupAttack, adjustForDefenses,
  formatGroupAttack, formatAttackRolls, type DamagePart, type GroupAttackResult,
} from '../../utils/stack';
import { rollDie } from '../../utils/diceEngine';

type TargetKey = `c:${string}` | `v:${string}`;

/** On a squad's turn: pick action + target, roll every attack, then apply hit by hit through the target's own damage path. */
export function SquadAttackPanel({ squad }: { squad: Creature }) {
  const { state, dispatch } = useCombat();
  const attacks = useMemo(() => (squad.statblock.actions ?? []).filter((a) => typeof a.attackBonus === 'number'), [squad.statblock.actions]);
  const bodies = squad.stack?.bodies ?? 0;

  const targets = useMemo(() => [
    ...state.creatures
      .filter((c) => c.id !== squad.id && (c.currentHp > 0 || c.statblock.type === 'pc'))
      .map((c) => ({ key: `c:${c.id}` as TargetKey, label: c.name, ac: c.statblock.ac })),
    ...state.vehicles
      .filter((v) => v.currentHp > 0 && !v.isInoperative)
      .map((v) => ({ key: `v:${v.id}` as TargetKey, label: v.name, ac: v.template.ac })),
  ], [state.creatures, state.vehicles, squad.id]);

  const [actionName, setActionName] = useState(attacks[0]?.name ?? '');
  const [targetKey, setTargetKey] = useState<TargetKey | ''>('');
  const [ac, setAc] = useState(10);
  const [attackers, setAttackers] = useState(bodies);
  const [attacksEach, setAttacksEach] = useState(() => parseMultiattackCount(squad.statblock));
  const [manualDamage, setManualDamage] = useState(0);
  const [result, setResult] = useState<{ r: GroupAttackResult; ac: number } | null>(null);
  const [applied, setApplied] = useState(false);
  const [showRolls, setShowRolls] = useState(false);

  if (bodies === 0) return null;
  if (attacks.length === 0) {
    return <Typography variant="caption" color="text.secondary">Squad attack: this statblock has no actions with a to-hit bonus.</Typography>;
  }

  const action = attacks.find((a) => a.name === actionName) ?? attacks[0];
  const parsed = parseActionDamage(action);
  const damage: DamagePart[] = parsed.length > 0 ? parsed : [{ count: 0, sides: 0, bonus: manualDamage, type: '' }];
  const target = targets.find((t) => t.key === targetKey);

  const clearResult = () => { setResult(null); setApplied(false); };

  const handleTarget = (key: TargetKey) => {
    setTargetKey(key);
    clearResult();
    const t = targets.find((x) => x.key === key);
    if (t) setAc(t.ac);
  };

  const handleRoll = () => {
    const r = rollGroupAttack({ attackBonus: action.attackBonus ?? 0, ac, damage, attacks: Math.max(0, attackers) * Math.max(1, attacksEach), roll: rollDie });
    setResult({ r, ac });
    setApplied(false);
    setShowRolls(false);
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'attack',
        action: formatGroupAttack({ attackerName: squad.name, actionName: action.name, ac, result: r }) + (target ? ` (${target.label})` : ''),
        details: formatAttackRolls(r),
      },
    });
  };

  const handleApply = () => {
    if (!result || !target) return;
    const source = `${squad.name} (${action.name})`;
    const id = target.key.slice(2);
    const hitRolls = result.r.rolls.filter((r) => r.hit);
    if (target.key.startsWith('v:')) {
      hitRolls.forEach((r) => {
        const amount = r.damage.reduce((sum, d) => sum + d.amount, 0);
        if (amount > 0) dispatch({ type: 'DEAL_DAMAGE_TO_VEHICLE', payload: { vehicleId: id, amount, source } });
      });
    } else {
      const victim = state.creatures.find((c) => c.id === id);
      if (!victim) return;
      const perHit = hitRolls.map((r) => r.damage.reduce((sum, d) => sum + adjustForDefenses(d.amount, d.type, victim.statblock), 0));
      if (victim.stack) {
        dispatch({ type: 'SQUAD_HIT', payload: { memberId: id, hits: perHit, source } });
      } else {
        perHit.filter((a) => a > 0).forEach((amount) => dispatch({ type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: id, amount, source } }));
      }
    }
    setApplied(true);
  };

  const num = (v: string) => Math.max(0, parseInt(v) || 0);
  return (
    <Box sx={{ mt: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>Squad attack</Typography>
      <Stack spacing={1}>
        <TextField select size="small" label="Action" value={action.name} onChange={(e) => { setActionName(e.target.value); clearResult(); }}>
          {attacks.map((a) => <MenuItem key={a.name} value={a.name}>{a.name} (+{a.attackBonus})</MenuItem>)}
        </TextField>
        {parsed.length === 0 && (
          <TextField size="small" type="number" label="Damage per hit" value={manualDamage} onChange={(e) => setManualDamage(num(e.target.value))}
            helperText="Couldn't read this action's damage; enter it" />
        )}
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Target" value={targetKey} onChange={(e) => handleTarget(e.target.value as TargetKey)} sx={{ flex: 2 }}>
            {targets.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" label="AC" value={ac} onChange={(e) => { setAc(num(e.target.value)); clearResult(); }} sx={{ flex: 1 }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField size="small" type="number" label={`Attackers (of ${bodies})`} value={attackers} onChange={(e) => { setAttackers(Math.min(bodies, num(e.target.value))); clearResult(); }} sx={{ flex: 1 }} />
          <TextField size="small" type="number" label="Attacks each" value={attacksEach} onChange={(e) => { setAttacksEach(Math.max(1, num(e.target.value))); clearResult(); }} sx={{ flex: 1 }} />
        </Stack>
        <Button variant="contained" size="small" onClick={handleRoll} disabled={attackers === 0 || !target}>Roll {Math.max(0, attackers) * Math.max(1, attacksEach)} attacks</Button>
        {result && (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {formatGroupAttack({ attackerName: squad.name, actionName: action.name, ac: result.ac, result: result.r })}
            </Typography>
            <Button size="small" onClick={() => setShowRolls((s) => !s)} sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }}>
              {showRolls ? 'Hide rolls' : 'Show rolls'}
            </Button>
            <Collapse in={showRolls}>
              <Typography variant="caption" color="text.secondary">{formatAttackRolls(result.r)}</Typography>
            </Collapse>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Button size="small" variant="outlined" color="error" onClick={handleApply} disabled={!target || applied || result.r.hits === 0}>
                {applied ? 'Applied' : `Apply to ${target?.label ?? '…'}`}
              </Button>
              {!target && <Typography variant="caption" color="text.secondary">Pick a target to apply</Typography>}
            </Stack>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          VVTT rule: attackers default to every standing body; lower it if not all can reach.
        </Typography>
      </Stack>
    </Box>
  );
}
