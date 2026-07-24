# Naval Mechanics — Ghosts of Saltmarsh (Appendix A)

Transcribed from *Ghosts of Saltmarsh*, Appendix A: "Of Ships and the Sea," for building
the VVTT naval starter set. Source is a reference for mechanics/stats only.

## The component model (key difference from Avernus vehicles)

A Saltmarsh ship is **not** a single-HP vehicle. It is a set of **components**, each with its
own AC / HP / (damage threshold):

- **Hull** — the frame. If the hull hits 0 HP, the whole ship is **wrecked**.
- **Control** — the helm. If destroyed, the ship can't turn.
- **Movement** — sails and/or oars. Each has a **speed** that *degrades as it takes damage*
  (e.g. "−5 ft. speed per 25 damage"). Sails also have wind-dependent speed.
- **Weapon(s)** — each siege weapon is a component, operated separately.

Other shared rules:
- Ability scores: STR/DEX/CON only; INT/WIS/CHA = 0 (auto-fail those checks/saves).
- Damage immunities: poison, psychic. Condition immunities: blinded, charmed, deafened,
  exhaustion, frightened, incapacitated, paralyzed, petrified, poisoned, prone, stunned,
  unconscious (rowboat omits "prone").
- **Damage threshold**: a component ignores any hit that doesn't meet its threshold.
- Ships act only through crew. Number of **actions per turn scales with crew count**
  (see each ship). Actions are things like *Fire Ballista* and *Move*.

## Ship stat blocks

Format per component: **AC / HP** (DT = damage threshold; speed-loss where noted).

### Rowboat — Large (10×5 ft.)
- Capacity: 2 crew, 2 passengers · Cargo 0.25 tons · Pace 3 mph (24/day)
- STR 11 (+0), DEX 8 (−1), CON 11 (+0)
- Actions: Move only (needs ≥1 crew)
- **Hull**: AC 11, HP 50
- **Control & Movement — Oars**: AC 12, HP 25, Speed 15 ft. (no oars → speed 0)

### Keelboat — Gargantuan (60×20 ft.)
- Capacity: 3 crew, 4 passengers · Cargo 0.5 tons · Pace 3 mph (72/day)
- STR 16 (+3), DEX 7 (−2), CON 13 (+1)
- Actions: 2 (1 if only one crew)
- **Hull**: AC 15, HP 100 (DT 10)
- **Control — Helm**: AC 12, HP 50
- **Movement — Oars**: AC 12, HP 100 (−5 ft./25 dmg), Speed 20 ft.
- **Movement — Sails**: AC 12, HP 100 (−5 ft./20 dmg), Speed 25 ft. (15 into wind, 35 with wind)
- **Weapon — Ballista**: AC 15, HP 50 (combat-equipped only)

### Longship — Gargantuan (70×20 ft.)
- Capacity: 40 crew, 100 passengers · Cargo 10 tons · Pace 5 mph (120/day)
- STR 20 (+5), DEX 6 (−2), CON 17 (+3)
- Actions: Move only
- **Hull**: AC 15, HP 300 (DT 15)
- **Control — Helm**: AC 16, HP 50
- **Movement — Oars**: AC 12, HP 100 (−5 ft./25 dmg), Speed 20 ft. (needs ≥20 crew)
- **Movement — Sails**: AC 12, HP 100 (−10 ft./25 dmg), Speed 45 ft. (15 into wind, 60 with wind)

### Sailing Ship — Gargantuan (100×20 ft.)
- Capacity: 30 crew, 20 passengers · Cargo 100 tons · Pace 5 mph (120/day)
- STR 20 (+5), DEX 7 (−2), CON 17 (+3)
- Actions: 3 (2 if <20 crew, 1 if <10, none if <3)
- **Hull**: AC 15, HP 300 (DT 15)
- **Control — Helm**: AC 18, HP 50
- **Movement — Sails**: AC 12, HP 100 (−5 ft./25 dmg), Speed 45 ft. (15 into wind, 60 with wind)
- **Weapon — Ballista**: AC 15, HP 50
- **Weapon — Mangonel**: AC 15, HP 100

### Warship — Gargantuan (100×20 ft.)
- Capacity: 40 crew, 60 passengers · Cargo 200 tons · Pace 4 mph (96/day)
- STR 20 (+5), DEX 4 (−3), CON 20 (+5)
- Actions: 3 (2 if <20 crew, 1 if <10, none if <3)
- **Hull**: AC 15, HP 500 (DT 20)
- **Control — Helm**: AC 18, HP 50
- **Movement — Oars**: AC 12, HP 100 (−5 ft./25 dmg), Speed 20 ft. (needs ≥20 crew)
- **Movement — Sails**: AC 12, HP 100 (−10 ft./25 dmg), Speed 35 ft. (15 into wind, 50 with wind)
- **Weapons — Ballistas (2)**: AC 15, HP 50 each
- **Weapons — Mangonels (2)**: AC 15, HP 100 each
- **Naval Ram**: AC 20, HP 100 (DT 10)

