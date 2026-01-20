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
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BuildIcon from '@mui/icons-material/Build';
import { Vehicle, VehicleZone, CrewAssignment, Mishap, VehicleWeapon } from '../../types';
import { useCombat } from '../../context/CombatContext';
import { getMishapResult, canRepairMishap, getRepairDescription } from '../../data/mishapTable';
import { SWAPPABLE_WEAPONS, ARMOR_UPGRADES, MAGICAL_GADGETS } from '../../data/vehicleTemplates';
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

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const { state, dealDamage, applyMishap, dispatch, removeVehicle, swapVehicleWeapon, setVehicleArmor, toggleVehicleGadget } = useCombat();

  const hpPercent = (vehicle.currentHp / vehicle.template.maxHp) * 100;
  const hpColor = hpPercent > 50 ? 'success' : hpPercent > 25 ? 'warning' : 'error';

  // Calculate effective AC and defenses based on armor
  const effectiveAC = getEffectiveAC(vehicle);
  const defenses = getArmorDefenses(vehicle);

  const crewAssignments = state.crewAssignments.filter(
    (a) => a.vehicleId === vehicle.id
  );

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

  const handleRollMishap = () => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const mishapData = getMishapResult(roll);

    const mishap: Mishap = {
      ...mishapData,
      id: `mishap-${Date.now()}`,
      roundsRemaining: mishapData.duration === 'rounds' ? 1 : undefined,
    };

    if (mishapData.duration !== 'instant') {
      applyMishap(vehicle.id, mishap);
    }

    const repairInfo = canRepairMishap(mishapData)
      ? `\n\nRepair: ${getRepairDescription(mishapData)}`
      : mishapData.name === 'Flip' ? '\n\nCannot be repaired - must right the vehicle manually' : '';

    alert(`Rolled ${roll}: ${mishapData.name}\n\n${mishapData.effect}${repairInfo}`);
  };

  const handleClearMishap = (mishapId: string) => {
    dispatch({
      type: 'REPAIR_MISHAP',
      payload: { vehicleId: vehicle.id, mishapId },
    });
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

        {/* HP Bar */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Hit Points
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              {vehicle.currentHp} / {vehicle.template.maxHp}
            </Typography>
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
          <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#242424' }}>
            <Typography variant="h6" fontWeight={700}>{vehicle.currentSpeed}</Typography>
            <Typography variant="caption" color="text.secondary">Speed</Typography>
          </Paper>
          <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#242424' }}>
            <Typography variant="h6" fontWeight={700}>{vehicle.template.mishapThreshold}</Typography>
            <Typography variant="caption" color="text.secondary">Mishap</Typography>
          </Paper>
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
            {vehicle.template.zones.map((zone) => (
              <CrewZone
                key={zone.id}
                zone={zone}
                vehicleId={vehicle.id}
                assignments={crewAssignments.filter((a) => a.zoneId === zone.id)}
              />
            ))}
          </Stack>
        </Box>

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
              Active Mishaps {canRepairMishap(vehicle.activeMishaps[0]) ? '(click to clear)' : ''}
            </Typography>
            <Stack spacing={0.5}>
              {vehicle.activeMishaps.map((mishap) => {
                const repairable = canRepairMishap(mishap);
                return (
                  <Paper
                    key={mishap.id}
                    onClick={() => {
                      if (repairable && confirm(`Clear mishap "${mishap.name}"?`)) {
                        handleClearMishap(mishap.id);
                      }
                    }}
                    sx={{
                      p: 1,
                      bgcolor: withOpacity('#f59e0b', 0.1),
                      border: 1,
                      borderColor: repairable ? 'warning.main' : 'primary.main',
                      cursor: repairable ? 'pointer' : 'default',
                      '&:hover': repairable ? { bgcolor: withOpacity('#f59e0b', 0.2) } : {},
                    }}
                    title={repairable ? 'Click to clear this mishap' : 'Cannot be repaired'}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ color: repairable ? 'warning.main' : 'primary.main' }}
                      >
                        {mishap.name}
                      </Typography>
                      <Chip label={mishap.duration} size="small" color="warning" sx={{ height: 20 }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {mishap.effect}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', mt: 0.5, color: repairable ? 'primary.main' : 'error.main' }}
                    >
                      {repairable ? getRepairDescription(mishap) : 'Cannot be repaired'}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Quick Actions */}
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            onClick={() => {
              const damage = prompt('Damage amount:');
              if (damage) {
                const dmg = parseInt(damage, 10);
                if (dmg > 0) {
                  dealDamage('vehicle', vehicle.id, dmg);
                  if (dmg >= vehicle.template.mishapThreshold) {
                    if (confirm(`Damage (${dmg}) meets mishap threshold (${vehicle.template.mishapThreshold})!\n\nRoll for mishap?`)) {
                      handleRollMishap();
                    }
                  }
                }
              }
            }}
          >
            Damage
          </Button>
          <Button variant="outlined" size="small" fullWidth onClick={handleRepair}>
            Repair
          </Button>
          <Button variant="outlined" size="small" fullWidth onClick={handleRollMishap}>
            Mishap
          </Button>
        </Stack>
      </CardContent>
    </Card>
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

  const coverColor = coverColors[zone.cover as keyof typeof coverColors];

  const assignedCreatureIds = state.crewAssignments.map((a) => a.creatureId);
  const unassignedCreatures = state.creatures.filter(
    (c) => !assignedCreatureIds.includes(c.id)
  );

  const handleAssign = (creatureId: string) => {
    const assignment: CrewAssignment = {
      creatureId,
      vehicleId,
      zoneId: zone.id,
    };
    assignCrew(assignment);
    setAnchorEl(null);
  };

  const handleUnassign = (creatureId: string) => {
    dispatch({ type: 'UNASSIGN_CREW', payload: { creatureId } });
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
          return (
            <Avatar
              key={assignment.creatureId}
              onClick={() => handleUnassign(assignment.creatureId)}
              sx={{
                width: 28,
                height: 28,
                fontSize: '0.75rem',
                bgcolor: 'success.dark',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'success.main' },
              }}
              title={`${creature.name} (click to remove)`}
            >
              {creature.name.charAt(0)}
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
