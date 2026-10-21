/**
 * Sidebar Component
 * Initiative tracker and creature/vehicle list
 */

import { useState, useRef } from 'react';
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
  ListItemText,
  ListItemIcon,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { convertOpen5eToCreature, type Open5eMonster } from '../../services/open5e';
import { MonsterSearchDialog } from '../creatures/MonsterSearchDialog';
import { StatblockDialog } from '../statblocks/StatblockDialog';
import { makeCustomNpc } from '../../utils/customNpc';
import { SquadRowControls } from '../squads/SquadRowControls';
import { MoraleRowControls } from '../morale/MoraleRowControls';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
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
import { resolveZone } from '../../data/vehicleTemplates';
import { factionColors, withOpacity } from '../../theme/customColors';
import { isNavalVehicle } from '../../data/navalUpgrades';
import { groupBySquad, squadInitiativeBonus } from '../../utils/squads';
import { SquadListGroup } from '../squads/SquadListGroup';
import { SquadInitiativeRow } from '../squads/SquadInitiativeRow';
import { rollShipInitiative, formatShipInitiativeLog, vehicleInitiative } from '../../utils/shipTurn';

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
  const [editFaction, setEditFaction] = useState<'party' | 'enemy'>('enemy');
  const [editBodies, setEditBodies] = useState(0);

  // Ship initiative edit state
  const [editingShipInitId, setEditingShipInitId] = useState<string | null>(null);
  const [shipInitDraft, setShipInitDraft] = useState('');
  const cancelShipInitRef = useRef(false);
  const saveShipInit = (id: string) => {
    if (cancelShipInitRef.current) return;
    const n = parseInt(shipInitDraft, 10);
    if (Number.isFinite(n)) dispatch({ type: 'UPDATE_VEHICLE', payload: { id, updates: { initiative: n } } });
    setEditingShipInitId(null);
  };

  // Open5e search state
  const [showOpen5eSearch, setShowOpen5eSearch] = useState(false);

  // Add NPC menu state
  const [addNpcMenuAnchor, setAddNpcMenuAnchor] = useState<null | HTMLElement>(null);

  // Statblock modal state
  const [viewingCreature, setViewingCreature] = useState<Creature | null>(null);

  // Add monster(s) from Open5e: more than one adds separate numbered creatures (build squads in the Squads tab)
  const handleAddOpen5eMonster = (monster: Open5eMonster, qty: number) => {
    const existingNpcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    for (let i = 0; i < qty; i++) {
      const index = existingNpcCount + i;
      const offsetX = (index % 5) * 30 - 60;
      const offsetY = Math.floor(index / 5) * 30 + 50;
      const creature = convertOpen5eToCreature(monster, { x: offsetX, y: offsetY });
      if (qty > 1) creature.name = `${monster.name} ${i + 1}`;
      addCreature(creature);
    }
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
      faction: 'party', // PCs are always party
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
    const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    const creature: Creature = {
      ...makeCustomNpc({
        name,
        hp: preset?.maxHp || creatureHp,
        ac: preset?.ac || creatureAc,
        speed: preset?.speed?.walk || creatureSpeed,
        initiative: creatureInit,
        size: preset?.size,
        type: preset?.type,
        cr: preset?.cr,
      }),
      position: { x: (npcCount % 5) * 30 - 60, y: Math.floor(npcCount / 5) * 30 + 50 },
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
    setEditFaction(creature.faction || 'enemy');
    setEditBodies(creature.stack?.bodies ?? 0);
  };

  const saveEdit = () => {
    if (!editingCreatureId) return;
    const existing = state.creatures.find(c => c.id === editingCreatureId)!;
    const existingStatblock = existing.statblock;
    dispatch({
      type: 'UPDATE_CREATURE',
      payload: {
        id: editingCreatureId,
        updates: {
          name: editName,
          currentHp: editHp,
          initiative: editInit,
          initiativeModifier: editDexSave,
          faction: editFaction,
          ...(existing.stack && { stack: { ...existing.stack, bodies: editBodies } }),
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

  // Ships roll their own initiative (GoS): d20 + Dex + crew quality, rolled alongside creatures
  const rollShipsInit = (faction: 'party' | 'enemy') => {
    state.vehicles
      .filter((v) => v.type === faction && isNavalVehicle(v.template))
      .forEach((ship) => {
        const roll = rollShipInitiative(ship, Math.floor(Math.random() * 20) + 1);
        dispatch({ type: 'UPDATE_VEHICLE', payload: { id: ship.id, updates: { initiative: roll.total } } });
        dispatch({ type: 'LOG_ACTION', payload: { type: 'system', action: formatShipInitiativeLog(ship.name, roll) } });
      });
  };

  // VVTT rule 5: uncommanded squads roll d20 + the leader's DEX modifier (else the first member's).
  // Party squads roll with the PC button, enemy squads with the NPC button. Commanded squads follow their PC.
  const rollSquadsInit = (faction: 'party' | 'enemy') => {
    state.squads
      .filter((s) => s.faction === faction && !s.commanderId && s.memberIds.length > 0)
      .forEach((squad) => {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const bonus = squadInitiativeBonus(squad, state.creatures);
        const total = d20 + bonus;
        dispatch({ type: 'UPDATE_SQUAD', payload: { id: squad.id, updates: { initiative: total } } });
        dispatch({
          type: 'LOG_ACTION',
          payload: { type: 'system', action: `${squad.name} initiative: ${d20} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)} = ${total} (VVTT rule: leader's DEX)` },
        });
      });
  };

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
    rollSquadsInit('enemy');
    rollShipsInit('enemy');
  };

  // Roll initiative for all Player Characters
  const handleRollAllPcInit = () => {
    const playerCharacters = state.creatures.filter(c => c.statblock.type === 'pc');
    playerCharacters.forEach(pc => {
      // Use savingThrows.dex if available, otherwise calculate from abilities.dex
      const dexMod = pc.statblock.savingThrows?.dex
        ?? Math.floor(((pc.statblock.abilities?.dex || 10) - 10) / 2);
      const roll = Math.floor(Math.random() * 20) + 1;
      const initiative = Math.max(1, roll + dexMod);

      dispatch({
        type: 'UPDATE_CREATURE',
        payload: {
          id: pc.id,
          updates: { initiative },
        },
      });
    });
    rollSquadsInit('party');
    rollShipsInit('party');
  };

  const pcs = state.creatures.filter((c) => c.statblock.type === 'pc');
  const npcs = state.creatures.filter((c) => c.statblock.type !== 'pc');

  // Helper to get crew assignment info for a creature
  const getCreatureAssignment = (creatureId: string) => {
    const assignment = state.crewAssignments.find(a => a.creatureId === creatureId);
    if (!assignment) return undefined;

    const vehicle = state.vehicles.find(v => v.id === assignment.vehicleId);
    if (!vehicle) return undefined;

    const zone = resolveZone(vehicle, assignment.zoneId);
    const isDriver = assignment.zoneId === 'helm' || assignment.zoneId === 'rider';

    return {
      vehicleName: vehicle.name,
      zoneName: zone?.name || assignment.zoneId,
      isDriver,
    };
  };

  const editState = { editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed, editDexSave, setEditDexSave, editFaction, setEditFaction, editBodies, setEditBodies };

  const renderPc = (creature: Creature, inSquad: boolean) => (
    <CreatureEntry
      key={creature.id}
      creature={creature}
      isPC={true}
      inSquad={inSquad}
      isEditing={editingCreatureId === creature.id}
      editState={editState}
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
            payload: { id: creature.id, updates: { position: { x: (pcCount % 5) * 30 - 60, y: Math.floor(pcCount / 5) * 30 - 50 } } },
          });
        }
      }}
      assignment={getCreatureAssignment(creature.id)}
    />
  );

  const renderNpc = (creature: Creature, inSquad: boolean) => (
    <CreatureEntry
      key={creature.id}
      creature={creature}
      isPC={false}
      inSquad={inSquad}
      isEditing={editingCreatureId === creature.id}
      editState={editState}
      onStartEdit={() => startEdit(creature)}
      onSaveEdit={saveEdit}
      onCancelEdit={cancelEdit}
      onRemove={() => removeCreature(creature.id)}
      onViewStatblock={() => setViewingCreature(creature)}
      onHpChange={(newHp) => {
        dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { currentHp: newHp } } });
      }}
      onToggleMap={() => {
        if (creature.position) {
          dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { position: undefined } } });
        } else {
          const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc' && c.position).length;
          dispatch({
            type: 'UPDATE_CREATURE',
            payload: { id: creature.id, updates: { position: { x: (npcCount % 5) * 30 - 60, y: Math.floor(npcCount / 5) * 30 + 50 } } },
          });
        }
      }}
      assignment={getCreatureAssignment(creature.id)}
    />
  );

  return (
    <Box
      component="aside"
      sx={{
        gridArea: 'sidebar',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        p: 2,
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
                      zone: resolveZone(vehicle, a.zoneId),
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
                          {isNavalVehicle(vehicle.template) || driver ? vehicleInitiative(vehicle, driver) : '—'}
                        </Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                          {(driver || !isNavalVehicle(vehicle.template)) && (
                            <Typography variant="caption" sx={{ color: driver ? 'text.secondary' : 'warning.main' }}>
                              {driver ? `Driver: ${driver.name}` : 'No driver - acts last!'}
                            </Typography>
                          )}
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

                const squad = state.squads.find((s) => s.id === entryId);
                if (squad) return <SquadInitiativeRow key={entryId} squad={squad} isActive={isActive} />;

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
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ color: 'success.main' }}>Player Characters</Typography>
              {(pcs.length > 0 || state.vehicles.some((v) => v.type === 'party' && isNavalVehicle(v.template)) || state.squads.some((s) => s.faction === 'party')) && (
                <Tooltip title="Roll initiative for all PCs (1d20 + DEX Save) and party ships (1d20 + DEX + crew quality) and squads (d20 + leader's DEX, VVTT rule)" arrow>
                  <IconButton
                    size="small"
                    onClick={handleRollAllPcInit}
                    sx={{ color: 'success.main' }}
                  >
                    <CasinoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
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
              {groupBySquad(pcs, state.squads).map((group) =>
                group.squad ? (
                  <SquadListGroup key={group.squad.id} squad={group.squad}>
                    {group.members.map((creature) => renderPc(creature, true))}
                  </SquadListGroup>
                ) : (
                  group.members.map((creature) => renderPc(creature, false))
                ),
              )}
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
              {(npcs.length > 0 || state.vehicles.some((v) => v.type === 'enemy' && isNavalVehicle(v.template)) || state.squads.some((s) => s.faction === 'enemy')) && (
                <Tooltip title="Roll initiative for all NPCs (1d20 + DEX Save) and enemy ships (1d20 + DEX + crew quality) and squads (d20 + leader's DEX, VVTT rule)" arrow>
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
              {groupBySquad(npcs, state.squads).map((group) =>
                group.squad ? (
                  <SquadListGroup key={group.squad.id} squad={group.squad}>
                    {group.members.map((creature) => renderNpc(creature, true))}
                  </SquadListGroup>
                ) : (
                  group.members.map((creature) => renderNpc(creature, false))
                ),
              )}
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
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isNavalVehicle(vehicle.template) && (
                        editingShipInitId === vehicle.id ? (
                          <TextField
                            size="small"
                            type="number"
                            autoFocus
                            value={shipInitDraft}
                            onChange={(e) => setShipInitDraft(e.target.value)}
                            onBlur={() => saveShipInit(vehicle.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveShipInit(vehicle.id);
                              if (e.key === 'Escape') { cancelShipInitRef.current = true; setEditingShipInitId(null); }
                            }}
                            inputProps={{ 'aria-label': `${vehicle.name} initiative`, style: { width: 40, padding: '2px 4px' } }}
                          />
                        ) : (
                          <Tooltip title={state.phase === 'setup' ? 'Ship initiative (d20 + DEX + crew quality). Click to edit.' : 'Ship initiative (fixed once combat starts)'} arrow>
                            <Chip
                              label={`Init ${vehicle.initiative ?? 0}`}
                              size="small"
                              variant="outlined"
                              onClick={state.phase === 'setup' ? () => { cancelShipInitRef.current = false; setShipInitDraft(String(vehicle.initiative ?? 0)); setEditingShipInitId(vehicle.id); } : undefined}
                              sx={{ height: 18, fontSize: '0.625rem' }}
                            />
                          </Tooltip>
                        )
                      )}
                      <Typography variant="caption" fontFamily="monospace">
                        {vehicle.currentHp}/{vehicle.template.maxHp}
                      </Typography>
                    </Box>
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
      <MonsterSearchDialog
        open={showOpen5eSearch}
        onClose={() => setShowOpen5eSearch(false)}
        title="Search Open5e Monsters"
        maxQuantity={20}
        quantityHint={() => '(will be numbered, e.g. "Goblin 1", "Goblin 2")'}
        onPick={handleAddOpen5eMonster}
      />

      {/* Statblock Modal */}
      <StatblockDialog creature={viewingCreature} onClose={() => setViewingCreature(null)} />
    </Box>
  );
}

// Creature Entry Component
interface CreatureEntryProps {
  creature: Creature;
  isPC: boolean;
  inSquad?: boolean; // member of a squad: managed in the Squads tab, no own token or morale
  isEditing: boolean;
  editState: {
    editName: string; setEditName: (v: string) => void;
    editHp: number; setEditHp: (v: number) => void;
    editMaxHp: number; setEditMaxHp: (v: number) => void;
    editAc: number; setEditAc: (v: number) => void;
    editInit: number; setEditInit: (v: number) => void;
    editSpeed: number; setEditSpeed: (v: number) => void;
    editDexSave: number; setEditDexSave: (v: number) => void;
    editFaction: 'party' | 'enemy'; setEditFaction: (v: 'party' | 'enemy') => void;
    editBodies: number; setEditBodies: (v: number) => void;
  };
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onToggleMap: () => void;
  onViewStatblock?: () => void; // Optional - only for NPCs with statblock data
  onHpChange?: (newHp: number) => void; // HP change handler for damage controls
  // Crew assignment info
  assignment?: {
    vehicleName: string;
    zoneName: string;
    isDriver: boolean;
  };
}

function CreatureEntry({ creature, isPC, inSquad = false, isEditing, editState, onStartEdit, onSaveEdit, onCancelEdit, onRemove, onToggleMap, onViewStatblock, onHpChange, assignment }: CreatureEntryProps) {
  // Use faction to determine color - party faction is blue/green, enemy is red
  const borderColor = creature.faction === 'party' ? factionColors.party : factionColors.enemy;
  const hasStatblock = !isPC && (creature.statblock.actions?.length || creature.statblock.traits?.length || creature.statblock.source === 'srd');

  // Damage controls state (only used for non-PCs)
  const [damageInput, setDamageInput] = useState('');

  const handleDealDamage = () => {
    if (!onHpChange) return;
    const damage = parseInt(damageInput, 10);
    if (isNaN(damage) || damage <= 0) return;
    onHpChange(Math.max(0, creature.currentHp - damage));
    setDamageInput('');
  };

  const handleHeal = () => {
    if (!onHpChange) return;
    const heal = parseInt(damageInput, 10);
    if (isNaN(heal) || heal <= 0) return;
    onHpChange(Math.min(creature.statblock.maxHp, creature.currentHp + heal));
    setDamageInput('');
  };

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
            {creature.stack && (
              <TextField size="small" label={`Bodies (of ${creature.stack.size})`} type="number" value={editState.editBodies}
                onChange={(e) => editState.setEditBodies(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            )}
            <TextField size="small" label={creature.stack ? 'Front HP' : 'HP'} type="number" value={editState.editHp} onChange={(e) => editState.setEditHp(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
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
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>Faction:</Typography>
            <ToggleButtonGroup
              value={editState.editFaction}
              exclusive
              onChange={(_, value) => value && editState.setEditFaction(value)}
              size="small"
              sx={{ flex: 1 }}
            >
              <ToggleButton value="party" sx={{ flex: 1, py: 0.5, fontSize: '0.75rem', color: factionColors.party, '&.Mui-selected': { bgcolor: withOpacity(factionColors.party, 0.2), color: factionColors.party } }}>
                Party
              </ToggleButton>
              <ToggleButton value="enemy" sx={{ flex: 1, py: 0.5, fontSize: '0.75rem', color: factionColors.enemy, '&.Mui-selected': { bgcolor: withOpacity(factionColors.enemy, 0.2), color: factionColors.enemy } }}>
                Enemy
              </ToggleButton>
            </ToggleButtonGroup>
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
        pr: 4.5, // Extra padding for the buttons in upper right
        pb: 3, // Extra padding for the map button in lower right
        position: 'relative',
        bgcolor: isDownOrDead ? withOpacity('#dc2626', 0.15) : '#242424',
        borderLeft: 3,
        borderColor: isDownOrDead ? 'error.main' : borderColor,
        opacity: isDead ? 0.6 : 1,
      }}
    >
      {/* Edit and Delete buttons in upper right corner */}
      <Stack
        direction="row"
        spacing={0}
        sx={{
          position: 'absolute',
          top: 2,
          right: 2,
        }}
      >
        <IconButton
          size="small"
          onClick={onStartEdit}
          sx={{
            padding: '2px',
            color: 'text.disabled',
            '&:hover': { color: 'primary.main', bgcolor: withOpacity('#ff4500', 0.2) },
          }}
          title="Edit"
        >
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={onRemove}
          sx={{
            padding: '2px',
            color: 'text.disabled',
            '&:hover': { color: 'error.main', bgcolor: withOpacity('#dc2626', 0.2) },
          }}
          title="Remove"
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Stack>

      {/* Map button in lower right corner */}
      {!inSquad && (
        <Tooltip title={isAssignedToVehicle ? 'Remove from vehicle first' : (creature.position ? 'Remove from map' : 'Place on map')} arrow>
          <span
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
            }}
          >
            <IconButton
              size="small"
              onClick={onToggleMap}
              disabled={isAssignedToVehicle}
              sx={{
                padding: '3px',
                bgcolor: creature.position && !isAssignedToVehicle ? withOpacity(borderColor, 0.2) : 'transparent',
                '&:hover': { bgcolor: withOpacity(borderColor, 0.3) },
              }}
            >
              <MapIcon sx={{ fontSize: 16, color: creature.position && !isAssignedToVehicle ? borderColor : 'text.secondary' }} />
            </IconButton>
          </span>
        </Tooltip>
      )}

      <Box>
        <Typography variant="body2" fontWeight={600} component="div" sx={{ pr: 1 }}>
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
            {creature.stack
              ? <>Bodies {creature.stack.bodies}/{creature.stack.size} · front {creature.currentHp}/{creature.statblock.maxHp} HP</>
              : <>HP: {creature.currentHp}/{creature.statblock.maxHp}</>} | AC: {creature.statblock.ac} | Init: {creature.initiative} | DEX Save: {
              creature.statblock.savingThrows?.dex !== undefined
                ? (creature.statblock.savingThrows.dex >= 0 ? '+' : '') + creature.statblock.savingThrows.dex
                : (creature.statblock.abilities?.dex
                  ? (Math.floor((creature.statblock.abilities.dex - 10) / 2) >= 0 ? '+' : '') + Math.floor((creature.statblock.abilities.dex - 10) / 2)
                  : '—')
            }
          </Typography>
        )}
        {/* Damage/Heal controls for non-PCs */}
        {!isPC && !inSquad && creature.stack && <SquadRowControls creature={creature} />}
        {!isPC && !inSquad && <MoraleRowControls creature={creature} />}
        {!isPC && !creature.stack && onHpChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <TextField
              type="number"
              size="small"
              value={damageInput}
              onChange={(e) => setDamageInput(e.target.value)}
              placeholder="±HP"
              sx={{ width: 55 }}
              inputProps={{ min: 1, style: { textAlign: 'center', padding: '3px', fontSize: '0.7rem' } }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDealDamage();
              }}
            />
            <IconButton
              size="small"
              color="error"
              onClick={handleDealDamage}
              disabled={!damageInput || parseInt(damageInput, 10) <= 0}
              title="Deal damage"
              sx={{ p: 0.25 }}
            >
              <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              color="success"
              onClick={handleHeal}
              disabled={!damageInput || parseInt(damageInput, 10) <= 0}
              title="Heal"
              sx={{ p: 0.25 }}
            >
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}
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
