/**
 * Vehicle Stats Panel
 * Editable stats for vehicles and crew with automatic mishap triggering
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Chip,
  Alert,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { Vehicle, Mishap, Creature, VehicleZone } from '../../types';
import { getMishapResult, getMishapSeverity, checkMishapFromDamage, canRepairMishap, getRepairDescription, rollMishapForVehicle } from '../../data/mishapTable';
import { v4 as uuid } from 'uuid';
import { factionColors, withOpacity } from '../../theme/customColors';
import IconButton from '@mui/material/IconButton';
import RemoveIcon from '@mui/icons-material/Remove';
import AddIcon from '@mui/icons-material/Add';

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

// Crew member row with damage controls
interface CrewMemberRowProps {
  creature: Creature;
  zone: VehicleZone | undefined;
  onHpChange: (newHp: number) => void;
}

function CrewMemberRow({ creature, zone, onHpChange }: CrewMemberRowProps) {
  const [damageInput, setDamageInput] = useState('');
  const isPC = creature.statblock.type === 'pc';
  const isDead = !isPC && creature.currentHp === 0;
  const isInDeathSaves = isPC && creature.currentHp === 0;

  const handleDealDamage = () => {
    const damage = parseInt(damageInput, 10);
    if (isNaN(damage) || damage <= 0) return;
    onHpChange(Math.max(0, creature.currentHp - damage));
    setDamageInput('');
  };

  const handleHeal = () => {
    const heal = parseInt(damageInput, 10);
    if (isNaN(heal) || heal <= 0) return;
    onHpChange(Math.min(creature.statblock.maxHp, creature.currentHp + heal));
    setDamageInput('');
  };

  return (
    <Paper
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
            {isDead && <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'error.main' }}>(Dead)</Typography>}
            {isInDeathSaves && <Typography component="span" variant="caption" sx={{ ml: 0.5, color: 'error.main' }}>(Death Saves)</Typography>}
          </Typography>
          <Typography variant="caption" color="text.secondary">{zone?.name} • AC {creature.statblock.ac}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TextField
            type="number"
            size="small"
            value={creature.currentHp}
            onChange={(e) => onHpChange(parseInt(e.target.value, 10) || 0)}
            sx={{ width: 52 }}
            inputProps={{ min: 0, max: creature.statblock.maxHp, style: { textAlign: 'center', padding: '4px' } }}
          />
          <Typography variant="caption" color="text.secondary">/ {creature.statblock.maxHp}</Typography>
        </Box>
      </Box>
      {/* Damage/Heal controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TextField
          type="number"
          size="small"
          value={damageInput}
          onChange={(e) => setDamageInput(e.target.value)}
          placeholder="±HP"
          sx={{ width: 60 }}
          inputProps={{ min: 1, style: { textAlign: 'center', padding: '4px', fontSize: '0.75rem' } }}
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
          sx={{ p: 0.5 }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton
          size="small"
          color="success"
          onClick={handleHeal}
          disabled={!damageInput || parseInt(damageInput, 10) <= 0}
          title="Heal"
          sx={{ p: 0.5 }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Paper>
  );
}

interface VehicleStatsPanelProps {
  vehicle: Vehicle;
}

export function VehicleStatsPanel({ vehicle }: VehicleStatsPanelProps) {
  const { state, dispatch, applyMishap } = useCombat();
  const [damageAmount, setDamageAmount] = useState('');
  const [lastMishapResult, setLastMishapResult] = useState<{ roll: number; mishap: Mishap } | null>(null);
  const [showMishapResult, setShowMishapResult] = useState(false);
  const [damageError, setDamageError] = useState<string | null>(null);

  const vehicleCrew = state.crewAssignments
    .filter((a) => a.vehicleId === vehicle.id)
    .map((a) => {
      const creature = state.creatures.find((c) => c.id === a.creatureId);
      const zone = vehicle.template.zones.find((z) => z.id === a.zoneId);
      return { creature, zone, assignment: a };
    })
    .filter((c) => c.creature);

  // Find the driver (helm zone) and get their DEX save
  const driver = vehicleCrew.find((c) => c.assignment.zoneId === 'helm')?.creature;
  const driverDexSave = driver
    ? driver.statblock.savingThrows?.dex ?? (driver.statblock.abilities?.dex !== undefined
        ? Math.floor((driver.statblock.abilities.dex - 10) / 2)
        : null)
    : null;

  const handleVehicleHpChange = (newHp: number) => {
    const clampedHp = Math.max(0, Math.min(vehicle.template.maxHp, newHp));
    dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { currentHp: clampedHp } } });
  };

  const handleVehicleSpeedChange = (newSpeed: number) => {
    dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { currentSpeed: Math.max(0, newSpeed) } } });
  };

  const handleCreatureHpChange = (creatureId: string, newHp: number, maxHp: number) => {
    dispatch({ type: 'UPDATE_CREATURE', payload: { id: creatureId, updates: { currentHp: Math.max(0, Math.min(maxHp, newHp)) } } });
  };

  const handleDealDamage = () => {
    const damage = parseInt(damageAmount, 10);
    if (isNaN(damage) || damage <= 0) return;

    const effectiveThreshold = getEffectiveDamageThreshold(vehicle);
    if (damage < effectiveThreshold) {
      setDamageError(`Damage (${damage}) is below the damage threshold (${effectiveThreshold}). No damage dealt.`);
      dispatch({ type: 'LOG_ACTION', payload: { type: 'system', action: `${vehicle.name} ignores ${damage} damage`, details: `Below damage threshold of ${effectiveThreshold}` } });
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
        // All mishaps are already active or maxed out - no new mishap can occur
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
    // Roll for mishap, rerolling if the result is already active or would have no effect
    const vehicleMishapState = {
      currentSpeed: vehicle.currentSpeed,
      damageThreshold: vehicle.template.damageThreshold,
      weaponCount: vehicle.weapons.length,
      activeMishaps: vehicle.activeMishaps,
    };
    const mishapRoll = rollMishapForVehicle(vehicleMishapState);

    if (mishapRoll === null) {
      // All mishaps are already active or maxed out - no new mishap can occur
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

  const severityColors: Record<string, string> = {
    minor: '#22c55e',
    moderate: '#eab308',
    severe: '#ff4500',
    catastrophic: '#dc2626',
  };

  const borderColor = vehicle.type === 'party' ? factionColors.party : factionColors.enemy;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Vehicle Header */}
      <Paper sx={{ p: 1, mb: 2, bgcolor: withOpacity(borderColor, 0.1), borderLeft: 3, borderColor }}>
        <Typography fontWeight={600}>{vehicle.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          Damage Threshold: {getEffectiveDamageThreshold(vehicle) < vehicle.template.damageThreshold ? (
            <span style={{ color: '#f59e0b' }}>
              <s>{vehicle.template.damageThreshold}</s> {getEffectiveDamageThreshold(vehicle)}
            </span>
          ) : (
            vehicle.template.damageThreshold
          )} | Mishap Threshold: {vehicle.template.mishapThreshold}
        </Typography>
      </Paper>

      {/* Vehicle Stats */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2">HP:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              type="number"
              size="small"
              value={vehicle.currentHp}
              onChange={(e) => handleVehicleHpChange(parseInt(e.target.value, 10) || 0)}
              sx={{ width: 72 }}
              inputProps={{ min: 0, max: vehicle.template.maxHp, style: { textAlign: 'center' } }}
            />
            <Typography variant="body2" color="text.secondary">/ {vehicle.template.maxHp}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Speed:</Typography>
            {getEffectiveSpeed(vehicle) < vehicle.currentSpeed && (
              <Typography
                variant="caption"
                sx={{
                  color: 'warning.main',
                  fontWeight: 600,
                  bgcolor: withOpacity('#f59e0b', 0.2),
                  px: 0.5,
                  borderRadius: 0.5,
                }}
              >
                {getEffectiveSpeed(vehicle)} ft effective
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TextField
              type="number"
              size="small"
              value={vehicle.currentSpeed}
              onChange={(e) => handleVehicleSpeedChange(parseInt(e.target.value, 10) || 0)}
              sx={{
                width: 72,
                '& input': {
                  textDecoration: getEffectiveSpeed(vehicle) < vehicle.currentSpeed ? 'line-through' : 'none',
                  color: getEffectiveSpeed(vehicle) < vehicle.currentSpeed ? 'text.disabled' : 'inherit',
                },
              }}
              inputProps={{ min: 0, step: 10, style: { textAlign: 'center' } }}
            />
            <Typography variant="body2" color="text.secondary">ft</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">AC:</Typography>
          <Typography variant="body2" fontFamily="monospace">{vehicle.template.ac}</Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">DEX Save:</Typography>
          {driverDexSave !== null ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body2" fontFamily="monospace">
                {driverDexSave >= 0 ? '+' : ''}{driverDexSave}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                ({driver?.name})
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="warning.main" fontStyle="italic">
              No driver
            </Typography>
          )}
        </Box>
      </Stack>

      {/* Deal Damage Section */}
      <Paper sx={{ p: 1.5, bgcolor: '#242424', mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Deal Damage (ignores &lt;{getEffectiveDamageThreshold(vehicle)}, mishap at {vehicle.template.mishapThreshold}+)
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
          <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
            <Typography variant="caption">{damageError}</Typography>
          </Alert>
        )}
        <Button variant="outlined" size="small" onClick={handleManualMishapRoll} fullWidth>
          Roll Mishap (d20)
        </Button>
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

      {/* Active Mishaps */}
      {vehicle.activeMishaps.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Active Mishaps ({vehicle.activeMishaps.length}):
          </Typography>
          <Stack spacing={0.5}>
            {vehicle.activeMishaps.map((mishap) => (
              <Paper
                key={mishap.id}
                sx={{
                  p: 1,
                  bgcolor: withOpacity('#f59e0b', 0.1),
                  borderLeft: 2,
                  borderColor: canRepairMishap(mishap) ? 'warning.main' : 'primary.main',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" fontWeight={600}>{mishap.name}</Typography>
                  {canRepairMishap(mishap) && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => dispatch({ type: 'REPAIR_MISHAP', payload: { vehicleId: vehicle.id, mishapId: mishap.id } })}
                      sx={{ fontSize: '0.625rem', py: 0 }}
                    >
                      Repair
                    </Button>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">{mishap.effect}</Typography>
                {canRepairMishap(mishap) && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                    {getRepairDescription(mishap)}
                  </Typography>
                )}
                {!canRepairMishap(mishap) && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'primary.main' }}>
                    Cannot be repaired
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {/* Crew HP */}
      {vehicleCrew.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Crew HP:
          </Typography>
          <Stack spacing={0.5}>
            {vehicleCrew.map(({ creature, zone }) => (
              <CrewMemberRow
                key={creature!.id}
                creature={creature!}
                zone={zone}
                onHpChange={(newHp) => handleCreatureHpChange(creature!.id, newHp, creature!.statblock.maxHp)}
              />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export function AllVehiclesStatsPanel() {
  const { state } = useCombat();

  if (state.vehicles.length === 0) {
    return <Typography variant="body2" color="text.secondary">No vehicles in combat.</Typography>;
  }

  const partyVehicles = state.vehicles.filter((v) => v.type === 'party');
  const enemyVehicles = state.vehicles.filter((v) => v.type === 'enemy');

  return (
    <Box>
      {partyVehicles.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            PARTY VEHICLES
          </Typography>
          {partyVehicles.map((vehicle) => (
            <VehicleStatsPanel key={vehicle.id} vehicle={vehicle} />
          ))}
        </Box>
      )}

      {enemyVehicles.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 1 }}>
            ENEMY VEHICLES
          </Typography>
          {enemyVehicles.map((vehicle) => (
            <VehicleStatsPanel key={vehicle.id} vehicle={vehicle} />
          ))}
        </Box>
      )}
    </Box>
  );
}
