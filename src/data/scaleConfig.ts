/**
 * Scale Configuration for Dynamic Distance Combat
 *
 * Combat operates at different scales based on engagement distance.
 * This allows for long-range pursuits (miles apart) to transition
 * smoothly into close combat (standard 5e rounds).
 *
 * Based on 5e round timing and movement rules, scaled appropriately.
 */

import { ScaleConfig, ScaleName } from '../types';
import { UnitSystem } from '../context/SettingsContext';

// Conversion constants
const FEET_PER_METER = 3.28084;
const FEET_PER_MILE = 5280;
const METERS_PER_KILOMETER = 1000;

// ==========================================
// Scale Definitions
// ==========================================

export const SCALES: Record<ScaleName, ScaleConfig> = {
  strategic: {
    name: 'strategic',
    displayName: 'Strategic',
    minDistance: 5280, // 1 mile in feet
    maxDistance: Infinity,
    roundDuration: 600, // 10 minutes
    roundDurationDisplay: '10 minutes',
    movementUnit: 5280, // 1 mile
    speedMultiplier: 100, // Vehicle speed × 100 = feet per round at this scale
    // e.g., 60 speed × 100 = 6000 ft (just over 1 mile) per 10-minute round
    // This represents ~6 mph, reasonable for rough terrain
    availableActions: [
      'navigate',
      'spot',
      'hide',
      'signal',
      'change_course',
      'forced_march',
    ],
    mapScale: 0.01, // 1 pixel = 100 feet
  },

  approach: {
    name: 'approach',
    displayName: 'Approach',
    minDistance: 1000,
    maxDistance: 5280,
    roundDuration: 60, // 1 minute
    roundDurationDisplay: '1 minute',
    movementUnit: 100, // 100 feet
    speedMultiplier: 10, // Vehicle speed × 10 = feet per round
    // e.g., 60 speed × 10 = 600 ft per minute
    availableActions: [
      'drive',
      'dash',
      'maneuver',
      'ready',
      'ranged_attack', // At disadvantage
      'signal',
    ],
    mapScale: 0.1, // 1 pixel = 10 feet
  },

  tactical: {
    name: 'tactical',
    displayName: 'Tactical',
    minDistance: 100,
    maxDistance: 1000,
    roundDuration: 6, // Standard 5e round
    roundDurationDisplay: '6 seconds',
    movementUnit: 5, // Standard 5e movement
    speedMultiplier: 3, // Vehicle speed × 3 = feet per round
    // e.g., 60 speed × 3 = 180 ft per round (covers 1000ft in ~6 rounds)
    // This represents vehicles at combat speed, not cautious maneuvering
    availableActions: [
      'all', // All standard actions available
    ],
    mapScale: 1, // 1 pixel = 1 foot
  },

  point_blank: {
    name: 'point_blank',
    displayName: 'Point-Blank',
    minDistance: 0,
    maxDistance: 100,
    roundDuration: 6,
    roundDurationDisplay: '6 seconds',
    movementUnit: 5,
    speedMultiplier: 1,
    availableActions: [
      'all',
      'board',
      'ram',
      'jump',
      'melee',
      'grapple',
    ],
    mapScale: 2, // 1 pixel = 0.5 feet (zoomed in)
  },
};

// ==========================================
// Scale Utilities
// ==========================================

/**
 * Get the appropriate scale for a given distance
 */
export function getScaleForDistance(distance: number): ScaleName {
  if (distance >= SCALES.strategic.minDistance) return 'strategic';
  if (distance >= SCALES.approach.minDistance) return 'approach';
  if (distance >= SCALES.tactical.minDistance) return 'tactical';
  return 'point_blank';
}

/**
 * Check if scale should transition based on new distance
 */
export function shouldTransitionScale(
  currentScale: ScaleName,
  newDistance: number
): { shouldTransition: boolean; suggestedScale: ScaleName } {
  const suggestedScale = getScaleForDistance(newDistance);
  return {
    shouldTransition: suggestedScale !== currentScale,
    suggestedScale,
  };
}

