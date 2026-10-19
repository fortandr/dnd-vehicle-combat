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

**Guiding principle (user direction, 2026-10-19):** ship turns should *feel* like War Machine turns. Follow the book where it is explicit. Where it is ambiguous or silent, reuse the existing War Machine behaviour and UI rather than inventing ship-only flows.

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

"Book" means the rule comes from GoS. "War Machine parity" means the book is silent and we copy existing War Machine behaviour.

| Question | Decision | Basis |
|---|---|---|
| Which vehicles are ships | `isNavalVehicle(template)` (pack `naval` or environment `water`). Custom water vehicles count. | existing helper |
| Initiative value | d20 + ship Dex mod + crew quality. | Book |
| When and how it is rolled | With the **existing sidebar "Roll Init" buttons**, before combat, exactly when the GM rolls creatures. "Roll NPC init" also rolls enemy ships, and "Roll PC init" also rolls party ships. An unrolled ship starts at 0, the same as an unrolled creature. | War Machine parity (vehicles get initiative from the same pre-combat roll; there is no auto-roll at Start Combat) |
| Editing initiative | Edit the ship's Init on its row in the sidebar **Vehicles** list (an "Init N" chip with an inline edit, like a creature row's Init) before combat. The order is fixed at Start Combat, the same as War Machines and creatures; there is no mid-combat re-sort. | War Machine parity |
| Initiative display | Where War Machines show "Driver: X (Init: N)", ships show "Driver: X" plus "Ship init: N". | War Machine parity |
| Who "decides" ship actions | The creature at the Helm, i.e. the existing driver. Nothing new is added; the turn label stays "{ship} ({driver})". | War Machine parity (the book's "captain decides" is satisfied by the GM) |
| Crew quality | A per-ship number, default +4, clamped to −10…+10. It is a stat tile on the vehicle card next to AC / Speed / DEX save, GM-edited. In combat it only affects initiative. | Book (value); War Machine parity (tile UI) |
| Action budget | Shown inside the existing current-turn panel as "Ship actions: {remaining} of {available} ({crew}/{capacity} crew)", with one chip per action. Soft limit only. | Book (counts); UI is new because War Machines have no budget, but it lives in the War Machine panel |
| How actions get spent | Automatically, from what the GM already does on a War Machine turn. **Move** is spent once the ship has moved this turn (`movementUsed > 0`). **Fire X** is spent the first time this turn any weapon covered by that action is rolled from its station row. Chips can also be clicked to toggle by hand (for things done off-app). | War Machine parity (no new buttons in the normal flow) |
| Repeating an action | Each action counts once per turn. | Ambiguous in book; the simplest consistent rule. A second Move is not modelled, and the map movement budget is speed-based as for War Machines. |
| "Fire Ballistas" (plural) | One action covers every ballista rolled that turn. Each ballista is still rolled from its own manned station, as on War Machines. | Book wording (plural action) + War Machine parity (per-station rolls) |
| Weapon needs a gunner | Unchanged: a station's weapon shows only when someone crews it, as on War Machines. | War Machine parity |
| Over budget | Never blocked. The header turns red ("1 over") if more actions were used than available. | soft limit |
| Custom ships | Get crew quality and ship initiative. They have no action chips unless the template has `shipActions`. | — |

## Data model

### `VehicleTemplate` (additive, optional)

```ts
shipActions?: {
  actions: { id: string; name: string; weaponIds?: string[] }[]; // weaponIds: station weapons this Fire action covers
  crewThresholds: number[];                                      // [min crew for 1 action, for 2, for 3]
};
```

### `Vehicle` (additive, optional)

```ts
crewQuality?: number; // Ships only. Missing → +4.
initiative?: number;  // Ships only: rolled by the sidebar Roll Init buttons; missing → 0.
```

### `CombatState` (additive)

```ts
shipActionsUsed: Record<string, string[]>; // vehicleId → Fire/manual action ids marked this round
```

- Reset to `{}` everywhere `movementUsed` is reset.
- Ships act once per round, so this is effectively per turn.
- Load paths default it to `{}`.
- Move is **derived** from `movementUsed`, not stored, unless toggled by hand.

### Built-in ship data

Each of the six templates gets `shipActions` from the table above. Action ids are `move`, `fire_ballista` and `fire_mangonel`. Names use the book's wording for that ship. `weaponIds` lists that ship's weapon ids:
- keelboat and sailing ship: `['ballista']`, `['mangonel']`
- warship: `ballista_1..2`, `mangonel_1..2`
- galley: `ballista_1..4`, `mangonel_1..2`

`backfillNavalMovement` also copies `shipActions` onto saved built-in ships that lack it.

## Rules engine: `src/utils/shipTurn.ts`

Pure functions:

- `DEFAULT_CREW_QUALITY = 4`
- `clampCrewQuality(n): number`
- `getCrewQuality(vehicle): number` returns `clamp(vehicle.crewQuality ?? 4)`.
- `shipDexMod(vehicle): number` returns `Math.floor(((template.abilityScores?.dex ?? 10) − 10) / 2)`.
- `shipInitiativeModifier(vehicle): number` returns `shipDexMod + getCrewQuality`.
- `shipActionsAvailable(template, crewAboard): number` returns the number of `crewThresholds` met, or 0 without `shipActions`.
- `actionForWeapon(template, weaponId): string | undefined` returns the Fire action id whose `weaponIds` include the weapon.
- `shipActionsUsed(vehicle, state): string[]` returns the stored ids for the vehicle, plus `'move'` when `movementUsed[vehicle.id] > 0` and the template has a `move` action. It is de-duplicated.
- `shipActionSummary(vehicle, state): { available; used: string[]; remaining; over; crewAboard }`

Crew aboard = `countCrewAboard` (non-passenger assignments), the same count used for oars.

## Initiative flow

1. **Sidebar Roll Init buttons:** `handleRollAllNpcInit` / `handleRollAllPcInit` additionally roll every naval vehicle of the matching faction (`vehicle.type === 'enemy'` for NPC, `'party'` for PC). Each sets `vehicle.initiative = d20 + shipInitiativeModifier` via `UPDATE_VEHICLE` and logs "Galley rolls initiative 14 (d20 11, Dex −3, crew +6)". The clamp-at-1 used for creatures does not apply, because the book has no floor.
2. **`START_COMBAT`:** a ship's initiative entry is `vehicle.initiative ?? 0`. Non-ships keep driver initiative, or −100 without a driver. The sort rule is unchanged.
3. **Before combat:** the ship's row in the sidebar **Vehicles** list shows "Init N" and lets the GM edit it, matching how creature rows show and edit Init.

## UI (all inside existing War Machine surfaces)

- **Vehicle card stat tiles:** ships get a "Crew" tile ("+4", with ±1 steppers, clamped) in the AC / Speed / DEX save row. Its tooltip reads: "Crew quality: adds to ship initiative (d20 + Dex + quality). Book default +4."
- **Sidebar Vehicles list:** ship rows gain an "Init N" chip (click to edit, number input, Enter/blur saves via `UPDATE_VEHICLE`), styled like a creature row's Init. War Machine rows are unchanged.
- **Current-turn panel (RightPanel), ship turn only**, directly under the existing "Driver: …" line:
  - It shows "Ship actions: {remaining} of {available} ({crew}/{capacity} crew)", in red with "· {n} over" when over budget.
  - Below that is a row of chips, one per action: Move · Fire Ballistas · Fire Mangonels. Used chips are filled with a ✓ and unused ones are outlined. Clicking a chip toggles it with `TOGGLE_SHIP_ACTION`. The Move chip toggles a manual override only when the ship hasn't moved.
  - With `available === 0` it shows "No ship actions: needs {crewThresholds[0]} crew".
- **Station rows (existing):**
  - Rolling a ship weapon's to-hit or damage via `RollableText` also marks that weapon's Fire action as used. This uses a new optional `onRoll` callback on `RollableText`, and the existing roll log entry is unchanged.
  - Collapsed station hints for ships add "· uses Fire Ballistas".
- **Logging:** marking a Fire action logs "{ship}: Fire Ballistas (1 of 3 actions)". Toggles also log. Move is not separately logged (movement already logs).

## Testing

- **`shipTurn.test.ts`:**
  - Dex mod, including galley Dex 4 → −3.
  - Crew quality default and clamping.
  - `shipActionsAvailable` at, below and above every threshold for all six ships, and 0 without `shipActions`.
  - `actionForWeapon` for each of the galley's 6 weapons.
  - `shipActionsUsed` derives `move` from `movementUsed` and de-duplicates.
  - `shipActionSummary` reports `over` when over budget.
- **Data test:** six ships' `shipActions` (names, thresholds, weaponIds) match the table and the template weapon ids.
- **Reducer tests:**
  - `START_COMBAT` uses `vehicle.initiative` for ships (and 0 when unset) and the driver for non-ships (−100 driverless).
  - `TOGGLE_SHIP_ACTION` and `MARK_SHIP_ACTION` (idempotent) work.
  - `NEXT_ROUND` resets `shipActionsUsed`.
  - `LOAD_ENCOUNTER` defaults `shipActionsUsed` for older saves.
- **Sidebar roll helper:** extract the per-ship roll into a pure `rollShipInitiative(vehicle, d20)` in `shipTurn.ts`, and test it with fixed d20 values.
- **Backfill test:** a pre-2.10 galley gains `shipActions`.
- **Manual (browser):**
  - Roll NPC init with an enemy galley and an enemy war machine on the map. The galley gets d20 −3 +4, logged; the war machine uses its driver's.
  - Start combat.
  - On the galley's turn with 25 crew: drag the galley, and Move ✓ appears. Roll Ballista 1's to-hit, and Fire Ballistas ✓ appears. Roll Ballista 2, and there is no extra spend. The header reads "0 of 2".
  - Roll a Mangonel. The header turns red with "1 over".
  - Next round, all chips are cleared.

## Release

v2.10.0. The help guide gets a "Ship turns" paragraph covering how ships roll initiative with the same Roll Init buttons, crew quality, and the action chips filling in as you move and fire. The changelog entry covers ship initiative, crew quality and the ship-action tracker.
