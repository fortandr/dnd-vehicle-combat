/**
 * Target Status Panel
 * Shows cover, range, and elevation status for all potential targets
 */

import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { useSettings } from '../../context/SettingsContext';
import { Vehicle, Creature, VehicleZone, Position, VehicleWeapon } from '../../types';
import { resolveZone } from '../../data/vehicleTemplates';
import {
  calculateCoverWithElevation,
  calculateCoverFromPositionWithElevation,
  getArcDisplayName,
  ElevationCoverResult,
} from '../../utils/coverCalculator';
import {
  parseWeaponRange,
  getModifiedWeaponRange,
} from '../../utils/elevationCalculator';
import { formatDistanceWithUnit } from '../../data/scaleConfig';
import { factionColors, coverColors, withOpacity } from '../../theme/customColors';

// Calculate distance between two positions
function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Get max weapon range for attacker (considering manned weapons only)
function getMaxWeaponRange(
  attackerVehicle: Vehicle | undefined,
  crewAssignments: Array<{ vehicleId: string; zoneId: string; creatureId: string }>,
  creatures: Creature[]
): { maxRange: number; weapons: VehicleWeapon[] } {
  if (!attackerVehicle?.weapons) return { maxRange: 0, weapons: [] };

  const vehicleCrew = crewAssignments.filter(a => a.vehicleId === attackerVehicle.id);
  const mannedWeapons: VehicleWeapon[] = [];
  let maxRange = 0;

  for (const weapon of attackerVehicle.weapons) {
    const crewAtStation = vehicleCrew.find(a => a.zoneId === weapon.zoneId);
    if (!crewAtStation) continue;

    const crewMember = creatures.find(c => c.id === crewAtStation.creatureId);
    if (!crewMember || crewMember.currentHp === 0) continue;

    mannedWeapons.push(weapon);
    const range = parseWeaponRange(weapon.range);
    if (range > maxRange) maxRange = range;
  }

  return { maxRange, weapons: mannedWeapons };
}

interface TargetCoverPanelProps {
  attackerVehicle?: Vehicle;
  attackerCreature?: Creature;
  attackerFaction?: 'party' | 'enemy';
}

