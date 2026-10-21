/**
 * Open5e (SRD) monster search and conversion to VVTT creatures.
 * Moved from Sidebar.tsx so the Squads tab can staff monsters too.
 */
import { v4 as uuid } from 'uuid';
import type { Creature, Statblock } from '../types';

// Open5e API types
interface Open5eAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage_dice?: string;
  damage_bonus?: number;
}

export interface Open5eMonster {
  slug: string;
  name: string;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  armor_class: number;
  armor_desc?: string;
  hit_points: number;
  hit_dice: string;
  speed: {
    walk?: number;
    fly?: number;
    swim?: number;
    burrow?: number;
    climb?: number;
  };
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  strength_save?: number;
  dexterity_save?: number;
  constitution_save?: number;
  intelligence_save?: number;
  wisdom_save?: number;
  charisma_save?: number;
  perception?: number;
  skills?: Record<string, number>;
  damage_vulnerabilities: string;
  damage_resistances: string;
  damage_immunities: string;
  condition_immunities: string;
  senses: string;
  languages: string;
  challenge_rating: string;
  cr?: number;
  actions?: Open5eAction[];
  bonus_actions?: Open5eAction[];
  reactions?: Open5eAction[];
  legendary_actions?: Open5eAction[];
  legendary_desc?: string;
  special_abilities?: Open5eAction[];
  document__title: string;
}

interface Open5eResponse {
  count: number;
  results: Open5eMonster[];
}

// Convert Open5e size to our size format
function mapOpen5eSize(size: string): 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan' {
  const sizeMap: Record<string, 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan'> = {
    'Tiny': 'tiny',
    'Small': 'small',
    'Medium': 'medium',
    'Large': 'large',
    'Huge': 'huge',
    'Gargantuan': 'gargantuan',
  };
  return sizeMap[size] || 'medium';
}

// Convert Open5e action to our StatblockAction type
function convertOpen5eAction(action: Open5eAction): { name: string; description: string; attackBonus?: number; damage?: string } {
  return {
    name: action.name,
    description: action.desc,
    attackBonus: action.attack_bonus,
    damage: action.damage_dice ? `${action.damage_dice}${action.damage_bonus ? `+${action.damage_bonus}` : ''}` : undefined,
  };
}

// Parse comma-separated string to array
function parseStringToArray(str: string): string[] | undefined {
  if (!str || str.trim() === '') return undefined;
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

// Convert Open5e monster to our Creature type
export function convertOpen5eToCreature(monster: Open5eMonster, position?: { x: number; y: number }): Creature {
  // Build saving throws object
  const savingThrows: Partial<Record<'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha', number>> = {};
  if (monster.strength_save !== undefined) savingThrows.str = monster.strength_save;
  if (monster.dexterity_save !== undefined) savingThrows.dex = monster.dexterity_save;
  if (monster.constitution_save !== undefined) savingThrows.con = monster.constitution_save;
  if (monster.intelligence_save !== undefined) savingThrows.int = monster.intelligence_save;
  if (monster.wisdom_save !== undefined) savingThrows.wis = monster.wisdom_save;
  if (monster.charisma_save !== undefined) savingThrows.cha = monster.charisma_save;

  const statblock: Statblock = {
    id: uuid(),
    name: monster.name,
    source: 'srd', // Open5e serves SRD content
    size: mapOpen5eSize(monster.size),
    type: monster.type.toLowerCase(),
    subtype: monster.subtype,
    alignment: monster.alignment || 'neutral',
    ac: monster.armor_class,
    acType: monster.armor_desc,
    maxHp: monster.hit_points,
    hitDice: monster.hit_dice || `${Math.ceil(monster.hit_points / 5)}d8`,
    speed: {
      walk: monster.speed.walk || 30,
      fly: monster.speed.fly,
      swim: monster.speed.swim,
      burrow: monster.speed.burrow,
      climb: monster.speed.climb,
    },
    abilities: {
      str: monster.strength,
      dex: monster.dexterity,
      con: monster.constitution,
      int: monster.intelligence,
      wis: monster.wisdom,
      cha: monster.charisma,
    },
    savingThrows: Object.keys(savingThrows).length > 0 ? savingThrows : undefined,
    skills: monster.skills,
    damageVulnerabilities: parseStringToArray(monster.damage_vulnerabilities),
    damageResistances: parseStringToArray(monster.damage_resistances),
    damageImmunities: parseStringToArray(monster.damage_immunities),
    conditionImmunities: parseStringToArray(monster.condition_immunities),
    senses: monster.senses || 'passive Perception 10',
    languages: monster.languages || 'None',
    cr: monster.challenge_rating,
    traits: monster.special_abilities?.map(a => ({ name: a.name, description: a.desc })),
    actions: monster.actions?.map(convertOpen5eAction),
    bonusActions: monster.bonus_actions?.map(convertOpen5eAction),
    reactions: monster.reactions?.map(convertOpen5eAction),
    legendaryActions: monster.legendary_actions?.map(convertOpen5eAction),
  };

  // Calculate initiative modifier from dexterity (but don't auto-roll)
  const dexMod = Math.floor((monster.dexterity - 10) / 2);

  return {
    id: uuid(),
    name: monster.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: 0, // Don't auto-roll, use "Roll Init" button
    initiativeModifier: dexMod,
    faction: 'enemy', // Monsters from Open5e default to enemy
    ...(position ? { position } : {}),
  };
}

// Fetch monsters from Open5e API
export async function searchOpen5e(query: string): Promise<Open5eMonster[]> {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(
      `https://api.open5e.com/v1/monsters/?search=${encodeURIComponent(query)}&limit=20`
    );
    if (!response.ok) throw new Error('API request failed');
    const data: Open5eResponse = await response.json();
    return data.results;
  } catch (error) {
    console.error('Open5e search error:', error);
    return [];
  }
}
