import { describe, it, expect } from 'vitest';
import { makeCustomNpc } from './customNpc';

describe('makeCustomNpc', () => {
  it('builds the sidebar custom NPC: plain 10s, enemy, full HP, no position', () => {
    const c = makeCustomNpc({ name: 'Hobgoblin Archer', hp: 11, ac: 18, speed: 30 });
    expect(c).toMatchObject({ name: 'Hobgoblin Archer', currentHp: 11, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy' });
    expect(c.position).toBeUndefined();
    expect(c.statblock).toMatchObject({
      name: 'Hobgoblin Archer', source: 'custom', size: 'medium', type: 'humanoid', alignment: 'neutral', ac: 18, maxHp: 11,
      hitDice: '3d8', speed: { walk: 30 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, cr: '1',
    });
  });
  it('takes preset size, type, CR and initiative', () => {
    const c = makeCustomNpc({ name: 'Imp', hp: 10, ac: 13, speed: 20, initiative: 7, size: 'tiny', type: 'fiend', cr: '1' });
    expect(c).toMatchObject({ initiative: 7, statblock: { size: 'tiny', type: 'fiend', cr: '1' } });
    expect(makeCustomNpc({ name: 'a', hp: 5, ac: 10, speed: 30 }).id).not.toBe(makeCustomNpc({ name: 'a', hp: 5, ac: 10, speed: 30 }).id);
  });
});
