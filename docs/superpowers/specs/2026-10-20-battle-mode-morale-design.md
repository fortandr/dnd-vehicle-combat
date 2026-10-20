# Battle Mode: Morale and Commanders — Design

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

Out of scope:
- Commander bonuses or auras.
- Applying a commander's statblock features (e.g. Leadership) automatically.
- Moving fleeing tokens automatically.
- Detecting surprise automatically, or detecting "no way to harm the other side".
- Player-commanded squads. These are slice 3.

Creatures and vehicles with no morale involvement must behave exactly as they do today.

## Rules basis (DMG p. 273, "Morale", optional rule; verified on 5e.tools 2026-10-20)

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
- `LOAD_ENCOUNTER` and the autosave load default `moralePrompts` to `[]`.

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
- **Help and changelog:** a "Morale (DMG p. 273)" paragraph lists the book triggers and the save, then **VVTT rules** (decisions 5, 6 and 9). Add a v2.12.0 changelog entry.

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

**Reducer tests (`src/context/combatReducer.test.ts`):**
- `SQUAD_HITS`, `DEAL_DAMAGE_TO_CREATURE` and `UPDATE_CREATURE` produce prompts during combat and not during setup.
- `REQUEST_MORALE` doesn't add a duplicate prompt.
- `RESOLVE_MORALE` with `fled` sets Fleeing and logs.
- `DISMISS_MORALE` removes the prompt without logging.
- `SET_MORALE_STATUS` sets and clears the status.
- `RESET_COMBAT` clears morale and prompts.
- `REMOVE_CREATURE` of a leader prompts its squads.
- An older save loads with `moralePrompts: []`.
- An unrelated action with no trigger returns the same creatures array as before.

**Manual browser checklist:**
1. Add Karkajuk and two hobgoblin squads, set Karkajuk as their leader, and start combat.
2. Hit Squad A down to 5/10. A half-strength card appears. Roll it.
3. Drop Karkajuk to 0 HP. Two leader-down cards appear. Roll one, and mark the other as failing automatically.
4. Check the Fleeing chips, the turn-panel banner, and the token markers on both views.
5. Drop a single NPC below half HP. A card appears.
6. Use the manual Morale button on a squad.
7. Reset Combat and confirm everything clears.

## Release

v2.12.0: a changelog entry and the help paragraph. Deploy with `CI=true npm run deploy` when the user asks.
