/**
 * Right Panel Component
 * Target info and current turn details
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { TargetCoverPanel } from '../combat/TargetCoverPanel';
import { factionColors, coverColors, withOpacity } from '../../theme/customColors';
import {
  getVehicleElevation,
  getElevationDifference,
  getElevationAttackModifier,
  parseWeaponRange,
} from '../../utils/elevationCalculator';

export function RightPanel() {
  const { state, currentTurnVehicle, currentTurnCreature } = useCombat();

  // For cover calculations, find the vehicle the current creature is on (if any)
  const currentCreatureAssignment = currentTurnCreature
    ? state.crewAssignments.find((a) => a.creatureId === currentTurnCreature.id)
    : null;
  const creatureVehicle = currentCreatureAssignment
    ? state.vehicles.find((v) => v.id === currentCreatureAssignment.vehicleId)
    : null;

  // The "attacker" for cover purposes - either the current turn vehicle, or the vehicle the creature is on
  const attackerVehicle = currentTurnVehicle || creatureVehicle;

  // For creatures on foot - they can attack vehicles, so show cover panel if they have a position
  const creatureOnFoot = currentTurnCreature && !creatureVehicle && currentTurnCreature.position;

  // Determine attacker's faction for creatures on foot
  const attackerFaction = currentTurnCreature?.statblock.type === 'pc' ? 'party' : 'enemy';

  return (
    <Box
      component="aside"
      sx={{
        gridArea: 'panel',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        p: 2,
      }}
    >
      {/* Setup Phase - Show placeholder content */}
      {state.phase === 'setup' && (
        <Box sx={{ color: 'text.secondary' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: 'text.primary' }}>
            Combat Info Panel
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            During combat, this panel displays:
          </Typography>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" fontWeight={600} sx={{ color: 'text.primary' }}>
                Current Turn
              </Typography>
              <Typography variant="caption" display="block">
                Active vehicle/creature info, crew positions, and equipped weapons
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={600} sx={{ color: 'text.primary' }}>
                Target Status
              </Typography>
              <Typography variant="caption" display="block">
                Range, cover, and elevation info for potential targets
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ mt: 3, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
              Add vehicles and creatures, assign crew to stations, then click "Start Combat" to begin.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Current Turn Info - Show during combat */}
      {state.phase === 'combat' && (
        <Card sx={{ mb: 2 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Current Turn
            </Typography>
            <CurrentTurnInfo />
          </CardContent>
        </Card>
      )}

      {/* Target Status - Show during combat when attacker has a vehicle or is on foot with a position */}
      {state.phase === 'combat' && (attackerVehicle || creatureOnFoot) && (
        <Card>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Target Status
              {currentTurnCreature && creatureVehicle && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  (from {creatureVehicle.name})
                </Typography>
              )}
            </Typography>
            {attackerVehicle ? (
              <TargetCoverPanel attackerVehicle={attackerVehicle} />
            ) : creatureOnFoot && currentTurnCreature ? (
              <TargetCoverPanel attackerCreature={currentTurnCreature} attackerFaction={attackerFaction} />
            ) : null}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// Calculate effective speed accounting for mishap effects
function getEffectiveSpeed(vehicle: { currentSpeed: number; activeMishaps: Array<{ mechanicalEffect?: { speedReduction?: number } }> }): number {
  let speed = vehicle.currentSpeed;
  for (const mishap of vehicle.activeMishaps) {
    if (mishap.mechanicalEffect?.speedReduction) {
      speed -= mishap.mechanicalEffect.speedReduction;
    }
  }
  return Math.max(0, speed);
}

function CurrentTurnInfo() {
  const { state, currentTurnCreature, currentTurnVehicle, currentTurnDriver } = useCombat();

  // Calculate elevation modifiers for the current vehicle against enemy targets
  // Returns grouped modifiers: { highGround: +2, lowGround: -2 } or null if no elevation differences
  const getElevationModsForWeapon = (attackerVehicle: typeof currentTurnVehicle): { highGround: number | null; lowGround: number | null } | null => {
    if (!attackerVehicle) return null;

    const attackerElevation = getVehicleElevation(attackerVehicle, state.elevationZones);
    const attackerFaction = attackerVehicle.type;

    // Collect all enemy targets: vehicles and unassigned creatures
    const enemyVehicles = state.vehicles.filter(v => v.type !== attackerFaction);
    const assignedCreatureIds = new Set(state.crewAssignments.map(a => a.creatureId));
    const enemyCreatures = state.creatures.filter(c =>
      !assignedCreatureIds.has(c.id) &&
      c.position &&
      (attackerFaction === 'party' ? c.statblock.type !== 'pc' : c.statblock.type === 'pc')
    );

    let hasHighGround = false; // Attacker has high ground over some target
    let hasLowGround = false;  // Attacker has low ground against some target

    // Check enemy vehicles
    for (const enemy of enemyVehicles) {
      const targetElevation = getVehicleElevation(enemy, state.elevationZones);
      const elevDiff = getElevationDifference(attackerElevation, targetElevation);
      const attackMod = getElevationAttackModifier(elevDiff);
      if (attackMod > 0) hasHighGround = true;
      if (attackMod < 0) hasLowGround = true;
    }

    // Check unassigned enemy creatures (they have positions)
    for (const creature of enemyCreatures) {
      if (!creature.position) continue;
      // Get creature's elevation from their position
      let creatureElevation = 0;
      for (const zone of state.elevationZones) {
        if (creature.position.x >= zone.position.x &&
            creature.position.x <= zone.position.x + zone.size.width &&
            creature.position.y >= zone.position.y &&
            creature.position.y <= zone.position.y + zone.size.height) {
          if (zone.elevation > creatureElevation) {
            creatureElevation = zone.elevation;
          }
        }
      }
      const elevDiff = getElevationDifference(attackerElevation, creatureElevation);
      const attackMod = getElevationAttackModifier(elevDiff);
      if (attackMod > 0) hasHighGround = true;
      if (attackMod < 0) hasLowGround = true;
    }

    // Return null if no elevation differences matter
    if (!hasHighGround && !hasLowGround) return null;

    return {
      highGround: hasHighGround ? 2 : null,
      lowGround: hasLowGround ? -2 : null,
    };
  };

  // Vehicle turn - show vehicle and crew info
  if (currentTurnVehicle) {
    const vehicleCrew = state.crewAssignments
      .filter((a) => a.vehicleId === currentTurnVehicle.id)
      .map((a) => {
        const creature = state.creatures.find((c) => c.id === a.creatureId);
        const zone = currentTurnVehicle.template.zones.find((z) => z.id === a.zoneId);
        // Find weapon at this zone
        const weapon = currentTurnVehicle.weapons.find((w) => w.zoneId === a.zoneId);
        return { creature, zone, weapon, isDriver: creature?.id === currentTurnDriver?.id };
      })
      .filter((c) => c.creature);

    const borderColor = currentTurnVehicle.type === 'party' ? factionColors.party : factionColors.enemy;
    const effectiveSpeed = getEffectiveSpeed(currentTurnVehicle);
    const hasSpeedReduction = effectiveSpeed < currentTurnVehicle.currentSpeed;

    return (
      <Box>
        {/* Vehicle Info */}
        <Paper
          sx={{
            p: 1,
            mb: 1,
            bgcolor: withOpacity(borderColor, 0.1),
            borderLeft: 3,
            borderColor: borderColor,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={600}>{currentTurnVehicle.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              HP: {currentTurnVehicle.currentHp}/{currentTurnVehicle.template.maxHp}
            </Typography>
            {hasSpeedReduction ? (
              <Typography variant="caption" component="span">
                <Box component="span" color="text.secondary">Speed: </Box>
                <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                  {effectiveSpeed} ft
                </Box>
                <Box component="span" sx={{ color: 'text.disabled', textDecoration: 'line-through', ml: 0.5 }}>
                  {currentTurnVehicle.currentSpeed}
                </Box>
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Speed: {currentTurnVehicle.currentSpeed} ft
              </Typography>
            )}
          </Box>
        </Paper>

        {/* Driver */}
        {currentTurnDriver && (
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            <Box component="span" color="text.secondary">Driver: </Box>
            <Box component="span" fontWeight={600}>{currentTurnDriver.name}</Box>
            <Box component="span" color="text.secondary"> (Init: {currentTurnDriver.initiative})</Box>
          </Typography>
        )}

        {/* Crew List */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          Crew ({vehicleCrew.length}):
        </Typography>
        <Stack spacing={0.5}>
            {vehicleCrew.map(({ creature, zone, weapon, isDriver }) => {
              const isAlive = creature!.currentHp > 0;
              const showWeapon = weapon && isAlive;
              return (
              <Paper
                key={creature!.id}
                sx={{
                  p: 1,
                  bgcolor: '#242424',
                  borderLeft: showWeapon ? 2 : 0,
                  borderColor: showWeapon ? 'warning.main' : undefined,
                  opacity: isAlive ? 1 : 0.5,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2">
                      {creature!.name}
                      {!isAlive && (
                        <Typography component="span" variant="body2" color="error.main"> (DEAD)</Typography>
                      )}
                      {isDriver && isAlive && (
                        <Typography component="span" variant="body2" color="text.secondary"> (Driver)</Typography>
                      )}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {zone?.name || 'Unassigned'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontFamily="monospace" sx={{ color: isAlive ? 'inherit' : 'error.main' }}>
                      HP: {creature!.currentHp}/{creature!.statblock.maxHp}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace" sx={{ display: 'block' }}>
                      AC: {creature!.statblock.ac}
                    </Typography>
                  </Box>
                </Box>
                {/* Weapon info for manned weapon stations - only show if crew is alive */}
                {showWeapon && (() => {
                  // Only show elevation modifiers for ranged attack roll weapons (not melee, not save-based)
                  const isRangedWeapon = parseWeaponRange(weapon.range) > 0;
                  // A weapon is save-based if it has saveDC, saveType, or "Save-based" in properties
                  const isSaveBased = weapon.saveDC !== undefined ||
                    weapon.saveType !== undefined ||
                    weapon.properties?.some(p => p.toLowerCase().includes('save'));
                  // A weapon uses attack rolls if it has attackBonus defined and is not save-based
                  const isAttackRoll = weapon.attackBonus !== undefined && !isSaveBased;
                  const elevMods = (isRangedWeapon && isAttackRoll) ? getElevationModsForWeapon(currentTurnVehicle) : null;
                  return (
                  <Box
                    sx={{
                      mt: 0.5,
                      pt: 0.5,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="caption" color="warning.main" fontWeight={600}>
                      ⚔ {weapon.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
                      {weapon.attackBonus !== undefined ? (
                        <>
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            +{weapon.attackBonus} to hit
                          </Typography>
                          {elevMods && (
                            <>
                              {elevMods.highGround !== null && (
                                <Typography
                                  variant="caption"
                                  fontFamily="monospace"
                                  sx={{ color: '#3b82f6', fontWeight: 600 }}
                                >
                                  (+{weapon.attackBonus + elevMods.highGround} vs low ground)
                                </Typography>
                              )}
                              {elevMods.lowGround !== null && (
                                <Typography
                                  variant="caption"
                                  fontFamily="monospace"
                                  sx={{ color: '#ef4444', fontWeight: 600 }}
                                >
                                  (+{weapon.attackBonus + elevMods.lowGround} vs high ground)
                                </Typography>
                              )}
                            </>
                          )}
                        </>
                      ) : weapon.saveDC !== undefined ? (
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                          DC {weapon.saveDC} {weapon.saveType?.toUpperCase()} save
                        </Typography>
                      ) : null}
                      <Typography variant="caption" fontFamily="monospace" sx={{ color: 'error.light' }}>
                        {weapon.damage}
                      </Typography>
                      {weapon.range && (
                        <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                          {weapon.range}
                        </Typography>
                      )}
                    </Box>
                    {weapon.specialEffect && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontStyle: 'italic' }}>
                        {weapon.specialEffect}
                      </Typography>
                    )}
                  </Box>
                  );
                })()}
              </Paper>
            );
            })}
        </Stack>

        {/* Movement-based Damage Traits (Driver abilities) */}
        {(() => {
          // Filter traits that deal damage on movement (for driver reference)
          const movementDamageTraits = (currentTurnVehicle.template.traits || []).filter((trait) => {
            const desc = trait.description.toLowerCase();
            // Look for traits that mention damage and movement-related keywords
            return desc.includes('damage') && (
              desc.includes('move') ||
              desc.includes('within') ||
              desc.includes('space of')
            );
          });

          if (movementDamageTraits.length === 0) return null;

          // Extract damage from description (e.g., "13 (2d10 + 2) slashing damage")
          const extractDamage = (desc: string): string | null => {
            const match = desc.match(/(\d+)\s*\(([^)]+)\)\s*(\w+)\s*damage/i);
            if (match) {
              return `${match[1]} (${match[2]}) ${match[3]}`;
            }
            return null;
          };

          // Extract DC from description
          const extractDC = (desc: string): string | null => {
            const match = desc.match(/DC\s*(\d+)\s*(\w+)/i);
            if (match) {
              return `DC ${match[1]} ${match[2]}`;
            }
            return null;
          };

          return (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                Movement Damage (Driver):
              </Typography>
              <Stack spacing={0.5}>
                {movementDamageTraits.map((trait) => {
                  const damage = extractDamage(trait.description);
                  const dc = extractDC(trait.description);
                  return (
                    <Paper
                      key={trait.name}
                      sx={{
                        p: 1,
                        bgcolor: withOpacity('#3b82f6', 0.1),
                        borderLeft: 2,
                        borderColor: 'info.main',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} color="info.main">
                        {trait.name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
                        {damage && (
                          <Typography variant="caption" fontFamily="monospace" sx={{ color: 'error.light' }}>
                            {damage}
                          </Typography>
                        )}
                        {dc && (
                          <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                            {dc} save
                          </Typography>
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          fontSize: '0.65rem',
                          lineHeight: 1.3,
                        }}
                      >
                        {trait.description.length > 150
                          ? trait.description.substring(0, 150) + '...'
                          : trait.description}
                      </Typography>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          );
        })()}

        {/* Active Mishaps */}
        {currentTurnVehicle.activeMishaps.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Active Mishaps:
            </Typography>
            <Stack spacing={0.5}>
              {currentTurnVehicle.activeMishaps.map((mishap) => (
                <Paper
                  key={mishap.id}
                  sx={{
                    p: 1,
                    bgcolor: withOpacity('#f59e0b', 0.1),
                    borderLeft: 2,
                    borderColor: 'warning.main',
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>{mishap.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{mishap.effect}</Typography>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    );
  }

  // Creature turn (independent creature not on a vehicle)
  if (!currentTurnCreature) {
    return <Typography variant="body2" color="text.secondary">No active turn</Typography>;
  }

  const assignment = state.crewAssignments.find(
    (a) => a.creatureId === currentTurnCreature.id
  );
  const vehicle = assignment
    ? state.vehicles.find((v) => v.id === assignment.vehicleId)
    : null;
  const zone = vehicle?.template.zones.find((z) => z.id === assignment?.zoneId);

  const coverColor = zone ? coverColors[zone.cover as keyof typeof coverColors] : undefined;

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600}>{currentTurnCreature.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        HP: {currentTurnCreature.currentHp}/{currentTurnCreature.statblock.maxHp} |
        AC: {currentTurnCreature.statblock.ac}
      </Typography>
      {vehicle && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          On {vehicle.name}
          {zone && ` • ${zone.name}`}
        </Typography>
      )}
      {zone && coverColor && (
        <Box sx={{ mt: 1 }}>
          <Chip
            label={formatCover(zone.cover)}
            size="small"
            sx={{
              bgcolor: withOpacity(coverColor, 0.2),
              color: coverColor,
            }}
          />
        </Box>
      )}
    </Box>
  );
}

function formatCover(cover: string): string {
  const labels: Record<string, string> = {
    none: 'No Cover',
    half: 'Half Cover (+2 AC)',
    three_quarters: '3/4 Cover (+5 AC)',
    full: 'Full Cover',
  };
  return labels[cover] || cover;
}
