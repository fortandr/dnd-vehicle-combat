/**
 * Target Cover Panel
 * Shows cover status of all potential targets based on vehicle positions and facing
 */

import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { Vehicle, Creature, VehicleZone } from '../../types';
import {
  calculateCover,
  getArcDisplayName,
  CoverResult,
} from '../../utils/coverCalculator';
import { factionColors, coverColors, withOpacity } from '../../theme/customColors';

interface TargetCoverPanelProps {
  attackerVehicle: Vehicle;
}

export function TargetCoverPanel({ attackerVehicle }: TargetCoverPanelProps) {
  const { state } = useCombat();

  const opposingVehicles = state.vehicles.filter(
    (v) => v.type !== attackerVehicle.type
  );

  const targetsByVehicle = opposingVehicles.map((targetVehicle) => {
    const vehicleCreatures = state.crewAssignments
      .filter((a) => a.vehicleId === targetVehicle.id)
      .map((a) => {
        const creature = state.creatures.find((c) => c.id === a.creatureId);
        const zone = targetVehicle.template.zones.find((z) => z.id === a.zoneId);
        if (!creature || !zone) return null;

        const cover = calculateCover(attackerVehicle, targetVehicle, zone);

        return { creature, zone, cover };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);

    return { vehicle: targetVehicle, targets: vehicleCreatures };
  });

  if (opposingVehicles.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No opposing vehicles on the battlefield.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Attacking from: <Box component="span" fontWeight={600}>{attackerVehicle.name}</Box>
      </Typography>

      <Stack spacing={2}>
        {targetsByVehicle.map(({ vehicle, targets }) => (
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  HP: {vehicle.currentHp}/{vehicle.template.maxHp}
                </Typography>
              </Box>
            </Paper>

            {/* Targets on this vehicle */}
            {targets.length === 0 ? (
              <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                No crew on this vehicle
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {targets.map(({ creature, zone, cover }) => (
                  <TargetCoverCard
                    key={creature.id}
                    creature={creature}
                    zone={zone}
                    cover={cover}
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

interface TargetCoverCardProps {
  creature: Creature;
  zone: VehicleZone;
  cover: CoverResult;
}

function TargetCoverCard({ creature, zone, cover }: TargetCoverCardProps) {
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

      {/* Visibility Warning */}
      {!cover.isVisible && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'warning.main' }}>
          Not visible from this angle - cannot be targeted
        </Typography>
      )}
    </Paper>
  );
}
