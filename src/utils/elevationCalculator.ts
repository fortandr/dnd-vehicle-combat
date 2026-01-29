/**
 * Elevation Calculator
 * Handles elevation-based combat modifiers for attack rolls, range, and cover
 */

import { Position, ElevationZone, Vehicle, CoverType } from '../types';

/**
 * Check if a position is within an elevation zone
 */
function isPositionInZone(position: Position, zone: ElevationZone): boolean {
  return (
    position.x >= zone.position.x &&
    position.x <= zone.position.x + zone.size.width &&
    position.y >= zone.position.y &&
    position.y <= zone.position.y + zone.size.height
  );
}

/**
 * Get the elevation at a position by checking all elevation zones
 * If position is in multiple zones, returns the highest elevation (represents being "on top")
 * Returns 0 if not in any elevation zone
 */
export function getPositionElevation(position: Position, zones: ElevationZone[]): number {
  let maxElevation = 0;

  for (const zone of zones) {
    if (isPositionInZone(position, zone)) {
      if (zone.elevation > maxElevation) {
        maxElevation = zone.elevation;
      }
    }
  }

  return maxElevation;
}

/**
 * Get a vehicle's elevation based on its position
 */
export function getVehicleElevation(vehicle: Vehicle, zones: ElevationZone[]): number {
  return getPositionElevation(vehicle.position, zones);
}

/**
 * Get the elevation difference between attacker and target
 * Positive value means attacker is higher than target
 * Negative value means attacker is lower than target
 */
export function getElevationDifference(attackerElevation: number, targetElevation: number): number {
  return attackerElevation - targetElevation;
}

/**
 * Get the attack modifier based on elevation difference
 * Rule 1: +2 to hit from high ground, -2 from low ground
 * Requires at least 10 ft elevation difference to apply
 */
export function getElevationAttackModifier(elevationDiff: number): number {
  if (elevationDiff >= 10) {
    return 2; // High ground advantage
  } else if (elevationDiff <= -10) {
    return -2; // Low ground disadvantage
  }
  return 0; // No modifier for small elevation differences
}

/**
 * Parse weapon range string into numeric value
 * Handles formats like "120 ft", "melee (5 ft)", "30 ft cone", "80/320 ft"
 * Returns the base/short range value, or 0 for melee weapons
 */
export function parseWeaponRange(rangeString: string | undefined): number {
  if (!rangeString) return 0;

  const normalizedRange = rangeString.toLowerCase().trim();

  // Melee weapons don't get range extension
  if (normalizedRange.includes('melee')) {
    return 0;
  }

  // Handle range increments like "80/320 ft" - take the first (short range)
  if (normalizedRange.includes('/')) {
    const shortRange = normalizedRange.split('/')[0];
    const match = shortRange.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Handle standard format like "120 ft" or "30 ft cone"
  const match = normalizedRange.match(/(\d+)\s*ft/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get modified weapon range when firing downward
 * Rule 2: 10% range extension per 10 ft of elevation advantage
 * Only applies when attacker is at higher elevation
 */
export function getModifiedWeaponRange(baseRange: number, elevationDiff: number): number {
  // No modification if melee (baseRange 0) or not firing downward
  if (baseRange === 0 || elevationDiff <= 0) {
    return baseRange;
  }

  // Calculate range bonus: 10% per 10 ft of elevation
  const elevationTiers = Math.floor(elevationDiff / 10);
  const bonusMultiplier = elevationTiers * 0.1;
  const rangeBonus = Math.floor(baseRange * bonusMultiplier);

  return baseRange + rangeBonus;
}

/**
 * Format range extension info for display
 * Returns null if no extension applies
 */
export function formatRangeExtension(
  baseRange: number,
  modifiedRange: number,
  elevationDiff: number
): string | null {
  if (baseRange === 0 || modifiedRange <= baseRange) {
    return null;
  }

  const bonusFt = modifiedRange - baseRange;
  return `Range +${bonusFt} ft (${modifiedRange} ft total, high ground)`;
}

/**
 * Get elevation-adjusted cover when defender is at higher elevation
 * DISABLED: Cover upgrade removed - the +2/-2 attack modifier is sufficient
 * Previously: half → three-quarters, three-quarters → full for defenders at higher elevation
 */
export function getElevationAdjustedCover(baseCover: CoverType, _elevationDiff: number): CoverType {
  // Cover upgrade disabled - just return base cover
  // The +2/-2 to hit modifier is the only elevation effect
  return baseCover;
}

/**
 * Check if cover was upgraded due to elevation
 * DISABLED: Cover upgrade removed - always returns false
 */
export function wasCoverUpgradedByElevation(_baseCover: CoverType, _effectiveCover: CoverType): boolean {
  // Cover upgrade disabled - never upgraded
  return false;
}

/**
 * Elevation combat info for UI display
 */
export interface ElevationCombatInfo {
  attackerElevation: number;
  targetElevation: number;
  elevationDiff: number;
  attackModifier: number;
  baseRange: number;
  modifiedRange: number;
  rangeExtensionText: string | null;
  baseCover: CoverType;
  effectiveCover: CoverType;
  coverUpgraded: boolean;
}

/**
 * Calculate all elevation combat effects for a given attack
 */
export function calculateElevationCombatInfo(
  attackerElevation: number,
  targetElevation: number,
  weaponRange: string | undefined,
  baseCover: CoverType
): ElevationCombatInfo {
  const elevationDiff = getElevationDifference(attackerElevation, targetElevation);
  const attackModifier = getElevationAttackModifier(elevationDiff);
  const baseRange = parseWeaponRange(weaponRange);
  const modifiedRange = getModifiedWeaponRange(baseRange, elevationDiff);
  const rangeExtensionText = formatRangeExtension(baseRange, modifiedRange, elevationDiff);
  const effectiveCover = getElevationAdjustedCover(baseCover, elevationDiff);
  const coverUpgraded = wasCoverUpgradedByElevation(baseCover, effectiveCover);

  return {
    attackerElevation,
    targetElevation,
    elevationDiff,
    attackModifier,
    baseRange,
    modifiedRange,
    rangeExtensionText,
    baseCover,
    effectiveCover,
    coverUpgraded,
  };
}

/**
 * Format elevation difference for display (from attacker's perspective)
 */
export function formatElevationDiff(elevationDiff: number): string {
  if (elevationDiff > 0) {
    return `Target ${elevationDiff} ft lower`;
  } else if (elevationDiff < 0) {
    return `Target ${Math.abs(elevationDiff)} ft higher`;
  }
  return 'Same elevation';
}

/**
 * Get display text for attack modifier (from attacker's perspective)
 */
export function formatAttackModifier(modifier: number): string {
  if (modifier > 0) {
    return `+${modifier} (you have high ground)`;
  } else if (modifier < 0) {
    return `${modifier} (target has high ground)`;
  }
  return '';
}
