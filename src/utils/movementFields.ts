/** Pure helpers for the template editor's movement-component inputs. */
import type { VehicleComponent } from '../types';

const parse = (v: string): number | undefined => (v === '' ? undefined : Number(v));

/** Update one side of windSpeeds; a blank side falls back to base speed. Cleared when both equal base. */
export function withWindSpeed(c: VehicleComponent, key: 'with' | 'into', value: string): VehicleComponent['windSpeeds'] {
  const base = c.speed ?? 0;
  const next = { with: c.windSpeeds?.with ?? base, into: c.windSpeeds?.into ?? base, [key]: parse(value) ?? base };
  return next.with === base && next.into === base ? undefined : next;
}

/** Update one part of speedLoss; blank = 0. Cleared when both are 0. */
export function withSpeedLoss(c: VehicleComponent, key: 'feet' | 'perDamage', value: string): VehicleComponent['speedLoss'] {
  const next = { feet: c.speedLoss?.feet ?? 0, perDamage: c.speedLoss?.perDamage ?? 0, [key]: parse(value) ?? 0 };
  return next.feet === 0 && next.perDamage === 0 ? undefined : next;
}
