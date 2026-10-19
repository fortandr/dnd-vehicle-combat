# Naval Movement & Wind — Design

**Date:** 2026-10-19
**Status:** Approved design, pending spec review
**Target release:** v2.9.0
**Part of:** Naval combat engine (piece 1 of 4: movement & wind → crew-driven ship turns → officers → ramming & crashing)

## Goal

Make Saltmarsh ship movement follow *Ghosts of Saltmarsh* Appendix A during a combat/chase encounter:

1. Sails move at different speeds with, into, or across the wind.
2. Movement components lose speed as they take damage.
3. Oars stop working when the ship has too few crew to row.

Out of scope: voyage/travel mechanics (naval hazards, daily pace), crew-scaled ship actions, initiative, officers, ramming. Avernus war machines and other land vehicles must behave exactly as today.

## Current state

- `VehicleComponent` (`src/types/index.ts`) has `speed` and `crewRequired`, but no wind speeds or damage-based speed loss. Wind speeds exist only in the sail `description` text (`src/data/navalTemplates.ts`, `sails()` helper).
- `getPropulsionSpeedCap` (`src/utils/vehicleComponents.ts`) caps speed at the best *surviving* movement component's base speed.
- There are two divergent `getEffectiveSpeed` implementations:
  - `BattlefieldMap.tsx:312`: starts from `vehicle.currentSpeed`, subtracts mishaps, applies the propulsion cap.
  - `CombatContext.tsx:2256`: starts from `template.speed`, subtracts mishaps, applies `speedModifiers` multipliers, and does **not** apply the propulsion cap.
- Vehicles have `facing` (degrees, 0 = north, clockwise).
- `CombatState.environment: Environment` already exists, with a `SET_ENVIRONMENT` partial-merge action.
- Crew are creatures assigned to vehicle zones. Ship templates have a bulk `deck_crew` zone and a `passengers` zone.

## Decisions

| Question | Decision |
|---|---|
| Wind control | The GM sets wind per encounter (Calm or one of 8 compass points) and can change it at any time. No automatic random shifts. |
| Heading vs wind | 90° cones. A heading within 45° of downwind uses the with-wind speed; within 45° of upwind uses the into-wind speed; anything else uses base speed. An angle of exactly 45° counts as **base**. |
| Mid-turn heading change | Live. Remaining movement = speed at the current heading − distance already moved this round, minimum 0. |
| Oar crew minimum | Enforced in this piece. Below `crewRequired`, oars have speed 0. This also changes existing saved encounters that have few crew assigned. The GM accepted that behaviour change. Encounters saved before 2.9.0 are backfilled on load for built-in ships (matched by template id); personal-library copies of ships made before 2.9.0 must be re-saved with the new editor fields. |
| Architecture | Compute speed on demand from stored state with pure functions. No reducer-maintained derived modifiers. |

## Data model

### `VehicleComponent` (additive, optional)

```ts
windSpeeds?: { with: number; into: number }; // Sails only. Base `speed` = crosswind / no wind.
speedLoss?: { feet: number; perDamage: number }; // e.g. { feet: 5, perDamage: 25 }
// existing: crewRequired?: number — now enforced for 'movement' components
```

### `Environment` (additive, optional)

```ts
wind?: CompassPoint; // Direction the wind blows FROM. Unset = calm.
```

`CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'`, which maps to 0, 45, … 315 degrees.

Putting wind on `Environment` means no new action (it uses `SET_ENVIRONMENT`) and no migration: older saves have no `wind`, so they load as calm. To set calm, dispatch `SET_ENVIRONMENT` with `{ wind: undefined }`.

### Built-in ship data (`navalTemplates.ts`)

| Ship | Oars (speed, loss, crew) | Sails (base / into / with, loss) |
|---|---|---|
| Rowboat | 15, none, — | — |
| Keelboat | 20, −5/25, — | 25 / 15 / 35, −5/20 |
| Longship | 20, −5/25, 20 | 45 / 15 / 60, −10/25 |
| Sailing ship | — | 45 / 15 / 60, −5/25 |
| Warship | 20, −5/25, 20 | 35 / 15 / 50, −10/25 |
| Galley | 30, −5/25, 40 | 35 / 15 / 50, −10/25 |

The `sails()` and `oars()` helpers take these as parameters. The wind and crew notes move out of `description` and into the new fields.

## Rules engine: `src/utils/navalMovement.ts`

Pure functions with no React or context imports:

- `windSpeedBand(facingDeg, wind): 'with' | 'into' | 'cross' | 'calm'`
  - Downwind bearing = wind-from bearing + 180.
  - The smallest angular difference between the facing and the downwind bearing (wrap-safe, 0–180) is d.
  - d < 45 → `with`; d > 135 → `into`; otherwise → `cross`. No wind → `calm`.
