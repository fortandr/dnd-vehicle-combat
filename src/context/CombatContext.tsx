/**
 * Combat Context
 *
 * Central state management for vehicular combat encounters.
 * Uses useReducer for predictable state updates.
 */

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useState, useRef } from 'react';
import {
  CombatState,
  Vehicle,
  VehicleWeapon,
  Creature,
  CrewAssignment,
  Mishap,
  LogEntry,
  LogEntryType,
  ScaleName,
  Position,
  Environment,
  CombatPhase,
  BattlefieldState,
  BackgroundImageConfig,
  ChaseComplication,
  ActiveBattlefieldComplication,
  VehicleComplicationResolution,
  SpeedModifier,
  ComplicationResolutionStatus,
  ElevationZone,
} from '../types';
import { getScaleForDistance, SCALES } from '../data/scaleConfig';
import { getWeaponStationUpgrade, resolveZone } from '../data/vehicleTemplates';
import { logAnalyticsEvent } from '../firebase';
import { v4 as uuid } from 'uuid';
import { loadCurrentEncounter } from '../hooks/useLocalStorage';

const AUTO_SAVE_KEY = 'avernus-current-encounter';

// ==========================================
// Initial State
// ==========================================

const initialBattlefield: BattlefieldState = {
  width: 2000,
  height: 2000,
  scale: 'tactical',
  gridSize: 5,
  terrain: [],
};

const initialEnvironment: Environment = {
  terrain: 'Fiery Plains',
  hazards: [],
  visibility: 'clear',
};

export const initialCombatState: CombatState = {
  id: '',
  name: 'New Encounter',
  round: 0,
  phase: 'setup',
  hasBeenSaved: false,
  vehicles: [],
  creatures: [],
  crewAssignments: [],
  initiativeOrder: [],
  currentTurnIndex: 0,
  isChase: false,
  scale: 'tactical',
  battlefield: initialBattlefield,
  elevationZones: [],
  environment: initialEnvironment,
  actionLog: [],
  autoRollComplications: false,
  playerViewSettings: {
    showVehicleHealth: true,
  },
};

// ==========================================
// Action Types
// ==========================================

type CombatAction =
  | { type: 'LOAD_ENCOUNTER'; payload: CombatState }
  | { type: 'LOAD_PARTY_PRESET'; payload: { vehicles: Vehicle[]; creatures: Creature[]; crewAssignments: CrewAssignment[] } }
  | { type: 'NEW_ENCOUNTER'; payload: { name: string } }
  | { type: 'SET_ENCOUNTER_NAME'; payload: string }
  | { type: 'MARK_AS_SAVED' }

  // Setup Phase
  | { type: 'ADD_VEHICLE'; payload: Vehicle }
  | { type: 'REMOVE_VEHICLE'; payload: string }
  | { type: 'SWAP_VEHICLE_WEAPON'; payload: { vehicleId: string; weaponIndex: number; newWeapon: VehicleWeapon } }
  | { type: 'SET_VEHICLE_ARMOR'; payload: { vehicleId: string; armorUpgradeId: string } }
  | { type: 'TOGGLE_VEHICLE_GADGET'; payload: { vehicleId: string; gadgetId: string } }
  | { type: 'TOGGLE_WEAPON_STATION_UPGRADE'; payload: { vehicleId: string } }
  | { type: 'UPDATE_VEHICLE'; payload: { id: string; updates: Partial<Vehicle> } }
  | { type: 'ADD_CREATURE'; payload: Creature }
  | { type: 'REMOVE_CREATURE'; payload: string }
  | { type: 'UPDATE_CREATURE'; payload: { id: string; updates: Partial<Creature> } }
  | { type: 'ASSIGN_CREW'; payload: CrewAssignment }
  | { type: 'UNASSIGN_CREW'; payload: { creatureId: string } }
  | { type: 'SET_ENVIRONMENT'; payload: Partial<Environment> }
  | { type: 'SET_CHASE_MODE'; payload: { isChase: boolean; pursuerIds?: string[]; quarryIds?: string[] } }
  | { type: 'SET_BACKGROUND_IMAGE'; payload: BackgroundImageConfig | null }

  // Initiative
  | { type: 'SET_INITIATIVE'; payload: { creatureId: string; initiative: number } }
  | { type: 'ROLL_ALL_INITIATIVE' }
  | { type: 'SET_INITIATIVE_ORDER'; payload: string[] }
  | { type: 'START_COMBAT' }
  | { type: 'RETURN_TO_SETUP' }

  // Combat Flow
  | { type: 'NEXT_TURN' }
  | { type: 'PREVIOUS_TURN' }
  | { type: 'NEXT_ROUND' }
  | { type: 'END_COMBAT' }
  | { type: 'RESET_COMBAT' } // Reset HP, mishaps, turns but keep vehicles/creatures

  // Damage & Healing
  | { type: 'DEAL_DAMAGE_TO_VEHICLE'; payload: { vehicleId: string; amount: number; source?: string } }
  | { type: 'HEAL_VEHICLE'; payload: { vehicleId: string; amount: number } }
  | { type: 'DEAL_DAMAGE_TO_CREATURE'; payload: { creatureId: string; amount: number; source?: string } }
  | { type: 'HEAL_CREATURE'; payload: { creatureId: string; amount: number } }

  // Mishaps
  | { type: 'APPLY_MISHAP'; payload: { vehicleId: string; mishap: Mishap } }
  | { type: 'REPAIR_MISHAP'; payload: { vehicleId: string; mishapId: string } }
  | { type: 'TICK_MISHAP_DURATION'; payload: { vehicleId: string; mishapId: string } }

  // Position & Scale
  | { type: 'UPDATE_VEHICLE_POSITION'; payload: { vehicleId: string; position: Position } }
  | { type: 'UPDATE_VEHICLE_FACING'; payload: { vehicleId: string; facing: number } }
  | { type: 'SET_SCALE'; payload: ScaleName }
  | { type: 'UPDATE_BATTLEFIELD'; payload: Partial<BattlefieldState> }

  // Elevation Zones
  | { type: 'ADD_ELEVATION_ZONE'; payload: ElevationZone }
  | { type: 'UPDATE_ELEVATION_ZONE'; payload: { id: string; updates: Partial<ElevationZone> } }
  | { type: 'REMOVE_ELEVATION_ZONE'; payload: string }

  // Player View Settings
  | { type: 'SET_PLAYER_VIEW_SETTINGS'; payload: Partial<CombatState['playerViewSettings']> }

  // Logging
  | { type: 'LOG_ACTION'; payload: Omit<LogEntry, 'id' | 'timestamp' | 'round'> }
  | { type: 'CLEAR_LOG' }

  // Complications
  | { type: 'TOGGLE_AUTO_ROLL_COMPLICATIONS' }
  | { type: 'START_COMPLICATION_RESOLUTION'; payload: { complication: ChaseComplication; roll: number; rollRange: string } }
  | { type: 'RESOLVE_VEHICLE_COMPLICATION'; payload: { vehicleId: string; status: ComplicationResolutionStatus; rollResult?: number; modifier?: number; total?: number } }
  | { type: 'APPLY_COMPLICATION_EFFECTS' }
  | { type: 'CLEAR_COMPLICATION' }
  | { type: 'CLEAR_EXPIRED_SPEED_MODIFIERS' };

// ==========================================
// Reducer
// ==========================================

