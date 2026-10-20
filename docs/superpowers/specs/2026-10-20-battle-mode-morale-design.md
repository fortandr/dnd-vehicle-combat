# Battle Mode: Morale, Commanders and DMG Edition — Design

**Date:** 2026-10-20
**Status:** Approved design, pending spec review
**Target release:** v2.12.0
**Part of:** Battle mode (squads → **morale & commanders** → player-commanded squads → map templates / squads on war machines)
**Builds on:** v2.11.0 squads (`Creature.squad`, `src/utils/squad.ts`, `SQUAD_HITS` / `SQUAD_AREA`)

## Goal

Big fights should end the way the DMG suggests they can: troops break and run when their leader falls or their ranks are halved, and lone monsters flee when badly hurt. The app spots the moment, puts a morale check in front of the GM, and the GM decides with one click. In the Arkhan's-tower fight, if Karkajuk drops, every hobgoblin squad he leads gets a morale check, and the players see the squads that fail start to run.

User choices (2026-10-20):
- A commander is a **morale leader only**: book-only, with no invented bonuses.
- The app **prompts and the GM rolls**. Nothing rolls on its own, and every prompt can be dismissed.
- Morale covers **squads and single monsters** (never PCs).
- Battle mode gets a **per-encounter DMG edition setting (2014 / 2024)**, because the two DMGs differ (see "DMG edition" below).

Out of scope:
- Commander bonuses or auras.
- Applying a commander's statblock features (e.g. Leadership) automatically.
- Moving fleeing tokens automatically.
- Detecting surprise automatically, or detecting "no way to harm the other side".
- Player-commanded squads. These are slice 3.

Creatures and vehicles with no morale involvement must behave exactly as they do today.

## Rules basis (DMG 2014 p. 273, "Morale", optional rule; verified on 5e.tools 2026-10-20)

The 2024 DMG has no morale rule; its only flight guidance is the "Hide/Flee" monster-behaviour option for adventure design. Morale is therefore always cited as **DMG 2014 optional rule**, whatever the edition setting. No other official book or adventure (including Descent into Avernus and Ghosts of Saltmarsh) has mass-combat or morale mechanics. Avernus's "Infernal Order of Battle" (DiA p. 76) is lore only.

A **creature** might flee when:
- it is surprised;
- it is reduced to half its hit points or fewer for the first time in the battle;
- it has no way to harm the opposing side on its turn.

A **group** might flee when:
- all its creatures are surprised;
- its leader is reduced to 0 hit points, incapacitated, taken prisoner, or removed from battle;
- it is reduced to half its original size with no losses on the opposing side.

**The check:** the creature, or the group's leader, makes a DC 10 Wisdom saving throw.
- If the opposition is overwhelming, the save has disadvantage, or the GM may decide it fails automatically.
- If the leader can't make the save, the creature in the group with the next-highest Charisma makes it instead.

**On a failure:** the creature or group flees by the most expeditious route. If escape is impossible, it surrenders.

## Decisions

| # | Decision | Basis |
|---|---|---|
| 1 | A squad's leader is any creature on the field, linked through `squad.leaderId`. One leader can lead many squads. | Book (group leader); link is VVTT plumbing |
| 2 | The app raises a prompt automatically for these triggers: leader reduced to 0 HP; leader gains an incapacitating condition (incapacitated, paralyzed, petrified, stunned, unconscious); leader removed from the encounter; squad first at ≤ half its starting bodies; single non-PC creature first at ≤ half its max HP. | Book triggers |
| 3 | Surprise, "taken prisoner", "no way to harm" and any other judgement call go through a manual **Morale** button. | Book (needs GM judgement) |
| 4 | The half-size prompt carries the reminder "DMG: only if the other side has had no losses", and the GM dismisses it if that doesn't hold. | Book |
| 5 | Each automatic trigger prompts at most once per creature per battle. Reset Combat clears this record. | VVTT rule (prevents nagging; the book says "for the first time" only for the creature HP trigger) |
| 6 | Who saves for a squad: its leader if the leader is standing (HP > 0 and not incapacitated); otherwise the squad's own statblock. | Book: all bodies share a statblock, so the "next-highest Charisma" creature uses the squad's own statblock. Labelled VVTT rule for clarity |
| 7 | Prompt options: **Roll** (d20 + WIS save, with or without disadvantage), **Fails automatically**, or **Dismiss**. The GM sets the disadvantage toggle ("overwhelming opposition"). | Book |
| 8 | A failed save marks the creature **Fleeing**. The GM can switch it to **Surrendered** or clear it. The app doesn't move tokens. | Book outcome; movement is the GM's |
| 9 | Fleeing and surrendered creatures stay in initiative. On their turn the panel says what they do, and a squad's attack block is hidden. | VVTT rule (presentation only) |
| 10 | No prompts for PCs, nothing outside the combat phase, no prompts for creatures already at 0 HP or 0 bodies, and none for creatures already Fleeing or Surrendered. | Book scope + common sense |

