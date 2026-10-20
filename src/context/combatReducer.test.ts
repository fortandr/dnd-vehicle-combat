import { describe, it, expect, vi } from 'vitest';

// CombatContext imports Firebase and localStorage helpers; stub them so the pure reducer loads in Node.
vi.mock('../firebase', () => ({ logAnalyticsEvent: vi.fn() }));
vi.mock('../hooks/useLocalStorage', () => ({ loadCurrentEncounter: vi.fn(() => null) }));

import { combatReducer, initialCombatState } from './CombatContext';
import { GALLEY, WARSHIP } from '../data/navalTemplates';
import type { Creature, Vehicle } from '../types';

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
    statblock: { type: 'humanoid', maxHp: 11, ac: 18 }, squad: { size, bodies },
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
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, squad: { size: 10, bodies: 10 } });
    expect(out.creatures[1].currentHp).toBe(20);
    expect('squad' in out.creatures[1]).toBe(false);
  });

  it('SQUAD_HITS drops bodies and logs', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), { type: 'SQUAD_HITS', payload: { creatureId: 'a', hits: [11, 4], source: 'Bitter Breath' } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 7, squad: { size: 10, bodies: 9 } });
    expect(out.actionLog.at(-1)).toMatchObject({ type: 'damage', action: 'Hob a takes 2 hits: 1 fall (9/10)', details: 'Bitter Breath' });
  });

  it('SQUAD_AREA stores the resolved result and logs the summary', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), {
      type: 'SQUAD_AREA', payload: { creatureId: 'a', currentHp: 1, bodies: 6, summary: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' },
    });
    expect(out.creatures[0]).toMatchObject({ currentHp: 1, squad: { bodies: 6 } });
    expect(out.actionLog.at(-1)).toMatchObject({ action: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' });
  });

  it('DEAL_DAMAGE_TO_CREATURE on a squad is one hit (overkill lost)', () => {
    const out = combatReducer(withCreatures(hob('a', 3, 11)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 2 } });
  });

  it('HEAL_CREATURE heals the front body and never revives', () => {
    const healed = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(healed.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 3 } });
    const wiped = combatReducer(withCreatures(hob('a', 0, 0)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 5 } });
    expect(wiped.creatures[0]).toMatchObject({ currentHp: 0, squad: { bodies: 0 } });
  });

  it('UPDATE_CREATURE keeps the bodies/HP invariant', () => {
    const zero = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { squad: { size: 10, bodies: 0 } } } });
    expect(zero.creatures[0].currentHp).toBe(0);
    const back = combatReducer(zero, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { squad: { size: 10, bodies: 5 } } } });
    expect(back.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 5 } });
    const init = combatReducer(back, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { initiative: 17 } } });
    expect(init.creatures[0]).toMatchObject({ initiative: 17, currentHp: 11, squad: { bodies: 5 } });
  });

  it('a wiped squad is skipped in turn order like a dead NPC', () => {
    const s = { ...withCreatures(solo('x', 20), hob('a', 0, 0), solo('y', 20)), phase: 'combat' as const, initiativeOrder: ['x', 'a', 'y'], currentTurnIndex: 0 };
    const out = combatReducer(s, { type: 'NEXT_TURN' });
    expect(out.initiativeOrder[out.currentTurnIndex]).toBe('y');
  });

  it('creatures without squad behave as before (temp HP absorbs first; HP clamps to 0)', () => {
    const out = combatReducer(withCreatures(solo('x', 20)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'x', amount: 25 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 0, tempHp: 0 });
    expect(out.creatures[0].squad).toBeUndefined();
    const healed = combatReducer(out, { type: 'HEAL_CREATURE', payload: { creatureId: 'x', amount: 5 } });
    expect(healed.creatures[0].currentHp).toBe(5);
  });
});