### Galley — Gargantuan (130×20 ft.)
- Capacity: 80 crew, 40 passengers · Cargo 150 tons · Pace 4 mph (96/day)
- STR 24 (+7), DEX 4 (−3), CON 20 (+5)
- Actions: 3 (2 if <40 crew, 1 if <20, none if <3)
- **Hull**: AC 15, HP 500 (DT 20)
- **Control — Helm**: AC 16, HP 50
- **Movement — Oars**: AC 12, HP 100 (−5 ft./25 dmg), Speed 30 ft. (needs ≥40 crew)
- **Movement — Sails**: AC 12, HP 100 (−10 ft./25 dmg), Speed 35 ft. (15 into wind, 50 with wind)
- **Weapons — Ballistas (4)**: AC 15, HP 50 each
- **Weapons — Mangonels (2)**: AC 15, HP 100 each
- **Naval Ram**: AC 20, HP 100 (DT 10)

## Siege weapons (shared stats)

| Weapon | AC | HP | Attack | Range | Damage |
|---|---|---|---|---|---|
| **Ballista** | 15 | 50 | +6 to hit | 120/480 ft. | 16 (3d10) piercing |
| **Mangonel** | 15 | 100 | +5 to hit | 200/800 ft. (can't hit within 60 ft.) | 27 (5d10) bludgeoning |
| **Naval Ram** | 20 | 100 (DT 10) | — | on crash | Ship gets advantage on crash saves; crash damage applies to the ram, not the ship |

(Full descriptions are in DMG ch. 8 "Siege Equipment"; Saltmarsh references them by name.)

## Naval hazards (≈ the Avernus "chase complications" analog)
Roll d20 for **Hazard Type** and d20 for **Hazard DC** each day/encounter. Types include
**Fog**, **Storm**, crew-illness/plague, and combat hazards. Officers roll to contribute;
outcomes have four success/failure tiers. Full tables not transcribed here — flag for the
naval ruleset pack.

## Repairs
A component (other than a destroyed hull) at >0 HP can be repaired: a **Strength check with
carpenter's tools**, restoring HP equal to **1d6 + crew's quality score** (min 1).

## Superior Ship Upgrades (≈ the Avernus "gadgets/armor" analog)
Optional per-component upgrades (15,000 gp, 1d4 weeks in port). Examples: **Churning Hull**
(surrounds ship with difficult terrain), **Death Vessel** (fear-pulse aura). Categorized by
component (hull / movement / control / weapon). Flag for the naval pack; not core to MVP.

## Mapping to the VVTT data model — decision needed

The current `VehicleTemplate` (`src/types/index.ts`) is **single-HP**: one `maxHp`, `ac`,
`damageThreshold`, `speed`; `VehicleZone` has capacity/cover/arcs but **no HP**. Saltmarsh
ships need **per-component HP**. Two paths:

- **A — Simplified mapping (MVP now):** model each ship as a single vehicle:
  `maxHp/ac/damageThreshold` = the **hull's**; `speed` = primary movement speed; helm / oars /
  sails / weapon stations become **zones** (crew stations, using existing cover/arc fields);
  siege weapons map cleanly to the existing `WeaponTemplate`/`VehicleWeapon` shape. Component
  HPs preserved in the description text. **Playable in today's engine, no schema change.**
- **B — Faithful component model (naval pack, later):** add optional
  `components?: ShipComponent[]` (each with `ac`, `hp`, `damageThreshold?`, `speedLossPer?`,
  `windSpeeds?`) to `VehicleTemplate`, plus engine support for targeting/destroying components
  and hull-destroyed = wrecked. Additive/optional, so existing encounters are unaffected.

Recommendation: ship the six ships via **A** as a built-in naval starter set to prove "beyond
Avernus," and schedule **B** as the naval-pack milestone (it's what makes ship combat feel
truly different from infernal war machines).

> **Decision (2026-07-24):** going with **B (faithful component model)**. The schema
> (`VehicleComponent`, `components[]`, `environment`) and the template editor shipped in
> v2.0.0. Remaining for the naval pack: (1) combat-engine support for targeting/destroying
> individual components (hull destroyed = wrecked), (2) the six Saltmarsh ships as built-in
> templates, (3) naval hazard/repair/upgrade systems, and (4) **new token icons for each ship
> type** (rowboat, keelboat, longship, sailing ship, warship, galley) for the battlefield map.