export function TargetCoverPanel({ attackerVehicle, attackerCreature, attackerFaction }: TargetCoverPanelProps) {
  const { state } = useCombat();
  const { unitSystem } = useSettings();

  // Determine which faction we're attacking (opposite of attacker)
  const targetFaction = attackerVehicle
    ? (attackerVehicle.type === 'party' ? 'enemy' : 'party')
    : (attackerFaction === 'party' ? 'enemy' : 'party');

  const opposingVehicles = state.vehicles.filter(
    (v) => v.type === targetFaction
  );

  // Get attacker's position and weapon info
  const attackerPosition = attackerVehicle?.position || attackerCreature?.position;
  const { maxRange: baseMaxRange, weapons: mannedWeapons } = getMaxWeaponRange(
    attackerVehicle,
    state.crewAssignments,
    state.creatures
  );

  const targetsByVehicle = opposingVehicles.map((targetVehicle) => {
    // Calculate distance to target vehicle
    const distance = attackerPosition
      ? Math.round(calculateDistance(attackerPosition, targetVehicle.position))
      : 0;

    const vehicleCreatures = state.crewAssignments
      .filter((a) => a.vehicleId === targetVehicle.id)
      .map((a) => {
        const creature = state.creatures.find((c) => c.id === a.creatureId);
        const zone = resolveZone(targetVehicle, a.zoneId);
        if (!creature || !zone) return null;

        // Calculate cover from vehicle or from creature position (with elevation)
        const cover = attackerVehicle
          ? calculateCoverWithElevation(attackerVehicle, targetVehicle, zone, state.elevationZones)
          : attackerCreature?.position
            ? calculateCoverFromPositionWithElevation(attackerCreature.position, targetVehicle, zone, state.elevationZones)
            : null;

        if (!cover) return null;

        // Calculate range with elevation extension for this specific target
        const elevationDiff = cover.elevationDiff;
        const extendedMaxRange = elevationDiff > 0
          ? getModifiedWeaponRange(baseMaxRange, elevationDiff)
          : baseMaxRange;

        return {
          creature,
          zone,
          cover,
          distance,
          baseRange: baseMaxRange,
          extendedRange: extendedMaxRange,
          inRange: distance <= extendedMaxRange,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return { vehicle: targetVehicle, targets: vehicleCreatures, distance };
  });

  if (opposingVehicles.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No opposing vehicles on the battlefield.
      </Typography>
    );
  }

  const attackerName = attackerVehicle?.name || attackerCreature?.name || 'Unknown';

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Attacking from: <Box component="span" fontWeight={600}>{attackerName}</Box>
        {attackerCreature && !attackerVehicle && (
          <Box component="span" color="text.disabled"> (on foot)</Box>
        )}
      </Typography>

      <Stack spacing={2}>
        {targetsByVehicle.map(({ vehicle, targets, distance }) => (
          <Box key={vehicle.id}>
            {/* Target Vehicle Header */}
            <Paper
              sx={{
                p: 1,
                mb: 1,
                bgcolor: withOpacity(factionColors.enemy, 0.1),
                borderLeft: 3,
                borderColor: factionColors.enemy,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    HP: {vehicle.currentHp}/{vehicle.template.maxHp}
                  </Typography>
                </Box>
                {distance > 0 && (
                  <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                    {formatDistanceWithUnit(distance, unitSystem)}
                  </Typography>
                )}
              </Box>
            </Paper>

            {/* Targets on this vehicle */}
            {targets.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                No crew on this vehicle
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {targets.map((target) => (
                  <TargetStatusCard
                    key={target.creature.id}
                    creature={target.creature}
                    zone={target.zone}
                    cover={target.cover}
                    distance={target.distance}
                    baseRange={target.baseRange}
                    extendedRange={target.extendedRange}
                    inRange={target.inRange}
                    unitSystem={unitSystem}
                  />
                ))}
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

interface TargetStatusCardProps {
  creature: Creature;
  zone: VehicleZone;
  cover: ElevationCoverResult;
  distance: number;
  baseRange: number;
  extendedRange: number;
  inRange: boolean;
  unitSystem: 'imperial' | 'metric';
}

function TargetStatusCard({ creature, zone, cover, distance, baseRange, extendedRange, inRange, unitSystem }: TargetStatusCardProps) {
  const getCoverChipColor = (coverType: string): 'error' | 'warning' | 'success' | 'default' => {
    switch (coverType) {
      case 'none': return 'error';
      case 'half': return 'warning';
      case 'three_quarters': return 'success';
      case 'full': return 'default';
      default: return 'default';
    }
  };

  const getCoverLabel = (coverType: string): string => {
    switch (coverType) {
      case 'none': return 'No Cover';
      case 'half': return 'Half (+2)';
      case 'three_quarters': return '3/4 (+5)';
      case 'full': return 'Full Cover';
      default: return coverType;
    }
  };

  const effectiveAC = creature.statblock.ac + (cover.acBonus === Infinity ? 0 : cover.acBonus);
  const coverColor = coverColors[cover.effectiveCover as keyof typeof coverColors];

  return (
    <Paper
      sx={{
        p: 1,
        bgcolor: '#242424',
        border: 1,
        borderColor: 'divider',
      }}
    >
      {/* Target Name & Stats */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>{creature.name}</Typography>
          <Typography variant="caption" color="text.secondary">{zone.name}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">HP</Typography>
          <Typography variant="body2" fontFamily="monospace">
            {creature.currentHp}/{creature.statblock.maxHp}
          </Typography>
        </Box>
      </Box>

      {/* Cover Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={getCoverLabel(cover.effectiveCover)}
          size="small"
          sx={{
            bgcolor: withOpacity(coverColor, 0.2),
            color: coverColor,
            fontWeight: 500,
          }}
        />

        <Typography variant="caption" color="text.secondary">
          from {getArcDisplayName(cover.attackArc)}
        </Typography>

        {cover.effectiveCover !== 'full' && (
          <Typography variant="caption" fontFamily="monospace" sx={{ ml: 'auto' }}>
            AC {effectiveAC}
            {cover.acBonus > 0 && (
              <Box component="span" color="text.secondary"> ({creature.statblock.ac}+{cover.acBonus})</Box>
            )}
          </Typography>
        )}
      </Box>

      {/* Range Status */}
      {baseRange > 0 && (
        <Box
          sx={{
            mt: 0.5,
            p: 0.5,
            bgcolor: inRange ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: 1,
            border: 1,
            borderColor: inRange ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {inRange ? '🎯' : '📏'} {formatDistanceWithUnit(distance, unitSystem)} away
            </Typography>
            <Chip
              label={inRange ? 'In Range' : 'Out of Range'}
              size="small"
              sx={{
                bgcolor: inRange ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: inRange ? '#22c55e' : '#ef4444',
                fontWeight: 500,
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          </Box>
          {extendedRange > baseRange && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Range: {formatDistanceWithUnit(baseRange, unitSystem)} → {formatDistanceWithUnit(extendedRange, unitSystem)} (elevation bonus)
            </Typography>
          )}
          {extendedRange === baseRange && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Max range: {formatDistanceWithUnit(baseRange, unitSystem)}
            </Typography>
          )}
        </Box>
      )}

      {/* Elevation Info */}
      {cover.elevationDiff !== 0 && (
        <Box
          sx={{
            mt: 0.5,
            p: 0.5,
            bgcolor: cover.elevationDiff > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderRadius: 1,
            border: 1,
            borderColor: cover.elevationDiff > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {cover.elevationDiff > 0 ? '⬇️' : '⬆️'} {cover.elevationDisplayText}
            </Typography>
            {cover.elevationAttackModifier !== 0 && (
              <Chip
                label={`${cover.elevationAttackModifier > 0 ? '+' : ''}${cover.elevationAttackModifier} to hit`}
                size="small"
                sx={{
                  bgcolor: cover.elevationAttackModifier > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: cover.elevationAttackModifier > 0 ? '#3b82f6' : '#ef4444',
                  fontWeight: 500,
                  fontSize: '0.65rem',
                  height: 20,
                }}
              />
            )}
          </Box>
          {cover.coverUpgradedByElevation && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Cover upgraded due to defender's high ground
            </Typography>
          )}
        </Box>
      )}

      {/* Visibility Warning */}
      {!cover.isVisible && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
          Not visible from this angle - cannot be targeted
        </Typography>
      )}
    </Paper>
  );
}
