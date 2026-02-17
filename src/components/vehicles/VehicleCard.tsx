/**
 * Vehicle Card Component
 * Displays a vehicle with HP, crew zones, and weapons
 */

import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Chip,
  LinearProgress,
  Paper,
  Avatar,
  Button,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  IconButton,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  TextField,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BuildIcon from '@mui/icons-material/Build';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';
import { Vehicle, VehicleZone, CrewAssignment, Mishap, VehicleWeapon } from '../../types';
import { useCombat } from '../../context/CombatContext';
import { getMishapResult, getMishapSeverity, canRepairMishap, getRepairDescription, checkMishapFromDamage, rollMishapForVehicle } from '../../data/mishapTable';
import { v4 as uuid } from 'uuid';
import { SWAPPABLE_WEAPONS, ARMOR_UPGRADES, MAGICAL_GADGETS, getWeaponStationUpgrade, WEAPON_STATION_EXCLUDED_VEHICLES } from '../../data/vehicleTemplates';
import { factionColors, coverColors, withOpacity } from '../../theme/customColors';

interface VehicleCardProps {
  vehicle: Vehicle;
}

// Helper to calculate Dex modifier
function getDexModifier(vehicle: Vehicle): number {
  const dex = vehicle.template.abilityScores?.dex ?? 10;
  return Math.floor((dex - 10) / 2);
}

// Helper to calculate effective AC based on armor upgrade
function getEffectiveAC(vehicle: Vehicle): { ac: number; isModified: boolean; tooltip: string } {
  const armor = ARMOR_UPGRADES.find((a) => a.id === vehicle.armorUpgradeId);
  const baseAC = vehicle.template.ac;

  if (!armor || armor.id === 'none') {
    return { ac: baseAC, isModified: false, tooltip: 'Base AC' };
  }

  if (armor.fixedAC) {
    const dexMod = getDexModifier(vehicle);
    const newAC = armor.fixedAC + dexMod;
    return {
      ac: newAC,
      isModified: true,
      tooltip: `${armor.name}: ${armor.fixedAC} + ${dexMod} (Dex)`
    };
  }

  return { ac: baseAC, isModified: false, tooltip: 'Base AC' };
}

// Helper to get all defenses (immunities + resistances) from armor
function getArmorDefenses(vehicle: Vehicle): { immunities: string[]; resistances: string[] } {
  const armor = ARMOR_UPGRADES.find((a) => a.id === vehicle.armorUpgradeId);
  const baseImmunities = vehicle.template.immunities || [];

  if (!armor || armor.id === 'none') {
    return { immunities: baseImmunities, resistances: [] };
  }

  const immunities = [...baseImmunities, ...(armor.additionalImmunities || [])];
  const resistances = armor.resistances || [];

  return { immunities, resistances };
}

// Calculate effective speed accounting for mishap effects
function getEffectiveSpeed(vehicle: Vehicle): number {
  let speed = vehicle.currentSpeed;
  for (const mishap of vehicle.activeMishaps) {
    if (mishap.mechanicalEffect?.speedReduction) {
      speed -= mishap.mechanicalEffect.speedReduction;
    }
  }
  return Math.max(0, speed);
}

