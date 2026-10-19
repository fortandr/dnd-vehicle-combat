# Naval Movement & Wind Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship speed follows Ghosts of Saltmarsh during combat: sails depend on wind vs heading, movement parts lose speed with damage, and oars need a minimum crew. All five copies of the effective-speed calculation are unified into one.

**Architecture:** Pure rules live in `src/utils/navalMovement.ts`, which handles wind bands, per-component speed and crew counts. A single shared effective-speed function lives in `src/utils/vehicleSpeed.ts`. Every UI surface and the map's movement budget call that shared function. Wind is an optional field on the existing `Environment` and is set through the existing `SET_ENVIRONMENT` action. The DM map sends it to the player view through the BroadcastChannel payload.

**Tech Stack:** React 18 + TypeScript + Vite, MUI, React Context + useReducer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-naval-movement-wind-design.md`

## Global Constraints

- Avernus war machines and other land vehicles (no `movement` components) must behave exactly as before. The one exception is that `speedModifiers` multipliers now apply everywhere speed is shown or used.
- Facing convention: degrees, 0 = north, clockwise (rotate-right adds 45).
- Wind is stored as the direction it blows **from**. Unset (`undefined`) = calm.
- Heading bands: d = smallest angle between facing and downwind. d < 45 → with; d > 135 → into; otherwise cross. Exactly 45 and 135 count as cross.
- Mid-turn heading changes take effect immediately: remaining movement = max movement at the current heading − movement used, clamped at 0.
- Crew aboard = crew assignments on the vehicle whose `zoneId !== 'passengers'`.
- Ships (vehicles with ≥1 `movement` component) derive their base speed from their components. `currentSpeed` is ignored for them.
- Pure logic goes in `src/utils/*.ts` with sibling `*.test.ts` (repo convention, `CLAUDE.md`).
- Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Commands: `npm test` (vitest run), `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`. `npm run build` is slow (~4–5 min cold in the sandbox), so run it once at the end.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/index.ts` | modify | `CompassPoint`; `VehicleComponent.windSpeeds/speedLoss`; `Environment.wind` |
| `src/utils/navalMovement.ts` | create | Wind bands, per-component speed, propulsion speed, crew count, reason labels, sailing-ship detection |
| `src/utils/navalMovement.test.ts` | create | Unit tests for the above |
| `src/utils/vehicleSpeed.ts` | create | `getSpeedBreakdown` / `getEffectiveSpeed`, the single effective-speed rule |
| `src/utils/vehicleSpeed.test.ts` | create | Land-vehicle regression + ship speed tests |
| `src/utils/movementFields.ts` | create | Pure editor helpers for wind-speed / speed-loss inputs |
| `src/utils/movementFields.test.ts` | create | Tests for those helpers |
| `src/utils/vehicleComponents.ts` | modify | Remove `getPropulsionSpeedCap` (superseded) |
| `src/data/navalTemplates.ts` | modify | Ship wind speeds, speed loss, oar crew |
| `src/data/navalTemplates.test.ts` | create | Asserts ship data matches the spec table |
| `src/context/CombatContext.tsx` | modify | Export `combatReducer`; context `getEffectiveSpeed` delegates to shared fn |
| `src/context/combatReducer.test.ts` | create | Wind round-trip + legacy load |
| `src/hooks/useBroadcastChannel.ts` | modify | `wind?` on `BattlefieldSyncState` |
| `src/components/battlefield/WindIndicator.tsx` | create | Wind arrow overlay (DM + player view) |
| `src/components/battlefield/BattlefieldMap.tsx` | modify | Shared speed fn, wind selector, indicator, broadcast wind |
| `src/components/battlefield/PlayerViewMap.tsx` | modify | Render indicator |
| `src/components/vehicles/VehicleCard.tsx` | modify | Shared speed, read-only ship speed + reason, undermanned badge, component speeds |
| `src/components/combat/VehicleStatsPanel.tsx` | modify | Shared speed |
| `src/components/layout/RightPanel.tsx` | modify | Shared speed |
| `src/components/vehicles/VehicleTemplateEditor.tsx` | modify | Movement-component inputs |
| `src/components/help/HelpGuide.tsx` | modify | "Wind & ship speed" paragraph |
| `src/data/changelog.ts` | modify | v2.9.0 entry |

---

### Task 1: Types + naval movement rules engine

**Files:**
- Modify: `src/types/index.ts` (`VehicleComponent` at ~202, `Environment` at ~495)
- Create: `src/utils/navalMovement.ts`
- Test: `src/utils/navalMovement.test.ts`

**Interfaces:**
- Produces (types): `CompassPoint`; `VehicleComponent.windSpeeds?: { with: number; into: number }`; `VehicleComponent.speedLoss?: { feet: number; perDamage: number }`; `Environment.wind?: CompassPoint`.
- Produces (functions, all exported from `navalMovement.ts`):
  - `COMPASS_POINTS: CompassPoint[]`
  - `compassToDegrees(p: CompassPoint): number`
  - `type WindBand = 'with' | 'into' | 'cross' | 'calm'`
  - `windSpeedBand(facingDeg: number, wind: CompassPoint | undefined): WindBand`
  - `type SpeedReason = { kind: 'with_wind' } | { kind: 'into_wind' } | { kind: 'damage_loss'; feet: number } | { kind: 'undermanned'; have: number; need: number } | { kind: 'destroyed' }`
  - `interface ComponentSpeed { componentId: string; speed: number; reasons: SpeedReason[] }`
  - `componentSpeed(vehicle: Vehicle, component: VehicleComponent, wind: CompassPoint | undefined, crewAboard: number): ComponentSpeed`
  - `interface PropulsionSpeed { speed: number; componentId?: string; reasons: SpeedReason[]; parts: ComponentSpeed[] }`
  - `getPropulsionSpeed(vehicle: Vehicle, wind: CompassPoint | undefined, crewAboard: number): PropulsionSpeed` (`speed: Infinity`, empty `parts` when there are no movement components)
  - `nominalPropulsionSpeed(vehicle: Vehicle): number | null` (best calm, undamaged `speed` among movement components; `null` when there are none)
  - `PASSENGER_ZONE_ID = 'passengers'`
  - `countCrewAboard(vehicleId: string, crewAssignments: CrewAssignment[]): number`
  - `speedReasonLabel(reason: SpeedReason): string`
  - `findUndermanned(propulsion: PropulsionSpeed): { have: number; need: number } | null`
  - `isSailingShip(vehicle: Vehicle): boolean` and `encounterHasSailingShips(vehicles: Vehicle[]): boolean`

- [ ] **Step 1: Add the types**

In `src/types/index.ts`, add above `export interface VehicleComponent`:

```ts
// Direction the wind blows FROM (8-point compass). 0° = N, clockwise.
export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
```

Inside `VehicleComponent`, after `crewRequired?: number;`:

```ts
  windSpeeds?: { with: number; into: number }; // Sails: speed sailing with / into the wind (`speed` = crosswind or calm)
  speedLoss?: { feet: number; perDamage: number }; // Lose `feet` of speed per `perDamage` damage taken
```

Inside `Environment`, after `specialRules?: string[];`:

```ts
  wind?: CompassPoint; // Direction the wind blows FROM. Unset = calm.
```

- [ ] **Step 2: Write the failing tests**

Create `src/utils/navalMovement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { CrewAssignment, Vehicle, VehicleComponent, VehicleTemplate } from '../types';
import {
  windSpeedBand,
  componentSpeed,
  getPropulsionSpeed,
  nominalPropulsionSpeed,
  countCrewAboard,
  speedReasonLabel,
  findUndermanned,
  encounterHasSailingShips,
} from './navalMovement';

const SAILS: VehicleComponent = {
  id: 'sails', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45,
  windSpeeds: { with: 60, into: 15 }, speedLoss: { feet: 5, perDamage: 25 },
};
const OARS: VehicleComponent = {
  id: 'oars', name: 'Oars', kind: 'movement', ac: 12, maxHp: 100, speed: 30,
  speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 40,
};
const HULL: VehicleComponent = { id: 'hull', name: 'Hull', kind: 'hull', ac: 15, maxHp: 500 };

function makeVehicle(components: VehicleComponent[] | undefined, overrides: Partial<Vehicle> = {}): Vehicle {
  const template = {
    id: 't', name: 'Test', description: '', maxHp: 500, ac: 15, speed: 45, damageThreshold: 0,
    mishapThreshold: 999, crewCapacity: 40, zones: [], weapons: [], components,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Test', type: 'party', template, currentHp: 500, currentSpeed: 45,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}

describe('windSpeedBand', () => {
  // Wind from N blows toward 180°.
  it('dead downwind is with, dead upwind is into, abeam is cross', () => {
    expect(windSpeedBand(180, 'N')).toBe('with');
    expect(windSpeedBand(0, 'N')).toBe('into');
    expect(windSpeedBand(90, 'N')).toBe('cross');
    expect(windSpeedBand(270, 'N')).toBe('cross');
  });

  it('exactly 45° off downwind or upwind counts as cross', () => {
    expect(windSpeedBand(135, 'N')).toBe('cross');
    expect(windSpeedBand(225, 'N')).toBe('cross');
    expect(windSpeedBand(45, 'N')).toBe('cross');
    expect(windSpeedBand(315, 'N')).toBe('cross');
  });

  it('inside 45° is with/into', () => {
    expect(windSpeedBand(150, 'N')).toBe('with');
    expect(windSpeedBand(30, 'N')).toBe('into');
  });

  it('wraps around north', () => {
    // Wind from S blows toward 0°.
    expect(windSpeedBand(350, 'S')).toBe('with');
    expect(windSpeedBand(10, 'S')).toBe('with');
    expect(windSpeedBand(180, 'S')).toBe('into');
  });

  it('no wind is calm', () => {
    expect(windSpeedBand(180, undefined)).toBe('calm');
  });
});

describe('componentSpeed', () => {
  it('sails use wind speeds by heading and base speed when calm or abeam', () => {
    expect(componentSpeed(makeVehicle([SAILS], { facing: 180 }), SAILS, 'N', 0)).toEqual({
      componentId: 'sails', speed: 60, reasons: [{ kind: 'with_wind' }],
    });
    expect(componentSpeed(makeVehicle([SAILS], { facing: 0 }), SAILS, 'N', 0).speed).toBe(15);
    expect(componentSpeed(makeVehicle([SAILS], { facing: 90 }), SAILS, 'N', 0).speed).toBe(45);
    expect(componentSpeed(makeVehicle([SAILS], { facing: 180 }), SAILS, undefined, 0).speed).toBe(45);
  });

  it('loses speed in steps of perDamage', () => {
    const at = (hp: number) => componentSpeed(makeVehicle([SAILS], { componentHp: { sails: hp } }), SAILS, undefined, 0);
    expect(at(76).speed).toBe(45); // 24 damage
    expect(at(75)).toEqual({ componentId: 'sails', speed: 40, reasons: [{ kind: 'damage_loss', feet: 5 }] }); // 25
    expect(at(40).speed).toBe(35); // 60 damage → 2 steps
  });

  it('speed loss cannot go below 0', () => {
    const v = makeVehicle([SAILS], { facing: 0, componentHp: { sails: 1 } }); // 99 dmg → −15 from into-wind 15
    expect(componentSpeed(v, SAILS, 'N', 0).speed).toBe(0);
  });

  it('enforces crewRequired', () => {
    const v = makeVehicle([OARS]);
    expect(componentSpeed(v, OARS, undefined, 39)).toEqual({
      componentId: 'oars', speed: 0, reasons: [{ kind: 'undermanned', have: 39, need: 40 }],
    });
    expect(componentSpeed(v, OARS, undefined, 40).speed).toBe(30);
    expect(componentSpeed(v, OARS, undefined, 80).speed).toBe(30);
  });

  it('oars ignore wind', () => {
    expect(componentSpeed(makeVehicle([OARS], { facing: 0 }), OARS, 'N', 40).speed).toBe(30);
  });

  it('a destroyed component contributes 0', () => {
    const v = makeVehicle([SAILS], { componentHp: { sails: 0 } });
    expect(componentSpeed(v, SAILS, undefined, 0)).toEqual({
      componentId: 'sails', speed: 0, reasons: [{ kind: 'destroyed' }],
    });
  });
});

describe('getPropulsionSpeed', () => {
  it('takes the best movement component', () => {
    // Facing into the wind: sails 15, oars 30 with full crew → oars win.
    const v = makeVehicle([HULL, SAILS, OARS], { facing: 0 });
    const p = getPropulsionSpeed(v, 'N', 40);
    expect(p.speed).toBe(30);
    expect(p.componentId).toBe('oars');
    expect(p.parts.map((x) => x.componentId)).toEqual(['sails', 'oars']);
  });

  it('undermanned galley still sails', () => {
    const v = makeVehicle([HULL, SAILS, OARS], { facing: 180 });
    const p = getPropulsionSpeed(v, 'N', 12);
    expect(p.speed).toBe(60);
    expect(p.componentId).toBe('sails');
    expect(findUndermanned(p)).toEqual({ have: 12, need: 40 });
  });

  it('all movement destroyed → 0', () => {
    const v = makeVehicle([HULL, SAILS, OARS], { componentHp: { sails: 0, oars: 0 } });
    expect(getPropulsionSpeed(v, undefined, 40).speed).toBe(0);
  });

  it('no movement components → Infinity (land vehicles unaffected)', () => {
    expect(getPropulsionSpeed(makeVehicle(undefined), 'N', 0)).toEqual({ speed: Infinity, reasons: [], parts: [] });
    expect(getPropulsionSpeed(makeVehicle([HULL]), 'N', 0).speed).toBe(Infinity);
  });
});

describe('nominalPropulsionSpeed', () => {
  it('is the best calm undamaged speed, or null without movement parts', () => {
    expect(nominalPropulsionSpeed(makeVehicle([HULL, SAILS, OARS], { componentHp: { sails: 0 } }))).toBe(45);
    expect(nominalPropulsionSpeed(makeVehicle(undefined))).toBeNull();
  });
});

describe('countCrewAboard', () => {
  it('counts assignments on this vehicle, excluding passengers', () => {
    const a: CrewAssignment[] = [
      { creatureId: 'c1', vehicleId: 'v1', zoneId: 'helm' },
      { creatureId: 'c2', vehicleId: 'v1', zoneId: 'deck_crew' },
      { creatureId: 'c3', vehicleId: 'v1', zoneId: 'passengers' },
      { creatureId: 'c4', vehicleId: 'v2', zoneId: 'deck_crew' },
    ];
    expect(countCrewAboard('v1', a)).toBe(2);
  });
});

describe('speedReasonLabel', () => {
  it('formats each reason', () => {
    expect(speedReasonLabel({ kind: 'with_wind' })).toBe('with wind');
    expect(speedReasonLabel({ kind: 'into_wind' })).toBe('into wind');
    expect(speedReasonLabel({ kind: 'damage_loss', feet: 20 })).toBe('−20 ft (damage)');
    expect(speedReasonLabel({ kind: 'undermanned', have: 12, need: 40 })).toBe('undermanned (12/40)');
    expect(speedReasonLabel({ kind: 'destroyed' })).toBe('destroyed');
  });
});

describe('encounterHasSailingShips', () => {
  it('true only when some vehicle has a component with windSpeeds', () => {
    expect(encounterHasSailingShips([makeVehicle([HULL, OARS])])).toBe(false);
    expect(encounterHasSailingShips([makeVehicle(undefined), makeVehicle([SAILS])])).toBe(true);
    expect(encounterHasSailingShips([])).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/utils/navalMovement.test.ts`
Expected: FAIL. The module `./navalMovement` cannot be resolved.

- [ ] **Step 4: Implement `src/utils/navalMovement.ts`**

```ts
/**
 * Naval movement rules (Ghosts of Saltmarsh, Appendix A) for the combat/chase phase.
 *
 * Pure functions: given a vehicle, the wind, and how many crew are aboard, work out each
 * movement component's speed (wind band → damage loss → crew minimum) and the ship's
 * propulsion speed (best surviving component). Vehicles with no movement components
 * (Avernus war machines, other land vehicles) get Infinity, i.e. "no constraint".
 */
