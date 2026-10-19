import { describe, it, expect } from 'vitest';
import type { CrewAssignment, Vehicle, VehicleTemplate } from '../types';
import {
  clampCrewQuality,
  getCrewQuality,
  shipDexMod,
  shipInitiativeModifier,
  rollShipInitiative,
  formatShipInitiativeLog,
  shipActionsAvailable,
  actionForWeapon,
  shipActionsUsedFor,
  shipActionSummary,
} from './shipTurn';

const SHIP_ACTIONS: VehicleTemplate['shipActions'] = {
  actions: [
    { id: 'fire_ballista', name: 'Fire Ballistas', weaponIds: ['ballista_1', 'ballista_2'] },
    { id: 'fire_mangonel', name: 'Fire Mangonels', weaponIds: ['mangonel_1'] },
    { id: 'move', name: 'Move' },
  ],
  crewThresholds: [3, 20, 40],
};

function makeShip(overrides: Partial<Vehicle> = {}, dex = 4, shipActions: VehicleTemplate['shipActions'] | null = SHIP_ACTIONS): Vehicle {
  const template = {
    id: 't', name: 'Galley', description: '', maxHp: 500, ac: 15, speed: 30, damageThreshold: 20,
    mishapThreshold: 999, crewCapacity: 80, zones: [], weapons: [], abilityScores: { str: 24, dex, con: 20 },
    environment: 'water', shipActions: shipActions ?? undefined,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Galley', type: 'enemy', template, currentHp: 500, currentSpeed: 30,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}
const crew = (n: number, zoneId = 'deck_crew'): CrewAssignment[] =>
  Array.from({ length: n }, (_, i) => ({ creatureId: `c${i}`, vehicleId: 'v1', zoneId }));
const turn = (over: Partial<{ shipActionsUsed: Record<string, string[]>; movementUsed: Record<string, number>; crewAssignments: CrewAssignment[] }> = {}) => ({
  shipActionsUsed: {}, movementUsed: {}, crewAssignments: [], ...over,
});

describe('crew quality', () => {
  it('defaults to +4 and clamps to −10…+10', () => {
    expect(getCrewQuality(makeShip())).toBe(4);
    expect(getCrewQuality(makeShip({ crewQuality: 12 }))).toBe(10);
    expect(getCrewQuality(makeShip({ crewQuality: -15 }))).toBe(-10);
    expect(clampCrewQuality(3)).toBe(3);
  });
});

describe('initiative', () => {
  it('Dex modifier comes from template ability scores (galley Dex 4 → −3; missing → 0)', () => {
    expect(shipDexMod(makeShip())).toBe(-3);
    expect(shipDexMod(makeShip({}, 10))).toBe(0);
    expect(shipDexMod(makeShip({}, 7))).toBe(-2);
  });

  it('modifier = Dex mod + crew quality', () => {
    expect(shipInitiativeModifier(makeShip({ crewQuality: 6 }))).toBe(3);
  });

  it('rolls d20 + modifier with a floor of 1', () => {
    expect(rollShipInitiative(makeShip({ crewQuality: 6 }), 11)).toEqual({ total: 14, d20: 11, dexMod: -3, quality: 6 });
    expect(rollShipInitiative(makeShip({ crewQuality: -10 }), 2).total).toBe(1);
  });

  it('formats the log line', () => {
    expect(formatShipInitiativeLog('Galley', { total: 14, d20: 11, dexMod: -3, quality: 6 }))
      .toBe('Galley rolls initiative 14 (d20 11, Dex −3, crew +6)');
    expect(formatShipInitiativeLog('Sloop', { total: 12, d20: 12, dexMod: 0, quality: 0 }))
      .toBe('Sloop rolls initiative 12 (d20 12, Dex +0, crew +0)');
  });
});

describe('actions available', () => {
  it('counts crew thresholds met', () => {
    const t = makeShip().template;
    expect(shipActionsAvailable(t, 2)).toBe(0);
    expect(shipActionsAvailable(t, 3)).toBe(1);
    expect(shipActionsAvailable(t, 19)).toBe(1);
    expect(shipActionsAvailable(t, 20)).toBe(2);
    expect(shipActionsAvailable(t, 40)).toBe(3);
    expect(shipActionsAvailable(t, 80)).toBe(3);
  });

  it('is 0 for templates without shipActions', () => {
    expect(shipActionsAvailable(makeShip({}, 4, null).template, 80)).toBe(0);
  });

  it('maps weapons to their Fire action', () => {
    const t = makeShip().template;
    expect(actionForWeapon(t, 'ballista_2')?.id).toBe('fire_ballista');
    expect(actionForWeapon(t, 'mangonel_1')?.id).toBe('fire_mangonel');
    expect(actionForWeapon(t, 'harpoon')).toBeUndefined();
  });
});

describe('actions used', () => {
  it('derives Move from movementUsed and de-duplicates', () => {
    const v = makeShip();
    expect(shipActionsUsedFor(v, turn())).toEqual([]);
    expect(shipActionsUsedFor(v, turn({ movementUsed: { v1: 15 } }))).toEqual(['move']);
    expect(shipActionsUsedFor(v, turn({ movementUsed: { v1: 15 }, shipActionsUsed: { v1: ['fire_ballista', 'move'] } })))
      .toEqual(['fire_ballista', 'move']);
  });

  it('summarises remaining and over budget', () => {
    const v = makeShip();
    expect(shipActionSummary(v, turn({ crewAssignments: crew(25), shipActionsUsed: { v1: ['fire_ballista'] } })))
      .toEqual({ available: 2, used: ['fire_ballista'], remaining: 1, over: 0, crewAboard: 25 });
    expect(shipActionSummary(v, turn({
      crewAssignments: [...crew(5), ...crew(10, 'passengers')],
      movementUsed: { v1: 10 },
      shipActionsUsed: { v1: ['fire_ballista'] },
    }))).toEqual({ available: 1, used: ['fire_ballista', 'move'], remaining: 0, over: 1, crewAboard: 5 });
  });
});