function combatReducer(state: CombatState, action: CombatAction): CombatState {
  switch (action.type) {
    // ========== Encounter Management ==========
    case 'LOAD_ENCOUNTER': {
      // Migrate vehicles to add isSwappableStation flag to harpoon weapons
      // Also mark vehicles at 0 HP as inoperative
      const migratedVehicles = (action.payload.vehicles || []).map((vehicle) => ({
        ...vehicle,
        // Mark as inoperative if at 0 HP but not already marked
        isInoperative: vehicle.isInoperative ?? (vehicle.currentHp === 0),
        weapons: vehicle.weapons.map((weapon) => ({
          ...weapon,
          // Mark harpoon weapons as swappable if not already set
          isSwappableStation: weapon.isSwappableStation ?? weapon.id.includes('harpoon') ?? weapon.name.toLowerCase().includes('harpoon'),
        })),
      }));

      // Find vehicles that are at 0 HP (destroyed) - we need to eject their crew
      const destroyedVehicleIds = migratedVehicles
        .filter((v) => v.currentHp === 0 || v.isInoperative)
        .map((v) => v.id);

      // Get incoming crew assignments and creatures
      let migratedCrewAssignments = action.payload.crewAssignments || [];
      // Migrate creatures to add faction field if missing
      let migratedCreatures = (action.payload.creatures || []).map((creature: Creature) => ({
        ...creature,
        faction: creature.faction ?? (creature.statblock.type === 'pc' ? 'party' : 'enemy'),
      }));
      let migratedInitiativeOrder = action.payload.initiativeOrder || [];
      const ejectedCreatures: Creature[] = [];

      // Remove destroyed vehicles from initiative order
      if (destroyedVehicleIds.length > 0) {
        migratedInitiativeOrder = migratedInitiativeOrder.filter(
          (id) => !destroyedVehicleIds.includes(id)
        );
      }

      // For each destroyed vehicle, eject crew and place them on the map
      if (destroyedVehicleIds.length > 0) {
        const crewToEject = migratedCrewAssignments.filter((a) =>
          destroyedVehicleIds.includes(a.vehicleId)
        );

        if (crewToEject.length > 0) {
          // Update creatures with positions near their destroyed vehicles
          migratedCreatures = migratedCreatures.map((creature) => {
            const assignment = crewToEject.find((a) => a.creatureId === creature.id);
            if (!assignment) return creature;

            const vehicle = migratedVehicles.find((v) => v.id === assignment.vehicleId);
            if (!vehicle) return creature;

            // Only set position if creature doesn't already have one
            if (creature.position) return creature;

            // Spread creatures around the vehicle in a circle
            const vehicleCrew = crewToEject.filter((a) => a.vehicleId === vehicle.id);
            const crewIndex = vehicleCrew.indexOf(assignment);
            const angle = (crewIndex / vehicleCrew.length) * 2 * Math.PI;
            const offset = 15;
            const newPosition = {
              x: vehicle.position.x + Math.cos(angle) * offset,
              y: vehicle.position.y + Math.sin(angle) * offset,
            };

            const updatedCreature = { ...creature, position: newPosition };
            ejectedCreatures.push(updatedCreature);
            return updatedCreature;
          });

          // Remove crew assignments for destroyed vehicles
          migratedCrewAssignments = migratedCrewAssignments.filter(
            (a) => !destroyedVehicleIds.includes(a.vehicleId)
          );

          // Add ejected creatures to initiative order (if combat is active)
          if (action.payload.phase === 'combat' && ejectedCreatures.length > 0) {
            migratedInitiativeOrder = insertCreaturesIntoInitiative(
              migratedInitiativeOrder,
              ejectedCreatures,
              migratedCreatures,
              migratedVehicles
            );
          }
        }
      }

      // Safety net: Ensure any creature with a position (on battlefield) that isn't
      // assigned to a vehicle is in the initiative order during combat
      if (action.payload.phase === 'combat') {
        const assignedCreatureIds = new Set(migratedCrewAssignments.map((a) => a.creatureId));
        const creaturesOnBattlefield = migratedCreatures.filter(
          (c) => c.position && !assignedCreatureIds.has(c.id) && !migratedInitiativeOrder.includes(c.id)
        );
        if (creaturesOnBattlefield.length > 0) {
          migratedInitiativeOrder = insertCreaturesIntoInitiative(
            migratedInitiativeOrder,
            creaturesOnBattlefield,
            migratedCreatures,
            migratedVehicles
          );
        }
      }

      // Merge with initial state to ensure all required fields exist
      return {
        ...initialCombatState,
        ...action.payload,
        // Ensure nested objects have defaults
        battlefield: {
          ...initialCombatState.battlefield,
          ...(action.payload.battlefield || {}),
        },
        environment: {
          ...initialCombatState.environment,
          ...(action.payload.environment || {}),
        },
        // Ensure arrays exist with migrations applied
        vehicles: migratedVehicles,
        creatures: migratedCreatures,
        crewAssignments: migratedCrewAssignments,
        initiativeOrder: migratedInitiativeOrder,
        actionLog: action.payload.actionLog || [],
      };
    }

    case 'NEW_ENCOUNTER':
      return {
        ...initialCombatState,
        id: uuid(),
        name: action.payload.name,
      };

    case 'SET_ENCOUNTER_NAME':
      return { ...state, name: action.payload };

    case 'MARK_AS_SAVED':
      return { ...state, hasBeenSaved: true };

    case 'LOAD_PARTY_PRESET': {
      const { vehicles: presetVehicles, creatures: presetCreatures, crewAssignments: presetAssignments } = action.payload;

      // Build ID mappings: old ID -> new ID
      const vehicleIdMap = new Map<string, string>();
      const creatureIdMap = new Map<string, string>();

      // Create new vehicles with fresh UUIDs
      const newVehicles = presetVehicles.map((v) => {
        const newId = uuid();
        vehicleIdMap.set(v.id, newId);
        return {
          ...v,
          id: newId,
          // Reset position to party side
          position: { x: 200, y: 200 + vehicleIdMap.size * 100 },
        };
      });

      // Create new creatures with fresh UUIDs
      const newCreatures = presetCreatures.map((c) => {
        const newId = uuid();
        creatureIdMap.set(c.id, newId);
        return {
          ...c,
          id: newId,
          // Update vehicleId reference if assigned
          vehicleId: c.vehicleId ? vehicleIdMap.get(c.vehicleId) : undefined,
        };
      });

      // Update crew assignments with new IDs
      const newAssignments = presetAssignments
        .filter((a) => vehicleIdMap.has(a.vehicleId) && creatureIdMap.has(a.creatureId))
        .map((a) => ({
          ...a,
          vehicleId: vehicleIdMap.get(a.vehicleId)!,
          creatureId: creatureIdMap.get(a.creatureId)!,
        }));

      // Keep existing enemy vehicles
      const enemyVehicles = state.vehicles.filter((v) => v.type === 'enemy');

      return {
        ...state,
        vehicles: [...enemyVehicles, ...newVehicles],
        creatures: newCreatures,
        crewAssignments: newAssignments,
      };
    }

    // ========== Vehicles ==========
    case 'ADD_VEHICLE':
      return {
        ...state,
        vehicles: [...state.vehicles, action.payload],
      };

    case 'REMOVE_VEHICLE': {
      const removedVehicleId = action.payload;
      const newInitiativeOrder = state.initiativeOrder.filter(
        (id) => id !== removedVehicleId
      );
      // Adjust currentTurnIndex if the removed vehicle was before/at the current turn
      let newTurnIndex = state.currentTurnIndex;
      const removedIndex = state.initiativeOrder.indexOf(removedVehicleId);
      if (removedIndex !== -1 && removedIndex < state.currentTurnIndex) {
        newTurnIndex = Math.max(0, newTurnIndex - 1);
      } else if (removedIndex === state.currentTurnIndex && newTurnIndex >= newInitiativeOrder.length) {
        newTurnIndex = Math.max(0, newInitiativeOrder.length - 1);
      }
      return {
        ...state,
        vehicles: state.vehicles.filter((v) => v.id !== removedVehicleId),
        crewAssignments: state.crewAssignments.filter(
          (a) => a.vehicleId !== removedVehicleId
        ),
        initiativeOrder: newInitiativeOrder,
        currentTurnIndex: newTurnIndex,
      };
    }

    case 'UPDATE_VEHICLE': {
      const vehicle = state.vehicles.find((v) => v.id === action.payload.id);
      if (!vehicle) return state;

      const updates = action.payload.updates;
      const newHp = updates.currentHp !== undefined ? updates.currentHp : vehicle.currentHp;
      // Eject crew if vehicle is at 0 HP and not already marked inoperative
      // This handles both new damage and legacy vehicles already at 0 HP
      const shouldEjectCrew = newHp === 0 && !vehicle.isInoperative;

      // If vehicle becomes inoperative, eject all crew
      let updatedCreatures = state.creatures;
      let updatedCrewAssignments = state.crewAssignments;
      let updatedInitiativeOrder = state.initiativeOrder;
      let updatedCurrentTurnIndex = state.currentTurnIndex;
      const logEntries: LogEntry[] = [];
      const ejectedCreatures: Creature[] = [];

      if (shouldEjectCrew) {
        const vehicleCrew = state.crewAssignments.filter((a) => a.vehicleId === vehicle.id);

        // Remove destroyed vehicle from initiative order and adjust turn index
        const vehicleIndex = updatedInitiativeOrder.indexOf(vehicle.id);
        if (vehicleIndex !== -1) {
          updatedInitiativeOrder = updatedInitiativeOrder.filter((id) => id !== vehicle.id);
          // If the destroyed vehicle was at or before current turn, adjust index
          if (vehicleIndex <= state.currentTurnIndex) {
            updatedCurrentTurnIndex = Math.max(0, state.currentTurnIndex - 1);
          }
        }

        if (vehicleCrew.length > 0) {
          updatedCreatures = state.creatures.map((creature) => {
            const assignment = vehicleCrew.find((a) => a.creatureId === creature.id);
            if (!assignment) return creature;

            const crewIndex = vehicleCrew.indexOf(assignment);
            const angle = (crewIndex / vehicleCrew.length) * 2 * Math.PI;
            const offset = 15;
            const newPosition = {
              x: vehicle.position.x + Math.cos(angle) * offset,
              y: vehicle.position.y + Math.sin(angle) * offset,
            };

            const updatedCreature = { ...creature, position: newPosition };
            ejectedCreatures.push(updatedCreature);
            return updatedCreature;
          });

          updatedCrewAssignments = state.crewAssignments.filter((a) => a.vehicleId !== vehicle.id);

          // Add ejected creatures to initiative order (if in combat)
          if (state.phase === 'combat' && ejectedCreatures.length > 0) {
            updatedInitiativeOrder = insertCreaturesIntoInitiative(
              updatedInitiativeOrder,
              ejectedCreatures,
              updatedCreatures,
              state.vehicles
            );
          }

          logEntries.push(
            createLogEntry(
              state.round,
              'system',
              `${vehicle.name} is destroyed! All crew ejected.`,
              `${vehicleCrew.length} creature(s) placed on the battlefield and added to initiative`
            )
          );
        }
      }

      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.id
            ? { ...v, ...updates, isInoperative: shouldEjectCrew ? true : v.isInoperative }
            : v
        ),
        creatures: updatedCreatures,
        crewAssignments: updatedCrewAssignments,
        initiativeOrder: updatedInitiativeOrder,
        currentTurnIndex: updatedCurrentTurnIndex,
        actionLog: logEntries.length > 0 ? [...state.actionLog, ...logEntries] : state.actionLog,
      };
    }

    case 'SWAP_VEHICLE_WEAPON':
      return {
        ...state,
        vehicles: state.vehicles.map((v) => {
          if (v.id !== action.payload.vehicleId) return v;
          const newWeapons = [...v.weapons];
          newWeapons[action.payload.weaponIndex] = action.payload.newWeapon;
          return { ...v, weapons: newWeapons };
        }),
      };

    case 'SET_VEHICLE_ARMOR':
      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? { ...v, armorUpgradeId: action.payload.armorUpgradeId }
            : v
        ),
      };

    case 'TOGGLE_VEHICLE_GADGET':
      return {
        ...state,
        vehicles: state.vehicles.map((v) => {
          if (v.id !== action.payload.vehicleId) return v;
          const currentGadgets = v.gadgetIds || [];
          const gadgetId = action.payload.gadgetId;
          const hasGadget = currentGadgets.includes(gadgetId);
          return {
            ...v,
            gadgetIds: hasGadget
              ? currentGadgets.filter((id) => id !== gadgetId)
              : [...currentGadgets, gadgetId],
          };
        }),
      };

    case 'TOGGLE_WEAPON_STATION_UPGRADE':
      return {
        ...state,
        vehicles: state.vehicles.map((v) => {
          if (v.id !== action.payload.vehicleId) return v;
          const weaponStationConfig = getWeaponStationUpgrade(v.template.id);
          const hasUpgrade = v.hasWeaponStationUpgrade;
          if (hasUpgrade) {
            // Remove the weapon station: remove the weapon and mark as not having upgrade
            return {
              ...v,
              hasWeaponStationUpgrade: false,
              weapons: v.weapons.filter((w) => w.zoneId !== weaponStationConfig.zoneId),
            };
          } else {
            // Add the weapon station: add the default weapon with vehicle-specific arcs
            const newWeapon: VehicleWeapon = {
              ...weaponStationConfig.defaultWeapon,
              id: `${weaponStationConfig.defaultWeapon.id}_custom`,
              zoneId: weaponStationConfig.zoneId,
              visibleFromArcs: weaponStationConfig.visibleFromArcs,
              isSwappableStation: true,
              currentAmmunition: 10,
            };
            return {
              ...v,
              hasWeaponStationUpgrade: true,
              weapons: [...v.weapons, newWeapon],
            };
          }
        }),
      };

    // ========== Creatures ==========
    case 'ADD_CREATURE':
      return {
        ...state,
        creatures: [...state.creatures, action.payload],
      };

    case 'REMOVE_CREATURE':
      return {
        ...state,
        creatures: state.creatures.filter((c) => c.id !== action.payload),
        crewAssignments: state.crewAssignments.filter(
          (a) => a.creatureId !== action.payload
        ),
        initiativeOrder: state.initiativeOrder.filter(
          (id) => id !== action.payload
        ),
      };

    case 'UPDATE_CREATURE': {
      const creature = state.creatures.find((c) => c.id === action.payload.id);
      if (!creature) return state;

      const updates = action.payload.updates;
      const newHp = updates.currentHp !== undefined ? updates.currentHp : creature.currentHp;

      // Check if creature just died (HP going to 0 from > 0)
      const justDied = newHp === 0 && creature.currentHp > 0;
      const logEntries: LogEntry[] = [];

      // If creature died while on a vehicle, log that station is unmanned
      // (Body stays at station - crew assignment remains, but weapon ranges won't show)
      if (justDied) {
        const assignment = state.crewAssignments.find((a) => a.creatureId === creature.id);
        if (assignment) {
          const vehicle = state.vehicles.find((v) => v.id === assignment.vehicleId);
          const zone = vehicle ? resolveZone(vehicle, assignment.zoneId) : undefined;
          logEntries.push(
            createLogEntry(
              state.round,
              'system',
              `${creature.name} is incapacitated at their station`,
              zone ? `${zone.name} on ${vehicle?.name} is now unmanned` : undefined
            )
          );
        }
      }

      return {
        ...state,
        creatures: state.creatures.map((c) =>
          c.id === action.payload.id ? { ...c, ...updates } : c
        ),
        actionLog: logEntries.length > 0 ? [...state.actionLog, ...logEntries] : state.actionLog,
      };
    }

    // ========== Crew Assignments ==========
    case 'ASSIGN_CREW':
      // Remove existing assignment for this creature
      const filteredAssignments = state.crewAssignments.filter(
        (a) => a.creatureId !== action.payload.creatureId
      );
      return {
        ...state,
        crewAssignments: [...filteredAssignments, action.payload],
      };

    case 'UNASSIGN_CREW': {
      // Find the current assignment to get the vehicle
      const currentAssignment = state.crewAssignments.find(
        (a) => a.creatureId === action.payload.creatureId
      );

      if (!currentAssignment) {
        return {
          ...state,
          crewAssignments: state.crewAssignments.filter(
            (a) => a.creatureId !== action.payload.creatureId
          ),
        };
      }

      const vehicle = state.vehicles.find((v) => v.id === currentAssignment.vehicleId);
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);

      if (!vehicle || !creature) {
        return {
          ...state,
          crewAssignments: state.crewAssignments.filter(
            (a) => a.creatureId !== action.payload.creatureId
          ),
        };
      }

      // Place creature 15ft from vehicle at a random angle
      const angle = Math.random() * 2 * Math.PI;
      const offset = 15;
      const newPosition = {
        x: vehicle.position.x + Math.cos(angle) * offset,
        y: vehicle.position.y + Math.sin(angle) * offset,
      };

      // Update creature with position
      const updatedCreature = { ...creature, position: newPosition };
      const updatedCreatures = state.creatures.map((c) =>
        c.id === creature.id ? updatedCreature : c
      );

      // Add to initiative order if in combat
      // Insert IMMEDIATELY after current turn so they can act this round
      // (On next round, NEXT_ROUND will re-sort to proper initiative order)
      let updatedInitiativeOrder = state.initiativeOrder;
      if (state.phase === 'combat' && !state.initiativeOrder.includes(creature.id)) {
        // Insert right after the current turn index
        const insertIndex = state.currentTurnIndex + 1;
        updatedInitiativeOrder = [
          ...state.initiativeOrder.slice(0, insertIndex),
          creature.id,
          ...state.initiativeOrder.slice(insertIndex),
        ];
      }

      // Create log entry
      const logEntries: LogEntry[] = [];
      if (state.phase === 'combat') {
        logEntries.push(
          createLogEntry(
            state.round,
            'movement',
            `${creature.name} exits ${vehicle.name}`,
            'Acts immediately after current turn, then normal initiative next round'
          )
        );
      }

      return {
        ...state,
        creatures: updatedCreatures,
        crewAssignments: state.crewAssignments.filter(
          (a) => a.creatureId !== action.payload.creatureId
        ),
        initiativeOrder: updatedInitiativeOrder,
        actionLog: logEntries.length > 0 ? [...state.actionLog, ...logEntries] : state.actionLog,
      };
    }

    // ========== Environment ==========
    case 'SET_ENVIRONMENT':
      return {
        ...state,
        environment: { ...state.environment, ...action.payload },
      };

    case 'SET_CHASE_MODE':
      return {
        ...state,
        isChase: action.payload.isChase,
        pursuerIds: action.payload.pursuerIds,
        quarryIds: action.payload.quarryIds,
      };

    case 'SET_BACKGROUND_IMAGE':
      return {
        ...state,
        battlefield: {
          ...state.battlefield,
          backgroundImage: action.payload ?? undefined,
        },
      };

    // ========== Initiative ==========
    case 'SET_INITIATIVE':
      return {
        ...state,
        creatures: state.creatures.map((c) =>
          c.id === action.payload.creatureId
            ? { ...c, initiative: action.payload.initiative }
            : c
        ),
      };

    case 'SET_INITIATIVE_ORDER':
      return {
        ...state,
        initiativeOrder: action.payload,
      };

    case 'START_COMBAT': {
      // Vehicle-Based Initiative (per Avernus rules):
      // - Each VEHICLE rolls initiative using driver's DEX modifier
      // - ALL crew acts on the vehicle's turn simultaneously
      // - Vehicles without drivers act LAST
      // - Only creatures NOT assigned to any vehicle act separately

      type InitiativeEntry = { id: string; type: 'creature' | 'vehicle'; initiative: number; name: string };
      const initiativeEntries: InitiativeEntry[] = [];

      // Get all creature IDs that are assigned to ANY vehicle
      const crewCreatureIds = new Set(state.crewAssignments.map((a) => a.creatureId));

      // Add ALL vehicles to initiative
      state.vehicles.forEach((vehicle) => {
        const driver = findVehicleDriver(vehicle, state.crewAssignments, state.creatures);
        // Use driver's initiative, or -100 if no driver (acts last)
        const initiative = driver ? driver.initiative : -100;

        initiativeEntries.push({
          id: vehicle.id,
          type: 'vehicle',
          initiative,
          name: vehicle.name,
        });
      });

      // Add creatures that are NOT assigned to any vehicle (they act independently)
      state.creatures.forEach((creature) => {
        if (!crewCreatureIds.has(creature.id)) {
          initiativeEntries.push({
            id: creature.id,
            type: 'creature',
            initiative: creature.initiative,
            name: creature.name,
          });
        }
      });

      // Sort by initiative (descending), then alphabetically for ties
      initiativeEntries.sort((a, b) => {
        if (b.initiative !== a.initiative) {
          return b.initiative - a.initiative;
        }
        return a.name.localeCompare(b.name);
      });

      return {
        ...state,
        phase: 'combat',
        round: 1,
        initiativeOrder: initiativeEntries.map((e) => e.id),
        currentTurnIndex: 0,
        actionLog: [
          ...state.actionLog,
          createLogEntry(1, 'round_start', 'Combat begins! Round 1'),
        ],
      };
    }

    // ========== Combat Flow ==========
    case 'NEXT_TURN': {
      // Find the next valid turn, skipping destroyed vehicles and dead NPCs
      let nextIndex = state.currentTurnIndex + 1;

      while (nextIndex < state.initiativeOrder.length) {
        const candidateId = state.initiativeOrder[nextIndex];
        const candidateVehicle = state.vehicles.find((v) => v.id === candidateId);
        const candidateCreature = state.creatures.find((c) => c.id === candidateId);

        // Skip destroyed vehicles
        if (candidateVehicle && (candidateVehicle.isInoperative || candidateVehicle.currentHp === 0)) {
          nextIndex++;
          continue;
        }

        // Skip dead NPCs (but not PCs - they might need death saves)
        if (candidateCreature && candidateCreature.currentHp === 0 && candidateCreature.statblock.type !== 'pc') {
          nextIndex++;
          continue;
        }

        // Found a valid turn
        break;
      }

      if (nextIndex >= state.initiativeOrder.length) {
        // End of round - no more valid turns
        return state; // Handle via NEXT_ROUND
      }

      const nextId = state.initiativeOrder[nextIndex];
      const nextVehicle = state.vehicles.find((v) => v.id === nextId);
      const nextCreature = state.creatures.find((c) => c.id === nextId);

      let turnName = 'Unknown';
      if (nextVehicle) {
        const driver = findVehicleDriver(nextVehicle, state.crewAssignments, state.creatures);
        turnName = driver ? `${nextVehicle.name} (${driver.name})` : nextVehicle.name;
      } else if (nextCreature) {
        turnName = nextCreature.name;
      }

      return {
        ...state,
        currentTurnIndex: nextIndex,
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            'turn_start',
            `${turnName}'s turn`
          ),
        ],
      };
    }

    case 'PREVIOUS_TURN': {
      const prevIndex = Math.max(0, state.currentTurnIndex - 1);
      return {
        ...state,
        currentTurnIndex: prevIndex,
      };
    }

    case 'NEXT_ROUND': {
      const newRound = state.round + 1;
      // Tick mishap durations and clear expired speed modifiers
      const updatedVehicles = state.vehicles.map((v) => {
        // Process mishaps
        const updatedMishaps = v.activeMishaps
          .map((m) => {
            if (m.duration === 'rounds' && m.roundsRemaining !== undefined) {
              return { ...m, roundsRemaining: m.roundsRemaining - 1 };
            }
            return m;
          })
          .filter((m) => m.duration !== 'rounds' || (m.roundsRemaining ?? 1) > 0);

        // Clear expired speed modifiers (those from previous rounds)
        const activeSpeedModifiers = (v.speedModifiers || []).filter((mod) => {
          // Keep 'this_round' modifiers only if they were applied this round
          // (They'll be cleared at the START of next round, so check against current round)
          if (mod.duration === 'this_round' && mod.appliedAtRound < state.round) {
            return false;
          }
          // Keep 'until_cleared' modifiers
          return true;
        });

        return {
          ...v,
          activeMishaps: updatedMishaps,
          speedModifiers: activeSpeedModifiers.length > 0 ? activeSpeedModifiers : undefined,
        };
      });

      // Re-sort initiative order to put creatures back in proper initiative positions
      // (This handles creatures that exited vehicles mid-round and were inserted after current turn)
      const resortedInitiativeOrder = rebuildInitiativeOrder(
        state.initiativeOrder,
        state.vehicles,
        state.creatures,
        state.crewAssignments
      );

      return {
        ...state,
        round: newRound,
        currentTurnIndex: 0,
        vehicles: updatedVehicles,
        initiativeOrder: resortedInitiativeOrder,
        actionLog: [
          ...state.actionLog,
          createLogEntry(newRound, 'round_start', `Round ${newRound} begins`),
        ],
      };
    }

    case 'END_COMBAT':
      return {
        ...state,
        phase: 'ended',
        actionLog: [
          ...state.actionLog,
          createLogEntry(state.round, 'system', 'Combat ended'),
        ],
      };

    case 'RESET_COMBAT':
      // Reset HP, mishaps, turns but keep vehicles/creatures/positions
      return {
        ...state,
        phase: 'setup',
        round: 0,
        currentTurnIndex: 0,
        initiativeOrder: [],
        vehicles: state.vehicles.map((v) => ({
          ...v,
          currentHp: v.template.maxHp,
          activeMishaps: [],
        })),
        creatures: state.creatures.map((c) => ({
          ...c,
          currentHp: c.statblock.maxHp,
          initiative: 0,
        })),
        actionLog: [
          createLogEntry(0, 'system', 'Encounter reset - HP and mishaps restored'),
        ],
      };

    case 'RETURN_TO_SETUP':
      return {
        ...state,
        phase: 'setup',
        round: 0,
        currentTurnIndex: 0,
        actionLog: [
          ...state.actionLog,
          createLogEntry(state.round, 'system', 'Returned to setup phase'),
        ],
      };

    // ========== Damage & Healing ==========
    case 'DEAL_DAMAGE_TO_VEHICLE': {
      const vehicle = state.vehicles.find((v) => v.id === action.payload.vehicleId);
      if (!vehicle) return state;

      const newHp = Math.max(0, vehicle.currentHp - action.payload.amount);
      // Eject crew if vehicle reaches 0 HP and not already marked inoperative
      const shouldEjectCrew = newHp === 0 && !vehicle.isInoperative;

      // If vehicle becomes inoperative, eject all crew
      let updatedCreatures = state.creatures;
      let updatedCrewAssignments = state.crewAssignments;
      let updatedInitiativeOrder = state.initiativeOrder;
      let updatedCurrentTurnIndex = state.currentTurnIndex;
      const logEntries: LogEntry[] = [
        createLogEntry(
          state.round,
          'damage',
          `${vehicle.name} takes ${action.payload.amount} damage`,
          action.payload.source
        ),
      ];
      const ejectedCreatures: Creature[] = [];

      if (shouldEjectCrew) {
        // Find all crew on this vehicle
        const vehicleCrew = state.crewAssignments.filter((a) => a.vehicleId === vehicle.id);

        // Remove destroyed vehicle from initiative order and adjust turn index
        const vehicleIndex = updatedInitiativeOrder.indexOf(vehicle.id);
        if (vehicleIndex !== -1) {
          updatedInitiativeOrder = updatedInitiativeOrder.filter((id) => id !== vehicle.id);
          // If the destroyed vehicle was at or before current turn, adjust index
          if (vehicleIndex <= state.currentTurnIndex) {
            updatedCurrentTurnIndex = Math.max(0, state.currentTurnIndex - 1);
          }
        }

        if (vehicleCrew.length > 0) {
          // Give each crew member a position near the vehicle (spread them out)
          updatedCreatures = state.creatures.map((creature) => {
            const assignment = vehicleCrew.find((a) => a.creatureId === creature.id);
            if (!assignment) return creature;

            // Spread creatures around the vehicle in a circle
            const crewIndex = vehicleCrew.indexOf(assignment);
            const angle = (crewIndex / vehicleCrew.length) * 2 * Math.PI;
            const offset = 15; // 15 feet from vehicle center
            const newPosition = {
              x: vehicle.position.x + Math.cos(angle) * offset,
              y: vehicle.position.y + Math.sin(angle) * offset,
            };

            const updatedCreature = { ...creature, position: newPosition };
            ejectedCreatures.push(updatedCreature);
            return updatedCreature;
          });

          // Remove all crew assignments for this vehicle
          updatedCrewAssignments = state.crewAssignments.filter((a) => a.vehicleId !== vehicle.id);

          // Add ejected creatures to initiative order (if in combat)
          if (state.phase === 'combat' && ejectedCreatures.length > 0) {
            updatedInitiativeOrder = insertCreaturesIntoInitiative(
              updatedInitiativeOrder,
              ejectedCreatures,
              updatedCreatures,
              state.vehicles
            );
          }

          // Add log entry for vehicle destruction
          logEntries.push(
            createLogEntry(
              state.round,
              'system',
              `${vehicle.name} is destroyed! All crew ejected.`,
              `${vehicleCrew.length} creature(s) placed on the battlefield and added to initiative`
            )
          );
        }
      }

      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? { ...v, currentHp: newHp, isInoperative: shouldEjectCrew ? true : v.isInoperative }
            : v
        ),
        creatures: updatedCreatures,
        crewAssignments: updatedCrewAssignments,
        initiativeOrder: updatedInitiativeOrder,
        currentTurnIndex: updatedCurrentTurnIndex,
        actionLog: [...state.actionLog, ...logEntries],
      };
    }

    case 'HEAL_VEHICLE': {
      const vehicle = state.vehicles.find((v) => v.id === action.payload.vehicleId);
      if (!vehicle) return state;

      const newHp = Math.min(vehicle.template.maxHp, vehicle.currentHp + action.payload.amount);
      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId ? { ...v, currentHp: newHp } : v
        ),
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            'healing',
            `${vehicle.name} is repaired for ${action.payload.amount} HP`
          ),
        ],
      };
    }

    case 'DEAL_DAMAGE_TO_CREATURE': {
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);
      if (!creature) return state;

      let remaining = action.payload.amount;
      let newTempHp = creature.tempHp;
      let newHp = creature.currentHp;

      // Damage temp HP first
      if (newTempHp > 0) {
        const tempDamage = Math.min(newTempHp, remaining);
        newTempHp -= tempDamage;
        remaining -= tempDamage;
      }
      newHp = Math.max(0, newHp - remaining);

      // Check if creature just died (went to 0 HP from > 0)
      const justDied = newHp === 0 && creature.currentHp > 0;
      const logEntries: LogEntry[] = [
        createLogEntry(
          state.round,
          'damage',
          `${creature.name} takes ${action.payload.amount} damage`,
          action.payload.source
        ),
      ];

      // If creature died while on a vehicle, log that station is unmanned
      // (Body stays at station - crew assignment remains, but weapon ranges won't show)
      if (justDied) {
        const assignment = state.crewAssignments.find((a) => a.creatureId === creature.id);
        if (assignment) {
          const vehicle = state.vehicles.find((v) => v.id === assignment.vehicleId);
          const zone = vehicle ? resolveZone(vehicle, assignment.zoneId) : undefined;
          logEntries.push(
            createLogEntry(
              state.round,
              'system',
              `${creature.name} is incapacitated at their station`,
              zone ? `${zone.name} on ${vehicle?.name} is now unmanned` : undefined
            )
          );
        }
      }

      return {
        ...state,
        creatures: state.creatures.map((c) =>
          c.id === action.payload.creatureId
            ? { ...c, currentHp: newHp, tempHp: newTempHp }
            : c
        ),
        actionLog: [...state.actionLog, ...logEntries],
      };
    }

    case 'HEAL_CREATURE': {
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);
      if (!creature) return state;

      const newHp = Math.min(
        creature.statblock.maxHp,
        creature.currentHp + action.payload.amount
      );
      return {
        ...state,
        creatures: state.creatures.map((c) =>
          c.id === action.payload.creatureId ? { ...c, currentHp: newHp } : c
        ),
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            'healing',
            `${creature.name} heals for ${action.payload.amount} HP`
          ),
        ],
      };
    }

    // ========== Mishaps ==========
    case 'APPLY_MISHAP': {
      const vehicle = state.vehicles.find((v) => v.id === action.payload.vehicleId);
      if (!vehicle) return state;

      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? { ...v, activeMishaps: [...v.activeMishaps, action.payload.mishap] }
            : v
        ),
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            'mishap',
            `${vehicle.name}: ${action.payload.mishap.name}`,
            action.payload.mishap.effect
          ),
        ],
      };
    }

    case 'REPAIR_MISHAP':
      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? {
                ...v,
                activeMishaps: v.activeMishaps.filter(
                  (m) => m.id !== action.payload.mishapId
                ),
              }
            : v
        ),
      };

    // ========== Position & Scale ==========
    case 'UPDATE_VEHICLE_POSITION':
      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? { ...v, position: action.payload.position }
            : v
        ),
      };

    case 'UPDATE_VEHICLE_FACING':
      return {
        ...state,
        vehicles: state.vehicles.map((v) =>
          v.id === action.payload.vehicleId
            ? { ...v, facing: action.payload.facing }
            : v
        ),
      };

    case 'SET_SCALE':
      return {
        ...state,
        scale: action.payload,
        battlefield: { ...state.battlefield, scale: action.payload },
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            'scale_change',
            `Scale changed to ${SCALES[action.payload].displayName}`
          ),
        ],
      };

    case 'UPDATE_BATTLEFIELD':
      return {
        ...state,
        battlefield: { ...state.battlefield, ...action.payload },
      };

    // ========== Elevation Zones ==========
    case 'ADD_ELEVATION_ZONE':
      return {
        ...state,
        elevationZones: [...state.elevationZones, action.payload],
      };

    case 'UPDATE_ELEVATION_ZONE':
      return {
        ...state,
        elevationZones: state.elevationZones.map((zone) =>
          zone.id === action.payload.id
            ? { ...zone, ...action.payload.updates }
            : zone
        ),
      };

    case 'REMOVE_ELEVATION_ZONE':
      return {
        ...state,
        elevationZones: state.elevationZones.filter((zone) => zone.id !== action.payload),
      };

    case 'SET_PLAYER_VIEW_SETTINGS':
      return {
        ...state,
        playerViewSettings: {
          ...state.playerViewSettings,
          ...action.payload,
        },
      };

    // ========== Logging ==========
    case 'LOG_ACTION':
      return {
        ...state,
        actionLog: [
          ...state.actionLog,
          createLogEntry(
            state.round,
            action.payload.type,
            action.payload.action,
            action.payload.details
          ),
        ],
      };

    case 'CLEAR_LOG':
      return {
        ...state,
        actionLog: [],
      };

    // ========== Complications ==========
    case 'TOGGLE_AUTO_ROLL_COMPLICATIONS':
      return {
        ...state,
        autoRollComplications: !state.autoRollComplications,
      };

    case 'START_COMPLICATION_RESOLUTION': {
      const { complication, roll, rollRange } = action.payload;

      // Create resolution entries for all non-destroyed vehicles
      const resolutions: VehicleComplicationResolution[] = state.vehicles
        .filter((v) => !v.isInoperative && v.currentHp > 0)
        .map((vehicle) => {
          // Find the driver for this vehicle
          const driver = findVehicleDriver(vehicle, state.crewAssignments, state.creatures);
          return {
            vehicleId: vehicle.id,
            status: 'pending' as ComplicationResolutionStatus,
            driverName: driver?.name,
          };
        });

      const activeBattlefieldComplication: ActiveBattlefieldComplication = {
        id: uuid(),
        complication,
        roll,
        rollRange,
        round: state.round,
        resolutions,
        isResolved: false,
      };

      return {
        ...state,
        activeBattlefieldComplication,
      };
    }

    case 'RESOLVE_VEHICLE_COMPLICATION': {
      if (!state.activeBattlefieldComplication) return state;

      const { vehicleId, status, rollResult, modifier, total } = action.payload;

      const updatedResolutions = state.activeBattlefieldComplication.resolutions.map((res) =>
        res.vehicleId === vehicleId
          ? { ...res, status, rollResult, modifier, total }
          : res
      );

      // Check if all vehicles have been resolved
      const allResolved = updatedResolutions.every((res) => res.status !== 'pending');

      return {
        ...state,
        activeBattlefieldComplication: {
          ...state.activeBattlefieldComplication,
          resolutions: updatedResolutions,
          isResolved: allResolved,
        },
      };
    }

    case 'APPLY_COMPLICATION_EFFECTS': {
      if (!state.activeBattlefieldComplication) return state;

      const complication = state.activeBattlefieldComplication.complication;
      const failedVehicleIds = state.activeBattlefieldComplication.resolutions
        .filter((res) => res.status === 'failed')
        .map((res) => res.vehicleId);

      // Determine what effects to apply based on the complication
      const mechanicalEffect = complication.mechanicalEffect;
      const logEntries: LogEntry[] = [];

      // Apply speed modifiers to failed vehicles
      let updatedVehicles = state.vehicles;

      if (failedVehicleIds.length > 0 && mechanicalEffect?.skillCheck?.failureEffect) {
        const failureEffect = mechanicalEffect.skillCheck.failureEffect.toLowerCase();

        // Check for difficult terrain / speed effects
        const isDifficultTerrain =
          failureEffect.includes('difficult terrain') ||
          failureEffect.includes('speed halved');

        if (isDifficultTerrain) {
          updatedVehicles = state.vehicles.map((vehicle) => {
            if (!failedVehicleIds.includes(vehicle.id)) return vehicle;

            const newModifier: SpeedModifier = {
              id: uuid(),
              source: `${complication.name} complication`,
              multiplier: 0.5, // Half speed for difficult terrain
              duration: 'this_round',
              appliedAtRound: state.round,
            };

            logEntries.push(
              createLogEntry(
                state.round,
                'complication',
                `${vehicle.name} fails save - speed halved this round`,
                complication.name
              )
            );

            return {
              ...vehicle,
              speedModifiers: [...(vehicle.speedModifiers || []), newModifier],
            };
          });
        }
      }

      // Log passed vehicles
      const passedVehicleIds = state.activeBattlefieldComplication.resolutions
        .filter((res) => res.status === 'passed')
        .map((res) => res.vehicleId);

      for (const vehicleId of passedVehicleIds) {
        const vehicle = state.vehicles.find((v) => v.id === vehicleId);
        if (vehicle) {
          logEntries.push(
            createLogEntry(
              state.round,
              'complication',
              `${vehicle.name} passes save - no effect`,
              complication.name
            )
          );
        }
      }

      return {
        ...state,
        vehicles: updatedVehicles,
        activeBattlefieldComplication: undefined, // Clear after applying
        actionLog: [...state.actionLog, ...logEntries],
      };
    }

    case 'CLEAR_COMPLICATION':
      return {
        ...state,
        activeBattlefieldComplication: undefined,
      };

    case 'CLEAR_EXPIRED_SPEED_MODIFIERS': {
      const updatedVehicles = state.vehicles.map((vehicle) => {
        if (!vehicle.speedModifiers || vehicle.speedModifiers.length === 0) {
          return vehicle;
        }

        const activeModifiers = vehicle.speedModifiers.filter((mod) => {
          // Clear 'this_round' modifiers from previous rounds
          if (mod.duration === 'this_round' && mod.appliedAtRound < state.round) {
            return false;
          }
          // Clear 'this_turn' modifiers from previous turns
          if (
            mod.duration === 'this_turn' &&
            mod.appliedAtTurnIndex !== undefined &&
            mod.appliedAtTurnIndex < state.currentTurnIndex
          ) {
            return false;
          }
          return true;
        });

        if (activeModifiers.length === vehicle.speedModifiers.length) {
          return vehicle;
        }

        return { ...vehicle, speedModifiers: activeModifiers };
      });

      return {
        ...state,
        vehicles: updatedVehicles,
      };
    }

    default:
      return state;
  }
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Insert creatures into the initiative order based on their initiative values.
 * Maintains sorted order (highest first).
 */
