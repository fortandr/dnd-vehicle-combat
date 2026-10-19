import { describe, it, expect } from 'vitest';
import type { Mishap, SpeedModifier, Vehicle, VehicleComponent, VehicleTemplate } from '../types';
import { getEffectiveSpeed, getSpeedBreakdown, speedChange, speedReasonText } from './vehicleSpeed';

const SAILS: VehicleComponent = {
  id: 'sails', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45,
  windSpeeds: { with: 60, into: 15 }, speedLoss: { feet: 5, perDamage: 25 },
};
const OARS: VehicleComponent = { id: 'oars', name: 'Oars', kind: 'movement', ac: 12, maxHp: 100, speed: 30, crewRequired: 40 };

function makeVehicle(components: VehicleComponent[] | undefined, overrides: Partial<Vehicle> = {}): Vehicle {
  const template = {
    id: 't', name: 'Test', description: '', maxHp: 300, ac: 15, speed: 45, damageThreshold: 0,
    mishapThreshold: 20, crewCapacity: 40, zones: [], weapons: [], components,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Test', type: 'party', template, currentHp: 300, currentSpeed: 100,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}
const mishap = (speedReduction: number) => ({ mechanicalEffect: { speedReduction } }) as unknown as Mishap;
const half = { multiplier: 0.5 } as unknown as SpeedModifier;
const NO_CREW = { crewAssignments: [] };

describe('land vehicles (no movement components) — regression', () => {
  it('use currentSpeed, minus mishaps, clamped at 0', () => {
    expect(getEffectiveSpeed(makeVehicle(undefined), NO_CREW)).toBe(100);
    expect(getEffectiveSpeed(makeVehicle(undefined, { activeMishaps: [mishap(20)] }), NO_CREW)).toBe(80);
    expect(getEffectiveSpeed(makeVehicle(undefined, { activeMishaps: [mishap(150)] }), NO_CREW)).toBe(0);
  });

  it('apply speed modifier multipliers after mishaps', () => {
    const v = makeVehicle(undefined, { activeMishaps: [mishap(20)], speedModifiers: [half] });
    expect(getEffectiveSpeed(v, NO_CREW)).toBe(40);
  });

  it('ignore wind, and nominal = currentSpeed', () => {
    const b = getSpeedBreakdown(makeVehicle(undefined), { wind: 'N', crewAssignments: [] });
    expect(b).toMatchObject({ nominal: 100, effective: 100, isShip: false });
  });
});

describe('ships (movement components)', () => {
  it('derive speed from components, ignoring currentSpeed', () => {
    const v = makeVehicle([SAILS], { facing: 180, currentSpeed: 10 });
    const b = getSpeedBreakdown(v, { wind: 'N', crewAssignments: [] });
    expect(b).toMatchObject({ nominal: 45, effective: 60, isShip: true });
    expect(b.propulsion.reasons).toEqual([{ kind: 'with_wind' }]);
  });

  it('half speed halves the wind-adjusted speed', () => {
    const v = makeVehicle([SAILS], { facing: 180, speedModifiers: [half] });
    expect(getEffectiveSpeed(v, { wind: 'N', crewAssignments: [] })).toBe(30);
  });

  it('counts crew from assignments for oars', () => {
    const v = makeVehicle([OARS]);
    const crew = Array.from({ length: 40 }, (_, i) => ({ creatureId: `c${i}`, vehicleId: 'v1', zoneId: 'deck_crew' }));
    expect(getEffectiveSpeed(v, { crewAssignments: crew })).toBe(30);
    expect(getEffectiveSpeed(v, { crewAssignments: crew.slice(1) })).toBe(0);
  });
});

describe('speedChange / speedReasonText', () => {
  const sailing = (facing: number, o: Partial<Vehicle> = {}) => makeVehicle([SAILS], { facing, ...o });

  it('ship with a wind boost is up', () => {
    expect(speedChange(getSpeedBreakdown(sailing(180), { wind: 'N', crewAssignments: [] }))).toBe('up');
  });

  it('ship sailing into the wind is down', () => {
    expect(speedChange(getSpeedBreakdown(sailing(0), { wind: 'N', crewAssignments: [] }))).toBe('down');
  });

  it('land vehicle with a mishap is down', () => {
    const v = makeVehicle(undefined, { activeMishaps: [mishap(20)] });
    expect(speedChange(getSpeedBreakdown(v, NO_CREW))).toBe('down');
  });

  it('unaffected land vehicle is none', () => {
    expect(speedChange(getSpeedBreakdown(makeVehicle(undefined), NO_CREW))).toBe('none');
  });

  it('reason text joins propulsion reasons with speed effects', () => {
    const v = sailing(180, { speedModifiers: [half] });
    const ctx = { wind: 'N' as const, crewAssignments: [] };
    expect(speedReasonText(v, getSpeedBreakdown(v, ctx))).toBe('with wind · speed effects');
  });

  it('reason text is empty when nothing applies', () => {
    const v = makeVehicle(undefined);
    expect(speedReasonText(v, getSpeedBreakdown(v, NO_CREW))).toBe('');
  });
});
