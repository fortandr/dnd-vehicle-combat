/**
 * Sidebar Component
 * Initiative tracker and creature/vehicle list
 */

import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Stack,
  Chip,
  Paper,
  LinearProgress,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import SearchIcon from '@mui/icons-material/Search';
import { useCombat } from '../../context/CombatContext';
import { Creature, Statblock } from '../../types';
import { factionColors, withOpacity } from '../../theme/customColors';

// Quick presets for NPCs/Enemies
const NPC_PRESETS: Partial<Statblock>[] = [
  { name: 'Bandit Captain', maxHp: 65, ac: 15, size: 'medium', type: 'humanoid', cr: '2' },
  { name: 'Mad Max Warboy', maxHp: 22, ac: 12, size: 'medium', type: 'humanoid', cr: '1/2' },
  { name: 'Chain Devil', maxHp: 85, ac: 16, size: 'medium', type: 'fiend', cr: '8' },
  { name: 'Bearded Devil', maxHp: 52, ac: 13, size: 'medium', type: 'fiend', cr: '3' },
];

// Common PC class templates
const PC_CLASS_PRESETS: { name: string; hp: number; ac: number }[] = [
  { name: 'Fighter', hp: 52, ac: 18 },
  { name: 'Rogue', hp: 38, ac: 15 },
  { name: 'Wizard', hp: 32, ac: 12 },
  { name: 'Cleric', hp: 45, ac: 18 },
  { name: 'Barbarian', hp: 60, ac: 14 },
  { name: 'Paladin', hp: 52, ac: 18 },
];

// Open5e API types
interface Open5eMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  armor_class: number;
  hit_points: number;
  hit_dice: string;
  speed: {
    walk?: number;
    fly?: number;
    swim?: number;
    burrow?: number;
    climb?: number;
  };
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  challenge_rating: string;
  senses: string;
  languages: string;
  document__title: string;
}

interface Open5eResponse {
  count: number;
  results: Open5eMonster[];
}

// Convert Open5e size to our size format
function mapOpen5eSize(size: string): 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan' {
  const sizeMap: Record<string, 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'> = {
    'Tiny': 'tiny',
    'Small': 'small',
    'Medium': 'medium',
    'Large': 'large',
    'Huge': 'huge',
    'Gargantuan': 'gargantuan',
  };
  return sizeMap[size] || 'medium';
}

// Convert Open5e monster to our Creature type
function convertOpen5eToCreature(monster: Open5eMonster, position: { x: number; y: number }): Creature {
  const statblock: Statblock = {
    id: uuid(),
    name: monster.name,
    source: 'srd', // Open5e serves SRD content
    size: mapOpen5eSize(monster.size),
    type: monster.type.toLowerCase(),
    alignment: 'neutral',
    ac: monster.armor_class,
    maxHp: monster.hit_points,
    hitDice: monster.hit_dice || `${Math.ceil(monster.hit_points / 5)}d8`,
    speed: {
      walk: monster.speed.walk || 30,
      fly: monster.speed.fly,
      swim: monster.speed.swim,
      burrow: monster.speed.burrow,
      climb: monster.speed.climb,
    },
    abilities: {
      str: monster.strength,
      dex: monster.dexterity,
      con: monster.constitution,
      int: monster.intelligence,
      wis: monster.wisdom,
      cha: monster.charisma,
    },
    senses: monster.senses || 'passive Perception 10',
    languages: monster.languages || 'None',
    cr: monster.challenge_rating,
  };

  // Calculate initiative modifier from dexterity
  const dexMod = Math.floor((monster.dexterity - 10) / 2);
  const initRoll = Math.floor(Math.random() * 20) + 1 + dexMod;

  return {
    id: uuid(),
    name: monster.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: Math.max(1, initRoll),
    initiativeModifier: dexMod,
    position,
  };
}

// Fetch monsters from Open5e API
async function searchOpen5e(query: string): Promise<Open5eMonster[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `https://api.open5e.com/v1/monsters/?search=${encodeURIComponent(query)}&limit=20`
    );
    if (!response.ok) throw new Error('API request failed');
    const data: Open5eResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('Open5e search error:', error);
    return [];
  }
}

