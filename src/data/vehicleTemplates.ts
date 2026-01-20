/**
 * Vehicle Templates from Descent into Avernus (5e)
 * Based on official published stats from Baldur's Gate: Descent into Avernus
 */

import { VehicleTemplate, VehicleZone, WeaponTemplate } from '../types';

// ==========================================
// Weapon Definitions (from DiA)
// ==========================================

// ==========================================
// Alternative Weapon Stations (Swappable)
// These can replace standard weapon stations
// ==========================================

export const ACIDIC_BILE_SPRAYER: WeaponTemplate = {
  id: 'acidic_bile_sprayer',
  name: 'Acidic Bile Sprayer',
  damage: '9d8 acid (DC 12 Dex)',
  attackBonus: 0, // Save-based
  range: '30 ft cone',
  properties: ['Requires 1 crew', 'Recharge 5-6', 'Save-based'],
  specialEffect: 'Each creature in a 30-foot cone must make a DC 12 Dexterity saving throw. A creature reduced to 0 HP is dissolved.',
  crewRequired: 1,
};

export const FLAMETHROWER: WeaponTemplate = {
  id: 'flamethrower',
  name: 'Flamethrower',
  damage: '4d8 fire (DC 15 Dex)',
  attackBonus: 0, // Save-based
  range: '60 ft line',
  properties: ['Requires 1 crew', 'Save-based', '5 ft wide line'],
  specialEffect: 'Each creature in a 60-foot line (5 ft wide) must make a DC 15 Dexterity saving throw. Ignites flammable objects.',
  crewRequired: 1,
};

export const INFERNAL_SCREAMER: WeaponTemplate = {
  id: 'infernal_screamer',
  name: 'Infernal Screamer',
  damage: '4d12 psychic (DC 15 Wis)',
  attackBonus: 0, // Save-based
  range: '120 ft',
  properties: ['Requires 1 crew', 'Save-based', 'Single target'],
  specialEffect: 'Target one creature within 120 feet. It must make a DC 15 Wisdom saving throw.',
  crewRequired: 1,
};

export const STYX_SPRAYER: WeaponTemplate = {
  id: 'styx_sprayer',
  name: 'Styx Sprayer',
  damage: 'Feeblemind (DC 20 Int)',
  attackBonus: 5,
  range: '30 ft',
  properties: ['Requires 1 crew', 'Ammunition (3 uses)', 'Ranged spell attack'],
  specialEffect: 'On hit, target is affected by feeblemind spell (DC 20 Int save). Effect becomes permanent after 30 days if not cured.',
  crewRequired: 1,
};

// Standard Harpoon Flinger (default for most weapon stations)
export const HARPOON_FLINGER_STANDARD: WeaponTemplate = {
  id: 'harpoon_flinger_standard',
  name: 'Harpoon Flinger',
  damage: '2d8 piercing',
  attackBonus: 5,
  range: '120 ft',
  properties: ['Requires 1 crew', 'Ammunition (10 harpoons)'],
  crewRequired: 1,
};

// List of all swappable weapons for weapon station customization
export const SWAPPABLE_WEAPONS: WeaponTemplate[] = [
  HARPOON_FLINGER_STANDARD,
  ACIDIC_BILE_SPRAYER,
  FLAMETHROWER,
  INFERNAL_SCREAMER,
  STYX_SPRAYER,
];

// ==========================================
// Armor Upgrades (Vehicle can have one)
// ==========================================

export interface ArmorUpgrade {
  id: string;
  name: string;
  description: string;
  effect: string;
  acModifier?: number; // Change to AC calculation
  fixedAC?: number; // Fixed AC value (+ Dex)
  additionalImmunities?: string[];
  resistances?: string[];
}

