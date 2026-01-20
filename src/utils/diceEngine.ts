/**
 * Dice Rolling Engine
 *
 * Supports standard 5e dice notation:
 * - Basic: "1d20", "2d6", "4d10"
 * - With modifier: "1d20+5", "2d6-2"
 * - Advantage/Disadvantage: "1d20 adv", "1d20 dis"
 * - Multiple dice types: "2d6+1d4+3"
 */

import { DiceRollResult } from '../types';

// ==========================================
// Core Dice Rolling
// ==========================================

/**
 * Roll a single die
 */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice of the same type
 */
export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

/**
 * Parse dice notation and roll
 * Supports: "1d20", "2d6+5", "1d20 adv", "4d6kh3" (keep highest 3)
 */
export function roll(notation: string): DiceRollResult {
  const cleanNotation = notation.toLowerCase().trim();

  // Check for advantage/disadvantage
  const hasAdvantage = cleanNotation.includes(' adv');
  const hasDisadvantage = cleanNotation.includes(' dis');
  const baseNotation = cleanNotation
    .replace(' adv', '')
    .replace(' dis', '')
    .trim();

  // Parse the notation
  const parsed = parseDiceNotation(baseNotation);

  let rolls: number[] = [];
  let total = 0;

  if (hasAdvantage || hasDisadvantage) {
    // For advantage/disadvantage, roll twice and take best/worst
    const roll1 = rollDice(parsed.count, parsed.sides);
    const roll2 = rollDice(parsed.count, parsed.sides);
    const sum1 = roll1.reduce((a, b) => a + b, 0);
    const sum2 = roll2.reduce((a, b) => a + b, 0);

    if (hasAdvantage) {
      rolls = sum1 >= sum2 ? roll1 : roll2;
      total = Math.max(sum1, sum2) + parsed.modifier;
    } else {
      rolls = sum1 <= sum2 ? roll1 : roll2;
      total = Math.min(sum1, sum2) + parsed.modifier;
    }
  } else {
    rolls = rollDice(parsed.count, parsed.sides);
    total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
  }

  // Check for critical hit/miss on d20
  const isCriticalHit =
    parsed.sides === 20 && parsed.count === 1 && rolls[0] === 20;
  const isCriticalMiss =
    parsed.sides === 20 && parsed.count === 1 && rolls[0] === 1;

  return {
    notation,
    rolls,
    modifier: parsed.modifier,
    total,
    advantage: hasAdvantage,
    disadvantage: hasDisadvantage,
    criticalHit: isCriticalHit,
    criticalMiss: isCriticalMiss,
  };
}

interface ParsedDice {
  count: number;
  sides: number;
  modifier: number;
}

/**
 * Parse dice notation string
 */
function parseDiceNotation(notation: string): ParsedDice {
  // Match patterns like "2d6+5" or "1d20-2" or just "d20"
  const match = notation.match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) {
    // Try to handle just a number (constant)
    const num = parseInt(notation, 10);
    if (!isNaN(num)) {
      return { count: 0, sides: 0, modifier: num };
    }
    throw new Error(`Invalid dice notation: ${notation}`);
  }

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  return { count, sides, modifier };
}

// ==========================================
// Common 5e Rolls
// ==========================================

/**
 * Roll a d20 with optional modifier
 */
export function rollD20(modifier = 0): DiceRollResult {
  return roll(modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`);
}

/**
 * Roll attack with advantage/disadvantage
 */
export function rollAttack(
  modifier: number,
  advantage = false,
  disadvantage = false
): DiceRollResult {
  let notation = modifier >= 0 ? `1d20+${modifier}` : `1d20${modifier}`;
  if (advantage && !disadvantage) notation += ' adv';
  if (disadvantage && !advantage) notation += ' dis';
  return roll(notation);
}

/**
 * Roll damage dice
 */
export function rollDamage(notation: string, critical = false): DiceRollResult {
  if (critical) {
    // Double the dice on a critical hit
    const parsed = parseDiceNotation(notation);
    const doubledNotation =
      parsed.modifier >= 0
        ? `${parsed.count * 2}d${parsed.sides}+${parsed.modifier}`
        : `${parsed.count * 2}d${parsed.sides}${parsed.modifier}`;
    return roll(doubledNotation);
  }
  return roll(notation);
}

/**
 * Roll a saving throw
 */
export function rollSave(
  modifier: number,
  advantage = false,
  disadvantage = false
): DiceRollResult {
  return rollAttack(modifier, advantage, disadvantage);
}

/**
 * Roll initiative
 */
export function rollInitiative(dexModifier: number): DiceRollResult {
  return rollD20(dexModifier);
}

/**
 * Roll on a table (d20, d100, etc)
 */
export function rollTable(sides: number): number {
  return rollDie(sides);
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Calculate average for dice notation
 */
export function calculateAverage(notation: string): number {
  const parsed = parseDiceNotation(notation);
  const avgPerDie = (parsed.sides + 1) / 2;
  return parsed.count * avgPerDie + parsed.modifier;
}

/**
 * Format roll result for display
 */
export function formatRollResult(result: DiceRollResult): string {
  let str = `${result.notation}: `;

  if (result.rolls.length > 0) {
    str += `[${result.rolls.join(', ')}]`;
    if (result.modifier !== 0) {
      str += result.modifier > 0 ? ` + ${result.modifier}` : ` - ${Math.abs(result.modifier)}`;
    }
    str += ` = ${result.total}`;
  } else {
    str += `${result.total}`;
  }

  if (result.criticalHit) str += ' (Critical Hit!)';
  if (result.criticalMiss) str += ' (Critical Miss!)';
  if (result.advantage) str += ' (Advantage)';
  if (result.disadvantage) str += ' (Disadvantage)';

  return str;
}

/**
 * Check if a roll meets or exceeds a DC
 */
export function meetsOrBeatsDC(result: DiceRollResult, dc: number): boolean {
  return result.total >= dc;
}

/**
 * Check if attack hits AC
 */
export function attackHits(
  result: DiceRollResult,
  targetAC: number
): { hits: boolean; critical: boolean } {
  // Natural 20 always hits, natural 1 always misses
  if (result.criticalHit) return { hits: true, critical: true };
  if (result.criticalMiss) return { hits: false, critical: false };

  return { hits: result.total >= targetAC, critical: false };
}

// ==========================================
// Complex Rolls
// ==========================================

/**
 * Roll multiple dice expressions and sum them
 * e.g., "2d6+1d4+3"
 */
export function rollComplex(notation: string): DiceRollResult {
  const parts = notation.split('+').map(p => p.trim());
  const allRolls: number[] = [];
  let totalModifier = 0;
  let total = 0;

  for (const part of parts) {
    if (part.includes('d')) {
      const result = roll(part);
      allRolls.push(...result.rolls);
      total += result.rolls.reduce((a, b) => a + b, 0);
    } else {
      const mod = parseInt(part, 10);
      if (!isNaN(mod)) {
        totalModifier += mod;
        total += mod;
      }
    }
  }

  return {
    notation,
    rolls: allRolls,
    modifier: totalModifier,
    total,
  };
}

/**
 * Roll with rerolls (e.g., Great Weapon Fighting)
 */
export function rollWithReroll(
  count: number,
  sides: number,
  rerollOn: number[]
): number[] {
  return Array.from({ length: count }, () => {
    let result = rollDie(sides);
    if (rerollOn.includes(result)) {
      result = rollDie(sides); // Reroll once
    }
    return result;
  });
}
