import { describe, it, expect } from 'vitest';
import { detectMoraleTriggers, moraleSaver, squadMoraleSaver, rollMorale, formatMoraleLog, moraleTriggerText } from './morale';
import type { CombatState, Creature, MoralePrompt, Squad } from '../types';

const dice = (...values: number[]) => {
  const queue = [...values];
  return () => {
    if (queue.length === 0) throw new Error('out of dice');
    return queue.shift()!;
  };
};
let counter = 0;
const newId = () => `p${++counter}`;

const npc = (id: string, currentHp: number, over: Partial<Creature> = {}, maxHp = 30) => ({
  id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { type: 'humanoid', maxHp, ac: 12, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } },
  ...over,
}) as unknown as Creature;
const stackOf = (id: string, bodies: number, size = 10, over: Partial<Creature> = {}) =>
  npc(id, bodies === 0 ? 0 : 11, { stack: { size, bodies }, ...over }, 11);
const pcOf = (id: string, currentHp: number) => {
  const base = npc(id, currentHp);
  return { ...base, statblock: { ...base.statblock, type: 'pc' } } as Creature;
};
const sq = (memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id: 'S', name: 'Tower Guard', faction: 'enemy', memberIds, startingCount: 14, ...over });
const st = (creatures: Creature[], squads: Squad[] = [], phase = 'combat', moralePrompts: MoralePrompt[] = []) =>
  ({ phase, creatures, squads, moralePrompts }) as unknown as CombatState;
const detect = (before: Creature[], after: Creature[], squadsBefore: Squad[] = [], squadsAfter: Squad[] = squadsBefore, phase = 'combat') =>
  detectMoraleTriggers(st(before, squadsBefore, phase), st(after, squadsAfter, phase), newId);
const triggers = (r: { prompts: MoralePrompt[] }) => r.prompts.map((p) => [p.squadId ?? p.creatureId, p.trigger]);
const withId = (list: Creature[], id: string, replacement: Creature) => list.map((c) => (c.id === id ? replacement : c));

// The tower: captain k (leader), Hobgoblin ×8, archers ×4, Karkajuk j; 14 standing
const tower = () => [npc('k', 30), stackOf('h', 8, 8), stackOf('a', 4, 4), npc('j', 60, {}, 60)];
const guard = (over: Partial<Squad> = {}) => sq(['k', 'h', 'a', 'j'], { leaderId: 'k', ...over });

describe('squad morale: leader down', () => {
  it('the leader dropping to 0 HP prompts the squad once', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 0));
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
    expect(r.prompts[0].creatureId).toBeUndefined();
    expect(r.squads[0].morale?.asked).toEqual(['leader-down']);
    expect(r.creatures).toBe(after);
    // healed, then dropped again: no second prompt
    expect(detect(withId(after, 'k', npc('k', 10)), after, r.squads).prompts).toEqual([]);
  });
  it('the leader becoming stunned prompts the squad', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 30, { conditions: [{ name: 'stunned' }] } as Partial<Creature>));
    expect(triggers(detect(before, after, [guard()]))).toEqual([['S', 'leader-down']]);
  });
  it('removing the leader is not a morale trigger', () => {
    const before = tower();
    const after = before.filter((c) => c.id !== 'k');
    expect(detect(before, after, [guard()], [sq(['h', 'a', 'j'], { startingCount: 13 })]).prompts).toEqual([]);
  });
});

describe('squad morale: half strength (VVTT rule 4)', () => {
  it('crossing to at or below half the starting count prompts once', () => {
    const before = tower();
    const after = withId(withId(before, 'h', stackOf('h', 2, 8)), 'a', stackOf('a', 2, 4)); // 1 + 2 + 2 + 1 = 6 of 14
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'half-size']]);
    expect(detect(before, after, r.squads).prompts).toEqual([]);
  });
  it('a membership change never prompts', () => {
    const before = tower();
    const after = withId(before, 'h', stackOf('h', 0, 8));
    expect(detect(before, after, [guard()], [sq(['k', 'a', 'j'], { leaderId: 'k' })]).prompts).toEqual([]);
  });
  it('leader-down outranks half-size; both are recorded', () => {
    const before = tower();
    const after = withId(withId(before, 'k', npc('k', 0)), 'h', stackOf('h', 1, 8)); // 0 + 1 + 4 + 1 = 6
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'leader-down']]);
    expect(r.squads[0].morale?.asked).toEqual(['leader-down', 'half-size']);
  });
});

describe('squad morale: who is prompted', () => {
  it('members never raise their own prompts', () => {
    const before = tower();
    const after = withId(before, 'j', npc('j', 20, {}, 60));
    expect(detect(before, after, [guard()]).prompts).toEqual([]);
  });
  it('a former member falls back to half-hp', () => {
    const squads = [sq(['k', 'h', 'a'], { leaderId: 'k', startingCount: 13 })];
    const before = tower();
    const after = withId(before, 'j', npc('j', 20, {}, 60));
    expect(triggers(detect(before, after, squads))).toEqual([['j', 'half-hp']]);
  });
  it('a PC-only squad never prompts; a party squad with NPC members does', () => {
    expect(detect([pcOf('p', 30)], [pcOf('p', 0)], [sq(['p'], { faction: 'party', startingCount: 1 })]).prompts).toEqual([]);
    const party = [sq(['p', 'h'], { faction: 'party', startingCount: 9 })];
    expect(triggers(detect([pcOf('p', 30), stackOf('h', 8, 8)], [pcOf('p', 30), stackOf('h', 3, 8)], party))).toEqual([['S', 'half-size']]);
  });
  it('nothing outside combat, for a broken squad, or with an open squad prompt', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 0));
    expect(detect(before, after, [guard()], [guard()], 'setup').prompts).toEqual([]);
    expect(detect(before, after, [guard({ morale: { status: 'fleeing', asked: [] } })]).prompts).toEqual([]);
    const open = [{ id: 'm1', squadId: 'S', trigger: 'manual' }] as MoralePrompt[];
    expect(detectMoraleTriggers(st(before, [guard()]), st(after, [guard()], 'combat', open), newId).prompts).toEqual([]);
  });
  it('returns the same arrays when nothing fires', () => {
    const squads = [guard()];
    const after = tower();
    const r = detect(tower(), after, squads);
    expect(r.creatures).toBe(after);
    expect(r.squads).toBe(squads);
  });
});