export const ARMOR_UPGRADES: ArmorUpgrade[] = [
  {
    id: 'none',
    name: 'None',
    description: 'Standard infernal iron plating.',
    effect: 'No special effects.',
  },
  {
    id: 'canian_armor',
    name: 'Canian Armor',
    description: 'Infernal iron mined from Cania, the coldest layer of the Nine Hells.',
    effect: 'AC becomes 22 + Dex modifier. Attack rolls have advantage against the vehicle while not moving. Immunity to cold damage and extreme cold effects.',
    fixedAC: 22,
    additionalImmunities: ['cold'],
  },
  {
    id: 'gilded_death_armor',
    name: 'Gilded Death Armor',
    description: 'Gold stolen from the archdevil Mammon plates the exterior.',
    effect: 'Resistance to bludgeoning, piercing, and slashing damage. Gold turns to dust if vehicle is destroyed.',
    resistances: ['bludgeoning', 'piercing', 'slashing'],
  },
  {
    id: 'soul_spike_armor',
    name: 'Soul Spike Armor',
    description: 'Covered with spikes inscribed with blasphemous symbols. Ghostly figures wail in agony.',
    effect: 'Creatures that die within 30 ft have their soul trapped on the spikes (can\'t be raised). Spikes: AC 19, 15 HP, resistance to all damage except radiant.',
  },
];

// ==========================================
// Magical Gadgets (Vehicle can have multiple)
// ==========================================

export interface MagicalGadget {
  id: string;
  name: string;
  description: string;
  effect: string;
  activation: string; // "bonus action", etc.
  recharge: string; // "24 hours", etc.
}

export const MAGICAL_GADGETS: MagicalGadget[] = [
  {
    id: 'necrotic_smoke_screen',
    name: 'Necrotic Smoke Screen',
    description: 'Expels a 30-foot cube of opaque necrotic smoke.',
    effect: 'Creates heavily obscured area for 1 minute. Creatures in the cloud take 6d6 necrotic damage when entering or starting turn there. Dispersed by strong wind.',
    activation: 'Bonus action',
    recharge: '24 hours',
  },
  {
    id: 'teleporter',
    name: 'Teleporter',
    description: 'Teleports the vehicle up to 300 feet.',
    effect: 'Vehicle teleports to an unoccupied space the driver can see within 300 feet. All creatures and objects in contact teleport with it.',
    activation: 'Bonus action',
    recharge: '24 hours',
  },
];

// ==========================================
// Standard Vehicle Weapons
// ==========================================

const HARPOON_FLINGER_TORMENTOR: WeaponTemplate = {
  id: 'harpoon_flinger',
  name: 'Harpoon Flinger',
  damage: '2d8+2 piercing',
  attackBonus: 7,
  range: '120 ft',
  properties: ['Requires 1 crew to operate', 'Ammunition (10 harpoons)'],
  crewRequired: 1,
};

const HARPOON_FLINGER_DEMON_GRINDER: WeaponTemplate = {
  id: 'harpoon_flinger',
  name: 'Harpoon Flinger',
  damage: '2d8 piercing',
  attackBonus: 5,
  range: '120 ft',
  properties: ['Requires 1 crew to operate', 'Ammunition (10 harpoons)'],
  crewRequired: 1,
};

const HARPOON_FLINGER_SCAVENGER: WeaponTemplate = {
  id: 'harpoon_flinger',
  name: 'Harpoon Flinger',
  damage: '2d8+1 piercing',
  attackBonus: 6,
  range: '120 ft',
  properties: ['Requires 1 crew to operate', 'Ammunition (10 harpoons)'],
  crewRequired: 1,
};

const CHOMPER: WeaponTemplate = {
  id: 'chomper',
  name: 'Chomper',
  damage: '6d6+4 piercing',
  attackBonus: 9,
  range: 'melee (5 ft)',
  properties: ['Requires 1 crew to operate'],
  specialEffect: 'A target reduced to 0 hit points by this damage is ground to bits. Any nonmagical items the target was holding or carrying are destroyed as well.',
  crewRequired: 1,
};

const WRECKING_BALL: WeaponTemplate = {
  id: 'wrecking_ball',
  name: 'Wrecking Ball',
  damage: '8d8+4 bludgeoning',
  attackBonus: 9,
  range: 'melee (15 ft)',
  properties: ['Requires 1 crew to operate'],
  specialEffect: 'Double the damage if the target is an object or a structure.',
  crewRequired: 1,
};