function insertCreaturesIntoInitiative(
  currentOrder: string[],
  creaturesToAdd: Creature[],
  allCreatures: Creature[],
  allVehicles: Vehicle[]
): string[] {
  if (creaturesToAdd.length === 0) return currentOrder;

  // Build a map of ID -> initiative for existing entries
  const getInitiative = (id: string): number => {
    const creature = allCreatures.find((c) => c.id === id);
    if (creature) return creature.initiative || 0;
    // For vehicles, we'd need driver initiative, but ejected creatures are creatures
    return 0;
  };

  // Start with current order
  const newOrder = [...currentOrder];

  // Insert each creature at the correct position
  for (const creature of creaturesToAdd) {
    // Skip if already in the order
    if (newOrder.includes(creature.id)) continue;

    const creatureInit = creature.initiative || 0;

    // Find the right position (after all entries with higher or equal initiative)
    let insertIndex = newOrder.length;
    for (let i = 0; i < newOrder.length; i++) {
      const existingInit = getInitiative(newOrder[i]);
      if (creatureInit > existingInit) {
        insertIndex = i;
        break;
      }
    }

    newOrder.splice(insertIndex, 0, creature.id);
  }

  return newOrder;
}

/**
 * Rebuild the initiative order from scratch, sorting all participants by initiative.
 * Used at the start of each round to ensure proper turn order after mid-round changes.
 * Filters out destroyed vehicles and dead NPCs.
 */
