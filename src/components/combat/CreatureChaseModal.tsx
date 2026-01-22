/**
 * Creature Chase Modal
 *
 * Handles the "Creature Chase" complication (d20 roll 1-2).
 * Allows DM to add a creature native to Avernus that joins the chase.
 * Supports searching Open5e or manual creature entry.
 */

import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Stack,
  Chip,
  TextField,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  InputAdornment,
  Divider,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PetsIcon from '@mui/icons-material/Pets';
import { useCombat } from '../../context/CombatContext';
import { Creature, Statblock, ChaseComplication } from '../../types';
import { withOpacity } from '../../theme/customColors';

// ==========================================
// Open5e Types & API
// ==========================================

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

// Suggested Avernus creatures for quick selection
const AVERNUS_CREATURE_SUGGESTIONS = [
  { name: 'Lemure', type: 'fiend', cr: '0', hp: 13, ac: 7 },
  { name: 'Imp', type: 'fiend', cr: '1', hp: 10, ac: 13 },
  { name: 'Spined Devil', type: 'fiend', cr: '2', hp: 22, ac: 13 },
  { name: 'Bearded Devil', type: 'fiend', cr: '3', hp: 52, ac: 13 },
  { name: 'Merregon', type: 'fiend', cr: '4', hp: 45, ac: 16 },
  { name: 'Barbed Devil', type: 'fiend', cr: '5', hp: 110, ac: 15 },
  { name: 'Chain Devil', type: 'fiend', cr: '8', hp: 85, ac: 16 },
  { name: 'Bone Devil', type: 'fiend', cr: '9', hp: 142, ac: 19 },
  { name: 'Horned Devil', type: 'fiend', cr: '11', hp: 178, ac: 18 },
  { name: 'Narzugon', type: 'fiend', cr: '13', hp: 112, ac: 20 },
];

// ==========================================
// Utility Functions
// ==========================================

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

function convertOpen5eAction(action: Open5eAction): { name: string; description: string; attackBonus?: number; damage?: string } {
  return {
    name: action.name,
    description: action.desc,
    attackBonus: action.attack_bonus,
    damage: action.damage_dice ? `${action.damage_dice}${action.damage_bonus ? `+${action.damage_bonus}` : ''}` : undefined,
  };
}

