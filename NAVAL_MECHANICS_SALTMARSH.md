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

Sea travel hazards are resolved with a **group check** by the ship's officers + crew. Each
hazard names which officers roll and what ability check; the crew rolls one d20 + its quality
score. Outcomes have **four tiers**: Total Success (every roll succeeded), Success, Failure,
Total Failure (every roll failed).

**Determining a hazard:** at the start of each day of an ocean voyage, roll d20 — on a **20**, a
hazard occurs. Then roll type and DC:

| d20 | Hazard Type | | d20 | Hazard DC |
|---|---|---|---|---|
| 1–3 | Crew conflict | | 1–9 | 10 |
| 4–6 | Fire | | 10–17 | 15 |
| 7–9 | Fog | | 18–19 | 20 |
| 10–12 | Infestation | | 20 | 25 |
| 13–20 | Storm | | | |

### Crew Conflict — Captain (Cha/Intimidation), First Mate (Cha/Intimidation), Cook (Int/brewer's supplies)
DCs: 10 minor scuffle/theft · 15 brawl/valuable theft · 20 large brawl+injuries · 25 murder/serious brawl.
- **Total Success:** crew quality +1 for 1d4 days, hazard ends.
- **Success:** hazard ends.
- **Failure:** crew quality −1.
- **Total Failure:** crew quality −1 **and the crew mutinies**.

### Fire — Captain (Int/water vehicles), First Mate (Cha/Intimidation), Bosun (Str/carpenter's tools), Surgeon (Int/Medicine)
Group check = 5 minutes of work. DCs: 10 lantern-size · 15 campfire · 20 bonfire · 25 flammable-hold blaze.
- **Total Success:** extinguished, cosmetic damage only.
- **Success:** extinguished, but the hull + 1d3 random components take **6d6 fire**.
- **Failure:** hull + 1d3 components take **6d6 fire**, fire continues (re-check).
- **Total Failure:** crew quality −1; hull + 1d3 components take **6d6 fire**; fire continues (re-check).

### Fog — Captain (Int/water vehicles), Quartermaster (Wis/Nature)
DCs: 10 light · 15 moderate · 20 heavy · 25 very heavy.
- **Total Success:** no effect; crew quality +1 for 1d3 days.
- **Success:** no effect.
- **Failure:** travel pace & speed **halved** for the day.
- **Total Failure:** half speed **and moves in a random direction**.

### Infestation — Captain (Int/water vehicles), First Mate (Cha/Persuasion), Surgeon (Int/Medicine), Cook (Con/cook's utensils)
DCs: 10 minor bug/rat, cold · 15 persistent, flu · 20 serious, contagious/spoiled food · 25 lethal plague.
- **Total Success:** crew quality +1 for 1d4 days, hazard ends.
- **Success:** hazard ends.
- **Failure:** crew quality −1.
- **Total Failure:** crew quality −1; ship at **half speed** that day.

### Storm — Captain (Int/water vehicles), First Mate (Cha/Intimidation), Bosun (Str/carpenter's tools), Quartermaster (Wis/Nature)
DCs: 10 heavy gale · 15 strong storm · 20 typical hurricane · 25 overwhelming hurricane.
- **Total Success:** unscathed; crew quality +1 for 1d4 days.
- **Success:** unscathed.
- **Failure:** **every component takes 4d10 bludgeoning**; crew quality −1; half speed that day.
- **Total Failure:** **every component takes 10d10 bludgeoning**; crew quality −2; 10% of crew washed
  overboard and lost; blown off course (random direction).

### Crew quality score
Starts at **+4**, ranges **−10 to +10**. Modifies the crew's d20 roll in every group check and their
passive Perception (10 + quality). Rises with good morale/health/leadership and shore leave (+1/day
in port if ≤3); falls with casualties, hardship, and failed hazards.

## Repairs
At the end of the day the **bosun** makes a **Strength check with carpenter's tools**. On a **15+**,
each damaged component regains HP equal to **1d6 + crew quality** (min 1). A non-hull component that
was at 0 HP becomes functional again.

## Superior Ship Upgrades (≈ the Avernus "gadgets/armor" analog) — IMPLEMENTED (v2.2.0)
Optional upgrades (15,000 gp, 1d4 weeks in port), grouped by the component they enhance.
Shipped as the **Naval customization pack** in `src/data/navalUpgrades.ts`, installed per ship
(`Vehicle.navalUpgradeIds`) and shown only on naval vehicles via the "Ship Upgrades" accordion.
- **Hull:** Churning Hull, Death Vessel, Frost-Locked Hull, Living Vessel, Reinforced Hull, Vigilant Watch
- **Movement:** Clockwork Oars, Ever-Full Sails, Defiant Sails, Dragon Sails, Screaming Sails, Scything Oars
- **Weapon:** Arcane Artillery, Concussive Rounds, Explosive Rounds, Grasping Rounds
- **Figurehead:** Guardian, Red Dragon, Storm Giant
- **Miscellaneous:** Bones of Endless Toil, Smuggler's Banner, Taskmaster's Drums

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
