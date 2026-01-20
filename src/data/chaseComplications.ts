/**
 * Chase Complications from DMG and Descent into Avernus
 *
 * DMG Chase Rules (p.252-255):
 * - At the start of its turn, a participant can freely use the Dash action
 * - Each participant rolls d20 for complications at the end of their turn
 * - Roll of 11-20: No complication
 * - Roll of 1-10: Complication occurs
 *
 * Avernus-specific complications represent the hellish terrain
 */

import { ChaseComplication, ScaleName } from '../types';

// ==========================================
// DMG Urban Chase Complications (d20)
// ==========================================
export const DMG_URBAN_COMPLICATIONS: ChaseComplication[] = [
  {
    roll: 1,
    name: 'Large Obstacle',
    description: 'A large obstacle such as a cart, debris, or crowd blocks your path.',
    effect: 'Make DC 10 Dexterity (Acrobatics) check to get past. Fail: Obstacle is difficult terrain.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Acrobatics',
        dc: 10,
        failureEffect: 'Treat as difficult terrain this turn',
      },
    },
  },
  {
    roll: 2,
    name: 'Crowd',
    description: 'A crowd blocks your way.',
    effect: 'Make DC 10 Strength (Athletics) or Dexterity (Acrobatics) check. Fail: Speed halved this turn.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Athletics or Acrobatics',
        dc: 10,
        failureEffect: 'Speed halved this turn',
      },
    },
  },
  {
    roll: 3,
    name: 'Large Window',
    description: 'A window or other barrier you can crash through.',
    effect: 'Make DC 10 Strength save. Fail: 2d4 slashing damage and speed halved.',
    mechanicalEffect: {
      damage: '2d4 slashing',
      speedChange: -50,
    },
  },
  {
    roll: 4,
    name: 'Stairs',
    description: 'A flight of stairs or steep slope.',
    effect: 'Make DC 10 Dexterity (Acrobatics) check. Fail: Fall prone at bottom.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Acrobatics',
        dc: 10,
        failureEffect: 'Fall prone at bottom of stairs',
      },
    },
  },
  {
    roll: 5,
    name: 'Alley',
    description: 'A narrow alley that requires squeezing through.',
    effect: 'Speed halved while in alley.',
    mechanicalEffect: {
      speedChange: -50,
    },
  },
  {
    roll: 6,
    name: 'Poor Surface',
    description: 'Slippery or uneven ground.',
    effect: 'Make DC 10 Dexterity (Acrobatics) check. Fail: Fall prone.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Acrobatics',
        dc: 10,
        failureEffect: 'Fall prone',
      },
    },
  },
  {
    roll: 7,
    name: 'Bystander',
    description: 'A bystander gets in your way.',
    effect: 'Make DC 10 Dexterity save. Fail: Both you and bystander fall prone.',
  },
  {
    roll: 8,
    name: 'Dead End',
    description: 'An apparent dead end requires improvisation.',
    effect: 'Make DC 10 Intelligence check. Fail: Lose turn finding alternate route.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Intelligence',
        dc: 10,
        failureEffect: 'Lose turn',
      },
    },
  },
  {
    roll: 9,
    name: 'Gap',
    description: 'A gap you must jump across.',
    effect: 'Make DC 10 Strength (Athletics) check. Fail: Fall, take 1d6 bludgeoning damage.',
    mechanicalEffect: {
      damage: '1d6 bludgeoning',
    },
  },
  {
    roll: 10,
    name: 'Barrier',
    description: 'A barrier you must climb over or squeeze under.',
    effect: 'Make DC 10 Dexterity (Acrobatics) or Strength (Athletics) check. Fail: Barrier is difficult terrain.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Acrobatics or Athletics',
        dc: 10,
        failureEffect: 'Treat as difficult terrain',
      },
    },
  },
];

