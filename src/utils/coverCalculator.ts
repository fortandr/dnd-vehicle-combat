/**
 * Cover Calculator
 * Calculates effective cover based on vehicle positions, facing, and zone visibility
 */

import { Vehicle, VehicleZone, Position, CoverType } from '../types';

export type AttackArc = 'front' | 'rear' | 'left' | 'right';

export interface CoverResult {
  baseCover: CoverType;
  effectiveCover: CoverType;
  acBonus: number;
  attackArc: AttackArc;
  isVisible: boolean;
  reason: string;
}

/**
 * Get AC bonus for a cover type
 */
export function getCoverACBonus(cover: CoverType): number {
  switch (cover) {
    case 'none':
      return 0;
    case 'half':
      return 2;
    case 'three_quarters':
      return 5;
    case 'full':
      return Infinity; // Can't be targeted
    default:
      return 0;
  }
}

/**
 * Get cover type from AC bonus (reverse lookup)
 */
export function getCoverFromBonus(bonus: number): CoverType {
  if (bonus >= Infinity) return 'full';
  if (bonus >= 5) return 'three_quarters';
  if (bonus >= 2) return 'half';
  return 'none';
}

/**
 * Calculate the angle from one position to another (in degrees, 0 = north/up)
 */
export function calculateAngle(from: Position, to: Position): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y; // Note: In screen coords, y increases downward

  // atan2 gives angle from positive x-axis, counter-clockwise
  // We want angle from north (negative y), clockwise
  let angle = Math.atan2(dx, -dy) * (180 / Math.PI);

  // Normalize to 0-360
  if (angle < 0) angle += 360;

  return angle;
}

/**
 * Determine which arc an attack is coming from based on angle and target vehicle facing
 * @param attackAngle - Angle from attacker to target (0 = north)
 * @param targetFacing - Target vehicle's facing angle (0 = north)
 */
export function getAttackArc(attackAngle: number, targetFacing: number): AttackArc {
  // Calculate the relative angle (from target's perspective)
  // If attacker is at 0° (north) and target faces 0° (north), attack comes from front
  // We need the angle from target's perspective, which is opposite of attack angle
  let relativeAngle = (attackAngle - targetFacing + 180) % 360;
  if (relativeAngle < 0) relativeAngle += 360;

  // Determine arc based on relative angle
  // Front: 315-45 (target facing toward attacker)
  // Right (starboard): 45-135
  // Rear: 135-225
  // Left (port): 225-315

  if (relativeAngle >= 315 || relativeAngle < 45) {
    return 'front';
  } else if (relativeAngle >= 45 && relativeAngle < 135) {
    return 'right'; // Starboard
  } else if (relativeAngle >= 135 && relativeAngle < 225) {
    return 'rear';
  } else {
    return 'left'; // Port
  }
}

/**
 * Check if a zone is visible from a given attack arc
 */
export function isZoneVisibleFromArc(zone: VehicleZone, arc: AttackArc): boolean {
  return zone.visibleFromArcs.includes(arc);
}

/**
 * Calculate effective cover for an attack
 * @param attackerVehicle - Vehicle the attacker is on
 * @param targetVehicle - Vehicle the target is on
 * @param targetZone - Zone the target creature is in
 */
export function calculateCover(
  attackerVehicle: Vehicle,
  targetVehicle: Vehicle,
  targetZone: VehicleZone
): CoverResult {
  // Calculate angle from attacker's vehicle to target's vehicle
  const attackAngle = calculateAngle(attackerVehicle.position, targetVehicle.position);

  // Determine which arc the attack is coming from (from target's perspective)
  const attackArc = getAttackArc(attackAngle, targetVehicle.facing);

  // Check if zone is visible from this arc
  const isVisible = isZoneVisibleFromArc(targetZone, attackArc);

  // Base cover from the zone
  const baseCover = targetZone.cover;
  const baseACBonus = getCoverACBonus(baseCover);

  // If not visible from this arc, target has full cover
  if (!isVisible) {
    return {
      baseCover,
      effectiveCover: 'full',
      acBonus: Infinity,
      attackArc,
      isVisible: false,
      reason: `Target in ${targetZone.name} is not visible from the ${attackArc} (blocked by vehicle structure)`,
    };
  }

  // Visible from this arc - use zone's base cover
  // Zone cover already includes station cover (helm = 3/4, weapon stations = half, deck = varies)
  return {
    baseCover,
    effectiveCover: baseCover,
    acBonus: baseACBonus,
    attackArc,
    isVisible: true,
    reason: baseCover === 'none'
      ? `Target in ${targetZone.name} is fully exposed (attacking from ${getArcDisplayName(attackArc)})`
      : `Target in ${targetZone.name} has ${formatCover(baseCover)} from station (attacking from ${getArcDisplayName(attackArc)})`,
  };
}

