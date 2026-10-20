# Battle Mode: Squads Tab — Design

**Date:** 2026-10-20
**Status:** Approved design, pending spec review
**Target release:** v2.13.0
**Part of:** Battle mode (squads → morale & commanders → **squads tab, mixed and player-commanded squads** → map templates / squads on war machines)
**Builds on:**
- v2.11.0 squads (`Creature.squad`, `src/utils/squad.ts`, `SQUAD_HITS` / `SQUAD_AREA`)
- v2.12.0 morale (`src/utils/morale.ts`, `moralePrompts`, `dmgEdition`), merged to main 2026-10-20

## Goal

Make squads something the DM builds on purpose, the way they build vehicles. A **Squads** tab sits beside Map and Vehicles. You create a squad there, then staff it with creatures. A squad can mix creature types, for example a hobgoblin captain, eight hobgoblins, four archers and Karkajuk. A PC can command a squad. In combat the squad takes one initiative slot and has one map token, and its turn resolves in one panel.

Why: the v2.11.0 entry point (Add → Search Open5e → quantity > 1 → "Add as one squad" switch) is hard to find. It also only allows one creature type per squad. User feedback, 2026-10-20: "That UX is very very messy". "Squads should be a tab like Map and Vehicles, where you create squads and then staff NPCs or Players into them like you would a vehicle." "This will also allow for squads of mixed NPC types."

User choices (2026-10-20):
- **Container model (approach A):** a new `Squad` entity. It does not reuse vehicles and it is not a creature tag.
- **Members are individuals or stacks.** An individual is one creature row. A stack is the v2.11.0 body-count creature, for example "Hobgoblin ×8".
- **A PC can command a squad and keeps their own turn.** The squad acts on the PC's initiative.
- **Morale (v2.12.0) merges first.** This slice moves the leader and morale state from the stack creature onto the squad.

Out of scope:
- Squads aboard vehicles.
- Squads as vehicle crew.
- Map-template area effects.
- Formation shapes or token footprints larger than one token.
- Commander bonuses.
- Party presets that carry squads.
- A per-member breakdown in the player view.

Creatures, vehicles and standalone monsters that are not in a squad must behave exactly as they do today.

## Rules basis

Book first; every invention is labelled **VVTT rule** in the UI and in Help.

- **Group attacks.** Every attack of every body in a stack is rolled. A natural 20 crits and a natural 1 misses. This is unchanged from v2.11.0, which rolls every attack rather than using the DMG 2014 p. 250 mob shortcut.
- **Area effects.** The number of creatures caught comes from the DMG area-of-effect table: 2014 p. 249, or 2024 p. 82. The encounter's `dmgEdition` decides which (from v2.12.0). Each caught body makes its own save.
- **Morale.** DMG 2014 p. 273, optional rule: a DC 10 Wisdom save. The 2024 DMG has no morale rule.
- **VVTT rules added in this slice:**
  1. **Default target for a hit on a squad.** In 5e the attacker picks the target. The Hit dialog asks which member is hit, and defaults to the largest stack (the front rank). The leader is never the default.
  2. **Area split.** In a mixed squad, the table's total is split across members in proportion to their standing bodies. An individual counts as 1. Use largest-remainder rounding, and never assign more than a member has standing. The DM can edit every member's count before rolling.
  3. **Morale saver without a leader.** When the leader is down or absent, the largest standing stack makes the save. A tie goes to the first in member order. If there are no stacks, the first standing member saves.
  4. **Half strength.** A squad is at half strength when its standing members are at or below half of its starting count. Each stack body counts 1 and each individual counts 1.
  5. **Squad initiative.**
     - Commanded squad: it acts immediately after its commander.
     - Otherwise: d20 + the leader's DEX modifier.
     - No leader: d20 + the DEX modifier of the first member.

## Data model

```ts
// src/types/index.ts
interface Squad {
  id: string;
  name: string;
  faction: 'party' | 'enemy';   // same values as Creature.faction
  memberIds: string[];          // creature ids in display order; the only record of membership
  leaderId?: string;            // must be in memberIds
  commanderId?: string;         // a PC creature id; not a member
  position?: { x: number; y: number };
  initiative?: number;          // rolled value when not commanded
  startingCount: number;        // standing count (bodies + individuals) when combat starts; drives VVTT rule 4
  morale?: { status?: MoraleStatus; asked: MoraleTrigger[] };
}

interface Creature {
  // renamed from `squad`; same shape minus leaderId
  stack?: { size: number; bodies: number };
  // `morale` stays only for standalone creatures
}

interface CombatState {
  squads: Squad[];
}

interface MoralePrompt {
  // gains a target kind
  squadId?: string;             // set for squad prompts; creatureId stays for standalone creatures
}
```

