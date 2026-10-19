import { describe, it, expect } from 'vitest';
import type { CrewAssignment, Vehicle, VehicleComponent, VehicleTemplate } from '../types';
import {
  windSpeedBand,
  componentSpeed,
  getPropulsionSpeed,
  nominalPropulsionSpeed,
  countCrewAboard,
  speedReasonLabel,
  findUndermanned,
  encounterHasSailingShips,
} from './navalMovement';

const SAILS: VehicleComponent = {
  id: 'sails', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45,
  windSpeeds: { with: 60, into: 15 }, speedLoss: { feet: 5, perDamage: 25 },
};
const OARS: VehicleComponent = {
  id: 'oars', name: 'Oars', kind: 'movement', ac: 12, maxHp: 100, speed: 30,
  speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 40,
};
const HULL: VehicleComponent = { id: 'hull', name: 'Hull', kind: 'hull', ac: 15, maxHp: 500 };

function makeVehicle(components: VehicleComponent[] | undefined, overrides: Partial<Vehicle> = {}): Vehicle {
  const template = {
    id: 't', name: 'Test', description: '', maxHp: 500, ac: 15, speed: 45, damageThreshold: 0,
    mishapThreshold: 999, crewCapacity: 40, zones: [], weapons: [], components,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Test', type: 'party', template, currentHp: 500, currentSpeed: 45,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}

describe('windSpeedBand', () => {
  // Wind from N blows toward 180°.
  it('dead downwind is with, dead upwind is into, abeam is cross', () => {
    expect(windSpeedBand(180, 'N')).toBe('with');
    expect(windSpeedBand(0, 'N')).toBe('into');
    expect(windSpeedBand(90, 'N')).toBe('cross');
    expect(windSpeedBand(270, 'N')).toBe('cross');
  });

  it('exactly 45° off downwind or upwind counts as cross', () => {
    expect(windSpeedBand(135, 'N')).toBe('cross');
    expect(windSpeedBand(225, 'N')).toBe('cross');
    expect(windSpeedBand(45, 'N')).toBe('cross');
    expect(windSpeedBand(315, 'N')).toBe('cross');
  });

  it('inside 45° is with/into', () => {
    expect(windSpeedBand(150, 'N')).toBe('with');
    expect(windSpeedBand(30, 'N')).toBe('into');
  });

  it('wraps around north', () => {
    // Wind from S blows toward 0°.
    expect(windSpeedBand(350, 'S')).toBe('with');
    expect(windSpeedBand(10, 'S')).toBe('with');
    expect(windSpeedBand(180, 'S')).toBe('into');
  });

  it('no wind is calm', () => {
    expect(windSpeedBand(180, undefined)).toBe('calm');
  });
});

describe('componentSpeed', () => {
  it('sails use wind speeds by heading and base speed when calm or abeam', () => {
    expect(componentSpeed(makeVehicle([SAILS], { facing: 180 }), SAILS, 'N', 0)).toEqual({
      componentId: 'sails', speed: 60, reasons: [{ kind: 'with_wind' }],
    });
    expect(componentSpeed(makeVehicle([SAILS], { facing: 0 }), SAILS, 'N', 0).speed).toBe(15);
    expect(componentSpeed(makeVehicle([SAILS], { facing: 90 }), SAILS, 'N', 0).speed).toBe(45);
    expect(componentSpeed(makeVehicle([SAILS], { facing: 180 }), SAILS, undefined, 0).speed).toBe(45);
  });

  it('into-wind reports the into_wind reason', () => {
    expect(componentSpeed(makeVehicle([SAILS], { facing: 0 }), SAILS, 'N', 0).reasons).toEqual([{ kind: 'into_wind' }]);
  });

  it('combines wind and damage', () => {
    const v = makeVehicle([SAILS], { facing: 180, componentHp: { sails: 50 } }); // with wind 60, 50 damage → −10
    expect(componentSpeed(v, SAILS, 'N', 0).speed).toBe(50);
  });

  it('loses speed in steps of perDamage', () => {
    const at = (hp: number) => componentSpeed(makeVehicle([SAILS], { componentHp: { sails: hp } }), SAILS, undefined, 0);
    expect(at(76).speed).toBe(45); // 24 damage
    expect(at(75)).toEqual({ componentId: 'sails', speed: 40, reasons: [{ kind: 'damage_loss', feet: 5 }] }); // 25
    expect(at(40).speed).toBe(35); // 60 damage → 2 steps
  });

  it('speed loss cannot go below 0', () => {
    const v = makeVehicle([SAILS], { facing: 0, componentHp: { sails: 1 } }); // 99 dmg → −15 from into-wind 15
    expect(componentSpeed(v, SAILS, 'N', 0).speed).toBe(0);
  });

  it('enforces crewRequired', () => {
    const v = makeVehicle([OARS]);
    expect(componentSpeed(v, OARS, undefined, 39)).toEqual({
      componentId: 'oars', speed: 0, reasons: [{ kind: 'undermanned', have: 39, need: 40 }],
    });
    expect(componentSpeed(v, OARS, undefined, 40).speed).toBe(30);
    expect(componentSpeed(v, OARS, undefined, 80).speed).toBe(30);
  });

  it('oars ignore wind', () => {
    expect(componentSpeed(makeVehicle([OARS], { facing: 0 }), OARS, 'N', 40).speed).toBe(30);
  });

  it('a destroyed component contributes 0', () => {
    const v = makeVehicle([SAILS], { componentHp: { sails: 0 } });
    expect(componentSpeed(v, SAILS, undefined, 0)).toEqual({
      componentId: 'sails', speed: 0, reasons: [{ kind: 'destroyed' }],
    });
  });
});

describe('getPropulsionSpeed', () => {
  it('takes the best movement component', () => {
    // Facing into the wind: sails 15, oars 30 with full crew → oars win.
    const v = makeVehicle([HULL, SAILS, OARS], { facing: 0 });
    const p = getPropulsionSpeed(v, 'N', 40);
    expect(p.speed).toBe(30);
    expect(p.componentId).toBe('oars');
    expect(p.parts.map((x) => x.componentId)).toEqual(['sails', 'oars']);
  });

  it('undermanned galley still sails', () => {
    const v = makeVehicle([HULL, SAILS, OARS], { facing: 180 });
    const p = getPropulsionSpeed(v, 'N', 12);
    expect(p.speed).toBe(60);
    expect(p.componentId).toBe('sails');
    expect(findUndermanned(p)).toEqual({ have: 12, need: 40 });
  });

  it('findUndermanned is null when crew is sufficient', () => {
    const p = getPropulsionSpeed(makeVehicle([HULL, SAILS, OARS], { facing: 0 }), 'N', 40);
    expect(findUndermanned(p)).toBeNull();
  });

  it('all movement destroyed → 0', () => {
    const v = makeVehicle([HULL, SAILS, OARS], { componentHp: { sails: 0, oars: 0 } });
    expect(getPropulsionSpeed(v, undefined, 40).speed).toBe(0);
  });

  it('no movement components → Infinity (land vehicles unaffected)', () => {
    expect(getPropulsionSpeed(makeVehicle(undefined), 'N', 0)).toEqual({ speed: Infinity, reasons: [], parts: [] });
    expect(getPropulsionSpeed(makeVehicle([HULL]), 'N', 0).speed).toBe(Infinity);
  });
});

describe('nominalPropulsionSpeed', () => {
  it('is the best calm undamaged speed, or null without movement parts', () => {
    expect(nominalPropulsionSpeed(makeVehicle([HULL, SAILS, OARS], { componentHp: { sails: 0 } }))).toBe(45);
    expect(nominalPropulsionSpeed(makeVehicle(undefined))).toBeNull();
  });
});

describe('countCrewAboard', () => {
  it('counts assignments on this vehicle, excluding passengers', () => {
    const a: CrewAssignment[] = [
      { creatureId: 'c1', vehicleId: 'v1', zoneId: 'helm' },
      { creatureId: 'c2', vehicleId: 'v1', zoneId: 'deck_crew' },
      { creatureId: 'c3', vehicleId: 'v1', zoneId: 'passengers' },
      { creatureId: 'c4', vehicleId: 'v2', zoneId: 'deck_crew' },
    ];
    expect(countCrewAboard('v1', a)).toBe(2);
  });
});

describe('speedReasonLabel', () => {
  it('formats each reason', () => {
    expect(speedReasonLabel({ kind: 'with_wind' })).toBe('with wind');
    expect(speedReasonLabel({ kind: 'into_wind' })).toBe('into wind');
    expect(speedReasonLabel({ kind: 'damage_loss', feet: 20 })).toBe('−20 ft (damage)');
    expect(speedReasonLabel({ kind: 'undermanned', have: 12, need: 40 })).toBe('undermanned (12/40)');
    expect(speedReasonLabel({ kind: 'destroyed' })).toBe('destroyed');
  });
});

describe('encounterHasSailingShips', () => {
  it('true only when some vehicle has a component with windSpeeds', () => {
    expect(encounterHasSailingShips([makeVehicle([HULL, OARS])])).toBe(false);
    expect(encounterHasSailingShips([makeVehicle(undefined), makeVehicle([SAILS])])).toBe(true);
    expect(encounterHasSailingShips([])).toBe(false);
  });
});
