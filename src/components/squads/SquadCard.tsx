import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useCombat } from '../../context/CombatContext';
import type { Creature, Squad, SquadUpdates } from '../../types';
import { isHalfStrength, isStanding, squadMembers, squadStandingCount, staffableCreatures, toStaffMember } from '../../utils/squads';
import { convertOpen5eToCreature } from '../../services/open5e';
import { factionColors } from '../../theme/customColors';
import { MonsterSearchDialog } from '../creatures/MonsterSearchDialog';
import { StatblockDialog } from '../statblocks/StatblockDialog';
import { CustomNpcDialog } from './CustomNpcDialog';
import { SquadMoraleControls } from './SquadMoraleControls';
import { SquadHitDialog } from './SquadHitDialog';
import { SquadAreaDialog } from './SquadAreaDialog';

const STAFF_MAX = 50; // fits the tower's 40 hobgoblins

/** One squad on the Squads tab: name, faction, initiative, commander, members, staffing, map placement, morale. */
export function SquadCard({ squad, index }: { squad: Squad; index: number }) {
  const { state, dispatch } = useCombat();
  const members = squadMembers(squad, state.creatures);
  const standing = squadStandingCount(squad, state.creatures);
  const commander = squad.commanderId ? state.creatures.find((c) => c.id === squad.commanderId) : undefined;
  const pcOptions = state.creatures.filter((c) =>
    c.statblock.type === 'pc' && c.faction === 'party' && !squad.memberIds.includes(c.id)
    && !state.squads.some((s) => s.id !== squad.id && s.commanderId === c.id));
  const existing = staffableCreatures(state.creatures, state.squads, state.crewAssignments);
  const stacks = members.filter((m) => m.stack);
  const color = squad.faction === 'party' ? factionColors.party : factionColors.enemy;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(squad.name);
  const [squadMenu, setSquadMenu] = useState<HTMLElement | null>(null);
  const [staffMenu, setStaffMenu] = useState<HTMLElement | null>(null);
  const [existingMenu, setExistingMenu] = useState<HTMLElement | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ anchor: HTMLElement; member: Creature } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [growOpen, setGrowOpen] = useState(false);
  const [growId, setGrowId] = useState('');
  const [growBy, setGrowBy] = useState(1);
  const [viewing, setViewing] = useState<Creature | null>(null);
  const [hitOpen, setHitOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);

  const update = (updates: SquadUpdates) => dispatch({ type: 'UPDATE_SQUAD', payload: { id: squad.id, updates } });
  const staff = (base: Creature, qty: number) =>
    dispatch({ type: 'ADD_SQUAD_MEMBER', payload: { squadId: squad.id, creature: toStaffMember(base, qty, state.creatures) } });
  const saveName = () => {
    const name = nameDraft.trim();
    if (name) update({ name });
    setEditingName(false);
  };
  const closeMemberMenu = () => setMemberMenu(null);
  const member = memberMenu?.member;

  return (
    <Card sx={{ borderLeft: 4, borderColor: color }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header: name, faction, initiative, morale, squad menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {editingName ? (
            <TextField
              size="small" autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            />
          ) : (
            <Typography variant="h6" sx={{ cursor: 'pointer' }} onClick={() => { setNameDraft(squad.name); setEditingName(true); }}>
              {squad.name} <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Typography>
          )}
          <TextField
            select size="small" value={squad.faction} onChange={(e) => update({ faction: e.target.value as Squad['faction'] })}
            sx={{ width: 110 }}
          >
            <MenuItem value="enemy">Enemy</MenuItem>
            <MenuItem value="party">Party</MenuItem>
          </TextField>
          {commander ? (
            <Tooltip title="VVTT rule: a commanded squad acts immediately after its commander" arrow>
              <Chip size="small" label={`Init: after ${commander.name}`} />
            </Tooltip>
          ) : (
            <Tooltip title="VVTT rule: d20 + the leader's DEX modifier (else the first member's). The Roll Init buttons roll it." arrow>
              <TextField
                size="small" type="number" label="Init" value={squad.initiative ?? ''} sx={{ width: 80 }}
                onChange={(e) => { const n = parseInt(e.target.value, 10); update({ initiative: Number.isFinite(n) ? n : undefined }); }}
              />
            </Tooltip>
          )}
          <Chip size="small" label={`${standing}/${squad.startingCount} standing`} />
          {state.phase === 'combat' && isHalfStrength(squad, state.creatures) && (
            <Chip size="small" color="warning" label="Half strength (VVTT rule)" />
          )}
          <Box sx={{ flex: 1 }} />
          <SquadMoraleControls squad={squad} />
          <IconButton size="small" onClick={(e) => setSquadMenu(e.currentTarget)} aria-label="Squad menu">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Commander */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">Commander:</Typography>
          <TextField
            select size="small" value={squad.commanderId ?? ''} sx={{ minWidth: 180 }}
            onChange={(e) => update({ commanderId: e.target.value || undefined })}
          >
            <MenuItem value="">— (none)</MenuItem>
            {commander && <MenuItem value={commander.id}>{commander.name}</MenuItem>}
            {pcOptions.filter((c) => c.id !== commander?.id).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          {commander && <Typography variant="caption" color="text.secondary">{commander.name} directs this squad and keeps their own turn</Typography>}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Members */}
        {members.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No members yet. Use + Staff to add creatures.</Typography>
        ) : (
          <Stack spacing={0.25}>
            {members.map((m) => {
              const up = isStanding(m);
              return (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: up ? 1 : 0.45 }}>
                  <Typography sx={{ width: 16, color: 'warning.main' }} title={squad.leaderId === m.id ? 'Leader' : undefined}>
                    {squad.leaderId === m.id ? '★' : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, textDecoration: up ? 'none' : 'line-through' }}>{m.name}</Typography>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    {m.stack
                      ? `${m.stack.bodies}/${m.stack.size} bodies (front ${m.currentHp}/${m.statblock.maxHp})`
                      : `${m.currentHp}/${m.statblock.maxHp} HP`}
                    {` · AC ${m.statblock.ac}`}
                  </Typography>
                  <IconButton size="small" onClick={(e) => setMemberMenu({ anchor: e.currentTarget, member: m })} aria-label={`${m.name} menu`}>
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Footer: staffing and placement */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} endIcon={<ArrowDropDownIcon />} onClick={(e) => setStaffMenu(e.currentTarget)}>
            Staff
          </Button>
          <Button size="small" variant="outlined" color="error" disabled={standing === 0} onClick={() => setHitOpen(true)}>Hit…</Button>
          <Button size="small" variant="outlined" disabled={standing === 0} onClick={() => setAreaOpen(true)}>Area…</Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" variant="outlined"
            onClick={() => update({ position: squad.position ? undefined : { x: (index % 5) * 60 - 120, y: 120 + Math.floor(index / 5) * 60 } })}
          >
            {squad.position ? 'Remove from map' : 'Place on map'}
          </Button>
        </Box>
      </CardContent>

      {/* Squad menu */}
      <Menu anchorEl={squadMenu} open={Boolean(squadMenu)} onClose={() => setSquadMenu(null)}>
        <MenuItem onClick={() => { setSquadMenu(null); dispatch({ type: 'REMOVE_SQUAD', payload: { id: squad.id, deleteMembers: false } }); }}>
          <ListItemText primary="Disband" secondary="Members stay as standalone creatures" />
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setSquadMenu(null);
            if (window.confirm(`Delete ${squad.name} and its ${members.length} member${members.length === 1 ? '' : 's'}?`)) {
              dispatch({ type: 'REMOVE_SQUAD', payload: { id: squad.id, deleteMembers: true } });
            }
          }}
        >
          Delete squad and members
        </MenuItem>
        <MenuItem onClick={() => { setSquadMenu(null); dispatch({ type: 'RESET_SQUAD_MORALE', payload: { squadId: squad.id } }); }}>
          Reset morale
        </MenuItem>
      </Menu>

      {/* Staff menu */}
      <Menu anchorEl={staffMenu} open={Boolean(staffMenu)} onClose={() => setStaffMenu(null)}>
        <MenuItem disabled={existing.length === 0} onClick={() => { setExistingMenu(staffMenu); setStaffMenu(null); }}>
          Existing creature…
        </MenuItem>
        <MenuItem onClick={() => { setStaffMenu(null); setSearchOpen(true); }}>Monster search…</MenuItem>
        <MenuItem onClick={() => { setStaffMenu(null); setCustomOpen(true); }}>Custom NPC…</MenuItem>
        <MenuItem disabled={stacks.length === 0} onClick={() => { setStaffMenu(null); setGrowId(stacks[0]?.id ?? ''); setGrowBy(1); setGrowOpen(true); }}>
          Add bodies…
        </MenuItem>
      </Menu>

      {/* Existing standalone creatures (not in a squad, not crew) */}
      <Menu anchorEl={existingMenu} open={Boolean(existingMenu)} onClose={() => setExistingMenu(null)} slotProps={{ paper: { sx: { maxHeight: 300 } } }}>
        {existing.map((c) => (
          <MenuItem
            key={c.id}
            onClick={() => { setExistingMenu(null); dispatch({ type: 'ADD_SQUAD_MEMBER', payload: { squadId: squad.id, creatureId: c.id } }); }}
          >
            <ListItemText
              primary={c.name}
              secondary={c.stack ? `${c.stack.bodies}/${c.stack.size} bodies` : `HP ${c.currentHp}/${c.statblock.maxHp}`}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Member menu */}
      <Menu anchorEl={memberMenu?.anchor} open={Boolean(memberMenu)} onClose={closeMemberMenu}>
        {member && squad.leaderId !== member.id && (
          <MenuItem onClick={() => { closeMemberMenu(); update({ leaderId: member.id }); }}>Make leader ★</MenuItem>
        )}
        {member && squad.leaderId === member.id && (
          <MenuItem onClick={() => { closeMemberMenu(); update({ leaderId: undefined }); }}>Clear leader</MenuItem>
        )}
        {member && (
          <MenuItem onClick={() => { closeMemberMenu(); dispatch({ type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: squad.id, creatureId: member.id } }); }}>
            Remove from squad
          </MenuItem>
        )}
        {member?.stack && member.stack.bodies >= 2 && (
          <MenuItem onClick={() => { closeMemberMenu(); dispatch({ type: 'SPLIT_STACK', payload: { creatureId: member.id } }); }}>
            Split off 1
          </MenuItem>
        )}
        {member && (
          <MenuItem onClick={() => { closeMemberMenu(); setViewing(member); }}>View statblock</MenuItem>
        )}
      </Menu>

      <MonsterSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={`Staff ${squad.name}: search Open5e`}
        maxQuantity={STAFF_MAX}
        quantityHint={(qty) => `Adds one stack of ${qty} bodies on one row`}
        onPick={(monster, qty) => staff(convertOpen5eToCreature(monster), qty)}
      />
      <CustomNpcDialog open={customOpen} onClose={() => setCustomOpen(false)} maxQuantity={STAFF_MAX} onAdd={staff} />
      <StatblockDialog creature={viewing} onClose={() => setViewing(null)} />

      {/* Add bodies to a stack */}
      <Dialog open={growOpen} onClose={() => setGrowOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add bodies</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select size="small" label="Stack" value={growId} onChange={(e) => setGrowId(e.target.value)}>
              {stacks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField
              size="small" type="number" label="Bodies to add" value={growBy} inputProps={{ min: 1, max: STAFF_MAX }}
              onChange={(e) => setGrowBy(Math.max(1, Math.min(STAFF_MAX, parseInt(e.target.value) || 1)))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrowOpen(false)}>Cancel</Button>
          <Button
            variant="contained" disabled={!growId}
            onClick={() => { dispatch({ type: 'GROW_STACK', payload: { creatureId: growId, amount: growBy } }); setGrowOpen(false); }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
      {hitOpen && <SquadHitDialog squad={squad} open onClose={() => setHitOpen(false)} />}
      {areaOpen && <SquadAreaDialog squadId={squad.id} title={`Area effect on ${squad.name}`} members={members} open onClose={() => setAreaOpen(false)} />}
    </Card>
  );
}