## DMG edition (per encounter)

The squads release (v2.11.0) used the **2014** "Targets in Areas of Effect" formula (DMG 2014 p. 249). The **2024** DMG ("Mobs", p. 82) replaces it with a lookup table that catches more creatures. It also says to remove 1d3 if the creatures are spread out or add 1d3 if they are bunched up, never to exceed the creatures present, and that it is fine to err toward catching more.

Verified 2024 table (DMG 2024 p. 82, "Targets in Area of Effect"):

| Targets | Cone | Cube | Circular (radius) | Line (length × width) |
|---|---|---|---|---|
| 1 | 10 ft | 5–10 ft | 5 ft | — |
| 2 | 15–20 ft | 15 ft | — | 30 × 5 |
| 3 | 25 ft | — | 10 ft | 30 × 10, 60 × 5 |
| 4 | — | 20 ft | — | 90–100 × 5 |
| 5 | 30 ft | — | — | 60 × 10, 120 × 5 |
| 6 | 35 ft | 25 ft | 15 ft | — |
| 8 | 40 ft | 30 ft | — | 90–100 × 10 |
| 9 | 45 ft | — | — | — |
| 10 | 50 ft | 35 ft | 20 ft | 120 × 10 |
| 12 | 55 ft | 40 ft | — | — |
| 16 | 60 ft | 45 ft | 25 ft | — |
| 20 | — | 50 ft | 30 ft | — |

Decisions:

| # | Decision | Basis |
|---|---|---|
| E1 | `CombatState.dmgEdition?: '2014' \| '2024'`; a missing value means `'2014'`, so v2.11.0 behaviour and older saves are unchanged. It is saved with the encounter. | User choice |
| E2 | The edition only changes the area-count suggestion and the citations. Squad attacks, damage, saves and morale are the same under both. Morale is cited as "DMG 2014 optional rule (no 2024 equivalent)" when 2024 is selected. | Book (neither DMG changes the rest) |
| E3 | 2024 lookup: Cylinder and Sphere use the Circular column (by radius). For a size between rows, use the largest listed size at or below it; below the smallest, use 1; above the largest, use the top value. | VVTT rule (interpolation) |
| E4 | 2024 lines: the Line shape gains a **Width** field (default 5 ft). Width 5 or less uses the 5-ft-wide entries and width 10 or more the 10-ft-wide entries; length is matched the same way as E3. The 5-ft column starts at 30 ft (2); a shorter 5-ft line gives 1. | VVTT rule (interpolation) |
| E5 | The suggestion is still capped at the bodies left, and the GM can still change it. The helper text gives the edition's own advice: 2014 "add or remove for how bunched up they are"; 2024 "−1d3 if spread out, +1d3 if bunched up". | Book |
| E6 | The setting lives in the Area dialog as a **DMG 2014 / 2024** toggle, because that is where it matters. Changing it there updates the encounter, so the next Area dialog remembers it. | VVTT UI choice |

## Data model (all optional and additive; no backfill needed)

```ts
// Creature
squad?: { size: number; bodies: number; leaderId?: string };
morale?: {
  status?: 'fleeing' | 'surrendered';
  asked: MoraleTrigger[];        // automatic triggers already prompted this battle
};

type MoraleTrigger = 'leader-down' | 'half-size' | 'half-hp';

// CombatState
moralePrompts: MoralePrompt[];   // open checks, oldest first; older saves load as []

dmgEdition?: '2014' | '2024';  // CombatState; undefined = '2014'

interface MoralePrompt {
  id: string;
  creatureId: string;            // the squad or creature that may flee
  trigger: MoraleTrigger | 'manual';
  leaderName?: string;           // for leader-down text, kept in case the leader was removed
}
```

## Rules engine: `src/utils/morale.ts` (pure)

