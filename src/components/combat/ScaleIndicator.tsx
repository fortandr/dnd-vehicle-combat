/**
 * Scale Indicator Component
 * Shows current combat scale and distance from current turn vehicle to nearest opponent
 */

import { useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  ButtonGroup,
  Stack,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import {
  SCALES,
  formatDistance,
  getScaleThresholds,
  getScalesInOrder,
  getScaleForDistance,
} from '../../data/scaleConfig';
import { Vehicle } from '../../types';
import { scaleColors, factionColors, withOpacity } from '../../theme/customColors';

export function ScaleIndicator() {
  const { state, setScale, currentTurnVehicle } = useCombat();

  const currentScale = SCALES[state.scale];
  const thresholds = getScaleThresholds();
  const scales = getScalesInOrder();

  const activeVehicle = currentTurnVehicle || state.vehicles.find((v) => v.type === 'party');

  const opposingVehicles = activeVehicle
    ? state.vehicles.filter((v) => v.type !== activeVehicle.type)
    : [];

  let distance = 500;
  let nearestOpponent: Vehicle | null = null;

  if (activeVehicle && opposingVehicles.length > 0) {
    let minDistance = Infinity;

    for (const opponent of opposingVehicles) {
      const d = Math.sqrt(
        Math.pow(opponent.position.x - activeVehicle.position.x, 2) +
        Math.pow(opponent.position.y - activeVehicle.position.y, 2)
      );
      if (d < minDistance) {
        minDistance = d;
        nearestOpponent = opponent;
      }
    }

    distance = minDistance;
  }

  useEffect(() => {
    if (currentTurnVehicle && distance !== Infinity) {
      const suggestedScale = getScaleForDistance(distance);
      if (suggestedScale !== state.scale) {
        setScale(suggestedScale);
      }
    }
  }, [currentTurnVehicle?.id, distance]);

  const getScalePosition = (dist: number): number => {
    const maxDist = 10560;
    const logDist = Math.log10(Math.max(1, dist));
    const logMin = Math.log10(1);
    const logMax = Math.log10(maxDist);
    return ((logDist - logMin) / (logMax - logMin)) * 100;
  };

  const markerPosition = getScalePosition(distance);
  const scaleColor = scaleColors[state.scale as keyof typeof scaleColors];

  return (
    <Paper sx={{ p: 2, bgcolor: '#1e1e1e' }}>
      {/* Active Vehicle Info */}
      {activeVehicle && (
        <Paper
          sx={{
            p: 1,
            mb: 2,
            bgcolor: withOpacity(activeVehicle.type === 'party' ? factionColors.party : factionColors.enemy, 0.1),
            borderLeft: 3,
            borderColor: activeVehicle.type === 'party' ? factionColors.party : factionColors.enemy,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {currentTurnVehicle ? 'Current Turn:' : 'Measuring from:'}
          </Typography>
          <Typography variant="body2" fontWeight={600}>{activeVehicle.name}</Typography>
          {nearestOpponent && (
            <Typography variant="caption" color="text.secondary">
              to nearest opponent: <Box component="span" fontWeight={600}>{nearestOpponent.name}</Box>
            </Typography>
          )}
        </Paper>
      )}

      {/* Scale Badge and Distance */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={currentScale.displayName}
            size="small"
            sx={{ bgcolor: withOpacity(scaleColor, 0.2), color: scaleColor, fontWeight: 600 }}
          />
          <Typography variant="body2" color="text.secondary">
            {currentScale.roundDurationDisplay} per round
          </Typography>
        </Box>
        <Typography variant="body2">
          Distance: <Box component="span" fontFamily="monospace" fontWeight={600}>{formatDistance(distance)}</Box>
        </Typography>
      </Box>

      {/* Scale Bar */}
      <Box
        sx={{
          position: 'relative',
          height: 8,
          bgcolor: '#242424',
          borderRadius: 1,
          mb: 1,
          overflow: 'visible',
        }}
      >
        {/* Threshold markers */}
        {thresholds.map(({ scale, threshold }) => (
          <Box
            key={scale}
            sx={{
              position: 'absolute',
              left: `${getScalePosition(threshold)}%`,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: 'divider',
            }}
          />
        ))}
        {/* Current position marker */}
        <Box
          sx={{
            position: 'absolute',
            left: `${markerPosition}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: scaleColor,
            boxShadow: `0 0 8px ${scaleColor}`,
          }}
        />
      </Box>

      {/* Scale Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="caption" sx={{ color: scaleColors.point_blank, textAlign: 'center' }}>
          Point-Blank<br />&lt;100ft
        </Typography>
        <Typography variant="caption" sx={{ color: scaleColors.tactical, textAlign: 'center' }}>
          Tactical<br />100-1000ft
        </Typography>
        <Typography variant="caption" sx={{ color: scaleColors.approach, textAlign: 'center' }}>
          Approach<br />1000ft-1mi
        </Typography>
        <Typography variant="caption" sx={{ color: scaleColors.strategic, textAlign: 'center' }}>
          Strategic<br />1mi+
        </Typography>
      </Box>

      {/* Scale Selector */}
      <ButtonGroup fullWidth size="small" sx={{ mb: 2 }}>
        {scales.map((scaleName) => (
          <Button
            key={scaleName}
            variant={state.scale === scaleName ? 'contained' : 'outlined'}
            onClick={() => setScale(scaleName)}
            sx={{
              fontSize: '0.75rem',
              ...(state.scale === scaleName && {
                bgcolor: scaleColors[scaleName as keyof typeof scaleColors],
                '&:hover': { bgcolor: scaleColors[scaleName as keyof typeof scaleColors] },
              }),
            }}
          >
            {SCALES[scaleName].displayName}
          </Button>
        ))}
      </ButtonGroup>

      {/* Info Box */}
      <Paper sx={{ p: 1.5, bgcolor: '#242424' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Movement per round:</Typography>
          <Typography variant="caption" fontFamily="monospace">
            Speed x {currentScale.speedMultiplier}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">Available actions:</Typography>
          <Typography variant="caption">
            {currentScale.availableActions.includes('all')
              ? 'All actions'
              : currentScale.availableActions.length + ' action types'}
          </Typography>
        </Box>
      </Paper>
    </Paper>
  );
}