import type { CompassPoint, CrewAssignment, Vehicle, VehicleComponent } from '../types';
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

/** Crew aboard for crew-minimum rules: everyone assigned to the vehicle except passengers. */
export function countCrewAboard(vehicleId: string, crewAssignments: CrewAssignment[]): number {
  return crewAssignments.filter((a) => a.vehicleId === vehicleId && a.zoneId !== PASSENGER_ZONE_ID).length;
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
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/utils/navalMovement.test.ts`
Expected: PASS (all tests).

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/navalMovement.ts src/utils/navalMovement.test.ts
git commit -m "Naval movement rules: wind bands, damage speed loss, oar crew minimum

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: One shared effective-speed function, replacing all five copies

**Files:**
- Create: `src/utils/vehicleSpeed.ts`
- Test: `src/utils/vehicleSpeed.test.ts`
- Modify: `src/components/battlefield/BattlefieldMap.tsx:27` (import), `:312-326` (local fn), `:404` (caller)
- Modify: `src/context/CombatContext.tsx:2256-2280` (context `getEffectiveSpeed`)
- Modify: `src/components/vehicles/VehicleCard.tsx:97-107` (local fn), `:151-152`
- Modify: `src/components/combat/VehicleStatsPanel.tsx:31-40` (local fn), `:365-390`
- Modify: `src/components/layout/RightPanel.tsx:130-139` (local fn), `:227-228`
- Modify: `src/utils/vehicleComponents.ts:46-60` (delete `getPropulsionSpeedCap`)

**Interfaces:**
- Consumes (Task 1): `getPropulsionSpeed`, `nominalPropulsionSpeed`, `countCrewAboard`, `PropulsionSpeed`, `CompassPoint`.
- Produces:
  - `interface SpeedContext { wind?: CompassPoint; crewAssignments: CrewAssignment[] }`
  - `interface SpeedBreakdown { nominal: number; effective: number; isShip: boolean; propulsion: PropulsionSpeed }`
  - `getSpeedBreakdown(vehicle: Vehicle, ctx: SpeedContext): SpeedBreakdown`
  - `getEffectiveSpeed(vehicle: Vehicle, ctx: SpeedContext): number`
  - `speedContextFromState(state: Pick<CombatState, 'environment' | 'crewAssignments'>): SpeedContext`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/vehicleSpeed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Mishap, SpeedModifier, Vehicle, VehicleComponent, VehicleTemplate } from '../types';
import { getEffectiveSpeed, getSpeedBreakdown } from './vehicleSpeed';

const SAILS: VehicleComponent = {
  id: 'sails', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45,
  windSpeeds: { with: 60, into: 15 }, speedLoss: { feet: 5, perDamage: 25 },
};
const OARS: VehicleComponent = { id: 'oars', name: 'Oars', kind: 'movement', ac: 12, maxHp: 100, speed: 30, crewRequired: 40 };

function makeVehicle(components: VehicleComponent[] | undefined, overrides: Partial<Vehicle> = {}): Vehicle {
  const template = {
    id: 't', name: 'Test', description: '', maxHp: 300, ac: 15, speed: 45, damageThreshold: 0,
    mishapThreshold: 20, crewCapacity: 40, zones: [], weapons: [], components,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Test', type: 'party', template, currentHp: 300, currentSpeed: 100,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}
const mishap = (speedReduction: number) => ({ mechanicalEffect: { speedReduction } }) as unknown as Mishap;
const half = { multiplier: 0.5 } as unknown as SpeedModifier;
const NO_CREW = { crewAssignments: [] };

describe('land vehicles (no movement components) — regression', () => {
  it('use currentSpeed, minus mishaps, clamped at 0', () => {
    expect(getEffectiveSpeed(makeVehicle(undefined), NO_CREW)).toBe(100);
    expect(getEffectiveSpeed(makeVehicle(undefined, { activeMishaps: [mishap(20)] }), NO_CREW)).toBe(80);
    expect(getEffectiveSpeed(makeVehicle(undefined, { activeMishaps: [mishap(150)] }), NO_CREW)).toBe(0);
  });

  it('apply speed modifier multipliers after mishaps', () => {
    const v = makeVehicle(undefined, { activeMishaps: [mishap(20)], speedModifiers: [half] });
    expect(getEffectiveSpeed(v, NO_CREW)).toBe(40);
  });

  it('ignore wind, and nominal = currentSpeed', () => {
    const b = getSpeedBreakdown(makeVehicle(undefined), { wind: 'N', crewAssignments: [] });
    expect(b).toMatchObject({ nominal: 100, effective: 100, isShip: false });
  });
});

describe('ships (movement components)', () => {
  it('derive speed from components, ignoring currentSpeed', () => {
    const v = makeVehicle([SAILS], { facing: 180, currentSpeed: 10 });
    const b = getSpeedBreakdown(v, { wind: 'N', crewAssignments: [] });
    expect(b).toMatchObject({ nominal: 45, effective: 60, isShip: true });
    expect(b.propulsion.reasons).toEqual([{ kind: 'with_wind' }]);
  });

  it('half speed halves the wind-adjusted speed', () => {
    const v = makeVehicle([SAILS], { facing: 180, speedModifiers: [half] });
    expect(getEffectiveSpeed(v, { wind: 'N', crewAssignments: [] })).toBe(30);
  });

  it('counts crew from assignments for oars', () => {
    const v = makeVehicle([OARS]);
    const crew = Array.from({ length: 40 }, (_, i) => ({ creatureId: `c${i}`, vehicleId: 'v1', zoneId: 'deck_crew' }));
    expect(getEffectiveSpeed(v, { crewAssignments: crew })).toBe(30);
    expect(getEffectiveSpeed(v, { crewAssignments: crew.slice(1) })).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/vehicleSpeed.test.ts`
Expected: FAIL. The module `./vehicleSpeed` cannot be resolved.

- [ ] **Step 3: Implement `src/utils/vehicleSpeed.ts`**

```ts
/**
 * The single effective-speed rule for every vehicle.
 *
 * Base: ships (vehicles with movement components) take their speed from those components
 * (wind, damage, oar crew — see navalMovement.ts); every other vehicle uses currentSpeed.
 * Then mishap speed reductions, then speedModifier multipliers, clamped at 0.
 */
import type { CombatState, CompassPoint, CrewAssignment, Vehicle } from '../types';
import { countCrewAboard, getPropulsionSpeed, nominalPropulsionSpeed, type PropulsionSpeed } from './navalMovement';

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/vehicleSpeed.test.ts src/utils/navalMovement.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the BattlefieldMap copy**

In `src/components/battlefield/BattlefieldMap.tsx`:
- Line 27: change to `import { isWeaponDestroyed, canVehicleTurn } from '../../utils/vehicleComponents';` and add `import { getEffectiveSpeed, speedContextFromState } from '../../utils/vehicleSpeed';`.
- Delete the local `const getEffectiveSpeed = (vehicle: Vehicle): number => { … };` block (lines ~311-326, including its comment).
- In `getMaxMovement` (~line 404), use:

```ts
    return calculateMovementPerRound(getEffectiveSpeed(vehicle, speedContextFromState(state)), movementScale);
```

- [ ] **Step 6: Replace the CombatContext copy**

In `src/context/CombatContext.tsx`, add `import { getEffectiveSpeed as computeEffectiveSpeed, speedContextFromState } from '../utils/vehicleSpeed';`. Replace the whole `const getEffectiveSpeed = useCallback(...)` (from ~2256 to its closing `);`) with:

```ts
  // Effective speed after wind, component damage, crew, mishaps, and speed modifiers.
  const getEffectiveSpeed = useCallback(
    (vehicle: Vehicle): number => computeEffectiveSpeed(vehicle, speedContextFromState(state)),
    [state]
  );