const GRAPPLING_CLAW: WeaponTemplate = {
  id: 'grappling_claw',
  name: 'Grappling Claw',
  damage: 'Grapple',
  attackBonus: 10,
  range: 'melee (15 ft)',
  properties: ['Requires 1 crew to operate'],
  specialEffect: 'The target is grappled (escape DC 12). If the target is a creature, it is restrained until the grapple ends. The grappling claw can grapple only one target at a time, and the claw\'s operator can use a bonus action to make the claw release whatever it\'s holding.',
  crewRequired: 1,
};

const BUZZ_SAW: WeaponTemplate = {
  id: 'buzz_saw',
  name: 'Buzz Saw',
  damage: '3d10+3 slashing',
  attackBonus: 8,
  range: 'melee (5 ft)',
  properties: ['Magical', 'Driver can attack while driving'],
  specialEffect: 'If the Buzz Killer moves at least 40 feet in a straight line toward a target and then hits, the target takes an extra 9 (2d8) slashing damage (Aggressive Charge).',
  crewRequired: 0, // Part of Helm action
};

// ==========================================
// Vehicle Templates (Official DiA Stats)
// ==========================================

/**
 * Devil's Ride - Infernal Motorcycle
 * Two-wheeled infernal war machine. Fast and maneuverable.
 * AC 23 (19 while motionless)
 */
export const DEVILS_RIDE: VehicleTemplate = {
  id: 'devils_ride',
  name: "Devil's Ride",
  description: 'Two-wheeled infernal war machine that handles like a motorcycle. Spiked wheels, screaming engine, and devil-visage cowl with horn handlebars. Fast and maneuverable.',
  maxHp: 30,
  ac: 23, // 19 while motionless
  speed: 120,
  damageThreshold: 5,
  mishapThreshold: 10,
  crewCapacity: 1,
  cargoCapacity: 100,
  size: 'large',
  weight: 500,
  abilityScores: { str: 14, dex: 18, con: 12 },
  zones: [
    {
      id: 'helm',
      name: 'Helm',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'rear', 'left', 'right'],
      description: 'Driver position. Grants half cover.',
    },
  ],
  weapons: [],
  traits: [
    {
      name: 'Jump',
      description: "If the Devil's Ride moves at least 30 feet in a straight line, it can clear up to 60 feet when jumping over a chasm, ravine, or gap. Each foot cleared costs a foot of movement.",
    },
    {
      name: 'Prone Deficiency',
      description: "If the Devil's Ride falls prone, it can't right itself and is incapacitated until pulled upright.",
    },
    {
      name: 'Stunt',
      description: "On its turn, the driver can expend 10 feet of movement to perform one free vehicle stunt (wheelie, burnout, etc.). Before the stunt can be performed, the Devil's Ride must move at least 10 feet in a straight line. If the driver succeeds on a DC 10 Dexterity check using the bike's Dexterity, the stunt is successful. Otherwise, the driver is unable to perform the stunt and can't attempt another stunt until the start of its next turn. If the check fails by 5 or more, the Devil's Ride and all creatures riding it immediately fall prone as the bike wipes out and comes to a dead stop.",
    },
  ],
  reactions: [
    {
      name: 'Juke',
      description: "If the Devil's Ride is able to move, the driver can use its reaction to grant the Devil's Ride advantage on a Dexterity saving throw.",
    },
  ],
  immunities: ['fire', 'poison', 'psychic'],
};

/**
 * Buzz Killer - Custom Motor Trike
 * A fast, aggressive close-quarters combat vehicle with a massive saw blade front wheel
 * AC 22 (19 while motionless)
 */