- `INCAPACITATING: ConditionName[]` is incapacitated, paralyzed, petrified, stunned and unconscious.
- `isLeaderDown(leader: Creature | undefined): boolean` is true when the leader is missing, at 0 HP or has an incapacitating condition.
- `detectMoraleTriggers(prev: CombatState, next: CombatState, newId: () => string): { creatures: Creature[]; prompts: MoralePrompt[] }`
  - It returns `next.creatures` with the `asked` arrays updated, plus the new prompts.
  - It runs only when `next.phase === 'combat'`.
  - **Leader down:** for each squad in `next` with a `leaderId` whose leader was standing in `prev` but is down in `next` (missing counts as down), the squad is prompted `leader-down`.
  - **Half size:** the squad's `bodies` went from `> size / 2` in `prev` to `≤ size / 2` (and > 0) in `next`.
  - **Half HP:** a non-PC creature without a squad went from `> maxHp / 2` to `≤ maxHp / 2` (and > 0).
  - Every rule skips creatures that already list that trigger in `asked`, that are Fleeing or Surrendered, or that are dead (HP 0 / 0 bodies).
- `moraleSaver(creature: Creature, creatures: Creature[]): { saver: Creature; bonus: number; usingLeader: boolean }` implements decision 6. The bonus comes from `saveBonus(statblock, 'wis')` in `squad.ts`.
- `rollMorale({ bonus, disadvantage, roll }): { d20s: number[]; d20: number; total: number; success: boolean }` rolls against DC 10. With disadvantage it rolls twice and keeps the lower. Success means total ≥ 10.
- `formatMoraleLog(...)` produces e.g. "Hobgoblin ×10 (A) — morale (Karkajuk down): Karkajuk WIS 3 + 4 = 7 vs DC 10 → flees" / "→ holds" / "→ fails automatically (overwhelming opposition)".

## Area table by edition (`src/utils/squad.ts`)

- `aoeTargetCount(shape, size, edition = '2014', width = 5)` keeps today's 2014 formula as the default and adds the 2024 lookup (E3, E4). Existing callers and tests stay valid.
- `aoeAdvice(edition)` returns the helper text (E5) and the citation ("DMG 2014 p. 249" / "DMG 2024 p. 82").

## Reducer (`src/context/CombatContext.tsx`)

- The existing reducer body is renamed `baseCombatReducer`, and `combatReducer` becomes `(state, action) => applyMoraleDetection(state, baseCombatReducer(state, action))`.
  - `applyMoraleDetection` calls `detectMoraleTriggers` and appends its prompts.
  - Prompt ids come from `uuid()`, matching the existing `createLogEntry` pattern; tests check content, not ids.
  - It is a no-op whenever there is nothing to report, so other actions return the same state object they do today.
- New actions:
  - `REQUEST_MORALE { creatureId }` adds a `manual` prompt, unless an open prompt already exists for that creature.
  - `RESOLVE_MORALE { promptId; fled: boolean; log: string; details?: string }` removes the prompt and logs `log`. When `fled`, it sets `morale.status = 'fleeing'`.
  - `DISMISS_MORALE { promptId }` removes the prompt without logging.
  - `SET_MORALE_STATUS { creatureId; status?: 'fleeing' | 'surrendered' }` sets or clears the status and logs the change.
- `RESET_COMBAT` clears every creature's `morale` and empties `moralePrompts`. `REMOVE_CREATURE` drops prompts for the removed creature; a leader's removal still triggers its squads through detection.
- `LOAD_ENCOUNTER` and the autosave load default `moralePrompts` to `[]`. A missing `dmgEdition` stays undefined, which reads as 2014.
- `SET_DMG_EDITION { edition }` sets `dmgEdition`. It is a setting, so `RESET_COMBAT` keeps it.

## UI

- **Morale cards** (`src/components/morale/MoralePromptCard.tsx`) stack at the top of the right panel, above the current-turn info, whenever `moralePrompts` isn't empty.
  - Each card shows the trigger in words ("Karkajuk is down", "Down to half strength (5/10)", "Below half HP", "Morale check"), who saves and their bonus ("Karkajuk saves for the squad: WIS +4" / "No leader standing: the squad saves, WIS +0") and "DC 10".
  - It has a **Disadvantage (overwhelming opposition)** switch and the buttons **Roll**, **Fails automatically** and **Dismiss**.
  - The half-size card adds the DMG reminder (decision 4).
  - After Roll or Fails automatically, the card shows the result line and the outcome, then closes itself through `RESOLVE_MORALE`. The line is also in the log.