function parseStringToArray(str: string): string[] | undefined {
  if (!str || str.trim() === '') return undefined;
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

function convertOpen5eToCreature(monster: Open5eMonster, position: { x: number; y: number }): Creature {
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
    source: 'srd',
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

  const dexMod = Math.floor((monster.dexterity - 10) / 2);

  return {
    id: uuid(),
    name: monster.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: 0,
    initiativeModifier: dexMod,
    position,
  };
}

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

// ==========================================
// Component
// ==========================================

interface CreatureChaseModalProps {
  open: boolean;
  onClose: () => void;
  complication: ChaseComplication;
  roll: number;
}

export function CreatureChaseModal({
  open,
  onClose,
  complication,
  roll,
}: CreatureChaseModalProps) {
  const { state, addCreature, dispatch } = useCombat();
  const [tabIndex, setTabIndex] = useState(0);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualHp, setManualHp] = useState(30);
  const [manualAc, setManualAc] = useState(13);
  const [manualSpeed, setManualSpeed] = useState(30);
  const [manualDexSave, setManualDexSave] = useState(2);
  const [manualInitiative, setManualInitiative] = useState(2);

  // Calculate position for new creature (near enemy vehicles or center)
  const getCreaturePosition = (): { x: number; y: number } => {
    const enemyVehicles = state.vehicles.filter(v => v.type === 'enemy');
    if (enemyVehicles.length > 0) {
      // Place near a random enemy vehicle
      const vehicle = enemyVehicles[Math.floor(Math.random() * enemyVehicles.length)];
      const angle = Math.random() * 2 * Math.PI;
      const distance = 50 + Math.random() * 50; // 50-100 feet away
      return {
        x: vehicle.position.x + Math.cos(angle) * distance,
        y: vehicle.position.y + Math.sin(angle) * distance,
      };
    }
    // Default position
    return { x: 300 + Math.random() * 100, y: 300 + Math.random() * 100 };
  };

  // Debounced search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchOpen5e(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    setSearchTimeout(timeout);
  }, [searchTimeout]);

  const handleSelectMonster = (monster: Open5eMonster) => {
    const position = getCreaturePosition();
    const creature = convertOpen5eToCreature(monster, position);

    addCreature(creature);

    // Log the creature addition
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'complication',
        action: `Creature Chase: ${monster.name} joins the pursuit!`,
        details: `CR ${monster.challenge_rating} ${monster.type} added to battlefield`,
      },
    });

    onClose();
  };

  const handleAddManualCreature = () => {
    if (!manualName.trim()) return;

    const position = getCreaturePosition();

    const statblock: Statblock = {
      id: uuid(),
      name: manualName,
      source: 'custom',
      size: 'medium',
      type: 'fiend',
      alignment: 'lawful evil',
      ac: manualAc,
      maxHp: manualHp,
      hitDice: `${Math.ceil(manualHp / 5)}d8`,
      speed: { walk: manualSpeed },
      abilities: { str: 14, dex: 10 + manualDexSave * 2, con: 14, int: 10, wis: 10, cha: 10 },
      savingThrows: { dex: manualDexSave },
      senses: 'darkvision 120 ft., passive Perception 11',
      languages: 'Infernal',
      cr: '1',
    };

    const creature: Creature = {
      id: uuid(),
      name: manualName,
      statblock,
      currentHp: manualHp,
      tempHp: 0,
      conditions: [],
      initiative: 0,
      initiativeModifier: manualInitiative,
      position,
    };

    addCreature(creature);

    // Log the creature addition
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'complication',
        action: `Creature Chase: ${manualName} joins the pursuit!`,
        details: `DEX Save ${manualDexSave >= 0 ? '+' : ''}${manualDexSave}, Initiative ${manualInitiative >= 0 ? '+' : ''}${manualInitiative} added to battlefield`,
      },
    });

    onClose();
  };

  const handleQuickSelect = (suggestion: typeof AVERNUS_CREATURE_SUGGESTIONS[0]) => {
    // Search for the creature in Open5e
    handleSearchChange(suggestion.name);
    setTabIndex(0); // Switch to search tab
  };

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PetsIcon color="error" />
          <Typography variant="h6">
            Creature Chase Complication
          </Typography>
          <Chip label={`Roll: ${roll}`} size="small" color="warning" />
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Complication Info */}
          <Alert severity="warning" icon={<WarningAmberIcon />}>
            <Typography variant="body2" fontWeight={600}>
              {complication.description}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {complication.effect}
            </Typography>
          </Alert>

          {/* Quick Suggestions */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Quick Select - Common Avernus Creatures:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {AVERNUS_CREATURE_SUGGESTIONS.map((suggestion) => (
                <Chip
                  key={suggestion.name}
                  label={`${suggestion.name} (CR ${suggestion.cr})`}
                  size="small"
                  variant="outlined"
                  onClick={() => handleQuickSelect(suggestion)}
                  sx={{ cursor: 'pointer', mb: 0.5 }}
                />
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Tabs for Search vs Manual */}
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
            <Tab label="Search Open5e" icon={<SearchIcon />} iconPosition="start" />
            <Tab label="Manual Entry" icon={<AddIcon />} iconPosition="start" />
          </Tabs>

          {/* Search Tab */}
          {tabIndex === 0 && (
            <Box>
              <TextField
                fullWidth
                placeholder="Search for a creature (e.g., 'devil', 'demon', 'lemure')..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: isSearching ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ mb: 2 }}
              />

              {searchResults.length > 0 ? (
                <List sx={{ maxHeight: 300, overflow: 'auto', bgcolor: 'background.paper', borderRadius: 1 }}>
                  {searchResults.map((monster) => (
                    <ListItem key={monster.slug} disablePadding>
                      <ListItemButton onClick={() => handleSelectMonster(monster)}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography fontWeight={600}>{monster.name}</Typography>
                              <Chip label={`CR ${monster.challenge_rating}`} size="small" />
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
              ) : searchQuery.length >= 2 && !isSearching ? (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  No creatures found. Try a different search term or use manual entry.
                </Typography>
              ) : (
                <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                  Enter at least 2 characters to search Open5e for creatures.
                </Typography>
              )}
            </Box>
          )}

          {/* Manual Entry Tab */}
          {tabIndex === 1 && (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="Creature Name"
                    placeholder="e.g., Hellhound Pack Leader"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="HP"
                      type="number"
                      value={manualHp}
                      onChange={(e) => setManualHp(parseInt(e.target.value) || 1)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="AC"
                      type="number"
                      value={manualAc}
                      onChange={(e) => setManualAc(parseInt(e.target.value) || 10)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Speed"
                      type="number"
                      value={manualSpeed}
                      onChange={(e) => setManualSpeed(parseInt(e.target.value) || 30)}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <TextField
                      label="DEX Save"
                      type="number"
                      value={manualDexSave}
                      onChange={(e) => setManualDexSave(parseInt(e.target.value) || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">{manualDexSave >= 0 ? '+' : ''}</InputAdornment>,
                      }}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Initiative"
                      type="number"
                      value={manualInitiative}
                      onChange={(e) => setManualInitiative(parseInt(e.target.value) || 0)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">{manualInitiative >= 0 ? '+' : ''}</InputAdornment>,
                      }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddManualCreature}
                    disabled={!manualName.trim()}
                    fullWidth
                  >
                    Add {manualName || 'Creature'} to Battlefield
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Skip (No Creature Added)
        </Button>
      </DialogActions>
    </Dialog>
  );
}