function rebuildInitiativeOrder(
  currentOrder: string[],
  vehicles: Vehicle[],
  creatures: Creature[],
  crewAssignments: CrewAssignment[]
): string[] {
  type InitiativeEntry = { id: string; initiative: number; name: string };
  const initiativeEntries: InitiativeEntry[] = [];

  // Get all creature IDs that are assigned to ANY vehicle (they act on vehicle's turn)
  const crewCreatureIds = new Set(crewAssignments.map((a) => a.creatureId));

  // Only include IDs that are in the current order (don't add new ones)
  const currentOrderSet = new Set(currentOrder);

  // Add vehicles that are in the current order (skip destroyed vehicles)
  for (const vehicle of vehicles) {
    if (!currentOrderSet.has(vehicle.id)) continue;
    // Skip destroyed/inoperative vehicles
    if (vehicle.isInoperative || vehicle.currentHp === 0) continue;

    const driver = findVehicleDriver(vehicle, crewAssignments, creatures);
    // Use driver's initiative, or -100 if no driver (acts last)
    const initiative = driver ? driver.initiative : -100;

    initiativeEntries.push({
      id: vehicle.id,
      initiative,
      name: vehicle.name,
    });
  }

  // Add creatures that are NOT assigned to any vehicle AND are in the current order
  for (const creature of creatures) {
    if (!currentOrderSet.has(creature.id)) continue;
    if (crewCreatureIds.has(creature.id)) continue; // Skip crew members
    // Skip dead NPCs (but keep PCs for death saves)
    if (creature.currentHp === 0 && creature.statblock.type !== 'pc') continue;

    initiativeEntries.push({
      id: creature.id,
      initiative: creature.initiative || 0,
      name: creature.name,
    });
  }

  // Sort by initiative (descending), then alphabetically for ties
  initiativeEntries.sort((a, b) => {
    if (b.initiative !== a.initiative) {
      return b.initiative - a.initiative;
    }
    return a.name.localeCompare(b.name);
  });

  return initiativeEntries.map((e) => e.id);
}

