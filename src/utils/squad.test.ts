import { describe, it, expect } from 'vitest';
import {
  parseDamage, parseActionDamage, parseMultiattackCount, rollGroupAttack,
  adjustForDefenses, formatDamageTotals, formatGroupAttack, formatAttackRolls,
  applySquadHits, aoeTargetCount, saveBonus, resolveSquadArea, healSquad, normalizeSquad,
  nextSquadName, formatSquadHits, formatAreaSummary, damageNotation,
} from './squad';
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
  ({ id: 's', name: 'Hobgoblin ×10 (A)', currentHp, statblock: statblock(over), squad: { size, bodies } }) as unknown as Creature;

describe('applySquadHits (front body only; overkill lost)', () => {
  it('a non-lethal hit wounds the front body', () => {
    expect(applySquadHits(squad(10, 11), [4])).toEqual({ currentHp: 7, bodies: 10, fell: 0 });
  });
  it('an exactly lethal hit drops one body; the next steps up at full HP', () => {
    expect(applySquadHits(squad(10, 7), [7])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('overkill is lost: a 100-damage hit drops one body', () => {
    expect(applySquadHits(squad(10, 11), [100])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('several hits walk through bodies in order; zero hits are ignored', () => {
    // 5 drops body 1 (next at 11); 0 ignored; 4 → 7; 11 drops body 2 (next at 11); 3 → 8
    expect(applySquadHits(squad(3, 5), [5, 0, 4, 11, 3])).toEqual({ currentHp: 8, bodies: 1, fell: 2 });
  });
  it('the last body falls → bodies 0, currentHp 0; extra hits do nothing', () => {
    expect(applySquadHits(squad(1, 3), [3, 9])).toEqual({ currentHp: 0, bodies: 0, fell: 1 });
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

describe('saveBonus', () => {
  it('uses the saving throw when listed, else the ability modifier', () => {
    expect(saveBonus(statblock({ savingThrows: { dex: 5 } }), 'dex')).toBe(5);
    expect(saveBonus(statblock(), 'dex')).toBe(1); // DEX 12
    expect(saveBonus(statblock(), 'cha')).toBe(-1); // CHA 9
  });
});

describe('resolveSquadArea', () => {
  // DEX 12 → +1. DC 15. 20 damage, half on save.
  const base = { dc: 15, ability: 'dex' as const, damage: 20, halfOnSave: true, damageType: 'fire' };
  it('front body is caught first; failures fall; the lowest damaged survivor becomes the front', () => {
    // 3 caught: front (7 HP) saves 14+1=15 → takes 10 → falls; body 2 rolls 2 → fails, 20 → falls;
    // body 3 rolls 19 → saves, takes 10 → survives at 1.
    const r = resolveSquadArea({ ...base, creature: squad(10, 7), caught: 3, roll: dice(14, 2, 19) });
    expect(r.saves.map((s) => [s.success, s.taken, s.fell])).toEqual([[true, 10, true], [false, 20, true], [true, 10, false]]);
    expect(r).toMatchObject({ bodies: 8, fell: 2, currentHp: 1 });
  });
  it('when every caught body falls, the next uncaught body is at full HP', () => {
    const r = resolveSquadArea({ ...base, creature: squad(5, 11), caught: 2, roll: dice(3, 4) });
    expect(r).toMatchObject({ bodies: 3, fell: 2, currentHp: 11 });
  });
  it('resistance applies to each body, after halving', () => {
    const r = resolveSquadArea({ ...base, creature: squad(2, 11, 10, { damageResistances: ['fire'] }), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(5); // 20 → 10 (save) → 5 (resist)
    expect(r.currentHp).toBe(6);
  });
  it('caught is capped at the bodies left', () => {
    const r = resolveSquadArea({ ...base, creature: squad(2, 11), caught: 6, roll: dice(1, 1) });
    expect(r.saves).toHaveLength(2);
    expect(r).toMatchObject({ bodies: 0, currentHp: 0, fell: 2 });
  });
  it('no damage on a save when halfOnSave is off', () => {
    const r = resolveSquadArea({ ...base, halfOnSave: false, creature: squad(2, 11), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(0);
    expect(r.currentHp).toBe(11);
  });
});

describe('healSquad (never revives)', () => {
  it('caps the front body at max HP', () => {
    expect(healSquad(squad(4, 6), 20)).toBe(11);
  });
  it('does nothing at 0 bodies', () => {
    expect(healSquad(squad(0, 0), 5)).toBe(0);
  });
});

describe('normalizeSquad', () => {
  it('0 bodies forces 0 HP', () => {
    expect(normalizeSquad(squad(3, 5), squad(0, 5))).toEqual({ currentHp: 0, squad: { size: 10, bodies: 0 } });
  });
  it('raising bodies from 0 restores the front body to full HP', () => {
    expect(normalizeSquad(squad(0, 0), squad(4, 0))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 4 } });
  });
  it('HP set to 0 with bodies left means the front body fell', () => {
    expect(normalizeSquad(squad(4, 6), squad(4, 0))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 3 } });
    expect(normalizeSquad(squad(1, 6), squad(1, 0))).toEqual({ currentHp: 0, squad: { size: 10, bodies: 0 } });
  });
  it('clamps bodies to 0..size and HP to max', () => {
    expect(normalizeSquad(squad(4, 6), squad(14, 40))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 10 } });
  });
  it('leaves a consistent squad unchanged, and passes non-squads through', () => {
    expect(normalizeSquad(squad(4, 6), squad(4, 6))).toEqual({ currentHp: 6, squad: { size: 10, bodies: 4 } });
    const solo = { currentHp: 3, statblock: statblock() } as unknown as Creature;
    expect(normalizeSquad(solo, solo)).toEqual({ currentHp: 3, squad: undefined });
  });
});

describe('naming and log text', () => {
  it('nextSquadName lettering counts existing squads of the same monster', () => {
    const existing = [squad(10, 11), { name: 'Hobgoblin 3' } as Creature, { name: 'Hobgoblin ×5 (B)', squad: { size: 5, bodies: 5 } } as Creature];
    expect(nextSquadName('Hobgoblin', 8, [])).toBe('Hobgoblin ×8 (A)');
    expect(nextSquadName('Hobgoblin', 8, existing)).toBe('Hobgoblin ×8 (C)');
  });
  it('formatSquadHits', () => {
    expect(formatSquadHits('Hob (A)', 3, 2, 8, 10)).toBe('Hob (A) takes 3 hits: 2 fall (8/10)');
    expect(formatSquadHits('Hob (A)', 1, 0, 8, 10)).toBe('Hob (A) takes 1 hit: none fall (8/10)');
    expect(formatSquadHits('Hob (A)', 2, 1, 0, 10)).toBe('Hob (A) takes 2 hits: 1 fall (0/10) — squad destroyed');
  });
  it('formatAreaSummary', () => {
    const r = resolveSquadArea({ creature: squad(10, 11), caught: 4, dc: 15, ability: 'dex', damage: 28, halfOnSave: true, damageType: 'fire', roll: dice(2, 3, 4, 20) });
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