export function Sidebar() {
  const { state, addCreature, removeCreature, dispatch } = useCombat();
  const [showAddPC, setShowAddPC] = useState(false);
  const [showAddCreature, setShowAddCreature] = useState(false);
  const [creatureName, setCreatureName] = useState('');
  const [creatureHp, setCreatureHp] = useState(30);
  const [creatureAc, setCreatureAc] = useState(14);
  const [creatureInit, setCreatureInit] = useState(10);
  const [creatureSpeed, setCreatureSpeed] = useState(30);

  // PC form state
  const [pcName, setPcName] = useState('');
  const [pcHp, setPcHp] = useState(45);
  const [pcAc, setPcAc] = useState(16);
  const [pcInit, setPcInit] = useState(12);
  const [pcSpeed, setPcSpeed] = useState(30);

  // Edit state
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);
  const [editHp, setEditHp] = useState(0);
  const [editMaxHp, setEditMaxHp] = useState(0);
  const [editAc, setEditAc] = useState(0);
  const [editInit, setEditInit] = useState(0);
  const [editName, setEditName] = useState('');
  const [editSpeed, setEditSpeed] = useState(30);

  // Open5e search state
  const [showOpen5eSearch, setShowOpen5eSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search handler
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await searchOpen5e(query);
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError('No monsters found');
      }
    } catch {
      setSearchError('Failed to search. Check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Add monster from Open5e
  const handleAddOpen5eMonster = (monster: Open5eMonster) => {
    const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    const offsetX = (npcCount % 5) * 30 - 60;
    const offsetY = Math.floor(npcCount / 5) * 30 + 50;

    const creature = convertOpen5eToCreature(monster, { x: offsetX, y: offsetY });
    addCreature(creature);
    setShowOpen5eSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddPC = (classPreset?: { name: string; hp: number; ac: number }) => {
    const name = pcName || `${classPreset?.name || 'PC'} ${state.creatures.filter(c => c.statblock.type === 'pc').length + 1}`;
    const hp = classPreset?.hp || pcHp;
    const ac = classPreset?.ac || pcAc;
    const speed = pcSpeed;

    const statblock: Statblock = {
      id: uuid(),
      name,
      source: 'custom',
      size: 'medium',
      type: 'pc',
      alignment: 'neutral good',
      ac,
      maxHp: hp,
      hitDice: `${Math.ceil(hp / 5)}d10`,
      speed: { walk: speed },
      abilities: { str: 14, dex: 14, con: 14, int: 12, wis: 12, cha: 12 },
      senses: 'passive Perception 12',
      languages: 'Common',
      cr: '5',
    };

    const creature: Creature = {
      id: uuid(),
      name,
      statblock,
      currentHp: statblock.maxHp,
      tempHp: 0,
      conditions: [],
      initiative: pcInit,
      initiativeModifier: 2,
    };

    addCreature(creature);
    setShowAddPC(false);
    setPcName('');
    setPcHp(45);
    setPcAc(16);
    setPcInit(Math.floor(Math.random() * 20) + 1);
    setPcSpeed(30);
  };

  const handleAddCreature = (preset?: Partial<Statblock>) => {
    const name = preset?.name || creatureName || 'Unknown';
    const hp = preset?.maxHp || creatureHp;
    const speed = preset?.speed?.walk || creatureSpeed;

    const statblock: Statblock = {
      id: uuid(),
      name,
      source: 'custom',
      size: preset?.size || 'medium',
      type: preset?.type || 'humanoid',
      alignment: 'neutral',
      ac: preset?.ac || creatureAc,
      maxHp: hp,
      hitDice: `${Math.ceil(hp / 5)}d8`,
      speed: { walk: speed },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      senses: 'passive Perception 10',
      languages: 'Common',
      cr: preset?.cr || '1',
    };

    const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    const offsetX = (npcCount % 5) * 30 - 60;
    const offsetY = Math.floor(npcCount / 5) * 30 + 50;

    const creature: Creature = {
      id: uuid(),
      name,
      statblock,
      currentHp: statblock.maxHp,
      tempHp: 0,
      conditions: [],
      initiative: creatureInit,
      initiativeModifier: 0,
      position: { x: offsetX, y: offsetY },
    };

    addCreature(creature);
    setShowAddCreature(false);
    setCreatureName('');
    setCreatureHp(30);
    setCreatureAc(14);
    setCreatureInit(Math.floor(Math.random() * 20) + 1);
    setCreatureSpeed(30);
  };

  const startEdit = (creature: Creature) => {
    setEditingCreatureId(creature.id);
    setEditName(creature.name);
    setEditHp(creature.currentHp);
    setEditMaxHp(creature.statblock.maxHp);
    setEditAc(creature.statblock.ac);
    setEditInit(creature.initiative);
    setEditSpeed(creature.statblock.speed.walk || 30);
  };

  const saveEdit = () => {
    if (!editingCreatureId) return;
    const existingStatblock = state.creatures.find(c => c.id === editingCreatureId)!.statblock;
    dispatch({
      type: 'UPDATE_CREATURE',
      payload: {
        id: editingCreatureId,
        updates: {
          name: editName,
          currentHp: editHp,
          initiative: editInit,
          statblock: {
            ...existingStatblock,
            name: editName,
            maxHp: editMaxHp,
            ac: editAc,
            speed: { ...existingStatblock.speed, walk: editSpeed },
          },
        },
      },
    });
    setEditingCreatureId(null);
  };

  const cancelEdit = () => setEditingCreatureId(null);

  const pcs = state.creatures.filter((c) => c.statblock.type === 'pc');
  const npcs = state.creatures.filter((c) => c.statblock.type !== 'pc');

  return (
    <Box
      component="aside"
      sx={{
        gridArea: 'sidebar',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        p: 2,
        overflow: 'auto',
      }}
    >
      {/* Initiative Tracker */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Initiative</Typography>
            {state.phase === 'combat' && (
              <Chip
                label={`Turn ${state.currentTurnIndex + 1}/${state.initiativeOrder.length}`}
                size="small"
                sx={{ bgcolor: withOpacity('#ff4500', 0.2), color: 'primary.main' }}
              />
            )}
          </Box>

          {state.phase === 'setup' ? (
            <Typography variant="body2" color="text.secondary">
              Add creatures and assign drivers to vehicles to begin
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {state.initiativeOrder.map((entryId, index) => {
                const isActive = index === state.currentTurnIndex;
                const vehicle = state.vehicles.find((v) => v.id === entryId);

                if (vehicle) {
                  const vehicleCrew = state.crewAssignments
                    .filter((a) => a.vehicleId === vehicle.id)
                    .map((a) => ({
                      creature: state.creatures.find((c) => c.id === a.creatureId),
                      zone: vehicle.template.zones.find((z) => z.id === a.zoneId),
                    }))
                    .filter((c) => c.creature);

                  const helmZoneIds = ['helm', 'rider'];
                  const driverAssignment = state.crewAssignments.find(
                    (a) => a.vehicleId === vehicle.id && helmZoneIds.includes(a.zoneId)
                  );
                  const driver = driverAssignment
                    ? state.creatures.find((c) => c.id === driverAssignment.creatureId)
                    : null;

                  const borderColor = vehicle.type === 'party' ? factionColors.party : factionColors.enemy;

                  return (
                    <Paper
                      key={entryId}
                      sx={{
                        p: 1,
                        bgcolor: isActive ? withOpacity(borderColor, 0.15) : '#242424',
                        borderLeft: 3,
                        borderColor: borderColor,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Typography variant="body2" fontFamily="monospace" sx={{ minWidth: 24 }}>
                          {driver?.initiative ?? '—'}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                          <Typography variant="caption" sx={{ color: driver ? 'text.secondary' : 'warning.main' }}>
                            {driver ? `Driver: ${driver.name}` : 'No driver - acts last!'}
                          </Typography>
                          {vehicleCrew.length > 0 && (
                            <Box sx={{ ml: 1, mt: 0.5 }}>
                              {vehicleCrew.map(({ creature, zone }) => (
                                <Box key={creature!.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                                  <Typography variant="caption">
                                    {creature!.name}
                                    <Box component="span" sx={{ color: 'text.secondary' }}> - {zone?.name || 'Unknown'}</Box>
                                  </Typography>
                                  <HPIndicator current={creature!.currentHp} max={creature!.statblock.maxHp} />
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="caption" fontFamily="monospace">
                            {vehicle.currentHp}/{vehicle.template.maxHp}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={(vehicle.currentHp / vehicle.template.maxHp) * 100}
                            color={getHPColor(vehicle.currentHp, vehicle.template.maxHp)}
                            sx={{ height: 4, width: 40, mt: 0.5, borderRadius: 1 }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  );
                }

                const creature = state.creatures.find((c) => c.id === entryId);
                if (!creature) return null;

                const assignment = state.crewAssignments.find((a) => a.creatureId === entryId);
                const assignedVehicle = assignment ? state.vehicles.find((v) => v.id === assignment.vehicleId) : null;

                return (
                  <Paper
                    key={entryId}
                    sx={{
                      p: 1,
                      bgcolor: isActive ? withOpacity('#ff4500', 0.15) : '#242424',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontFamily="monospace" sx={{ minWidth: 24 }}>
                        {creature.initiative}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2">{creature.name}</Typography>
                        {assignedVehicle && (
                          <Typography variant="caption" color="text.secondary">
                            on {assignedVehicle.name}
                          </Typography>
                        )}
                      </Box>
                      <HPIndicator current={creature.currentHp} max={creature.statblock.maxHp} />
                    </Box>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Player Characters Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'success.main' }}>Player Characters</Typography>
            <Button size="small" variant="outlined" onClick={() => setShowAddPC(!showAddPC)} startIcon={<AddIcon />}>
              Add PC
            </Button>
          </Box>

          <Collapse in={showAddPC}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Quick Add by Class:
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {PC_CLASS_PRESETS.map((preset) => (
                  <Chip
                    key={preset.name}
                    label={preset.name}
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddPC(preset)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Or Custom PC:
              </Typography>
              <Stack spacing={1}>
                <TextField fullWidth size="small" placeholder="Character Name" value={pcName} onChange={(e) => setPcName(e.target.value)} />
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="HP" type="number" value={pcHp} onChange={(e) => setPcHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
                  <TextField size="small" label="AC" type="number" value={pcAc} onChange={(e) => setPcAc(parseInt(e.target.value) || 10)} sx={{ flex: 1 }} />
                  <TextField size="small" label="Init" type="number" value={pcInit} onChange={(e) => setPcInit(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
                  <TextField size="small" label="Speed" type="number" value={pcSpeed} onChange={(e) => setPcSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
                </Stack>
                <Button variant="contained" onClick={() => handleAddPC()}>Add Player Character</Button>
              </Stack>
            </Box>
          </Collapse>

          {pcs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No player characters</Typography>
          ) : (
            <Stack spacing={0.5}>
              {pcs.map((creature) => (
                <CreatureEntry
                  key={creature.id}
                  creature={creature}
                  isPC={true}
                  isEditing={editingCreatureId === creature.id}
                  editState={{ editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed }}
                  onStartEdit={() => startEdit(creature)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={() => removeCreature(creature.id)}
                  onToggleMap={() => {
                    if (creature.position) {
                      dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { position: undefined } } });
                    } else {
                      const pcCount = state.creatures.filter(c => c.statblock.type === 'pc' && c.position).length;
                      dispatch({
                        type: 'UPDATE_CREATURE',
                        payload: {
                          id: creature.id,
                          updates: { position: { x: (pcCount % 5) * 30 - 60, y: Math.floor(pcCount / 5) * 30 - 50 } },
                        },
                      });
                    }
                  }}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* NPCs/Enemies Section */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>NPCs / Enemies</Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" variant="outlined" onClick={() => setShowOpen5eSearch(true)} startIcon={<SearchIcon />}>
                Open5e
              </Button>
              <Button size="small" variant="outlined" onClick={() => setShowAddCreature(!showAddCreature)} startIcon={<AddIcon />}>
                Custom
              </Button>
            </Stack>
          </Box>

          <Collapse in={showAddCreature}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Quick Add:</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {NPC_PRESETS.map((preset) => (
                  <Chip
                    key={preset.name}
                    label={preset.name}
                    size="small"
                    variant="outlined"
                    onClick={() => handleAddCreature(preset)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Or Custom:</Typography>
              <Stack spacing={1}>
                <TextField fullWidth size="small" placeholder="Name" value={creatureName} onChange={(e) => setCreatureName(e.target.value)} />
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="HP" type="number" value={creatureHp} onChange={(e) => setCreatureHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
                  <TextField size="small" label="AC" type="number" value={creatureAc} onChange={(e) => setCreatureAc(parseInt(e.target.value) || 10)} sx={{ flex: 1 }} />
                  <TextField size="small" label="Init" type="number" value={creatureInit} onChange={(e) => setCreatureInit(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
                  <TextField size="small" label="Speed" type="number" value={creatureSpeed} onChange={(e) => setCreatureSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
                </Stack>
                <Button variant="contained" onClick={() => handleAddCreature()} disabled={!creatureName}>Add NPC/Enemy</Button>
              </Stack>
            </Box>
          </Collapse>

          {npcs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No NPCs or enemies</Typography>
          ) : (
            <Stack spacing={0.5}>
              {npcs.map((creature) => (
                <CreatureEntry
                  key={creature.id}
                  creature={creature}
                  isPC={false}
                  isEditing={editingCreatureId === creature.id}
                  editState={{ editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed }}
                  onStartEdit={() => startEdit(creature)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={() => removeCreature(creature.id)}
                  onToggleMap={() => {
                    if (creature.position) {
                      dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { position: undefined } } });
                    } else {
                      const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc' && c.position).length;
                      dispatch({
                        type: 'UPDATE_CREATURE',
                        payload: {
                          id: creature.id,
                          updates: { position: { x: (npcCount % 5) * 30 - 60, y: Math.floor(npcCount / 5) * 30 + 50 } },
                        },
                      });
                    }
                  }}
                />
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Vehicles Overview */}
      <Card>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">Vehicles</Typography>
            <Chip label={state.vehicles.length} size="small" variant="outlined" />
          </Box>

          {state.vehicles.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No vehicles in encounter</Typography>
          ) : (
            <Stack spacing={0.5}>
              {state.vehicles.map((vehicle) => (
                <Paper
                  key={vehicle.id}
                  sx={{
                    p: 1,
                    bgcolor: '#242424',
                    borderLeft: 3,
                    borderColor: vehicle.type === 'party' ? factionColors.party : factionColors.enemy,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                    <Typography variant="caption" fontFamily="monospace">
                      {vehicle.currentHp}/{vehicle.template.maxHp}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(vehicle.currentHp / vehicle.template.maxHp) * 100}
                    color={getHPColor(vehicle.currentHp, vehicle.template.maxHp)}
                    sx={{ height: 4, mt: 0.5, borderRadius: 1 }}
                  />
                  {vehicle.activeMishaps.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                      {vehicle.activeMishaps.map((mishap) => (
                        <Chip key={mishap.id} label={mishap.name} size="small" color="warning" sx={{ height: 18, fontSize: '0.625rem' }} />
                      ))}
                    </Stack>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Open5e Search Dialog */}
      <Dialog
        open={showOpen5eSearch}
        onClose={() => {
          setShowOpen5eSearch(false);
          setSearchQuery('');
          setSearchResults([]);
          setSearchError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Search Open5e Monsters</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            placeholder="Search for monsters (e.g., 'goblin', 'dragon', 'devil')"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: isSearching ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : null,
            }}
          />

          {searchError && searchResults.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              {searchError}
            </Typography>
          )}

          {searchResults.length > 0 && (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {searchResults.map((monster) => (
                <ListItem key={monster.slug} disablePadding>
                  <ListItemButton onClick={() => handleAddOpen5eMonster(monster)}>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight={600}>{monster.name}</Typography>
                          <Chip
                            label={`CR ${monster.challenge_rating}`}
                            size="small"
                            sx={{ height: 18, fontSize: '0.625rem' }}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {monster.size} {monster.type} • HP {monster.hit_points} • AC {monster.armor_class}
                          {monster.document__title && ` • ${monster.document__title}`}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}

          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              Type at least 2 characters to search
            </Typography>
          )}

          {searchQuery.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
              Search the Open5e database for SRD monsters.
              <br />
              <Typography variant="caption" component="span">
                Includes monsters from the 5e SRD, Tome of Beasts, and more.
              </Typography>
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// Creature Entry Component
interface CreatureEntryProps {
  creature: Creature;
  isPC: boolean;
  isEditing: boolean;
  editState: {
    editName: string; setEditName: (v: string) => void;
    editHp: number; setEditHp: (v: number) => void;
    editMaxHp: number; setEditMaxHp: (v: number) => void;
    editAc: number; setEditAc: (v: number) => void;
    editInit: number; setEditInit: (v: number) => void;
    editSpeed: number; setEditSpeed: (v: number) => void;
  };
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onToggleMap: () => void;
}

function CreatureEntry({ creature, isPC, isEditing, editState, onStartEdit, onSaveEdit, onCancelEdit, onRemove, onToggleMap }: CreatureEntryProps) {
  const borderColor = isPC ? factionColors.party : factionColors.enemy;

  if (isEditing) {
    return (
      <Paper sx={{ p: 1, bgcolor: '#242424', borderLeft: 3, borderColor }}>
        <Stack spacing={1}>
          <TextField fullWidth size="small" value={editState.editName} onChange={(e) => editState.setEditName(e.target.value)} placeholder="Name" />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="HP" type="number" value={editState.editHp} onChange={(e) => editState.setEditHp(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            <TextField size="small" label="Max" type="number" value={editState.editMaxHp} onChange={(e) => editState.setEditMaxHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="AC" type="number" value={editState.editAc} onChange={(e) => editState.setEditAc(parseInt(e.target.value) || 10)} sx={{ flex: 1 }} />
            <TextField size="small" label="Init" type="number" value={editState.editInit} onChange={(e) => editState.setEditInit(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            <TextField size="small" label="Speed" type="number" value={editState.editSpeed} onChange={(e) => editState.setEditSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={onSaveEdit} sx={{ flex: 1 }}>Save</Button>
            <Button variant="outlined" size="small" onClick={onCancelEdit} sx={{ flex: 1 }}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 1, bgcolor: '#242424', borderLeft: 3, borderColor }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" fontWeight={600} component="div">
            {creature.name}
            {creature.position && (
              <Chip label="MAP" size="small" sx={{ ml: 0.5, height: 16, fontSize: '0.6rem', bgcolor: withOpacity(borderColor, 0.3), color: borderColor }} />
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            HP: {creature.currentHp}/{creature.statblock.maxHp} | AC: {creature.statblock.ac} | Init: {creature.initiative} | Spd: {creature.statblock.speed.walk || 30}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" onClick={onToggleMap} title={creature.position ? 'Remove from map' : 'Place on map'}>
            <MapIcon fontSize="small" sx={{ color: creature.position ? borderColor : 'text.secondary' }} />
          </IconButton>
          <IconButton size="small" onClick={onStartEdit} title="Edit">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onRemove} color="error" title="Remove">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Paper>
  );
}

// HP Indicator Component
function HPIndicator({ current, max }: { current: number; max: number }) {
  const percent = (current / max) * 100;
  return (
    <LinearProgress
      variant="determinate"
      value={percent}
      color={getHPColor(current, max)}
      sx={{ width: 40, height: 6, borderRadius: 1 }}
    />
  );
}

function getHPColor(current: number, max: number): 'success' | 'warning' | 'error' {
  const percent = (current / max) * 100;
  if (percent > 50) return 'success';
  if (percent > 25) return 'warning';
  return 'error';
}