function createLogEntry(
  round: number,
  type: LogEntryType,
  action: string,
  details?: string
): LogEntry {
  return {
    id: uuid(),
    timestamp: new Date(),
    round,
    type,
    action,
    details,
  };
}

/**
 * Find the driver (helm operator) for a vehicle.
 * Driver is the creature assigned to a driver zone (Helm, Rider, or first zone by convention).
 */
function findVehicleDriver(
  vehicle: Vehicle,
  crewAssignments: CrewAssignment[],
  creatures: Creature[]
): Creature | undefined {
  // Get all crew assignments for this vehicle
  const vehicleAssignments = crewAssignments.filter((a) => a.vehicleId === vehicle.id);
  if (vehicleAssignments.length === 0) return undefined;

  // Find crew assignment for helm position - check zone ID and zone name
  const driverZonePatterns = ['helm', 'rider', 'driver', 'pilot'];

  // First, try to find someone in an explicit driver zone
  for (const assignment of vehicleAssignments) {
    const zone = vehicle.template.zones.find((z) => z.id === assignment.zoneId);
    if (!zone) continue;

    // Check if zone ID or name matches driver patterns
    const zoneIdLower = assignment.zoneId.toLowerCase();
    const zoneNameLower = zone.name.toLowerCase();

    if (driverZonePatterns.some((p) => zoneIdLower.includes(p) || zoneNameLower.includes(p))) {
      return creatures.find((c) => c.id === assignment.creatureId);
    }
  }

  // Fallback: use the first assigned crew member as driver (first zone = driver convention)
  // Sort by zone order in template to get the "first" zone
  const sortedAssignments = [...vehicleAssignments].sort((a, b) => {
    const aIndex = vehicle.template.zones.findIndex((z) => z.id === a.zoneId);
    const bIndex = vehicle.template.zones.findIndex((z) => z.id === b.zoneId);
    return aIndex - bIndex;
  });

  const firstAssignment = sortedAssignments[0];
  return creatures.find((c) => c.id === firstAssignment.creatureId);
}

