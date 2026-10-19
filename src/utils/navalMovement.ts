/**
 * Naval movement rules (Ghosts of Saltmarsh, Appendix A) for the combat/chase phase.
 *
 * Pure functions: given a vehicle, the wind, and how many crew are aboard, work out each
 * movement component's speed (wind band → damage loss → crew minimum) and the ship's
 * propulsion speed (best surviving component). Vehicles with no movement components
 * (Avernus war machines, other land vehicles) get Infinity, i.e. "no constraint".
 */
import type { CompassPoint, CrewAssignment, Creature, Vehicle, VehicleComponent } from '../types';
import { getComponentHp } from './vehicleComponents';

export const COMPASS_POINTS: CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function compassToDegrees(p: CompassPoint): number {
  return COMPASS_POINTS.indexOf(p) * 45;
}

export type WindBand = 'with' | 'into' | 'cross' | 'calm';

/** Smallest angle between two bearings, 0–180. */
function angleBetween(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** Which sail speed applies for a ship facing `facingDeg` with wind blowing FROM `wind`. */
export function windSpeedBand(facingDeg: number, wind: CompassPoint | undefined): WindBand {
  if (!wind) return 'calm';
  const d = angleBetween(facingDeg, compassToDegrees(wind) + 180);
  if (d < 45) return 'with';
  if (d > 135) return 'into';
  return 'cross';
}

export type SpeedReason =
  | { kind: 'with_wind' }
  | { kind: 'into_wind' }
  | { kind: 'damage_loss'; feet: number }
  | { kind: 'undermanned'; have: number; need: number }
  | { kind: 'destroyed' };

export interface ComponentSpeed {
  componentId: string;
  speed: number;
  reasons: SpeedReason[];
}

export function componentSpeed(
  vehicle: Vehicle,
  component: VehicleComponent,
  wind: CompassPoint | undefined,
  crewAboard: number,
): ComponentSpeed {
  const hp = getComponentHp(vehicle, component);
  if (hp <= 0) return { componentId: component.id, speed: 0, reasons: [{ kind: 'destroyed' }] };

  const reasons: SpeedReason[] = [];
  let speed = component.speed ?? 0;

  if (component.windSpeeds) {
    const band = windSpeedBand(vehicle.facing, wind);
    if (band === 'with') {
      speed = component.windSpeeds.with;
      reasons.push({ kind: 'with_wind' });
    } else if (band === 'into') {
      speed = component.windSpeeds.into;
      reasons.push({ kind: 'into_wind' });
    }
  }

  const loss = component.speedLoss;
  if (loss && loss.feet > 0 && loss.perDamage > 0) {
    const feet = Math.floor((component.maxHp - hp) / loss.perDamage) * loss.feet;
    if (feet > 0) {
      speed -= feet;
      reasons.push({ kind: 'damage_loss', feet });
    }
  }

  if (component.crewRequired && crewAboard < component.crewRequired) {
    speed = 0;
    reasons.push({ kind: 'undermanned', have: crewAboard, need: component.crewRequired });
  }

  return { componentId: component.id, speed: Math.max(0, speed), reasons };
}

export interface PropulsionSpeed {
  speed: number;
  componentId?: string;
  reasons: SpeedReason[];
  parts: ComponentSpeed[];
}

function movementComponents(vehicle: Vehicle): VehicleComponent[] {
  return vehicle.template.components?.filter((c) => c.kind === 'movement') ?? [];
}

/** Best speed among movement components. Infinity when the vehicle has none (land vehicles). */
export function getPropulsionSpeed(
  vehicle: Vehicle,
  wind: CompassPoint | undefined,
  crewAboard: number,
): PropulsionSpeed {
  const movement = movementComponents(vehicle);
  if (movement.length === 0) return { speed: Infinity, reasons: [], parts: [] };
  const parts = movement.map((c) => componentSpeed(vehicle, c, wind, crewAboard));
  const best = parts.reduce((a, b) => (b.speed > a.speed ? b : a));
  return { speed: best.speed, componentId: best.componentId, reasons: best.reasons, parts };
}

/** Best calm, undamaged movement speed — the "book" speed to compare against. Null if no movement parts. */
export function nominalPropulsionSpeed(vehicle: Vehicle): number | null {
  const movement = movementComponents(vehicle);
  if (movement.length === 0) return null;
  return Math.max(...movement.map((c) => c.speed ?? 0));
}

export const PASSENGER_ZONE_ID = 'passengers';

/**
 * Crew aboard for crew-minimum rules: everyone assigned to the vehicle except passengers.
 * When `creatures` is given, slain crew (currentHp <= 0) don't count; unknown creatures still do.
 */
export function countCrewAboard(vehicleId: string, crewAssignments: CrewAssignment[], creatures?: Creature[]): number {
  return crewAssignments.filter((a) => {
    if (a.vehicleId !== vehicleId || a.zoneId === PASSENGER_ZONE_ID) return false;
    const creature = creatures?.find((c) => c.id === a.creatureId);
    return !creature || creature.currentHp > 0;
  }).length;
}

export function speedReasonLabel(reason: SpeedReason): string {
  switch (reason.kind) {
    case 'with_wind': return 'with wind';
    case 'into_wind': return 'into wind';
    case 'damage_loss': return `−${reason.feet} ft (damage)`;
    case 'undermanned': return `undermanned (${reason.have}/${reason.need})`;
    case 'destroyed': return 'destroyed';
  }
}

/** The first undermanned movement component, if any (for the "Oars undermanned" badge). */
export function findUndermanned(propulsion: PropulsionSpeed): { have: number; need: number } | null {
  for (const part of propulsion.parts) {
    const r = part.reasons.find((x) => x.kind === 'undermanned');
    if (r && r.kind === 'undermanned') return { have: r.have, need: r.need };
  }
  return null;
}

export function isSailingShip(vehicle: Vehicle): boolean {
  return movementComponents(vehicle).some((c) => !!c.windSpeeds);
}

export function encounterHasSailingShips(vehicles: Vehicle[]): boolean {
  return vehicles.some(isSailingShip);
}
