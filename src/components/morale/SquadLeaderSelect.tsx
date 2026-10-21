import { MenuItem, TextField } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';

/** Pick the creature that leads a squad for morale (DMG 2014 p. 273). Same faction, not a squad. */
export function SquadLeaderSelect({ squad, value, onChange }: { squad: Creature; value: string; onChange: (id: string) => void }) {
  const { state } = useCombat();
  const options = state.creatures.filter((c) => c.id !== squad.id && !c.stack && c.faction === squad.faction && c.currentHp > 0);
  const current = value ? state.creatures.find((c) => c.id === value) : undefined;
  const list = current && !options.includes(current) ? [current, ...options] : options;
  return (
    <TextField
      select size="small" fullWidth label="Leader" value={list.some((c) => c.id === value) ? value : ''}
      onChange={(e) => onChange(e.target.value)} helperText="Rolls this squad's morale (DMG 2014 p. 273)"
    >
      <MenuItem value="">(none)</MenuItem>
      {list.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
    </TextField>
  );
}