```

The context type at ~1783 (`getEffectiveSpeed: (vehicle: Vehicle) => number;`) stays as it is.

- [ ] **Step 7: Replace the VehicleCard, VehicleStatsPanel and RightPanel copies**

`src/components/vehicles/VehicleCard.tsx`: delete the local `getEffectiveSpeed` function (lines ~97-107 with its comment). Add `import { getSpeedBreakdown, speedContextFromState } from '../../utils/vehicleSpeed';`. Replace lines ~151-152 with:

```ts
  const speed = getSpeedBreakdown(vehicle, speedContextFromState(state));
  const effectiveSpeed = speed.effective;
  const hasSpeedReduction = effectiveSpeed < speed.nominal;
```

`src/components/combat/VehicleStatsPanel.tsx`: delete the local `getEffectiveSpeed` (lines ~31-40 with comment). Add `import { getEffectiveSpeed, speedContextFromState } from '../../utils/vehicleSpeed';`. In `VehicleStatsPanel` (which already has `state` from `useCombat()`), add after the `useCombat()` line:

```ts
  const effectiveSpeed = getEffectiveSpeed(vehicle, speedContextFromState(state));
```

Then replace each `getEffectiveSpeed(vehicle)` at ~365-390 with `effectiveSpeed`.

`src/components/layout/RightPanel.tsx`: delete the local `getEffectiveSpeed` (lines ~130-139 with comment). Add `import { getSpeedBreakdown, speedContextFromState } from '../../utils/vehicleSpeed';`. Replace ~227-228 with:

```ts
    const speedInfo = getSpeedBreakdown(currentTurnVehicle, speedContextFromState(state));
    const effectiveSpeed = speedInfo.effective;
    const hasSpeedReduction = effectiveSpeed < speedInfo.nominal;