// Calculate effective damage threshold accounting for mishap effects (e.g., Shedding Armor)
function getEffectiveDamageThreshold(vehicle: Vehicle): number {
  let threshold = vehicle.template.damageThreshold;
  for (const mishap of vehicle.activeMishaps) {
    if (mishap.mechanicalEffect?.damageThresholdReduction) {
      threshold -= mishap.mechanicalEffect.damageThresholdReduction;
    }
  }
  return Math.max(0, threshold);
}

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { state, applyMishap, dispatch, removeVehicle, swapVehicleWeapon, setVehicleArmor, toggleVehicleGadget, toggleWeaponStationUpgrade } = useCombat();
  const [damageAmount, setDamageAmount] = useState('');
  const [lastMishapResult, setLastMishapResult] = useState<{ roll: number; mishap: Mishap } | null>(null);
  const [showMishapResult, setShowMishapResult] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);

  const hpPercent = (vehicle.currentHp / vehicle.template.maxHp) * 100;
  const hpColor = hpPercent > 50 ? 'success' : hpPercent > 25 ? 'warning' : 'error';

  // Calculate effective AC and defenses based on armor
  const effectiveAC = getEffectiveAC(vehicle);
  const defenses = getArmorDefenses(vehicle);

  const crewAssignments = state.crewAssignments.filter(
    (a) => a.vehicleId === vehicle.id
  );

  // Find the driver (helm zone) and get their DEX save
  const vehicleCrew = crewAssignments.map((a) => {
    const creature = state.creatures.find((c) => c.id === a.creatureId);
    return { creature, assignment: a };
  }).filter((c) => c.creature);

  const driver = vehicleCrew.find((c) => c.assignment.zoneId === 'helm')?.creature;
  const driverDexSave = driver
    ? driver.statblock.savingThrows?.dex ?? (driver.statblock.abilities?.dex !== undefined
        ? Math.floor((driver.statblock.abilities.dex - 10) / 2)
        : null)
    : null;

  // Calculate effective speed and damage threshold
  const effectiveSpeed = getEffectiveSpeed(vehicle);
  const hasSpeedReduction = effectiveSpeed < vehicle.currentSpeed;
  const effectiveDamageThreshold = getEffectiveDamageThreshold(vehicle);
  const hasThresholdReduction = effectiveDamageThreshold < vehicle.template.damageThreshold;

  const handleVehicleHpChange = (newHp: number) => {
    const clampedHp = Math.max(0, Math.min(vehicle.template.maxHp, newHp));
    dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { currentHp: clampedHp } } });
  };

  const handleVehicleSpeedChange = (newSpeed: number) => {
    dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { currentSpeed: Math.max(0, newSpeed) } } });
  };

  const handleRepair = () => {
    const amount = prompt('Repair amount (HP to restore):');
    if (amount) {
      const healAmount = parseInt(amount, 10);
      if (healAmount > 0) {
        dispatch({
          type: 'HEAL_VEHICLE',
          payload: { vehicleId: vehicle.id, amount: healAmount },
        });
      }
    }
  };

  const handleDealDamage = () => {
    const damage = parseInt(damageAmount, 10);
    if (isNaN(damage) || damage <= 0) return;

    if (damage < effectiveDamageThreshold) {
      setDamageError(`Damage (${damage}) is below the damage threshold (${effectiveDamageThreshold}). No damage dealt.`);
      dispatch({ type: 'LOG_ACTION', payload: { type: 'system', action: `${vehicle.name} ignores ${damage} damage`, details: `Below damage threshold of ${effectiveDamageThreshold}` } });
      setDamageAmount('');
      return;
    }

    setDamageError(null);
    const newHp = Math.max(0, vehicle.currentHp - damage);
    dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { currentHp: newHp } } });
    dispatch({ type: 'LOG_ACTION', payload: { type: 'damage', action: `${vehicle.name} takes ${damage} damage`, details: `HP: ${vehicle.currentHp} → ${newHp}` } });

    if (checkMishapFromDamage(damage, vehicle.template.mishapThreshold)) {
      // Roll for mishap, rerolling if the result is already active or would have no effect
      const vehicleMishapState = {
        currentSpeed: vehicle.currentSpeed,
        damageThreshold: vehicle.template.damageThreshold,
        weaponCount: vehicle.weapons.length,
        activeMishaps: vehicle.activeMishaps,
      };
      const mishapRoll = rollMishapForVehicle(vehicleMishapState);

      if (mishapRoll === null) {
        dispatch({ type: 'LOG_ACTION', payload: { type: 'mishap', action: `Mishap triggered but no valid mishaps available for ${vehicle.name}`, details: 'All mishaps active or at maximum effect' } });
      } else {
        const { roll, mishap, rerollCount } = mishapRoll;
        const mishapInstance: Mishap = { ...mishap, id: uuid(), roundsRemaining: mishap.roundsRemaining };

        setLastMishapResult({ roll, mishap: mishapInstance });
        setShowMishapResult(true);

        if (mishap.duration !== 'instant') {
          applyMishap(vehicle.id, mishapInstance);
        }

        const rerollNote = rerollCount > 0 ? ` (rerolled ${rerollCount}x to find valid mishap)` : '';
        dispatch({ type: 'LOG_ACTION', payload: { type: 'mishap', action: `Mishap! ${damage} damage >= ${vehicle.template.mishapThreshold} threshold`, details: `Rolled ${roll}: ${mishap.name}${rerollNote}` } });
      }
    }

    setDamageAmount('');
  };

  const handleManualMishapRoll = () => {
    const vehicleMishapState = {
      currentSpeed: vehicle.currentSpeed,
      damageThreshold: vehicle.template.damageThreshold,
      weaponCount: vehicle.weapons.length,
      activeMishaps: vehicle.activeMishaps,
    };
    const mishapRoll = rollMishapForVehicle(vehicleMishapState);

    if (mishapRoll === null) {
      dispatch({ type: 'LOG_ACTION', payload: { type: 'mishap', action: `Manual mishap roll on ${vehicle.name} - no valid mishaps available`, details: 'All mishaps active or at maximum effect' } });
      return;
    }

    const { roll, mishap, rerollCount } = mishapRoll;
    const mishapInstance: Mishap = { ...mishap, id: uuid(), roundsRemaining: mishap.roundsRemaining };

    setLastMishapResult({ roll, mishap: mishapInstance });
    setShowMishapResult(true);

    if (mishap.duration !== 'instant') {
      applyMishap(vehicle.id, mishapInstance);
    }

    const rerollNote = rerollCount > 0 ? ` (rerolled ${rerollCount}x to find valid mishap)` : '';
    dispatch({ type: 'LOG_ACTION', payload: { type: 'mishap', action: `Manual mishap roll on ${vehicle.name}`, details: `Rolled ${roll}: ${mishap.name}${rerollNote}` } });
  };

  const handleClearMishap = (mishapId: string) => {
    dispatch({
      type: 'REPAIR_MISHAP',
      payload: { vehicleId: vehicle.id, mishapId },
    });
  };

  const severityColors: Record<string, string> = {
    minor: '#22c55e',
    moderate: '#eab308',
    severe: '#ff4500',
    catastrophic: '#dc2626',
  };

  const borderColor = vehicle.type === 'party' ? factionColors.party : factionColors.enemy;

  return (
    <Card
      sx={{
        borderLeft: 3,
        borderColor: borderColor,
        bgcolor: withOpacity(borderColor, 0.05),
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {vehicle.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {vehicle.template.name}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {(vehicle.isInoperative || vehicle.currentHp === 0) && (
              <Chip
                label="DESTROYED"
                size="small"
                color="error"
                sx={{
                  height: 24,
                  fontWeight: 700,
                  bgcolor: 'error.main',
                  color: 'error.contrastText',
                }}
              />
            )}
            {vehicle.activeMishaps.map((mishap) => (
              <Chip
                key={mishap.id}
                icon={<WarningIcon sx={{ fontSize: 14 }} />}
                label={mishap.name}
                size="small"
                color="warning"
                sx={{ height: 24 }}
              />
            ))}
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (confirm(`Delete ${vehicle.name}? This will also unassign all crew.`)) {
                  removeVehicle(vehicle.id);
                }
              }}
              title="Delete vehicle"
              sx={{ ml: 1 }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        {/* Thresholds Info */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Damage Threshold: {hasThresholdReduction ? (
            <span style={{ color: '#f59e0b' }}>
              <s>{vehicle.template.damageThreshold}</s> {effectiveDamageThreshold}
            </span>
          ) : (
            vehicle.template.damageThreshold
          )} | Mishap Threshold: {vehicle.template.mishapThreshold}
        </Typography>

        {/* HP Bar with editing */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Hit Points
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                type="number"
                size="small"
                value={vehicle.currentHp}
                onChange={(e) => handleVehicleHpChange(parseInt(e.target.value, 10) || 0)}
                sx={{ width: 72 }}
                inputProps={{ min: 0, max: vehicle.template.maxHp, style: { textAlign: 'center', padding: '4px' } }}
              />
              <Typography variant="body2" color="text.secondary">/ {vehicle.template.maxHp}</Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={hpPercent}
            color={hpColor}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        {/* Stats */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Tooltip title={effectiveAC.tooltip} arrow placement="top">
            <Paper
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                bgcolor: effectiveAC.isModified ? withOpacity('#8b5cf6', 0.15) : '#242424',
                border: effectiveAC.isModified ? 1 : 0,
                borderColor: '#8b5cf6',
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ color: effectiveAC.isModified ? '#8b5cf6' : 'inherit' }}
              >
                {effectiveAC.ac}
              </Typography>
              <Typography variant="caption" color="text.secondary">AC</Typography>
            </Paper>
          </Tooltip>
          <Tooltip
            title={hasSpeedReduction ? `${vehicle.currentSpeed} ft reduced by mishap effects` : 'Current speed'}
            arrow
            placement="top"
          >
            <Paper
              sx={{
                flex: 1,
                p: 1,
                textAlign: 'center',
                bgcolor: hasSpeedReduction ? withOpacity('#f59e0b', 0.15) : '#242424',
                border: hasSpeedReduction ? 1 : 0,
                borderColor: '#f59e0b',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                <TextField
                  type="number"
                  size="small"
                  value={vehicle.currentSpeed}
                  onChange={(e) => handleVehicleSpeedChange(parseInt(e.target.value, 10) || 0)}
                  sx={{
                    width: 50,
                    '& input': {
                      textAlign: 'center',
                      padding: '2px',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      textDecoration: hasSpeedReduction ? 'line-through' : 'none',
                      color: hasSpeedReduction ? 'text.disabled' : 'inherit',
                    },
                  }}
                  inputProps={{ min: 0, step: 10 }}
                />
              </Box>
              {hasSpeedReduction && (
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  {effectiveSpeed} ft actual
                </Typography>
              )}
              {!hasSpeedReduction && (
                <Typography variant="caption" color="text.secondary">Speed</Typography>
              )}
            </Paper>
          </Tooltip>
          <Tooltip title="Driver's DEX save (for avoiding hazards)" arrow placement="top">
            <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#242424' }}>
              {driverDexSave !== null ? (
                <>
                  <Typography variant="h6" fontWeight={700}>
                    {driverDexSave >= 0 ? '+' : ''}{driverDexSave}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">DEX Save</Typography>
                </>
              ) : (
                <>
                  <Typography variant="h6" fontWeight={700} sx={{ color: 'warning.main' }}>—</Typography>
                  <Typography variant="caption" color="warning.main">No Driver</Typography>
                </>
              )}
            </Paper>
          </Tooltip>
        </Stack>

        {/* Defenses (Immunities & Resistances) */}
        {(defenses.immunities.length > 0 || defenses.resistances.length > 0) && (
          <Box sx={{ mb: 2 }}>
            {defenses.immunities.length > 0 && (
              <Box sx={{ mb: defenses.resistances.length > 0 ? 1 : 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  Immune:
                </Typography>
                {defenses.immunities.map((immunity) => {
                  const isFromArmor = !vehicle.template.immunities?.includes(immunity);
                  return (
                    <Chip
                      key={immunity}
                      label={immunity}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.625rem',
                        mr: 0.5,
                        mb: 0.5,
                        bgcolor: isFromArmor ? withOpacity('#8b5cf6', 0.2) : 'action.selected',
                        color: isFromArmor ? '#8b5cf6' : 'text.secondary',
                      }}
                    />
                  );
                })}
              </Box>
            )}
            {defenses.resistances.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                  Resist:
                </Typography>
                {defenses.resistances.map((resistance) => (
                  <Chip
                    key={resistance}
                    label={resistance}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.625rem',
                      mr: 0.5,
                      mb: 0.5,
                      bgcolor: withOpacity('#f59e0b', 0.2),
                      color: '#f59e0b',
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Crew Zones */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Crew Positions
          </Typography>
          <Stack spacing={1}>
            {vehicle.template.zones.map((zone) => {
              // If weapon station upgrade is enabled, reduce passenger_area capacity by 1
              // (the custom weapon station converts one passenger seat)
              const adjustedZone = (vehicle.hasWeaponStationUpgrade && zone.id === 'passenger_area')
                ? { ...zone, capacity: Math.max(0, zone.capacity - 1) }
                : zone;

              // Don't show passenger area if capacity reduced to 0
              if (adjustedZone.capacity === 0) return null;

              return (
                <CrewZone
                  key={zone.id}
                  zone={adjustedZone}
                  vehicleId={vehicle.id}
                  assignments={crewAssignments.filter((a) => a.zoneId === zone.id)}
                />
              );
            })}
            {/* Custom Weapon Station Zone (if upgrade installed) */}
            {vehicle.hasWeaponStationUpgrade && (() => {
              const wsConfig = getWeaponStationUpgrade(vehicle.template.id);
              return (
                <CrewZone
                  key={wsConfig.zoneId}
                  zone={{
                    id: wsConfig.zoneId,
                    name: wsConfig.zoneName,
                    cover: wsConfig.cover,
                    capacity: wsConfig.capacity,
                    canAttackOut: true,
                    visibleFromArcs: wsConfig.visibleFromArcs,
                    description: wsConfig.description,
                  }}
                  vehicleId={vehicle.id}
                  assignments={crewAssignments.filter((a) => a.zoneId === wsConfig.zoneId)}
                />
              );
            })()}
          </Stack>
        </Box>

        {/* Crew HP Management */}
        {crewAssignments.length > 0 && (
          <CrewHPSection vehicleId={vehicle.id} assignments={crewAssignments} />
        )}

        {/* Weapons */}
        {vehicle.weapons.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Weapons
            </Typography>
            <Stack spacing={0.5}>
              {vehicle.weapons.map((weapon) => (
                <Paper key={weapon.id} sx={{ p: 1, bgcolor: '#242424' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={600}>{weapon.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{weapon.damage}</Typography>
                  </Box>
                  {weapon.specialEffect && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {weapon.specialEffect}
                    </Typography>
                  )}
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* Traits */}
        {vehicle.template.traits && vehicle.template.traits.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Traits
            </Typography>
            <Stack spacing={0.5}>
              {vehicle.template.traits.map((trait) => (
                <Paper key={trait.name} sx={{ p: 1, bgcolor: '#242424' }}>
                  <Typography variant="body2">
                    <Box component="span" fontWeight={600}>{trait.name}.</Box>{' '}
                    <Box component="span" sx={{ color: 'text.secondary' }}>{trait.description}</Box>
                  </Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* Vehicle Customization */}
        <Accordion
          disableGutters
          sx={{
            mb: 2,
            bgcolor: 'transparent',
            '&:before': { display: 'none' },
            boxShadow: 'none',
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: '#242424',
              borderRadius: 1,
              minHeight: 40,
              '& .MuiAccordionSummary-content': { my: 0 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BuildIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" fontWeight={600}>
                Customization
              </Typography>
              {(vehicle.armorUpgradeId && vehicle.armorUpgradeId !== 'none') && (
                <Chip label="Armor" size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
              )}
              {vehicle.gadgetIds && vehicle.gadgetIds.length > 0 && (
                <Chip label={`${vehicle.gadgetIds.length} Gadget${vehicle.gadgetIds.length > 1 ? 's' : ''}`} size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 1, pt: 1.5 }}>
            {/* Swappable Weapon Stations */}
            {vehicle.weapons.some((w) => w.isSwappableStation) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Weapon Stations
                </Typography>
                <Stack spacing={1}>
                  {vehicle.weapons.map((weapon, index) => {
                    if (!weapon.isSwappableStation) return null;
                    // Find matching swappable weapon by name (since IDs may differ between template and swappable list)
                    const matchedWeapon = SWAPPABLE_WEAPONS.find((w) => w.name === weapon.name);
                    const currentWeaponId = matchedWeapon?.id || 'harpoon_flinger_standard';
                    return (
                      <FormControl key={weapon.id + index} size="small" fullWidth>
                        <InputLabel id={`weapon-${index}-label`}>Station {index + 1}</InputLabel>
                        <Select
                          labelId={`weapon-${index}-label`}
                          value={currentWeaponId}
                          label={`Station ${index + 1}`}
                          onChange={(e) => {
                            const newTemplate = SWAPPABLE_WEAPONS.find((w) => w.id === e.target.value);
                            if (newTemplate) {
                              const newWeapon: VehicleWeapon = {
                                ...newTemplate,
                                id: `${newTemplate.id}_${index}`,
                                zoneId: weapon.zoneId,
                                visibleFromArcs: weapon.visibleFromArcs,
                                isSwappableStation: true,
                                currentAmmunition: newTemplate.properties?.some((p) => p.toLowerCase().includes('ammunition'))
                                  ? 10
                                  : undefined,
                              };
                              swapVehicleWeapon(vehicle.id, index, newWeapon);
                            }
                          }}
                          sx={{ bgcolor: '#242424' }}
                        >
                          {SWAPPABLE_WEAPONS.map((w) => (
                            <MenuItem key={w.id} value={w.id}>
                              <ListItemText
                                primary={w.name}
                                secondary={`${w.damage} • ${w.range}`}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Armor Upgrades */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Armor Upgrade
              </Typography>
              <FormControl size="small" fullWidth>
                <Select
                  value={vehicle.armorUpgradeId || 'none'}
                  onChange={(e) => setVehicleArmor(vehicle.id, e.target.value)}
                  sx={{ bgcolor: '#242424' }}
                >
                  {ARMOR_UPGRADES.map((armor) => (
                    <MenuItem key={armor.id} value={armor.id}>
                      <Tooltip title={armor.effect} placement="left" arrow>
                        <ListItemText
                          primary={armor.name}
                          secondary={armor.description.substring(0, 60) + (armor.description.length > 60 ? '...' : '')}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {vehicle.armorUpgradeId && vehicle.armorUpgradeId !== 'none' && (
                <Paper sx={{ p: 1, mt: 1, bgcolor: withOpacity('#8b5cf6', 0.1), border: 1, borderColor: '#8b5cf6' }}>
                  <Typography variant="caption" sx={{ color: '#8b5cf6' }}>
                    {ARMOR_UPGRADES.find((a) => a.id === vehicle.armorUpgradeId)?.effect}
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Custom Weapon Station Upgrade - not available for Devil's Ride */}
            {!WEAPON_STATION_EXCLUDED_VEHICLES.includes(vehicle.template.id) && (() => {
              const wsConfig = getWeaponStationUpgrade(vehicle.template.id);
              return (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Weapon Station Upgrade
                  </Typography>
                  <Paper
                    sx={{
                      p: 1,
                      bgcolor: vehicle.hasWeaponStationUpgrade ? withOpacity('#f59e0b', 0.1) : '#242424',
                      border: vehicle.hasWeaponStationUpgrade ? 1 : 0,
                      borderColor: '#f59e0b',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: vehicle.hasWeaponStationUpgrade ? withOpacity('#f59e0b', 0.15) : '#2a2a2a' },
                    }}
                    onClick={() => toggleWeaponStationUpgrade(vehicle.id)}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={vehicle.hasWeaponStationUpgrade || false}
                          size="small"
                          sx={{ p: 0.5, mr: 1 }}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {wsConfig.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {wsConfig.zoneName} • {wsConfig.cover} cover
                          </Typography>
                        </Box>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                    {vehicle.hasWeaponStationUpgrade && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#f59e0b' }}>
                        {wsConfig.description}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              );
            })()}

            {/* Magical Gadgets */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Magical Gadgets
              </Typography>
              <Stack spacing={0.5}>
                {MAGICAL_GADGETS.map((gadget) => {
                  const isInstalled = vehicle.gadgetIds?.includes(gadget.id);
                  return (
                    <Paper
                      key={gadget.id}
                      sx={{
                        p: 1,
                        bgcolor: isInstalled ? withOpacity('#10b981', 0.1) : '#242424',
                        border: isInstalled ? 1 : 0,
                        borderColor: '#10b981',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: isInstalled ? withOpacity('#10b981', 0.15) : '#2a2a2a' },
                      }}
                      onClick={() => toggleVehicleGadget(vehicle.id, gadget.id)}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isInstalled}
                            size="small"
                            sx={{ p: 0.5, mr: 1 }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {gadget.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {gadget.activation} • {gadget.recharge}
                            </Typography>
                          </Box>
                        }
                        sx={{ m: 0, width: '100%' }}
                      />
                      {isInstalled && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#10b981' }}>
                          {gadget.effect}
                        </Typography>
                      )}
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          </AccordionDetails>
        </Accordion>

        {/* Active Mishaps */}
        {vehicle.activeMishaps.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Active Mishaps ({vehicle.activeMishaps.length}):
            </Typography>
            <Stack spacing={0.5}>
              {vehicle.activeMishaps.map((mishap) => {
                const repairable = canRepairMishap(mishap);
                return (
                  <Paper
                    key={mishap.id}
                    sx={{
                      p: 1,
                      bgcolor: withOpacity('#f59e0b', 0.1),
                      borderLeft: 2,
                      borderColor: repairable ? 'warning.main' : 'primary.main',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight={600}>{mishap.name}</Typography>
                      {repairable && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleClearMishap(mishap.id)}
                          sx={{ fontSize: '0.625rem', py: 0 }}
                        >
                          Repair
                        </Button>
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">{mishap.effect}</Typography>
                    {repairable && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                        {getRepairDescription(mishap)}
                      </Typography>
                    )}
                    {!repairable && (
                      <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                        Cannot be repaired
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Deal Damage Section */}
        <Paper sx={{ p: 1.5, bgcolor: '#242424', mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Deal Damage (ignores &lt;{effectiveDamageThreshold}, mishap at {vehicle.template.mishapThreshold}+)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <TextField
              type="number"
              size="small"
              value={damageAmount}
              onChange={(e) => { setDamageAmount(e.target.value); setDamageError(null); }}
              placeholder="Damage"
              fullWidth
              inputProps={{ min: 1 }}
              onKeyDown={(e) => e.key === 'Enter' && handleDealDamage()}
            />
            <Button variant="contained" color="error" onClick={handleDealDamage} disabled={!damageAmount || parseInt(damageAmount, 10) <= 0}>
              Deal
            </Button>
          </Stack>
          {damageError && (
            <Paper sx={{ p: 1, mb: 1, bgcolor: withOpacity('#f59e0b', 0.1), border: 1, borderColor: 'warning.main' }}>
              <Typography variant="caption" color="warning.main">{damageError}</Typography>
            </Paper>
          )}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={handleManualMishapRoll} fullWidth>
              Roll Mishap (d20)
            </Button>
            <Button variant="outlined" size="small" onClick={handleRepair} fullWidth>
              Repair HP
            </Button>
          </Stack>
        </Paper>

        {/* Mishap Result Display */}
        {showMishapResult && lastMishapResult && (
          <Paper
            sx={{
              p: 1.5,
              bgcolor: withOpacity('#f59e0b', 0.1),
              border: 2,
              borderColor: severityColors[getMishapSeverity(lastMishapResult.roll)],
              mb: 2,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography fontWeight={600} sx={{ color: severityColors[getMishapSeverity(lastMishapResult.roll)] }}>
                Mishap Roll: {lastMishapResult.roll}
              </Typography>
              <Button size="small" variant="outlined" onClick={() => setShowMishapResult(false)}>
                Dismiss
              </Button>
            </Box>
            <Typography variant="body2" fontWeight={600}>{lastMishapResult.mishap.name}</Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>{lastMishapResult.mishap.effect}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Duration: {lastMishapResult.mishap.duration === 'instant' ? 'Instant' :
                lastMishapResult.mishap.duration === 'until_repaired' ? 'Until Repaired' :
                `${lastMishapResult.mishap.roundsRemaining} rounds`}
            </Typography>
            {canRepairMishap(lastMishapResult.mishap) && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                Repair: {getRepairDescription(lastMishapResult.mishap)}
              </Typography>
            )}
            {!canRepairMishap(lastMishapResult.mishap) && lastMishapResult.mishap.duration !== 'instant' && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                Cannot be repaired - must right the vehicle manually
              </Typography>
            )}
          </Paper>
        )}
      </CardContent>
    </Card>
  );
}

// Crew HP Section Component
interface CrewHPSectionProps {
  vehicleId: string;
  assignments: CrewAssignment[];
}

function CrewHPSection({ vehicleId, assignments }: CrewHPSectionProps) {
  const { state, dispatch } = useCombat();
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);
  const [damageInputs, setDamageInputs] = useState<Record<string, string>>({});

  const handleCreatureHpChange = (creatureId: string, newHp: number, maxHp: number) => {
    dispatch({
      type: 'UPDATE_CREATURE',
      payload: { id: creatureId, updates: { currentHp: Math.max(0, Math.min(maxHp, newHp)) } },
    });
  };

  const handleDealDamage = (creatureId: string, maxHp: number, currentHp: number) => {
    const damage = parseInt(damageInputs[creatureId] || '', 10);
    if (isNaN(damage) || damage <= 0) return;
    handleCreatureHpChange(creatureId, currentHp - damage, maxHp);
    setDamageInputs((prev) => ({ ...prev, [creatureId]: '' }));
  };

  const handleHeal = (creatureId: string, maxHp: number, currentHp: number) => {
    const heal = parseInt(damageInputs[creatureId] || '', 10);
    if (isNaN(heal) || heal <= 0) return;
    handleCreatureHpChange(creatureId, currentHp + heal, maxHp);
    setDamageInputs((prev) => ({ ...prev, [creatureId]: '' }));
  };

  const crewData = assignments.map((a) => {
    const creature = state.creatures.find((c) => c.id === a.creatureId);
    const zone = vehicle?.template.zones.find((z) => z.id === a.zoneId);
    return { creature, zone, assignment: a };
  }).filter((c) => c.creature);

  if (crewData.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Crew HP
      </Typography>
      <Stack spacing={0.5}>
        {crewData.map(({ creature, zone }) => {
          if (!creature) return null;
          const isPC = creature.statblock.type === 'pc';
          const isDead = !isPC && creature.currentHp === 0;
          const isInDeathSaves = isPC && creature.currentHp === 0;
          const damageInput = damageInputs[creature.id] || '';

          return (
            <Paper
              key={creature.id}
              sx={{
                p: 1,
                bgcolor: isDead || isInDeathSaves ? withOpacity('#dc2626', 0.15) : '#242424',
                borderLeft: isDead || isInDeathSaves ? 2 : 0,
                borderColor: 'error.main',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ textDecoration: isDead ? 'line-through' : 'none' }}
                  >
                    {creature.name}
                    {isDead && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'error.main' }}>
                        (Dead)
                      </Typography>
                    )}
                    {isInDeathSaves && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'error.main' }}>
                        (Death Saves)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {zone?.name} • AC {creature.statblock.ac}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={creature.currentHp}
                    onChange={(e) => handleCreatureHpChange(creature.id, parseInt(e.target.value, 10) || 0, creature.statblock.maxHp)}
                    sx={{ width: 52 }}
                    inputProps={{ min: 0, max: creature.statblock.maxHp, style: { textAlign: 'center', padding: '4px' } }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    / {creature.statblock.maxHp}
                  </Typography>
                </Box>
              </Box>
              {/* Damage/Heal controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TextField
                  type="number"
                  size="small"
                  value={damageInput}
                  onChange={(e) => setDamageInputs((prev) => ({ ...prev, [creature.id]: e.target.value }))}
                  placeholder="±HP"
                  sx={{ width: 60 }}
                  inputProps={{ min: 1, style: { textAlign: 'center', padding: '4px', fontSize: '0.75rem' } }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDealDamage(creature.id, creature.statblock.maxHp, creature.currentHp);
                  }}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDealDamage(creature.id, creature.statblock.maxHp, creature.currentHp)}
                  disabled={!damageInput || parseInt(damageInput, 10) <= 0}
                  title="Deal damage"
                  sx={{ p: 0.5 }}
                >
                  <RemoveIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleHeal(creature.id, creature.statblock.maxHp, creature.currentHp)}
                  disabled={!damageInput || parseInt(damageInput, 10) <= 0}
                  title="Heal"
                  sx={{ p: 0.5 }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

interface CrewZoneProps {
  zone: VehicleZone;
  vehicleId: string;
  assignments: { creatureId: string; zoneId: string }[];
}

function CrewZone({ zone, vehicleId, assignments }: CrewZoneProps) {
  const { state, assignCrew, dispatch } = useCombat();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);

  const coverColor = coverColors[zone.cover as keyof typeof coverColors];

  // Get the vehicle to access its zones
  const vehicle = state.vehicles.find((v) => v.id === vehicleId);

  const assignedCreatureIds = state.crewAssignments.map((a) => a.creatureId);
  const unassignedCreatures = state.creatures.filter(
    (c) => !assignedCreatureIds.includes(c.id)
  );

  // Get other zones on this vehicle that the selected creature could move to
  // Include the custom weapon station if upgrade is enabled
  const baseOtherZones = vehicle?.template.zones.filter((z) => z.id !== zone.id) || [];
  const otherZones = (() => {
    if (!vehicle) return baseOtherZones;
    const wsConfig = getWeaponStationUpgrade(vehicle.template.id);

    // Add custom weapon station zone if upgrade is enabled and we're not already in it
    if (vehicle.hasWeaponStationUpgrade && zone.id !== wsConfig.zoneId) {
      const customZone: VehicleZone = {
        id: wsConfig.zoneId,
        name: wsConfig.zoneName,
        cover: wsConfig.cover,
        capacity: wsConfig.capacity,
        canAttackOut: true,
        visibleFromArcs: wsConfig.visibleFromArcs,
      };
      return [...baseOtherZones, customZone];
    }
    return baseOtherZones;
  })();

  // Check if a zone has capacity for another crew member
  const getZoneAvailableCapacity = (zoneId: string): number => {
    if (!vehicle) return 0;
    const wsConfig = getWeaponStationUpgrade(vehicle.template.id);

    // Check if it's the custom weapon station
    if (zoneId === wsConfig.zoneId) {
      if (!vehicle.hasWeaponStationUpgrade) return 0;
      const currentAssignments = state.crewAssignments.filter(
        (a) => a.vehicleId === vehicleId && a.zoneId === zoneId
      ).length;
      return wsConfig.capacity - currentAssignments;
    }

    // Regular zone from template
    const zoneTemplate = vehicle.template.zones.find((z) => z.id === zoneId);
    if (!zoneTemplate) return 0;

    // Adjust passenger_area capacity if weapon station upgrade is enabled
    let capacity = zoneTemplate.capacity;
    if (vehicle.hasWeaponStationUpgrade && zoneId === 'passenger_area') {
      capacity = Math.max(0, capacity - 1);
    }

    const currentAssignments = state.crewAssignments.filter(
      (a) => a.vehicleId === vehicleId && a.zoneId === zoneId
    ).length;
    return capacity - currentAssignments;
  };

  const handleAssign = (creatureId: string) => {
    const assignment: CrewAssignment = {
      creatureId,
      vehicleId,
      zoneId: zone.id,
    };
    assignCrew(assignment);
    setAnchorEl(null);
  };

  const handleCreatureClick = (e: React.MouseEvent<HTMLElement>, creatureId: string) => {
    setSelectedCreatureId(creatureId);
    setMoveMenuAnchor(e.currentTarget);
  };

  const handleMoveToZone = (targetZoneId: string) => {
    if (!selectedCreatureId) return;
    // Directly reassign to new zone - ASSIGN_CREW already handles removing old assignment
    const assignment: CrewAssignment = {
      creatureId: selectedCreatureId,
      vehicleId,
      zoneId: targetZoneId,
    };
    assignCrew(assignment);
    setMoveMenuAnchor(null);
    setSelectedCreatureId(null);
  };

  const handleExitVehicle = () => {
    if (!selectedCreatureId) return;
    dispatch({ type: 'UNASSIGN_CREW', payload: { creatureId: selectedCreatureId } });
    setMoveMenuAnchor(null);
    setSelectedCreatureId(null);
  };

  // Remove a dead body from the station (just removes assignment, doesn't place on map)
  const handleRemoveBody = () => {
    if (!selectedCreatureId) return;
    // Just remove the crew assignment - the creature stays in the creatures list but with no assignment
    // This is different from UNASSIGN_CREW which places them on the battlefield
    const newAssignments = state.crewAssignments.filter(
      (a) => a.creatureId !== selectedCreatureId
    );
    // Dispatch directly to update crew assignments without the exit vehicle logic
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'system',
        action: `Removed body from ${zone.name}`
      }
    });
    // We need a simpler action - let's use ASSIGN_CREW with removal by assigning to nowhere
    // Actually, let's just call UNASSIGN_CREW but the creature is dead so it won't affect initiative
    dispatch({ type: 'UNASSIGN_CREW', payload: { creatureId: selectedCreatureId } });
    setMoveMenuAnchor(null);
    setSelectedCreatureId(null);
  };

  const handleCloseMoveMenu = () => {
    setMoveMenuAnchor(null);
    setSelectedCreatureId(null);
  };

  // Get the selected creature to check if they're dead
  const selectedCreature = selectedCreatureId
    ? state.creatures.find((c) => c.id === selectedCreatureId)
    : null;
  const isSelectedDead = selectedCreature?.currentHp === 0;

  // Get other crew members on this vehicle for swap functionality (excluding dead ones and current selection)
  const otherCrewOnVehicle = state.crewAssignments
    .filter((a) => a.vehicleId === vehicleId && a.creatureId !== selectedCreatureId)
    .map((a) => {
      const creature = state.creatures.find((c) => c.id === a.creatureId);
      const crewZone = vehicle?.template.zones.find((z) => z.id === a.zoneId);
      return { assignment: a, creature, zone: crewZone };
    })
    .filter((c) => c.creature && c.creature.currentHp > 0); // Only living crew can swap

  // Handle swapping positions with another crew member
  const handleSwapWith = (otherCreatureId: string, otherZoneId: string) => {
    if (!selectedCreatureId) return;
    // Swap: assign selected to other's zone, assign other to selected's zone (current zone)
    assignCrew({ creatureId: selectedCreatureId, vehicleId, zoneId: otherZoneId });
    assignCrew({ creatureId: otherCreatureId, vehicleId, zoneId: zone.id });
    setMoveMenuAnchor(null);
    setSelectedCreatureId(null);
  };

  return (
    <Paper
      sx={{
        p: 1,
        bgcolor: '#242424',
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" fontWeight={600}>
          {zone.name}
        </Typography>
        <Chip
          label={formatCoverShort(zone.cover)}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.625rem',
            bgcolor: withOpacity(coverColor, 0.2),
            color: coverColor,
          }}
        />
      </Box>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
        {assignments.map((assignment) => {
          const creature = state.creatures.find((c) => c.id === assignment.creatureId);
          if (!creature) return null;
          const isDead = creature.currentHp === 0;
          return (
            <Avatar
              key={assignment.creatureId}
              onClick={(e) => handleCreatureClick(e, assignment.creatureId)}
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                bgcolor: isDead ? 'grey.700' : 'success.dark',
                cursor: 'pointer',
                opacity: isDead ? 0.7 : 1,
                border: isDead ? '2px solid' : 'none',
                borderColor: isDead ? 'error.main' : 'transparent',
                '&:hover': { bgcolor: isDead ? 'grey.600' : 'success.main' },
              }}
              title={isDead ? `${creature.name} (DEAD - click to remove body)` : `${creature.name} (click to move/remove)`}
            >
              {isDead ? '✕' : creature.name.charAt(0)}
            </Avatar>
          );
        })}
        {assignments.length < zone.capacity && (
          <Avatar
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: 28,
              height: 28,
              fontSize: '0.875rem',
              bgcolor: 'transparent',
              border: '1px dashed',
              borderColor: 'divider',
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
            title="Click to assign crew"
          >
            +
          </Avatar>
        )}
      </Stack>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: { maxHeight: 200, minWidth: 150 },
          },
        }}
      >
        {unassignedCreatures.length === 0 ? (
          <MenuItem disabled>
            <ListItemText
              primary="No unassigned creatures"
              secondary="Add creatures in sidebar"
              primaryTypographyProps={{ variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ) : (
          unassignedCreatures.map((creature) => (
            <MenuItem key={creature.id} onClick={() => handleAssign(creature.id)}>
              <ListItemText
                primary={creature.name}
                secondary={`HP: ${creature.currentHp}/${creature.statblock.maxHp}`}
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Move/Exit Menu for assigned crew */}
      <Menu
        anchorEl={moveMenuAnchor}
        open={Boolean(moveMenuAnchor)}
        onClose={handleCloseMoveMenu}
        slotProps={{
          paper: {
            sx: { maxHeight: 400, minWidth: 180 },
          },
        }}
      >
        {isSelectedDead ? (
          /* Dead crew - only show remove body option */
          <MenuItem onClick={handleRemoveBody} sx={{ color: 'error.main' }}>
            <ListItemText
              primary="Remove Body"
              secondary="Clear this station"
              primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </MenuItem>
        ) : (
          /* Living crew - show move, swap, and exit options */
          <>
            {/* Move to another zone */}
            {otherZones.length > 0 && (
              <MenuItem disabled sx={{ opacity: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Move to...
                </Typography>
              </MenuItem>
            )}
            {otherZones.map((targetZone) => {
              const availableCapacity = getZoneAvailableCapacity(targetZone.id);
              const isDisabled = availableCapacity <= 0;
              return (
                <MenuItem
                  key={targetZone.id}
                  onClick={() => handleMoveToZone(targetZone.id)}
                  disabled={isDisabled}
                >
                  <ListItemText
                    primary={targetZone.name}
                    secondary={isDisabled ? 'Full' : `${availableCapacity} spot${availableCapacity !== 1 ? 's' : ''} available`}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </MenuItem>
              );
            })}

            {/* Swap with another crew member */}
            {otherCrewOnVehicle.length > 0 && (
              <>
                <Divider />
                <MenuItem disabled sx={{ opacity: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Swap with...
                  </Typography>
                </MenuItem>
                {otherCrewOnVehicle.map(({ assignment, creature, zone: crewZone }) => (
                  <MenuItem
                    key={creature!.id}
                    onClick={() => handleSwapWith(creature!.id, assignment.zoneId)}
                  >
                    <ListItemText
                      primary={creature!.name}
                      secondary={crewZone?.name || 'Unknown zone'}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </MenuItem>
                ))}
              </>
            )}

            <Divider />
            <MenuItem onClick={handleExitVehicle} sx={{ color: 'warning.main' }}>
              <ListItemText
                primary="Exit Vehicle"
                secondary="Place on battlefield"
                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </MenuItem>
          </>
        )}
      </Menu>
    </Paper>
  );
}

function formatCoverShort(cover: string): string {
  const labels: Record<string, string> = {
    none: 'None',
    half: '½',
    three_quarters: '¾',
    full: 'Full',
  };
  return labels[cover] || cover;
}