/**
 * Get the initiative value for a vehicle based on its driver.
 * Returns the driver's initiative, or -1 if no driver.
 */
function getVehicleInitiative(
  vehicle: Vehicle,
  crewAssignments: CrewAssignment[],
  creatures: Creature[]
): number {
  const driver = findVehicleDriver(vehicle, crewAssignments, creatures);
  return driver ? driver.initiative : -1;
}

// ==========================================
// Context
// ==========================================

interface CombatContextValue {
  state: CombatState;
  dispatch: React.Dispatch<CombatAction>;

  // Convenience methods
  addVehicle: (vehicle: Vehicle) => void;
  removeVehicle: (vehicleId: string) => void;
  addCreature: (creature: Creature) => void;
  removeCreature: (creatureId: string) => void;
  assignCrew: (assignment: CrewAssignment) => void;
  dealDamage: (targetType: 'vehicle' | 'creature', targetId: string, amount: number, source?: string) => void;
  applyMishap: (vehicleId: string, mishap: Mishap) => void;
  updateVehiclePosition: (vehicleId: string, position: Position) => void;
  updateVehicleFacing: (vehicleId: string, facing: number) => void;
  startCombat: () => void;
  returnToSetup: () => void;
  resetCombat: () => void;
  nextTurn: () => void;
  nextRound: () => void;
  setScale: (scale: ScaleName) => void;
  loadEncounter: (encounter: CombatState) => void;
  newEncounter: (name: string) => void;
  setEncounterName: (name: string) => void;
  getVehicleDriver: (vehicle: Vehicle) => Creature | undefined;
  setBackgroundImage: (config: BackgroundImageConfig | null) => void;
  forceSave: () => void;
  markAsSaved: () => void;
  swapVehicleWeapon: (vehicleId: string, weaponIndex: number, newWeapon: VehicleWeapon) => void;
  setVehicleArmor: (vehicleId: string, armorUpgradeId: string) => void;
  toggleVehicleGadget: (vehicleId: string, gadgetId: string) => void;
  toggleWeaponStationUpgrade: (vehicleId: string) => void;
  loadPartyPreset: (vehicles: Vehicle[], creatures: Creature[], crewAssignments: CrewAssignment[]) => void;
  toggleAutoRollComplications: () => void;
  logComplication: (roll: number, complicationName: string | null, details?: string) => void;
  startComplicationResolution: (complication: ChaseComplication, roll: number, rollRange: string) => void;
  resolveVehicleComplication: (vehicleId: string, status: ComplicationResolutionStatus, rollResult?: number, modifier?: number, total?: number) => void;
  applyComplicationEffects: () => void;
  clearComplication: () => void;
  getDriverDexSave: (vehicle: Vehicle) => { modifier: number; driverName: string } | null;
  getEffectiveSpeed: (vehicle: Vehicle) => number;

  // Computed values
  currentTurnCreature: Creature | undefined;
  currentTurnVehicle: Vehicle | undefined;
  currentTurnDriver: Creature | undefined;
  isSetupPhase: boolean;
  isCombatActive: boolean;
  lastSaved: Date | null;
}

const CombatContext = createContext<CombatContextValue | null>(null);

// ==========================================
// Provider
// ==========================================

interface CombatProviderProps {
  children: ReactNode;
  initialState?: CombatState;
}

/**
 * Load initial state from localStorage or use default
 */
