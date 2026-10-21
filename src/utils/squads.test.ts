import { describe, it, expect } from 'vitest';
import {
  standingCount, isStanding, squadMembers, squadStandingCount, squadOf, isHalfStrength, defaultHitTarget,
  splitAreaCount, fallbackSaver, dexModifier, squadInitiativeBonus, placeCommandedSquads, groupBySquad,
  staffableCreatures, toStaffMember, newSquadName, resolveIndividualArea, formatSquadAreaSummary,
} from './squads';
import type { Creature, Squad } from '../types';

const ind = (id: string, currentHp = 10, over: Partial<Creature> = {}) => ({
  id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { name: id, type: 'humanoid', maxHp: 10, ac: 12, abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } },
  ...over,
}) as unknown as Creature;
const stk = (id: string, bodies: number, size = bodies) => ind(id, bodies === 0 ? 0 : 11, { stack: { size, bodies } });
const pc = (id: string) => ind(id, 30, { faction: 'party', statblock: { name: id, type: 'pc', maxHp: 30, ac: 15 } } as Partial<Creature>);
const sq = (memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id: 'S', name: 'Tower Guard', faction: 'enemy', memberIds, startingCount: 0, ...over });

// The tower: captain (leader), Hobgoblin ×8, archers ×4, Karkajuk
const tower = () => [ind('k', 39), stk('h', 8), stk('a', 4), ind('j', 52)];
const towerSquad = (over: Partial<Squad> = {}) => sq(['k', 'h', 'a', 'j'], { leaderId: 'k', startingCount: 14, ...over });

describe('standing count', () => {
  it('a stack counts bodies, an individual counts 1 above 0 HP', () => {
    expect(standingCount(stk('h', 8))).toBe(8);
    expect(standingCount(stk('h', 0, 8))).toBe(0);
    expect(standingCount(ind('k', 39))).toBe(1);
    expect(standingCount(ind('k', 0))).toBe(0);
    expect(isStanding(ind('k', 0))).toBe(false);
  });
  it('sums a squad, in member order, skipping unknown ids', () => {
    const s = sq(['j', 'ghost', 'h']);
    expect(squadMembers(s, tower()).map((c) => c.id)).toEqual(['j', 'h']);
    expect(squadStandingCount(towerSquad(), tower())).toBe(14);
    expect(squadOf('a', [towerSquad()])?.id).toBe('S');
    expect(squadOf('zzz', [towerSquad()])).toBeUndefined();
  });
  it('VVTT rule 4: half strength is at or below half the starting count', () => {
    const hurt = [ind('k', 39), stk('h', 2, 8), stk('a', 3, 4), ind('j', 52)]; // 7 of 14
    expect(isHalfStrength(towerSquad(), hurt)).toBe(true);
    expect(isHalfStrength(towerSquad(), [ind('k', 39), stk('h', 3, 8), stk('a', 3, 4), ind('j', 52)])).toBe(false);
    expect(isHalfStrength(towerSquad({ startingCount: 0 }), hurt)).toBe(false);
  });
});

describe('VVTT rule 1: default hit target', () => {
  it('is the largest standing stack, never the leader', () => {
    expect(defaultHitTarget(towerSquad(), tower())?.id).toBe('h');
  });
  it('breaks ties by member order', () => {
    expect(defaultHitTarget(sq(['a', 'b']), [stk('a', 4), stk('b', 4)])?.id).toBe('a');
  });
  it('falls back to the first standing non-leader, then the leader, then nothing', () => {
    expect(defaultHitTarget(sq(['k', 'j'], { leaderId: 'k' }), [ind('k'), ind('j')])?.id).toBe('j');
    expect(defaultHitTarget(sq(['k', 'j'], { leaderId: 'k' }), [ind('k'), ind('j', 0)])?.id).toBe('k');
    expect(defaultHitTarget(sq(['k']), [ind('k', 0)])).toBeUndefined();
  });
});

describe('VVTT rule 2: area split', () => {
  const caught = (total: number, members: Creature[]) => splitAreaCount(total, members).map((a) => a.caught);
  it('splits in proportion to standing bodies', () => {
    expect(caught(6, [stk('h', 8), stk('a', 4)])).toEqual([4, 2]);
  });
  it('uses the largest remainder, ties to the first member; an individual counts 1', () => {
    expect(caught(4, tower())).toEqual([1, 2, 1, 0]);
    expect(caught(2, [ind('x'), ind('y'), ind('z')])).toEqual([1, 1, 0]);
  });
  it('caps at what is standing and never assigns more than a member has', () => {
    expect(caught(20, tower())).toEqual([1, 8, 4, 1]);
    expect(caught(3, [stk('h', 0, 8), stk('a', 4), ind('j', 0)])).toEqual([0, 3, 0]);
    expect(caught(0, tower())).toEqual([0, 0, 0, 0]);
    expect(splitAreaCount(4, tower()).map((a) => a.memberId)).toEqual(['k', 'h', 'a', 'j']);
  });
});

describe('VVTT rule 3: morale saver without a leader', () => {
  it('is the largest standing stack, never the leader or a PC', () => {
    expect(fallbackSaver(towerSquad(), tower())?.id).toBe('h');
    expect(fallbackSaver(sq(['a', 'b']), [stk('a', 4), stk('b', 4)])?.id).toBe('a');
  });
  it('with no stacks it is the first standing member', () => {
    expect(fallbackSaver(sq(['k', 'p', 'x', 'j'], { leaderId: 'k' }), [ind('k'), pc('p'), ind('x', 0), ind('j')])?.id).toBe('j');
    expect(fallbackSaver(sq(['k'], { leaderId: 'k' }), [ind('k')])).toBeUndefined();
  });
});

