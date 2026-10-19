# Battle Mode: Squads — Design

**Date:** 2026-10-19
**Status:** Approved design, pending spec review
**Target release:** v2.11.0
**Part of:** Battle mode (slice 1 of several: **squads + group attacks + casualties** → morale & commanders → player-commanded squads → map templates / squads on war machines)

## Goal

Make fights with dozens of monsters fast and fun. The driving case is the Avernus assault on Arkhan's tower: about 30–40 allied hobgoblins, Bitter Breath and the Hellforged Titan, plus 4 PCs and 2 NPC companions, against Arkhan's forces. With this release the GM can:

1. Add a group of identical monsters as one **squad**: one row, one initiative slot and one map token showing how many are still standing ("8/10").
2. On a squad's turn, pick a target and roll **every** attack at once. The app shows a one-line summary ("10 attacks vs AC 16 → 4 hits (1 crit) → 38 slashing"), and each roll can be expanded.
3. Hurt a squad quickly. Single-target hits drop one body at a time. Area effects use the DMG's "Targets in Areas of Effect" table to suggest how many bodies are caught, roll each body's save, and drop the bodies that fall.

Out of scope for this slice:
- Morale and commanders (DMG p. 273 Morale; the commander's death). These are slice 2.
- Players giving orders to allied squads. This is slice 3.
- Measuring areas with map templates, and squads riding war machines. These come later.
- The DMG Mob Attacks averaging table. The user chose to roll every attack instead (see Decisions).

Creatures without a `squad` field, and vehicles, must behave exactly as they do today.

## Rules basis

The user chose "Book first, label the rest": anything the DMG says is automated as written, and anything VVTT invents is labelled **VVTT rule** in the UI and the help.

Verified on 5e.tools (DMG 2014), 2026-10-19:

- **Adjudicating Areas of Effect (DMG p. 249).** With no map, "imagine which combatants are near one another" and use the Targets in Areas of Effect table. "Add or subtract targets based on how bunched up the potential targets are"; the DMG suggests rolling 1d3 for the adjustment.

  | Area | Number of targets |
  |---|---|
  | Cone | Size ÷ 10 (round up) |
  | Cube or square | Size ÷ 5 (round up) |
  | Cylinder | Radius ÷ 5 (round up) |
  | Line | Length ÷ 30 (round up) |
  | Sphere or circle | Radius ÷ 5 (round up) |

- **Handling Mobs (DMG p. 250)** gives an optional shortcut that skips attack rolls by using the Mob Attacks table, and it explicitly ignores critical hits. VVTT does **not** use that shortcut in this slice. It rolls every attack as ordinary 5e attacks do (natural 20 is a critical hit, natural 1 misses), so group attacks are RAW, only faster.
- Saving throws, resistance, immunity and vulnerability follow the PHB as normal. Area damage is rolled once and applied to every creature caught (half on a successful save where the effect says so).

## Decisions

| # | Decision | Basis |
|---|---|---|
| 1 | A squad is a `Creature` with an optional `squad` field, not a new entity type. Initiative, the turn panel, the statblock viewer, the map, the player view and saving all work unchanged. | VVTT rule (reuse) |
| 2 | The front body's HP **is** the creature's `currentHp`. Per-body max HP is `statblock.maxHp`. `bodies === 0` exactly when `currentHp === 0`, so existing dead-creature handling (skipped in initiative, greyed in lists) applies automatically. | VVTT rule |
| 3 | A single-target hit damages only the front body. If damage ≥ front HP, that body falls, the next body steps up at full HP, and overkill is lost. | VVTT rule; equivalent to tracking each creature, because a single attack can only kill one creature |
| 4 | Every attack is rolled; crits double the damage dice only; a natural 1 always misses and a natural 20 always hits. | Book (PHB attack rules) |
| 5 | "Attackers" defaults to all standing bodies; the GM can lower it (e.g. only 4 can reach). "Attacks each" defaults to the number parsed from the statblock's Multiattack ("makes two attacks" → 2), otherwise 1. Both are editable. | VVTT rule (default only) |
| 6 | Area effects: the DMG table suggests the number caught (capped at the bodies left); the GM can change it. Damage is rolled once; each caught body rolls its own save. | Book (DMG p. 249, PHB) |
| 7 | In an area effect, the wounded front body is caught first, then fresh bodies. Of the bodies that survive damaged, the one with the **lowest** remaining HP becomes the new front body. Damage to any other survivors is dropped, because a squad tracks only one wounded body. | VVTT rule (front-body simplification) |
| 8 | Healing a squad restores only the front body, up to `statblock.maxHp`. It never brings back fallen bodies, and it does nothing when `bodies === 0`. | Book (healing can't raise the dead) |
| 9 | Squads roll initiative with the existing **Roll NPC Init** button (d20 + Dex, floor 1), like any non-PC creature on either side. | War Machine / creature parity |
| 10 | Squads are always available (no Battle-mode toggle). The squad option appears only when adding more than one creature. | User default |
| 11 | Squads don't use temporary HP. The temp-HP control is hidden for squads. | VVTT rule |

## Data model

### `Creature` (additive, optional)

```ts
squad?: {
  size: number;    // bodies at creation (the "10" in 8/10)
  bodies: number;  // bodies still standing, 0..size
};
```

No backfill is needed: older saves simply have no squads. An existing `DEAL_DAMAGE_TO_CREATURE` on a squad (for example from a war-machine weapon hitting it) is treated as **one** single-target hit (decision 3).

## Rules engine: `src/utils/squad.ts` (pure, dice injected)

All randomness comes in through a `roll: (sides: number) => number` parameter, so tests are deterministic.

- `parseDamage(text: string): DamagePart[]` reads `"2d6+4 slashing"` and `"1d8 + 1 piercing plus 2d6 fire"` into `{ count, sides, bonus, type }[]`. It returns `[]` when nothing parses; the UI then asks for a manual damage figure.
- `parseMultiattackCount(statblock): number` reads "makes two/three/four attacks" from the Multiattack action, otherwise 1.
- `rollGroupAttack({ attackBonus, ac, damage: DamagePart[], attacks, roll })` returns `{ rolls: AttackRoll[], hits, crits, totalByType }`. Each `AttackRoll` is `{ d20, total, hit, crit, damage: { type, amount }[] }`. A natural 20 hits and crits, a natural 1 misses, otherwise `total >= ac` hits. A crit doubles the dice count, not the bonus.
- `adjustForDefenses(amount, type, statblock): number` applies immunity (0), resistance (half, rounded down) and vulnerability (double), matching type names case-insensitively against `damageResistances` / `damageImmunities` / `damageVulnerabilities`.
- `applySquadHits(creature, hits: number[]): { currentHp, bodies, fell }` takes hits that have already been adjusted and applies decision 3 in order.
- `aoeTargetCount(shape: 'cone'|'cube'|'cylinder'|'line'|'sphere', size: number): number` implements the DMG p. 249 table (size means size, radius or length, as the table says).
- `saveBonus(statblock, ability): number` uses `savingThrows[ability]` if present, otherwise the ability modifier.
- `resolveSquadArea({ creature, caught, dc, ability, damage: number, halfOnSave, damageType, roll })` returns `{ saves: { d20, total, success, taken }[], currentHp, bodies, fell }`, applying decisions 6 and 7.
- `healSquad(creature, amount): number` returns the new `currentHp` (decision 8).

## Reducer (`src/context/CombatContext.tsx`)

The rolls happen in the UI using `squad.ts`. The reducer only receives final numbers, which keeps it deterministic.

- No new create action: squads are added through the existing `ADD_CREATURE` with the `squad` field set.
- `SQUAD_HITS { creatureId, hits: number[], source? }` applies `applySquadHits` and logs, e.g. "Hobgoblin ×10 (A) took 3 hits: 2 fall (8/10)".
- `SQUAD_AREA { creatureId, currentHp, bodies, summary }` stores the result of `resolveSquadArea` and logs the summary, e.g. "Fireball: 4 caught, 3 failed → 4 fall (6/10)".
- `DEAL_DAMAGE_TO_CREATURE` on a squad delegates to the `SQUAD_HITS` logic with `[amount]`.
- `HEAL_CREATURE` on a squad uses `healSquad`.
- `UPDATE_CREATURE` can set `squad.bodies` directly, for GM corrections. The reducer keeps the invariant: `bodies = 0` forces `currentHp = 0`, and raising `bodies` from 0 sets `currentHp = statblock.maxHp`.
- The attack summary is logged with the existing `LOG_ACTION` (type `attack`), together with the expandable roll detail in `details`.

## UI

**Adding a squad (Sidebar add dialog).** When the quantity is above 1, an **"Add as one squad"** switch appears under the stepper.
- On: one creature named `"<Name> ×<qty> (<letter>)"`, with `squad = { size: qty, bodies: qty }` and `currentHp = maxHp`. The letter increments per existing squad of the same monster (A, B, C…). The caption reads "One row and token; tracks bodies".
- Off: today's numbered creatures.
- The existing 20-per-add cap stays.

**The creature row (Sidebar `CreatureEntry`).** For a squad, the row shows "Bodies 8/10 · front 7/11 HP" instead of the HP figure.
- The damage control becomes **Hit [dmg] × [n]** (n defaults to 1) with an optional damage type. It sends `SQUAD_HITS` after `adjustForDefenses`.
- An **Area…** button opens the area dialog. Heal works as decision 8.
- The edit mode gains a Bodies field.

**The area dialog.** It contains:
- shape and size, with the suggested count shown live ("DMG p. 249 suggests 4");
- the bodies caught (prefilled with the suggestion and editable, capped at bodies left);
- save ability and DC;
- damage, entered as a number or as dice with a **Roll** button;
- a damage type;
- a "half on success" switch (on by default).

**Apply** rolls the saves, shows the per-body table, dispatches `SQUAD_AREA` and logs.

**A squad's turn (RightPanel current-turn panel, creature branch).** When the current creature is a squad, a **Squad attack** block appears. It holds:
- **Action:** a picker over statblock actions with an `attackBonus`;
- **Target:** any living creature or vehicle on the field, with AC prefilled from the target and editable;
- **Attackers** (default: bodies) and **Attacks each** (decision 5);
- a **Roll** button.

The summary line appears with a "Show rolls" expander, and it is logged when rolled. **Apply** then sends damage as one dispatch per hit through the target's existing path:
- a squad target gets `SQUAD_HITS`;
- a creature target gets `DEAL_DAMAGE_TO_CREATURE`;
- a vehicle target gets `DEAL_DAMAGE_TO_VEHICLE`, so vehicle damage threshold still applies per hit.

Before Apply, each hit is run through `adjustForDefenses` for creature targets. Apply is a separate click so the GM can choose not to apply (for example, a PC whose HP lives on paper).

**Token (`CreatureToken` in `BattlefieldMap.tsx`; the creature token in `PlayerViewMap.tsx`).** A squad shows:
- a large body-count badge ("8/10");
- a ring that drains in proportion to `bodies / size`, alongside the existing HP bar, which shows the front body.

The player view gets squads automatically, because `BattlefieldSyncState.creatures` already carries whole `Creature` objects. `PlayerViewMap.tsx` draws its own tokens, so the badge and ring must be added there too (shared via a small component or helper).

**Help and changelog.** Add a "Battle mode: squads" section to `HelpGuide.tsx` that lists the Book rules and the **VVTT rules** (decisions 1–3, 5, 7, 11) separately, and add a v2.11.0 changelog entry.

## Testing

**Unit tests (`src/utils/squad.test.ts`)** with scripted dice:
- `parseDamage`: single part, a bonus with spaces, a "plus" second part, and unparseable text.
- `parseMultiattackCount`: two, three, none.
- `rollGroupAttack`:
  - a natural 1 misses even when the total meets AC;
  - a natural 20 hits and crits even when the total is below AC;
  - a crit doubles dice but not the bonus;
  - the totals per damage type are right.
- `adjustForDefenses`: resistance rounds down, immunity gives 0, vulnerability doubles, matching is case-insensitive, and untyped damage is unchanged.
- `applySquadHits`:
  - a non-lethal hit;
  - an exactly-lethal hit;
  - overkill is lost (a 100-damage hit drops one body);
  - several hits across bodies;
  - the last body falls, giving `bodies 0`, `currentHp 0`.
- `aoeTargetCount`: every DMG row, including the rounding up (a 15-ft cone gives 2, a 20-ft-radius sphere gives 4, a 100-ft line gives 4).
- `resolveSquadArea`:
  - the front body is caught first;
  - a successful save takes half (rounded down);
  - the lowest damaged survivor becomes the front body;
  - the caught count is capped at bodies left.
- `healSquad`: caps at maxHp; no effect at 0 bodies.

**Reducer tests (`src/context/combatReducer.test.ts`):**
- `SQUAD_HITS` and `SQUAD_AREA` update bodies and HP and log.
- A squad at 0 bodies is skipped in turn order like a dead NPC.
- `DEAL_DAMAGE_TO_CREATURE` on a squad acts as one hit.
- `HEAL_CREATURE` doesn't revive.
- The `UPDATE_CREATURE` bodies invariant holds.
- A creature with no `squad` field behaves exactly as before (damage, heal, death).

**Manual browser checklist (user, on the live site):**
1. Add 10 hobgoblins as a squad.
2. Roll NPC Init.
3. On its turn, attack a PC and apply.
4. Hit the squad for 20 damage, then fireball it.
5. Check the token badge on the DM map and on the player view.
6. Save, reload, and confirm the squad survives.

## Release

v2.11.0: a changelog entry plus the help section. Deploy with `CI=true npm run deploy` when the user asks.
