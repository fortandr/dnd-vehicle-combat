/**
 * The single effective-speed rule for every vehicle.
 *
 * Base: ships (vehicles with movement components) take their speed from those components
 * (wind, damage, oar crew — see navalMovement.ts); every other vehicle uses currentSpeed.
 * Then mishap speed reductions, then speedModifier multipliers, clamped at 0.
 */
import type { CombatState, CompassPoint, CrewAssignment, Vehicle } from '../types';
import { countCrewAboard, getPropulsionSpeed, nominalPropulsionSpeed, speedReasonLabel, type PropulsionSpeed } from './navalMovement';

export interface SpeedContext {
  wind?: CompassPoint;
  crewAssignments: CrewAssignment[];
}

export interface SpeedBreakdown {
  nominal: number; // What speed "should" be with no wind/damage/mishaps — compare to show changes
  effective: number;
  isShip: boolean;
  propulsion: PropulsionSpeed;
}

export function speedContextFromState(state: Pick<CombatState, 'environment' | 'crewAssignments'>): SpeedContext {
  return { wind: state.environment?.wind, crewAssignments: state.crewAssignments };
}

export function getSpeedBreakdown(vehicle: Vehicle, ctx: SpeedContext): SpeedBreakdown {
  const propulsion = getPropulsionSpeed(vehicle, ctx.wind, countCrewAboard(vehicle.id, ctx.crewAssignments));
  const shipNominal = nominalPropulsionSpeed(vehicle);
  const isShip = shipNominal !== null;

  let speed = isShip ? propulsion.speed : vehicle.currentSpeed;
  for (const mishap of vehicle.activeMishaps) {
    if (mishap.mechanicalEffect?.speedReduction) speed -= mishap.mechanicalEffect.speedReduction;
  }
  speed = Math.max(0, speed);
  for (const mod of vehicle.speedModifiers ?? []) {
    speed = Math.floor(speed * mod.multiplier);
  }

  return { nominal: isShip ? shipNominal : vehicle.currentSpeed, effective: Math.max(0, speed), isShip, propulsion };
}

export function getEffectiveSpeed(vehicle: Vehicle, ctx: SpeedContext): number {
  return getSpeedBreakdown(vehicle, ctx).effective;
}

export type SpeedChange = 'up' | 'down' | 'none';

/** Ships: compare effective vs nominal both ways (wind can boost). Land: only reductions count, as before. */
export function speedChange(b: SpeedBreakdown): SpeedChange {
  if (b.isShip) {
    if (b.effective > b.nominal) return 'up';
    if (b.effective < b.nominal) return 'down';
    return 'none';
  }
  return b.effective < b.nominal ? 'down' : 'none';
}

/** Reason text: propulsion reasons (via speedReasonLabel) plus 'speed effects' when mishaps/modifiers changed a ship's speed. Joined with ' · '. Empty string when none. */
export function speedReasonText(_vehicle: Vehicle, b: SpeedBreakdown): string {
  const labels = b.propulsion.reasons.map(speedReasonLabel);
  if (b.isShip && b.effective !== b.propulsion.speed) labels.push('speed effects');
  return labels.join(' · ');
}
