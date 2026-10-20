import { describe, it, expect } from 'vitest';
import {
  parseDamage, parseActionDamage, parseMultiattackCount, rollGroupAttack,
  adjustForDefenses, formatDamageTotals, formatGroupAttack, formatAttackRolls,
} from './squad';
import type { Statblock, StatblockAction } from '../types';

/** Scripted dice: returns the given values in order and throws if it runs out. */
const dice = (...values: number[]) => {
  const queue = [...values];
  return () => {
    if (queue.length === 0) throw new Error('out of dice');
    return queue.shift()!;
  };
};

const statblock = (over: Partial<Statblock> = {}) =>
  ({ name: 'Hobgoblin', ac: 18, maxHp: 11, abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 }, actions: [], ...over }) as unknown as Statblock;

describe('parseDamage', () => {
  it('parses a single typed part', () => {
    expect(parseDamage('2d6+4 slashing')).toEqual([{ count: 2, sides: 6, bonus: 4, type: 'slashing' }]);
  });
  it('parses spaces, a negative bonus and a "plus" rider', () => {
    expect(parseDamage('1d8 - 1 piercing plus 2d6 fire')).toEqual([
      { count: 1, sides: 8, bonus: -1, type: 'piercing' },
      { count: 2, sides: 6, bonus: 0, type: 'fire' },
    ]);
  });
  it('leaves the type empty when the word is not a damage type', () => {
    expect(parseDamage('1d8+1 plus stuff')).toEqual([{ count: 1, sides: 8, bonus: 1, type: '' }]);
  });
  it('returns [] for text with no dice', () => {
    expect(parseDamage('1 piercing')).toEqual([]);
  });
});

describe('parseActionDamage', () => {
  const action = (description: string, damage?: string) => ({ name: 'Longsword', description, damage }) as StatblockAction;
  it('reads the Hit: clause, takes the first versatile option, and keeps types', () => {
    const a = action('Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.', '1d8+1');
    expect(parseActionDamage(a)).toEqual([{ count: 1, sides: 8, bonus: 1, type: 'slashing' }]);
  });
  it('reads a "plus" rider from the description', () => {
    const a = action('Hit: 10 (2d6 + 3) piercing damage plus 7 (2d6) fire damage.');
    expect(parseActionDamage(a)).toEqual([
      { count: 2, sides: 6, bonus: 3, type: 'piercing' },
      { count: 2, sides: 6, bonus: 0, type: 'fire' },
    ]);
  });
  it('falls back to the damage field (untyped Open5e dice)', () => {
    expect(parseActionDamage(action('Some text without a hit clause.', '1d6+2'))).toEqual([{ count: 1, sides: 6, bonus: 2, type: '' }]);
  });
  it('returns [] when nothing parses', () => {
    expect(parseActionDamage(action('Nothing here.'))).toEqual([]);
  });
});

describe('parseMultiattackCount', () => {
  const withMulti = (description: string) => statblock({ actions: [{ name: 'Multiattack', description }] as StatblockAction[] });
  it('reads number words', () => {
    expect(parseMultiattackCount(withMulti('The devil makes three melee attacks.'))).toBe(3);
    expect(parseMultiattackCount(withMulti('The orc makes two attacks with its greataxe.'))).toBe(2);
  });
  it('defaults to 1 with no Multiattack', () => {
    expect(parseMultiattackCount(statblock())).toBe(1);
  });
});

