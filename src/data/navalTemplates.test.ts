import { describe, it, expect } from 'vitest';
import type { VehicleTemplate } from '../types';
import { ROWBOAT, KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY } from './navalTemplates';

const part = (t: VehicleTemplate, id: string) => t.components?.find((c) => c.id === id);

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
