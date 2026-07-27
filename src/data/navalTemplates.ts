/**
 * Naval vehicle templates — Ghosts of Saltmarsh, Appendix A "Of Ships and the Sea".
 * See NAVAL_MECHANICS_SALTMARSH.md for the transcribed source stats.
 *
 * These use the faithful component model (VehicleComponent[]): each ship's hull,
 * helm, sails/oars, and weapon stations carry their own AC/HP. The core
 * maxHp/ac/damageThreshold mirror the HULL so the ships stay playable in the
 * current single-HP engine until per-component combat lands (see the plan doc).
 *
 * Crew stations: like the Avernus vehicles, each ship gets a Helm, one station
 * per weapon (capacity 1, so a gunner can be assigned), and a Deck Crew / Rowers
 * station holding the remaining crew. Station capacities sum to crewCapacity.
 * Each weapon sets `zoneId` so it maps to its own station on add.
 */
import type { VehicleTemplate, VehicleComponent, WeaponTemplate, VehicleZone, CoverType } from '../types';

// Ships resolve damage via naval hazards, not the Avernus mishap table — set the
// mishap trigger far out of reach so it never fires.
const NAVAL_MISHAP_THRESHOLD = 999;

const ALL_ARCS: ('front' | 'rear' | 'left' | 'right')[] = ['front', 'rear', 'left', 'right'];

// ---- Siege weapon builders (firing stats; each sits in its own station) ----
function ballistaWeapon(id: string): WeaponTemplate {
  return {
    id,
    name: 'Ballista',
    damage: '3d10 piercing',
    attackBonus: 6,
    range: '120/480 ft',
    crewRequired: 1,
    properties: ['Requires 1 crew'],
    zoneId: `st_${id}`,
  };
}
function mangonelWeapon(id: string): WeaponTemplate {
  return {
    id,
    name: 'Mangonel',
    damage: '5d10 bludgeoning',
    attackBonus: 5,
    range: '200/800 ft',
    crewRequired: 1,
    properties: ['Requires 1 crew', "Can't hit within 60 ft"],
    specialEffect: "Can't hit targets within 60 feet of it.",
    zoneId: `st_${id}`,
  };
}

// ---- Component builders (per-part AC/HP) ----
function hull(ac: number, maxHp: number, damageThreshold?: number): VehicleComponent {
  return { id: 'hull', name: 'Hull', kind: 'hull', ac, maxHp, damageThreshold, description: 'If the hull is destroyed, the ship is wrecked.' };
}
function helm(ac: number, maxHp: number): VehicleComponent {
  return { id: 'helm', name: 'Helm', kind: 'control', ac, maxHp, description: 'If destroyed, the ship can’t turn.' };
}
function oars(ac: number, maxHp: number, speed: number, note?: string): VehicleComponent {
  return { id: 'oars', name: 'Oars', kind: 'movement', ac, maxHp, speed, description: note ?? 'Movement component (oars).' };
}
function sails(ac: number, maxHp: number, speed: number, withWind: number, intoWind: number): VehicleComponent {
  return {
    id: 'sails',
    name: 'Sails',
    kind: 'movement',
    ac,
    maxHp,
    speed,
    description: `Movement component (sails). ${withWind} ft. with the wind, ${intoWind} ft. into the wind.`,
  };
}
function ballistaComponent(id: string): VehicleComponent {
  return { id, name: 'Ballista', kind: 'weapon', ac: 15, maxHp: 50, crewRequired: 1 };
}
function mangonelComponent(id: string): VehicleComponent {
  return { id, name: 'Mangonel', kind: 'weapon', ac: 15, maxHp: 100, crewRequired: 1 };
}
const NAVAL_RAM: VehicleComponent = {
  id: 'naval_ram',
  name: 'Naval Ram',
  kind: 'other',
  ac: 20,
  maxHp: 100,
  damageThreshold: 10,
  description: 'On a crash, the ship has advantage on crash saves and the crash damage applies to the ram, not the ship.',
};

