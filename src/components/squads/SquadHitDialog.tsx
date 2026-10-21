import { useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { adjustForDefenses, DAMAGE_TYPES } from '../../utils/stack';
import { defaultHitTarget, isStanding, squadMembers } from '../../utils/squads';

/** Single-target hits on a squad: pick the member (VVTT rule 1 default) and the damage. */
export function SquadHitDialog({ squad, open, onClose }: { squad: Squad; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useCombat();
  const members = squadMembers(squad, state.creatures).filter(isStanding);
  const [memberId, setMemberId] = useState(() => defaultHitTarget(squad, state.creatures)?.id ?? '');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const [type, setType] = useState('');
  const [magical, setMagical] = useState(false);
  const member = members.find((m) => m.id === memberId);
  const value = parseInt(amount, 10);
  const n = Math.max(1, parseInt(count, 10) || 1);
  const valid = member !== undefined && !isNaN(value) && value > 0;

  const handleApply = () => {
    if (!member || !valid) return;
    const each = adjustForDefenses(value, type, member.statblock, magical);
    dispatch({
      type: 'SQUAD_HIT',
      payload: { squadId: squad.id, memberId: member.id, hits: Array(n).fill(each), source: `${value}${type ? ` ${type}` : ''} × ${n}` },
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Hit {squad.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            select size="small" label="Member hit" value={member ? memberId : ''} onChange={(e) => setMemberId(e.target.value)}
            helperText="VVTT rule: in 5e the attacker picks the target; the default is the largest stack (the front rank), never the leader."
          >
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {squad.leaderId === m.id ? '★ ' : ''}{m.name}{m.stack ? ` (${m.stack.bodies} bodies)` : ` (${m.currentHp} HP)`}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField size="small" type="number" label="Damage" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ flex: 1 }} autoFocus />
            <TextField size="small" type="number" label="Hits" value={count} onChange={(e) => setCount(e.target.value)} sx={{ flex: 1 }} />
            <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value)} sx={{ flex: 1 }}>
              <MenuItem value="">(none)</MenuItem>
              {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Stack>
          <FormControlLabel control={<Checkbox size="small" checked={magical} onChange={(e) => setMagical(e.target.checked)} />} label="Magical" />
          {member?.stack && (
            <Typography variant="caption" color="text.secondary">
              VVTT rule: each hit damages the stack's front body only; a body that falls loses its overkill.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleApply} disabled={!valid}>Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
