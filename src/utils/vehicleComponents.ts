/**
 * Component combat helpers — per-part HP for component-based vehicles (ships).
 *
 * The hull component mirrors the vehicle's `currentHp` (so all the existing
 * wrecked-at-0 logic keeps working); every other component's current HP lives in
 * the per-instance `Vehicle.componentHp` map, defaulting to the component's max.
 *
 * Destroyed components have mechanical effects: hull → ship wrecked (handled by
 * the existing currentHp === 0 path), control → can't turn, movement → propulsion
 * cut, weapon → can't fire.
 */
import type { Vehicle, VehicleComponent } from '../types';

export function hasComponents(vehicle: Vehicle): boolean {
  return !!vehicle.template.components && vehicle.template.components.length > 0;
}

export function getComponent(vehicle: Vehicle, componentId: string): VehicleComponent | undefined {
  return vehicle.template.components?.find((c) => c.id === componentId);
}

/** Current HP of a component. Hull reflects the vehicle's currentHp. */
export function getComponentHp(vehicle: Vehicle, component: VehicleComponent): number {
  if (component.kind === 'hull') return vehicle.currentHp;
  return vehicle.componentHp?.[component.id] ?? component.maxHp;
}

export function isComponentDestroyed(vehicle: Vehicle, component: VehicleComponent): boolean {
  return getComponentHp(vehicle, component) <= 0;
}

/** A weapon is offline if it has a matching weapon component that is destroyed. */
export function isWeaponDestroyed(vehicle: Vehicle, weaponId: string): boolean {
  const comp = getComponent(vehicle, weaponId);
  if (!comp) return false; // no component model for this weapon → always usable
  return getComponentHp(vehicle, comp) <= 0;
}

/** Whether the vehicle can still turn — false only if it has control component(s) and all are destroyed. */
export function canVehicleTurn(vehicle: Vehicle): boolean {
  const controls = vehicle.template.components?.filter((c) => c.kind === 'control') ?? [];
  if (controls.length === 0) return true;
  return controls.some((c) => getComponentHp(vehicle, c) > 0);
}

/**
 * Speed cap from propulsion: the best speed among surviving movement components.
 * Infinity when the vehicle has no movement components (land vehicles are uncapped);
 * 0 when it has movement components but all are destroyed (dead in the water).
 */
export function getPropulsionSpeedCap(vehicle: Vehicle): number {
  const movement = vehicle.template.components?.filter((c) => c.kind === 'movement') ?? [];
  if (movement.length === 0) return Infinity;
  let best = 0;
  for (const c of movement) {
    if (getComponentHp(vehicle, c) > 0) best = Math.max(best, c.speed ?? 0);
  }
  return best;
}

/** Short status label for a destroyed component, for UI. */
export function destroyedEffectLabel(component: VehicleComponent): string {
  switch (component.kind) {
    case 'hull': return 'Ship wrecked';
    case 'control': return "Can't turn";
    case 'movement': return 'Propulsion lost';
    case 'weapon': return 'Weapon offline';
    default: return 'Destroyed';
  }
}