- **The "squad" rename.** "Squad" now always means the container. `normalizeSquad`, `applySquadHits` and `healSquad` in `src/utils/squad.ts` become their `Stack` equivalents. The file is renamed `stack.ts`, and a new `src/utils/squads.ts` holds the container logic.
- **Membership and assignments.** A creature belongs to at most one squad. A squad member cannot be in `crewAssignments`, and a crew member cannot join a squad.
- **`startingCount`.** It is set when `START_COMBAT` runs, and recomputed if members are added or removed during setup. During combat, staffing a new member adds that member's standing count to `startingCount`.

## The Squads tab

The tab is added to the `ToggleButtonGroup` in `src/components/layout/MainPanel.tsx`: `ViewMode` gains `'squads'`. The tab shows one `SquadCard` per squad and a **+ New squad** button.

```
[ Map ] [ Vehicles ] [ Squads ]                         [ + New squad ]

┌ Tower Guard ✎ ──────────── Enemy ▾ ── Init 14 ── ⚑ Steady ── ⋮ ┐
│ Commander: — (none)                                [ Assign PC ▾ ]
│ ★ Hobgoblin Captain          39/39 HP   AC 17            ⋯
│   Hobgoblin ×8               8/8 bodies (front 11/11)    ⋯
│   Hobgoblin Archer ×4        4/4 bodies (front 11/11)    ⋯
│   Karkajuk                   52/60 HP   AC 15            ⋯
│ [ + Staff ▾ ]                                 [ Place on map ]
└───────────────────────────────────────────────────────────────────┘
```

- **New squad.** Creates an empty squad named "Squad N", with faction Enemy and no position. The name is edited inline.
- **Faction.** Enemy or Party (`Squad.faction`). Party squads use the PC initiative button group; enemy squads use the NPC group.
- **+ Staff ▾:**
  - **Existing creature…** Lists standalone creatures only: not in a squad and not crew.
  - **Monster search…** The existing Open5e search dialog in a "staff" mode. Quantity 1 adds an individual. Quantity 2 or more adds one stack. The cap rises from 20 to 50, to fit the tower's 40 hobgoblins.
  - **Custom NPC…** The existing custom-NPC form, with the same quantity choice.
  - **Add bodies…** Grows a chosen stack's `size` and `bodies`.
- **Assign PC ▾.** Sets or clears `commanderId`. It lists party PCs only. A PC can command at most one squad.
- **Member menu (⋯):**
  - **Make leader:** moves the ★.
  - **Remove from squad:** the creature becomes standalone at the squad token's position, or unplaced if the squad has no position. During combat it is inserted into initiative after the current turn, as `UNASSIGN_CREW` does.
  - **Split off 1** (stacks only): `bodies` and `size` go down by 1, and a fresh standalone creature at full HP joins the encounter.
  - **View statblock.**
- **Squad menu (⋮):**
  - **Disband:** every member becomes standalone, as with Remove.
  - **Delete squad and members.**
  - **Reset morale.**
- **Place on map / Remove from map.** Sets or clears `position`.
- **Morale.** A status chip (Steady / Fleeing / Surrendered) and a manual check button, reusing the v2.12.0 controls.
- **Members at 0 HP or 0 bodies** stay on the card, greyed out.

## Elsewhere in the app

- **Sidebar.**
  - Squad members are listed under a squad heading in the NPC or PC list, indented. HP editing and conditions still work there.
  - Adding from the sidebar with a quantity above 1 always adds separate numbered creatures. The "Add as one squad" switch is removed.
- **Initiative (`START_COMBAT`, roll buttons).**
  - Squad ids go into `initiativeOrder` like vehicle ids. Squad members are skipped.
  - A squad with no standing members, or no members at all, gets no slot.
  - A commanded squad is placed directly after its commander, and moves with the commander if the commander's initiative changes.
- **Map (DM and player views).**
  - A placed squad renders one `SquadToken`. Members have no individual tokens.
  - The token shows the squad's name, the standing count against `startingCount` (for example "13/14"), the leader's ★, and the morale marker (`MoraleTokenMarker`).
  - The player view shows the same token. It never shows the member breakdown.
- **Right panel, squad's turn.** A `SquadTurnPanel` replaces `SquadAttackPanel`:
  - One line per standing member: a tick box, the attack picker (its actions, defaulting to Multiattack if present, else its first attack), and a target picker.
  - **Roll all** rolls each ticked member: a stack uses `rollGroupAttack` for its bodies, and an individual rolls its own attacks. Each result keeps the AC it was rolled against.
  - **Apply hits** sends each target its hits through the existing creature and vehicle damage paths.
  - If a commander is set, a note says "<PC> directs this squad".
  - Fleeing or surrendered squads show the v2.12.0 status banner instead.
- **Taking hits.** Hit and Area… live on the squad card and the squad token's menu.
  - **Hit…** Pick a member (VVTT rule 1 default) and the damage. A stack takes it through `applyStackHits`, which hits the front body only and loses overkill. An individual takes normal damage.
  - **Area…** `SquadAreaDialog` gains a member list.
    - The suggested total comes from `aoeTargetCount` and is capped at the standing count, then split by VVTT rule 2.
    - Each member's caught count can be edited.
    - Saves use each member's own `saveBonus`, and Magical and resistances apply per member.
