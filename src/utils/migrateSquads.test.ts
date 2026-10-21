import { describe, it, expect } from 'vitest';
import { migrateSquads, type LegacyCreature } from './migrateSquads';
import type { MoralePrompt } from '../types';

const ids = () => {
  let i = 0;
  return () => `sq${++i}`;
};
const cr = (id: string, over: Partial<LegacyCreature> = {}) => ({
  id, name: id, currentHp: 10, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { type: 'humanoid', maxHp: 10 }, ...over,
}) as unknown as LegacyCreature;
const legacyStack = (id: string, size: number, bodies: number, leaderId?: string, over: Partial<LegacyCreature> = {}) =>
  cr(id, { name: `Hob ${id}`, squad: { size, bodies, ...(leaderId ? { leaderId } : {}) }, ...over });

describe('migrateSquads', () => {
  it('turns a plain v2.11 squad into a one-member Squad holding a stack', () => {
    const out = migrateSquads({ creatures: [legacyStack('a', 10, 7, undefined, { initiative: 12, position: { x: 1, y: 2 }, faction: 'party' })] }, ids());
    expect(out.squads).toEqual([{ id: 'sq1', name: 'Hob a', faction: 'party', memberIds: ['a'], position: { x: 1, y: 2 }, initiative: 12, startingCount: 10 }]);
    expect(out.creatures[0].stack).toEqual({ size: 10, bodies: 7 });
    expect('squad' in out.creatures[0]).toBe(false);
  });

  it('a v2.12 leader joins the squad and leads it; startingCount counts it', () => {
    const out = migrateSquads({ creatures: [cr('k'), legacyStack('a', 8, 6, 'k')] }, ids());
    expect(out.squads[0]).toMatchObject({ memberIds: ['a', 'k'], leaderId: 'k', startingCount: 9 });
  });

  it('a leader shared by several squads joins only the first; the others have no leader', () => {
    const out = migrateSquads({ creatures: [cr('k'), legacyStack('a', 5, 5, 'k'), legacyStack('b', 5, 5, 'k')] }, ids());
    expect(out.squads.map((s) => [s.memberIds, s.leaderId])).toEqual([[['a', 'k'], 'k'], [['b'], undefined]]);
  });

  it('a leader who is crew, missing, or itself a stack is not joined', () => {
    const crew = [{ creatureId: 'k', vehicleId: 'v', zoneId: 'helm' }];
    expect(migrateSquads({ creatures: [cr('k'), legacyStack('a', 5, 5, 'k')], crewAssignments: crew }, ids()).squads[0].memberIds).toEqual(['a']);
    expect(migrateSquads({ creatures: [legacyStack('a', 5, 5, 'gone')] }, ids()).squads[0].leaderId).toBeUndefined();
    expect(migrateSquads({ creatures: [legacyStack('b', 5, 5), legacyStack('a', 5, 5, 'b')] }, ids()).squads[1].memberIds).toEqual(['a']);
  });

  it('swaps stack ids for squad ids in initiative, drops a joined leader\'s slot and keeps the current turn', () => {
    const out = migrateSquads({
      creatures: [cr('x'), cr('k'), legacyStack('a', 5, 5, 'k'), legacyStack('b', 5, 5)],
      initiativeOrder: ['x', 'k', 'a', 'b'], currentTurnIndex: 2,
    }, ids());
    expect(out.initiativeOrder).toEqual(['x', 'sq1', 'sq2']);
    expect(out.currentTurnIndex).toBe(1);
  });

  it('re-points open prompts and moves morale to the squad', () => {
    const prompts: MoralePrompt[] = [
      { id: 'm1', creatureId: 'a', trigger: 'half-size' },
      { id: 'm2', creatureId: 'x', trigger: 'manual' },
    ];
    const out = migrateSquads({
      creatures: [cr('x'), legacyStack('a', 10, 5, undefined, { morale: { asked: ['half-size'] } })],
      moralePrompts: prompts,
    }, ids());
    expect(out.moralePrompts).toEqual([
      { id: 'm1', squadId: 'sq1', trigger: 'half-size' },
      { id: 'm2', creatureId: 'x', trigger: 'manual' },
    ]);
    expect(out.squads[0].morale).toEqual({ asked: ['half-size'] });
    expect(out.creatures[1].morale).toBeUndefined();
  });

  it('is idempotent, and gives state without squads an empty list', () => {
    const once = migrateSquads({ creatures: [legacyStack('a', 5, 5)] }, ids());
    expect(migrateSquads(once, ids())).toBe(once);
    expect(migrateSquads({ creatures: [cr('x')] }, ids()).squads).toEqual([]);
  });
});
