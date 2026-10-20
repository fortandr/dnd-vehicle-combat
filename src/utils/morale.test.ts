import { describe, it, expect } from 'vitest';
import { detectMoraleTriggers, moraleSaver, rollMorale, formatMoraleLog, moraleTriggerText } from './morale';
import type { CombatState, Creature, MoralePrompt } from '../types';

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
const squadOf = (id: string, bodies: number, leaderId?: string, over: Partial<Creature> = {}) =>
  npc(id, 11, { squad: { size: 10, bodies, leaderId }, ...over }, 11);
const pcOf = (id: string, currentHp: number) => {
  const base = npc(id, currentHp);
  return { ...base, statblock: { ...base.statblock, type: 'pc' } } as Creature;
};
const st = (creatures: Creature[], phase = 'combat', moralePrompts: MoralePrompt[] = []) => ({ phase, creatures, moralePrompts }) as unknown as CombatState;
const detect = (before: Creature[], after: Creature[], phase = 'combat') =>
  detectMoraleTriggers(st(before, phase), st(after, phase), newId);
const triggers = (r: { prompts: MoralePrompt[] }) => r.prompts.map((p) => [p.creatureId, p.trigger]);
const withId = (list: Creature[], id: string, replacement: Creature) => list.map((c) => (c.id === id ? replacement : c));

describe('detectMoraleTriggers: leader down', () => {
  it('a leader dropping to 0 HP prompts each squad it leads, once', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k'), squadOf('b', 10, 'k'), squadOf('c', 10)];
    const after = withId(before, 'k', npc('k', 0));
    const r = detect(before, after);
    expect(triggers(r)).toEqual([['a', 'leader-down'], ['b', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
    expect(r.creatures.find((c) => c.id === 'a')!.morale!.asked).toEqual(['leader-down']);
    // healed, then dropped again: no second prompt
    const again = detect(withId(r.creatures, 'k', npc('k', 10)), r.creatures);
    expect(again.prompts).toEqual([]);
  });
  it('a leader becoming stunned prompts its squads', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k')];
    const after = withId(before, 'k', npc('k', 30, { conditions: [{ name: 'stunned' }] } as Partial<Creature>));
    expect(triggers(detect(before, after))).toEqual([['a', 'leader-down']]);
  });
  it('a leader removed from the encounter prompts its squads', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k')];
    const r = detect(before, [squadOf('a', 10, 'k')]);
    expect(triggers(r)).toEqual([['a', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
  });
});

describe('detectMoraleTriggers: half size and half HP', () => {
  it('a squad crossing half strength is prompted once; a wipe straight to 0 is not', () => {
    const r = detect([squadOf('a', 6)], [squadOf('a', 5)]);
    expect(triggers(r)).toEqual([['a', 'half-size']]);
    const asked = r.creatures[0];
    expect(detect([{ ...asked, squad: { size: 10, bodies: 6 } }], [asked]).prompts).toEqual([]);
    expect(detect([squadOf('b', 6)], [{ ...squadOf('b', 0), currentHp: 0 }]).prompts).toEqual([]);
  });
  it('a single NPC crossing half HP is prompted; not PCs, squads, or a drop to 0', () => {
    expect(triggers(detect([npc('x', 30)], [npc('x', 15)]))).toEqual([['x', 'half-hp']]);
    expect(detect([npc('x', 30)], [npc('x', 16)]).prompts).toEqual([]);
    expect(detect([pcOf('p', 30)], [pcOf('p', 10)]).prompts).toEqual([]);
    expect(detect([squadOf('a', 10)], [{ ...squadOf('a', 10), currentHp: 5 }]).prompts).toEqual([]);
    expect(detect([npc('x', 30)], [npc('x', 0)]).prompts).toEqual([]);
  });
  it('nothing outside combat, and nothing for creatures already broken', () => {
    expect(detect([npc('x', 30)], [npc('x', 15)], 'setup').prompts).toEqual([]);
    const fleeing = { morale: { status: 'fleeing' as const, asked: [] } };
    expect(detect([npc('x', 30, fleeing)], [npc('x', 15, fleeing)]).prompts).toEqual([]);
  });
  it('returns the same creatures array when nothing fires', () => {
    const after = [npc('x', 20)];
    expect(detect([npc('x', 25)], after).creatures).toBe(after);
  });
});

describe('moraleSaver', () => {
  const leader = (hp: number) => {
    const k = npc('k', hp);
    return { ...k, statblock: { ...k.statblock, savingThrows: { wis: 4 } } } as Creature;
  };
  it('uses the leader when standing', () => {
    const r = moraleSaver(squadOf('a', 10, 'k'), [leader(30)]);
    expect(r).toMatchObject({ bonus: 4, usingLeader: true });
    expect(r.saver.id).toBe('k');
  });
  it('falls back to the squad when the leader is down or absent', () => {
    expect(moraleSaver(squadOf('a', 10, 'k'), [leader(0)])).toMatchObject({ bonus: 2, usingLeader: false });
    expect(moraleSaver(squadOf('a', 10), []).saver.id).toBe('a');
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
    const p = (trigger: MoralePrompt['trigger'], leaderName?: string) => ({ id: '1', creatureId: 'a', trigger, leaderName });
    expect(moraleTriggerText(p('leader-down', 'k'), squadOf('a', 10))).toBe('k is down');
    expect(moraleTriggerText(p('half-size'), squadOf('a', 5))).toBe('Down to half strength (5/10)');
    expect(moraleTriggerText(p('half-hp'), npc('x', 10))).toBe('Below half HP');
    expect(moraleTriggerText(p('manual'), npc('x', 10))).toBe('Morale check');
  });
});

describe('detectMoraleTriggers: priority and open prompts', () => {
  it('raises one prompt by priority but records every fired trigger', () => {
    const before = [npc('k', 30), squadOf('a', 6, 'k')];
    const after = [npc('k', 0), squadOf('a', 5, 'k')];
    const r = detect(before, after);
    expect(triggers(r)).toEqual([['a', 'leader-down']]);
    expect(r.creatures.find((c) => c.id === 'a')!.morale!.asked).toEqual(['leader-down', 'half-size']);
  });

  it('a creature with an open prompt gets no automatic prompt and keeps its asked list', () => {
    const before = [npc('x', 30)];
    const after = [npc('x', 10)];
    const open = [{ id: 'm1', creatureId: 'x', trigger: 'manual' }] as MoralePrompt[];
    const r = detectMoraleTriggers(st(before), st(after, 'combat', open), newId);
    expect(r.prompts).toEqual([]);
    expect(r.creatures.find((c) => c.id === 'x')!.morale).toBeUndefined();
  });
});
