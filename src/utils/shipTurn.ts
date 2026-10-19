/**
 * Ship turns (Ghosts of Saltmarsh, Appendix A "Ships in Combat"): a ship rolls its own initiative
 * (d20 + Dex + crew quality) and gets 0–3 ship actions per turn depending on crew aboard.
 * Everything not settled by the book follows the War Machine flow (see the design spec).
 */
import type { CombatState, ShipActionDef, Vehicle, VehicleTemplate } from '../types';
import { countCrewAboard } from './navalMovement';

export const DEFAULT_CREW_QUALITY = 4;

export function clampCrewQuality(n: number): number {
  return Math.max(-10, Math.min(10, n));
}

export function getCrewQuality(vehicle: Vehicle): number {
  return clampCrewQuality(vehicle.crewQuality ?? DEFAULT_CREW_QUALITY);
}

export function shipDexMod(vehicle: Vehicle): number {
  return Math.floor(((vehicle.template.abilityScores?.dex ?? 10) - 10) / 2);
}

export function shipInitiativeModifier(vehicle: Vehicle): number {
  return shipDexMod(vehicle) + getCrewQuality(vehicle);
}

export interface ShipInitiativeRoll {
  total: number;
  d20: number;
  dexMod: number;
  quality: number;
}

/** Floor of 1 matches the app's creature initiative rolls (book gives no floor). */
export function rollShipInitiative(vehicle: Vehicle, d20: number): ShipInitiativeRoll {
  const dexMod = shipDexMod(vehicle);
  const quality = getCrewQuality(vehicle);
  return { total: Math.max(1, d20 + dexMod + quality), d20, dexMod, quality };
}

const signed = (n: number) => (n < 0 ? `−${Math.abs(n)}` : `+${n}`);

export function formatShipInitiativeLog(name: string, roll: ShipInitiativeRoll): string {
  return `${name} rolls initiative ${roll.total} (d20 ${roll.d20}, Dex ${signed(roll.dexMod)}, crew ${signed(roll.quality)})`;
}

export function shipActionsAvailable(template: VehicleTemplate, crewAboard: number): number {
  return template.shipActions?.crewThresholds.filter((t) => crewAboard >= t).length ?? 0;
}

export function actionForWeapon(template: VehicleTemplate, weaponId: string): ShipActionDef | undefined {
  return template.shipActions?.actions.find((a) => a.weaponIds?.includes(weaponId));
}

export type ShipTurnState = Pick<CombatState, 'shipActionsUsed' | 'movementUsed' | 'crewAssignments'>;

/** Stored marks plus Move once the ship has moved this round. */
export function shipActionsUsedFor(vehicle: Vehicle, state: ShipTurnState): string[] {
  const used = [...(state.shipActionsUsed[vehicle.id] ?? [])];
  const hasMove = vehicle.template.shipActions?.actions.some((a) => a.id === 'move');
  if (hasMove && (state.movementUsed[vehicle.id] ?? 0) > 0 && !used.includes('move')) used.push('move');
  return used;
}

export interface ShipActionSummary {
  available: number;
  used: string[];
  remaining: number;
  over: number;
  crewAboard: number;
}

export function shipActionSummary(vehicle: Vehicle, state: ShipTurnState): ShipActionSummary {
  const crewAboard = countCrewAboard(vehicle.id, state.crewAssignments);
  const available = shipActionsAvailable(vehicle.template, crewAboard);
  const used = shipActionsUsedFor(vehicle, state);
  return {
    available,
    used,
    remaining: Math.max(0, available - used.length),
    over: Math.max(0, used.length - available),
    crewAboard,
  };
}
