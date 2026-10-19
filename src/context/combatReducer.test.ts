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