- `componentSpeed(vehicle, component, wind, crewAboard): { speed: number; reason: SpeedReason[] }` for a single movement component:
  1. If the component is destroyed → 0.
  2. Base speed = the wind-band speed when the component has `windSpeeds`; otherwise `speed`.
  3. Subtract `floor((maxHp − currentHp) / perDamage) × feet` when `speedLoss` is set.
  4. Speed is 0 when `crewRequired` is set and `crewAboard < crewRequired`.
  5. Clamp the result to ≥ 0.
- `getPropulsionSpeed(vehicle, wind, crewAboard): { speed: number; source?: componentId; reasons: SpeedReason[] }`
  - Returns the best component speed.
  - Returns `Infinity` with no reasons when the vehicle has no movement components (land vehicles).
- `countCrewAboard(vehicleId, crewAssignments)`: the number of creatures assigned to the vehicle's zones, excluding the `passengers` zone.

`SpeedReason` is a small tagged union (`with_wind`, `into_wind`, `damage_loss { feet }`, `undermanned { have, need }`, `destroyed`) that the UI turns into labels.

`getPropulsionSpeedCap` in `vehicleComponents.ts` is replaced by `getPropulsionSpeed`. Its callers are updated.

## Single effective-speed function

There will be one `getEffectiveSpeed(vehicle, state)` in a shared util (alongside `navalMovement.ts`, or in `vehicleComponents.ts`). It replaces both current copies. Order:

1. **Base speed:**
   - Vehicles with movement components (ships): the propulsion speed (which includes wind, damage and crew). `currentSpeed` is ignored. This replaces an earlier "cap" wording that would have stopped a with-wind speed (60) from ever exceeding the stored 45.
   - All other vehicles: `vehicle.currentSpeed`, as today.
2. Subtract mishap `speedReduction`s.
3. Apply `speedModifiers` multipliers (so "half speed" halves the wind-adjusted speed).
4. Clamp to ≥ 0.

The breakdown also reports a **nominal** speed: for ships, the best calm, undamaged movement-component speed; for other vehicles, `currentSpeed`. The UI highlights when effective ≠ nominal.

All five existing copies (`BattlefieldMap`, `CombatContext`, `VehicleCard`, `VehicleStatsPanel`, `RightPanel`) switch to the shared function. Land vehicles change only by gaining `speedModifiers` multipliers where a copy lacked them. On ship cards, the editable Speed field becomes a read-only display of effective speed plus the reason; land vehicles keep the editable field.

Remaining movement stays as `movementPerRound(effectiveSpeed) − movementUsed`, clamped at 0. Because the speed is computed live, a mid-turn heading change takes effect immediately.

## UI

- **Wind control (DM):** a compact selector in the battlefield map toolbar with Calm and the 8 points. It is shown only when the encounter has at least one vehicle with a sail component that has `windSpeeds`. On change it dispatches `SET_ENVIRONMENT { wind }` and `LOG_ACTION` ("Wind now from the NE" / "Wind falls calm").
- **Wind indicator:** an arrow in a map corner on the DM map and the player view, pointing the direction the wind blows, labelled "Wind from NE". It is hidden when calm or when no sailing ships are present. `PlayerViewMap` receives `environment.wind` through the existing BroadcastChannel sync; the implementation must confirm it is included in the broadcast payload.
- **Speed reason:** wherever a ship's movement or speed is shown (token movement readout, VehicleCard), append the main reason, e.g. "60 ft · with wind", "15 ft · into wind", "Sails −20 ft (damage)".
- **Undermanned badge:** "Oars undermanned (12/40)" on the VehicleCard when it applies.
- **Components panel:** each movement row shows its current speed next to HP.
- **Template editor:** on movement components, optional inputs for with-wind speed, into-wind speed, speed loss (ft per X damage) and crew required.

## Testing

- **Unit tests, `navalMovement.test.ts`:**
  - Wind bands: dead downwind / upwind / abeam; exactly 45° and 135° count as cross; wrap-around (facing 350° vs wind-from S); calm.
  - Damage loss: 0, 24, 25, 60 damage; loss can't push speed below 0.
  - Crew: below, at and above `crewRequired`; passengers excluded from the count.
  - Best-of across oars and sails, including sails into the wind with oars working (oars win).
  - A destroyed component contributes 0. All movement destroyed → 0.
  - No movement components → `Infinity` (land vehicles unaffected).
- **Effective speed:** one test that an Avernus war machine's effective speed matches the pre-change value for the mishap + modifier combinations the app produces.
- **Reducer:** `SET_ENVIRONMENT { wind }` round-trips, and `LOAD_ENCOUNTER` of a save without `wind` results in calm.
- **Manual:** a sailing ship rotated through downwind / beam / upwind; a damaged warship's sails; a galley with 12 crew (oars undermanned, sails still work); an Avernus vehicle unchanged. Preview per the repo's sandbox note (the build is slow; use a static preview where possible).

## Release

v2.9.0. Help guide gets a "Wind & ship speed" section. The changelog entry covers wind, speed loss, oar crew, and the unified effective-speed calculation.
