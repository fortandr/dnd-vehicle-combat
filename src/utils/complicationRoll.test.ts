import { describe, it, expect } from 'vitest';
import { resolveComplicationRoll } from './complicationRoll';

describe('resolveComplicationRoll', () => {
  it('a roll of 1 or 2 is a Creature Chase and opens the creature picker', () => {
    for (const roll of [1, 2]) {
      const r = resolveComplicationRoll(roll, 'tactical');
      expect(r.complication?.name).toBe('Creature Chase');
      expect(r.rollRange).toBe('1-2');
      expect(r.modal).toBe('creatureChase');
      expect(r.logLine).toContain('Creature Chase');
    }
  });

  it('a complication with a skill check opens the resolution modal', () => {
    // 3 = Fire Tornado on the Avernus table, which carries a DEX save
    const r = resolveComplicationRoll(3, 'tactical');
    expect(r.complication).not.toBeNull();
    expect(r.complication?.mechanicalEffect?.skillCheck).toBeTruthy();
    expect(r.modal).toBe('resolution');
    expect(r.logLine).toBe(`Complication Roll: 3 - ${r.complication!.name}`);
    expect(r.logDetails).toBe(r.complication!.effect);
  });

  it('a roll of 11 or higher is no complication and opens the plain info modal', () => {
    const r = resolveComplicationRoll(17, 'tactical');
    expect(r.complication).toBeNull();
    expect(r.modal).toBe('info');
    expect(r.logLine).toBe('Complication Roll: 17 - No complication');
    expect(r.logDetails).toMatch(/no additional threats/);
  });

  it('an info-only complication (no skill check) opens the plain info modal', () => {
    // Walk the table for any 3-10 result without a skill check; skip if none exist.
    const infoOnly = [3, 4, 5, 6, 7, 8, 9, 10]
      .map((roll) => resolveComplicationRoll(roll, 'tactical'))
      .find((r) => r.complication && !r.complication.mechanicalEffect?.skillCheck);
    if (!infoOnly) return;
    expect(infoOnly.modal).toBe('info');
  });
});
