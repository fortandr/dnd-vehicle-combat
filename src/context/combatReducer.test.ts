import { describe, it, expect, vi } from 'vitest';

// CombatContext imports Firebase and localStorage helpers; stub them so the pure reducer loads in Node.
vi.mock('../firebase', () => ({ logAnalyticsEvent: vi.fn() }));
vi.mock('../hooks/useLocalStorage', () => ({ loadCurrentEncounter: vi.fn(() => null) }));

import { combatReducer, initialCombatState } from './CombatContext';
import { GALLEY } from '../data/navalTemplates';
import type { Vehicle } from '../types';

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
  it('LOAD_ENCOUNTER backfills oar crew into a pre-2.9.0 galley', () => {
    const strippedGalley = {
      ...GALLEY,
      components: GALLEY.components!.map((c) => {
        if (c.kind !== 'movement') return c;
        const { windSpeeds: _w, speedLoss: _s, crewRequired: _c, ...rest } = c;
        return rest;
      }),
    };
    const vehicle = {
      id: 'v1', name: 'Old Galley', type: 'party', template: strippedGalley, currentHp: 500, currentSpeed: 35,
      activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    } as unknown as Vehicle;
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: { ...initialCombatState, vehicles: [vehicle] } });
    const oars = loaded.vehicles[0].template.components!.find((c) => c.id === 'oars')!;
    expect(oars.crewRequired).toBe(40);
  });
});
