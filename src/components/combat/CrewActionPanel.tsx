/**
 * Crew Action Panel Component
 * Allows declaring and resolving actions for all crew members on a vehicle's turn
 * Per Avernus rules: All crew declare simultaneously, then all actions resolve together
 */

import { useState } from 'react';
import { Vehicle, Creature, VehicleZone } from '../../types';
import { resolveZone } from '../../data/vehicleTemplates';
import { useCombat } from '../../context/CombatContext';
import {
  calculateCoverWithElevation,
  getArcDisplayName,
  ElevationCoverResult,
  getZoneCoverDescription,
} from '../../utils/coverCalculator';
import {
  getVehicleElevation,
  parseWeaponRange,
  getModifiedWeaponRange,
  formatRangeExtension,
} from '../../utils/elevationCalculator';

interface CrewActionPanelProps {
  vehicle: Vehicle;
  driver: Creature | undefined;
}

interface CrewMemberAction {
  creatureId: string;
  action: string | null;
  bonusAction: string | null;
  movement: string | null;
  target: string | null; // Target creature ID for attacks
  targetCover: ElevationCoverResult | null;
  resolved: boolean;
}

// Actions available at Helm station
const HELM_ACTIONS = [
  { id: 'drive', name: 'Drive', description: 'Move vehicle up to its speed' },
  { id: 'ram', name: 'Ram', description: 'Crash into target (1d6/10ft moved, max 20d6)' },
];

const HELM_BONUS_ACTIONS = [
  { id: 'dash', name: 'Dash', description: 'Double movement speed this turn' },
  { id: 'disengage', name: 'Disengage', description: "Don't provoke opportunity attacks" },
  { id: 'start_engine', name: 'Start Engine', description: 'Start the vehicle engine' },
  { id: 'stop_engine', name: 'Stop Engine', description: 'Shut off the vehicle engine' },
  { id: 'soul_coin', name: 'Insert Soul Coin', description: 'Fuel the vehicle (24-72 hrs)' },
  { id: 'demon_ichor', name: 'Pour Demon Ichor', description: '+30 ft speed for 1 min (risky!)' },
];

// Base actions available at any weapon station (in addition to station weapon)
const WEAPON_STATION_BASE_ACTIONS = [
  { id: 'aim', name: 'Aim', description: 'Gain advantage on next attack with station weapon' },
  { id: 'ranged_attack', name: 'Personal Ranged Attack', description: 'Make a ranged weapon attack (bow, crossbow, etc.)' },
  { id: 'cast_spell', name: 'Cast Spell', description: 'Cast a spell instead of using station weapon' },
  { id: 'help', name: 'Help', description: 'Give an ally advantage on their next attack' },
  { id: 'ready', name: 'Ready', description: 'Prepare an action with a trigger' },
];

// Actions available to Passengers
const PASSENGER_ACTIONS = [
  { id: 'attack', name: 'Attack', description: 'Make a weapon attack' },
  { id: 'cast_spell', name: 'Cast Spell', description: 'Cast a spell' },
  { id: 'help', name: 'Help', description: 'Give an ally advantage' },
  { id: 'ready', name: 'Ready', description: 'Prepare an action with a trigger' },
  { id: 'dodge', name: 'Dodge', description: 'Attacks against you have disadvantage' },
  { id: 'other', name: 'Other Action', description: 'Custom action' },
];

const PASSENGER_BONUS_ACTIONS = [
  { id: 'bonus_spell', name: 'Bonus Action Spell', description: 'Cast a bonus action spell' },
  { id: 'second_wind', name: 'Second Wind', description: 'Heal (Fighter)' },
  { id: 'cunning_action', name: 'Cunning Action', description: 'Dash/Disengage/Hide (Rogue)' },
  { id: 'other_bonus', name: 'Other', description: 'Custom bonus action' },
];

