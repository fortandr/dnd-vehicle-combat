import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { Creature } from '../../types';
import { makeCustomNpc } from '../../utils/customNpc';

/** The custom-NPC form in staff mode: quantity 1 adds an individual, 2 or more adds one stack. */
export function CustomNpcDialog({ open, onClose, maxQuantity, onAdd }: {
  open: boolean; onClose: () => void; maxQuantity: number; onAdd: (creature: Creature, qty: number) => void;
}) {
  const [name, setName] = useState('');
  const [hp, setHp] = useState(30);
  const [ac, setAc] = useState(14);
  const [speed, setSpeed] = useState(30);
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    onAdd(makeCustomNpc({ name: name.trim(), hp, ac, speed }), qty);
    setName('');
    setQty(1);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Custom NPC</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="HP" type="number" value={hp} onChange={(e) => setHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
            <TextField size="small" label="AC" type="number" value={ac} onChange={(e) => setAc(parseInt(e.target.value) || 10)} sx={{ flex: 1 }} />
            <TextField size="small" label="Speed" type="number" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
          </Stack>
          <TextField
            size="small" label="Quantity" type="number" value={qty} inputProps={{ min: 1, max: maxQuantity }}
            onChange={(e) => setQty(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
          />
          <Typography variant="caption" color="text.secondary">
            {qty > 1 ? `Adds one stack: ${qty} bodies on one row (e.g. "${name || 'Guard'} ×${qty}").` : 'Adds one individual.'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!name.trim()}>Add to squad</Button>
      </DialogActions>
    </Dialog>
  );
}
