# Naval Ship Turns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ships roll their own initiative (d20 + Dex + crew quality) with the existing Roll Init buttons, have a per-ship crew quality, and show a soft ship-action budget (0–3 actions by crew aboard) that fills in automatically as the GM moves the ship and rolls its weapons. All of it lives in existing War Machine surfaces.

**Architecture:** Pure rules go in `src/utils/shipTurn.ts`. Book data (`shipActions`) goes on the six ship templates. One new state map (`shipActionsUsed`) resets wherever `movementUsed` resets. Move is derived from `movementUsed`; Fire actions are marked when a station weapon is rolled. UI changes extend the sidebar Roll Init buttons and Vehicles list, the VehicleCard stat tiles, the RightPanel current-turn panel and `RollableText`.

**Tech Stack:** React 18 + TypeScript + Vite, MUI, React Context + useReducer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-naval-ship-turns-design.md`

## Global Constraints

- **Guiding principle:** ship turns should feel like War Machine turns. Follow the book where explicit; otherwise reuse existing War Machine behaviour and UI.
- **Which vehicles are ships:** vehicles where `isNavalVehicle(vehicle.template)` is true (`src/data/navalUpgrades.ts`). All other vehicles must behave exactly as today, including using their driver's initiative, or −100 without a driver.
- **Initiative:** `max(1, d20 + shipDexMod + crewQuality)`, rolled by the existing sidebar Roll Init buttons ("Roll NPC init" rolls `type === 'enemy'` ships; "Roll PC init" rolls `type === 'party'` ships). An unrolled ship uses 0. The order is fixed at Start Combat, and there is no mid-combat re-sort.
- **Crew quality:** `vehicle.crewQuality ?? 4`, clamped to −10…+10.
- **Crew aboard:** `countCrewAboard(vehicle.id, state.crewAssignments)` from `src/utils/navalMovement.ts` (non-passenger assignments).
- **Actions available:** the number of `template.shipActions.crewThresholds` entries met by crew aboard. Each action counts once per turn. It is a soft limit and is never blocked.
- **Move:** counts as used when `movementUsed[vehicle.id] > 0`.
- **Fire actions:** a Fire action is used the first time this round that any weapon in its `weaponIds` is rolled from its station row.
- **Log line formats:**
  - Initiative: `Galley rolls initiative 14 (d20 11, Dex −3, crew +6)`
  - Marking a Fire action: `Galley: Fire Ballistas (1 of 3 actions)`
- Pure logic goes in `src/utils/*.ts` with sibling `*.test.ts`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Gates:**
  - `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint <touched files>`, `npm test`.
  - Do not run full `npm run lint` (it hangs in the sandbox).
  - `npm run build` runs only in the last task.
- **Git hygiene:**
  - Use `git add` with explicit paths, and check `git diff --cached --name-only` before each commit.
  - Never stage `NAVAL_MECHANICS_SALTMARSH.md`, `COMBAT_LOG_EXPORT_PLAN.md`, `.superpowers/` or `dist/`.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/types/index.ts` | modify | `ShipActionDef`, `VehicleTemplate.shipActions`, `Vehicle.crewQuality/initiative`, `CombatState.shipActionsUsed` |
| `src/utils/shipTurn.ts` | create | Crew quality, Dex mod, initiative roll and log text, actions available/used/summary, weapon→action lookup |
| `src/utils/shipTurn.test.ts` | create | Tests for the above |
| `src/data/navalTemplates.ts` | modify | `shipActions` on six ships |
| `src/data/navalTemplates.test.ts` | modify | shipActions data assertions |
| `src/utils/navalBackfill.ts` (+ test) | modify | Also backfill `shipActions` |
| `src/context/CombatContext.tsx` | modify | State default and resets, `START_COMBAT` ship branch, `MARK_SHIP_ACTION` / `TOGGLE_SHIP_ACTION` |
| `src/context/combatReducer.test.ts` | modify | Reducer tests |
| `src/components/layout/Sidebar.tsx` | modify | Roll Init buttons also roll ships; Init chip on ship rows |
| `src/components/vehicles/VehicleCard.tsx` | modify | Crew quality tile |
| `src/components/common/RollableText.tsx` | modify | Optional `onRoll` callback |
| `src/components/layout/RightPanel.tsx` | modify | Ship init line, ship-actions header and chips, Fire marking on station rolls |
| `src/components/help/HelpGuide.tsx`, `src/data/changelog.ts` | modify | Docs, v2.10.0 |

---

### Task 1: Types + ship-turn rules engine

**Files:**
- Modify: `src/types/index.ts` (`VehicleTemplate` ~214-238, `Vehicle` ~241-266, `CombatState` ~435-490)
- Create: `src/utils/shipTurn.ts`
- Test: `src/utils/shipTurn.test.ts`

**Interfaces:**
- **Consumes:** `countCrewAboard(vehicleId, crewAssignments)` from `src/utils/navalMovement.ts`.
- **Produces (types):**
  - `ShipActionDef { id: string; name: string; weaponIds?: string[] }`
  - `VehicleTemplate.shipActions?: { actions: ShipActionDef[]; crewThresholds: number[] }`
  - `Vehicle.crewQuality?: number`
  - `Vehicle.initiative?: number`
  - `CombatState.shipActionsUsed: Record<string, string[]>`
- **Produces (functions, all exported from `shipTurn.ts`):**
  - `DEFAULT_CREW_QUALITY = 4`
  - `clampCrewQuality(n: number): number`
  - `getCrewQuality(vehicle: Vehicle): number`
  - `shipDexMod(vehicle: Vehicle): number`
  - `shipInitiativeModifier(vehicle: Vehicle): number`
  - `interface ShipInitiativeRoll { total: number; d20: number; dexMod: number; quality: number }`
  - `rollShipInitiative(vehicle: Vehicle, d20: number): ShipInitiativeRoll`
  - `formatShipInitiativeLog(name: string, roll: ShipInitiativeRoll): string`
  - `shipActionsAvailable(template: VehicleTemplate, crewAboard: number): number`
  - `actionForWeapon(template: VehicleTemplate, weaponId: string): ShipActionDef | undefined`
  - `type ShipTurnState = Pick<CombatState, 'shipActionsUsed' | 'movementUsed' | 'crewAssignments'>`
  - `shipActionsUsedFor(vehicle: Vehicle, state: ShipTurnState): string[]`
  - `interface ShipActionSummary { available: number; used: string[]; remaining: number; over: number; crewAboard: number }`
  - `shipActionSummary(vehicle: Vehicle, state: ShipTurnState): ShipActionSummary`

- [ ] **Step 1: Add the types**

In `src/types/index.ts`, add above `export interface VehicleTemplate`:

```ts
// One ship action from a Saltmarsh stat block (e.g. Move, Fire Ballistas).
export interface ShipActionDef {
  id: string;
  name: string;
  weaponIds?: string[]; // Station weapons this Fire action covers
}
```

Inside `VehicleTemplate`, after `beamFt?: number; …`:

```ts
  shipActions?: {
    actions: ShipActionDef[];
    crewThresholds: number[]; // [min crew for 1 action, for 2, for 3]
  };
```

Inside `Vehicle`, after `componentHp?: Record<string, number>;`:

```ts
  crewQuality?: number; // Ships: crew quality score (−10…+10). Missing → +4.
  initiative?: number; // Ships: own initiative (d20 + Dex + crew quality). Missing → 0.
```

Inside `CombatState`, after `moveHistory: MoveHistoryEntry[];`:

```ts

  // Ship actions marked used this round (Fire actions and manual toggles). Move is derived
  // from movementUsed. Reset alongside movementUsed.
  shipActionsUsed: Record<string, string[]>;
```

- [ ] **Step 2: Fix the one compile break the new required field causes**

In `src/context/CombatContext.tsx`, `initialCombatState` (~line 59): after `movementUsed: {},` add `shipActionsUsed: {},`.

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. If another object literal typed `CombatState` errors on the missing `shipActionsUsed`, add `shipActionsUsed: {},` there as well.

- [ ] **Step 3: Write the failing tests**

Create `src/utils/shipTurn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { CrewAssignment, Vehicle, VehicleTemplate } from '../types';
import {
  clampCrewQuality,
  getCrewQuality,
  shipDexMod,
  shipInitiativeModifier,
  rollShipInitiative,
  formatShipInitiativeLog,
  shipActionsAvailable,
  actionForWeapon,
  shipActionsUsedFor,
  shipActionSummary,
} from './shipTurn';

const SHIP_ACTIONS: VehicleTemplate['shipActions'] = {
  actions: [
    { id: 'fire_ballista', name: 'Fire Ballistas', weaponIds: ['ballista_1', 'ballista_2'] },
    { id: 'fire_mangonel', name: 'Fire Mangonels', weaponIds: ['mangonel_1'] },
    { id: 'move', name: 'Move' },
  ],
  crewThresholds: [3, 20, 40],
};

function makeShip(overrides: Partial<Vehicle> = {}, dex = 4, shipActions = SHIP_ACTIONS): Vehicle {
  const template = {
    id: 't', name: 'Galley', description: '', maxHp: 500, ac: 15, speed: 30, damageThreshold: 20,
    mishapThreshold: 999, crewCapacity: 80, zones: [], weapons: [], abilityScores: { str: 24, dex, con: 20 },
    environment: 'water', shipActions,
  } as unknown as VehicleTemplate;
  return {
    id: 'v1', name: 'Galley', type: 'enemy', template, currentHp: 500, currentSpeed: 30,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
    ...overrides,
  } as Vehicle;
}
const crew = (n: number, zoneId = 'deck_crew'): CrewAssignment[] =>
  Array.from({ length: n }, (_, i) => ({ creatureId: `c${i}`, vehicleId: 'v1', zoneId }));
const turn = (over: Partial<{ shipActionsUsed: Record<string, string[]>; movementUsed: Record<string, number>; crewAssignments: CrewAssignment[] }> = {}) => ({
  shipActionsUsed: {}, movementUsed: {}, crewAssignments: [], ...over,
});

describe('crew quality', () => {
  it('defaults to +4 and clamps to −10…+10', () => {
    expect(getCrewQuality(makeShip())).toBe(4);
    expect(getCrewQuality(makeShip({ crewQuality: 12 }))).toBe(10);
    expect(getCrewQuality(makeShip({ crewQuality: -15 }))).toBe(-10);
    expect(clampCrewQuality(3)).toBe(3);
  });
});

describe('initiative', () => {
  it('Dex modifier comes from template ability scores (galley Dex 4 → −3; missing → 0)', () => {
    expect(shipDexMod(makeShip())).toBe(-3);
    expect(shipDexMod(makeShip({}, 10))).toBe(0);
    expect(shipDexMod(makeShip({}, 7))).toBe(-2);
  });

  it('modifier = Dex mod + crew quality', () => {
    expect(shipInitiativeModifier(makeShip({ crewQuality: 6 }))).toBe(3);
  });

  it('rolls d20 + modifier with a floor of 1', () => {
    expect(rollShipInitiative(makeShip({ crewQuality: 6 }), 11)).toEqual({ total: 14, d20: 11, dexMod: -3, quality: 6 });
    expect(rollShipInitiative(makeShip({ crewQuality: -10 }), 2).total).toBe(1);
  });

  it('formats the log line', () => {
    expect(formatShipInitiativeLog('Galley', { total: 14, d20: 11, dexMod: -3, quality: 6 }))
      .toBe('Galley rolls initiative 14 (d20 11, Dex −3, crew +6)');
    expect(formatShipInitiativeLog('Sloop', { total: 12, d20: 12, dexMod: 0, quality: 0 }))
      .toBe('Sloop rolls initiative 12 (d20 12, Dex +0, crew +0)');
  });
});

describe('actions available', () => {
  it('counts crew thresholds met', () => {
    const t = makeShip().template;
    expect(shipActionsAvailable(t, 2)).toBe(0);
    expect(shipActionsAvailable(t, 3)).toBe(1);
    expect(shipActionsAvailable(t, 19)).toBe(1);
    expect(shipActionsAvailable(t, 20)).toBe(2);
    expect(shipActionsAvailable(t, 40)).toBe(3);
    expect(shipActionsAvailable(t, 80)).toBe(3);
  });

  it('is 0 for templates without shipActions', () => {
    expect(shipActionsAvailable(makeShip({}, 4, undefined).template, 80)).toBe(0);
  });

  it('maps weapons to their Fire action', () => {
    const t = makeShip().template;
    expect(actionForWeapon(t, 'ballista_2')?.id).toBe('fire_ballista');
    expect(actionForWeapon(t, 'mangonel_1')?.id).toBe('fire_mangonel');
    expect(actionForWeapon(t, 'harpoon')).toBeUndefined();
  });
});

describe('actions used', () => {
  it('derives Move from movementUsed and de-duplicates', () => {
    const v = makeShip();
    expect(shipActionsUsedFor(v, turn())).toEqual([]);
    expect(shipActionsUsedFor(v, turn({ movementUsed: { v1: 15 } }))).toEqual(['move']);
    expect(shipActionsUsedFor(v, turn({ movementUsed: { v1: 15 }, shipActionsUsed: { v1: ['fire_ballista', 'move'] } })))
      .toEqual(['fire_ballista', 'move']);
  });

  it('summarises remaining and over budget', () => {
    const v = makeShip();
    expect(shipActionSummary(v, turn({ crewAssignments: crew(25), shipActionsUsed: { v1: ['fire_ballista'] } })))
      .toEqual({ available: 2, used: ['fire_ballista'], remaining: 1, over: 0, crewAboard: 25 });
    expect(shipActionSummary(v, turn({
      crewAssignments: [...crew(5), ...crew(10, 'passengers')],
      movementUsed: { v1: 10 },
      shipActionsUsed: { v1: ['fire_ballista'] },
    }))).toEqual({ available: 1, used: ['fire_ballista', 'move'], remaining: 0, over: 1, crewAboard: 5 });
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/utils/shipTurn.test.ts`
Expected: FAIL, because `./shipTurn` cannot be resolved.

- [ ] **Step 5: Implement `src/utils/shipTurn.ts`**

```ts
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
```

- [ ] **Step 6: Run tests, typecheck and lint, then commit**

Run: `npx vitest run src/utils/shipTurn.test.ts`. Expected: PASS.
Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/types/index.ts src/utils/shipTurn.ts src/utils/shipTurn.test.ts src/context/CombatContext.tsx && npm test`. Expected: clean, all pass.

```bash
git add src/types/index.ts src/utils/shipTurn.ts src/utils/shipTurn.test.ts src/context/CombatContext.tsx
git commit -m "Ship turn rules: crew quality, ship initiative, action budget

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Ship action data + backfill

**Files:**
- Modify: `src/data/navalTemplates.ts` (ROWBOAT, KEELBOAT, LONGSHIP, SAILING_SHIP, WARSHIP, GALLEY)
- Modify: `src/data/navalTemplates.test.ts`
- Modify: `src/utils/navalBackfill.ts`, `src/utils/navalBackfill.test.ts`

**Interfaces:**
- **Consumes:** `ShipActionDef` and `VehicleTemplate.shipActions` (Task 1).
- **Produces:** built-in ship templates carry `shipActions`; `backfillNavalMovement(vehicle)` also fills `template.shipActions` for built-in ships that lack it.

- [ ] **Step 1: Write the failing data test**

Append to `src/data/navalTemplates.test.ts` (it already imports the six templates and `VehicleTemplate`):

```ts
describe('Saltmarsh ship actions (GoS stat blocks / 5e.tools actionThresholds)', () => {
  const summary = (t: VehicleTemplate) => ({
    names: t.shipActions?.actions.map((a) => a.name),
    thresholds: t.shipActions?.crewThresholds,
  });

  it('action names and crew thresholds', () => {
    expect(summary(ROWBOAT)).toEqual({ names: ['Move'], thresholds: [1] });
    expect(summary(KEELBOAT)).toEqual({ names: ['Fire Ballista', 'Move'], thresholds: [1, 2] });
    expect(summary(LONGSHIP)).toEqual({ names: ['Move'], thresholds: [1] });
    expect(summary(SAILING_SHIP)).toEqual({ names: ['Fire Ballista', 'Fire Mangonel', 'Move'], thresholds: [3, 10, 20] });
    expect(summary(WARSHIP)).toEqual({ names: ['Fire Ballistas', 'Fire Mangonels', 'Move'], thresholds: [3, 10, 20] });
    expect(summary(GALLEY)).toEqual({ names: ['Fire Ballistas', 'Fire Mangonels', 'Move'], thresholds: [3, 20, 40] });
  });

  it('every Fire action covers exactly the ship\'s weapons of that kind', () => {
    for (const t of [KEELBOAT, SAILING_SHIP, WARSHIP, GALLEY]) {
      for (const kind of ['ballista', 'mangonel']) {
        const action = t.shipActions!.actions.find((a) => a.id === `fire_${kind}`);
        const weaponIds = t.weapons.filter((w) => w.id.startsWith(kind)).map((w) => w.id);
        if (weaponIds.length === 0) {
          expect(action).toBeUndefined();
        } else {
          expect(action?.weaponIds).toEqual(weaponIds);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/data/navalTemplates.test.ts`
Expected: FAIL (`names: undefined`).

- [ ] **Step 3: Add `shipActions` to the six templates**

In `src/data/navalTemplates.ts`, add near the other helpers:

```ts
const MOVE: ShipActionDef = { id: 'move', name: 'Move' };
const fireBallista = (name: string, weaponIds: string[]): ShipActionDef => ({ id: 'fire_ballista', name, weaponIds });
const fireMangonel = (name: string, weaponIds: string[]): ShipActionDef => ({ id: 'fire_mangonel', name, weaponIds });
```

Add `ShipActionDef` to the file's `../types` import. Then add a `shipActions` property to each template object, for example after `weapons: …`:

```ts
// ROWBOAT
  shipActions: { actions: [MOVE], crewThresholds: [1] },
// KEELBOAT
  shipActions: { actions: [fireBallista('Fire Ballista', ['ballista']), MOVE], crewThresholds: [1, 2] },
// LONGSHIP
  shipActions: { actions: [MOVE], crewThresholds: [1] },
// SAILING_SHIP
  shipActions: {
    actions: [fireBallista('Fire Ballista', ['ballista']), fireMangonel('Fire Mangonel', ['mangonel']), MOVE],
    crewThresholds: [3, 10, 20],
  },
// WARSHIP
  shipActions: {
    actions: [
      fireBallista('Fire Ballistas', ['ballista_1', 'ballista_2']),
      fireMangonel('Fire Mangonels', ['mangonel_1', 'mangonel_2']),
      MOVE,
    ],
    crewThresholds: [3, 10, 20],
  },
// GALLEY
  shipActions: {
    actions: [
      fireBallista('Fire Ballistas', ['ballista_1', 'ballista_2', 'ballista_3', 'ballista_4']),
      fireMangonel('Fire Mangonels', ['mangonel_1', 'mangonel_2']),
      MOVE,
    ],
    crewThresholds: [3, 20, 40],
  },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/data/navalTemplates.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing backfill test**

Append to `src/utils/navalBackfill.test.ts` (it already has `makeVehicle` and imports `GALLEY`; if `GALLEY` isn't imported, add it to the `../data/navalTemplates` import):

```ts
describe('backfillNavalMovement — ship actions', () => {
  it('adds shipActions to a saved built-in ship that lacks them', () => {
    const { shipActions: _sa, ...oldGalley } = GALLEY;
    const out = backfillNavalMovement(makeVehicle(oldGalley as typeof GALLEY));
    expect(out.template.shipActions).toEqual(GALLEY.shipActions);
  });

  it('keeps existing shipActions untouched', () => {
    const custom = { ...GALLEY, shipActions: { actions: [{ id: 'move', name: 'Move' }], crewThresholds: [1] } };
    const v = makeVehicle(custom);
    expect(backfillNavalMovement(v).template.shipActions).toBe(custom.shipActions);
  });
});
```

If `makeVehicle` in that file takes a template and returns a `Vehicle`, use it as shown. Otherwise build the vehicle inline the same way the file's other tests do.

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/utils/navalBackfill.test.ts`
Expected: FAIL on the first new test (`shipActions` undefined).

- [ ] **Step 7: Extend the backfill**

In `src/utils/navalBackfill.ts`:
- Update the doc comment to say it also restores ship actions (added in 2.10.0).
- Replace the start and return of `backfillNavalMovement` with this. Keep the existing component logic, but note the early return no longer requires `components`.

```ts
export function backfillNavalMovement(vehicle: Vehicle): Vehicle {
  const builtIn = NAVAL_TEMPLATES.find((t) => t.id === vehicle.template.id);
  if (!builtIn) return vehicle;

  let template = vehicle.template;

  const components = template.components;
  if (builtIn.components && components) {
    let changed = false;
    const newComponents = components.map((c) => {
      if (c.kind !== 'movement') return c;
      const ref = builtIn.components!.find((b) => b.id === c.id);
      if (!ref) return c;
      if (c.windSpeeds !== undefined || c.speedLoss !== undefined || c.crewRequired !== undefined) return c;
      changed = true;
      return {
        ...c,
        windSpeeds: ref.windSpeeds,
        speedLoss: ref.speedLoss,
        crewRequired: ref.crewRequired,
        description: ref.description,
      };
    });
    if (changed) template = { ...template, components: newComponents };
  }

  if (!template.shipActions && builtIn.shipActions) {
    template = { ...template, shipActions: builtIn.shipActions };
  }

  return template === vehicle.template ? vehicle : { ...vehicle, template };
}
```

- [ ] **Step 8: Run tests and gates, then commit**

Run: `npx vitest run src/utils/navalBackfill.test.ts src/data/navalTemplates.test.ts`. Expected: PASS, including the earlier backfill tests ("same reference" cases).
Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/data/navalTemplates.ts src/data/navalTemplates.test.ts src/utils/navalBackfill.ts src/utils/navalBackfill.test.ts && npm test`. Expected: clean.

```bash
git add src/data/navalTemplates.ts src/data/navalTemplates.test.ts src/utils/navalBackfill.ts src/utils/navalBackfill.test.ts
git commit -m "Saltmarsh ships: book ship actions and crew thresholds; backfill into old saves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reducer — ship initiative at Start Combat, action marks, resets

**Files:**
- Modify: `src/context/CombatContext.tsx`
  - `CombatAction` union ~62-140
  - `LOAD_ENCOUNTER` ~283
  - `START_COMBAT` ~748-810
  - `NEXT_ROUND` ~875
  - `RESET_COMBAT` ~941
  - `RETURN_TO_SETUP` ~966
  - `RESET_MOVEMENT_TRACKING` ~1365
- Test: `src/context/combatReducer.test.ts`

**Interfaces:**
- **Consumes:** `isNavalVehicle` (`src/data/navalUpgrades.ts`); `shipActionSummary` and `ShipActionDef` (Task 1).
- **Produces actions:**
  - `{ type: 'MARK_SHIP_ACTION'; payload: { vehicleId: string; actionId: string } }`: idempotent, logs once.
  - `{ type: 'TOGGLE_SHIP_ACTION'; payload: { vehicleId: string; actionId: string } }`: adds or removes, and logs.
  - `START_COMBAT` now uses `vehicle.initiative ?? 0` for naval vehicles.

- [ ] **Step 1: Write the failing reducer tests**

Append to `src/context/combatReducer.test.ts`. Add `WARSHIP` to the existing `../data/navalTemplates` import, and `Vehicle`, `Creature`, `CrewAssignment` to the types import if missing.

```ts
describe('ship turns', () => {
  const ship = (id: string, name: string, initiative?: number) => ({
    id, name, type: 'enemy', template: WARSHIP, currentHp: 500, currentSpeed: 35,
    activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0, initiative,
  }) as unknown as Vehicle;
  const warMachine = (id: string) => ({
    id, name: 'Devil\'s Ride', type: 'enemy',
    template: { id: 'devils-ride', name: 'Devil\'s Ride', pack: 'avernus', zones: [], weapons: [], maxHp: 30 },
    currentHp: 30, currentSpeed: 120, activeMishaps: [], conditions: [], weapons: [], position: { x: 0, y: 0 }, facing: 0,
  }) as unknown as Vehicle;

  it('START_COMBAT orders ships by their own initiative (unrolled = 0); war machines without a driver get −100', () => {
    const s = { ...initialCombatState, vehicles: [ship('a', 'Alpha', 5), ship('b', 'Bravo', 17), ship('c', 'Charlie'), warMachine('w')] };
    const out = combatReducer(s, { type: 'START_COMBAT' });
    expect(out.initiativeOrder).toEqual(['b', 'a', 'c', 'w']);
  });

  it('MARK_SHIP_ACTION is idempotent and logs once', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, vehicles: [ship('a', 'Alpha')] };
    const once = combatReducer(s, { type: 'MARK_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'fire_ballista' } });
    const twice = combatReducer(once, { type: 'MARK_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'fire_ballista' } });
    expect(twice.shipActionsUsed.a).toEqual(['fire_ballista']);
    expect(twice.actionLog.length).toBe(once.actionLog.length);
    expect(once.actionLog.at(-1)?.action).toBe('Alpha: Fire Ballistas (1 of 0 actions)');
  });

  it('TOGGLE_SHIP_ACTION adds then removes', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, vehicles: [ship('a', 'Alpha')] };
    const on = combatReducer(s, { type: 'TOGGLE_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'move' } });
    expect(on.shipActionsUsed.a).toEqual(['move']);
    const off = combatReducer(on, { type: 'TOGGLE_SHIP_ACTION', payload: { vehicleId: 'a', actionId: 'move' } });
    expect(off.shipActionsUsed.a).toEqual([]);
  });

  it('NEXT_ROUND and RESET_MOVEMENT_TRACKING clear ship action marks', () => {
    const s = { ...initialCombatState, phase: 'combat' as const, round: 1, shipActionsUsed: { a: ['move'] } };
    expect(combatReducer(s, { type: 'NEXT_ROUND' }).shipActionsUsed).toEqual({});
    expect(combatReducer(s, { type: 'RESET_MOVEMENT_TRACKING' }).shipActionsUsed).toEqual({});
  });

  it('LOAD_ENCOUNTER of an older save defaults shipActionsUsed', () => {
    const { shipActionsUsed: _x, ...old } = initialCombatState;
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: old as typeof initialCombatState });
    expect(loaded.shipActionsUsed).toEqual({});
  });
});
```

The `(1 of 0 actions)` text is correct here: the ship has no crew assigned, so 0 actions are available. The log still records the over-budget use.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/context/combatReducer.test.ts`
Expected: FAIL. The new actions are unknown (type errors are reported as test failures, or `shipActionsUsed.a` is undefined), and ships use driver initiative.

- [ ] **Step 3: Implement the reducer changes**

In `src/context/CombatContext.tsx`:

1. **Imports:**

```ts
import { isNavalVehicle } from '../data/navalUpgrades';
import { shipActionSummary } from '../utils/shipTurn';
```

2. **`CombatAction` union:** add next to `RESET_MOVEMENT_TRACKING`:

```ts
  | { type: 'MARK_SHIP_ACTION'; payload: { vehicleId: string; actionId: string } }
  | { type: 'TOGGLE_SHIP_ACTION'; payload: { vehicleId: string; actionId: string } }
```

3. **`LOAD_ENCOUNTER`:** after `moveHistory: action.payload.moveHistory || [],` add:

```ts
        shipActionsUsed: action.payload.shipActionsUsed || {},
```

4. **`START_COMBAT`:** replace the vehicle loop body. Update the header comment to mention that ships (Saltmarsh) use their own initiative.

```ts
      state.vehicles.forEach((vehicle) => {
        let initiative: number;
        if (isNavalVehicle(vehicle.template)) {
          // Ships roll their own initiative (GoS): set by the sidebar Roll Init buttons; unrolled = 0
          initiative = vehicle.initiative ?? 0;
        } else {
          const driver = findVehicleDriver(vehicle, state.crewAssignments, state.creatures);
          // Use driver's initiative, or -100 if no driver (acts last)
          initiative = driver ? driver.initiative : -100;
        }

        initiativeEntries.push({
          id: vehicle.id,
          type: 'vehicle',
          initiative,
          name: vehicle.name,
        });
      });
```

   In the same case's returned object, after `movementUsed: {},` add `shipActionsUsed: {},`.

5. **`NEXT_ROUND`, `RESET_COMBAT`, `RETURN_TO_SETUP`, `RESET_MOVEMENT_TRACKING`:** in each returned object, after `movementUsed: {},` add `shipActionsUsed: {},`.

6. **New cases:** add next to `RESET_MOVEMENT_TRACKING`:

```ts
    case 'MARK_SHIP_ACTION':
    case 'TOGGLE_SHIP_ACTION': {
      const { vehicleId, actionId } = action.payload;
      const vehicle = state.vehicles.find((v) => v.id === vehicleId);
      const current = state.shipActionsUsed[vehicleId] ?? [];
      const has = current.includes(actionId);
      if (action.type === 'MARK_SHIP_ACTION' && has) return state;
      const next = has ? current.filter((id) => id !== actionId) : [...current, actionId];
      const nextState = { ...state, shipActionsUsed: { ...state.shipActionsUsed, [vehicleId]: next } };
      const actionName = vehicle?.template.shipActions?.actions.find((a) => a.id === actionId)?.name ?? actionId;
      const summary = vehicle ? shipActionSummary(vehicle, nextState) : null;
      const text = has
        ? `${vehicle?.name ?? 'Ship'}: ${actionName} unmarked`
        : `${vehicle?.name ?? 'Ship'}: ${actionName} (${summary?.used.length ?? next.length} of ${summary?.available ?? 0} actions)`;
      return {
        ...nextState,
        actionLog: [...state.actionLog, createLogEntry(state.round, 'ability', text)],
      };
    }
```

   `createLogEntry(round, type, action)` already exists in this file, and `'ability'` is an existing `LogEntryType`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/context/combatReducer.test.ts`
Expected: PASS (all tests, including the earlier ones).

- [ ] **Step 5: Run the gates and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/context/CombatContext.tsx src/context/combatReducer.test.ts && npm test`. Expected: clean.

```bash
git add src/context/CombatContext.tsx src/context/combatReducer.test.ts
git commit -m "Ships use their own initiative at Start Combat; ship action marks reset each round

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Initiative UI — Roll Init buttons roll ships; Init chip on ship rows

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (roll handlers ~502-540; Vehicles list ~980-1020)

**Interfaces:**
- **Consumes:** `rollShipInitiative`, `formatShipInitiativeLog` (Task 1); `isNavalVehicle` (`../../data/navalUpgrades`); `UPDATE_VEHICLE` (existing, payload `{ id, updates }`); `LOG_ACTION` (existing).

- [ ] **Step 1: Roll ships with the existing buttons**

Add the imports:

```ts
import { isNavalVehicle } from '../../data/navalUpgrades';
import { rollShipInitiative, formatShipInitiativeLog } from '../../utils/shipTurn';
```

Add above `handleRollAllNpcInit`:

```ts
  // Ships roll their own initiative (GoS): d20 + Dex + crew quality, rolled alongside creatures
  const rollShipsInit = (faction: 'party' | 'enemy') => {
    state.vehicles
      .filter((v) => v.type === faction && isNavalVehicle(v.template))
      .forEach((ship) => {
        const roll = rollShipInitiative(ship, Math.floor(Math.random() * 20) + 1);
        dispatch({ type: 'UPDATE_VEHICLE', payload: { id: ship.id, updates: { initiative: roll.total } } });
        dispatch({ type: 'LOG_ACTION', payload: { type: 'system', action: formatShipInitiativeLog(ship.name, roll) } });
      });
  };
```

At the end of `handleRollAllNpcInit`'s body add `rollShipsInit('enemy');`. At the end of `handleRollAllPcInit`'s body add `rollShipsInit('party');`.

Update the two button tooltips:
- NPC: `"Roll initiative for all NPCs (1d20 + DEX Save) and enemy ships (1d20 + DEX + crew quality)"`
- PC: `"Roll initiative for all PCs (1d20 + DEX Save) and party ships (1d20 + DEX + crew quality)"`

- [ ] **Step 2: Add the Init chip to ship rows in the Vehicles list**

Add local state near the other edit state:

```ts
  const [editingShipInitId, setEditingShipInitId] = useState<string | null>(null);
  const [shipInitDraft, setShipInitDraft] = useState('');
  const saveShipInit = (id: string) => {
    const n = parseInt(shipInitDraft, 10);
    if (Number.isFinite(n)) dispatch({ type: 'UPDATE_VEHICLE', payload: { id, updates: { initiative: n } } });
    setEditingShipInitId(null);
  };
```

In the Vehicles list row, replace the header `Box` (name + HP) with:

```tsx
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={600}>{vehicle.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isNavalVehicle(vehicle.template) && (
                        editingShipInitId === vehicle.id ? (
                          <TextField
                            size="small"
                            type="number"
                            autoFocus
                            value={shipInitDraft}
                            onChange={(e) => setShipInitDraft(e.target.value)}
                            onBlur={() => saveShipInit(vehicle.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveShipInit(vehicle.id); if (e.key === 'Escape') setEditingShipInitId(null); }}
                            inputProps={{ 'aria-label': `${vehicle.name} initiative`, style: { width: 40, padding: '2px 4px' } }}
                          />
                        ) : (
                          <Tooltip title={state.phase === 'setup' ? 'Ship initiative (d20 + DEX + crew quality). Click to edit.' : 'Ship initiative (fixed once combat starts)'} arrow>
                            <Chip
                              label={`Init ${vehicle.initiative ?? 0}`}
                              size="small"
                              variant="outlined"
                              onClick={state.phase === 'setup' ? () => { setShipInitDraft(String(vehicle.initiative ?? 0)); setEditingShipInitId(vehicle.id); } : undefined}
                              sx={{ height: 18, fontSize: '0.625rem' }}
                            />
                          </Tooltip>
                        )
                      )}
                      <Typography variant="caption" fontFamily="monospace">
                        {vehicle.currentHp}/{vehicle.template.maxHp}
                      </Typography>
                    </Box>
                  </Box>
```

`Chip`, `TextField` and `Tooltip` are already imported in Sidebar.tsx. Confirm with a grep, and add any that are missing to the existing `@mui/material` import.

- [ ] **Step 3: Run the gates and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/layout/Sidebar.tsx && npm test`. Expected: clean.

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "Roll Init buttons also roll ship initiative; editable Init chip on ship rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Crew quality tile on the vehicle card

**Files:**
- Modify: `src/components/vehicles/VehicleCard.tsx` (stat tile `Stack`, around the "DEX Save" tile ~439-455)

**Interfaces:**
- **Consumes:** `getCrewQuality`, `clampCrewQuality` (Task 1); `isNavalVehicle` (already imported in this file); `UPDATE_VEHICLE`.

- [ ] **Step 1: Add the tile before the DEX Save tile**

Add `import { getCrewQuality, clampCrewQuality } from '../../utils/shipTurn';`. Immediately before `<Tooltip title="Driver's DEX save (for avoiding hazards)" …>`, insert:

```tsx
          {isNavalVehicle(vehicle.template) && (() => {
            const quality = getCrewQuality(vehicle);
            const setQuality = (n: number) =>
              dispatch({ type: 'UPDATE_VEHICLE', payload: { id: vehicle.id, updates: { crewQuality: clampCrewQuality(n) } } });
            return (
              <Tooltip title="Crew quality: adds to ship initiative (d20 + Dex + quality). Book default +4." arrow placement="top">
                <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#242424' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                    <IconButton size="small" aria-label="Lower crew quality" disabled={quality <= -10} onClick={() => setQuality(quality - 1)} sx={{ p: 0.25 }}>
                      <RemoveIcon fontSize="inherit" />
                    </IconButton>
                    <Typography variant="h6" fontWeight={700}>
                      {quality >= 0 ? '+' : ''}{quality}
                    </Typography>
                    <IconButton size="small" aria-label="Raise crew quality" disabled={quality >= 10} onClick={() => setQuality(quality + 1)} sx={{ p: 0.25 }}>
                      <AddIcon fontSize="inherit" />
                    </IconButton>
                  </Box>
                  <Typography variant="caption" color="text.secondary">Crew</Typography>
                </Paper>
              </Tooltip>
            );
          })()}
```

Check that `IconButton`, `RemoveIcon` (`@mui/icons-material/Remove`) and `AddIcon` (`@mui/icons-material/Add`) are imported in VehicleCard.tsx, and add any missing ones following the file's existing import style. `dispatch` is already destructured from `useCombat()` in `VehicleCard`.

- [ ] **Step 2: Run the gates and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/vehicles/VehicleCard.tsx && npm test`. Expected: clean.

```bash
git add src/components/vehicles/VehicleCard.tsx
git commit -m "Crew quality tile on ship cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Current-turn panel — ship init, action budget, Fire marking on station rolls

**Files:**
- Modify: `src/components/common/RollableText.tsx` (`RollableTextProps`, `handleRoll`)
- Modify: `src/components/layout/RightPanel.tsx` (`CurrentTurnInfo`: driver line ~265-272; station rows' `RollableText` calls ~345-380; collapsed hint ~318-322)

**Interfaces:**
- **Consumes:** `shipActionSummary`, `actionForWeapon` (Task 1); `MARK_SHIP_ACTION`, `TOGGLE_SHIP_ACTION` (Task 3); `isNavalVehicle`.
- **Produces:** `RollableTextProps.onRoll?: (notation: string) => void`.

- [ ] **Step 1: Add the `onRoll` callback to `RollableText`**

In `RollableText.tsx`:
- Add `onRoll?: (notation: string) => void;` to `RollableTextProps`, with the doc comment `/** Called after a roll is made (e.g. to mark a ship's Fire action). */`.
- Destructure it: `export function RollableText({ text, source, onRoll }: RollableTextProps)`.
- At the end of `handleRoll`, after the `dispatch({...})`, add `onRoll?.(notation);`.

- [ ] **Step 2: Add the ship init line and the action budget under the Driver line**

In `RightPanel.tsx`:
- Add imports:

```ts
import { isNavalVehicle } from '../../data/navalUpgrades';
import { shipActionSummary, actionForWeapon } from '../../utils/shipTurn';
```

- In `CurrentTurnInfo`, change the hook line to also take `dispatch`: `const { state, dispatch, currentTurnCreature, currentTurnVehicle, currentTurnDriver } = useCombat();`.
- Inside the `if (currentTurnVehicle) {` block, after the `shownSpeed` line, add:

```ts
    const isShip = isNavalVehicle(currentTurnVehicle.template);
    const shipActions = currentTurnVehicle.template.shipActions;
    const shipSummary = shipActions ? shipActionSummary(currentTurnVehicle, state) : null;
    const hasMoved = (state.movementUsed[currentTurnVehicle.id] ?? 0) > 0;
```

- Replace the `{/* Driver */}` block with:

```tsx
        {/* Driver */}
        {(currentTurnDriver || isShip) && (
          <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>
            {currentTurnDriver && (
              <>
                <Box component="span" color="text.secondary">Driver: </Box>
                <Box component="span" fontWeight={600}>{currentTurnDriver.name}</Box>
                {!isShip && <Box component="span" color="text.secondary"> (Init: {currentTurnDriver.initiative})</Box>}
              </>
            )}
            {isShip && (
              <Box component="span" color="text.secondary">{currentTurnDriver ? ' · ' : ''}Ship init: {currentTurnVehicle.initiative ?? 0}</Box>
            )}
          </Typography>
        )}

        {/* Ship actions (GoS): budget by crew aboard; marks fill in as the ship moves and fires */}
        {shipActions && shipSummary && (
          <Box sx={{ mb: 1 }}>
            {shipSummary.available === 0 ? (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                No ship actions: needs {shipActions.crewThresholds[0]} crew ({shipSummary.crewAboard} aboard)
              </Typography>
            ) : (
              <Typography variant="caption" sx={{ display: 'block', color: shipSummary.over > 0 ? 'error.main' : 'text.secondary' }}>
                Ship actions: {shipSummary.remaining} of {shipSummary.available} ({shipSummary.crewAboard}/{currentTurnVehicle.template.crewCapacity} crew)
                {shipSummary.over > 0 && ` · ${shipSummary.over} over`}
              </Typography>
            )}
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
              {shipActions.actions.map((a) => {
                const used = shipSummary.used.includes(a.id);
                const autoMove = a.id === 'move' && hasMoved;
                return (
                  <Chip
                    key={a.id}
                    label={used ? `✓ ${a.name}` : a.name}
                    size="small"
                    color={used ? 'primary' : 'default'}
                    variant={used ? 'filled' : 'outlined'}
                    onClick={autoMove ? undefined : () => dispatch({ type: 'TOGGLE_SHIP_ACTION', payload: { vehicleId: currentTurnVehicle.id, actionId: a.id } })}
                    title={autoMove ? 'Used: the ship moved this turn' : 'Click to mark or unmark'}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                );
              })}
            </Stack>
          </Box>
        )}
```

Check that `Chip` and `Stack` are imported from `@mui/material` in RightPanel.tsx, and add them if missing.

- [ ] **Step 3: Mark Fire actions when a station weapon is rolled**

In the station-row map (`vehicleCrew.map(({ creature, zone, weapon, isDriver }) => {`), right after `const isExpanded = …;`, add:

```ts
              const fireAction = weapon ? actionForWeapon(currentTurnVehicle.template, weapon.id) : undefined;
              const markFire = fireAction
                ? () => dispatch({ type: 'MARK_SHIP_ACTION', payload: { vehicleId: currentTurnVehicle.id, actionId: fireAction.id } })
                : undefined;
```

Then:
- Pass `onRoll={markFire}` to the two `RollableText` elements for that weapon: the to-hit `RollableText` (`text={\`1d20…\`}`) and the damage one (`text={weapon.damage}`). Leave the `specialEffect` one alone.
- In the collapsed hint, change `⚔ {weapon.name} — tap to view &amp; roll` to `⚔ {weapon.name} — tap to view &amp; roll{fireAction ? \` · uses ${fireAction.name}\` : ''}`.

- [ ] **Step 4: Run the gates and commit**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/common/RollableText.tsx src/components/layout/RightPanel.tsx && npm test`. Expected: clean.

```bash
git add src/components/common/RollableText.tsx src/components/layout/RightPanel.tsx
git commit -m "Ship turn panel: ship init, action budget chips, Fire marked on station rolls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Help guide, changelog 2.10.0, build

**Files:**
- Modify: `src/components/help/HelpGuide.tsx` (after the "Wind & ship speed" paragraph)
- Modify: `src/data/changelog.ts` (new first entry)

- [ ] **Step 1: Help guide paragraph**

In `HelpGuide.tsx`:
- Find the `<Typography variant="body2">` that begins `<strong>Wind &amp; ship speed:</strong>` and add the `paragraph` prop to it.
- Then insert after it:

```tsx
            <Typography variant="body2">
              <strong>Ship turns:</strong> ships roll their own initiative (d20 + the ship&apos;s DEX + its crew
              quality) when you press the same <strong>Roll Init</strong> buttons you use for creatures: NPC rolls
              enemy ships, PC rolls party ships. Edit a ship&apos;s <strong>Init</strong> chip in the Vehicles list
              before combat. Crew quality (+4 by default) sits next to AC and Speed on the ship&apos;s card. On a
              ship&apos;s turn the panel shows how many ship actions it gets from the crew aboard. Moving the ship
              ticks <strong>Move</strong>, and rolling a weapon from its station ticks that Fire action. Click a
              chip to tick or untick it by hand. Going over is allowed; it just shows in red.
            </Typography>
```

- [ ] **Step 2: Changelog**

Add at the top of the `changelog` array in `src/data/changelog.ts`:

```ts
  {
    version: '2.10.0',
    date: '2026-10-19',
    changes: [
      { type: 'feature', description: 'Ship initiative (Ghosts of Saltmarsh): ships roll d20 + DEX + crew quality with the existing Roll Init buttons — NPC for enemy ships, PC for party ships — and the roll is logged. Edit a ship\'s Init chip in the Vehicles list before combat. War machines still use their driver\'s initiative.' },
      { type: 'feature', description: 'Crew quality: each ship has a Crew tile (default +4, −10 to +10) on its card.' },
      { type: 'feature', description: 'Ship actions: on a ship\'s turn the panel shows how many actions its crew allows (e.g. a galley gets 3 with 40+ crew) and ticks Move and Fire actions as you move the ship and roll its weapons. Over-budget use is shown in red but never blocked.' },
    ],
  },
```

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/help/HelpGuide.tsx src/data/changelog.ts && npm test`. Expected: clean, all pass. Paste the vitest summary line.

Run: `npm run build` in the foreground with a 10-minute timeout. Expected: build succeeds. Paste the last lines.

- [ ] **Step 4: Commit**

```bash
git add src/components/help/HelpGuide.tsx src/data/changelog.ts
git commit -m "Help guide + changelog 2.10.0: ship turns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do **not** deploy. The manual browser check from the spec's Testing section is done by the user.
