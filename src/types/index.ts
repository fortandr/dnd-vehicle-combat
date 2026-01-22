// ==========================================
// Core Types - Avernus Vehicle Combat Tracker
// ==========================================

// ==========================================
// Ability Scores & Stats
// ==========================================
export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type AbilityName = keyof AbilityScores;

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ==========================================
// Statblocks (Creatures & NPCs)
// ==========================================
export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
export type StatblockSource = 'dndbeyond' | 'custom' | 'srd';

export interface Speed {
  walk?: number;
  fly?: number;
  swim?: number;
  burrow?: number;
  climb?: number;
}

export interface StatblockFeature {
  name: string;
  description: string;
}

export interface StatblockAction {
  name: string;
  description: string;
  attackBonus?: number;
  damage?: string; // e.g., "2d6+4 slashing"
  reach?: number;
  range?: string; // e.g., "80/320 ft"
  saveDC?: number;
  saveType?: AbilityName;
  recharge?: string; // e.g., "5-6" or "short rest"
}

export interface Statblock {
  id: string;
  name: string;
  source: StatblockSource;
  sourceId?: string; // D&D Beyond monster ID

  // Core stats
  size: CreatureSize;
  type: string; // "fiend", "humanoid", etc.
  subtype?: string; // "devil", "elf", etc.
  alignment: string;
  ac: number;
  acType?: string; // "natural armor", "plate", etc.
  maxHp: number;
  hitDice: string; // "8d10+24"
  speed: Speed;

  // Ability scores
  abilities: AbilityScores;

  // Defenses
  savingThrows?: Partial<Record<AbilityName, number>>;
  skills?: Record<string, number>;
  damageVulnerabilities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses: string;
  languages: string;
  cr: string; // Challenge rating

  // Abilities
  traits?: StatblockFeature[];
  actions?: StatblockAction[];
  bonusActions?: StatblockAction[];
  reactions?: StatblockAction[];
  legendaryActions?: StatblockAction[];
  legendaryActionsPerRound?: number;

  // Meta
  tags?: string[]; // For organizing in library
}

// Combat instance of a creature
export interface Creature {
  id: string;
  name: string; // Instance name (e.g., "Goblin 1")
  statblock: Statblock;
  currentHp: number;
  tempHp: number;
  conditions: Condition[];
  initiative: number;
  initiativeModifier: number;
  vehicleId?: string; // If assigned to a vehicle
  zoneId?: string; // Zone within vehicle
  position?: Position; // World position if not on a vehicle
  legendaryActionsRemaining?: number;
  concentrating?: string; // Spell name if concentrating
  notes?: string;
}

// ==========================================
// Conditions
// ==========================================
export type ConditionName =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'exhaustion';

export interface Condition {
  name: ConditionName;
  source?: string; // What caused it
  duration?: number; // Rounds remaining, undefined = indefinite
  level?: number; // For exhaustion (1-6)
}

// ==========================================
// Vehicles
// ==========================================
export type CoverType = 'none' | 'half' | 'three_quarters' | 'full';

export interface VehicleZone {
  id: string;
  name: string;
  cover: CoverType;
  capacity: number; // Max creatures
  canAttackOut: boolean;
  visibleFromArcs: ('front' | 'rear' | 'left' | 'right')[]; // Which directions can see into this zone
  description?: string;
}

export interface WeaponTemplate {
  id: string;
  name: string;
  damage: string; // e.g., "6d10 bludgeoning"
  attackBonus?: number; // For attack roll weapons
  saveDC?: number; // For save-based weapons (e.g., Buzz Saw)
  saveType?: AbilityName; // Which save (dex, str, etc.)
  range?: string; // e.g., "120 ft" or "melee"
  properties?: string[]; // e.g., "requires 2 crew"
  specialEffect?: string;
  crewRequired?: number;
}

export interface VehicleWeapon extends WeaponTemplate {
  visibleFromArcs: ('front' | 'rear' | 'left' | 'right')[];
  zoneId: string; // Which zone this weapon is in
  ammunition?: number;
  currentAmmunition?: number;
  isSwappableStation?: boolean; // If true, this weapon can be swapped for alternative weapons
}

export interface VehicleAbilityScores {
  str: number;
  dex: number;
  con: number;
}

export interface VehicleTemplate {
  id: string;
  name: string;
  description: string;
  maxHp: number;
  ac: number;
  speed: number; // Base speed in feet
  damageThreshold: number; // Vehicle ignores damage less than this amount
  mishapThreshold: number; // Damage in single hit to trigger mishap
  crewCapacity: number;
  cargoCapacity?: number; // In pounds
  weight?: number; // In pounds
  abilityScores?: VehicleAbilityScores; // STR, DEX, CON only (vehicles have no INT, WIS, CHA)
  zones: VehicleZone[];
  weapons: WeaponTemplate[];
  traits?: StatblockFeature[]; // Special abilities
  reactions?: StatblockFeature[]; // Reactions (e.g., Juke)
  size: 'large' | 'huge' | 'gargantuan';
  immunities?: string[];
}