// ---- Zone (crew station) builders ----
function helmZone(): VehicleZone {
  return { id: 'helm', name: 'Helm', cover: 'half', capacity: 1, canAttackOut: false, visibleFromArcs: ALL_ARCS };
}
// A single-gunner station for the weapon whose id is `weaponId` (matches its zoneId).
function weaponStation(weaponId: string, label: string): VehicleZone {
  return { id: `st_${weaponId}`, name: label, cover: 'half', capacity: 1, canAttackOut: true, visibleFromArcs: ALL_ARCS };
}
function crewDeck(capacity: number, name = 'Deck Crew', cover: CoverType = 'half', bulk = true): VehicleZone {
  return { id: 'deck_crew', name, cover, capacity, canAttackOut: true, visibleFromArcs: ALL_ARCS, bulk };
}
// Ride-along passengers (the party) — book passenger capacity, shown as a bulk count.
function passengers(capacity: number): VehicleZone {
  return { id: 'passengers', name: 'Passengers', cover: 'half', capacity, canAttackOut: true, visibleFromArcs: ALL_ARCS, bulk: true };
}

export const ROWBOAT: VehicleTemplate = {
  id: 'rowboat',
  name: 'Rowboat',
  description: 'A humble Large boat for ferrying passengers or navigating lakes and rivers.',
  maxHp: 50,
  ac: 11,
  speed: 15,
  damageThreshold: 0,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 2,
  cargoCapacity: 500,
  weight: 100,
  abilityScores: { str: 11, dex: 8, con: 11 },
  lengthFt: 10,
  beamFt: 5,
  size: 'large',
  environment: 'water',
  zones: [crewDeck(2, 'Oars & Deck', 'none', false), passengers(2)],
  weapons: [],
  components: [
    hull(11, 50),
    { id: 'oars', name: 'Oars', kind: 'movement', ac: 12, maxHp: 25, speed: 15, description: 'Control & movement. Without oars, speed is 0.' },
  ],
};

export const KEELBOAT: VehicleTemplate = {
  id: 'keelboat',
  name: 'Keelboat',
  description: 'One of the smallest sailing vessels — sailed or rowed by a single person.',
  maxHp: 100,
  ac: 15,
  speed: 25,
  damageThreshold: 10,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 3,
  cargoCapacity: 1000,
  abilityScores: { str: 16, dex: 7, con: 13 },
  lengthFt: 60,
  beamFt: 20,
  size: 'gargantuan',
  environment: 'water',
  zones: [helmZone(), weaponStation('ballista', 'Ballista'), crewDeck(1), passengers(4)],
  weapons: [ballistaWeapon('ballista')],
  components: [
    hull(15, 100, 10),
    helm(12, 50),
    oars(12, 100, 20),
    sails(12, 100, 25, 35, 15),
    ballistaComponent('ballista'),
  ],
};

export const LONGSHIP: VehicleTemplate = {
  id: 'longship',
  name: 'Longship',
  description: 'A fast oar-and-sail vessel used to carry soldiers into surprise strikes.',
  maxHp: 300,
  ac: 15,
  speed: 45,
  damageThreshold: 15,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 40,
  cargoCapacity: 20000,
  abilityScores: { str: 20, dex: 6, con: 17 },
  lengthFt: 70,
  beamFt: 20,
  size: 'gargantuan',
  environment: 'water',
  zones: [helmZone(), crewDeck(39, 'Rowers & Deck'), passengers(100)],
  weapons: [],
  components: [
    hull(15, 300, 15),
    helm(16, 50),
    oars(12, 100, 20, 'Movement component (oars). Requires at least 20 crew.'),
    sails(12, 100, 45, 60, 15),
  ],
};

export const SAILING_SHIP: VehicleTemplate = {
  id: 'sailing_ship',
  name: 'Sailing Ship',
  description: 'A fast-moving vessel focused on travel, lightly armed with a ballista and mangonel.',
  maxHp: 300,
  ac: 15,
  speed: 45,
  damageThreshold: 15,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 30,
  cargoCapacity: 200000,
  abilityScores: { str: 20, dex: 7, con: 17 },
  lengthFt: 100,
  beamFt: 20,
  size: 'gargantuan',
  environment: 'water',
  zones: [
    helmZone(),
    weaponStation('ballista', 'Ballista'),
    weaponStation('mangonel', 'Mangonel'),
    crewDeck(27),
    passengers(20),
  ],
  weapons: [ballistaWeapon('ballista'), mangonelWeapon('mangonel')],
  components: [
    hull(15, 300, 15),
    helm(18, 50),
    sails(12, 100, 45, 60, 15),
    ballistaComponent('ballista'),
    mangonelComponent('mangonel'),
  ],
};