function getInitialState(providedState?: CombatState): CombatState {
  // If state was explicitly provided, use it
  if (providedState) return providedState;

  // Try to load from localStorage
  try {
    console.log('Attempting to load encounter from localStorage...');
    const saved = loadCurrentEncounter();
    console.log('Raw loaded data:', saved ? 'Found data' : 'No data found');
    if (saved) {
      console.log('Loaded data keys:', Object.keys(saved as object));
      console.log('Loaded phase:', (saved as { phase?: string }).phase);
      console.log('Loaded hasBeenSaved:', (saved as { hasBeenSaved?: boolean }).hasBeenSaved);
      console.log('Has backgroundImage:', !!(saved as { battlefield?: { backgroundImage?: unknown } }).battlefield?.backgroundImage);
    }
    if (saved && typeof saved === 'object') {
      // Merge with initial state to ensure all required fields exist
      const loadedState = saved as Partial<CombatState>;

      // Migrate vehicles to fix weapon zones and add isSwappableStation flag
      const migratedVehicles = (loadedState.vehicles || []).map((vehicle) => ({
        ...vehicle,
        weapons: vehicle.weapons.map((weapon) => {
          let zoneId = weapon.zoneId;

          // Fix harpoon weapons that are incorrectly assigned to helm
          if ((weapon.id.includes('harpoon') || weapon.name?.toLowerCase().includes('harpoon')) && zoneId === 'helm') {
            const harpoonZone = vehicle.template.zones.find(
              (z: { id: string; name: string }) => z.id.includes('harpoon') || z.name.toLowerCase().includes('harpoon')
            );
            if (harpoonZone) {
              zoneId = harpoonZone.id;
              console.log(`Migrated ${vehicle.name} weapon ${weapon.name} from helm to ${harpoonZone.name}`);
            }
          }

          return {
            ...weapon,
            zoneId,
            // Mark harpoon weapons as swappable if not already set
            isSwappableStation: weapon.isSwappableStation ?? weapon.id.includes('harpoon') ?? weapon.name?.toLowerCase().includes('harpoon'),
          };
        }),
      }));

      // Build the restored state, explicitly preserving all combat-critical fields
      const restoredState: CombatState = {
        ...initialCombatState,
        ...loadedState,
        // Explicitly preserve combat state fields
        id: loadedState.id || initialCombatState.id,
        name: loadedState.name || initialCombatState.name,
        phase: loadedState.phase || initialCombatState.phase,
        round: loadedState.round ?? initialCombatState.round,
        currentTurnIndex: loadedState.currentTurnIndex ?? initialCombatState.currentTurnIndex,
        hasBeenSaved: loadedState.hasBeenSaved ?? false,
        scale: loadedState.scale || initialCombatState.scale,
        // Nested objects need explicit merging
        battlefield: {
          ...initialCombatState.battlefield,
          ...(loadedState.battlefield || {}),
          // Explicitly preserve background image if it exists
          backgroundImage: loadedState.battlefield?.backgroundImage || undefined,
        },
        environment: {
          ...initialCombatState.environment,
          ...(loadedState.environment || {}),
        },
        // Arrays with vehicle and creature migration
        vehicles: migratedVehicles,
        // Migrate creatures to add faction field if missing
        creatures: (loadedState.creatures || []).map((creature) => ({
          ...creature,
          // Default faction based on type: PCs are party, others are enemy
          faction: creature.faction ?? (creature.statblock.type === 'pc' ? 'party' : 'enemy'),
        })),
        crewAssignments: loadedState.crewAssignments || [],
        initiativeOrder: loadedState.initiativeOrder || [],
        actionLog: loadedState.actionLog || [],
      };

      console.log('Restored encounter from auto-save:', {
        name: restoredState.name,
        phase: restoredState.phase,
        round: restoredState.round,
        currentTurnIndex: restoredState.currentTurnIndex,
        hasBeenSaved: restoredState.hasBeenSaved,
        vehicleCount: restoredState.vehicles.length,
        creatureCount: restoredState.creatures.length,
        hasBackgroundImage: !!restoredState.battlefield.backgroundImage,
        initiativeOrderLength: restoredState.initiativeOrder.length,
      });

      return restoredState;
    }
  } catch (error) {
    console.warn('Failed to load saved encounter:', error);
  }

  // Return fresh state with new ID
  return { ...initialCombatState, id: uuid() };
}

