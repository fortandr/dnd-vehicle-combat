import { v4 as uuid } from 'uuid';
import type { Creature, Statblock } from '../types';

export interface CustomNpcInput {
  name: string;
  hp: number;
  ac: number;
  speed: number;
  initiative?: number;
  size?: Statblock['size'];
  type?: string;
  cr?: string;
}

/** The sidebar's custom NPC (and the Squads tab's "Custom NPC…"): plain 10s, enemy faction, no position. */
export function makeCustomNpc(input: CustomNpcInput): Creature {
  const statblock: Statblock = {
    id: uuid(),
    name: input.name,
    source: 'custom',
    size: input.size ?? 'medium',
    type: input.type ?? 'humanoid',
    alignment: 'neutral',
    ac: input.ac,
    maxHp: input.hp,
    hitDice: `${Math.ceil(input.hp / 5)}d8`,
    speed: { walk: input.speed },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    senses: 'passive Perception 10',
    languages: 'Common',
    cr: input.cr ?? '1',
  };
  return {
    id: uuid(),
    name: input.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: input.initiative ?? 0,
    initiativeModifier: 0,
    faction: 'enemy',
  };
}
