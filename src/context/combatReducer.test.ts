import { describe, it, expect, vi } from 'vitest';

// CombatContext imports Firebase and localStorage helpers; stub them so the pure reducer loads in Node.
vi.mock('../firebase', () => ({ logAnalyticsEvent: vi.fn() }));
vi.mock('../hooks/useLocalStorage', () => ({ loadCurrentEncounter: vi.fn(() => null) }));

import { combatReducer, initialCombatState } from './CombatContext';
import { GALLEY, WARSHIP } from '../data/navalTemplates';
import type { CombatState, Creature, Squad, Vehicle } from '../types';

describe('wind on Environment', () => {
  it('SET_ENVIRONMENT sets and clears wind without touching other fields', () => {
    const windy = combatReducer(initialCombatState, { type: 'SET_ENVIRONMENT', payload: { wind: 'NE' } });
    expect(windy.environment.wind).toBe('NE');
    expect(windy.environment.terrain).toBe(initialCombatState.environment.terrain);

    const calm = combatReducer(windy, { type: 'SET_ENVIRONMENT', payload: { wind: undefined } });
    expect(calm.environment.wind).toBeUndefined();
  });

  it('LOAD_ENCOUNTER of a save without wind loads as calm', () => {
    const legacy = { ...initialCombatState, environment: { terrain: 'Open Sea', hazards: [], visibility: 'clear' as const } };
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: legacy });
    expect(loaded.environment.wind).toBeUndefined();
    expect(loaded.environment.terrain).toBe('Open Sea');
  });

  it('LOAD_ENCOUNTER keeps a saved wind', () => {
    const saved = { ...initialCombatState, environment: { ...initialCombatState.environment, wind: 'SW' as const } };
    expect(combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: saved }).environment.wind).toBe('SW');
  });
});

describe('naval backfill on load', () => {
  const strippedGalley = {
    ...GALLEY,
    components: GALLEY.components!.map((c) => {
      if (c.kind !== 'movement') return c;
      const { windSpeeds: _w, speedLoss: _s, crewRequired: _c, ...rest } = c;
      return rest;
    }),
  };
  const oldGalley = {
    id: 'v1', name: 'Old Galley', type: 'party', template: strippedGalley, currentHp: 500, currentSpeed: 35,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
  } as unknown as Vehicle;
  const oarsOf = (v: Vehicle) => v.template.components!.find((c) => c.id === 'oars')!;

  it('LOAD_ENCOUNTER backfills oar crew into a pre-2.9.0 galley', () => {
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: { ...initialCombatState, vehicles: [oldGalley] } });
    expect(oarsOf(loaded.vehicles[0]).crewRequired).toBe(40);
  });

  it('LOAD_PARTY_PRESET backfills a galley saved in a pre-2.9.0 preset', () => {
    const loaded = combatReducer(initialCombatState, {
      type: 'LOAD_PARTY_PRESET',
      payload: { vehicles: [oldGalley], creatures: [], crewAssignments: [] },
    });
    const galley = loaded.vehicles.find((v) => v.name === 'Old Galley')!;
    expect(oarsOf(galley).crewRequired).toBe(40);
  });
});