```

- [ ] **Step 8: Remove `getPropulsionSpeedCap`**

Delete `getPropulsionSpeedCap` and its doc comment from `src/utils/vehicleComponents.ts`. Then check nothing else references it:

Run: `grep -rn "getPropulsionSpeedCap\|function getEffectiveSpeed" src`
Expected: one hit only, `src/utils/vehicleSpeed.ts` (`export function getEffectiveSpeed`).

- [ ] **Step 9: Typecheck, lint, test**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: no type errors, lint clean (0 problems), all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/utils/vehicleSpeed.ts src/utils/vehicleSpeed.test.ts src/utils/vehicleComponents.ts src/components/battlefield/BattlefieldMap.tsx src/context/CombatContext.tsx src/components/vehicles/VehicleCard.tsx src/components/combat/VehicleStatsPanel.tsx src/components/layout/RightPanel.tsx
git commit -m "Unify effective speed into one shared function (ships use component speed)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Ship data + template editor inputs

**Files:**
- Modify: `src/data/navalTemplates.ts` (`oars()`/`sails()` helpers ~57-70; ship `components` arrays)
- Test: `src/data/navalTemplates.test.ts`
- Create: `src/utils/movementFields.ts`
- Test: `src/utils/movementFields.test.ts`
- Modify: `src/components/vehicles/VehicleTemplateEditor.tsx:188-190`

**Interfaces:**
- Consumes (Task 1): `VehicleComponent.windSpeeds`, `.speedLoss`, `.crewRequired`.
- Produces:
  - `withWindSpeed(c: VehicleComponent, key: 'with' | 'into', value: string): VehicleComponent['windSpeeds']`
  - `withSpeedLoss(c: VehicleComponent, key: 'feet' | 'perDamage', value: string): VehicleComponent['speedLoss']`

- [ ] **Step 1: Write the failing data test**

Create `src/data/navalTemplates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { VehicleTemplate } from '../types';
import { ROWBOAT, KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY } from './navalTemplates';

