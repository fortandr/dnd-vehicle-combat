import { describe, it, expect } from 'vitest';
import type { VehicleComponent } from '../types';
import { withWindSpeed, withSpeedLoss } from './movementFields';

const base: VehicleComponent = { id: 's', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45 };

describe('withWindSpeed', () => {
  it('fills the other side with base speed so a half-entered pair still works', () => {
    expect(withWindSpeed(base, 'with', '60')).toEqual({ with: 60, into: 45 });
    expect(withWindSpeed({ ...base, windSpeeds: { with: 60, into: 45 } }, 'into', '15')).toEqual({ with: 60, into: 15 });
  });
  it('clears when both sides equal base speed', () => {
    expect(withWindSpeed({ ...base, windSpeeds: { with: 60, into: 45 } }, 'with', '')).toBeUndefined();
  });
});

describe('withSpeedLoss', () => {
  it('sets each part, keeping the other', () => {
    expect(withSpeedLoss(base, 'feet', '5')).toEqual({ feet: 5, perDamage: 0 });
    expect(withSpeedLoss({ ...base, speedLoss: { feet: 5, perDamage: 0 } }, 'perDamage', '25')).toEqual({ feet: 5, perDamage: 25 });
  });
  it('clears when both are empty/zero', () => {
    expect(withSpeedLoss({ ...base, speedLoss: { feet: 5, perDamage: 0 } }, 'feet', '')).toBeUndefined();
  });
});
