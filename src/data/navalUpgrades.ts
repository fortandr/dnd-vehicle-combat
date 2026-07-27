/**
 * Naval customization pack — "Superior Ship Upgrades" from Ghosts of Saltmarsh,
 * Appendix A. The water-side analog to the Avernus armor upgrades / magical
 * gadgets. Installed per-ship (Vehicle.navalUpgradeIds) and shown only on naval
 * vehicles (see isNavalVehicle + the pack gate in VehicleCard).
 *
 * Upgrades are grouped by the component they enhance. In the book most categories
 * cap how many a ship can take (one hull, one per movement/weapon component, one
 * figurehead; miscellaneous are unlimited) — VVTT lets the DM toggle freely and
 * surfaces the category so those limits are easy to honor.
 */
export type NavalUpgradeCategory = 'hull' | 'movement' | 'weapon' | 'figurehead' | 'misc';

export interface NavalUpgrade {
  id: string;
  name: string;
  category: NavalUpgradeCategory;
  activation: string; // e.g. 'Passive', 'Action', 'Action · recharge 1d4 hrs'
  effect: string;
}

export const NAVAL_UPGRADE_CATEGORIES: { key: NavalUpgradeCategory; label: string }[] = [
  { key: 'hull', label: 'Hull' },
  { key: 'movement', label: 'Movement (sails / oars)' },
  { key: 'weapon', label: 'Weapon' },
  { key: 'figurehead', label: 'Figurehead' },
  { key: 'misc', label: 'Miscellaneous' },
];

export const NAVAL_UPGRADES: NavalUpgrade[] = [
  // ---- Hull ----
  { id: 'churning_hull', name: 'Churning Hull', category: 'hull', activation: 'Passive',
    effect: 'Water within 210 ft. of the ship is difficult terrain for everything except this ship.' },
  { id: 'death_vessel', name: 'Death Vessel', category: 'hull', activation: 'Action · recharge 1d4 hrs',
    effect: 'Pulse of dread: each hostile creature on board or within 210 ft. makes a DC 14 Wis save or is frightened of the ship for 1 min (immune 24 hrs on a success).' },
  { id: 'frost_locked_hull', name: 'Frost-Locked Hull', category: 'hull', activation: 'Passive',
    effect: "The ship's components are immune to cold and vulnerable to fire. It can move at full speed over ice of any thickness." },
  { id: 'living_vessel', name: 'Living Vessel', category: 'hull', activation: 'Passive',
    effect: '+2 to all Constitution checks and saves. While it has at least 1 HP, the ship regains 10 HP every minute.' },
  { id: 'reinforced_hull', name: 'Reinforced Hull', category: 'hull', activation: 'Passive',
    effect: "Doubles the hull's hit point maximum." },
  { id: 'vigilant_watch', name: 'Vigilant Watch', category: 'hull', activation: 'Passive',
    effect: 'Invisible creatures are visible while on the ship or within 120 ft. of it.' },

  // ---- Movement ----
  { id: 'clockwork_oars', name: 'Clockwork Oars', category: 'movement', activation: 'Passive',
    effect: 'The oars require only one crew member to operate.' },
  { id: 'ever_full_sails', name: 'Ever-Full Sails', category: 'movement', activation: 'Passive',
    effect: 'The ship moves at 60 ft. regardless of its direction relative to the wind.' },
  { id: 'defiant_sails', name: 'Defiant Sails', category: 'movement', activation: 'Passive',
    effect: 'While the sails are unfurled, ranged attacks against the ship and anyone aboard have disadvantage (not if the attacker is aboard).' },
  { id: 'dragon_sails', name: 'Dragon Sails', category: 'movement', activation: 'Passive',
    effect: 'The sails gain +3 AC and resistance to a damage type set by the dragon scales used to craft them.' },
  { id: 'screaming_sails', name: 'Screaming Sails', category: 'movement', activation: 'Action · recharge 2d6 hrs',
    effect: 'Howl: each hostile creature aboard or within 300 ft. makes a DC 14 Wis save or takes 4d6 psychic damage and is frightened for 1 min.' },
  { id: 'scything_oars', name: 'Scything Oars', category: 'movement', activation: 'Passive',
    effect: 'When the ship moves with these oars, any creature or object in the water within 10 ft. of its path makes a DC 10 Dex save, taking 2d6 slashing (half on a success).' },

  // ---- Weapon ----
  { id: 'arcane_artillery', name: 'Arcane Artillery', category: 'weapon', activation: 'Passive',
    effect: 'The weapon gains +2 to attack and damage rolls, and its attacks count as magical.' },
  { id: 'concussive_rounds', name: 'Concussive Rounds', category: 'weapon', activation: 'Passive',
    effect: "On a hit to a vehicle's hull, that vehicle's speed decreases by 2d10 ft. until the start of the attacker's next turn." },
  { id: 'explosive_rounds', name: 'Explosive Rounds', category: 'weapon', activation: 'Passive',
    effect: 'On a hit, the weapon deals an extra 2d6 fire damage.' },
  { id: 'grasping_rounds', name: 'Grasping Rounds', category: 'weapon', activation: 'Passive',
    effect: "On a hit to a ship, that vehicle makes a DC 14 Str save or can't move away from the attacker; an action ends the effect." },

  // ---- Figurehead ----
  { id: 'guardian_figurehead', name: 'Guardian Figurehead', category: 'figurehead', activation: 'Action · 1/24 hrs',
    effect: "Animates as an iron golem that acts on the ship's turn (via one of the ship's actions) for 1 min, then returns to the prow." },
  { id: 'red_dragon_figurehead', name: 'Red Dragon Figurehead', category: 'figurehead', activation: 'Action · recharge 1 min',
    effect: '60-ft. cone of flame: DC 12 Dex save, 21 (6d6) fire damage (half on a success).' },
  { id: 'storm_giant_figurehead', name: 'Storm Giant Figurehead', category: 'figurehead', activation: 'Action · recharge 1 min',
    effect: '60-ft. cone: DC 12 Con save, 14 (4d6) thunder damage (half on a success); pushed 10 ft. on a failure.' },

  // ---- Miscellaneous ----
  { id: 'bones_of_endless_toil', name: 'Bones of Endless Toil', category: 'misc', activation: 'Passive',
    effect: "When a humanoid dies aboard, it makes a DC 12 Wis save or rises as a zombie crew member obedient to the captain (up to the ship's creature capacity)." },
  { id: 'smugglers_banner', name: "Smuggler's Banner", category: 'misc', activation: 'Action · recharge 2d6 days',
    effect: 'Flies a convincing false flag. As an action, teleport the ship and all friendly creatures aboard up to 3 miles to a known destination.' },
  { id: 'taskmasters_drums', name: "Taskmaster's Drums", category: 'misc', activation: 'Action · recharge 2d10 hrs',
    effect: 'For 1 min, the ship gains one additional action, as long as it has at least one action.' },
];

// Ships and other water vehicles get the naval upgrade pack.
export function isNavalVehicle(template: { pack?: string; environment?: string }): boolean {
  return template.pack === 'naval' || template.environment === 'water';
}