describe('VVTT rule 5: squad initiative', () => {
  it('uses the leader DEX modifier, else the first member, else 0', () => {
    expect(dexModifier(ind('k'))).toBe(2);
    const slow = ind('s', 10, { statblock: { name: 's', type: 'humanoid', maxHp: 10, ac: 12, abilities: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 } } } as Partial<Creature>);
    expect(squadInitiativeBonus(sq(['s', 'k'], { leaderId: 'k' }), [slow, ind('k')])).toBe(2);
    expect(squadInitiativeBonus(sq(['s', 'k']), [slow, ind('k')])).toBe(-1);
    expect(squadInitiativeBonus(sq([]), [])).toBe(0);
  });
  it('a commanded squad acts right after its commander', () => {
    const s = sq(['h'], { commanderId: 'p' });
    expect(placeCommandedSquads(['S', 'a', 'p', 'b'], [s], [])).toEqual(['a', 'p', 'S', 'b']);
  });
  it('after the commander\'s vehicle when the commander is crew; unchanged without an anchor or a commander', () => {
    const s = sq(['h'], { commanderId: 'p' });
    const crew = [{ creatureId: 'p', vehicleId: 'v', zoneId: 'helm' }];
    expect(placeCommandedSquads(['S', 'v', 'b'], [s], crew)).toEqual(['v', 'S', 'b']);
    expect(placeCommandedSquads(['a', 'S', 'b'], [s], [])).toEqual(['a', 'S', 'b']);
    expect(placeCommandedSquads(['S', 'p'], [sq(['h'])], [])).toEqual(['S', 'p']);
  });
});

describe('grouping and staffing', () => {
  it('groupBySquad lists standalone creatures first, then each squad in member order', () => {
    const list = [ind('x'), ind('k'), stk('h', 8), ind('y')];
    const groups = groupBySquad(list, [sq(['h', 'k'], { id: 'A' }), sq(['nobody'], { id: 'B' })]);
    expect(groups.map((g) => [g.squad?.id, g.members.map((c) => c.id)])).toEqual([[undefined, ['x', 'y']], ['A', ['h', 'k']]]);
  });
  it('staffableCreatures excludes members, crew and commanders', () => {
    const creatures = [ind('free'), ind('m'), ind('c'), pc('p')];
    const out = staffableCreatures(creatures, [sq(['m'], { commanderId: 'p' })], [{ creatureId: 'c', vehicleId: 'v', zoneId: 'helm' }]);
    expect(out.map((c) => c.id)).toEqual(['free']);
  });
  it('toStaffMember: quantity 1 is an individual, 2+ is one stack', () => {
    const base = ind('h', 11, { name: 'Hobgoblin' });
    expect(toStaffMember(base, 1, [])).toBe(base);
    expect(toStaffMember(base, 8, [])).toMatchObject({ name: 'Hobgoblin ×8 (A)', stack: { size: 8, bodies: 8 } });
  });
  it('newSquadName picks the first free "Squad N"', () => {
    expect(newSquadName([])).toBe('Squad 1');
    expect(newSquadName([sq([], { name: 'Squad 2' }), sq([], { name: 'Tower Guard' })])).toBe('Squad 3');
    expect(newSquadName([sq([], { name: 'Squad 2' })])).toBe('Squad 3');
  });
});

describe('resolveIndividualArea (one save per individual, own bonus, temp HP first)', () => {
  const dice = (...values: number[]) => () => values.shift()!;
  const captain = (over: Partial<Creature> = {}) => ind('k', 39, {
    tempHp: 5,
    statblock: { name: 'k', type: 'humanoid', maxHp: 39, ac: 17, abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 }, savingThrows: { dex: 3 } },
    ...over,
  } as Partial<Creature>);
  const base = { dc: 15, ability: 'dex' as const, damage: 28, halfOnSave: true, damageType: 'fire' };
  it('a save halves the damage; temp HP soaks first', () => {
    expect(resolveIndividualArea({ ...base, creature: captain(), roll: dice(12) })).toEqual({
      save: { d20: 12, total: 15, success: true, taken: 14, fell: false }, currentHp: 30, tempHp: 0,
    });
  });
  it('a failure takes full damage; resistance halves it', () => {
    expect(resolveIndividualArea({ ...base, creature: captain(), roll: dice(2) }).currentHp).toBe(16);
    const resistant = captain({ statblock: { ...captain().statblock, damageResistances: ['fire'] } });
    expect(resolveIndividualArea({ ...base, creature: resistant, roll: dice(2) }).save.taken).toBe(14);
  });
  it('dropping to 0 counts as falling', () => {
    const r = resolveIndividualArea({ ...base, creature: captain({ currentHp: 10, tempHp: 0 }), roll: dice(2) });
    expect(r).toMatchObject({ currentHp: 0, save: { fell: true } });
  });
});

describe('formatSquadAreaSummary', () => {
  it('names the squad and the standing count after the effect', () => {
    expect(formatSquadAreaSummary('Fireball', 'Tower Guard', { caught: 4, failed: 3, fell: 3 }, 11, 14))
      .toBe('Fireball on Tower Guard: 4 caught, 3 failed → 3 fall (11/14 standing)');
    expect(formatSquadAreaSummary('Cone of Cold', 'Tower Guard', { caught: 2, failed: 0, fell: 0 }, 14, 14))
      .toBe('Cone of Cold on Tower Guard: 2 caught, 0 failed → none fall (14/14 standing)');
  });
});