- **Healing.** Unchanged per member. It never revives a fallen body.

## Morale (moved onto the squad)

`detectMoraleTriggers` gains a squad pass. A squad's morale state lives on `Squad.morale`, and its prompt carries `squadId`. Triggers, each fired once per squad, with the same priority order as v2.12.0:

1. **leader-down:** the squad's leader goes from standing to down (0 HP, dead, or incapacitated).
2. **half-size:** the squad's standing count crosses to at or below half of `startingCount` (VVTT rule 4).

The rules for a standalone creature are unchanged. A lone monster still uses half-hp, and so does a former member once it is removed from its squad. Members of a squad never raise their own prompts.

- **`moraleSaver` for a squad.** The leader's WIS save if the leader is standing; otherwise VVTT rule 3.
- **Resolving a squad prompt.** The status (fleeing or surrendered) is set on the squad. The token and card show it.
- **Party squads** with NPC members get morale prompts. PCs never do: a commander PC is not a member and never saves.

## Migration (saved encounters from v2.11 / v2.12)

`migrateSquads(state)` is a pure function, unit-tested, and runs in `LOAD_ENCOUNTER` (and anywhere else old state arrives, such as autosave restore). It is idempotent: state that already has `squads` passes through unchanged.

For every creature with the old `squad` field:

1. Rename `squad` to `stack`, dropping `leaderId`.
2. Create a `Squad`:
   - It takes the creature's name and position, and its `faction` from the creature's `faction`.
   - `memberIds = [creature.id]`, plus the old `leaderId` creature if it exists and isn't already in another squad; that creature becomes `leaderId`.
   - `startingCount` = the stack's `size`, plus 1 for a leader.
   - `morale` is moved from the creature.
3. Replace the creature's id in `initiativeOrder` (and the current-turn pointer) with the squad's id. A leader creature that had its own initiative entry loses it.
4. Re-point open `moralePrompts` for that creature to `squadId`.

If an old leader was the leader of several squads, it joins only the first squad. The other squads migrate with no leader; the leader's ★ only applies to its own squad (one squad per creature). This is noted in the changelog.

## Reducer actions

Squad-level actions:
- `ADD_SQUAD`
- `UPDATE_SQUAD`: name, faction, leader, commander, position, initiative
- `REMOVE_SQUAD`: with `{ deleteMembers: boolean }`

Membership and stack actions:
- `ADD_SQUAD_MEMBER`
- `REMOVE_SQUAD_MEMBER`
- `SPLIT_STACK`
- `GROW_STACK`

Combat:
- `SQUAD_HIT`: replaces `SQUAD_HITS`; carries `squadId`, `memberId`, and hits.
- `SQUAD_AREA`: now per member.

Existing actions extended:
- `REMOVE_CREATURE` removes the creature from its squad and clears `leaderId` if needed. This is not a morale trigger.
- `LOAD_PARTY_PRESET` clears `squads`.
- `RESET_COMBAT` restores bodies and HP, clears squad morale and prompts, and keeps membership.
- `ASSIGN_CREW` refuses squad members.

## Testing

- **Unit tests (Vitest, sibling `*.test.ts`):**
  - `squads.ts`:
    - Standing count.
    - Area split (VVTT rule 2): proportional, largest remainder, the cap, and individuals counting 1.
    - Default hit target (rule 1).
    - Morale saver fallback (rule 3).
    - Squad initiative and commander placement (rule 5).
  - `migrateSquads`:
    - Plain stack.
    - Stack with leader.
    - Shared leader.
    - Initiative swap.
    - Prompt re-pointing.
    - Idempotence.
  - `morale.ts` squad pass:
    - leader-down and half-size fire once.
    - Members never raise their own prompts.
    - Removed members fall back to half-hp.
  - The renamed `stack.ts` keeps every v2.11 test passing.
- **Reducer tests:**
  - Each new action.
  - `REMOVE_CREATURE` / `LOAD_PARTY_PRESET` / `RESET_COMBAT` interactions.
  - `ASSIGN_CREW` refusing members.
  - `START_COMBAT` slotting squads and skipping members.
- **Browser checklist (in the plan):** run the tower assault end to end.
  1. Build Tower Guard (captain, Hobgoblin ×8 and archers ×4, Karkajuk).
  2. Place it and start combat.
  3. Roll its turn against two targets.
  4. Fireball it with 2014, then 2024, and compare the counts.
  5. Kill the captain → morale prompt → fleeing shows on both maps.
  6. Give a party squad a PC commander and confirm its initiative follows the PC.
  7. Load a v2.11 save that has a squad and confirm it migrates.

## Help and changelog

- **Help:**
  - Rewrite the "Battle mode: squads" section around the Squads tab.
  - Every VVTT rule is listed as such.
- **Changelog 2.13.0:**
  - The Squads tab.
  - Mixed squads.
  - PC commanders.
  - Morale on squads.
  - Saved squads migrate automatically.
  - The "Add as one squad" switch is replaced by staffing from the tab.
