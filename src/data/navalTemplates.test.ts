import { describe, it, expect } from 'vitest';
import type { VehicleTemplate } from '../types';
import { ROWBOAT, KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY } from './navalTemplates';

const part = (t: VehicleTemplate, id: string) => t.components?.find((c) => c.id === id);

describe('Saltmarsh ship actions (GoS stat blocks / 5e.tools actionThresholds)', () => {
  const summary = (t: VehicleTemplate) => ({
    names: t.shipActions?.actions.map((a) => a.name),
    thresholds: t.shipActions?.crewThresholds,
  });

  it('action names and crew thresholds', () => {
    expect(summary(ROWBOAT)).toEqual({ names: ['Move'], thresholds: [1] });
    expect(summary(KEELBOAT)).toEqual({ names: ['Fire Ballista', 'Move'], thresholds: [1, 2] });
    expect(summary(LONGSHIP)).toEqual({ names: ['Move'], thresholds: [1] });
    expect(summary(SAILING_SHIP)).toEqual({ names: ['Fire Ballista', 'Fire Mangonel', 'Move'], thresholds: [3, 10, 20] });
    expect(summary(WARSHIP)).toEqual({ names: ['Fire Ballistas', 'Fire Mangonels', 'Move'], thresholds: [3, 10, 20] });
    expect(summary(GALLEY)).toEqual({ names: ['Fire Ballistas', 'Fire Mangonels', 'Move'], thresholds: [3, 20, 40] });
  });

  it('every Fire action covers exactly the ship\'s weapons of that kind', () => {
    for (const t of [KEELBOAT, SAILING_SHIP, WARSHIP, GALLEY]) {
      for (const kind of ['ballista', 'mangonel']) {
        const action = t.shipActions!.actions.find((a) => a.id === `fire_${kind}`);
        const weaponIds = t.weapons.filter((w) => w.id.startsWith(kind)).map((w) => w.id);
        if (weaponIds.length === 0) {
          expect(action).toBeUndefined();
        } else {
          expect(action?.weaponIds).toEqual(weaponIds);
        }
      }
    }
  });
});

describe('Saltmarsh ship movement data (spec table)', () => {
  it('oars: speed, speed loss, crew required', () => {
    expect(part(ROWBOAT, 'oars')).toMatchObject({ speed: 15 });
    expect(part(ROWBOAT, 'oars')?.speedLoss).toBeUndefined();
    expect(part(KEELBOAT, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 } });
    expect(part(KEELBOAT, 'oars')?.crewRequired).toBeUndefined();
    expect(part(LONGSHIP, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 20 });
    expect(part(WARSHIP, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 20 });
    expect(part(GALLEY, 'oars')).toMatchObject({ speed: 30, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 40 });
  });

  it('sails: base / into / with, speed loss', () => {
    expect(part(KEELBOAT, 'sails')).toMatchObject({ speed: 25, windSpeeds: { into: 15, with: 35 }, speedLoss: { feet: 5, perDamage: 20 } });
    expect(part(LONGSHIP, 'sails')).toMatchObject({ speed: 45, windSpeeds: { into: 15, with: 60 }, speedLoss: { feet: 10, perDamage: 25 } });
    expect(part(SAILING_SHIP, 'sails')).toMatchObject({ speed: 45, windSpeeds: { into: 15, with: 60 }, speedLoss: { feet: 5, perDamage: 25 } });
    expect(part(WARSHIP, 'sails')).toMatchObject({ speed: 35, windSpeeds: { into: 15, with: 50 }, speedLoss: { feet: 10, perDamage: 25 } });
    expect(part(GALLEY, 'sails')).toMatchObject({ speed: 35, windSpeeds: { into: 15, with: 50 }, speedLoss: { feet: 10, perDamage: 25 } });
  });

  it('wind/crew notes are no longer only in description text', () => {
    for (const t of [KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY]) {
      for (const c of t.components ?? []) {
        expect(c.description ?? '').not.toMatch(/with the wind|Requires at least/);
      }
    }
  });
});
