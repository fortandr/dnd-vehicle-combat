import { v4 as uuid } from 'uuid';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCombat } from '../../context/CombatContext';
import { newSquadName } from '../../utils/squads';
import { SquadCard } from './SquadCard';

/** The Squads tab: build squads on purpose, then staff them like vehicles. */
export function SquadsView() {
  const { state, dispatch } = useCombat();
  const addSquad = () =>
    dispatch({ type: 'ADD_SQUAD', payload: { id: uuid(), name: newSquadName(state.squads), faction: 'enemy', memberIds: [], startingCount: 0 } });
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addSquad}>New squad</Button>
      </Box>
      {state.squads.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" gutterBottom>No squads yet</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              A squad takes one initiative slot and one map token. Staff it with individuals or stacks (e.g. Hobgoblin ×8), mix creature types, and give it a PC commander if you like.
            </Typography>
            <Button variant="outlined" size="small" onClick={addSquad}>+ New squad</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {state.squads.map((squad, index) => <SquadCard key={squad.id} squad={squad} index={index} />)}
        </Stack>
      )}
    </Box>
  );
}
