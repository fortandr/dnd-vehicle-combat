/**
 * Mishap Table from Baldur's Gate: Descent into Avernus
 *
 * A mishap occurs when:
 * - The infernal war machine takes damage from a single source equal to or greater than its mishap threshold
 * - The infernal war machine fails an ability check (or its driver fails an ability check using the vehicle's ability) by more than 5
 */

import { Mishap } from '../types';

/**
 * Official Mishap Table from Baldur's Gate: Descent into Avernus
 * Roll d20 when a mishap occurs
 */
export const MISHAP_TABLE: Mishap[] = [
  {
    id: 'mishap_engine_flare',
    rollMin: 1,
    rollMax: 1,
    name: 'Engine Flare',
    effect: 'Fire erupts from the engine and engulfs the vehicle. Any creature that starts its turn on or inside the vehicle takes 10 (3d6) fire damage until this mishap ends.',
    duration: 'until_repaired',
    repairDC: 15,
    repairAbility: 'dex',
    mechanicalEffect: {
      recurringDamage: '3d6 fire',
    },
  },
  {
    id: 'mishap_locked_steering',
    rollMin: 2,
    rollMax: 4,
    name: 'Locked Steering',
    effect: 'The vehicle can move in a straight line only. It automatically fails Dexterity checks and Dexterity saving throws until this mishap ends.',
    duration: 'until_repaired',
    repairDC: 15,
    repairAbility: 'str',
    mechanicalEffect: {
      autoFailDexChecks: true,
    },
  },
  {
    id: 'mishap_furnace_rupture',
    rollMin: 5,
    rollMax: 7,
    name: 'Furnace Rupture',
    effect: "The vehicle's speed decreases by 30 feet until this mishap ends.",
    duration: 'until_repaired',
    repairDC: 15,
    repairAbility: 'str',
    mechanicalEffect: {
      speedReduction: 30,
    },
  },
  {
    id: 'mishap_weapon_malfunction',
    rollMin: 8,
    rollMax: 10,
    name: 'Weapon Malfunction',
    effect: "One of the vehicle's weapons (DM's choice) can't be used until this mishap ends. If the vehicle has no functioning weapons, no mishap occurs.",
    duration: 'until_repaired',
    repairDC: 20,
    repairAbility: 'str',
    mechanicalEffect: {
      disableWeapons: ['random'],
    },
  },
  {
    id: 'mishap_blinding_smoke',
    rollMin: 11,
    rollMax: 13,
    name: 'Blinding Smoke',
    effect: 'The helm station fills with smoke and is heavily obscured until this mishap ends. Any creature in the helm station is blinded by the smoke.',
    duration: 'until_repaired',
    repairDC: 15,
    repairAbility: 'dex',
    mechanicalEffect: {
      zoneObscured: 'helm',
    },
  },
  {
    id: 'mishap_shedding_armor',
    rollMin: 14,
    rollMax: 16,
    name: 'Shedding Armor',
    effect: "The vehicle's damage threshold is reduced by 10 until this mishap ends.",
    duration: 'until_repaired',
    repairDC: 15,
    repairAbility: 'str',
    mechanicalEffect: {
      damageThresholdReduction: 10,
    },
  },
  {
    id: 'mishap_damaged_axle',
    rollMin: 17,
    rollMax: 19,
    name: 'Damaged Axle',
    effect: 'The vehicle grinds and shakes uncontrollably. Until the mishap ends, the vehicle has disadvantage on all Dexterity checks, and all ability checks and attack rolls made by creatures on or inside the vehicle have disadvantage.',
    duration: 'until_repaired',
    repairDC: 20,
    repairAbility: 'dex',
    mechanicalEffect: {
      disadvantageOnAllChecks: true,
    },
  },
  {
    id: 'mishap_flip',
    rollMin: 20,
    rollMax: 20,
    name: 'Flip',
    effect: "The vehicle flips over, falls prone, and comes to a dead stop in an unoccupied space. Any unsecured creature holding on to the outside of the vehicle must succeed on a DC 20 Strength saving throw or be thrown off, landing prone in a random unoccupied space within 20 feet of the overturned vehicle. Creatures inside the vehicle fall prone and must succeed on a DC 15 Strength saving throw or take 10 (3d6) bludgeoning damage.",
    duration: 'until_repaired',
    // No repair DC - cannot be repaired normally
    mechanicalEffect: {
      vehicleProne: true,
      crewSaveOnFlip: { dc: 15, damage: '3d6 bludgeoning' },
    },
  },
];

/**
 * Get the mishap result for a given d20 roll
 */
export function getMishapResult(roll: number): Mishap {
  const clampedRoll = Math.max(1, Math.min(20, roll));

  const mishap = MISHAP_TABLE.find(
    m => clampedRoll >= m.rollMin && clampedRoll <= m.rollMax
  );

  if (mishap) return mishap;

  // Fallback (should never happen with valid roll)
  return MISHAP_TABLE[0];
}

/**
 * Check if damage triggers a mishap
 */
export function checkMishapFromDamage(damage: number, mishapThreshold: number): boolean {
  return damage >= mishapThreshold;
}

/**
 * Check if a failed ability check triggers a mishap (failed by more than 5)
 */
export function checkMishapFromFailedCheck(roll: number, dc: number): boolean {
  return roll < dc - 5;
}

/**
 * Severity levels for UI display
 */
export function getMishapSeverity(roll: number): 'minor' | 'moderate' | 'severe' | 'catastrophic' {
  if (roll === 1) return 'severe'; // Engine Flare - ongoing fire damage
  if (roll >= 2 && roll <= 4) return 'moderate'; // Locked Steering
  if (roll >= 5 && roll <= 7) return 'minor'; // Furnace Rupture - just speed reduction
  if (roll >= 8 && roll <= 10) return 'moderate'; // Weapon Malfunction
  if (roll >= 11 && roll <= 13) return 'moderate'; // Blinding Smoke
  if (roll >= 14 && roll <= 16) return 'moderate'; // Shedding Armor
  if (roll >= 17 && roll <= 19) return 'severe'; // Damaged Axle - disadvantage on everything
  if (roll === 20) return 'catastrophic'; // Flip
  return 'moderate';
}

/**
 * Check if a mishap can be repaired
 */
export function canRepairMishap(mishap: Mishap): boolean {
  return mishap.repairDC !== undefined;
}

/**
 * Get repair description for a mishap
 */
export function getRepairDescription(mishap: Mishap): string {
  if (!mishap.repairDC || !mishap.repairAbility) {
    return 'This mishap cannot be repaired.';
  }

  const abilityName = mishap.repairAbility === 'str' ? 'Strength' : 'Dexterity';
  return `DC ${mishap.repairDC} ${abilityName} check (with disadvantage if vehicle is moving)`;
}

/**
 * Get roll range display string
 */
export function getMishapRollRange(mishap: Mishap): string {
  if (mishap.rollMin === mishap.rollMax) {
    return `${mishap.rollMin}`;
  }
  return `${mishap.rollMin}-${mishap.rollMax}`;
}
