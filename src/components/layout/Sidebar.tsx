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
  ListItemIcon,
  CircularProgress,
  InputAdornment,
  Menu,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import SearchIcon from '@mui/icons-material/Search';
import CasinoIcon from '@mui/icons-material/Casino';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AirlineSeatReclineNormalIcon from '@mui/icons-material/AirlineSeatReclineNormal';
import CloseIcon from '@mui/icons-material/Close';
import SkullIcon from '@mui/icons-material/Dangerous';
import Tooltip from '@mui/material/Tooltip';
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
interface Open5eAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage_dice?: string;
  damage_bonus?: number;
}

interface Open5eMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: number;
  armor_desc?: string;
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
  strength_save?: number;
  dexterity_save?: number;
  constitution_save?: number;
  intelligence_save?: number;
  wisdom_save?: number;
  charisma_save?: number;
  perception?: number;
  skills?: Record<string, number>;
  damage_vulnerabilities: string;
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  senses: string;
  languages: string;
  challenge_rating: string;
  cr?: number;
  actions?: Open5eAction[];
  bonus_actions?: Open5eAction[];
  reactions?: Open5eAction[];
  legendary_actions?: Open5eAction[];
  legendary_desc?: string;
  special_abilities?: Open5eAction[];
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

// Convert Open5e action to our StatblockAction type
function convertOpen5eAction(action: Open5eAction): { name: string; description: string; attackBonus?: number; damage?: string } {
  return {
    name: action.name,
    description: action.desc,
    attackBonus: action.attack_bonus,
    damage: action.damage_dice ? `${action.damage_dice}${action.damage_bonus ? `+${action.damage_bonus}` : ''}` : undefined,
  };
}