export const BUZZ_KILLER: VehicleTemplate = {
  id: 'buzz_killer',
  name: 'Buzz Killer',
  description: 'Custom infernal war machine designed like a motor trike. A massive circular saw blade serves as the front wheel, with two smaller spiked wheels in the rear. Built for aggressive close-quarters combat with room for a driver and passenger.',
  maxHp: 50,
  ac: 22, // 19 while motionless
  speed: 110,
  damageThreshold: 8,
  mishapThreshold: 15,
  crewCapacity: 2,
  cargoCapacity: 200,
  size: 'large',
  weight: 1200,
  abilityScores: { str: 16, dex: 16, con: 14 },
  zones: [
    {
      id: 'helm',
      name: 'Helm',
      cover: 'three_quarters',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front'],
      description: 'Driver position. Three-quarters cover. Driver can make Buzz Saw attacks while driving.',
    },
    {
      id: 'passenger',
      name: 'Passenger Seat',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'rear', 'left', 'right'],
      description: 'Elevated passenger seat. Half cover. The elevated position grants the passenger +2 to attack rolls.',
    },
  ],
  weapons: [
    { ...BUZZ_SAW, id: 'buzz_saw_main' },
  ],
  traits: [
    {
      name: 'Buzz Saw Wheel',
      description: "When the Buzz Killer moves within 5 feet of a creature that isn't prone or another vehicle for the first time on a turn, it can rake the creature or vehicle with its massive saw blade for 19 (3d10 + 3) slashing damage. A creature moves out of the way and takes no damage if it succeeds on a DC 14 Dexterity saving throw. A vehicle moves out of the way and takes no damage if its driver succeeds on the saving throw. Additionally, the Buzz Killer can move through the space of any Medium or smaller creature. When it does, the creature must succeed on a DC 14 Dexterity saving throw or take 16 (3d10) slashing damage and be knocked prone. This trait can't be used against a particular creature more than once each turn.",
    },
    {
      name: 'Prone Deficiency',
      description: "If the Buzz Killer falls prone, it can't right itself and is incapacitated until pulled upright.",
    },
    {
      name: 'Magic Weapons',
      description: "The Buzz Killer's weapon attacks are magical.",
    },
    {
      name: 'Aggressive Charge',
      description: 'If the Buzz Killer moves at least 40 feet in a straight line and then forces a target to make a saving throw against its Buzz Saw Wheel on the same turn, that target takes an extra 9 (2d8) slashing damage (whether or not they succeed on the save).',
    },
  ],
  reactions: [
    {
      name: 'Juke',
      description: 'If the Buzz Killer is able to move, the driver can use its reaction to grant the Buzz Killer advantage on a Dexterity saving throw.',
    },
  ],
  immunities: ['fire', 'poison', 'psychic'],
};

/**
 * Tormentor - Light Assault Vehicle
 * Handles like a dune buggy, designed for raiding and scouting.
 * AC 21 (19 while motionless)
 */