describe('ship turns', () => {
  const ship = (id: string, name: string, initiative?: number) => ({
    id, name, type: 'enemy', template: WARSHIP, currentHp: 500, currentSpeed: 35,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0, initiative,
  }) as unknown as Vehicle;
  const warMachine = (id: string) => ({
    id, name: 'Devil\'s Ride', type: 'enemy',
    template: { id: 'devils-ride', name: 'Devil\'s Ride', pack: 'avernus', zones: [], weapons: [], maxHp: 30 },
    currentHp: 30, currentSpeed: 120, activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
  }) as unknown as Vehicle;

  it('START_COMBAT orders ships by their own initiative (unrolled = 0); war machines without a driver get −100', () => {
    const s = { ...initialCombatState, vehicles: [ship('a', 'Alpha', 5), ship('b', 'Bravo', 17), ship('c', 'Charlie'), warMachine('w')] };
    const out = combatReducer(s, { type: 'START_COMBAT' });
    expect(out.initiativeOrder).toEqual(['b', 'a', 'c', 'w']);
  });

  it('MARK_SHIP_ACTION is idempotent and logs once', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, vehicles: [ship('a', 'Alpha')] };
    const once = combatReducer(s, { type: 'MARK_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'fire_ballista' } });
    const twice = combatReducer(once, { type: 'MARK_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'fire_ballista' } });
    expect(twice.shipActionsUsed.a).toEqual(['fire_ballista']);
    expect(twice.actionLog.length).toBe(once.actionLog.length);
    expect(once.actionLog.at(-1)?.action).toBe('Alpha: Fire Ballistas (1 of 0 actions)');
  });

  it('TOGGLE_SHIP_ACTION adds then removes', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, vehicles: [ship('a', 'Alpha')] };
    const on = combatReducer(s, { type: 'TOGGLE_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'move' } });
    expect(on.shipActionsUsed.a).toEqual(['move']);
    const off = combatReducer(on, { type: 'TOGGLE_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'move' } });
    expect(off.shipActionsUsed.a).toEqual([]);
  });

  it('NEXT_ROUND and RESET_MOVEMENT_TRACKING clear ship action marks', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, shipActionsUsed: { a: ['move'] } };
    expect(combatReducer(s, { type: 'NEXT_ROUND' }).shipActionsUsed).toEqual({});
    expect(combatReducer(s, { type: 'RESET_MOVEMENT_TRACKING' }).shipActionsUsed).toEqual({});
  });

  it('LOAD_ENCOUNTER of an older save defaults shipActionsUsed', () => {
    const { shipActionsUsed: _x, ...old } = initialCombatState;
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: old as typeof initialCombatState });
    expect(loaded.shipActionsUsed).toEqual({});
  });

  it('ships keep their own initiative order after NEXT_ROUND, ignoring helmsmen', () => {
    const helmsman = (id: string, initiative: number) => ({
      id, name: id, initiative, currentHp: 10, statblock: { type: 'npc', maxHp: 10 },
    }) as unknown as Creature;
    const s = {
      ...initialCombatState,
      vehicles: [ship('slow', 'Slow', 5), ship('fast', 'Fast', 17)],
      creatures: [helmsman('d1', 1), helmsman('d2', 20)],
      crewAssignments: [
        { creatureId: 'd1', vehicleId: 'fast', zoneId: 'helm' },
        { creatureId: 'd2', vehicleId: 'slow', zoneId: 'helm' },
      ],
    };
    const started = combatReducer(s, { type: 'START_COMBAT' });
    expect(started.initiativeOrder).toEqual(['fast', 'slow']);
    const next = combatReducer(started, { type: 'NEXT_ROUND' });
    expect(next.initiativeOrder).toEqual(['fast', 'slow']);
  });

  it('RESET_COMBAT clears ship initiative but leaves war machines alone', () => {
    const wm = warMachine('w');
    const s = { ...initialCombatState, phase: 'combat' as const, round: 2, vehicles: [ship('a', 'Alpha', 14), wm] };
    const out = combatReducer(s, { type: 'RESET_COMBAT' });
    expect(out.vehicles[0].initiative).toBeUndefined();
    expect(out.vehicles[1]).toEqual({ ...wm, currentHp: wm.template.maxHp, activeMishaps: [] });
  });
});