describe('rollGroupAttack', () => {
  const longsword = [{ count: 1, sides: 8, bonus: 1, type: 'slashing' }];
  it('a natural 1 misses even when the total meets AC', () => {
    const r = rollGroupAttack({ attackBonus: 20, ac: 10, damage: longsword, attacks: 1, roll: dice(1) });
    expect(r.hits).toBe(0);
    expect(r.rolls[0]).toEqual({ d20: 1, total: 21, hit: false, crit: false, damage: [] });
  });
  it('a natural 20 hits and crits below AC; crit doubles dice, not the bonus', () => {
    const r = rollGroupAttack({ attackBonus: 0, ac: 30, damage: longsword, attacks: 1, roll: dice(20, 5, 7) });
    expect(r.hits).toBe(1);
    expect(r.crits).toBe(1);
    expect(r.rolls[0].damage).toEqual([{ type: 'slashing', amount: 13 }]); // 5 + 7 + 1
  });
  it('rolls each attack in order and totals per damage type', () => {
    // attack 1: d20 15 (+3 = 18 vs 16) hit, 1d8 → 4; attack 2: d20 10 (13) miss; attack 3: d20 13 (16) hit, 1d8 → 8
    const r = rollGroupAttack({ attackBonus: 3, ac: 16, damage: longsword, attacks: 3, roll: dice(15, 4, 10, 13, 8) });
    expect(r.hits).toBe(2);
    expect(r.totalByType).toEqual({ slashing: 14 });
    expect(r.total).toBe(14);
  });
  it('damage never goes below 0 per part', () => {
    const r = rollGroupAttack({ attackBonus: 5, ac: 10, damage: [{ count: 1, sides: 4, bonus: -3, type: '' }], attacks: 1, roll: dice(15, 1) });
    expect(r.rolls[0].damage).toEqual([{ type: '', amount: 0 }]);
  });
});

describe('adjustForDefenses', () => {
  it('resistance halves rounding down, case-insensitive', () => {
    expect(adjustForDefenses(9, 'fire', statblock({ damageResistances: ['Fire'] }))).toBe(4);
  });
  it('immunity gives 0; vulnerability doubles', () => {
    expect(adjustForDefenses(9, 'poison', statblock({ damageImmunities: ['poison'] }))).toBe(0);
    expect(adjustForDefenses(9, 'cold', statblock({ damageVulnerabilities: ['cold'] }))).toBe(18);
  });
  it('untyped damage is unchanged', () => {
    expect(adjustForDefenses(9, '', statblock({ damageResistances: ['fire'] }))).toBe(9);
  });
  it('"nonmagical" resistance applies unless the attack is magical', () => {
    const devil = statblock({ damageResistances: ["bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"] });
    expect(adjustForDefenses(9, 'slashing', devil)).toBe(4);
    expect(adjustForDefenses(9, 'slashing', devil, true)).toBe(9);
  });
});

describe('log text', () => {
  const result = rollGroupAttack({ attackBonus: 3, ac: 16, damage: [{ count: 1, sides: 8, bonus: 1, type: 'slashing' }], attacks: 3, roll: dice(20, 4, 2, 10, 1) });
  it('formatDamageTotals joins types and omits an empty type label', () => {
    expect(formatDamageTotals({ slashing: 38, fire: 12 })).toBe('38 slashing + 12 fire');
    expect(formatDamageTotals({ '': 7 })).toBe('7');
  });
  it('formatGroupAttack summarises', () => {
    // attack 1: nat 20 crit, 2d8 → 4 + 2 + 1 = 7; attack 2: 10 + 3 = 13 miss; attack 3: nat 1 miss
    expect(formatGroupAttack({ attackerName: 'Hobgoblin ×10 (A)', actionName: 'Longsword', ac: 16, result }))
      .toBe('Hobgoblin ×10 (A) — Longsword: 3 attacks vs AC 16 → 1 hit (1 crit) → 7 slashing');
  });
  it('formatGroupAttack with no hits', () => {
    const miss = rollGroupAttack({ attackBonus: 0, ac: 30, damage: [], attacks: 1, roll: dice(2) });
    expect(formatGroupAttack({ attackerName: 'A', actionName: 'Bite', ac: 30, result: miss })).toBe('A — Bite: 1 attack vs AC 30 → no hits');
  });
  it('formatAttackRolls lists each roll', () => {
    expect(formatAttackRolls(result)).toBe('20 crit: 7 slashing; 10 (13) miss; 1 miss');
  });
});