export const TORMENTOR: VehicleTemplate = {
  id: 'tormentor',
  name: 'Tormentor',
  description: 'Handles like a dune buggy, designed for raiding and scouting. Bladed iron wheels drive the vehicle forward with protruding scythes along the sides.',
  maxHp: 100,
  ac: 21, // 19 while motionless
  speed: 100,
  damageThreshold: 10,
  mishapThreshold: 20,
  crewCapacity: 4,
  cargoCapacity: 500,
  size: 'huge',
  weight: 3000,
  abilityScores: { str: 16, dex: 14, con: 14 },
  zones: [
    {
      id: 'helm',
      name: 'Helm',
      cover: 'three_quarters',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front'],
      description: 'Driver position. Three-quarters cover.',
    },
    {
      id: 'harpoon_station',
      name: 'Harpoon Flinger',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'left', 'right'],
      description: 'Harpoon flinger station. Half cover.',
    },
    {
      id: 'passenger_area',
      name: 'Passenger Area',
      cover: 'half',
      capacity: 2,
      canAttackOut: true,
      visibleFromArcs: ['front', 'rear', 'left', 'right'],
      description: 'Passenger positions. Half cover. Can make ranged or reach melee attacks.',
    },
  ],
  weapons: [
    { ...HARPOON_FLINGER_TORMENTOR, id: 'harpoon_main' },
  ],
  traits: [
    {
      name: 'Crushing Wheels',
      description: "The Tormentor can move through the space of any Medium or smaller creature. When it does, the creature must succeed on a DC 13 Dexterity saving throw or take 11 (2d10) bludgeoning damage and be knocked prone. If the creature was already prone, it takes an extra 11 (2d10) bludgeoning damage. This trait can't be used against a particular creature more than once each turn.",
    },
    {
      name: 'Prone Deficiency',
      description: 'If the Tormentor rolls over and falls prone, it can\'t right itself and is incapacitated until flipped upright.',
    },
    {
      name: 'Magic Weapons',
      description: "The Tormentor's weapon attacks are magical.",
    },
    {
      name: 'Raking Scythes',
      description: "When the Tormentor moves within 5 feet of a creature that isn't prone or another vehicle for the first time on a turn, it can rake the creature or vehicle with its protruding blades for 13 (2d10 + 2) slashing damage. A creature moves out of the way and takes no damage if it succeeds on a DC 13 Dexterity saving throw. A vehicle moves out of the way and takes no damage if its driver succeeds on the saving throw.",
    },
  ],
  reactions: [
    {
      name: 'Juke',
      description: 'If the Tormentor is able to move, the driver can use its reaction to grant the Tormentor advantage on a Dexterity saving throw.',
    },
  ],
  immunities: ['fire', 'poison', 'psychic'],
};

/**
 * Demon Grinder - War Machine
 * Bulky, armored coach. Handles like a garbage truck.
 * AC 19 (no motionless penalty)
 */
export const DEMON_GRINDER: VehicleTemplate = {
  id: 'demon_grinder',
  name: 'Demon Grinder',
  description: 'Bulky, armored coach that rumbles loudly as it crushes obstacles with a swinging wrecking ball. Iron jaws mounted on front. Handles like a garbage truck.',
  maxHp: 200,
  ac: 19,
  speed: 100,
  damageThreshold: 10,
  mishapThreshold: 20,
  crewCapacity: 8,
  cargoCapacity: 2000, // 1 ton
  size: 'gargantuan',
  weight: 12000,
  abilityScores: { str: 18, dex: 10, con: 18 },
  zones: [
    {
      id: 'helm',
      name: 'Helm',
      cover: 'three_quarters',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front'],
      description: 'Driver position. Three-quarters cover.',
    },
    {
      id: 'chomper_station',
      name: 'Chomper Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front'],
      description: 'Main chomper at the front. Half cover.',
    },
    {
      id: 'wrecking_ball_station',
      name: 'Wrecking Ball Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['left', 'right', 'rear'],
      description: 'Wrecking ball station. Half cover.',
    },
    {
      id: 'harpoon_station_port',
      name: 'Port Weapon Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'left'],
      description: 'Port-side weapon station. Fires in 180° arc (front + left). Half cover.',
    },
    {
      id: 'harpoon_station_starboard',
      name: 'Starboard Weapon Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'right'],
      description: 'Starboard-side weapon station. Fires in 180° arc (front + right). Half cover.',
    },
    {
      id: 'passenger_area',
      name: 'Passenger Area',
      cover: 'three_quarters',
      capacity: 3,
      canAttackOut: true,
      visibleFromArcs: ['front', 'rear', 'left', 'right'],
      description: 'Interior passenger area. Three-quarters cover.',
    },
  ],
  weapons: [
    { ...CHOMPER, id: 'chomper_main' },
    { ...WRECKING_BALL, id: 'wrecking_ball_main' },
    { ...HARPOON_FLINGER_DEMON_GRINDER, id: 'harpoon_port' },
    { ...HARPOON_FLINGER_DEMON_GRINDER, id: 'harpoon_starboard' },
  ],
  traits: [
    {
      name: 'Crushing Wheels',
      description: "The Demon Grinder can move through the space of any Large or smaller creature. When it does, the creature must succeed on a DC 11 Dexterity saving throw or take 22 (4d10) bludgeoning damage and be knocked prone. If the creature was already prone, it takes an extra 22 (4d10) bludgeoning damage. This trait can't be used against a particular creature more than once each turn.",
    },
    {
      name: 'Magic Weapons',
      description: "The Demon Grinder's weapon attacks are magical.",
    },
    {
      name: 'Prone Deficiency',
      description: 'If the Demon Grinder rolls over and falls prone, it can\'t right itself and is incapacitated until flipped upright.',
    },
  ],
  immunities: ['fire', 'poison', 'psychic'],
};