describe('battle mode squads', () => {
  const hob = (id: string, bodies: number, currentHp: number, size = 10) => ({
    id, name: `Hob ${id}`, currentHp, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 1, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp: 11, ac: 18 }, stack: { size, bodies },
  }) as unknown as Creature;
  const solo = (id: string, currentHp: number) => ({
    id, name: id, currentHp, tempHp: 2, conditions: [], initiative: 5, initiativeModifier: 0, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp: 20, ac: 12 },
  }) as unknown as Creature;
  const withCreatures = (...creatures: Creature[]) => ({ ...initialCombatState, round: 1, creatures });

  it('RESET_COMBAT restores a wiped squad to full bodies and HP; non-squads get no squad key', () => {
    const out = combatReducer(
      { ...withCreatures(hob('a', 0, 0), solo('b', 3)), phase: 'combat' as const },
      { type: 'RESET_COMBAT' },
    );
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { size: 10, bodies: 10 } });
    expect(out.creatures[1].currentHp).toBe(20);
    expect('stack' in out.creatures[1]).toBe(false);
  });

  it('SQUAD_HITS drops bodies and logs', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), { type: 'SQUAD_HIT', payload: { memberId: 'a', hits: [11, 4], source: 'Bitter Breath' } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 7, stack: { size: 10, bodies: 9 } });
    expect(out.actionLog.at(-1)).toMatchObject({ type: 'damage', action: 'Hob a takes 2 hits: 1 fall (9/10)', details: 'Bitter Breath' });
  });

  it('SQUAD_AREA stores the resolved result and logs the summary', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), {
      type: 'SQUAD_AREA', payload: { members: [{ memberId: 'a', currentHp: 1, bodies: 6 }], summary: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' },
    });
    expect(out.creatures[0]).toMatchObject({ currentHp: 1, stack: { bodies: 6 } });
    expect(out.actionLog.at(-1)).toMatchObject({ action: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' });
  });

  it('DEAL_DAMAGE_TO_CREATURE on a squad is one hit (overkill lost)', () => {
    const out = combatReducer(withCreatures(hob('a', 3, 11)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { bodies: 2 } });
  });

  it('HEAL_CREATURE heals the front body and never revives', () => {
    const healed = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(healed.creatures[0]).toMatchObject({ currentHp: 11, stack: { bodies: 3 } });
    const wiped = combatReducer(withCreatures(hob('a', 0, 0)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 5 } });
    expect(wiped.creatures[0]).toMatchObject({ currentHp: 0, stack: { bodies: 0 } });
  });

  it('UPDATE_CREATURE keeps the bodies/HP invariant', () => {
    const zero = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { stack: { size: 10, bodies: 0 } } } });
    expect(zero.creatures[0].currentHp).toBe(0);
    const back = combatReducer(zero, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { stack: { size: 10, bodies: 5 } } } });
    expect(back.creatures[0]).toMatchObject({ currentHp: 11, stack: { bodies: 5 } });
    const init = combatReducer(back, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { initiative: 17 } } });
    expect(init.creatures[0]).toMatchObject({ initiative: 17, currentHp: 11, stack: { bodies: 5 } });
  });

  it('a wiped squad is skipped in turn order like a dead NPC', () => {
    const s = { ...withCreatures(solo('x', 20), hob('a', 0, 0), solo('y', 20)), phase: 'combat' as const, initiativeOrder: ['x', 'a', 'y'], currentTurnIndex: 0 };
    const out = combatReducer(s, { type: 'NEXT_TURN' });
    expect(out.initiativeOrder[out.currentTurnIndex]).toBe('y');
  });

  it('creatures without squad behave as before (temp HP absorbs first; HP clamps to 0)', () => {
    const out = combatReducer(withCreatures(solo('x', 20)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'x', amount: 25 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 0, tempHp: 0 });
    expect(out.creatures[0].stack).toBeUndefined();
    const healed = combatReducer(out, { type: 'HEAL_CREATURE', payload: { creatureId: 'x', amount: 5 } });
    expect(healed.creatures[0].currentHp).toBe(5);
  });
});

