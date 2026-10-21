import { describe, it, expect } from 'vitest';
import {
  parseDamage, parseActionDamage, parseMultiattackCount, rollGroupAttack,
  adjustForDefenses, formatDamageTotals, formatGroupAttack, formatAttackRolls,
  applyStackHits, aoeTargetCount, aoeAdvice, saveBonus, resolveStackArea, healStack, normalizeStack,
  nextStackName, formatStackHits, formatAreaSummary, damageNotation,
} from './stack';
import type { Creature, Statblock, StatblockAction } from '../types';

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
const squad = (bodies: number, currentHp: number, size = 10, over: Partial<Statblock> = {}) =>
  ({ id: 's', name: 'Hobgoblin ×10 (A)', currentHp, statblock: statblock(over), stack: { size, bodies } }) as unknown as Creature;

describe('applyStackHits (front body only; overkill lost)', () => {
  it('a non-lethal hit wounds the front body', () => {
    expect(applyStackHits(squad(10, 11), [4])).toEqual({ currentHp: 7, bodies: 10, fell: 0 });
  });
  it('an exactly lethal hit drops one body; the next steps up at full HP', () => {
    expect(applyStackHits(squad(10, 7), [7])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('overkill is lost: a 100-damage hit drops one body', () => {
    expect(applyStackHits(squad(10, 11), [100])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('several hits walk through bodies in order; zero hits are ignored', () => {
    // 5 drops body 1 (next at 11); 0 ignored; 4 → 7; 11 drops body 2 (next at 11); 3 → 8
    expect(applyStackHits(squad(3, 5), [5, 0, 4, 11, 3])).toEqual({ currentHp: 8, bodies: 1, fell: 2 });
  });
  it('the last body falls → bodies 0, currentHp 0; extra hits do nothing', () => {
    expect(applyStackHits(squad(1, 3), [3, 9])).toEqual({ currentHp: 0, bodies: 0, fell: 1 });
  });
});

describe('aoeTargetCount (DMG p. 249)', () => {
  it.each([
    ['cone', 15, 2], ['cone', 60, 6], ['cube', 10, 2], ['cube', 12, 3],
    ['cylinder', 10, 2], ['line', 100, 4], ['line', 30, 1], ['sphere', 20, 4], ['sphere', 0, 0],
  ] as const)('%s %i ft → %i', (shape, size, expected) => {
    expect(aoeTargetCount(shape, size)).toBe(expected);
  });
});

describe('aoeTargetCount by edition', () => {
  it('2014 is the default and unchanged', () => {
    expect(aoeTargetCount('sphere', 20)).toBe(4);
    expect(aoeTargetCount('sphere', 20, '2014')).toBe(4);
    expect(aoeTargetCount('line', 100, '2014', 10)).toBe(4);
  });
  it.each([
    ['sphere', 20, 10], ['cylinder', 10, 3], ['cone', 15, 2], ['cone', 20, 2], ['cube', 15, 2],
    ['cube', 10, 1], ['cone', 60, 16], ['cube', 50, 20], ['cone', 33, 5], ['cone', 70, 16], ['cone', 5, 1], ['sphere', 0, 0],
  ] as const)('2024 %s %i ft → %i', (shape, size, expected) => {
    expect(aoeTargetCount(shape, size, '2024')).toBe(expected);
  });
  it('2024 lines use length and width', () => {
    expect(aoeTargetCount('line', 30, '2024', 5)).toBe(2);
    expect(aoeTargetCount('line', 60, '2024', 10)).toBe(5);
    expect(aoeTargetCount('line', 100, '2024', 5)).toBe(4);
    expect(aoeTargetCount('line', 20, '2024', 5)).toBe(1);
    expect(aoeTargetCount('line', 120, '2024', 15)).toBe(10);
    expect(aoeTargetCount('line', 120, '2024')).toBe(5);
  });
  it('aoeAdvice cites each edition', () => {
    expect(aoeAdvice('2014')).toEqual({ citation: 'DMG 2014 p. 249', advice: 'add or remove for how bunched up they are' });
    expect(aoeAdvice('2024')).toEqual({ citation: 'DMG 2024 p. 82', advice: '−1d3 if spread out, +1d3 if bunched up' });
  });
});

describe('saveBonus', () => {
  it('uses the saving throw when listed, else the ability modifier', () => {
    expect(saveBonus(statblock({ savingThrows: { dex: 5 } }), 'dex')).toBe(5);
    expect(saveBonus(statblock(), 'dex')).toBe(1); // DEX 12
    expect(saveBonus(statblock(), 'cha')).toBe(-1); // CHA 9
  });
});

describe('adjustForDefenses with comma-split nonmagical lists', () => {
  const split = statblock({ damageResistances: ['bludgeoning', 'piercing', "and slashing from nonmagical attacks that aren't silvered"] });
  it('applies resistance to nonmagical damage on any fragment', () => {
    expect(adjustForDefenses(9, 'piercing', split)).toBe(4);
  });
  it('skips the resistance for magical damage', () => {
    expect(adjustForDefenses(9, 'piercing', split, true)).toBe(9);
  });
  it('treats a ;-separated clause without the qualifier as always applying', () => {
    const mixed = statblock({ damageResistances: ['cold; bludgeoning', 'piercing', 'and slashing from nonmagical attacks'] });
    expect(adjustForDefenses(9, 'cold', mixed, true)).toBe(4);
    expect(adjustForDefenses(9, 'piercing', mixed, true)).toBe(9);
  });
});

describe('resolveStackArea', () => {
  // DEX 12 → +1. DC 15. 20 damage, half on save.
  const base = { dc: 15, ability: 'dex' as const, damage: 20, halfOnSave: true, damageType: 'fire' };
  it('front body is caught first; failures fall; the lowest damaged survivor becomes the front', () => {
    // 3 caught: front (7 HP) saves 14+1=15 → takes 10 → falls; body 2 rolls 2 → fails, 20 → falls;
    // body 3 rolls 19 → saves, takes 10 → survives at 1.
    const r = resolveStackArea({ ...base, creature: squad(10, 7), caught: 3, roll: dice(14, 2, 19) });
    expect(r.saves.map((s) => [s.success, s.taken, s.fell])).toEqual([[true, 10, true], [false, 20, true], [true, 10, false]]);
    expect(r).toMatchObject({ bodies: 8, fell: 2, currentHp: 1 });
  });
  it('the lowest survivor becomes the front even when a fresh body ends lower than the wounded front', () => {
    // 6 damage, half on save. Front at 10 HP rolls 14 (+1 = 15, saves) → takes 3 → 7.
    // Body 2 rolls 1 (+1 = 2, fails) → takes 6 from 11 → 5. Body 3 rolls 19 (saves) → takes 3 from 11 → 8.
    // Lowest survivor = 5, nobody falls.
    const r = resolveStackArea({ ...base, damage: 6, creature: squad(10, 10), caught: 3, roll: dice(14, 1, 19) });
    expect(r.saves.map((s) => s.taken)).toEqual([3, 6, 3]);
    expect(r).toMatchObject({ bodies: 10, fell: 0, currentHp: 5 });
  });
  it('when every caught body falls, the next uncaught body is at full HP', () => {
    const r = resolveStackArea({ ...base, creature: squad(5, 11), caught: 2, roll: dice(3, 4) });
    expect(r).toMatchObject({ bodies: 3, fell: 2, currentHp: 11 });
  });
  it('resistance applies to each body, after halving', () => {
    const r = resolveStackArea({ ...base, creature: squad(2, 11, 10, { damageResistances: ['fire'] }), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(5); // 20 → 10 (save) → 5 (resist)
    expect(r.currentHp).toBe(6);
  });
  it('caught is capped at the bodies left', () => {
    const r = resolveStackArea({ ...base, creature: squad(2, 11), caught: 6, roll: dice(1, 1) });
    expect(r.saves).toHaveLength(2);
    expect(r).toMatchObject({ bodies: 0, currentHp: 0, fell: 2 });
  });
  it('no damage on a save when halfOnSave is off', () => {
    const r = resolveStackArea({ ...base, halfOnSave: false, creature: squad(2, 11), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(0);
    expect(r.currentHp).toBe(11);
  });
});

describe('healStack (never revives)', () => {
  it('caps the front body at max HP', () => {
    expect(healStack(squad(4, 6), 20)).toBe(11);
  });
  it('does nothing at 0 bodies', () => {
    expect(healStack(squad(0, 0), 5)).toBe(0);
  });
});

describe('normalizeStack', () => {
  it('0 bodies forces 0 HP', () => {
    expect(normalizeStack(squad(3, 5), squad(0, 5))).toEqual({ currentHp: 0, stack: { size: 10, bodies: 0 } });
  });
  it('raising bodies from 0 restores the front body to full HP', () => {
    expect(normalizeStack(squad(0, 0), squad(4, 0))).toEqual({ currentHp: 11, stack: { size: 10, bodies: 4 } });
  });
  it('HP set to 0 with bodies left means the front body fell', () => {
    expect(normalizeStack(squad(4, 6), squad(4, 0))).toEqual({ currentHp: 11, stack: { size: 10, bodies: 3 } });
    expect(normalizeStack(squad(1, 6), squad(1, 0))).toEqual({ currentHp: 0, stack: { size: 10, bodies: 0 } });
  });
  it('clamps bodies to 0..size and HP to max', () => {
    expect(normalizeStack(squad(4, 6), squad(14, 40))).toEqual({ currentHp: 11, stack: { size: 10, bodies: 10 } });
  });
  it('leaves a consistent squad unchanged, and passes non-squads through', () => {
    expect(normalizeStack(squad(4, 6), squad(4, 6))).toEqual({ currentHp: 6, stack: { size: 10, bodies: 4 } });
    const solo = { currentHp: 3, statblock: statblock() } as unknown as Creature;
    expect(normalizeStack(solo, solo)).toEqual({ currentHp: 3, stack: undefined });
  });
});

describe('naming and log text', () => {
  it('nextStackName lettering counts existing squads of the same monster', () => {
    const existing = [squad(10, 11), { name: 'Hobgoblin 3' } as Creature, { name: 'Hobgoblin ×5 (B)', stack: { size: 5, bodies: 5 } } as Creature];
    expect(nextStackName('Hobgoblin', 8, [])).toBe('Hobgoblin ×8 (A)');
    expect(nextStackName('Hobgoblin', 8, existing)).toBe('Hobgoblin ×8 (C)');
  });
  it('formatStackHits', () => {
    expect(formatStackHits('Hob (A)', 3, 2, 8, 10)).toBe('Hob (A) takes 3 hits: 2 fall (8/10)');
    expect(formatStackHits('Hob (A)', 1, 0, 8, 10)).toBe('Hob (A) takes 1 hit: none fall (8/10)');
    expect(formatStackHits('Hob (A)', 2, 1, 0, 10)).toBe('Hob (A) takes 2 hits: 1 fall (0/10) — squad destroyed');
  });
  it('formatAreaSummary', () => {
    const r = resolveStackArea({ creature: squad(10, 11), caught: 4, dc: 15, ability: 'dex', damage: 28, halfOnSave: true, damageType: 'fire', roll: dice(2, 3, 4, 20) });
    expect(formatAreaSummary('Fireball', r, 10)).toBe('Fireball: 4 caught, 3 failed → 4 fall (6/10)');
  });
});

describe('damageNotation', () => {
  it('accepts integers and dice, normalising whitespace and case', () => {
    expect(damageNotation('28')).toBe('28');
    expect(damageNotation('8d6')).toBe('8d6');
    expect(damageNotation(' 8d6 + 5 ')).toBe('8d6+5');
    expect(damageNotation('2D6-1')).toBe('2d6-1');
    expect(damageNotation('d20')).toBe('d20');
  });
  it('rejects anything roll() would throw on', () => {
    expect(damageNotation('8d6+')).toBeNull();
    expect(damageNotation('8d6 fire')).toBeNull();
    expect(damageNotation('')).toBeNull();
  });
});

describe('normalizeStack leaderId', () => {
  it('keeps leaderId', () => {
    const prev = squad(10, 11);
    const next = { ...prev, stack: { size: 10, bodies: 10, leaderId: 'k' } } as Creature;
    expect(normalizeStack(prev, next).stack).toEqual({ size: 10, bodies: 10, leaderId: 'k' });
  });
});
