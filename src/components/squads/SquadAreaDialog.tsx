import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem,
  FormControlLabel, Switch, Typography, Table, TableBody, TableRow, TableCell, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useCombat, type SquadAreaMemberResult } from '../../context/CombatContext';
import type { AbilityName, Creature, DmgEdition } from '../../types';
import {
  AOE_SHAPES, aoeTargetCount, aoeAdvice, resolveStackArea, formatAreaSummary, DAMAGE_TYPES, damageNotation,
  type AoeShape, type AreaSave,
} from '../../utils/stack';
import { formatSquadAreaSummary, isStanding, resolveIndividualArea, splitAreaCount, squadStandingCount, standingCount } from '../../utils/squads';
import { rollDie, roll } from '../../utils/diceEngine';

const ABILITIES: AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface MemberOutcome { member: Creature; saves: AreaSave[]; fell: number }

/**
 * Area effect on a squad (or a lone stack). The suggested total comes from DMG 2014 p. 249 / DMG 2024 p. 82, is capped
 * at the standing count, and is split across members by VVTT rule 2. Every count is editable. Damage is rolled once;
 * each caught body saves with its own member's bonus, and magical and resistances apply per member.
 */
export function SquadAreaDialog({ members, title, squadId, open, onClose }: {
  members: Creature[]; title: string; squadId?: string; open: boolean; onClose: () => void;
}) {
  const { state, dispatch } = useCombat();
  const edition: DmgEdition = state.dmgEdition ?? '2014';
  const [widthText, setWidthText] = useState('5');
  const width = Math.max(5, parseInt(widthText) || 5);
  const [source, setSource] = useState('Area effect');
  const [shape, setShape] = useState<AoeShape>('sphere');
  const [size, setSize] = useState(20);
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [memberOverrides, setMemberOverrides] = useState<Record<string, number>>({});
  const [ability, setAbility] = useState<AbilityName>('dex');
  const [dc, setDc] = useState(15);
  const [damageText, setDamageText] = useState('8d6');
  const [damageType, setDamageType] = useState('');
  const [halfOnSave, setHalfOnSave] = useState(true);
  const [magical, setMagical] = useState(false);
  const [outcome, setOutcome] = useState<{ summary: string; rows: MemberOutcome[] } | null>(null);

  const squad = squadId ? state.squads.find((s) => s.id === squadId) : undefined;
  const totalStanding = members.reduce((sum, m) => sum + standingCount(m), 0);
  const suggested = Math.min(aoeTargetCount(shape, size, edition, width), totalStanding);
  const advice = aoeAdvice(edition);
  const total = Math.min(totalOverride ?? suggested, totalStanding);
  const split = new Map(splitAreaCount(total, members).map((a) => [a.memberId, a.caught]));
  const caughtOf = (m: Creature) => Math.min(memberOverrides[m.id] ?? split.get(m.id) ?? 0, standingCount(m));
  const caughtSum = members.reduce((sum, m) => sum + caughtOf(m), 0);
  const damagePreview = damageNotation(damageText);
  const sizeLabel = AOE_SHAPES.find((s) => s.value === shape)?.sizeLabel ?? 'Size (ft)';
  const resetCounts = () => { setTotalOverride(null); setMemberOverrides({}); };

  const handleApply = () => {
    const notation = damageNotation(damageText);
    if (notation === null) return;
    let damage: number;
    try {
      damage = /^\d+$/.test(notation) ? Number(notation) : roll(notation).total;
    } catch {
      return;
    }
    const results: SquadAreaMemberResult[] = [];
    const rows: MemberOutcome[] = [];
    let stackSummary = '';
    for (const m of members) {
      const caught = caughtOf(m);
      if (caught === 0) continue;
      if (m.stack) {
        const area = resolveStackArea({ creature: m, caught, dc, ability, damage, halfOnSave, damageType, magical, roll: rollDie });
        results.push({ memberId: m.id, currentHp: area.currentHp, bodies: area.bodies });
        rows.push({ member: m, saves: area.saves, fell: area.fell });
        stackSummary = formatAreaSummary(source || 'Area effect', area, m.stack.size);
      } else {
        const r = resolveIndividualArea({ creature: m, dc, ability, damage, halfOnSave, damageType, magical, roll: rollDie });
        results.push({ memberId: m.id, currentHp: r.currentHp, tempHp: r.tempHp });
        rows.push({ member: m, saves: [r.save], fell: r.save.fell ? 1 : 0 });
      }
    }
    const caught = rows.reduce((sum, r) => sum + r.saves.length, 0);
    const failed = rows.reduce((sum, r) => sum + r.saves.filter((s) => !s.success).length, 0);
    const fell = rows.reduce((sum, r) => sum + r.fell, 0);
    const summary = squad
      ? formatSquadAreaSummary(source || 'Area effect', squad.name, { caught, failed, fell }, squadStandingCount(squad, state.creatures) - fell, squad.startingCount)
      : stackSummary || `${source || 'Area effect'}: ${caught} caught, ${failed} failed`;
    const saveText = (s: AreaSave) => `${s.d20} (${s.total}) ${s.success ? 'save' : 'fail'} −${s.taken}${s.fell ? ' falls' : ''}`;
    const details = `${damage}${damageType ? ` ${damageType}` : ''} damage, DC ${dc} ${ability.toUpperCase()} save: ` +
      (squad
        ? rows.map((r) => `${r.member.name}: ${r.saves.map(saveText).join(', ')}`).join('; ')
        : rows.flatMap((r) => r.saves.map(saveText)).join('; '));
    dispatch({ type: 'SQUAD_AREA', payload: { squadId, members: results, summary, details } });
    setOutcome({ summary, rows });
  };

  const handleClose = () => {
    setOutcome(null);
    resetCounts();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {outcome ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={600}>{outcome.summary}</Typography>
            <Table size="small">
              <TableBody>
                {outcome.rows.flatMap((r) => r.saves.map((s, i) => (
                  <TableRow key={`${r.member.id}-${i}`}>
                    <TableCell>{r.member.stack ? `${r.member.name} body ${i + 1}` : r.member.name}</TableCell>
                    <TableCell>{s.d20} ({s.total}) {s.success ? 'save' : 'fail'}</TableCell>
                    <TableCell>−{s.taken}</TableCell>
                    <TableCell>{s.fell ? 'falls' : 'stands'}</TableCell>
                  </TableRow>
                )))}
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
                  resetCounts();
                }}
              >
                <ToggleButton value="2014" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2014</ToggleButton>
                <ToggleButton value="2024" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2024</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TextField size="small" label="Effect" value={source} onChange={(e) => setSource(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Shape" value={shape} onChange={(e) => { setShape(e.target.value as AoeShape); resetCounts(); }} sx={{ flex: 2 }}>
                {AOE_SHAPES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label={sizeLabel} value={size} onChange={(e) => { setSize(Math.max(0, parseInt(e.target.value) || 0)); resetCounts(); }} sx={{ flex: 1 }} />
            </Stack>
            {shape === 'line' && edition === '2024' && (
              <TextField size="small" type="number" label="Width (ft)" value={widthText} inputProps={{ min: 5, step: 5 }}
                onChange={(e) => { setWidthText(e.target.value); resetCounts(); }} />
            )}
            <TextField
              size="small" type="number" label={members.length > 1 ? 'Caught in total' : 'Bodies caught'}
              value={Object.keys(memberOverrides).length > 0 ? caughtSum : total}
              onChange={(e) => { setTotalOverride(Math.max(0, parseInt(e.target.value) || 0)); setMemberOverrides({}); }}
              helperText={`${advice.citation} suggests ${suggested} — ${advice.advice} (${totalStanding} standing)${edition === '2024' ? '. VVTT rule: sizes between rows use the row below' : ''}`}
            />
            {members.length > 1 && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  VVTT rule: the total is split by standing bodies (an individual counts 1, largest remainder). Edit any member's count.
                </Typography>
                {members.filter(isStanding).map((m) => (
                  <TextField
                    key={m.id} size="small" type="number" label={`${m.name} (of ${standingCount(m)})`} value={caughtOf(m)}
                    onChange={(e) => setMemberOverrides((o) => ({ ...o, [m.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                ))}
              </Stack>
            )}
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
              Each caught body saves with its own member's bonus. VVTT rule: in a stack, the wounded front body is caught first; of the bodies left wounded, the most hurt becomes the new front body.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {outcome ? (
          <Button onClick={handleClose} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleApply} variant="contained" disabled={damagePreview === null || caughtSum === 0}>Roll saves &amp; apply</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