/**
 * Calculate movement per round at current scale
 */
export function calculateMovementPerRound(
  vehicleSpeed: number,
  scale: ScaleName
): number {
  const config = SCALES[scale];
  return vehicleSpeed * config.speedMultiplier;
}

/**
 * Calculate closing/separation speed between two vehicles
 * Positive = closing, Negative = separating
 */
export function calculateClosingSpeed(
  pursuerSpeed: number,
  quarrySpeed: number,
  scale: ScaleName
): number {
  const config = SCALES[scale];
  return (pursuerSpeed - quarrySpeed) * config.speedMultiplier;
}

/**
 * Calculate new distance after a round
 */
export function calculateNewDistance(
  currentDistance: number,
  pursuerSpeed: number,
  quarrySpeed: number,
  scale: ScaleName
): number {
  const closingSpeed = calculateClosingSpeed(pursuerSpeed, quarrySpeed, scale);
  const newDistance = Math.max(0, currentDistance - closingSpeed);
  return newDistance;
}

/**
 * Convert feet to meters
 */
export function feetToMeters(feet: number): number {
  return feet / FEET_PER_METER;
}

/**
 * Format distance for display (imperial - feet/miles)
 */
export function formatDistance(distanceFeet: number): string {
  if (distanceFeet >= FEET_PER_MILE) {
    const miles = distanceFeet / FEET_PER_MILE;
    return `${miles.toFixed(1)} miles`;
  }
  return `${Math.round(distanceFeet)} ft`;
}

/**
 * Format distance with unit system preference
 */
export function formatDistanceWithUnit(distanceFeet: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') {
    const meters = feetToMeters(distanceFeet);
    if (meters >= METERS_PER_KILOMETER) {
      const km = meters / METERS_PER_KILOMETER;
      return `${km.toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }
  // Imperial
  if (distanceFeet >= FEET_PER_MILE) {
    const miles = distanceFeet / FEET_PER_MILE;
    return `${miles.toFixed(1)} miles`;
  }
  return `${Math.round(distanceFeet)} ft`;
}

/**
 * Format a distance threshold for display (e.g., "100 ft" or "30 m")
 */
export function formatThreshold(distanceFeet: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') {
    const meters = feetToMeters(distanceFeet);
    if (meters >= METERS_PER_KILOMETER) {
      const km = meters / METERS_PER_KILOMETER;
      // Clean up display for nice round numbers
      return km === Math.floor(km) ? `${km} km` : `${km.toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }
  // Imperial
  if (distanceFeet >= FEET_PER_MILE) {
    const miles = distanceFeet / FEET_PER_MILE;
    return miles === Math.floor(miles) ? `${miles} mi` : `${miles.toFixed(1)} mi`;
  }
  return `${Math.round(distanceFeet)} ft`;
}

/**
 * Get scale config
 */
export function getScaleConfig(scale: ScaleName): ScaleConfig {
  return SCALES[scale];
}

/**
 * Check if an action is available at current scale
 */
export function isActionAvailableAtScale(
  action: string,
  scale: ScaleName
): boolean {
  const config = SCALES[scale];
  return (
    config.availableActions.includes('all') ||
    config.availableActions.includes(action)
  );
}

/**
 * Get all scales in order from closest to farthest
 */
export function getScalesInOrder(): ScaleName[] {
  return ['point_blank', 'tactical', 'approach', 'strategic'];
}

/**
 * Get transition thresholds for UI display
 */
export function getScaleThresholds(): { scale: ScaleName; threshold: number }[] {
  return [
    { scale: 'point_blank', threshold: 0 },
    { scale: 'tactical', threshold: 100 },
    { scale: 'approach', threshold: 1000 },
    { scale: 'strategic', threshold: 5280 },
  ];
}