export const WARSHIP: VehicleTemplate = {
  id: 'warship',
  name: 'Warship',
  description: 'A slower but heavily armed vessel: two ballistas, two mangonels, and a naval ram.',
  maxHp: 500,
  ac: 15,
  speed: 35,
  damageThreshold: 20,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 40,
  cargoCapacity: 400000,
  abilityScores: { str: 20, dex: 4, con: 20 },
  lengthFt: 100,
  beamFt: 20,
  size: 'gargantuan',
  environment: 'water',
  zones: [
    helmZone(),
    weaponStation('ballista_1', 'Ballista 1'),
    weaponStation('ballista_2', 'Ballista 2'),
    weaponStation('mangonel_1', 'Mangonel 1'),
    weaponStation('mangonel_2', 'Mangonel 2'),
    crewDeck(35),
    passengers(60),
  ],
  weapons: [
    ballistaWeapon('ballista_1'),
    ballistaWeapon('ballista_2'),
    mangonelWeapon('mangonel_1'),
    mangonelWeapon('mangonel_2'),
  ],
  components: [
    hull(15, 500, 20),
    helm(18, 50),
    oars(12, 100, 20, 'Movement component (oars). Requires at least 20 crew.'),
    sails(12, 100, 35, 50, 15),
    ballistaComponent('ballista_1'),
    ballistaComponent('ballista_2'),
    mangonelComponent('mangonel_1'),
    mangonelComponent('mangonel_2'),
    NAVAL_RAM,
  ],
};

export const GALLEY: VehicleTemplate = {
  id: 'galley',
  name: 'Galley',
  description: 'A long war/cargo vessel driven by a huge rowing crew and sails; four ballistas, two mangonels, and a naval ram.',
  maxHp: 500,
  ac: 15,
  speed: 35,
  damageThreshold: 20,
  mishapThreshold: NAVAL_MISHAP_THRESHOLD,
  crewCapacity: 80,
  cargoCapacity: 300000,
  abilityScores: { str: 24, dex: 4, con: 20 },
  lengthFt: 130,
  beamFt: 20,
  size: 'gargantuan',
  environment: 'water',
  zones: [
    helmZone(),
    weaponStation('ballista_1', 'Ballista 1'),
    weaponStation('ballista_2', 'Ballista 2'),
    weaponStation('ballista_3', 'Ballista 3'),
    weaponStation('ballista_4', 'Ballista 4'),
    weaponStation('mangonel_1', 'Mangonel 1'),
    weaponStation('mangonel_2', 'Mangonel 2'),
    crewDeck(73, 'Rowers & Deck'),
    passengers(40),
  ],
  weapons: [
    ballistaWeapon('ballista_1'),
    ballistaWeapon('ballista_2'),
    ballistaWeapon('ballista_3'),
    ballistaWeapon('ballista_4'),
    mangonelWeapon('mangonel_1'),
    mangonelWeapon('mangonel_2'),
  ],
  components: [
    hull(15, 500, 20),
    helm(16, 50),
    oars(12, 100, 30, 'Movement component (oars). Requires at least 40 crew.'),
    sails(12, 100, 35, 50, 15),
    ballistaComponent('ballista_1'),
    ballistaComponent('ballista_2'),
    ballistaComponent('ballista_3'),
    ballistaComponent('ballista_4'),
    mangonelComponent('mangonel_1'),
    mangonelComponent('mangonel_2'),
    NAVAL_RAM,
  ],
};

export const NAVAL_TEMPLATES: VehicleTemplate[] = [
  ROWBOAT,
  KEELBOAT,
  LONGSHIP,
  SAILING_SHIP,
  WARSHIP,
  GALLEY,
].map((t) => ({ ...t, pack: 'naval' }));