describe('battle mode morale', () => {
  const npc = (id: string, currentHp: number, maxHp = 30, over: Partial<Creature> = {}) => ({
    id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 0, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp, ac: 12, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } },
    ...over,
  }) as unknown as Creature;
  const squadOf = (id: string, bodies: number, leaderId?: string) => npc(id, 11, 11, { stack: { size: 10, bodies, leaderId } });
  const combat = (...creatures: Creature[]) => ({ ...initialCombatState, phase: 'combat' as const, round: 1, creatures });

  it('SQUAD_HITS crossing half strength queues a half-size prompt', () => {
    const out = combatReducer(combat(squadOf('a', 6)), { type: 'SQUAD_HIT', payload: { memberId: 'a', hits: [11] } });
    expect(out.moralePrompts).toMatchObject([{ creatureId: 'a', trigger: 'half-size' }]);
    expect(out.creatures[0].morale?.asked).toEqual(['half-size']);
  });

  it('DEAL_DAMAGE_TO_CREATURE dropping a leader prompts each squad it leads', () => {
    const s = combat(npc('k', 30), squadOf('a', 10, 'k'), squadOf('b', 10, 'k'), squadOf('c', 10));
    const out = combatReducer(s, { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'k', amount: 40 } });
    expect(out.moralePrompts.map((p) => [p.creatureId, p.trigger, p.leaderName])).toEqual([['a', 'leader-down', 'k'], ['b', 'leader-down', 'k']]);
  });

  it('UPDATE_CREATURE below half HP prompts a single NPC in combat, not in setup', () => {
    const upd = { type: 'UPDATE_CREATURE' as const, payload: { id: 'x', updates: { currentHp: 15 } } };
    expect(combatReducer(combat(npc('x', 30)), upd).moralePrompts).toMatchObject([{ creatureId: 'x', trigger: 'half-hp' }]);
    expect(combatReducer({ ...combat(npc('x', 30)), phase: 'setup' as const }, upd).moralePrompts).toEqual([]);
  });

  it('an action that fires nothing leaves moralePrompts untouched', () => {
    const s = combat(npc('x', 30));
    const out = combatReducer(s, { type: 'UPDATE_CREATURE', payload: { id: 'x', updates: { initiative: 12 } } });
    expect(out.moralePrompts).toBe(s.moralePrompts);
  });

  it('REQUEST_MORALE adds one manual prompt per creature', () => {
    const once = combatReducer(combat(npc('x', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const twice = combatReducer(once, { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    expect(twice.moralePrompts).toMatchObject([{ creatureId: 'x', trigger: 'manual' }]);
  });

  it('RESOLVE_MORALE removes the prompt, logs, and marks fleeing only when fled', () => {
    const s = combatReducer(combat(npc('x', 30), npc('y', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const fled = combatReducer(s, { type: 'RESOLVE_MORALE', payload: { promptId: s.moralePrompts[0].id, fled: true, log: 'x flees' } });
    expect(fled.moralePrompts).toEqual([]);
    expect(fled.creatures[0].morale).toEqual({ asked: [], status: 'fleeing' });
    expect(fled.actionLog.at(-1)).toMatchObject({ type: 'system', action: 'x flees' });
    const held = combatReducer(s, { type: 'RESOLVE_MORALE', payload: { promptId: s.moralePrompts[0].id, fled: false, log: 'x holds' } });
    expect(held.creatures[0].morale).toBeUndefined();
    expect(held.actionLog.at(-1)?.action).toBe('x holds');
  });

  it('DISMISS_MORALE removes the prompt without logging', () => {
    const s = combatReducer(combat(npc('x', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const out = combatReducer(s, { type: 'DISMISS_MORALE', payload: { promptId: s.moralePrompts[0].id } });
    expect(out.moralePrompts).toEqual([]);
    expect(out.actionLog).toBe(s.actionLog);
  });

  it('SET_MORALE_STATUS sets, changes and clears the status with a log line', () => {
    const s = combat(npc('x', 30));
    const sur = combatReducer(s, { type: 'SET_MORALE_STATUS', payload: { creatureId: 'x', status: 'surrendered' } });
    expect(sur.creatures[0].morale).toEqual({ asked: [], status: 'surrendered' });
    expect(sur.actionLog.at(-1)?.action).toBe('x surrenders');
    const cleared = combatReducer(sur, { type: 'SET_MORALE_STATUS', payload: { creatureId: 'x' } });
    expect(cleared.creatures[0].morale?.status).toBeUndefined();
    expect(cleared.actionLog.at(-1)?.action).toBe('x rallies (morale status cleared)');
  });

  it('REMOVE_CREATURE of a leader prompts its squads and drops prompts for the removed creature', () => {
    const s = combatReducer(combat(npc('k', 30), squadOf('a', 10, 'k')), { type: 'REQUEST_MORALE', payload: { creatureId: 'k' } });
    const out = combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'k' });
    expect(out.moralePrompts.map((p) => [p.creatureId, p.trigger])).toEqual([['a', 'leader-down']]);
  });

  it('RESET_COMBAT clears morale and prompts but keeps the DMG edition', () => {
    const s = { ...combat(npc('x', 15, 30, { morale: { status: 'fleeing', asked: ['half-hp'] } })), dmgEdition: '2024' as const };
    const withPrompt = combatReducer(s, { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const out = combatReducer(withPrompt, { type: 'RESET_COMBAT' });
    expect(out.moralePrompts).toEqual([]);
    expect(out.creatures[0].morale).toBeUndefined();
    expect(out.dmgEdition).toBe('2024');
  });

  it('SET_DMG_EDITION sets the edition', () => {
    expect(combatReducer(initialCombatState, { type: 'SET_DMG_EDITION', payload: { edition: '2024' } }).dmgEdition).toBe('2024');
  });

  it('LOAD_ENCOUNTER of an older save defaults moralePrompts and leaves the edition unset', () => {
    const { moralePrompts: _m, ...old } = initialCombatState;
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: old as typeof initialCombatState });
    expect(loaded.moralePrompts).toEqual([]);
    expect(loaded.dmgEdition).toBeUndefined();
  });

  describe('leaderId survives squad rebuilds', () => {
    const led = () => combat(npc('k', 30), { ...squadOf('a', 10, 'k'), id: 'a' });
    it('UPDATE_CREATURE setting squad with leaderId on a leaderless squad', () => {
      const out = combatReducer(combat(npc('k', 30), squadOf('a', 10)), { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { stack: { size: 10, bodies: 10, leaderId: 'k' } } } });
      expect(out.creatures[1].stack?.leaderId).toBe('k');
    });
    it('unrelated UPDATE_CREATURE', () => {
      const out = combatReducer(led(), { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { initiative: 5 } } });
      expect(out.creatures[1].stack?.leaderId).toBe('k');
    });
    it('SQUAD_HITS', () => {
      const out = combatReducer(led(), { type: 'SQUAD_HIT', payload: { memberId: 'a', hits: [11] } });
      expect(out.creatures[1].stack).toMatchObject({ bodies: 9, leaderId: 'k' });
    });
    it('SQUAD_AREA', () => {
      const out = combatReducer(led(), { type: 'SQUAD_AREA', payload: { members: [{ memberId: 'a', currentHp: 11, bodies: 8 }], summary: 's' } });
      expect(out.creatures[1].stack).toMatchObject({ bodies: 8, leaderId: 'k' });
    });
    it('DEAL_DAMAGE_TO_CREATURE', () => {
      const out = combatReducer(led(), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'a', amount: 11 } });
      expect(out.creatures[1].stack).toMatchObject({ bodies: 9, leaderId: 'k' });
    });
  });

  describe('state replacement', () => {
    it('LOAD_ENCOUNTER of a combat save with a hurt NPC raises no prompts', () => {
      const saved = combat(npc('x', 10));
      const out = combatReducer(combat(npc('x', 30)), { type: 'LOAD_ENCOUNTER', payload: saved });
      expect(out.moralePrompts).toEqual([]);
    });
    it('LOAD_PARTY_PRESET drops prompts for creatures no longer present', () => {
      const s = combatReducer(combat(npc('x', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
      expect(s.moralePrompts).toHaveLength(1);
      const out = combatReducer(s, { type: 'LOAD_PARTY_PRESET', payload: { vehicles: [], creatures: [npc('p', 10)], crewAssignments: [] } });
      expect(out.moralePrompts).toEqual([]);
    });
  });
});

describe('squad migration on load', () => {
  it('LOAD_ENCOUNTER turns a v2.12 squad creature into a Squad holding a stack', () => {
    const legacy = {
      ...initialCombatState, phase: 'combat' as const, round: 2,
      creatures: [
        { id: 'k', name: 'Captain', currentHp: 39, tempHp: 0, conditions: [], initiative: 18, initiativeModifier: 0, faction: 'enemy', statblock: { type: 'humanoid', maxHp: 39 } },
        { id: 'a', name: 'Hobgoblin ×8 (A)', currentHp: 11, tempHp: 0, conditions: [], initiative: 14, initiativeModifier: 1, faction: 'enemy', position: { x: 3, y: 4 }, statblock: { type: 'humanoid', maxHp: 11 }, squad: { size: 8, bodies: 6, leaderId: 'k' } },
      ],
      initiativeOrder: ['k', 'a'], currentTurnIndex: 1,
    } as unknown as CombatState;
    const out = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: legacy });
    expect(out.squads).toHaveLength(1);
    const squad = out.squads[0];
    expect(squad).toMatchObject({ name: 'Hobgoblin ×8 (A)', memberIds: ['a', 'k'], leaderId: 'k', startingCount: 9, position: { x: 3, y: 4 }, initiative: 14 });
    expect(out.creatures[1].stack).toEqual({ size: 8, bodies: 6 });
    // members are never re-added to initiative by the load safety net
    expect(out.initiativeOrder).toEqual([squad.id]);
    expect(out.currentTurnIndex).toBe(0);
  });
});

describe('battle mode squads tab', () => {
  const sb = (name: string, type: string, maxHp: number, ac: number) =>
    ({ name, type, maxHp, ac, abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 } }) as unknown as Creature['statblock'];
  const ind = (id: string, over: Partial<Creature> = {}) => ({
    id, name: id, currentHp: 10, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 0, faction: 'enemy',
    statblock: sb(id, 'humanoid', 10, 12), ...over,
  }) as unknown as Creature;
  const stk = (id: string, bodies: number, size = bodies) =>
    ind(id, { name: `Hobgoblin ×${size}`, currentHp: bodies === 0 ? 0 : 11, statblock: sb('Hobgoblin', 'humanoid', 11, 18), stack: { size, bodies } });
  const pc = (id: string, initiative = 15) => ind(id, { initiative, faction: 'party', statblock: sb(id, 'pc', 30, 15) });
  const sq = (id: string, memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id, name: id, faction: 'enemy', memberIds, startingCount: 0, ...over });
  const setup = (creatures: Creature[], squads: Squad[] = [], over: Partial<CombatState> = {}): CombatState => ({ ...initialCombatState, creatures, squads, ...over });
  const fight = (creatures: Creature[], squads: Squad[], initiativeOrder: string[], currentTurnIndex = 0) =>
    setup(creatures, squads, { phase: 'combat', round: 1, initiativeOrder, currentTurnIndex });
  const squadById = (s: CombatState, id: string) => s.squads.find((x) => x.id === id)!;

  it('ADD_SQUAD appends; UPDATE_SQUAD edits and ignores a leader who is not a member', () => {
    const added = combatReducer(setup([ind('k')]), { type: 'ADD_SQUAD', payload: sq('S', ['k']) });
    expect(added.squads).toHaveLength(1);
    const renamed = combatReducer(added, { type: 'UPDATE_SQUAD', payload: { id: 'S', updates: { name: 'Tower Guard', leaderId: 'k' } } });
    expect(squadById(renamed, 'S')).toMatchObject({ name: 'Tower Guard', leaderId: 'k' });
    const bad = combatReducer(renamed, { type: 'UPDATE_SQUAD', payload: { id: 'S', updates: { leaderId: 'nobody' } } });
    expect(squadById(bad, 'S').leaderId).toBe('k');
  });

  it('a commander must be a PC who is not a member and commands no other squad', () => {
    const s = setup([pc('p'), ind('k')], [sq('A', ['k']), sq('B', [])]);
    const a = combatReducer(s, { type: 'UPDATE_SQUAD', payload: { id: 'A', updates: { commanderId: 'p' } } });
    expect(squadById(a, 'A').commanderId).toBe('p');
    const b = combatReducer(a, { type: 'UPDATE_SQUAD', payload: { id: 'B', updates: { commanderId: 'p' } } });
    expect(squadById(b, 'B').commanderId).toBeUndefined();
    const npcCommander = combatReducer(s, { type: 'UPDATE_SQUAD', payload: { id: 'B', updates: { commanderId: 'k' } } });
    expect(squadById(npcCommander, 'B').commanderId).toBeUndefined();
    const cleared = combatReducer(a, { type: 'UPDATE_SQUAD', payload: { id: 'A', updates: { commanderId: undefined } } });
    expect(squadById(cleared, 'A').commanderId).toBeUndefined();
  });

  it('ADD_SQUAD_MEMBER staffs a standalone creature and recomputes the starting count in setup', () => {
    const s = setup([stk('h', 8), ind('k')], [sq('S', ['h'])]);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h', 'k'], startingCount: 9 });
  });

  it('ADD_SQUAD_MEMBER with a new creature adds it with the squad faction', () => {
    const out = combatReducer(setup([], [sq('S', [], { faction: 'party' })]), { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creature: stk('h', 8) } });
    expect(out.creatures[0]).toMatchObject({ id: 'h', faction: 'party' });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], startingCount: 8 });
  });

  it('ADD_SQUAD_MEMBER refuses crew, members of another squad, and commanders', () => {
    const s = setup([ind('c'), ind('m'), pc('p')], [sq('S', [], { commanderId: 'p' }), sq('T', ['m'])], { crewAssignments: [{ creatureId: 'c', vehicleId: 'v', zoneId: 'helm' }] });
    for (const creatureId of ['c', 'm', 'p']) {
      expect(combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId } })).toBe(s);
    }
  });

  it('ADD_SQUAD_MEMBER in combat adds the standing count and takes the creature out of the turn order', () => {
    const s = fight([stk('h', 8), ind('k')], [sq('S', ['h'], { startingCount: 8 })], ['k', 'S'], 1);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S').startingCount).toBe(9);
    expect(out.initiativeOrder).toEqual(['S']);
    expect(out.currentTurnIndex).toBe(0);
  });

  it('REMOVE_SQUAD_MEMBER makes a standalone creature at the squad position and clears the leader', () => {
    const s = setup([stk('h', 8), ind('k')], [sq('S', ['h', 'k'], { leaderId: 'k', position: { x: 5, y: 7 }, startingCount: 9 })]);
    const out = combatReducer(s, { type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], leaderId: undefined, startingCount: 8 });
    expect(out.creatures[1].position).toEqual({ x: 5, y: 7 });
  });

  it('REMOVE_SQUAD_MEMBER in combat acts right after the current turn and lowers the starting count', () => {
    const s = fight([stk('h', 8), ind('k'), ind('x')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S', 'x'], 0);
    const out = combatReducer(s, { type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(out.initiativeOrder).toEqual(['S', 'k', 'x']);
    expect(squadById(out, 'S').startingCount).toBe(8);
    expect(out.actionLog.at(-1)?.action).toBe('k leaves S');
  });

  it('SPLIT_STACK splits one body off as a fresh standalone creature', () => {
    const h = { ...stk('h', 8), currentHp: 5 };
    const s = setup([h], [sq('S', ['h'], { position: { x: 1, y: 2 }, startingCount: 8 })]);
    const out = combatReducer(s, { type: 'SPLIT_STACK', payload: { creatureId: 'h' } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 5, stack: { size: 7, bodies: 7 } });
    expect(out.creatures[1]).toMatchObject({ name: 'Hobgoblin', currentHp: 11, position: { x: 1, y: 2 } });
    expect(out.creatures[1].stack).toBeUndefined();
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], startingCount: 7 });
    expect(combatReducer(setup([stk('h', 1)]), { type: 'SPLIT_STACK', payload: { creatureId: 'h' } }).creatures).toHaveLength(1);
  });

  it('GROW_STACK adds bodies (a wiped stack comes back with a full front body)', () => {
    const out = combatReducer(setup([stk('h', 0, 8)], [sq('S', ['h'])]), { type: 'GROW_STACK', payload: { creatureId: 'h', amount: 32 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { size: 40, bodies: 32 } });
    expect(squadById(out, 'S').startingCount).toBe(32);
  });

  it('REMOVE_SQUAD disbands (members stay, in member order after the current turn) or deletes members too', () => {
    const s = fight([stk('h', 8), ind('k'), ind('x')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['x', 'S'], 0);
    const disbanded = combatReducer(s, { type: 'REMOVE_SQUAD', payload: { id: 'S', deleteMembers: false } });
    expect(disbanded.squads).toEqual([]);
    expect(disbanded.creatures).toHaveLength(3);
    expect(disbanded.initiativeOrder).toEqual(['x', 'h', 'k']);
    const deleted = combatReducer(s, { type: 'REMOVE_SQUAD', payload: { id: 'S', deleteMembers: true } });
    expect(deleted.squads).toEqual([]);
    expect(deleted.creatures.map((c) => c.id)).toEqual(['x']);
    expect(deleted.initiativeOrder).toEqual(['x']);
  });

  it('SQUAD_HIT: a stack member loses front bodies; an individual takes normal damage', () => {
    const s = fight([stk('h', 8), ind('k', { tempHp: 3 })], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S']);
    const onStack = combatReducer(s, { type: 'SQUAD_HIT', payload: { squadId: 'S', memberId: 'h', hits: [11, 4] } });
    expect(onStack.creatures[0]).toMatchObject({ currentHp: 7, stack: { bodies: 7 } });
    const onLeader = combatReducer(s, { type: 'SQUAD_HIT', payload: { squadId: 'S', memberId: 'k', hits: [5, 4] } });
    expect(onLeader.creatures[1]).toMatchObject({ currentHp: 4, tempHp: 0 });
  });

  it('SQUAD_AREA stores each member result and logs once', () => {
    const s = fight([stk('h', 8), ind('k')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S']);
    const out = combatReducer(s, {
      type: 'SQUAD_AREA',
      payload: { squadId: 'S', members: [{ memberId: 'h', currentHp: 3, bodies: 5 }, { memberId: 'k', currentHp: 0, tempHp: 0 }], summary: 'Fireball on S', details: 'd' },
    });
    expect(out.creatures[0]).toMatchObject({ currentHp: 3, stack: { bodies: 5 } });
    expect(out.creatures[1].currentHp).toBe(0);
    expect(out.actionLog.at(-1)).toMatchObject({ type: 'damage', action: 'Fireball on S', details: 'd' });
  });

  it('REMOVE_CREATURE drops the creature from its squad, its leadership and any command', () => {
    const s = setup([stk('h', 8), ind('k'), pc('p')], [sq('S', ['h', 'k'], { leaderId: 'k', commanderId: 'p', startingCount: 9 })]);
    const noLeader = combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'k' });
    expect(squadById(noLeader, 'S')).toMatchObject({ memberIds: ['h'], leaderId: undefined, startingCount: 8 });
    expect(squadById(combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'p' }), 'S').commanderId).toBeUndefined();
  });

  it('LOAD_PARTY_PRESET clears squads, strips morale, and turns a legacy squad field into a stack', () => {
    const legacy = { ...ind('a'), squad: { size: 10, bodies: 7, leaderId: 'k' } } as unknown as Creature;
    const s = setup([ind('k')], [sq('S', ['k'])], { initiativeOrder: ['S'] });
    const out = combatReducer(s, { type: 'LOAD_PARTY_PRESET', payload: { vehicles: [], creatures: [ind('k', { morale: { asked: [], status: 'fleeing' } }), legacy], crewAssignments: [] } });
    expect(out.squads).toEqual([]);
    expect(out.initiativeOrder).toEqual([]);
    expect(out.creatures[0].morale).toBeUndefined();
    expect(out.creatures[1].stack).toEqual({ size: 10, bodies: 7 });
    expect('squad' in out.creatures[1]).toBe(false);
  });

  it('RESET_COMBAT keeps membership, restores bodies and clears squad morale and initiative', () => {
    const s = fight([stk('h', 2, 8)], [sq('S', ['h'], { startingCount: 8, initiative: 14, morale: { status: 'fleeing', asked: ['half-size'] } })], ['S']);
    const out = combatReducer(s, { type: 'RESET_COMBAT' });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { bodies: 8 } });
    expect(out.squads[0]).toEqual({ id: 'S', name: 'S', faction: 'enemy', memberIds: ['h'], startingCount: 8 });
  });

  it('ASSIGN_CREW refuses squad members', () => {
    const s = setup([ind('k')], [sq('S', ['k'])]);
    expect(combatReducer(s, { type: 'ASSIGN_CREW', payload: { creatureId: 'k', vehicleId: 'v', zoneId: 'helm' } })).toBe(s);
  });

  it('START_COMBAT gives each squad one slot, skips members and empty or wiped squads, and sets the starting count', () => {
    const s = setup(
      [ind('x', { initiative: 12 }), stk('h', 8), ind('k', { initiative: 20 }), stk('w', 0, 4)],
      [sq('S', ['h', 'k'], { initiative: 15 }), sq('E', []), sq('W', ['w'], { initiative: 30 })],
    );
    const out = combatReducer(s, { type: 'START_COMBAT' });
    expect(out.initiativeOrder).toEqual(['S', 'x']);
    expect(squadById(out, 'S').startingCount).toBe(9);
  });

  it('a commanded squad acts right after its commander, through NEXT_ROUND and manual reordering', () => {
    const s = setup([pc('p', 5), ind('x', { initiative: 12 }), stk('h', 8)], [sq('S', ['h'], { faction: 'party', commanderId: 'p', initiative: 20 })]);
    const started = combatReducer(s, { type: 'START_COMBAT' });
    expect(started.initiativeOrder).toEqual(['x', 'p', 'S']);
    const faster = { ...started, creatures: started.creatures.map((c) => (c.id === 'p' ? { ...c, initiative: 18 } : c)) };
    expect(combatReducer(faster, { type: 'NEXT_ROUND' }).initiativeOrder).toEqual(['p', 'S', 'x']);
    expect(combatReducer(started, { type: 'SET_INITIATIVE_ORDER', payload: ['S', 'p', 'x'] }).initiativeOrder).toEqual(['p', 'S', 'x']);
  });

  it('NEXT_TURN skips a squad with no one standing', () => {
    const s = fight([ind('x'), stk('h', 0, 8), ind('y')], [sq('S', ['h'], { startingCount: 8 })], ['x', 'S', 'y'], 0);
    const out = combatReducer(s, { type: 'NEXT_TURN' });
    expect(out.initiativeOrder[out.currentTurnIndex]).toBe('y');
  });

  it('P4: staffing a slotless squad in combat takes the member\'s exact slot', () => {
    const s = fight([ind('x'), ind('k'), ind('y')], [sq('S', [])], ['x', 'k', 'y'], 1);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(out.initiativeOrder).toEqual(['x', 'S', 'y']);
    expect(out.currentTurnIndex).toBe(1);
    expect(squadById(out, 'S').startingCount).toBe(1);
  });

  it('P4: staffing a slotless squad with a creature that had no slot inserts it after the current turn', () => {
    const s = fight([ind('x'), ind('y')], [sq('S', [])], ['x', 'y'], 0);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creature: ind('n') } });
    expect(out.initiativeOrder).toEqual(['x', 'S', 'y']);
    expect(out.currentTurnIndex).toBe(0);
  });

  it('P4: ADD_SQUAD created with members during combat gets a slot (the first member\'s)', () => {
    const s = fight([ind('x'), ind('k'), ind('m')], [], ['x', 'k', 'm'], 2);
    const out = combatReducer(s, { type: 'ADD_SQUAD', payload: sq('S', ['k', 'm']) });
    expect(out.initiativeOrder).toEqual(['x', 'S']);
    expect(out.currentTurnIndex).toBe(1);
  });

  it('P5: SQUAD_HIT without memberId resolves the default target at apply time', () => {
    const s = fight([stk('a', 3), stk('b', 2)], [sq('S', ['a', 'b'], { startingCount: 5 })], ['S']);
    const first = combatReducer(s, { type: 'SQUAD_HIT', payload: { squadId: 'S', hits: [11, 11, 11] } });
    expect(first.creatures[0].stack?.bodies).toBe(0);
    expect(first.creatures[1].stack?.bodies).toBe(2);
    const second = combatReducer(first, { type: 'SQUAD_HIT', payload: { squadId: 'S', hits: [11] } });
    expect(second.creatures[1].stack?.bodies).toBe(1);
  });
});
