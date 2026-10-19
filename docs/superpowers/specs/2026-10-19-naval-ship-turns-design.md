# Naval Crew-Driven Ship Turns — Design

**Date:** 2026-10-19
**Status:** Approved design, pending spec review
**Target release:** v2.10.0
**Part of:** Naval combat engine (piece 2 of 4: movement & wind → **crew-driven ship turns** → officers → ramming & crashing)
**Builds on:** branch `feat/naval-movement-wind` (v2.9.0): `countCrewAboard`, `isNavalVehicle`, ship templates in `src/data/navalTemplates.ts`

## Goal

Ships take their turns the way *Ghosts of Saltmarsh* Appendix A ("Ships in Combat", "Officers and Crew", ship stat blocks) describes:

1. A ship rolls its own initiative: d20 + its Dexterity modifier + its crew's quality score.
2. On its turn, a ship gets 0–3 ship actions (Move, Fire Ballista(s), Fire Mangonel(s)), depending on how many crew are aboard.
3. Crew quality is a per-ship number. It starts at +4 and ranges from −10 to +10.

Out of scope:
- Officer actions (Take Aim, Full Speed Ahead). These are piece 3.
- Crashing and ramming. These are piece 4.
- Crew quality changing over days (voyage/travel phase).
- Template-editor fields for ship actions.
- Hard enforcement of the action budget.

Avernus war machines and other non-naval vehicles must behave exactly as today, including using their driver's initiative.

## Source rules (verified on 5e.tools, GoS Appendix A, 2026-10-19)

- Initiative: a ship rolls initiative using its Dexterity, with its crew's quality score as a modifier. On the ship's turn the captain decides which ship actions to use.
- Crew quality starts at +4, with a range of −10 to +10. Killing crew reduces the number of actions most ships can take.
- Actions and crew thresholds, from 5e.tools `vehicles.json` `actionThresholds` (minimum crew for N actions):

| Ship | Actions | 1 action | 2 actions | 3 actions |
|---|---|---|---|---|
| Rowboat | Move | 1 | — | — |
| Keelboat | Fire Ballista, Move | 1 | 2 | — |
| Longship | Move | 1 | — | — |
| Sailing ship | Fire Ballista, Fire Mangonel, Move | 3 | 10 | 20 |
| Warship | Fire Ballistas, Fire Mangonels, Move | 3 | 10 | 20 |
| Galley | Fire Ballistas, Fire Mangonels, Move | 3 | 20 | 40 |

Below the 1-action threshold the ship has no actions.

## Decisions

| Question | Decision |
|---|---|
| Which vehicles are ships | `isNavalVehicle(template)` (pack `naval` or environment `water`). Custom water vehicles count. |
| Initiative | Auto-rolled at combat start: d20 + Dex mod + crew quality. The roll is logged. The GM can edit a ship's initiative afterwards on its card; the order re-sorts and the current turn stays with whoever has it. (The app has no initiative drag-reorder UI, so this explicit edit is needed.) |
| Crew quality | Per-ship field, default +4, clamped to −10…+10, GM-edited on the ship card. In combat it only affects initiative. Nothing changes it automatically. |
| Action budget | Tracker with soft limits. The current-turn panel shows "Ship actions X of Y (crew/capacity)" with one button per action. A click spends the action and logs it. Buttons disable when nothing is left. Map movement and weapon attacks are **not** blocked. |
| Custom ships | Get crew quality and ship initiative. They have no action tracker unless the template has `shipActions`. |

## Data model

### `VehicleTemplate` (additive, optional)

```ts
shipActions?: {
  actions: { id: string; name: string }[]; // e.g. { id: 'move', name: 'Move' }
  crewThresholds: number[];                 // [min crew for 1 action, for 2, for 3]
};
```

### `Vehicle` (additive, optional)

```ts
crewQuality?: number; // Ships only. Missing → +4.
initiative?: number;  // Ships only: the rolled initiative total from the last combat start.
```

### `CombatState` (additive)

```ts
shipActionsUsed: Record<string, string[]>; // vehicleId → action ids spent this round
```

- Reset to `{}` everywhere `movementUsed` is reset (START_COMBAT, NEXT_ROUND, reset/new-encounter paths).
- Ships act once per round, so a per-round reset is the same as a per-turn reset.
- `LOAD_ENCOUNTER` and the auto-load path default it to `{}` for older saves.

### Built-in ship data

Each of the six templates in `navalTemplates.ts` gets `shipActions` from the table above. Action ids are `move`, `fire_ballista` and `fire_mangonel`. Names match the book's wording for that ship (e.g. galley: "Fire Ballistas"). `backfillNavalMovement` (the pre-2.9.0 backfill) is extended to also copy `shipActions` onto built-in ships whose saved template lacks it.

## Rules engine: `src/utils/shipTurn.ts`

Pure functions:

- `DEFAULT_CREW_QUALITY = 4`
- `getCrewQuality(vehicle): number` returns `vehicle.crewQuality ?? 4`, clamped to −10…10.
- `clampCrewQuality(n: number): number`
- `shipInitiativeModifier(vehicle): number` returns the Dex modifier (`floor((dex − 10) / 2)`, with dex from `template.abilityScores.dex`, default 10) plus `getCrewQuality(vehicle)`.
- `rollShipInitiative(vehicle, d20: number): { total: number; d20: number; dexMod: number; quality: number }`. The d20 roll is passed in, so this stays deterministic and testable.
- `shipActionsAvailable(template, crewAboard: number): number` returns the number of thresholds met (`crewThresholds.filter(t => crewAboard >= t).length`), or 0 when there is no `shipActions`.
- `shipActionsRemaining(available: number, used: string[]): number` returns `max(0, available − used.length)`.

Crew aboard = `countCrewAboard(vehicle.id, crewAssignments)` from `navalMovement.ts` (non-passenger assignments).

## Initiative flow

1. The `startCombat` action creator in `CombatContext.tsx` rolls d20 for every vehicle where `isNavalVehicle(vehicle.template)` is true and computes `rollShipInitiative`. It dispatches `START_COMBAT` with payload `{ shipInitiatives: Record<vehicleId, { total, d20, dexMod, quality }> }`. All randomness is in the action creator; the reducer stays pure.
2. In the `START_COMBAT` reducer:
   - Ships use `shipInitiatives[id].total` as their initiative entry. They do not fall back to driver initiative or −100.
   - The reducer stores `vehicle.initiative = total`.
   - It writes one log entry per ship, e.g. "Galley rolls initiative 14 (d20 11, Dex −3, crew quality +6)".
   - Non-ship vehicles keep the existing driver-based logic unchanged.
3. The payload is optional. `START_COMBAT` dispatched without it, as in existing tests and callers, treats ships as before.
4. New action `SET_SHIP_INITIATIVE { vehicleId, initiative }`:
   - It sets `vehicle.initiative`.
   - During combat it re-sorts `initiativeOrder` by each entry's initiative, highest first, with ties broken by name, using the same rule as `START_COMBAT`. Creatures use `creature.initiative`. Ships use `vehicle.initiative`. Other vehicles use their driver's initiative, or −100 without a driver.
   - It keeps `currentTurnIndex` pointing at the same id as before.
   - The sort lives in a pure helper, `sortInitiativeEntries`, in `shipTurn.ts`.

## UI

- **Ship card (`VehicleCard`):** a "Crew Quality" number input, shown for naval vehicles only. It sits in the stats area near Speed, with a ±1 stepper and a −10…+10 clamp, and dispatches `UPDATE_VEHICLE { crewQuality }`. The tooltip says "Adds to ship initiative (d20 + Dex + quality). Book default +4."
- **Current-turn panel (`RightPanel` `CurrentTurnInfo`):** when the current-turn vehicle has `template.shipActions`, show a "Ship actions" block:
  - The header reads "Ship actions {remaining} of {available} ({crewAboard}/{template.crewCapacity} crew)".
  - It shows one button per `shipActions.actions` entry. Clicking dispatches `USE_SHIP_ACTION { vehicleId, actionId }`, which appends to `shipActionsUsed[vehicleId]`, and `LOG_ACTION` ("{ship}: {action name}").
  - All buttons are disabled when `remaining === 0`. An action can be used more than once if the budget allows (e.g. Move twice).
  - When `available === 0`, the panel shows "No ship actions — needs {crewThresholds[0]} crew".
- **Ship initiative field:** on the ship card next to Crew Quality, shown once combat has started. It is a number input showing `vehicle.initiative` and dispatches `SET_SHIP_INITIATIVE`.
- **Initiative list:** no other change. Ships appear in the order given by their totals.

## Testing

- **`shipTurn.test.ts`:**
  - Dex modifier math, including Dex 4 → −3.
  - The crew quality default, and clamping at ±10.
  - `rollShipInitiative` with fixed d20 values.
  - `shipActionsAvailable` at, below and above every threshold for all six built-in ships.
  - `shipActionsAvailable` returns 0 for templates without `shipActions`.
  - `shipActionsRemaining` never goes below 0.
- **Data test:** each of the six ships' `shipActions` matches the table above.
- **Reducer tests:**
  - `START_COMBAT` with `shipInitiatives` orders ships by their totals and stores `vehicle.initiative`.
  - A non-naval vehicle still uses its driver's initiative, and a driverless one gets −100.
  - `USE_SHIP_ACTION` appends.
  - `NEXT_ROUND` resets `shipActionsUsed`.
  - `LOAD_ENCOUNTER` of an older save gives `shipActionsUsed: {}`.
  - `SET_SHIP_INITIATIVE` re-sorts the order and keeps the current turn on the same id.
- **Backfill test:** a pre-2.10 galley gains `shipActions`.
- **Manual:**
  - Start combat with a galley (Dex 4, quality +4) and an Avernus vehicle. Check the log line and the ordering.
  - Assign 25 crew. The panel should show "2 of 2", spend Move and Fire Mangonels, and disable the buttons.
  - Next round, the actions reset.
  - Set crew quality to 12. It clamps to 10.

## Release

v2.10.0. The help guide gets a "Ship turns" paragraph covering initiative, crew quality and the action tracker. The changelog entry covers ship initiative, crew quality and the ship-action tracker.