export interface Vehicle {
  id: string;
  name: string; // Instance name
  type: 'party' | 'enemy';
  template: VehicleTemplate;
  currentHp: number;
  currentSpeed: number;
  activeMishaps: Mishap[];
  conditions: string[];
  weapons: VehicleWeapon[];
  // Position on battlefield
  position: Position;
  facing: number; // Degrees, 0 = north
  // Upgrades
  armorUpgradeId?: string; // ID of armor upgrade (default: 'none')
  gadgetIds?: string[]; // IDs of installed magical gadgets
  // Status
  isInoperative?: boolean; // True when HP reaches 0 - crew ejected, vehicle disabled
  // Temporary effects from complications
  speedModifiers?: SpeedModifier[];
}

// ==========================================
// Crew Assignments
// ==========================================
export interface CrewAssignment {
  creatureId: string;
  vehicleId: string;
  zoneId: string;
}

// ==========================================
// Mishaps
// ==========================================
export type MishapDuration = 'instant' | 'until_repaired' | 'rounds';

export interface Mishap {
  id: string;
  rollMin: number; // Minimum d20 roll that triggers this
  rollMax: number; // Maximum d20 roll that triggers this
  name: string;
  effect: string;
  duration: MishapDuration;
  roundsRemaining?: number;
  repairDC?: number; // DC to repair, undefined = cannot be repaired
  repairAbility?: AbilityName; // Ability used to repair (str or dex)
  mechanicalEffect?: MishapMechanicalEffect;
  stackable?: boolean; // If true, this mishap can occur multiple times (e.g., Furnace Rupture stacks speed reduction)
}

export interface MishapMechanicalEffect {
  speedReduction?: number; // e.g., 30 = reduce speed by 30 ft
  damageThresholdReduction?: number; // e.g., 10 = reduce damage threshold by 10
  autoFailDexChecks?: boolean; // Vehicle auto-fails Dex checks/saves
  disadvantageOnAllChecks?: boolean; // All ability checks and attacks have disadvantage
  disableWeapons?: string[]; // Weapon IDs disabled, 'random' for DM choice
  recurringDamage?: string; // e.g., "3d6 fire" - damage each turn
  zoneObscured?: string; // Zone ID that becomes heavily obscured
  vehicleProne?: boolean; // Vehicle is flipped/prone
  crewSaveOnFlip?: { dc: number; damage: string }; // Save or take damage on flip
}

// ==========================================
// Chase & Complications
// ==========================================
export interface ChaseComplication {
  roll: number;
  name: string;
  description: string;
  effect: string;
  mechanicalEffect?: ChaseComplicationEffect;
}

export interface ChaseComplicationEffect {
  targetVehicle?: 'pursuer' | 'quarry' | 'both' | 'random';
  damage?: string;
  speedChange?: number;
  mishapRoll?: boolean;
  skillCheck?: {
    skill: string;
    dc: number;
    failureEffect: string;
  };
}

// Speed modifier applied to a vehicle (from complications, terrain, etc.)
export type SpeedModifierDuration = 'this_turn' | 'this_round' | 'until_cleared';

export interface SpeedModifier {
  id: string;
  source: string; // e.g., "Uneven Ground complication"
  multiplier: number; // 0.5 for half speed, 1 for no change
  duration: SpeedModifierDuration;
  appliedAtRound: number;
  appliedAtTurnIndex?: number; // For 'this_turn' duration
}

// Resolution status for each vehicle in a complication
export type ComplicationResolutionStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export interface VehicleComplicationResolution {
  vehicleId: string;
  status: ComplicationResolutionStatus;
  rollResult?: number; // The d20 roll
  modifier?: number; // The modifier applied
  total?: number; // Roll + modifier
  driverName?: string; // For display
}

// Active battlefield-wide complication being resolved
export interface ActiveBattlefieldComplication {
  id: string;
  complication: ChaseComplication;
  roll: number; // The d20 roll that triggered this
  rollRange: string; // Display string like "1-2" or "8"
  round: number; // Round it occurred
  resolutions: VehicleComplicationResolution[];
  isResolved: boolean; // True when all vehicles have resolved
}

// ==========================================
// Scale System
// ==========================================
export type ScaleName = 'strategic' | 'approach' | 'tactical' | 'point_blank';

export interface ScaleConfig {
  name: ScaleName;
  displayName: string;
  minDistance: number; // in feet
  maxDistance: number;
  roundDuration: number; // in seconds
  roundDurationDisplay: string; // "6 seconds", "1 minute", etc.
  movementUnit: number; // feet per "move action"
  speedMultiplier: number; // vehicle speed × this = movement per round
  availableActions: string[];
  mapScale: number; // pixels per foot for display
}