const part = (t: VehicleTemplate, id: string) => t.components?.find((c) => c.id === id);

describe('Saltmarsh ship movement data (spec table)', () => {
  it('oars: speed, speed loss, crew required', () => {
    expect(part(ROWBOAT, 'oars')).toMatchObject({ speed: 15 });
    expect(part(ROWBOAT, 'oars')?.speedLoss).toBeUndefined();
    expect(part(KEELBOAT, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 } });
    expect(part(KEELBOAT, 'oars')?.crewRequired).toBeUndefined();
    expect(part(LONGSHIP, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 20 });
    expect(part(WARSHIP, 'oars')).toMatchObject({ speed: 20, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 20 });
    expect(part(GALLEY, 'oars')).toMatchObject({ speed: 30, speedLoss: { feet: 5, perDamage: 25 }, crewRequired: 40 });
  });

  it('sails: base / into / with, speed loss', () => {
    expect(part(KEELBOAT, 'sails')).toMatchObject({ speed: 25, windSpeeds: { into: 15, with: 35 }, speedLoss: { feet: 5, perDamage: 20 } });
    expect(part(LONGSHIP, 'sails')).toMatchObject({ speed: 45, windSpeeds: { into: 15, with: 60 }, speedLoss: { feet: 10, perDamage: 25 } });
    expect(part(SAILING_SHIP, 'sails')).toMatchObject({ speed: 45, windSpeeds: { into: 15, with: 60 }, speedLoss: { feet: 5, perDamage: 25 } });
    expect(part(WARSHIP, 'sails')).toMatchObject({ speed: 35, windSpeeds: { into: 15, with: 50 }, speedLoss: { feet: 10, perDamage: 25 } });
    expect(part(GALLEY, 'sails')).toMatchObject({ speed: 35, windSpeeds: { into: 15, with: 50 }, speedLoss: { feet: 10, perDamage: 25 } });
  });

  it('wind/crew notes are no longer only in description text', () => {
    for (const t of [KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY]) {
      for (const c of t.components ?? []) {
        expect(c.description ?? '').not.toMatch(/with the wind|Requires at least/);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/navalTemplates.test.ts`
Expected: FAIL (`speedLoss`/`windSpeeds`/`crewRequired` undefined; description still matches).

- [ ] **Step 3: Update the helpers and ship components**

In `src/data/navalTemplates.ts`, replace the `oars` and `sails` helpers with:

```ts
type SpeedLoss = NonNullable<VehicleComponent['speedLoss']>;
const loss = (feet: number, perDamage: number): SpeedLoss => ({ feet, perDamage });

function oars(ac: number, maxHp: number, speed: number, speedLoss: SpeedLoss, crewRequired?: number): VehicleComponent {
  return { id: 'oars', name: 'Oars', kind: 'movement', ac, maxHp, speed, speedLoss, crewRequired, description: 'Movement component (oars).' };
}
function sails(ac: number, maxHp: number, speed: number, withWind: number, intoWind: number, speedLoss: SpeedLoss): VehicleComponent {
  return {
    id: 'sails',
    name: 'Sails',
    kind: 'movement',
    ac,
    maxHp,
    speed,
    windSpeeds: { with: withWind, into: intoWind },
    speedLoss,
    description: 'Movement component (sails).',
  };
}
```

Update each call site (rowboat's inline oars entry stays as it is):

```ts
// KEELBOAT
    oars(12, 100, 20, loss(5, 25)),
    sails(12, 100, 25, 35, 15, loss(5, 20)),
// LONGSHIP
    oars(12, 100, 20, loss(5, 25), 20),
    sails(12, 100, 45, 60, 15, loss(10, 25)),
// SAILING_SHIP
    sails(12, 100, 45, 60, 15, loss(5, 25)),
// WARSHIP
    oars(12, 100, 20, loss(5, 25), 20),
    sails(12, 100, 35, 50, 15, loss(10, 25)),
// GALLEY
    oars(12, 100, 30, loss(5, 25), 40),
    sails(12, 100, 35, 50, 15, loss(10, 25)),
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/data/navalTemplates.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing editor-helper tests**

Create `src/utils/movementFields.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { VehicleComponent } from '../types';
import { withWindSpeed, withSpeedLoss } from './movementFields';

const base: VehicleComponent = { id: 's', name: 'Sails', kind: 'movement', ac: 12, maxHp: 100, speed: 45 };

describe('withWindSpeed', () => {
  it('fills the other side with base speed so a half-entered pair still works', () => {
    expect(withWindSpeed(base, 'with', '60')).toEqual({ with: 60, into: 45 });
    expect(withWindSpeed({ ...base, windSpeeds: { with: 60, into: 45 } }, 'into', '15')).toEqual({ with: 60, into: 15 });
  });
  it('clears when both sides equal base speed', () => {
    expect(withWindSpeed({ ...base, windSpeeds: { with: 60, into: 45 } }, 'with', '')).toBeUndefined();
  });
});

describe('withSpeedLoss', () => {
  it('sets each part, keeping the other', () => {
    expect(withSpeedLoss(base, 'feet', '5')).toEqual({ feet: 5, perDamage: 0 });
    expect(withSpeedLoss({ ...base, speedLoss: { feet: 5, perDamage: 0 } }, 'perDamage', '25')).toEqual({ feet: 5, perDamage: 25 });
  });
  it('clears when both are empty/zero', () => {
    expect(withSpeedLoss({ ...base, speedLoss: { feet: 5, perDamage: 0 } }, 'feet', '')).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/utils/movementFields.test.ts`
Expected: FAIL. The module cannot be resolved.

- [ ] **Step 7: Implement `src/utils/movementFields.ts`**

```ts
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
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run src/utils/movementFields.test.ts`
Expected: PASS.

- [ ] **Step 9: Add the editor inputs**

In `src/components/vehicles/VehicleTemplateEditor.tsx`, add `import { withWindSpeed, withSpeedLoss } from '../../utils/movementFields';`. Replace the `{c.kind === 'movement' && ( … Speed … )}` block (~188-190) with:

```tsx
                {c.kind === 'movement' && (
                  <>
                    <TextField type="number" label="Speed" value={c.speed ?? ''} onChange={(e) => updateComponent(i, { speed: optNum(e.target.value) })} sx={{ width: 90 }} size="small" />
                    <TextField type="number" label="With wind" value={c.windSpeeds?.with ?? ''} onChange={(e) => updateComponent(i, { windSpeeds: withWindSpeed(c, 'with', e.target.value) })} sx={{ width: 100 }} size="small" helperText="Sails only" />
                    <TextField type="number" label="Into wind" value={c.windSpeeds?.into ?? ''} onChange={(e) => updateComponent(i, { windSpeeds: withWindSpeed(c, 'into', e.target.value) })} sx={{ width: 100 }} size="small" />
                    <TextField type="number" label="Lose ft" value={c.speedLoss?.feet || ''} onChange={(e) => updateComponent(i, { speedLoss: withSpeedLoss(c, 'feet', e.target.value) })} sx={{ width: 80 }} size="small" />
                    <TextField type="number" label="per dmg" value={c.speedLoss?.perDamage || ''} onChange={(e) => updateComponent(i, { speedLoss: withSpeedLoss(c, 'perDamage', e.target.value) })} sx={{ width: 80 }} size="small" />
                    <TextField type="number" label="Crew needed" value={c.crewRequired ?? ''} onChange={(e) => updateComponent(i, { crewRequired: optNum(e.target.value) })} sx={{ width: 100 }} size="small" />
                  </>
                )}
```

- [ ] **Step 10: Typecheck, lint, test, commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: clean, all pass.

```bash
git add src/data/navalTemplates.ts src/data/navalTemplates.test.ts src/utils/movementFields.ts src/utils/movementFields.test.ts src/components/vehicles/VehicleTemplateEditor.tsx
git commit -m "Saltmarsh ships: wind speeds, damage speed loss, oar crew; editor inputs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wind state (reducer, save/load, player-view payload)

**Files:**
- Modify: `src/context/CombatContext.tsx:153` (export `combatReducer`)
- Test: `src/context/combatReducer.test.ts`
- Modify: `src/hooks/useBroadcastChannel.ts:9-28` (`BattlefieldSyncState`)
- Modify: `src/components/battlefield/BattlefieldMap.tsx` (broadcast effect ~1362-1395)

**Interfaces:**
- Consumes (Task 1): `Environment.wind`, `CompassPoint`.
- Produces: `export function combatReducer(state: CombatState, action: CombatAction): CombatState`; `BattlefieldSyncState.wind?: CompassPoint`.

- [ ] **Step 1: Export the reducer**

In `src/context/CombatContext.tsx` line 153, change `function combatReducer(` to `export function combatReducer(`.

- [ ] **Step 2: Write the reducer test**

Create `src/context/combatReducer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// CombatContext imports Firebase and localStorage helpers; stub them so the pure reducer loads in Node.
vi.mock('../firebase', () => ({ logAnalyticsEvent: vi.fn() }));
vi.mock('../hooks/useLocalStorage', () => ({ loadCurrentEncounter: vi.fn(() => null) }));

import { combatReducer, initialCombatState } from './CombatContext';

describe('wind on Environment', () => {
  it('SET_ENVIRONMENT sets and clears wind without touching other fields', () => {
    const windy = combatReducer(initialCombatState, { type: 'SET_ENVIRONMENT', payload: { wind: 'NE' } });
    expect(windy.environment.wind).toBe('NE');
    expect(windy.environment.terrain).toBe(initialCombatState.environment.terrain);

    const calm = combatReducer(windy, { type: 'SET_ENVIRONMENT', payload: { wind: undefined } });
    expect(calm.environment.wind).toBeUndefined();
  });

  it('LOAD_ENCOUNTER of a save without wind loads as calm', () => {
    const legacy = { ...initialCombatState, environment: { terrain: 'Open Sea', hazards: [], visibility: 'clear' as const } };
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: legacy });
    expect(loaded.environment.wind).toBeUndefined();
    expect(loaded.environment.terrain).toBe('Open Sea');
  });

  it('LOAD_ENCOUNTER keeps a saved wind', () => {
    const saved = { ...initialCombatState, environment: { ...initialCombatState.environment, wind: 'SW' as const } };
    expect(combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: saved }).environment.wind).toBe('SW');
  });
});
```

- [ ] **Step 3: Run it**

Run: `npx vitest run src/context/combatReducer.test.ts`
Expected: PASS. The reducer already merges `environment`, so no reducer change is needed; this test pins that behaviour. If the import fails because of another module-load side effect, add a `vi.mock` for that module in the same style (the error message names the module) and re-run.

- [ ] **Step 4: Add wind to the player-view payload**

In `src/hooks/useBroadcastChannel.ts`, add `CompassPoint` to the `../types` import and add to `BattlefieldSyncState`:

```ts
  wind?: CompassPoint; // Direction the wind blows FROM; unset = calm
```

In `BattlefieldMap.tsx`'s broadcast effect, add `wind: state.environment.wind,` to the payload object (after `showHpBars,`) and `state.environment.wind,` to the dependency array (after `state.playerViewSettings,`).

- [ ] **Step 5: Typecheck, lint, test, commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: clean, all pass.

```bash
git add src/context/CombatContext.tsx src/context/combatReducer.test.ts src/hooks/useBroadcastChannel.ts src/components/battlefield/BattlefieldMap.tsx
git commit -m "Wind on Environment: reducer tests, sync to player view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wind selector + wind indicator

**Files:**
- Create: `src/components/battlefield/WindIndicator.tsx`
- Modify: `src/components/battlefield/BattlefieldMap.tsx` (toolbar ~1434; map container after the Empty State block ~2140-2157)
- Modify: `src/components/battlefield/PlayerViewMap.tsx` (inside `.player-view-map`, ~153)

**Interfaces:**
- Consumes: `COMPASS_POINTS`, `compassToDegrees`, `encounterHasSailingShips` (Task 1); `BattlefieldSyncState.wind` (Task 4).
- Produces: `WindIndicator({ wind }: { wind?: CompassPoint })`.

- [ ] **Step 1: Create the indicator**

`src/components/battlefield/WindIndicator.tsx`:

```tsx
import type { CompassPoint } from '../../types';
import { compassToDegrees } from '../../utils/navalMovement';

/** Corner overlay: arrow points the way the wind blows; label says where it blows from. */
export function WindIndicator({ wind }: { wind?: CompassPoint }) {
  if (!wind) return null;
  const blowsToward = (compassToDegrees(wind) + 180) % 360;
  return (
    <div
      title={`Wind from the ${wind}`}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        borderRadius: 6,
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: `rotate(${blowsToward}deg)` }} aria-hidden="true">
        <path d="M14 3 L21 13 H16.5 V25 H11.5 V13 H7 Z" fill="currentColor" />
      </svg>
      <span>Wind from {wind}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add the DM wind selector to the toolbar**

In `BattlefieldMap.tsx`, add imports:

```ts
import type { CompassPoint } from '../../types';
import { COMPASS_POINTS, encounterHasSailingShips } from '../../utils/navalMovement';
import { WindIndicator } from './WindIndicator';
```

(If `../../types` is already imported as a value import, add `CompassPoint` to that import instead.)

Near the other handlers (for example just before `handleUndoMove`'s definition), add:

```ts
  const showWind = encounterHasSailingShips(state.vehicles);
  const handleWindChange = (value: string) => {
    const wind = value === 'calm' ? undefined : (value as CompassPoint);
    dispatch({ type: 'SET_ENVIRONMENT', payload: { wind } });
    dispatch({ type: 'LOG_ACTION', payload: { type: 'system', action: wind ? `Wind now from the ${wind}` : 'Wind falls calm' } });
  };
```

In the toolbar's right-hand `<div className="flex items-center gap-sm">`, insert before `{/* Undo Move Button */}`:

```tsx
          {/* Wind (sailing ships only) */}
          {showWind && (
            <label className="flex items-center gap-sm text-xs" title="Direction the wind blows from">
              <span className="text-muted">Wind</span>
              <select
                className="btn btn-secondary text-xs"
                value={state.environment.wind ?? 'calm'}
                onChange={(e) => handleWindChange(e.target.value)}
                aria-label="Wind direction"
              >
                <option value="calm">Calm</option>
                {COMPASS_POINTS.map((p) => (
                  <option key={p} value={p}>From {p}</option>
                ))}
              </select>
            </label>
          )}
```

- [ ] **Step 3: Render the indicator on both maps**

`BattlefieldMap.tsx`: immediately after the `{/* Empty State */}` block's closing `)}` (inside the same map container), add:

```tsx
          {showWind && <WindIndicator wind={state.environment.wind} />}
```

`PlayerViewMap.tsx`: add `import { WindIndicator } from './WindIndicator';` and `import { encounterHasSailingShips } from '../../utils/navalMovement';`. Inside `<div ref={mapRef} className="player-view-map">`, before `{/* Background Image */}`, add:

```tsx
        {encounterHasSailingShips(state.vehicles) && <WindIndicator wind={state.wind} />}
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: clean, all pass.

- [ ] **Step 5: Visual check (static preview)**

Following the repo note, the dev server hangs under the sandbox and `vite build` takes about 4.5 minutes cold. Run `npm run build` in the background, then `python3 -m http.server 4173 -d dist`, and open `http://localhost:4173/app.html`:
- Add a Sailing Ship. The **Wind** selector appears; choose "From N". The arrow (top-right of the map) points down and reads "Wind from N", and the log shows "Wind now from the N".
- Open Player View. The same arrow appears.
- Remove the ship, or use an Avernus-only encounter. Both the selector and the arrow are hidden.
- If the arrow overlaps an existing top-right overlay, move it to `bottom: 8, right: 8` in `WindIndicator` and recheck.

- [ ] **Step 6: Commit**

```bash
git add src/components/battlefield/WindIndicator.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx
git commit -m "Wind selector on the battlefield toolbar and wind arrow on DM + player maps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Per-ship speed feedback (card, current-turn panel, components)

**Files:**
- Modify: `src/components/vehicles/VehicleCard.tsx` (speed tile ~390-433; `ComponentDamageSection` ~1624-1665 and its render site ~974)
- Modify: `src/components/layout/RightPanel.tsx` (current-turn speed display, around `hasSpeedReduction` usage after ~228)

**Interfaces:**
- Consumes: `getSpeedBreakdown`, `speedContextFromState`, `SpeedBreakdown` (Task 2); `speedReasonLabel`, `findUndermanned` (Task 1).

- [ ] **Step 1: VehicleCard speed tile — read-only for ships, with reason**

In `VehicleCard.tsx`, add `import { speedReasonLabel, findUndermanned } from '../../utils/navalMovement';`. After the `speed`/`effectiveSpeed` lines from Task 2, add:

```ts
  const speedReason = speed.propulsion.reasons.map(speedReasonLabel).join(' · ');
  const undermanned = findUndermanned(speed.propulsion);
```

Change the speed `Tooltip` title to:

```tsx
            title={speed.isShip ? `Book speed ${speed.nominal} ft${speedReason ? ` — ${speedReason}` : ''}` : hasSpeedReduction ? `${vehicle.currentSpeed} ft reduced by mishap effects` : 'Current speed'}
```

Inside the speed `<Paper>`, wrap the existing `<Box>…<TextField …/></Box>` so ships show a read-only number instead:

```tsx
              {speed.isShip ? (
                <Typography variant="h6" fontWeight={700} sx={{ color: effectiveSpeed !== speed.nominal ? '#f59e0b' : 'inherit' }}>
                  {effectiveSpeed}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  {/* existing TextField unchanged */}
                </Box>
              )}
```

Replace the two caption blocks (`{hasSpeedReduction && …}` / `{!hasSpeedReduction && …}`) with:

```tsx
              {speed.isShip ? (
                <Typography variant="caption" sx={{ color: speedReason ? '#f59e0b' : 'text.secondary', fontWeight: speedReason ? 600 : 400 }}>
                  {speedReason || 'Speed (ft)'}
                </Typography>
              ) : hasSpeedReduction ? (
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  {effectiveSpeed} ft actual
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">Speed (ft)</Typography>
              )}
```

For ships, change the `Paper`'s `bgcolor`/`border` condition from `hasSpeedReduction` to `effectiveSpeed !== speed.nominal` (keep `hasSpeedReduction` for land vehicles):

```tsx
                bgcolor: (speed.isShip ? effectiveSpeed !== speed.nominal : hasSpeedReduction) ? withOpacity('#f59e0b', 0.15) : '#242424',
                border: (speed.isShip ? effectiveSpeed !== speed.nominal : hasSpeedReduction) ? 1 : 0,
```

- [ ] **Step 2: Undermanned badge**

Directly below the stats row that contains the speed tile (the `Box` wrapping the AC / Speed / DEX `Paper`s), add:

```tsx
        {undermanned && (
          <Chip
            label={`Oars undermanned (${undermanned.have}/${undermanned.need})`}
            size="small"
            color="warning"
            sx={{ mb: 1 }}
          />
        )}
```

(`Chip` is already imported in this file, since the Components panel uses it.)

- [ ] **Step 3: Components panel — show each movement part's current speed**

The panel is `ComponentDamageSection` (`VehicleCard.tsx` ~1624; rendered at ~974 as `<ComponentDamageSection vehicle={vehicle} />`). Change the render site to `<ComponentDamageSection vehicle={vehicle} propulsion={speed.propulsion} />`. Add `propulsion: PropulsionSpeed;` to `ComponentDamageSectionProps` (import `type PropulsionSpeed` from `../../utils/navalMovement`), and destructure it: `function ComponentDamageSection({ vehicle, propulsion }: ComponentDamageSectionProps)`. In the HP caption (`{cur}/{comp.maxHp}{…DT…}`), append the speed for movement parts:

```tsx
                  {cur}/{comp.maxHp}{comp.damageThreshold ? ` · DT ${comp.damageThreshold}` : ''}
                  {comp.kind === 'movement' && (() => {
                    const part = propulsion.parts.find((p) => p.componentId === comp.id);
                    return part ? ` · ${part.speed} ft` : null;
                  })()}
```

- [ ] **Step 4: RightPanel current-turn speed reason**

In `RightPanel.tsx`, add `import { speedReasonLabel } from '../../utils/navalMovement';`. Find where `effectiveSpeed` / `hasSpeedReduction` are rendered in `CurrentTurnInfo` and add, next to the speed value:

```tsx
                {speedInfo.propulsion.reasons.length > 0 && (
                  <Typography variant="caption" sx={{ color: '#f59e0b', ml: 0.5 }}>
                    {speedInfo.propulsion.reasons.map(speedReasonLabel).join(' · ')}
                  </Typography>
                )}
```

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: clean, all pass.

- [ ] **Step 6: Manual check (static preview, as in Task 5 Step 5)**

- Sailing Ship facing S, wind From N: the card shows **60** with caption "with wind"; the movement ring on the map grows. Rotate to E: **45**, no caption. Rotate to N: **15** "into wind". Rotating mid-turn after moving shrinks the remaining movement and never goes below 0.
- Warship: damage Sails by 60 → the Components row shows "· 25 ft" (35 − 10); the card caption includes "−10 ft (damage)" when sails are the best part.
- Galley with 12 crew assigned (not in Passengers): the "Oars undermanned (12/40)" chip shows; speed comes from sails.
- An Avernus war machine: the speed field is still editable, mishaps still reduce speed as before, and there's no wind UI.

- [ ] **Step 7: Commit**

```bash
git add src/components/vehicles/VehicleCard.tsx src/components/layout/RightPanel.tsx
git commit -m "Ship speed feedback: wind/damage reasons, undermanned badge, per-part speeds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Help guide, changelog, final verification

**Files:**
- Modify: `src/components/help/HelpGuide.tsx` (after the "Ships take component damage" paragraph, ~243)
- Modify: `src/data/changelog.ts` (new first entry)

- [ ] **Step 1: Help guide paragraph**

In `HelpGuide.tsx`, change the `<Typography variant="body2">` that starts "**Ships take component damage**" to `<Typography variant="body2" paragraph>`, and add after it:

```tsx
            <Typography variant="body2">
              <strong>Wind &amp; ship speed:</strong> when a sailing ship is on the map, the toolbar shows a
              <strong> Wind</strong> selector (Calm or the direction it blows from). Sails run at their
              with-wind speed when heading within 45° of downwind, their into-wind speed within 45° of upwind,
              and normal speed otherwise. Turning mid-move changes the remaining movement right away. Sails and
              oars also lose speed as they take damage, and oars need their minimum crew (the Passengers zone
              doesn&apos;t count). A ship&apos;s speed is worked out from its parts, so its card shows the
              current speed and why.
            </Typography>
```

- [ ] **Step 2: Changelog**

At the top of the `changelog` array in `src/data/changelog.ts`:

```ts
  {
    version: '2.9.0',
    date: '2026-10-19',
    changes: [
      { type: 'feature', description: 'Wind for naval combat: set the wind direction from the battlefield toolbar (shown when a sailing ship is present). Sails use their with-wind or into-wind speed based on the ship\'s heading, and a wind arrow appears on the DM map and Player View.' },
      { type: 'feature', description: 'Ship sails and oars now lose speed as they take damage (per Ghosts of Saltmarsh), and oars need their minimum crew — longships and warships 20, galleys 40. An "Oars undermanned" badge explains when they stop.' },
      { type: 'improvement', description: 'Ship speed is now calculated from its components and shown with the reason (e.g. "with wind", "−10 ft (damage)"). Speed is now calculated the same way everywhere in the app, and half-speed effects from complications apply consistently on the map as well as the cards.' },
    ],
  },
```

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test`
Expected: no type errors, 0 lint problems, all tests pass. Paste the vitest summary line into the hand-off.

Run: `npm run build` (in the background; about 4–5 min)
Expected: build completes with no errors.

Then repeat the Task 6 Step 6 manual checks once against the final build.

- [ ] **Step 4: Commit**

```bash
git add src/components/help/HelpGuide.tsx src/data/changelog.ts
git commit -m "Help guide + changelog 2.9.0: wind and ship speed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do **not** deploy. Deployment (`CI=true npm run deploy`) is the user's call after reviewing the branch.