/**
 * Get a description of what cover a zone provides
 */
export function getZoneCoverDescription(zone: VehicleZone): string {
  const coverDesc = {
    none: 'No cover - fully exposed',
    half: 'Half cover (+2 AC) - body partially shielded by station',
    three_quarters: 'Three-quarters cover (+5 AC) - only head/shoulders visible',
    full: 'Full cover - completely protected from outside attacks',
  };
  return coverDesc[zone.cover] || zone.cover;
}

/**
 * Calculate cover for same-vehicle attacks (melee or adjacent zones)
 */
export function calculateSameVehicleCover(
  attackerZone: VehicleZone,
  targetZone: VehicleZone
): CoverResult {
  // On same vehicle - use target's zone cover directly
  // Could add logic for "can attack between zones" later
  return {
    baseCover: targetZone.cover,
    effectiveCover: targetZone.cover,
    acBonus: getCoverACBonus(targetZone.cover),
    attackArc: 'front', // Not really applicable for same-vehicle
    isVisible: true,
    reason: `Same vehicle - target has ${formatCover(targetZone.cover)} from ${targetZone.name}`,
  };
}

/**
 * Format cover type for display
 */
export function formatCover(cover: CoverType): string {
  switch (cover) {
    case 'none':
      return 'no cover';
    case 'half':
      return 'half cover (+2 AC)';
    case 'three_quarters':
      return 'three-quarters cover (+5 AC)';
    case 'full':
      return 'full cover (no line of sight)';
    default:
      return cover;
  }
}

/**
 * Get all potential targets on a vehicle with their cover status
 */
export function getTargetsWithCover(
  attackerVehicle: Vehicle,
  attackerZone: VehicleZone | undefined,
  targetVehicle: Vehicle,
  targetCreatures: { creatureId: string; zoneId: string }[],
  creatures: { id: string; name: string }[]
): Array<{
  creatureId: string;
  creatureName: string;
  zoneName: string;
  cover: CoverResult;
}> {
  const isSameVehicle = attackerVehicle.id === targetVehicle.id;

  return targetCreatures
    .map((tc) => {
      const creature = creatures.find((c) => c.id === tc.creatureId);
      const zone = targetVehicle.template.zones.find((z) => z.id === tc.zoneId);

      if (!creature || !zone) return null;

      const cover = isSameVehicle && attackerZone
        ? calculateSameVehicleCover(attackerZone, zone)
        : calculateCover(attackerVehicle, targetVehicle, zone);

      return {
        creatureId: tc.creatureId,
        creatureName: creature.name,
        zoneName: zone.name,
        cover,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
}

/**
 * Get arc display name
 */
export function getArcDisplayName(arc: AttackArc): string {
  switch (arc) {
    case 'front':
      return 'Bow';
    case 'rear':
      return 'Stern';
    case 'left':
      return 'Port';
    case 'right':
      return 'Starboard';
  }
}

/**
 * Calculate effective cover for an attack from a position (creature on foot)
 * @param attackerPosition - Position of the attacker on the map
 * @param targetVehicle - Vehicle the target is on
 * @param targetZone - Zone the target creature is in
 */
export function calculateCoverFromPosition(
  attackerPosition: Position,
  targetVehicle: Vehicle,
  targetZone: VehicleZone
): CoverResult {
  // Calculate angle from attacker's position to target's vehicle
  const attackAngle = calculateAngle(attackerPosition, targetVehicle.position);

  // Determine which arc the attack is coming from (from target's perspective)
  const attackArc = getAttackArc(attackAngle, targetVehicle.facing);

  // Check if zone is visible from this arc
  const isVisible = isZoneVisibleFromArc(targetZone, attackArc);

  // Base cover from the zone
  const baseCover = targetZone.cover;
  const baseACBonus = getCoverACBonus(baseCover);

  // If not visible from this arc, target has full cover
  if (!isVisible) {
    return {
      baseCover,
      effectiveCover: 'full',
      acBonus: Infinity,
      attackArc,
      isVisible: false,
      reason: `Target in ${targetZone.name} is not visible from the ${attackArc} (blocked by vehicle structure)`,
    };
  }

  // Visible from this arc - use zone's base cover
  return {
    baseCover,
    effectiveCover: baseCover,
    acBonus: baseACBonus,
    attackArc,
    isVisible: true,
    reason: baseCover === 'none'
      ? `Target in ${targetZone.name} is fully exposed (attacking from ${getArcDisplayName(attackArc)})`
      : `Target in ${targetZone.name} has ${formatCover(baseCover)} from station (attacking from ${getArcDisplayName(attackArc)})`,
  };
}