/**
 * Scavenger - Heavy Salvage Vehicle
 * Handles like a small bus. Used for sifting through battlefield detritus.
 * AC 20 (19 while motionless)
 */
export const SCAVENGER: VehicleTemplate = {
  id: 'scavenger',
  name: 'Scavenger',
  description: 'Handles like a small bus and is used to sift through battlefield detritus for scrap metal and salvage. Attached to the back is a swinging crane with an iron grappling claw fastened to the end of a winch and a 50-foot-long chain.',
  maxHp: 150,
  ac: 20, // 19 while motionless
  speed: 100,
  damageThreshold: 10,
  mishapThreshold: 20,
  crewCapacity: 8,
  cargoCapacity: 4000, // 2 tons
  size: 'huge',
  weight: 9000,
  abilityScores: { str: 20, dex: 12, con: 20 },
  zones: [
    {
      id: 'helm',
      name: 'Helm',
      cover: 'three_quarters',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front'],
      description: 'Driver position. Three-quarters cover.',
    },
    {
      id: 'grappling_claw_station',
      name: 'Grappling Claw Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['rear', 'left', 'right'],
      description: 'Crane-mounted grappling claw. Half cover.',
    },
    {
      id: 'harpoon_station_port',
      name: 'Port Weapon Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'left'],
      description: 'Port-side weapon station. Fires in 180° arc (front + left). Half cover.',
    },
    {
      id: 'harpoon_station_starboard',
      name: 'Starboard Weapon Station',
      cover: 'half',
      capacity: 1,
      canAttackOut: true,
      visibleFromArcs: ['front', 'right'],
      description: 'Starboard-side weapon station. Fires in 180° arc (front + right). Half cover.',
    },
    {
      id: 'passenger_area',
      name: 'Passenger Area',
      cover: 'three_quarters',
      capacity: 4,
      canAttackOut: true,
      visibleFromArcs: ['front', 'rear', 'left', 'right'],
      description: 'Interior passenger area. Three-quarters cover.',
    },
  ],
  weapons: [
    { ...GRAPPLING_CLAW, id: 'grappling_claw_main' },
    { ...HARPOON_FLINGER_SCAVENGER, id: 'harpoon_port' },
    { ...HARPOON_FLINGER_SCAVENGER, id: 'harpoon_starboard' },
  ],
  traits: [
    {
      name: 'Crushing Wheels',
      description: "The Scavenger can move through the space of any Large or smaller creature. When it does, the creature must succeed on a DC 12 Dexterity saving throw or take 16 (3d10) bludgeoning damage and be knocked prone. If the creature was already prone, it takes an extra 16 (3d10) bludgeoning damage. This trait can't be used against a particular creature more than once each turn.",
    },
    {
      name: 'Magic Weapons',
      description: "The Scavenger's weapon attacks are magical.",
    },
    {
      name: 'Prone Deficiency',
      description: 'If the Scavenger rolls over and falls prone, it can\'t right itself and is incapacitated until flipped upright.',
    },
  ],
  immunities: ['fire', 'poison', 'psychic'],
};

// ==========================================
// Export All Templates
// ==========================================
export const VEHICLE_TEMPLATES: VehicleTemplate[] = [
  DEVILS_RIDE,
  BUZZ_KILLER,
  TORMENTOR,
  DEMON_GRINDER,
  SCAVENGER,
];

export function getVehicleTemplate(id: string): VehicleTemplate | undefined {
  return VEHICLE_TEMPLATES.find(v => v.id === id);
}