// ==========================================
// Avernus Vehicle Chase Complications (d20)
// Official table from Baldur's Gate: Descent into Avernus
// ==========================================
export const AVERNUS_COMPLICATIONS: ChaseComplication[] = [
  {
    roll: 1,
    name: 'Creature Chase',
    description: 'You drive past a creature native to Avernus, and it chases after you.',
    effect: 'The DM chooses the creature. A new pursuer joins the chase.',
    mechanicalEffect: {
      targetVehicle: 'pursuer',
    },
  },
  {
    roll: 2,
    name: 'Creature Chase',
    description: 'You drive past a creature native to Avernus, and it chases after you.',
    effect: 'The DM chooses the creature. A new pursuer joins the chase.',
    mechanicalEffect: {
      targetVehicle: 'pursuer',
    },
  },
  {
    roll: 3,
    name: 'Fire Tornado',
    description: 'A fire tornado, 300 feet high and 30 feet wide at its base, crosses your path.',
    effect: 'DC 15 Dexterity save to avoid. Fail: Each creature without total cover makes DC 18 Dexterity save, taking 99 (18d10) fire damage on fail, half on success.',
    mechanicalEffect: {
      damage: '18d10 fire',
      skillCheck: {
        skill: 'Dexterity Save (Vehicle)',
        dc: 15,
        failureEffect: 'Crew without total cover: DC 18 Dex save or 99 fire damage (half on success)',
      },
    },
  },
  {
    roll: 4,
    name: 'Dust Cloud',
    description: 'A swirling cloud of dust envelops the vehicle.',
    effect: 'Any creature on or inside the vehicle that doesn\'t have total cover is blinded until the start of its next turn unless using protective eyewear.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'None',
        dc: 0,
        failureEffect: 'Exposed creatures are blinded until start of next turn',
      },
    },
  },
  {
    roll: 5,
    name: 'Rock Pillars',
    description: 'Natural pillars of rock can grant cover as the vehicle swerves between them.',
    effect: 'DC 15 Dexterity check using vehicle\'s Dexterity. Success: Three-quarters cover against attacks from other vehicles until start of driver\'s next turn.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Dexterity (Vehicle)',
        dc: 15,
        failureEffect: 'No cover gained',
      },
    },
  },
  {
    roll: 6,
    name: 'Fiend Herd',
    description: 'Your vehicle drives into a herd of lemures, manes, or other fiends.',
    effect: 'DC 15 Strength or Dexterity check (driver\'s choice) to plow through. Fail: Herd counts as 30 feet of difficult terrain.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Strength or Dexterity (Vehicle)',
        dc: 15,
        failureEffect: '30 feet of difficult terrain',
      },
    },
  },
  {
    roll: 7,
    name: 'Ledge Drop',
    description: 'The vehicle drives off a 10-foot-high ledge and comes crashing down.',
    effect: 'Any unsecured creature on the outside must succeed DC 15 Dexterity save or tumble off, taking fall damage and landing prone.',
    mechanicalEffect: {
      damage: '1d6 bludgeoning',
      skillCheck: {
        skill: 'Dexterity Save',
        dc: 15,
        failureEffect: 'Fall off vehicle, take fall damage, land prone',
      },
    },
  },
  {
    roll: 8,
    name: 'Uneven Ground',
    description: 'Uneven ground threatens to slow your vehicle\'s progress.',
    effect: 'DC 10 Dexterity check to navigate. Fail: Ground counts as 60 feet of difficult terrain.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Dexterity (Vehicle)',
        dc: 10,
        failureEffect: '60 feet of difficult terrain',
      },
    },
  },
  {
    roll: 9,
    name: 'Derelict Machines',
    description: 'Derelict infernal war machines dot the landscape, rusted beyond repair and half buried in the dust.',
    effect: 'If vehicle uses Dash, driver must succeed DC 10 Dexterity check or crash into a derelict machine (see Crashing rules).',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Dexterity (Vehicle)',
        dc: 10,
        failureEffect: 'Crash into derelict (Crashing rules)',
      },
    },
  },
  {
    roll: 10,
    name: 'Ground Collapse',
    description: 'Part of the ground gives way underneath the vehicle, causing it to roll over.',
    effect: 'DC 10 Dexterity save. Fail: Vehicle lands prone (upside down or on side), dead stop. When vehicle rolls, unsecured creatures on outside must succeed DC 20 Strength save or tumble off, landing prone within 20 feet.',
    mechanicalEffect: {
      skillCheck: {
        skill: 'Dexterity Save (Vehicle)',
        dc: 10,
        failureEffect: 'Vehicle prone, dead stop. Crew: DC 20 Str save or fall off',
      },
    },
  },
];

// ==========================================
// Scale-Specific Complications
// ==========================================

// Strategic Scale (1+ miles) - More environmental, less immediate
export const STRATEGIC_COMPLICATIONS: ChaseComplication[] = [
  {
    roll: 1,
    name: 'Wrong Turn',
    description: 'The wasteland all looks the same. You\'ve gone the wrong way.',
    effect: 'Make DC 12 Wisdom (Survival) check or lose 1 mile of progress.',
  },
  {
    roll: 2,
    name: 'Terrain Change',
    description: 'The terrain ahead is impassable. Must find alternate route.',
    effect: 'Speed halved for the next round as you navigate around.',
    mechanicalEffect: {
      speedChange: -50,
    },
  },
  {
    roll: 3,
    name: 'Soul Storm',
    description: 'A storm of souls reduces visibility to near zero.',
    effect: 'Lose visual contact with quarry/pursuer for 1d4 rounds.',
  },
  {
    roll: 4,
    name: 'Wandering War Band',
    description: 'A war band of devils blocks the route.',
    effect: 'Must detour or engage. Detour costs 1 round.',
  },
  {
    roll: 5,
    name: 'Fuel Concerns',
    description: 'Soul coin is running low on power.',
    effect: 'Unless soul coin is "fed" with a drop of blood, speed is halved.',
  },
];