// ==========================================
// Spatial / Positioning
// ==========================================
export interface Position {
  x: number;
  y: number;
}

export interface BackgroundImageConfig {
  url: string; // Data URL or external URL
  opacity: number; // 0-1
  scale: number; // 1 = 100%
  position: Position; // Offset in feet from center
  naturalWidth?: number; // Original image width in pixels
  naturalHeight?: number; // Original image height in pixels
  feetPerPixel?: number; // How many feet each pixel represents (for scaling to grid)
}

export interface BattlefieldState {
  width: number; // in feet
  height: number;
  scale: ScaleName;
  gridSize: number; // feet per grid square
  terrain?: TerrainFeature[];
  backgroundImage?: BackgroundImageConfig;
}

export interface TerrainFeature {
  id: string;
  type: 'obstacle' | 'hazard' | 'difficult_terrain';
  position: Position;
  size: { width: number; height: number };
  name: string;
  effect?: string;
}

// ==========================================
// Combat State
// ==========================================
export type CombatPhase = 'setup' | 'initiative' | 'combat' | 'resolution' | 'ended';

export interface CombatState {
  id: string;
  name: string; // Encounter name
  round: number;
  phase: CombatPhase;
  hasBeenSaved: boolean; // Whether encounter has been explicitly saved (enables auto-save)

  // Participants
  vehicles: Vehicle[];
  creatures: Creature[];
  crewAssignments: CrewAssignment[];

  // Turn order
  initiativeOrder: string[]; // creature/vehicle IDs
  currentTurnIndex: number;

  // Chase mechanics
  isChase: boolean;
  chaseRound?: number;
  chaseMaxRounds?: number;
  pursuerIds?: string[];
  quarryIds?: string[];

  // Scale & positioning
  scale: ScaleName;
  battlefield: BattlefieldState;

  // Environment
  environment: Environment;

  // Logging
  actionLog: LogEntry[];

  // Complications
  autoRollComplications: boolean;
  activeBattlefieldComplication?: ActiveBattlefieldComplication; // Currently resolving complication
}

export interface Environment {
  terrain: string;
  hazards: string[];
  visibility: 'clear' | 'lightly_obscured' | 'heavily_obscured';
  specialRules?: string[];
}

// ==========================================
// Action Log
// ==========================================
export type LogEntryType =
  | 'attack'
  | 'damage'
  | 'healing'
  | 'mishap'
  | 'complication'
  | 'movement'
  | 'ability'
  | 'condition'
  | 'scale_change'
  | 'round_start'
  | 'turn_start'
  | 'system';

export interface LogEntry {
  id: string;
  timestamp: Date;
  round: number;
  type: LogEntryType;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  action: string;
  details?: string;
  rolls?: DiceRollResult[];
  isImportant?: boolean;
}

// ==========================================
// Dice Rolling
// ==========================================
export interface DiceRollResult {
  notation: string; // e.g., "1d20+5"
  rolls: number[]; // Individual die results
  modifier: number;
  total: number;
  advantage?: boolean;
  disadvantage?: boolean;
  criticalHit?: boolean;
  criticalMiss?: boolean;
}

// ==========================================
// Actions
// ==========================================
export type ActionType =
  | 'helm_drive'
  | 'helm_dash'
  | 'helm_disengage'
  | 'helm_ram'
  | 'helm_evasive'
  | 'weapon_attack'
  | 'weapon_aim'
  | 'repair_hp'
  | 'repair_mishap'
  | 'passenger_spell'
  | 'passenger_ready'
  | 'passenger_jump'
  | 'creature_action'
  | 'creature_bonus_action'
  | 'creature_reaction'
  | 'creature_movement';

export interface AvailableAction {
  type: ActionType;
  name: string;
  description: string;
  requiredZone?: string[]; // Zone IDs where this action is available
  requiredScale?: ScaleName[]; // Scales where this action is available
  actionCost: 'action' | 'bonus_action' | 'reaction' | 'free' | 'movement';
}

// ==========================================
// Library & Persistence
// ==========================================
export interface StatblockLibrary {
  statblocks: Statblock[];
  vehicleTemplates: VehicleTemplate[];
  tags: string[];
  lastModified: Date;
}

export interface EncounterPreset {
  id: string;
  name: string;
  description?: string;
  vehicles: Omit<Vehicle, 'id'>[];
  creatures: Omit<Creature, 'id'>[];
  environment: Environment;
  isChase: boolean;
  initialScale: ScaleName;
  createdAt: Date;
  lastUsed?: Date;
}

// ==========================================
// UI State
// ==========================================
export interface UIState {
  selectedVehicleId?: string;
  selectedCreatureId?: string;
  showStatblockLibrary: boolean;
  showEncounterSetup: boolean;
  showDiceRoller: boolean;
  sidebarCollapsed: boolean;
  combatLogExpanded: boolean;
}