- **Squad edit form (Sidebar):** a **Leader** select listing living creatures of the same faction, plus "(none)". It saves `squad.leaderId`.
- **Rows (Sidebar `CreatureEntry`) for non-PCs:**
  - a small **Morale** button sends `REQUEST_MORALE`;
  - when a status is set, a **Fleeing** / **Surrendered** chip appears; clicking it cycles Fleeing → Surrendered → cleared through `SET_MORALE_STATUS`;
  - a squad with a leader shows "led by Karkajuk" in its caption.
- **Turn panel (RightPanel creature branch):**
  - When the current creature is Fleeing, a banner reads "Fleeing: moves away by the quickest route (DMG p. 273)".
  - When it is Surrendered, the banner reads "Surrendered". A squad's Squad attack block is hidden in both cases.
- **Tokens (DM map and player view):** a small status marker, ↩ for fleeing and ⚐ for surrendered, shared via one helper next to `SquadTokenOverlay`.
- **Area dialog:** a **DMG 2014 / 2024** toggle (E6), a **Width** field when the shape is Line and the edition is 2024, and edition-specific helper text and citation (E5).
- **Help and changelog:** the squads help paragraph cites both editions' area tables and explains the toggle; a "Morale (DMG 2014 p. 273)" paragraph lists the book triggers and the save, then **VVTT rules** (decisions 5, 6 and 9). Add a v2.12.0 changelog entry.

## Testing

**Unit tests (`src/utils/morale.test.ts`):**
- Leader at 0 HP prompts each squad it leads exactly once. A second drop after healing doesn't prompt again.
- A leader gaining `stunned` prompts its squads, and so does a leader removed from the encounter.
- Half size prompts at the crossing (bodies 6 → 5 of 10), not at 4 → 3 afterwards, and not when the squad is wiped straight to 0.
- Half HP prompts a single NPC at the crossing (e.g. 30 → 15 of 30). It never prompts for PCs, for squads (they use half size), or at 0 HP.
- There are no prompts outside the combat phase and none for creatures already Fleeing or Surrendered.
- `moraleSaver` picks the leader when standing, and the squad itself when the leader is down or absent.
- `rollMorale`: disadvantage keeps the lower die; total 10 succeeds and total 9 fails.
- `formatMoraleLog`: the flee, hold and automatic-failure strings.

**Area table tests (`src/utils/squad.test.ts`):**
- 2014 results are unchanged, with and without the explicit edition argument.
- 2024 rows: a 20-ft-radius sphere gives 10, a 15-ft cone 2, a 15-ft cube 2, a 60-ft cone 16 and a 50-ft cube 20.
- 2024 between-row sizes round down (a 33-ft cone gives 5), and sizes beyond the top give the top value (a 70-ft cone gives 16).
- 2024 lines: 30 × 5 gives 2, 60 × 10 gives 5, 100 × 5 gives 4, a 20-ft × 5 line gives 1, and 120 × 15 uses the 10-ft entries (10).
- `aoeAdvice` returns each edition's citation.

**Reducer tests (`src/context/combatReducer.test.ts`):**
- `SQUAD_HITS`, `DEAL_DAMAGE_TO_CREATURE` and `UPDATE_CREATURE` produce prompts during combat and not during setup.
- `REQUEST_MORALE` doesn't add a duplicate prompt.
- `RESOLVE_MORALE` with `fled` sets Fleeing and logs.
- `DISMISS_MORALE` removes the prompt without logging.
- `SET_MORALE_STATUS` sets and clears the status.
- `RESET_COMBAT` clears morale and prompts.
- `REMOVE_CREATURE` of a leader prompts its squads.
- An older save loads with `moralePrompts: []` and no `dmgEdition`.
- `SET_DMG_EDITION` sets the edition, and `RESET_COMBAT` keeps it.
- An unrelated action with no trigger returns the same creatures array as before.

**Manual browser checklist:**
1. Add Karkajuk and two hobgoblin squads, set Karkajuk as their leader, and start combat.
2. Hit Squad A down to 5/10. A half-strength card appears. Roll it.
3. Drop Karkajuk to 0 HP. Two leader-down cards appear. Roll one, and mark the other as failing automatically.
4. Check the Fleeing chips, the turn-panel banner, and the token markers on both views.
5. Drop a single NPC below half HP. A card appears.
6. Use the manual Morale button on a squad.
7. Reset Combat and confirm the morale state clears.
8. In the Area dialog, switch to DMG 2024: a 20-ft-radius sphere now suggests 10 (capped at bodies left), and reopening the dialog keeps 2024.

## Release

v2.12.0: a changelog entry and the help paragraph. Deploy with `CI=true npm run deploy` when the user asks.
