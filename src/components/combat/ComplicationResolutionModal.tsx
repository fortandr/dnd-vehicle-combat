/**
 * Complication Resolution Modal
 *
 * Displays a complication and allows resolving saves for all affected vehicles.
 * Supports both in-app dice rolling and manual roll entry.
 */

import { useState } from 'react';
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
  IconButton,
  Divider,
  Tooltip,
  Paper,
} from '@mui/material';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import PersonIcon from '@mui/icons-material/Person';
import { useCombat } from '../../context/CombatContext';
import { ActiveBattlefieldComplication, Vehicle, ComplicationResolutionStatus } from '../../types';
import { withOpacity, factionColors } from '../../theme/customColors';

interface ComplicationResolutionModalProps {
  open: boolean;
  onClose: () => void;
  complication: ActiveBattlefieldComplication;
}

export function ComplicationResolutionModal({
  open,
  onClose,
  complication,
}: ComplicationResolutionModalProps) {
  const { state, resolveVehicleComplication, applyComplicationEffects, getDriverDexSave } = useCombat();
  const [manualRolls, setManualRolls] = useState<Record<string, string>>({});

  const dc = complication.complication.mechanicalEffect?.skillCheck?.dc || 10;
  const skillName = complication.complication.mechanicalEffect?.skillCheck?.skill || 'Dexterity Save';

  // Get vehicle info for each resolution
  const vehicleResolutions = complication.resolutions.map((res) => {
    const vehicle = state.vehicles.find((v) => v.id === res.vehicleId);
    const dexSaveInfo = vehicle ? getDriverDexSave(vehicle) : null;
    return {
      ...res,
      vehicle,
      dexSaveInfo,
    };
  });

  const allResolved = complication.resolutions.every((res) => res.status !== 'pending');
  const hasAnyFailed = complication.resolutions.some((res) => res.status === 'failed');

  const handleRollInApp = (vehicleId: string, modifier: number) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    const status: ComplicationResolutionStatus = total >= dc ? 'passed' : 'failed';
    resolveVehicleComplication(vehicleId, status, roll, modifier, total);
  };

  const handleManualRoll = (vehicleId: string, modifier: number) => {
    const rollStr = manualRolls[vehicleId];
    const roll = parseInt(rollStr, 10);
    if (isNaN(roll) || roll < 1 || roll > 20) {
      alert('Please enter a valid d20 roll (1-20)');
      return;
    }
    const total = roll + modifier;
    const status: ComplicationResolutionStatus = total >= dc ? 'passed' : 'failed';
    resolveVehicleComplication(vehicleId, status, roll, modifier, total);
  };

  const handleSkip = (vehicleId: string) => {
    resolveVehicleComplication(vehicleId, 'skipped');
  };

  const handleApplyEffects = () => {
    applyComplicationEffects();
    onClose();
  };

  const handleDismiss = () => {
    // Clear complication without applying effects
    applyComplicationEffects(); // This clears the active complication
    onClose();
  };

  return (
    <Dialog open={open} onClose={() => {}} maxWidth="md" fullWidth disableEscapeKeyDown>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="h6">
            Complication: {complication.complication.name}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          {/* Complication Details */}
          <Card variant="outlined" sx={{ bgcolor: withOpacity('#ff9800', 0.1), borderColor: 'warning.dark' }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                {complication.complication.description}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body1" fontWeight={500}>
                Effect: {complication.complication.effect}
              </Typography>
              {complication.complication.mechanicalEffect?.skillCheck && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                  <Typography variant="body2" fontWeight={600} color="warning.main">
                    Required Save: {skillName} DC {dc}
                  </Typography>
                  {complication.complication.mechanicalEffect.skillCheck.failureEffect && (
                    <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
                      On Failure: {complication.complication.mechanicalEffect.skillCheck.failureEffect}
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Resolutions */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Affected Vehicles ({vehicleResolutions.length})
            </Typography>
            <Stack spacing={2}>
              {vehicleResolutions.map(({ vehicleId, status, rollResult, modifier, total, vehicle, dexSaveInfo }) => (
                <Paper
                  key={vehicleId}
                  sx={{
                    p: 2,
                    bgcolor: status === 'passed'
                      ? withOpacity('#4caf50', 0.1)
                      : status === 'failed'
                      ? withOpacity('#f44336', 0.1)
                      : 'background.paper',
                    borderLeft: 3,
                    borderColor: vehicle?.type === 'party' ? factionColors.party : factionColors.enemy,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* Vehicle Info */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <DirectionsCarIcon fontSize="small" />
                        <Typography variant="subtitle2" fontWeight={600}>
                          {vehicle?.name || 'Unknown Vehicle'}
                        </Typography>
                        <Chip
                          label={vehicle?.type === 'party' ? 'Party' : 'Enemy'}
                          size="small"
                          sx={{
                            bgcolor: withOpacity(
                              vehicle?.type === 'party' ? factionColors.party : factionColors.enemy,
                              0.2
                            ),
                            color: vehicle?.type === 'party' ? factionColors.party : factionColors.enemy,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Driver: {dexSaveInfo?.driverName || 'No Driver'}
                        </Typography>
                        {dexSaveInfo && (
                          <Chip
                            label={`DEX Save: ${dexSaveInfo.modifier >= 0 ? '+' : ''}${dexSaveInfo.modifier}`}
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Resolution Status/Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {status === 'pending' && dexSaveInfo ? (
                        <>
                          {/* Manual Roll Input */}
                          <TextField
                            size="small"
                            label="d20"
                            type="number"
                            inputProps={{ min: 1, max: 20 }}
                            value={manualRolls[vehicleId] || ''}
                            onChange={(e) => setManualRolls({ ...manualRolls, [vehicleId]: e.target.value })}
                            sx={{ width: 70 }}
                          />
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleManualRoll(vehicleId, dexSaveInfo.modifier)}
                            disabled={!manualRolls[vehicleId]}
                          >
                            Apply
                          </Button>
                          <Divider orientation="vertical" flexItem />
                          <Tooltip title="Roll in app">
                            <IconButton
                              color="primary"
                              onClick={() => handleRollInApp(vehicleId, dexSaveInfo.modifier)}
                            >
                              <CasinoIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Skip (no driver)">
                            <IconButton
                              size="small"
                              onClick={() => handleSkip(vehicleId)}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : status === 'pending' && !dexSaveInfo ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            No driver - auto-fail
                          </Typography>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => resolveVehicleComplication(vehicleId, 'failed', 0, 0, 0)}
                          >
                            Auto-Fail
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleSkip(vehicleId)}
                          >
                            Skip
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {status === 'passed' ? (
                            <>
                              <CheckCircleIcon color="success" />
                              <Typography variant="body2" color="success.main" fontWeight={600}>
                                PASSED
                              </Typography>
                            </>
                          ) : status === 'failed' ? (
                            <>
                              <CancelIcon color="error" />
                              <Typography variant="body2" color="error.main" fontWeight={600}>
                                FAILED
                              </Typography>
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Skipped
                            </Typography>
                          )}
                          {rollResult !== undefined && (
                            <Chip
                              label={`${rollResult}${modifier !== undefined ? (modifier >= 0 ? '+' : '') + modifier : ''} = ${total}`}
                              size="small"
                              color={status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'default'}
                            />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Stack>
          </Box>

          {/* Summary */}
          {allResolved && (
            <Card variant="outlined" sx={{ bgcolor: 'background.default' }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Resolution Summary
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${complication.resolutions.filter((r) => r.status === 'passed').length} Passed`}
                    color="success"
                    variant="outlined"
                  />
                  <Chip
                    icon={<CancelIcon />}
                    label={`${complication.resolutions.filter((r) => r.status === 'failed').length} Failed`}
                    color="error"
                    variant="outlined"
                  />
                  {complication.resolutions.some((r) => r.status === 'skipped') && (
                    <Chip
                      label={`${complication.resolutions.filter((r) => r.status === 'skipped').length} Skipped`}
                      variant="outlined"
                    />
                  )}
                </Box>
                {hasAnyFailed && complication.complication.mechanicalEffect?.skillCheck?.failureEffect && (
                  <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
                    Failed vehicles will have: {complication.complication.mechanicalEffect.skillCheck.failureEffect}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} color="inherit">
          Dismiss Without Effects
        </Button>
        <Button
          variant="contained"
          onClick={handleApplyEffects}
          disabled={!allResolved}
          color={hasAnyFailed ? 'warning' : 'success'}
        >
          {allResolved ? 'Apply Effects & Close' : `Resolve All Vehicles (${complication.resolutions.filter((r) => r.status === 'pending').length} remaining)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
