import { describe, it, expect } from 'vitest';
import type { Vehicle, VehicleComponent, VehicleTemplate } from '../types';
import { GALLEY } from '../data/navalTemplates';
import { backfillNavalMovement } from './navalBackfill';

const strip = (c: VehicleComponent): VehicleComponent => {
  if (c.kind !== 'movement') return c;
  const { windSpeeds: _w, speedLoss: _s, crewRequired: _c, description: _d, ...rest } = c;
  return rest;
};

function makeVehicle(template: VehicleTemplate): Vehicle {
  return {
    id: 'v1', name: 'Test', type: 'party', template, currentHp: 300, currentSpeed: 35,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
  } as unknown as Vehicle;
}
const strippedGalley = (): VehicleTemplate => ({ ...GALLEY, components: GALLEY.components!.map(strip) });
const part = (v: Vehicle, id: string) => v.template.components!.find((c) => c.id === id)!;

describe('backfillNavalMovement', () => {
  it('restores wind speeds, speed loss and oar crew on a stripped galley', () => {
    const out = backfillNavalMovement(makeVehicle(strippedGalley()));
    expect(part(out, 'oars').crewRequired).toBe(40);
    expect(part(out, 'oars').speedLoss).toEqual({ feet: 5, perDamage: 25 });
    expect(part(out, 'sails').windSpeeds).toEqual({ with: 50, into: 15 });
    expect(part(out, 'sails').speedLoss).toEqual({ feet: 10, perDamage: 25 });
  });

  it('leaves a non-naval vehicle untouched (same reference)', () => {
    const v = makeVehicle({ ...GALLEY, id: 'avernus-thing', components: undefined });
    expect(backfillNavalMovement(v)).toBe(v);
  });

  it('leaves a ship that already has the fields untouched (same reference)', () => {
    const v = makeVehicle(GALLEY);
    expect(backfillNavalMovement(v)).toBe(v);
  });

  it('leaves a customised component alone', () => {
    const t = strippedGalley();
    t.components = t.components!.map((c) => (c.id === 'oars' ? { ...c, crewRequired: 10 } : c));
    const out = backfillNavalMovement(makeVehicle(t));
    expect(part(out, 'oars').crewRequired).toBe(10);
    expect(part(out, 'oars').speedLoss).toBeUndefined();
    expect(part(out, 'sails').windSpeeds).toEqual({ with: 50, into: 15 });
  });
});