export function CombatProvider({ children, initialState }: CombatProviderProps) {
  const [state, dispatch] = useReducer(
    combatReducer,
    initialState,
    () => getInitialState(initialState)
  );

  // Track last saved time for UI feedback
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Keep a ref to always have the latest state (avoids stale closure issues)
  const stateRef = useRef(state);
  stateRef.current = state;

  // Direct save function using current state parameter
  const saveState = useCallback((stateToSave: CombatState) => {
    try {
      const serialized = JSON.stringify(stateToSave);
      const sizeKB = Math.round(serialized.length / 1024);
      const sizeMB = (serialized.length / (1024 * 1024)).toFixed(2);

      // Check if we're approaching localStorage limit (typically 5MB)
      if (serialized.length > 4 * 1024 * 1024) {
        console.warn(`Save data is very large (${sizeMB}MB). May exceed localStorage quota.`);
      }

      window.localStorage.setItem(AUTO_SAVE_KEY, serialized);
      setLastSaved(new Date());

      // Verify save worked by reading it back
      const verification = window.localStorage.getItem(AUTO_SAVE_KEY);
      const verifyParsed = verification ? JSON.parse(verification) : null;

      console.log(`Saved encounter (${sizeKB}KB / ${sizeMB}MB)`, {
        phase: stateToSave.phase,
        round: stateToSave.round,
        hasBackgroundImage: !!stateToSave.battlefield.backgroundImage,
        bgImageSize: stateToSave.battlefield.backgroundImage?.url?.length
          ? `${Math.round(stateToSave.battlefield.backgroundImage.url.length / 1024)}KB`
          : 'none',
        vehicleCount: stateToSave.vehicles.length,
        verified: !!verifyParsed?.battlefield?.backgroundImage,
      });
    } catch (error) {
      if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
        console.error('SAVE FAILED: localStorage quota exceeded. Background image is too large. Try using a smaller image.');
        alert('Save failed: The background image is too large. Please use a smaller image (under 2MB recommended).');
      } else {
        console.error('Save failed:', error);
      }
    }
  }, []);

  // Save when important state changes (phase, round, turn, background image, hasBeenSaved)
  const prevPhaseRef = useRef(state.phase);
  const prevRoundRef = useRef(state.round);
  const prevTurnRef = useRef(state.currentTurnIndex);
  const prevHasBgRef = useRef(!!state.battlefield.backgroundImage);
  const prevHasBeenSavedRef = useRef(state.hasBeenSaved);

  useEffect(() => {
    const phaseChanged = prevPhaseRef.current !== state.phase;
    const roundChanged = prevRoundRef.current !== state.round;
    const turnChanged = prevTurnRef.current !== state.currentTurnIndex;
    const hasBgNow = !!state.battlefield.backgroundImage;
    const bgChanged = prevHasBgRef.current !== hasBgNow;
    const savedFlagChanged = prevHasBeenSavedRef.current !== state.hasBeenSaved;

    if (phaseChanged || roundChanged || turnChanged || bgChanged || savedFlagChanged) {
      console.log('State changed, saving...', {
        phaseChanged: phaseChanged ? `${prevPhaseRef.current} -> ${state.phase}` : false,
        roundChanged: roundChanged ? `${prevRoundRef.current} -> ${state.round}` : false,
        turnChanged: turnChanged ? `${prevTurnRef.current} -> ${state.currentTurnIndex}` : false,
        bgChanged: bgChanged ? `${prevHasBgRef.current} -> ${hasBgNow}` : false,
        savedFlagChanged: savedFlagChanged ? `${prevHasBeenSavedRef.current} -> ${state.hasBeenSaved}` : false,
      });
      saveState(state);
      prevPhaseRef.current = state.phase;
      prevRoundRef.current = state.round;
      prevTurnRef.current = state.currentTurnIndex;
      prevHasBgRef.current = hasBgNow;
      prevHasBeenSavedRef.current = state.hasBeenSaved;
    }
  }, [state.phase, state.round, state.currentTurnIndex, state.battlefield.backgroundImage, state.hasBeenSaved, state, saveState]);

  // Force save function for external use - always uses latest state via ref
  const forceSave = useCallback(() => {
    saveState(stateRef.current);
  }, [saveState]);

  // Auto-save every 60 seconds as fallback
  useEffect(() => {
    const interval = setInterval(() => {
      saveState(stateRef.current);
      console.log('Auto-save (60s interval)');
    }, 60000);

    return () => clearInterval(interval);
  }, [saveState]);

  // Save on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const serialized = JSON.stringify(stateRef.current);
        window.localStorage.setItem(AUTO_SAVE_KEY, serialized);
        console.log('Saved on page unload');
      } catch {
        // Ignore errors during unload
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Convenience methods
  const addVehicle = useCallback(
    (vehicle: Vehicle) => dispatch({ type: 'ADD_VEHICLE', payload: vehicle }),
    []
  );

  const removeVehicle = useCallback(
    (vehicleId: string) => dispatch({ type: 'REMOVE_VEHICLE', payload: vehicleId }),
    []
  );

  const addCreature = useCallback(
    (creature: Creature) => dispatch({ type: 'ADD_CREATURE', payload: creature }),
    []
  );

  const removeCreature = useCallback(
    (creatureId: string) => dispatch({ type: 'REMOVE_CREATURE', payload: creatureId }),
    []
  );

  const assignCrew = useCallback(
    (assignment: CrewAssignment) => dispatch({ type: 'ASSIGN_CREW', payload: assignment }),
    []
  );

  const dealDamage = useCallback(
    (targetType: 'vehicle' | 'creature', targetId: string, amount: number, source?: string) => {
      if (targetType === 'vehicle') {
        dispatch({
          type: 'DEAL_DAMAGE_TO_VEHICLE',
          payload: { vehicleId: targetId, amount, source },
        });
      } else {
        dispatch({
          type: 'DEAL_DAMAGE_TO_CREATURE',
          payload: { creatureId: targetId, amount, source },
        });
      }
    },
    []
  );

  const applyMishap = useCallback(
    (vehicleId: string, mishap: Mishap) =>
      dispatch({ type: 'APPLY_MISHAP', payload: { vehicleId, mishap } }),
    []
  );

  const updateVehiclePosition = useCallback(
    (vehicleId: string, position: Position) =>
      dispatch({ type: 'UPDATE_VEHICLE_POSITION', payload: { vehicleId, position } }),
    []
  );

  const updateVehicleFacing = useCallback(
    (vehicleId: string, facing: number) =>
      dispatch({ type: 'UPDATE_VEHICLE_FACING', payload: { vehicleId, facing } }),
    []
  );

  const startCombat = useCallback(() => {
    dispatch({ type: 'START_COMBAT' });
    // Track analytics
    logAnalyticsEvent('combat_started', {
      vehicle_count: state.vehicles.length,
      creature_count: state.creatures.length,
      scale: state.scale,
    });
  }, [state.vehicles.length, state.creatures.length, state.scale]);

  const returnToSetup = useCallback(() => {
    dispatch({ type: 'RETURN_TO_SETUP' });
  }, []);

  const resetCombat = useCallback(() => {
    dispatch({ type: 'RESET_COMBAT' });
  }, []);

  const nextTurn = useCallback(() => {
    dispatch({ type: 'NEXT_TURN' });
  }, []);

  const nextRound = useCallback(() => {
    dispatch({ type: 'NEXT_ROUND' });
  }, []);
  const setScale = useCallback(
    (scale: ScaleName) => dispatch({ type: 'SET_SCALE', payload: scale }),
    []
  );
  const loadEncounter = useCallback(
    (encounter: CombatState) => dispatch({ type: 'LOAD_ENCOUNTER', payload: encounter }),
    []
  );
  const newEncounter = useCallback(
    (name: string) => dispatch({ type: 'NEW_ENCOUNTER', payload: { name } }),
    []
  );
  const setEncounterName = useCallback(
    (name: string) => dispatch({ type: 'SET_ENCOUNTER_NAME', payload: name }),
    []
  );
  const setBackgroundImage = useCallback(
    (config: BackgroundImageConfig | null) => dispatch({ type: 'SET_BACKGROUND_IMAGE', payload: config }),
    []
  );
  const markAsSaved = useCallback(
    () => dispatch({ type: 'MARK_AS_SAVED' }),
    []
  );
  const swapVehicleWeapon = useCallback(
    (vehicleId: string, weaponIndex: number, newWeapon: VehicleWeapon) =>
      dispatch({ type: 'SWAP_VEHICLE_WEAPON', payload: { vehicleId, weaponIndex, newWeapon } }),
    []
  );
  const setVehicleArmor = useCallback(
    (vehicleId: string, armorUpgradeId: string) =>
      dispatch({ type: 'SET_VEHICLE_ARMOR', payload: { vehicleId, armorUpgradeId } }),
    []
  );
  const toggleVehicleGadget = useCallback(
    (vehicleId: string, gadgetId: string) =>
      dispatch({ type: 'TOGGLE_VEHICLE_GADGET', payload: { vehicleId, gadgetId } }),
    []
  );

  const toggleWeaponStationUpgrade = useCallback(
    (vehicleId: string) =>
      dispatch({ type: 'TOGGLE_WEAPON_STATION_UPGRADE', payload: { vehicleId } }),
    []
  );

  const loadPartyPreset = useCallback(
    (vehicles: Vehicle[], creatures: Creature[], crewAssignments: CrewAssignment[]) =>
      dispatch({ type: 'LOAD_PARTY_PRESET', payload: { vehicles, creatures, crewAssignments } }),
    []
  );

  const toggleAutoRollComplications = useCallback(
    () => dispatch({ type: 'TOGGLE_AUTO_ROLL_COMPLICATIONS' }),
    []
  );

  const logComplication = useCallback(
    (roll: number, complicationName: string | null, details?: string) => {
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'complication',
          action: complicationName
            ? `Complication Roll: ${roll} - ${complicationName}`
            : `Complication Roll: ${roll} - No complication`,
          details,
        },
      });
    },
    []
  );

  const startComplicationResolution = useCallback(
    (complication: ChaseComplication, roll: number, rollRange: string) =>
      dispatch({ type: 'START_COMPLICATION_RESOLUTION', payload: { complication, roll, rollRange } }),
    []
  );

  const resolveVehicleComplication = useCallback(
    (vehicleId: string, status: ComplicationResolutionStatus, rollResult?: number, modifier?: number, total?: number) =>
      dispatch({ type: 'RESOLVE_VEHICLE_COMPLICATION', payload: { vehicleId, status, rollResult, modifier, total } }),
    []
  );

  const applyComplicationEffects = useCallback(
    () => dispatch({ type: 'APPLY_COMPLICATION_EFFECTS' }),
    []
  );

  const clearComplication = useCallback(
    () => dispatch({ type: 'CLEAR_COMPLICATION' }),
    []
  );

  // Get the driver's DEX save modifier for a vehicle
  const getDriverDexSave = useCallback(
    (vehicle: Vehicle): { modifier: number; driverName: string } | null => {
      const driver = findVehicleDriver(vehicle, state.crewAssignments, state.creatures);
      if (!driver) return null;

      // Get DEX save modifier - check savingThrows first, then calculate from abilities
      let modifier = 0;
      if (driver.statblock.savingThrows?.dex !== undefined) {
        modifier = driver.statblock.savingThrows.dex;
      } else if (driver.statblock.abilities?.dex !== undefined) {
        // Calculate from ability score (no proficiency)
        modifier = Math.floor((driver.statblock.abilities.dex - 10) / 2);
      }

      return { modifier, driverName: driver.name };
    },
    [state.crewAssignments, state.creatures]
  );

  // Get the effective speed of a vehicle after applying all modifiers
  const getEffectiveSpeed = useCallback(
    (vehicle: Vehicle): number => {
      let speed = vehicle.template.speed;

      // Apply mishap speed reductions
      for (const mishap of vehicle.activeMishaps) {
        if (mishap.mechanicalEffect?.speedReduction) {
          speed = Math.max(0, speed - mishap.mechanicalEffect.speedReduction);
        }
      }

      // Apply speed modifiers (multipliers like 0.5 for half speed)
      if (vehicle.speedModifiers && vehicle.speedModifiers.length > 0) {
        for (const mod of vehicle.speedModifiers) {
          speed = Math.floor(speed * mod.multiplier);
        }
      }

      return Math.max(0, speed);
    },
    []
  );

  // Helper to get vehicle driver
  const getVehicleDriver = useCallback(
    (vehicle: Vehicle) => findVehicleDriver(vehicle, state.crewAssignments, state.creatures),
    [state.crewAssignments, state.creatures]
  );

  // Computed values
  const currentTurnId = state.initiativeOrder[state.currentTurnIndex];

  // Check if current turn is a vehicle
  const currentTurnVehicle = state.vehicles.find((v) => v.id === currentTurnId);

  // Get driver if it's a vehicle turn
  const currentTurnDriver = currentTurnVehicle
    ? findVehicleDriver(currentTurnVehicle, state.crewAssignments, state.creatures)
    : undefined;

  // Current turn creature (only if it's NOT a vehicle turn)
  const currentTurnCreature = currentTurnVehicle
    ? undefined
    : state.creatures.find((c) => c.id === currentTurnId);

  const isSetupPhase = state.phase === 'setup';
  const isCombatActive = state.phase === 'combat';

  const value: CombatContextValue = {
    state,
    dispatch,
    addVehicle,
    removeVehicle,
    addCreature,
    removeCreature,
    assignCrew,
    dealDamage,
    applyMishap,
    updateVehiclePosition,
    updateVehicleFacing,
    startCombat,
    returnToSetup,
    resetCombat,
    nextTurn,
    nextRound,
    setScale,
    loadEncounter,
    newEncounter,
    setEncounterName,
    getVehicleDriver,
    setBackgroundImage,
    forceSave,
    markAsSaved,
    swapVehicleWeapon,
    setVehicleArmor,
    toggleVehicleGadget,
    toggleWeaponStationUpgrade,
    loadPartyPreset,
    toggleAutoRollComplications,
    logComplication,
    startComplicationResolution,
    resolveVehicleComplication,
    applyComplicationEffects,
    clearComplication,
    getDriverDexSave,
    getEffectiveSpeed,
    currentTurnCreature,
    currentTurnVehicle,
    currentTurnDriver,
    isSetupPhase,
    isCombatActive,
    lastSaved,
  };

  return (
    <CombatContext.Provider value={value}>{children}</CombatContext.Provider>
  );
}

// ==========================================
// Hook
// ==========================================

export function useCombat(): CombatContextValue {
  const context = useContext(CombatContext);
  if (!context) {
    throw new Error('useCombat must be used within a CombatProvider');
  }
  return context;
}

export { CombatContext };