describe('standalone creatures (unchanged rules)', () => {
  it('a standalone stack crossing half its size is prompted once; a wipe straight to 0 is not', () => {
    const r = detect([stackOf('a', 6)], [stackOf('a', 5)]);
    expect(triggers(r)).toEqual([['a', 'half-size']]);
    expect(detect([{ ...r.creatures[0], stack: { size: 10, bodies: 6 } }], r.creatures).prompts).toEqual([]);
    expect(detect([stackOf('b', 6)], [stackOf('b', 0)]).prompts).toEqual([]);
  });
  it('a single NPC crossing half HP is prompted; not PCs, stacks, or a drop to 0', () => {
    expect(triggers(detect([npc('x', 30)], [npc('x', 15)]))).toEqual([['x', 'half-hp']]);
    expect(detect([npc('x', 30)], [npc('x', 16)]).prompts).toEqual([]);
    expect(detect([pcOf('p', 30)], [pcOf('p', 10)]).prompts).toEqual([]);
    expect(detect([stackOf('a', 10)], [{ ...stackOf('a', 10), currentHp: 5 }]).prompts).toEqual([]);
    expect(detect([npc('x', 30)], [npc('x', 0)]).prompts).toEqual([]);
  });
  it('a creature with an open prompt gets no automatic prompt', () => {
    const open = [{ id: 'm1', creatureId: 'x', trigger: 'manual' }] as MoralePrompt[];
    const r = detectMoraleTriggers(st([npc('x', 30)]), st([npc('x', 10)], [], 'combat', open), newId);
    expect(r.prompts).toEqual([]);
    expect(r.creatures[0].morale).toBeUndefined();
  });
});

describe('savers', () => {
  const wise = (c: Creature) => ({ ...c, statblock: { ...c.statblock, savingThrows: { wis: 4 } } }) as Creature;
  it('a squad uses its standing leader', () => {
    const r = squadMoraleSaver(guard(), withId(tower(), 'k', wise(npc('k', 30))));
    expect(r).toMatchObject({ bonus: 4, usingLeader: true });
    expect(r?.saver.id).toBe('k');
  });
  it('VVTT rule 3: with the leader down, the largest standing stack saves', () => {
    const r = squadMoraleSaver(guard(), withId(tower(), 'k', npc('k', 0)));
    expect(r).toMatchObject({ bonus: 2, usingLeader: false });
    expect(r?.saver.id).toBe('h');
    expect(squadMoraleSaver(sq(['k'], { leaderId: 'k' }), [npc('k', 0)])).toBeUndefined();
  });
  it('a PC leader never saves: falls back to VVTT rule 3', () => {
    const creatures = [pcOf('k', 30), stackOf('h', 8, 8), npc('j', 60, {}, 60)];
    const r = squadMoraleSaver(sq(['k', 'h', 'j'], { leaderId: 'k' }), creatures);
    expect(r).toMatchObject({ usingLeader: false });
    expect(r?.saver.id).toBe('h');
  });
  it('a standalone creature saves for itself', () => {
    expect(moraleSaver(npc('x', 10))).toMatchObject({ bonus: 2 });
  });
});

describe('rollMorale (DC 10)', () => {
  it('disadvantage keeps the lower die', () => {
    expect(rollMorale({ bonus: 1, disadvantage: true, roll: dice(15, 8) })).toEqual({ d20s: [15, 8], d20: 8, total: 9, success: false });
  });
  it('a total of 10 succeeds', () => {
    expect(rollMorale({ bonus: 0, disadvantage: false, roll: dice(10) })).toEqual({ d20s: [10], d20: 10, total: 10, success: true });
  });
});

describe('morale text', () => {
  it('formatMoraleLog', () => {
    expect(formatMoraleLog('Hob (A)', 'k is down', { kind: 'roll', saverName: 'k', bonus: 4, d20s: [3], d20: 3, total: 7, success: false }))
      .toBe('Hob (A) — morale (k is down): k WIS 3 + 4 = 7 vs DC 10 → flees');
    expect(formatMoraleLog('x', 'Below half HP', { kind: 'roll', saverName: 'x', bonus: -1, d20s: [15, 12], d20: 12, total: 11, success: true }))
      .toBe('x — morale (Below half HP): x WIS 12 (disadvantage: 15, 12) − 1 = 11 vs DC 10 → holds');
    expect(formatMoraleLog('Hob (A)', 'Morale check', { kind: 'auto' }))
      .toBe('Hob (A) — morale (Morale check): fails automatically (overwhelming opposition) → flees');
  });
  it('moraleTriggerText', () => {
    const p = (trigger: MoralePrompt['trigger'], leaderName?: string): MoralePrompt => ({ id: '1', squadId: 'S', trigger, leaderName });
    expect(moraleTriggerText(p('leader-down', 'k'))).toBe('k is down');
    expect(moraleTriggerText(p('half-size'), { standing: 6, starting: 14 })).toBe('Down to half strength (6/14)');
    expect(moraleTriggerText(p('half-hp'))).toBe('Below half HP');
    expect(moraleTriggerText(p('manual'))).toBe('Morale check');
  });
});