export function CrewActionPanel({ vehicle, driver }: CrewActionPanelProps) {
  const { state, dispatch } = useCombat();

  // Get all crew on this vehicle
  const vehicleCrew = state.crewAssignments
    .filter((a) => a.vehicleId === vehicle.id)
    .map((a) => ({
      creature: state.creatures.find((c) => c.id === a.creatureId),
      zone: resolveZone(vehicle, a.zoneId),
      assignment: a,
    }))
    .filter((c) => c.creature);

  // Track actions for each crew member
  const [crewActions, setCrewActions] = useState<Record<string, CrewMemberAction>>(() => {
    const initial: Record<string, CrewMemberAction> = {};
    vehicleCrew.forEach(({ creature }) => {
      if (creature) {
        initial[creature.id] = {
          creatureId: creature.id,
          action: null,
          bonusAction: null,
          movement: null,
          target: null,
          targetCover: null,
          resolved: false,
        };
      }
    });
    return initial;
  });

  // Get all potential targets (creatures on other vehicles or unassigned)
  const getPotentialTargets = (attackerCreatureId: string) => {
    const targets: Array<{
      creatureId: string;
      creatureName: string;
      vehicleName: string | null;
      zoneName: string | null;
      cover: ElevationCoverResult | null;
    }> = [];

    // Get attacker's zone
    const attackerAssignment = state.crewAssignments.find(
      (a) => a.creatureId === attackerCreatureId
    );
    const attackerZone = attackerAssignment
      ? resolveZone(vehicle, attackerAssignment.zoneId)
      : undefined;

    // Add creatures on other vehicles
    state.vehicles.forEach((targetVehicle) => {
      if (targetVehicle.type === vehicle.type) return; // Skip same faction

      const vehicleCrewAssignments = state.crewAssignments.filter(
        (a) => a.vehicleId === targetVehicle.id
      );

      vehicleCrewAssignments.forEach((assignment) => {
        const targetCreature = state.creatures.find((c) => c.id === assignment.creatureId);
        const targetZone = resolveZone(targetVehicle, assignment.zoneId);

        if (targetCreature && targetZone) {
          const cover = calculateCoverWithElevation(vehicle, targetVehicle, targetZone, state.elevationZones);
          targets.push({
            creatureId: targetCreature.id,
            creatureName: targetCreature.name,
            vehicleName: targetVehicle.name,
            zoneName: targetZone.name,
            cover,
          });
        }
      });
    });

    // Add unassigned enemy creatures
    const assignedIds = new Set(state.crewAssignments.map((a) => a.creatureId));
    state.creatures
      .filter((c) => !assignedIds.has(c.id) && c.statblock.type !== 'pc')
      .forEach((creature) => {
        targets.push({
          creatureId: creature.id,
          creatureName: creature.name,
          vehicleName: null,
          zoneName: null,
          cover: null, // No cover for unassigned creatures
        });
      });

    return targets;
  };

  // Check if this is a driver zone
  const isDriverZone = (zoneId: string) => {
    const driverPatterns = ['helm', 'rider', 'driver', 'pilot'];
    return driverPatterns.some((p) => zoneId.toLowerCase().includes(p));
  };

  // Check if this is a weapon zone
  const isWeaponZone = (zone: VehicleZone) => {
    const weaponPatterns = ['weapon', 'gunner', 'flinger', 'chomper', 'ballista', 'wrecking'];
    return weaponPatterns.some((p) =>
      zone.id.toLowerCase().includes(p) || zone.name.toLowerCase().includes(p)
    );
  };

  // Get available actions for a crew member based on their station
  const getAvailableActions = (zone: VehicleZone | undefined) => {
    if (!zone) return { actions: PASSENGER_ACTIONS, bonusActions: PASSENGER_BONUS_ACTIONS };

    if (isDriverZone(zone.id)) {
      return { actions: HELM_ACTIONS, bonusActions: HELM_BONUS_ACTIONS };
    }

    if (isWeaponZone(zone)) {
      // Find the weapon at this station
      const weapon = vehicle.weapons.find((w) => w.zoneId === zone.id);
      const weaponActions = weapon
        ? [
            { id: 'station_weapon', name: `Fire ${weapon.name}`, description: `Station weapon: ${weapon.damage}, ${weapon.range || 'melee'}` },
            ...WEAPON_STATION_BASE_ACTIONS,
          ]
        : WEAPON_STATION_BASE_ACTIONS;
      return { actions: weaponActions, bonusActions: PASSENGER_BONUS_ACTIONS };
    }

    return { actions: PASSENGER_ACTIONS, bonusActions: PASSENGER_BONUS_ACTIONS };
  };

  const setAction = (creatureId: string, actionType: 'action' | 'bonusAction' | 'movement', value: string | null) => {
    setCrewActions((prev) => ({
      ...prev,
      [creatureId]: {
        ...prev[creatureId],
        [actionType]: value,
        // Clear target when action changes
        ...(actionType === 'action' ? { target: null, targetCover: null } : {}),
      },
    }));
  };

  const setTarget = (creatureId: string, targetId: string | null, cover: ElevationCoverResult | null) => {
    setCrewActions((prev) => ({
      ...prev,
      [creatureId]: {
        ...prev[creatureId],
        target: targetId,
        targetCover: cover,
      },
    }));
  };

  // Check if an action requires a target
  const actionRequiresTarget = (action: string | null) => {
    if (!action) return false;
    const targetActions = ['attack', 'aim', 'cast spell', 'help'];
    return targetActions.some((a) => action.toLowerCase().includes(a));
  };

  const markResolved = (creatureId: string) => {
    setCrewActions((prev) => ({
      ...prev,
      [creatureId]: {
        ...prev[creatureId],
        resolved: true,
      },
    }));

    // Log the action
    const crew = vehicleCrew.find((c) => c.creature?.id === creatureId);
    if (crew?.creature) {
      const actions = crewActions[creatureId];

      // Build action text with target info
      let actionText = actions.action || 'No action';
      if (actions.target && actions.targetCover) {
        const targetCreature = state.creatures.find((c) => c.id === actions.target);
        if (targetCreature) {
          actionText += ` vs ${targetCreature.name}`;
          if (actions.targetCover.acBonus > 0) {
            actionText += ` (${actions.targetCover.effectiveCover} cover, +${actions.targetCover.acBonus} AC)`;
          }
        }
      }

      const fullText = [
        `Action: ${actionText}`,
        actions.bonusAction && `Bonus: ${actions.bonusAction}`,
      ]
        .filter(Boolean)
        .join(', ');

      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'ability',
          action: `${crew.creature.name}: ${fullText}`,
          details: `On ${vehicle.name} at ${crew.zone?.name || 'Unknown Station'}`,
        },
      });
    }
  };

  const resolveAllActions = () => {
    Object.keys(crewActions).forEach((creatureId) => {
      if (!crewActions[creatureId].resolved) {
        markResolved(creatureId);
      }
    });
  };

  const allDeclared = vehicleCrew.every(
    ({ creature }) => creature && (crewActions[creature.id]?.action || crewActions[creature.id]?.bonusAction)
  );

  const allResolved = vehicleCrew.every(
    ({ creature }) => creature && crewActions[creature.id]?.resolved
  );

  return (
    <div className="crew-action-panel">
      {/* Header */}
      <div className="flex justify-between items-center mb-md">
        <div>
          <div className="font-bold">{vehicle.name}'s Turn</div>
          <div className="text-xs text-muted">
            {vehicleCrew.length} crew member{vehicleCrew.length !== 1 ? 's' : ''} -
            Declare all actions, then resolve
          </div>
        </div>
        {driver && (
          <div className="text-xs">
            Driver: <span className="font-bold">{driver.name}</span>
          </div>
        )}
      </div>

      {/* Phase Indicator */}
      <div className="flex gap-sm mb-md">
        <span className={`badge ${!allDeclared ? 'badge-fire' : ''}`}>
          1. Declaration {allDeclared && '✓'}
        </span>
        <span className={`badge ${allDeclared && !allResolved ? 'badge-fire' : ''}`}>
          2. Resolution {allResolved && '✓'}
        </span>
      </div>

      {/* Crew Action Cards */}
      <div className="flex flex-col gap-md">
        {vehicleCrew.map(({ creature, zone }) => {
          if (!creature) return null;

          const { actions, bonusActions } = getAvailableActions(zone);
          const crewAction = crewActions[creature.id];
          const isDriver = zone && isDriverZone(zone.id);

          return (
            <div
              key={creature.id}
              className="card"
              style={{
                borderLeft: `3px solid ${isDriver ? 'var(--color-fire)' : 'var(--color-text-muted)'}`,
                opacity: crewAction?.resolved ? 0.6 : 1,
              }}
            >
              {/* Crew Member Header */}
              <div className="flex justify-between items-center mb-sm">
                <div>
                  <span className="font-bold">{creature.name}</span>
                  {isDriver && <span className="badge badge-fire ml-sm" style={{ fontSize: '0.6rem' }}>DRIVER</span>}
                </div>
                <div className="text-xs text-muted">{zone?.name || 'Passenger'}</div>
              </div>

              {/* HP Display */}
              <div className="text-xs text-muted mb-sm">
                HP: {creature.currentHp}/{creature.statblock.maxHp} | AC: {creature.statblock.ac}
              </div>

              {crewAction?.resolved ? (
                /* Resolved State */
                <div className="text-sm" style={{ color: 'var(--color-health)' }}>
                  ✓ {crewAction.action || 'No action'}
                  {crewAction.target && crewAction.targetCover && (
                    <span className="text-muted">
                      {' '}vs {state.creatures.find((c) => c.id === crewAction.target)?.name}
                      {crewAction.targetCover.acBonus > 0 && ` (+${crewAction.targetCover.acBonus} AC)`}
                    </span>
                  )}
                  {crewAction.bonusAction && ` + ${crewAction.bonusAction}`}
                </div>
              ) : (
                /* Declaration State */
                <>
                  {/* Action Selection */}
                  <div className="mb-sm">
                    <label className="label">Action</label>
                    <select
                      className="input"
                      value={crewAction?.action || ''}
                      onChange={(e) => setAction(creature.id, 'action', e.target.value || null)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <option value="">-- Select Action --</option>
                      {actions.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Selection (for attack actions) */}
                  {actionRequiresTarget(crewAction?.action) && (
                    <div className="mb-sm">
                      <label className="label">Target</label>
                      <select
                        className="input"
                        value={crewAction?.target || ''}
                        onChange={(e) => {
                          const targetId = e.target.value || null;
                          const targets = getPotentialTargets(creature.id);
                          const targetInfo = targets.find((t) => t.creatureId === targetId);
                          setTarget(creature.id, targetId, targetInfo?.cover || null);
                        }}
                        style={{ fontSize: '0.8rem' }}
                      >
                        <option value="">-- Select Target --</option>
                        {getPotentialTargets(creature.id).map((target) => (
                          <option key={target.creatureId} value={target.creatureId}>
                            {target.creatureName}
                            {target.vehicleName && ` - ${target.vehicleName}`}
                            {target.zoneName && ` (${target.zoneName})`}
                            {target.cover && !target.cover.isVisible && ' [NO LOS]'}
                            {target.cover && target.cover.isVisible && target.cover.acBonus > 0 && ` [+${target.cover.acBonus} AC]`}
                            {target.cover && target.cover.isVisible && target.cover.acBonus === 0 && ' [Exposed]'}
                            {target.cover && target.cover.elevationAttackModifier !== 0 && ` [${target.cover.elevationAttackModifier > 0 ? '+' : ''}${target.cover.elevationAttackModifier} elev]`}
                          </option>
                        ))}
                      </select>

                      {/* Cover Details */}
                      {crewAction?.targetCover && (
                        <div
                          className="mt-sm"
                          style={{
                            padding: 'var(--spacing-sm)',
                            background: crewAction.targetCover.isVisible
                              ? 'rgba(34, 197, 94, 0.1)'
                              : 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span>
                              Attacking from <strong>{getArcDisplayName(crewAction.targetCover.attackArc)}</strong>
                            </span>
                            {crewAction.targetCover.isVisible ? (
                              <span className="badge" style={{ fontSize: '0.65rem' }}>
                                {crewAction.targetCover.effectiveCover === 'none'
                                  ? 'No Cover'
                                  : `+${crewAction.targetCover.acBonus} AC`}
                              </span>
                            ) : (
                              <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
                                Full Cover
                              </span>
                            )}
                          </div>
                          <div className="text-muted mt-sm">
                            {crewAction.targetCover.reason}
                          </div>

                          {/* Elevation Info */}
                          {crewAction.targetCover.elevationDiff !== 0 && (
                            <div
                              className="mt-sm"
                              style={{
                                padding: '4px 8px',
                                background: crewAction.targetCover.elevationDiff > 0
                                  ? 'rgba(59, 130, 246, 0.15)'
                                  : 'rgba(239, 68, 68, 0.15)',
                                borderRadius: 'var(--radius-sm)',
                                border: `1px solid ${crewAction.targetCover.elevationDiff > 0 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <span>
                                  {crewAction.targetCover.elevationDiff > 0 ? '⬇️' : '⬆️'} {crewAction.targetCover.elevationDisplayText}
                                </span>
                                {crewAction.targetCover.elevationAttackModifier !== 0 && (
                                  <span
                                    className="badge"
                                    style={{
                                      fontSize: '0.65rem',
                                      background: crewAction.targetCover.elevationAttackModifier > 0
                                        ? 'rgba(59, 130, 246, 0.3)'
                                        : 'rgba(239, 68, 68, 0.3)',
                                    }}
                                  >
                                    {crewAction.targetCover.elevationAttackModifier > 0 ? '+' : ''}{crewAction.targetCover.elevationAttackModifier} to hit
                                  </span>
                                )}
                              </div>
                              {crewAction.targetCover.coverUpgradedByElevation && (
                                <div className="text-muted mt-sm" style={{ fontSize: '0.7rem' }}>
                                  Target's cover upgraded due to high ground
                                </div>
                              )}
                            </div>
                          )}

                          {!crewAction.targetCover.isVisible && (
                            <div style={{ color: 'var(--color-fire)', marginTop: '4px' }}>
                              Cannot target - no line of sight!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bonus Action Selection */}
                  <div className="mb-sm">
                    <label className="label">Bonus Action</label>
                    <select
                      className="input"
                      value={crewAction?.bonusAction || ''}
                      onChange={(e) => setAction(creature.id, 'bonusAction', e.target.value || null)}
                      style={{ fontSize: '0.8rem' }}
                    >
                      <option value="">-- None --</option>
                      {bonusActions.map((a) => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Individual Resolve Button */}
                  {(crewAction?.action || crewAction?.bonusAction) && (
                    <button
                      className="btn btn-secondary text-xs"
                      onClick={() => markResolved(creature.id)}
                      disabled={!!(actionRequiresTarget(crewAction?.action) && crewAction?.targetCover && !crewAction.targetCover.isVisible)}
                    >
                      Resolve {creature.name}'s Actions
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Resolve All Button */}
      {allDeclared && !allResolved && (
        <button
          className="btn btn-primary mt-md"
          style={{ width: '100%' }}
          onClick={resolveAllActions}
        >
          Resolve All Actions Simultaneously
        </button>
      )}

      {/* Turn Complete */}
      {allResolved && (
        <div
          className="mt-md text-center"
          style={{
            padding: 'var(--spacing-md)',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-health)',
          }}
        >
          <div className="font-bold" style={{ color: 'var(--color-health)' }}>
            Turn Complete!
          </div>
          <div className="text-xs text-muted mt-sm">
            Click "Next Turn" to proceed
          </div>
        </div>
      )}
    </div>
  );
}
