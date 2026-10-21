import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';
import { adjustForDefenses, DAMAGE_TYPES } from '../../utils/stack';
import { SquadAreaDialog } from './SquadAreaDialog';

/** Sidebar row controls for a squad: Hit [dmg] × [n] (single-target hits), Heal (front body), Area… */
export function SquadRowControls({ creature }: { creature: Creature }) {
  const { dispatch } = useCombat();
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const [type, setType] = useState('');
  const [magical, setMagical] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const value = parseInt(amount, 10);
  const n = Math.max(1, parseInt(count, 10) || 1);
  const valid = !isNaN(value) && value > 0;
  const wiped = (creature.stack?.bodies ?? 0) === 0;

  const handleHit = () => {
    if (!valid) return;
    const each = adjustForDefenses(value, type, creature.statblock, magical);
    dispatch({ type: 'SQUAD_HITS', payload: { creatureId: creature.id, hits: Array(n).fill(each), source: type ? `${value} ${type} × ${n}` : undefined } });
    setAmount('');
    setCount('1');
  };

  const handleHeal = () => {
    if (!valid) return;
    dispatch({ type: 'HEAL_CREATURE', payload: { creatureId: creature.id, amount: value } });
    setAmount('');
  };

  const small = { style: { textAlign: 'center' as const, padding: '3px', fontSize: '0.7rem' } };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      <TextField type="number" size="small" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="dmg"
        sx={{ width: 50 }} inputProps={{ min: 1, ...small }} onKeyDown={(e) => { if (e.key === 'Enter') handleHit(); }} />
      <Typography variant="caption" color="text.secondary">×</Typography>
      <TextField type="number" size="small" value={count} onChange={(e) => setCount(e.target.value)}
        sx={{ width: 40 }} inputProps={{ min: 1, ...small }} />
      <TextField select size="small" value={type} onChange={(e) => setType(e.target.value)} sx={{ width: 78 }}
        SelectProps={{ displayEmpty: true }} inputProps={{ style: { fontSize: '0.7rem', padding: '3px' } }}>
        <MenuItem value=""><em>type</em></MenuItem>
        {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
      </TextField>
      <FormControlLabel
        sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.65rem' } }}
        control={<Checkbox size="small" checked={magical} onChange={(e) => setMagical(e.target.checked)} sx={{ p: 0.25, '& .MuiSvgIcon-root': { fontSize: 14 } }} />}
        label="Magical" title="Tick for magic weapons or spells, so resistances to nonmagical attacks don't apply" />
      <Button size="small" color="error" variant="outlined" onClick={handleHit} disabled={!valid || wiped}
        sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: '0.65rem' }} title="Single-target hits: each damages the front body only">
        Hit
      </Button>
      <IconButton size="small" color="success" onClick={handleHeal} disabled={!valid || wiped} title="Heal the front body (never revives)" sx={{ p: 0.25 }}>
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Button size="small" variant="outlined" onClick={() => setAreaOpen(true)} disabled={wiped}
        sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: '0.65rem' }}>
        Area…
      </Button>
      {areaOpen && <SquadAreaDialog creature={creature} open={areaOpen} onClose={() => setAreaOpen(false)} />}
    </Box>
  );
}