// Approach Scale (1000ft - 1 mile) - Tactical awareness
export const APPROACH_COMPLICATIONS: ChaseComplication[] = [
  ...AVERNUS_COMPLICATIONS.slice(0, 5),
  {
    roll: 6,
    name: 'Flanking Threat',
    description: 'Another vehicle appears on the horizon, heading to intercept.',
    effect: 'A new enemy vehicle may join the chase in 1d4 rounds.',
  },
];

// Tactical Scale (100-1000ft) - Standard chase complications
export const TACTICAL_COMPLICATIONS: ChaseComplication[] = AVERNUS_COMPLICATIONS;

// Point-Blank Scale (<100ft) - More intense, boarding actions
export const POINT_BLANK_COMPLICATIONS: ChaseComplication[] = [
  {
    roll: 1,
    name: 'Boarding Attempt',
    description: 'An enemy leaps toward your vehicle!',
    effect: 'Enemy creature attempts to board. Make opposed Athletics check.',
  },
  {
    roll: 2,
    name: 'Collision Course',
    description: 'Vehicles are on collision course.',
    effect: 'Both vehicles must make DC 12 handling check or collide for 4d10 damage each.',
    mechanicalEffect: {
      targetVehicle: 'both',
      damage: '4d10 bludgeoning',
    },
  },
  {
    roll: 3,
    name: 'Weapon Lock',
    description: 'Vehicles are too close for ranged weapons.',
    effect: 'Ranged weapons cannot fire until distance increases to 100+ feet.',
  },
  {
    roll: 4,
    name: 'Grappling Hook',
    description: 'An enemy throws a grappling hook.',
    effect: 'Vehicles are tethered. DC 15 Strength check to break free.',
  },
  {
    roll: 5,
    name: 'Ram Opportunity',
    description: 'Perfect position for a ram attack.',
    effect: 'Current driver may immediately attempt a ram as a reaction.',
  },
];

// ==========================================
// Utility Functions
// ==========================================

/**
 * Get complications for a specific scale
 */
export function getComplicationsForScale(scale: ScaleName): ChaseComplication[] {
  switch (scale) {
    case 'strategic':
      return STRATEGIC_COMPLICATIONS;
    case 'approach':
      return APPROACH_COMPLICATIONS;
    case 'tactical':
      return TACTICAL_COMPLICATIONS;
    case 'point_blank':
      return POINT_BLANK_COMPLICATIONS;
    default:
      return TACTICAL_COMPLICATIONS;
  }
}

/**
 * Roll for a complication using official Avernus table
 * d20: 1-2 = Creature Chase, 3 = Fire Tornado, ... 10 = Ground Collapse, 11-20 = No complication
 */
export function rollComplication(roll: number, scale: ScaleName): ChaseComplication | null {
  // 11-20: No complication
  if (roll >= 11) return null;

  // Use Avernus complications for all scales (official table)
  return getAvernusComplication(roll);
}

/**
 * Get Avernus complication by d20 roll (1-10)
 */
export function getAvernusComplication(roll: number): ChaseComplication | null {
  if (roll >= 11) return null;

  // Map roll to complication based on official table ranges
  // 1-2: Creature Chase (index 0 or 1)
  // 3: Fire Tornado (index 2)
  // 4: Dust Cloud (index 3)
  // 5: Rock Pillars (index 4)
  // 6: Fiend Herd (index 5)
  // 7: Ledge Drop (index 6)
  // 8: Uneven Ground (index 7)
  // 9: Derelict Machines (index 8)
  // 10: Ground Collapse (index 9)

  if (roll <= 2) {
    return AVERNUS_COMPLICATIONS[0]; // Creature Chase
  }
  // Roll 3-10 maps to indices 2-9
  const index = roll - 1;
  if (index < AVERNUS_COMPLICATIONS.length) {
    return AVERNUS_COMPLICATIONS[index];
  }
  return null;
}

/**
 * Get the roll range description for display
 */
export function getComplicationRollRange(roll: number): string {
  if (roll <= 2) return '1-2';
  if (roll >= 11) return '11-20';
  return String(roll);
}
