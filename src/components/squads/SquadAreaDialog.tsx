import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem,
  FormControlLabel, Switch, Typography, Table, TableBody, TableRow, TableCell, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { AbilityName, Creature, DmgEdition } from '../../types';
import {
  AOE_SHAPES, aoeTargetCount, aoeAdvice, resolveSquadArea, formatAreaSummary, DAMAGE_TYPES, damageNotation,
  type AoeShape, type SquadAreaResult,
} from '../../utils/squad';
import { rollDie, roll } from '../../utils/diceEngine';

const ABILITIES: AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function SquadAreaDialog({ creature, open, onClose }: { creature: Creature; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useCombat();
  const edition: DmgEdition = state.dmgEdition ?? '2014';
  const [width, setWidth] = useState(5);
  const bodies = creature.squad?.bodies ?? 0;
  const [source, setSource] = useState('Area effect');
  const [shape, setShape] = useState<AoeShape>('sphere');
  const [size, setSize] = useState(20);
  const [caughtOverride, setCaughtOverride] = useState<number | null>(null);
  const [ability, setAbility] = useState<AbilityName>('dex');
  const [dc, setDc] = useState(15);
  const [damageText, setDamageText] = useState('8d6');
  const [damageType, setDamageType] = useState('');
  const [halfOnSave, setHalfOnSave] = useState(true);
  const [magical, setMagical] = useState(false);
  const [result, setResult] = useState<{ damage: number; area: SquadAreaResult } | null>(null);

  const suggested = Math.min(aoeTargetCount(shape, size, edition, width), bodies);
  const advice = aoeAdvice(edition);
  const caught = Math.min(caughtOverride ?? suggested, bodies);
  const damagePreview = damageNotation(damageText);
  const sizeLabel = AOE_SHAPES.find((s) => s.value === shape)?.sizeLabel ?? 'Size (ft)';

  const handleApply = () => {
    const notation = damageNotation(damageText);
    if (notation === null) return;
    let damage: number;
    try {
      damage = /^\d+$/.test(notation) ? Number(notation) : roll(notation).total;
    } catch {
      return;
    }
    const area = resolveSquadArea({ creature, caught, dc, ability, damage, halfOnSave, damageType, magical, roll: rollDie });
    const details = `${damage}${damageType ? ` ${damageType}` : ''} damage, DC ${dc} ${ability.toUpperCase()} save: ` +
      area.saves.map((s) => `${s.d20} (${s.total}) ${s.success ? 'save' : 'fail'} −${s.taken}${s.fell ? ' falls' : ''}`).join('; ');
    dispatch({
      type: 'SQUAD_AREA',
      payload: {
        creatureId: creature.id,
        currentHp: area.currentHp,
        bodies: area.bodies,
        summary: formatAreaSummary(source || 'Area effect', area, creature.squad?.size ?? bodies),
        details,
      },
    });
    setResult({ damage, area });
  };

  const handleClose = () => {
    setResult(null);
    setCaughtOverride(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Area effect on {creature.name}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {formatAreaSummary(source || 'Area effect', result.area, creature.squad?.size ?? bodies)}
            </Typography>
            <Table size="small">
              <TableBody>
                {result.area.saves.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>Body {i + 1}</TableCell>
                    <TableCell>{s.d20} ({s.total}) {s.success ? 'save' : 'fail'}</TableCell>
                    <TableCell>−{s.taken}</TableCell>
                    <TableCell>{s.fell ? 'falls' : 'stands'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">DMG rules</Typography>
              <ToggleButtonGroup
                size="small" exclusive value={edition}
                onChange={(_, value: DmgEdition | null) => {
                  if (!value) return;
                  dispatch({ type: 'SET_DMG_EDITION', payload: { edition: value } });
                  setCaughtOverride(null);
                }}
              >
                <ToggleButton value="2014" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2014</ToggleButton>
                <ToggleButton value="2024" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2024</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TextField size="small" label="Effect" value={source} onChange={(e) => setSource(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Shape" value={shape} onChange={(e) => { setShape(e.target.value as AoeShape); setCaughtOverride(null); }} sx={{ flex: 2 }}>
                {AOE_SHAPES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label={sizeLabel} value={size} onChange={(e) => { setSize(Math.max(0, parseInt(e.target.value) || 0)); setCaughtOverride(null); }} sx={{ flex: 1 }} />
            </Stack>
            {shape === 'line' && edition === '2024' && (
              <TextField size="small" type="number" label="Width (ft)" value={width}
                onChange={(e) => { setWidth(Math.max(5, parseInt(e.target.value) || 5)); setCaughtOverride(null); }} />
            )}
            <TextField
              size="small" type="number" label="Bodies caught" value={caught}
              onChange={(e) => setCaughtOverride(Math.max(0, parseInt(e.target.value) || 0))}
              helperText={`${advice.citation} suggests ${suggested} — ${advice.advice} (${bodies} left)${edition === '2024' ? '. VVTT rule: sizes between rows use the row below' : ''}`}
            />
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Save" value={ability} onChange={(e) => setAbility(e.target.value as AbilityName)} sx={{ flex: 1 }}>
                {ABILITIES.map((a) => <MenuItem key={a} value={a}>{a.toUpperCase()}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="DC" value={dc} onChange={(e) => setDc(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small" label="Damage" value={damageText} onChange={(e) => setDamageText(e.target.value)} sx={{ flex: 1 }}
                error={damagePreview === null} helperText="A number, or dice rolled once (e.g. 8d6)"
              />
              <TextField select size="small" label="Type" value={damageType} onChange={(e) => setDamageType(e.target.value)} sx={{ flex: 1 }}>
                <MenuItem value="">(none)</MenuItem>
                {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Stack>
            <FormControlLabel control={<Switch checked={halfOnSave} onChange={(e) => setHalfOnSave(e.target.checked)} />} label="Half damage on a successful save" />
            <FormControlLabel control={<Switch checked={magical} onChange={(e) => setMagical(e.target.checked)} />} label="Magical damage" />
            <Typography variant="caption" color="text.secondary">
              VVTT rule: the wounded front body is caught first; of the bodies left wounded, the most hurt becomes the new front body.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button onClick={handleClose} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleApply} variant="contained" disabled={damagePreview === null || caught === 0}>Roll saves &amp; apply</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