// Parse comma-separated string to array
function parseStringToArray(str: string): string[] | undefined {
  if (!str || str.trim() === '') return undefined;
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

// Convert Open5e monster to our Creature type
function convertOpen5eToCreature(monster: Open5eMonster, position: { x: number; y: number }): Creature {
  // Build saving throws object
  const savingThrows: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {};
  if (monster.strength_save !== undefined) savingThrows.str = monster.strength_save;
  if (monster.dexterity_save !== undefined) savingThrows.dex = monster.dexterity_save;
  if (monster.constitution_save !== undefined) savingThrows.con = monster.constitution_save;
  if (monster.intelligence_save !== undefined) savingThrows.int = monster.intelligence_save;
  if (monster.wisdom_save !== undefined) savingThrows.wis = monster.wisdom_save;
  if (monster.charisma_save !== undefined) savingThrows.cha = monster.charisma_save;

  const statblock: Statblock = {
    id: uuid(),
    name: monster.name,
    source: 'srd', // Open5e serves SRD content
    size: mapOpen5eSize(monster.size),
    type: monster.type.toLowerCase(),
    subtype: monster.subtype,
    alignment: monster.alignment || 'neutral',
    ac: monster.armor_class,
    acType: monster.armor_desc,
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
    savingThrows: Object.keys(savingThrows).length > 0 ? savingThrows : undefined,
    skills: monster.skills,
    damageVulnerabilities: parseStringToArray(monster.damage_vulnerabilities),
    damageResistances: parseStringToArray(monster.damage_resistances),
    damageImmunities: parseStringToArray(monster.damage_immunities),
    conditionImmunities: parseStringToArray(monster.condition_immunities),
    senses: monster.senses || 'passive Perception 10',
    languages: monster.languages || 'None',
    cr: monster.challenge_rating,
    traits: monster.special_abilities?.map(a => ({ name: a.name, description: a.desc })),
    actions: monster.actions?.map(convertOpen5eAction),
    bonusActions: monster.bonus_actions?.map(convertOpen5eAction),
    reactions: monster.reactions?.map(convertOpen5eAction),
    legendaryActions: monster.legendary_actions?.map(convertOpen5eAction),
  };

  // Calculate initiative modifier from dexterity (but don't auto-roll)
  const dexMod = Math.floor((monster.dexterity - 10) / 2);

  return {
    id: uuid(),
    name: monster.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: 0, // Don't auto-roll, use "Roll Init" button
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
  const [creatureInit, setCreatureInit] = useState(0); // Don't auto-roll
  const [creatureSpeed, setCreatureSpeed] = useState(30);

  // PC form state
  const [pcName, setPcName] = useState('');
  const [pcHp, setPcHp] = useState(45);
  const [pcAc, setPcAc] = useState(16);
  const [pcInit, setPcInit] = useState(12);
  const [pcSpeed, setPcSpeed] = useState(30);
  const [pcDexSave, setPcDexSave] = useState(2); // DEX saving throw modifier

  // Edit state
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);
  const [editHp, setEditHp] = useState(0);
  const [editMaxHp, setEditMaxHp] = useState(0);
  const [editAc, setEditAc] = useState(0);
  const [editInit, setEditInit] = useState(0);
  const [editName, setEditName] = useState('');
  const [editSpeed, setEditSpeed] = useState(30);
  const [editDexSave, setEditDexSave] = useState(0); // DEX saving throw modifier

  // Open5e search state
  const [showOpen5eSearch, setShowOpen5eSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Add NPC menu state
  const [addNpcMenuAnchor, setAddNpcMenuAnchor] = useState<null | HTMLElement>(null);

  // Statblock modal state
  const [viewingCreature, setViewingCreature] = useState<Creature | null>(null);

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
    const dexSave = pcDexSave;

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
      abilities: { str: 14, dex: 10 + (dexSave * 2), con: 14, int: 12, wis: 12, cha: 12 }, // Estimate raw DEX from save
      savingThrows: { dex: dexSave }, // Store actual DEX save modifier
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
      initiativeModifier: dexSave, // Use DEX save as init modifier estimate
    };

    addCreature(creature);
    setShowAddPC(false);
    setPcName('');
    setPcHp(45);
    setPcAc(16);
    setPcInit(Math.floor(Math.random() * 20) + 1);
    setPcSpeed(30);
    setPcDexSave(2);
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
    setCreatureInit(0); // Don't auto-roll, use "Roll Init" button
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
    // Use savingThrows.dex if available, otherwise calculate from abilities.dex
    const dexSave = creature.statblock.savingThrows?.dex
      ?? Math.floor(((creature.statblock.abilities?.dex || 10) - 10) / 2);
    setEditDexSave(dexSave);
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
          initiativeModifier: editDexSave,
          statblock: {
            ...existingStatblock,
            name: editName,
            maxHp: editMaxHp,
            ac: editAc,
            speed: { ...existingStatblock.speed, walk: editSpeed },
            savingThrows: { ...existingStatblock.savingThrows, dex: editDexSave },
          },
        },
      },
    });
    setEditingCreatureId(null);
  };

  const cancelEdit = () => setEditingCreatureId(null);

  // Roll initiative for all NPCs/Enemies
  const handleRollAllNpcInit = () => {
    const npcs = state.creatures.filter(c => c.statblock.type !== 'pc');
    npcs.forEach(npc => {
      // Use savingThrows.dex if available, otherwise calculate from abilities.dex
      const dexMod = npc.statblock.savingThrows?.dex
        ?? Math.floor(((npc.statblock.abilities?.dex || 10) - 10) / 2);
      const roll = Math.floor(Math.random() * 20) + 1;
      const initiative = Math.max(1, roll + dexMod);

      dispatch({
        type: 'UPDATE_CREATURE',
        payload: {
          id: npc.id,
          updates: { initiative },
        },
      });
    });
  };

  const pcs = state.creatures.filter((c) => c.statblock.type === 'pc');
  const npcs = state.creatures.filter((c) => c.statblock.type !== 'pc');

  // Helper to get crew assignment info for a creature
  const getCreatureAssignment = (creatureId: string) => {
    const assignment = state.crewAssignments.find(a => a.creatureId === creatureId);
    if (!assignment) return undefined;

    const vehicle = state.vehicles.find(v => v.id === assignment.vehicleId);
    if (!vehicle) return undefined;

    const zone = vehicle.template.zones.find(z => z.id === assignment.zoneId);
    const isDriver = assignment.zoneId === 'helm' || assignment.zoneId === 'rider';

    return {
      vehicleName: vehicle.name,
      zoneName: zone?.name || assignment.zoneId,
      isDriver,
    };
  };

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
            {state.phase === 'combat' && (() => {
              // Count active participants (exclude destroyed vehicles)
              const activeCount = state.initiativeOrder.filter((id) => {
                const vehicle = state.vehicles.find((v) => v.id === id);
                if (vehicle) return !vehicle.isInoperative && vehicle.currentHp > 0;
                return true; // Creatures are always counted
              }).length;
              return (
                <Chip
                  label={`Turn ${state.currentTurnIndex + 1}/${activeCount}`}
                  size="small"
                  sx={{ bgcolor: withOpacity('#ff4500', 0.2), color: 'primary.main' }}
                />
              );
            })()}
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

                // Skip destroyed vehicles - they no longer act in initiative
                if (vehicle && (vehicle.isInoperative || vehicle.currentHp === 0)) {
                  return null;
                }

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

                const isPC = creature.statblock.type === 'pc';
                const isInDeathSaves = isPC && creature.currentHp === 0;
                const isDead = !isPC && creature.currentHp === 0;
                const isDownOrDead = isInDeathSaves || isDead;

                return (
                  <Paper
                    key={entryId}
                    sx={{
                      p: 1,
                      bgcolor: isDownOrDead
                        ? withOpacity('#dc2626', 0.2)
                        : isActive
                          ? withOpacity('#ff4500', 0.15)
                          : '#242424',
                      borderLeft: isDownOrDead ? 3 : 0,
                      borderColor: isDownOrDead ? 'error.main' : undefined,
                      opacity: isDead ? 0.6 : 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontFamily="monospace" sx={{ minWidth: 24 }}>
                        {creature.initiative}
                      </Typography>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="body2"
                            sx={{ textDecoration: isDead ? 'line-through' : 'none' }}
                          >
                            {creature.name}
                          </Typography>
                          {isInDeathSaves && (
                            <Tooltip title="Making Death Saves" arrow>
                              <SkullIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            </Tooltip>
                          )}
                          {isDead && (
                            <Tooltip title="Dead" arrow>
                              <SkullIcon sx={{ fontSize: 16, color: 'error.main' }} />
                            </Tooltip>
                          )}
                        </Box>
                        {assignedVehicle && (
                          <Typography variant="caption" color="text.secondary">
                            on {assignedVehicle.name}
                          </Typography>
                        )}
                      </Box>
                      {isInDeathSaves ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                          DYING
                        </Typography>
                      ) : isDead ? (
                        <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
                          DEAD
                        </Typography>
                      ) : (
                        <HPIndicator current={creature.currentHp} max={creature.statblock.maxHp} />
                      )}
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
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Speed" type="number" value={pcSpeed} onChange={(e) => setPcSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
                  <TextField
                    size="small"
                    label={`DEX Save (${pcDexSave >= 0 ? '+' : ''}${pcDexSave})`}
                    type="number"
                    value={pcDexSave}
                    onChange={(e) => setPcDexSave(parseInt(e.target.value) || 0)}
                    sx={{ flex: 1 }}
                    helperText="For vehicle saves"
                  />
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
                  editState={{ editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed, editDexSave, setEditDexSave }}
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
                  assignment={getCreatureAssignment(creature.id)}
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>NPCs / Enemies</Typography>
              {npcs.length > 0 && (
                <Tooltip title="Roll initiative for all NPCs (1d20 + DEX Save)" arrow>
                  <IconButton
                    size="small"
                    onClick={handleRollAllNpcInit}
                    sx={{ color: 'primary.main' }}
                  >
                    <CasinoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setAddNpcMenuAnchor(e.currentTarget)}
              startIcon={<AddIcon />}
            >
              Add
            </Button>
            <Menu
              anchorEl={addNpcMenuAnchor}
              open={Boolean(addNpcMenuAnchor)}
              onClose={() => setAddNpcMenuAnchor(null)}
            >
              <MenuItem onClick={() => {
                setShowOpen5eSearch(true);
                setAddNpcMenuAnchor(null);
              }}>
                <ListItemIcon><SearchIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Search Open5e</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => {
                setShowAddCreature(!showAddCreature);
                setAddNpcMenuAnchor(null);
              }}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Custom NPC</ListItemText>
              </MenuItem>
            </Menu>
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
                  editState={{ editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed, editDexSave, setEditDexSave }}
                  onStartEdit={() => startEdit(creature)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={() => removeCreature(creature.id)}
                  onViewStatblock={() => setViewingCreature(creature)}
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
                  assignment={getCreatureAssignment(creature.id)}
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

      {/* Statblock Modal */}
      <Dialog
        open={!!viewingCreature}
        onClose={() => setViewingCreature(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: '90vh' } }}
      >
        {viewingCreature && (
          <>
            <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>
                    {viewingCreature.statblock.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewingCreature.statblock.size} {viewingCreature.statblock.type}
                    {viewingCreature.statblock.subtype && ` (${viewingCreature.statblock.subtype})`}
                    , {viewingCreature.statblock.alignment}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Chip label={`CR ${viewingCreature.statblock.cr}`} color="primary" />
                  <IconButton
                    onClick={() => setViewingCreature(null)}
                    size="small"
                    sx={{ color: 'text.secondary' }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <StatblockDisplay statblock={viewingCreature.statblock} />
            </DialogContent>
          </>
        )}
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
    editDexSave: number; setEditDexSave: (v: number) => void;
  };
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onToggleMap: () => void;
  onViewStatblock?: () => void; // Optional - only for NPCs with statblock data
  // Crew assignment info
  assignment?: {
    vehicleName: string;
    zoneName: string;
    isDriver: boolean;
  };
}

function CreatureEntry({ creature, isPC, isEditing, editState, onStartEdit, onSaveEdit, onCancelEdit, onRemove, onToggleMap, onViewStatblock, assignment }: CreatureEntryProps) {
  const borderColor = isPC ? factionColors.party : factionColors.enemy;
  const hasStatblock = !isPC && (creature.statblock.actions?.length || creature.statblock.traits?.length || creature.statblock.source === 'srd');

  // Determine status: driver > crew > map > unassigned
  const getStatusIndicator = () => {
    if (assignment?.isDriver) {
      return (
        <Tooltip title={`Driving ${assignment.vehicleName}`} arrow>
          <Chip
            icon={<DirectionsCarIcon sx={{ fontSize: '0.75rem !important' }} />}
            label="DRIVER"
            size="small"
            sx={{
              ml: 0.5,
              height: 18,
              fontSize: '0.6rem',
              bgcolor: withOpacity('#4CAF50', 0.3),
              color: '#4CAF50',
              '& .MuiChip-icon': { color: '#4CAF50' },
            }}
          />
        </Tooltip>
      );
    }
    if (assignment) {
      return (
        <Tooltip title={`${assignment.zoneName} on ${assignment.vehicleName}`} arrow>
          <Chip
            icon={<AirlineSeatReclineNormalIcon sx={{ fontSize: '0.75rem !important' }} />}
            label={assignment.zoneName.toUpperCase()}
            size="small"
            sx={{
              ml: 0.5,
              height: 18,
              fontSize: '0.6rem',
              bgcolor: withOpacity('#2196F3', 0.3),
              color: '#2196F3',
              '& .MuiChip-icon': { color: '#2196F3' },
            }}
          />
        </Tooltip>
      );
    }
    if (creature.position) {
      return (
        <Tooltip title="Standalone on battlefield" arrow>
          <Chip
            icon={<MapIcon sx={{ fontSize: '0.75rem !important' }} />}
            label="MAP"
            size="small"
            sx={{
              ml: 0.5,
              height: 18,
              fontSize: '0.6rem',
              bgcolor: withOpacity(borderColor, 0.3),
              color: borderColor,
              '& .MuiChip-icon': { color: borderColor },
            }}
          />
        </Tooltip>
      );
    }
    return null;
  };

  if (isEditing) {
    const dexSaveStr = editState.editDexSave >= 0 ? `+${editState.editDexSave}` : `${editState.editDexSave}`;
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
            <TextField
              size="small"
              label={`DEX Save (${dexSaveStr})`}
              type="number"
              value={editState.editDexSave}
              onChange={(e) => editState.setEditDexSave(parseInt(e.target.value) || 0)}
              sx={{ flex: 1 }}
              helperText="Vehicle save modifier"
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={onSaveEdit} sx={{ flex: 1 }}>Save</Button>
            <Button variant="outlined" size="small" onClick={onCancelEdit} sx={{ flex: 1 }}>Cancel</Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  // Determine if Map button should be disabled (creature is assigned to a vehicle)
  const isAssignedToVehicle = !!assignment;
  const isInDeathSaves = isPC && creature.currentHp === 0;
  const isDead = !isPC && creature.currentHp === 0;
  const isDownOrDead = isInDeathSaves || isDead;

  return (
    <Paper
      sx={{
        p: 1,
        bgcolor: isDownOrDead ? withOpacity('#dc2626', 0.15) : '#242424',
        borderLeft: 3,
        borderColor: isDownOrDead ? 'error.main' : borderColor,
        opacity: isDead ? 0.6 : 1,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" fontWeight={600} component="div">
            <span
              onClick={hasStatblock && onViewStatblock ? onViewStatblock : undefined}
              style={{
                cursor: hasStatblock && onViewStatblock ? 'pointer' : 'default',
                textDecoration: isDead ? 'line-through' : 'none',
              }}
              onMouseEnter={(e) => {
                if (hasStatblock && onViewStatblock) {
                  e.currentTarget.style.color = '#ff4500';
                }
              }}
              onMouseLeave={(e) => {
                if (hasStatblock && onViewStatblock) {
                  e.currentTarget.style.color = '';
                }
              }}
            >
              {creature.name}
            </span>
            {isInDeathSaves && (
              <Tooltip title="Making Death Saves" arrow>
                <SkullIcon sx={{ fontSize: 16, color: 'error.main', ml: 0.5, verticalAlign: 'middle' }} />
              </Tooltip>
            )}
            {isDead && (
              <Tooltip title="Dead" arrow>
                <SkullIcon sx={{ fontSize: 16, color: 'error.main', ml: 0.5, verticalAlign: 'middle' }} />
              </Tooltip>
            )}
            {getStatusIndicator()}
          </Typography>
          {isInDeathSaves ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              DEATH SAVES | AC: {creature.statblock.ac} | Init: {creature.initiative}
            </Typography>
          ) : isDead ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>
              DEAD | AC: {creature.statblock.ac} | Init: {creature.initiative}
            </Typography>
          ) : (
            <Typography variant="caption" color="text.secondary">
              HP: {creature.currentHp}/{creature.statblock.maxHp} | AC: {creature.statblock.ac} | Init: {creature.initiative} | DEX Save: {
                creature.statblock.savingThrows?.dex !== undefined
                  ? (creature.statblock.savingThrows.dex >= 0 ? '+' : '') + creature.statblock.savingThrows.dex
                  : (creature.statblock.abilities?.dex
                    ? (Math.floor((creature.statblock.abilities.dex - 10) / 2) >= 0 ? '+' : '') + Math.floor((creature.statblock.abilities.dex - 10) / 2)
                    : '—')
              }
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={isAssignedToVehicle ? 'Remove from vehicle first' : (creature.position ? 'Remove from map' : 'Place on map')} arrow>
            <span>
              <IconButton
                size="small"
                onClick={onToggleMap}
                disabled={isAssignedToVehicle}
              >
                <MapIcon fontSize="small" sx={{ color: creature.position && !isAssignedToVehicle ? borderColor : 'text.secondary' }} />
              </IconButton>
            </span>
          </Tooltip>
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

// Statblock Display Component
function StatblockDisplay({ statblock }: { statblock: Statblock }) {
  const abilityNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  const getModifier = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const formatSpeed = () => {
    const speeds: string[] = [];
    if (statblock.speed.walk) speeds.push(`${statblock.speed.walk} ft.`);
    if (statblock.speed.fly) speeds.push(`fly ${statblock.speed.fly} ft.`);
    if (statblock.speed.swim) speeds.push(`swim ${statblock.speed.swim} ft.`);
    if (statblock.speed.burrow) speeds.push(`burrow ${statblock.speed.burrow} ft.`);
    if (statblock.speed.climb) speeds.push(`climb ${statblock.speed.climb} ft.`);
    return speeds.join(', ') || '0 ft.';
  };

  const formatSavingThrows = () => {
    if (!statblock.savingThrows) return null;
    const saves: string[] = [];
    abilityNames.forEach(ability => {
      const save = statblock.savingThrows?.[ability];
      if (save !== undefined) {
        saves.push(`${ability.toUpperCase()} ${save >= 0 ? '+' : ''}${save}`);
      }
    });
    return saves.length > 0 ? saves.join(', ') : null;
  };

  const formatSkills = () => {
    if (!statblock.skills || Object.keys(statblock.skills).length === 0) return null;
    return Object.entries(statblock.skills)
      .map(([skill, bonus]) => `${skill} ${bonus >= 0 ? '+' : ''}${bonus}`)
      .join(', ');
  };

  return (
    <Box sx={{ fontFamily: 'serif' }}>
      {/* Basic Stats */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack spacing={0.5}>
          <Typography variant="body2">
            <strong>Armor Class</strong> {statblock.ac}{statblock.acType && ` (${statblock.acType})`}
          </Typography>
          <Typography variant="body2">
            <strong>Hit Points</strong> {statblock.maxHp} ({statblock.hitDice})
          </Typography>
          <Typography variant="body2">
            <strong>Speed</strong> {formatSpeed()}
          </Typography>
        </Stack>
      </Paper>

      {/* Ability Scores */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack direction="row" spacing={2} justifyContent="space-around">
          {abilityNames.map(ability => (
            <Box key={ability} sx={{ textAlign: 'center' }}>
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase' }}>
                {ability}
              </Typography>
              <Typography variant="body1" fontFamily="monospace">
                {statblock.abilities[ability]} ({getModifier(statblock.abilities[ability])})
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Secondary Stats */}
      <Paper sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
        <Stack spacing={0.5}>
          {formatSavingThrows() && (
            <Typography variant="body2">
              <strong>Saving Throws</strong> {formatSavingThrows()}
            </Typography>
          )}
          {formatSkills() && (
            <Typography variant="body2">
              <strong>Skills</strong> {formatSkills()}
            </Typography>
          )}
          {statblock.damageVulnerabilities && statblock.damageVulnerabilities.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Vulnerabilities</strong> {statblock.damageVulnerabilities.join(', ')}
            </Typography>
          )}
          {statblock.damageResistances && statblock.damageResistances.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Resistances</strong> {statblock.damageResistances.join(', ')}
            </Typography>
          )}
          {statblock.damageImmunities && statblock.damageImmunities.length > 0 && (
            <Typography variant="body2">
              <strong>Damage Immunities</strong> {statblock.damageImmunities.join(', ')}
            </Typography>
          )}
          {statblock.conditionImmunities && statblock.conditionImmunities.length > 0 && (
            <Typography variant="body2">
              <strong>Condition Immunities</strong> {statblock.conditionImmunities.join(', ')}
            </Typography>
          )}
          <Typography variant="body2">
            <strong>Senses</strong> {statblock.senses}
          </Typography>
          <Typography variant="body2">
            <strong>Languages</strong> {statblock.languages}
          </Typography>
          <Typography variant="body2">
            <strong>Challenge</strong> {statblock.cr}
          </Typography>
        </Stack>
      </Paper>

      {/* Traits */}
      {statblock.traits && statblock.traits.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Traits
          </Typography>
          <Stack spacing={1}>
            {statblock.traits.map((trait, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{trait.name}.</em></strong> {trait.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Actions */}
      {statblock.actions && statblock.actions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Actions
          </Typography>
          <Stack spacing={1}>
            {statblock.actions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Bonus Actions */}
      {statblock.bonusActions && statblock.bonusActions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Bonus Actions
          </Typography>
          <Stack spacing={1}>
            {statblock.bonusActions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Reactions */}
      {statblock.reactions && statblock.reactions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Reactions
          </Typography>
          <Stack spacing={1}>
            {statblock.reactions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* Legendary Actions */}
      {statblock.legendaryActions && statblock.legendaryActions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main', mb: 1, borderBottom: 1, borderColor: 'primary.main', pb: 0.5 }}>
            Legendary Actions
          </Typography>
          {statblock.legendaryActionsPerRound && (
            <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
              The creature can take {statblock.legendaryActionsPerRound} legendary actions, choosing from the options below.
            </Typography>
          )}
          <Stack spacing={1}>
            {statblock.legendaryActions.map((action, i) => (
              <Box key={i}>
                <Typography variant="body2">
                  <strong><em>{action.name}.</em></strong> {action.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
