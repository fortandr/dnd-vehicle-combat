# Battle Mode: Squads Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Squads tab beside Map and Vehicles where the DM builds squads of mixed creatures (individuals and stacks), optionally commanded by a PC; in combat each squad has one initiative slot, one map token, one turn panel, its own Hit/Area tools and its own morale.

**Architecture:**
- A new `Squad` container lives in `CombatState.squads`. The v2.11.0 body-count creature field is renamed `squad` → `stack`, and `src/utils/squad.ts` becomes `src/utils/stack.ts`.
- Container rules (VVTT rules 1–5) are pure functions in a new `src/utils/squads.ts`. Old saves are converted by a pure, idempotent `migrateSquads` in `src/utils/migrateSquads.ts`, run on every load path.
- The reducer in `src/context/CombatContext.tsx` gains squad actions and slots squads into initiative. The morale detector gains a squad pass.
- New UI lives in `src/components/squads/`: the Squads tab, the squad card, the token, the turn panel, and the Hit and Area dialogs. The Open5e search dialog, the custom-NPC builder and the statblock viewer are extracted from `Sidebar.tsx` so the tab can reuse them.

**Tech Stack:** React 18 + TypeScript + Vite + MUI, React Context + useReducer, Vitest, @dnd-kit.

**Spec:** `docs/superpowers/specs/2026-10-20-battle-mode-squads-tab-design.md` (binding). Read it before starting any task.

## Global Constraints

- Creatures, vehicles and standalone monsters that are not in a squad must behave exactly as they do today. A standalone stack (a v2.11-style body-count creature outside any squad) keeps its v2.11 row controls, token overlay and half-size morale.
- Every VVTT invention is labelled **"VVTT rule"** in the UI and in Help. The VVTT rules in this slice are numbered as in the spec:
  1. the default target for a hit on a squad;
  2. the area split;
  3. the morale saver without a leader;
  4. half strength;
  5. squad initiative.
- Book citations, verbatim:
  - Area effects: "DMG 2014 p. 249" and "DMG 2024 p. 82". The encounter's `dmgEdition` picks the edition.
  - Morale: "DMG 2014 p. 273" (optional rule, DC 10 Wisdom save). The 2024 DMG has no morale rule.
  - The DMG 2014 p. 250 mob shortcut is not used: every attack of every body is rolled.
- The reducer stays free of dice. The UI rolls and the reducer receives results. Ids come from `uuid()`.
- A creature belongs to at most one squad. A squad member cannot be crew, and crew cannot join a squad. A commander is a PC, is never a member, and commands at most one squad.
- Pure logic goes in `src/utils/*.ts` with a sibling `*.test.ts` (vitest).
- Commands:
  - Run tests with `npx vitest run <files>` and `npm test`.
  - Type-check with `npx tsc -p tsconfig.app.json`. The root `tsconfig.json` has `"files": []`, so a plain `npx tsc --noEmit` checks nothing.
  - Lint changed files with `npx eslint <files>`. If it hasn't finished after about 4 minutes, stop waiting and report it. Never run `npm run lint`.
- **iCloud warning:** `node_modules` in this repo has evicted ("dataless") files, so `npx vitest` or `tsc` may hang silently. If a command prints nothing for 60 s, kill it and run the checks from a scratch copy outside `~/Documents`:

  ```bash
  SCR=~/vvtt-scratch
  [ -d "$SCR" ] || { git clone "$PWD" "$SCR" && (cd "$SCR" && npm ci); }
  rsync -a --delete --exclude node_modules --exclude .git --exclude .firebase ./ "$SCR"/
  (cd "$SCR" && npx vitest run && npx tsc -p tsconfig.app.json)
  ```

- Never stage `NAVAL_MECHANICS_SALTMARSH.md`, `COMBAT_LOG_EXPORT_PLAN.md` or `.firebase/hosting.ZGlzdA.cache`. Stage by explicit path only (never `git add -A` or `git add .`).
- Every commit message ends with exactly this line: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Never push and never deploy.
- Branch: `feat/battle-mode-squads-tab`, created from `main`. Release: v2.13.0, dated 2026-10-20. The app reads its version from `src/data/changelog.ts` (`package.json` stays `0.0.0`).
- `src/components/help/HelpGuide.tsx` is being restructured by another agent: a "Battle Mode" section will hold the squads and morale text. Edit that section by finding it, not by line numbers.

## File Structure

| File | Responsibility |
|---|---|
| `src/types/index.ts` (modify) | `Squad`, `SquadUpdates`, `Creature.stack`, `CombatState.squads`, `MoralePrompt.squadId` |
| `src/utils/squad.ts` → `src/utils/stack.ts` (+ test, rename) | v2.11 body-count rules with `Stack` names |
| `src/utils/squads.ts` + test (create) | Container rules: standing count, VVTT rules 1–5, sidebar grouping, staffing, individual area saves, attack options |
| `src/utils/migrateSquads.ts` + test (create) | v2.11/v2.12 save → `Squad` containers |
| `src/utils/morale.ts` + test (modify) | Squad morale pass, squad saver, trigger text |
| `src/utils/customNpc.ts` + test (create) | The custom-NPC creature builder shared by the sidebar and the Squads tab |
| `src/services/open5e.ts` (create) | Open5e types, search and conversion, moved out of `Sidebar.tsx` |
| `src/context/CombatContext.tsx` + `combatReducer.test.ts` (modify) | Squad actions, initiative, load and migration, morale wiring, `currentTurnSquad` |
| `src/components/creatures/MonsterSearchDialog.tsx` (create) | The Open5e search dialog, used by the sidebar (cap 20) and the staff mode (cap 50) |
| `src/components/statblocks/StatblockDisplay.tsx`, `StatblockDialog.tsx` (create) | The statblock viewer, moved out of `Sidebar.tsx` |
| `src/components/squads/SquadsView.tsx`, `SquadCard.tsx`, `SquadMoraleControls.tsx`, `CustomNpcDialog.tsx` (create) | The Squads tab |
| `src/components/squads/SquadListGroup.tsx`, `SquadInitiativeRow.tsx` (create) | Sidebar squad heading and initiative row |
| `src/components/squads/SquadHitDialog.tsx` (create), `SquadAreaDialog.tsx` (rewrite) | Taking hits |
| `src/components/squads/SquadToken.tsx` (create) | The token face shared by both maps |
| `src/components/squads/SquadTurnPanel.tsx` (create; replaces `SquadAttackPanel.tsx`) | A squad's turn |
| `src/components/morale/MoralePromptCard.tsx`, `MoraleRowControls.tsx` (modify); `SquadLeaderSelect.tsx` (delete) | Morale UI for squads |
| `src/components/layout/MainPanel.tsx`, `Sidebar.tsx`, `RightPanel.tsx` (modify) | Mount the tab, the grouping and the panel |
| `src/components/battlefield/BattlefieldMap.tsx`, `PlayerViewMap.tsx`, `src/hooks/useBroadcastChannel.ts` (modify) | Squad tokens on both maps |
| `src/components/vehicles/VehicleCard.tsx` (modify) | Crew pickers skip squad members |
| `src/components/help/HelpGuide.tsx`, `src/data/changelog.ts` (modify) | Help text and v2.13.0 |

---

### Task 1: Rename `squad` → `stack` and add the `Squad` types

**Files:**
- Rename: `src/utils/squad.ts` → `src/utils/stack.ts`, `src/utils/squad.test.ts` → `src/utils/stack.test.ts`
- Modify: `src/types/index.ts`, `src/context/CombatContext.tsx`, `src/context/combatReducer.test.ts`, `src/utils/morale.ts`, `src/utils/morale.test.ts`, `src/components/battlefield/BattlefieldMap.tsx`, `src/components/battlefield/PlayerViewMap.tsx`, `src/components/layout/RightPanel.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/squads/SquadRowControls.tsx`, `src/components/squads/SquadAttackPanel.tsx`, `src/components/squads/SquadAreaDialog.tsx`, `src/components/morale/MoralePromptCard.tsx`, `src/components/morale/SquadLeaderSelect.tsx`, `src/components/morale/MoraleRowControls.tsx`

**Interfaces:**
- Produces:
  - `Creature.stack?: { size: number; bodies: number; leaderId?: string }`. `leaderId` is transitional and is removed in Task 5.
  - `interface Squad { id; name; faction: 'party' | 'enemy'; memberIds: string[]; leaderId?; commanderId?; position?: Position; initiative?: number; startingCount: number; morale?: { status?: MoraleStatus; asked: MoraleTrigger[] } }`
  - `type SquadUpdates = Partial<Pick<Squad, 'name' | 'faction' | 'leaderId' | 'commanderId' | 'position' | 'initiative'>>`
  - `CombatState.squads: Squad[]`
  - `MoralePrompt.creatureId?: string`, `MoralePrompt.squadId?: string`
  - `src/utils/stack.ts` exports `applyStackHits`, `healStack`, `normalizeStack` (returns `{ currentHp, stack }`), `resolveStackArea`, `StackAreaResult`, `nextStackName`, `formatStackTally`, `formatStackHits`. The other exports are unchanged: `parseDamage`, `parseActionDamage`, `parseMultiattackCount`, `rollGroupAttack`, `adjustForDefenses`, `formatGroupAttack`, `formatAttackRolls`, `aoeTargetCount`, `aoeAdvice`, `saveBonus`, `AreaSave`, `formatAreaSummary`, `damageNotation`, `DAMAGE_TYPES`, `AOE_SHAPES`, `AoeShape`, `DamagePart`, `GroupAttackResult`, `Roller`.
  - `CombatContext.tsx`'s helper is renamed `applyStackHitsToState`.

This is a mechanical rename. The existing suite is the test: it must stay green with only identifiers and fixture keys changed. Log strings such as "— squad destroyed" do not change.

- [ ] **Step 1: Create the branch and move the files**

```bash
git checkout main && git checkout -b feat/battle-mode-squads-tab
git mv src/utils/squad.ts src/utils/stack.ts
git mv src/utils/squad.test.ts src/utils/stack.test.ts
```

- [ ] **Step 2: Rename identifiers, import paths and the field across `src`**

Run these from the repo root. Rule set B renames object keys. It skips four files where `squad:` is a prop name or prose.

```bash
FILES="src/types/index.ts src/context/CombatContext.tsx src/context/combatReducer.test.ts src/utils/stack.ts src/utils/stack.test.ts src/utils/morale.ts src/utils/morale.test.ts src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx src/components/layout/RightPanel.tsx src/components/layout/Sidebar.tsx src/components/squads/SquadRowControls.tsx src/components/squads/SquadAttackPanel.tsx src/components/squads/SquadAreaDialog.tsx src/components/morale/MoralePromptCard.tsx src/components/morale/SquadLeaderSelect.tsx src/components/morale/MoraleRowControls.tsx"
# A: identifiers, import paths, property access
perl -pi -e 's/\bapplySquadHits/applyStackHits/g; s/\bhealSquad\b/healStack/g; s/\bnormalizeSquad\b/normalizeStack/g; s/\bresolveSquadArea\b/resolveStackArea/g; s/\bSquadAreaResult\b/StackAreaResult/g; s/\bnextSquadName\b/nextStackName/g; s/\bformatSquadTally\b/formatStackTally/g; s/\bformatSquadHits\b/formatStackHits/g; s#utils/squad\x27#utils/stack\x27#g; s#\x27\./squad\x27#\x27./stack\x27#g; s/\.squad\b/.stack/g; s/\x27squad\x27 in/\x27stack\x27 in/g; s/\[\x27squad\x27\]/[\x27stack\x27]/g' $FILES
# B: object keys and type members (not where `squad` is a prop name or prose)
for f in $FILES; do
  case "$f" in *SquadAttackPanel.tsx|*SquadLeaderSelect.tsx|*MoralePromptCard.tsx|*SquadRowControls.tsx) continue;; esac
  perl -pi -e 's/\bsquad(\??): /stack$1: /g' "$f"
done
```

- [ ] **Step 3: Check that only the expected occurrences remain**

Run: `grep -rnE "\.squad\b|\bsquad\??: |'squad'|utils/squad|SquadHits\b|healSquad|normalizeSquad|resolveSquadArea|SquadAreaResult|nextSquadName|formatSquad" src`

Expected: exactly these four lines.
- `SquadAttackPanel.tsx` (`{ squad }: { squad: Creature }`).
- `SquadLeaderSelect.tsx` (its props).
- `MoralePromptCard.tsx` ("saves for the squad:").
- The `SquadRowControls.tsx` doc comment.

Fix anything else by hand in the same way.

- [ ] **Step 4: Update the header comment of `src/utils/stack.ts`**

Replace the first comment block with:

```ts
/**
 * Battle mode stacks: one creature row standing for N identical bodies (v2.11.0 "squads", renamed in v2.13.0
 * when "squad" became the container; see src/utils/squads.ts). Pure rules only. Dice come in through `roll`.
 */
```

- [ ] **Step 5: Add the container types to `src/types/index.ts`**

Replace the `Creature.stack` line and its comment (currently `stack?: { size: number; bodies: number; leaderId?: string };`) with:

```ts
  /** Battle mode: a stack of identical bodies (e.g. "Hobgoblin ×8"). Front body HP = currentHp. */
  stack?: { size: number; bodies: number; leaderId?: string };
```

Replace the `MoralePrompt` interface with:

```ts
export interface MoralePrompt {
  id: string;
  creatureId?: string; // a standalone creature that may flee
  squadId?: string; // a squad that may flee (v2.13.0)
  trigger: MoraleTrigger | 'manual';
  leaderName?: string; // for leader-down text, kept in case the leader was removed
}

/** Battle mode squad container (v2.13.0). Members are creature ids; each member is an individual or a stack. */
export interface Squad {
  id: string;
  name: string;
  faction: 'party' | 'enemy'; // same values as Creature.faction
  memberIds: string[]; // creature ids in display order; the only record of membership
  leaderId?: string; // must be in memberIds
  commanderId?: string; // a PC creature id; not a member
  position?: Position;
  initiative?: number; // rolled value when not commanded
  startingCount: number; // standing count (bodies + individuals) when combat starts; drives VVTT rule 4
  morale?: { status?: MoraleStatus; asked: MoraleTrigger[] };
}

export type SquadUpdates = Partial<Pick<Squad, 'name' | 'faction' | 'leaderId' | 'commanderId' | 'position' | 'initiative'>>;
```

In `CombatState`, directly after `crewAssignments: CrewAssignment[];`, add:

```ts
  // Battle mode: squad containers (v2.13.0)
  squads: Squad[];
```

- [ ] **Step 6: Default `squads` in the reducer**

In `src/context/CombatContext.tsx`:
- In `initialCombatState`, add `squads: [],` after `crewAssignments: [],`.
- In the `LOAD_ENCOUNTER` return object, add `squads: action.payload.squads || [],` after `crewAssignments: migratedCrewAssignments,`.

(Task 3 replaces this line with the migration.)

- [ ] **Step 7: Run the suite and type-check**

Run: `npx vitest run && npx tsc -p tsconfig.app.json`

Expected: every test passes. This includes the renamed `src/utils/stack.test.ts`, which keeps every v2.11 test. There are no type errors.

- [ ] **Step 8: Lint and commit**

Run: `npx eslint $FILES` (with `FILES` from Step 2). Then:

```bash
git add $FILES   # the git mv in Step 1 already staged the rename
git commit -m "$(cat <<'EOF'
Rename creature squad field to stack; add Squad container types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 2: Pure squad rules (`src/utils/squads.ts`)

**Files:**
- Create: `src/utils/squads.ts`
- Test: `src/utils/squads.test.ts`

**Interfaces:**
- Consumes: `Creature`, `Squad`, `CrewAssignment` (Task 1), `nextStackName(baseName, qty, creatures)` from `./stack`.
- Produces (later tasks rely on these exact names):
  - `standingCount(c: Creature): number`: a stack counts its bodies; an individual counts 1 above 0 HP, else 0.
  - `isStanding(c: Creature): boolean`
  - `squadMembers(squad: Squad, creatures: Creature[]): Creature[]`: members in member order; unknown ids are skipped.
  - `squadStandingCount(squad: Squad, creatures: Creature[]): number`
  - `squadOf(creatureId: string, squads: Squad[]): Squad | undefined`
  - `isHalfStrength(squad: Squad, creatures: Creature[]): boolean`: VVTT rule 4.
  - `defaultHitTarget(squad: Squad, creatures: Creature[]): Creature | undefined`: VVTT rule 1.
  - `interface AreaShare { memberId: string; caught: number }` and `splitAreaCount(total: number, members: Creature[]): AreaShare[]`: VVTT rule 2.
  - `fallbackSaver(squad: Squad, creatures: Creature[]): Creature | undefined`: VVTT rule 3. It never returns the leader or a PC.
  - `dexModifier(c: Creature): number`
  - `squadInitiativeBonus(squad: Squad, creatures: Creature[]): number`: VVTT rule 5 for an uncommanded squad.
  - `placeCommandedSquads(order: string[], squads: Squad[], crewAssignments: CrewAssignment[]): string[]`: VVTT rule 5 for a commanded squad.
  - `interface SquadGroup { squad?: Squad; members: Creature[] }` and `groupBySquad(list: Creature[], squads: Squad[]): SquadGroup[]`
  - `staffableCreatures(creatures: Creature[], squads: Squad[], crewAssignments: CrewAssignment[]): Creature[]`
  - `toStaffMember(base: Creature, qty: number, existing: Creature[]): Creature`
  - `newSquadName(squads: Squad[]): string`

- [ ] **Step 1: Write the failing tests** in `src/utils/squads.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  standingCount, isStanding, squadMembers, squadStandingCount, squadOf, isHalfStrength, defaultHitTarget,
  splitAreaCount, fallbackSaver, dexModifier, squadInitiativeBonus, placeCommandedSquads, groupBySquad,
  staffableCreatures, toStaffMember, newSquadName,
} from './squads';
import type { Creature, Squad } from '../types';

const ind = (id: string, currentHp = 10, over: Partial<Creature> = {}) => ({
  id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { name: id, type: 'humanoid', maxHp: 10, ac: 12, abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } },
  ...over,
}) as unknown as Creature;
const stk = (id: string, bodies: number, size = bodies) => ind(id, bodies === 0 ? 0 : 11, { stack: { size, bodies } });
const pc = (id: string) => ind(id, 30, { faction: 'party', statblock: { name: id, type: 'pc', maxHp: 30, ac: 15 } } as Partial<Creature>);
const sq = (memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id: 'S', name: 'Tower Guard', faction: 'enemy', memberIds, startingCount: 0, ...over });

// The tower: captain (leader), Hobgoblin ×8, archers ×4, Karkajuk
const tower = () => [ind('k', 39), stk('h', 8), stk('a', 4), ind('j', 52)];
const towerSquad = (over: Partial<Squad> = {}) => sq(['k', 'h', 'a', 'j'], { leaderId: 'k', startingCount: 14, ...over });

describe('standing count', () => {
  it('a stack counts bodies, an individual counts 1 above 0 HP', () => {
    expect(standingCount(stk('h', 8))).toBe(8);
    expect(standingCount(stk('h', 0, 8))).toBe(0);
    expect(standingCount(ind('k', 39))).toBe(1);
    expect(standingCount(ind('k', 0))).toBe(0);
    expect(isStanding(ind('k', 0))).toBe(false);
  });
  it('sums a squad, in member order, skipping unknown ids', () => {
    const s = sq(['j', 'ghost', 'h']);
    expect(squadMembers(s, tower()).map((c) => c.id)).toEqual(['j', 'h']);
    expect(squadStandingCount(towerSquad(), tower())).toBe(14);
    expect(squadOf('a', [towerSquad()])?.id).toBe('S');
    expect(squadOf('zzz', [towerSquad()])).toBeUndefined();
  });
  it('VVTT rule 4: half strength is at or below half the starting count', () => {
    const hurt = [ind('k', 39), stk('h', 2, 8), stk('a', 3, 4), ind('j', 52)]; // 7 of 14
    expect(isHalfStrength(towerSquad(), hurt)).toBe(true);
    expect(isHalfStrength(towerSquad(), [ind('k', 39), stk('h', 3, 8), stk('a', 3, 4), ind('j', 52)])).toBe(false);
    expect(isHalfStrength(towerSquad({ startingCount: 0 }), hurt)).toBe(false);
  });
});

describe('VVTT rule 1: default hit target', () => {
  it('is the largest standing stack, never the leader', () => {
    expect(defaultHitTarget(towerSquad(), tower())?.id).toBe('h');
  });
  it('breaks ties by member order', () => {
    expect(defaultHitTarget(sq(['a', 'b']), [stk('a', 4), stk('b', 4)])?.id).toBe('a');
  });
  it('falls back to the first standing non-leader, then the leader, then nothing', () => {
    expect(defaultHitTarget(sq(['k', 'j'], { leaderId: 'k' }), [ind('k'), ind('j')])?.id).toBe('j');
    expect(defaultHitTarget(sq(['k', 'j'], { leaderId: 'k' }), [ind('k'), ind('j', 0)])?.id).toBe('k');
    expect(defaultHitTarget(sq(['k']), [ind('k', 0)])).toBeUndefined();
  });
});

describe('VVTT rule 2: area split', () => {
  const caught = (total: number, members: Creature[]) => splitAreaCount(total, members).map((a) => a.caught);
  it('splits in proportion to standing bodies', () => {
    expect(caught(6, [stk('h', 8), stk('a', 4)])).toEqual([4, 2]);
  });
  it('uses the largest remainder, ties to the first member; an individual counts 1', () => {
    expect(caught(4, tower())).toEqual([1, 2, 1, 0]);
    expect(caught(2, [ind('x'), ind('y'), ind('z')])).toEqual([1, 1, 0]);
  });
  it('caps at what is standing and never assigns more than a member has', () => {
    expect(caught(20, tower())).toEqual([1, 8, 4, 1]);
    expect(caught(3, [stk('h', 0, 8), stk('a', 4), ind('j', 0)])).toEqual([0, 3, 0]);
    expect(caught(0, tower())).toEqual([0, 0, 0, 0]);
    expect(splitAreaCount(4, tower()).map((a) => a.memberId)).toEqual(['k', 'h', 'a', 'j']);
  });
});

describe('VVTT rule 3: morale saver without a leader', () => {
  it('is the largest standing stack, never the leader or a PC', () => {
    expect(fallbackSaver(towerSquad(), tower())?.id).toBe('h');
    expect(fallbackSaver(sq(['a', 'b']), [stk('a', 4), stk('b', 4)])?.id).toBe('a');
  });
  it('with no stacks it is the first standing member', () => {
    expect(fallbackSaver(sq(['k', 'p', 'x', 'j'], { leaderId: 'k' }), [ind('k'), pc('p'), ind('x', 0), ind('j')])?.id).toBe('j');
    expect(fallbackSaver(sq(['k'], { leaderId: 'k' }), [ind('k')])).toBeUndefined();
  });
});

describe('VVTT rule 5: squad initiative', () => {
  it('uses the leader DEX modifier, else the first member, else 0', () => {
    expect(dexModifier(ind('k'))).toBe(2);
    const slow = ind('s', 10, { statblock: { name: 's', type: 'humanoid', maxHp: 10, ac: 12, abilities: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 } } } as Partial<Creature>);
    expect(squadInitiativeBonus(sq(['s', 'k'], { leaderId: 'k' }), [slow, ind('k')])).toBe(2);
    expect(squadInitiativeBonus(sq(['s', 'k']), [slow, ind('k')])).toBe(-1);
    expect(squadInitiativeBonus(sq([]), [])).toBe(0);
  });
  it('a commanded squad acts right after its commander', () => {
    const s = sq(['h'], { commanderId: 'p' });
    expect(placeCommandedSquads(['S', 'a', 'p', 'b'], [s], [])).toEqual(['a', 'p', 'S', 'b']);
  });
  it('after the commander\'s vehicle when the commander is crew; unchanged without an anchor or a commander', () => {
    const s = sq(['h'], { commanderId: 'p' });
    const crew = [{ creatureId: 'p', vehicleId: 'v', zoneId: 'helm' }];
    expect(placeCommandedSquads(['S', 'v', 'b'], [s], crew)).toEqual(['v', 'S', 'b']);
    expect(placeCommandedSquads(['a', 'S', 'b'], [s], [])).toEqual(['a', 'S', 'b']);
    expect(placeCommandedSquads(['S', 'p'], [sq(['h'])], [])).toEqual(['S', 'p']);
  });
});

describe('grouping and staffing', () => {
  it('groupBySquad lists standalone creatures first, then each squad in member order', () => {
    const list = [ind('x'), ind('k'), stk('h', 8), ind('y')];
    const groups = groupBySquad(list, [sq(['h', 'k'], { id: 'A' }), sq(['nobody'], { id: 'B' })]);
    expect(groups.map((g) => [g.squad?.id, g.members.map((c) => c.id)])).toEqual([[undefined, ['x', 'y']], ['A', ['h', 'k']]]);
  });
  it('staffableCreatures excludes members, crew and commanders', () => {
    const creatures = [ind('free'), ind('m'), ind('c'), pc('p')];
    const out = staffableCreatures(creatures, [sq(['m'], { commanderId: 'p' })], [{ creatureId: 'c', vehicleId: 'v', zoneId: 'helm' }]);
    expect(out.map((c) => c.id)).toEqual(['free']);
  });
  it('toStaffMember: quantity 1 is an individual, 2+ is one stack', () => {
    const base = ind('h', 11, { name: 'Hobgoblin' });
    expect(toStaffMember(base, 1, [])).toBe(base);
    expect(toStaffMember(base, 8, [])).toMatchObject({ name: 'Hobgoblin ×8 (A)', stack: { size: 8, bodies: 8 } });
  });
  it('newSquadName picks the first free "Squad N"', () => {
    expect(newSquadName([])).toBe('Squad 1');
    expect(newSquadName([sq([], { name: 'Squad 2' }), sq([], { name: 'Tower Guard' })])).toBe('Squad 3');
    expect(newSquadName([sq([], { name: 'Squad 2' })])).toBe('Squad 3');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/utils/squads.test.ts`

Expected: FAIL (cannot resolve `./squads`).

- [ ] **Step 3: Implement `src/utils/squads.ts`**

```ts
/**
 * Battle mode squads: the container (v2.13.0). Pure rules.
 * Spec: docs/superpowers/specs/2026-10-20-battle-mode-squads-tab-design.md. Rules not in the books are
 * VVTT rules, numbered as in the spec.
 */
import type { CrewAssignment, Creature, Squad } from '../types';
import { nextStackName } from './stack';

/** A stack stands while it has bodies; an individual while above 0 HP. */
export function standingCount(c: Creature): number {
  if (c.stack) return Math.max(0, c.stack.bodies);
  return c.currentHp > 0 ? 1 : 0;
}

export const isStanding = (c: Creature): boolean => standingCount(c) > 0;

export function squadMembers(squad: Squad, creatures: Creature[]): Creature[] {
  const byId = new Map(creatures.map((c) => [c.id, c]));
  return squad.memberIds.map((id) => byId.get(id)).filter((c): c is Creature => c !== undefined);
}

export function squadStandingCount(squad: Squad, creatures: Creature[]): number {
  return squadMembers(squad, creatures).reduce((sum, c) => sum + standingCount(c), 0);
}

export function squadOf(creatureId: string, squads: Squad[]): Squad | undefined {
  return squads.find((s) => s.memberIds.includes(creatureId));
}

/** VVTT rule 4: at or below half of the starting count (each stack body counts 1, each individual counts 1). */
export function isHalfStrength(squad: Squad, creatures: Creature[]): boolean {
  return squad.startingCount > 0 && squadStandingCount(squad, creatures) <= squad.startingCount / 2;
}

const largestStack = (list: Creature[]): Creature | undefined => {
  const stacks = list.filter((c) => c.stack);
  if (stacks.length === 0) return undefined;
  return stacks.reduce((best, c) => ((c.stack?.bodies ?? 0) > (best.stack?.bodies ?? 0) ? c : best));
};

/**
 * VVTT rule 1: in 5e the attacker picks the target; the default is the largest standing stack (the front rank,
 * ties to the first in member order). The leader is never the default unless nobody else stands.
 */
export function defaultHitTarget(squad: Squad, creatures: Creature[]): Creature | undefined {
  const standing = squadMembers(squad, creatures).filter(isStanding);
  const others = standing.filter((c) => c.id !== squad.leaderId);
  return largestStack(others) ?? others[0] ?? standing[0];
}

export interface AreaShare { memberId: string; caught: number }

/**
 * VVTT rule 2: split an area's total across members in proportion to their standing bodies (an individual
 * counts 1), largest-remainder rounding (ties to the first member), never more than a member has standing.
 */
export function splitAreaCount(total: number, members: Creature[]): AreaShare[] {
  const counts = members.map(standingCount);
  const pool = counts.reduce((a, b) => a + b, 0);
  const t = Math.max(0, Math.min(Math.floor(total), pool));
  if (t === 0) return members.map((m) => ({ memberId: m.id, caught: 0 }));
  const caught = counts.map((n) => Math.floor((n * t) / pool));
  const remainder = counts.map((n) => (n * t) % pool);
  let left = t - caught.reduce((a, b) => a + b, 0);
  const order = counts.map((_, i) => i).sort((a, b) => remainder[b] - remainder[a] || a - b);
  for (const i of order) {
    if (left === 0) break;
    if (caught[i] < counts[i]) {
      caught[i] += 1;
      left -= 1;
    }
  }
  return members.map((m, i) => ({ memberId: m.id, caught: caught[i] }));
}

/**
 * VVTT rule 3: with the leader down or absent, the largest standing stack saves (ties to the first in member order);
 * with no stacks, the first standing member. PCs never make morale saves.
 */
export function fallbackSaver(squad: Squad, creatures: Creature[]): Creature | undefined {
  const candidates = squadMembers(squad, creatures).filter(
    (c) => isStanding(c) && c.id !== squad.leaderId && c.statblock.type !== 'pc',
  );
  return largestStack(candidates) ?? candidates[0];
}

export const dexModifier = (c: Creature): number => Math.floor(((c.statblock.abilities?.dex ?? 10) - 10) / 2);

/** VVTT rule 5 (no commander): the squad rolls d20 + its leader's DEX modifier, else its first member's. */
export function squadInitiativeBonus(squad: Squad, creatures: Creature[]): number {
  const members = squadMembers(squad, creatures);
  const source = members.find((c) => c.id === squad.leaderId) ?? members[0];
  return source ? dexModifier(source) : 0;
}

/**
 * VVTT rule 5 (commanded): a commanded squad acts immediately after its commander, or after the vehicle the
 * commander crews. A commanded squad with neither in the order keeps its place.
 */
export function placeCommandedSquads(order: string[], squads: Squad[], crewAssignments: CrewAssignment[]): string[] {
  const anchorOf = new Map<string, string>();
  for (const s of squads) {
    if (!s.commanderId || !order.includes(s.id)) continue;
    const vehicleId = crewAssignments.find((a) => a.creatureId === s.commanderId)?.vehicleId;
    const anchor = order.includes(s.commanderId) ? s.commanderId : vehicleId && order.includes(vehicleId) ? vehicleId : undefined;
    if (anchor) anchorOf.set(s.id, anchor);
  }
  if (anchorOf.size === 0) return order;
  const out: string[] = [];
  for (const id of order) {
    if (anchorOf.has(id)) continue;
    out.push(id);
    for (const s of squads) if (anchorOf.get(s.id) === id) out.push(s.id);
  }
  return out;
}

export interface SquadGroup { squad?: Squad; members: Creature[] }

/** Sidebar order: standalone creatures of `list` first, then each squad's members of `list` (member order). */
export function groupBySquad(list: Creature[], squads: Squad[]): SquadGroup[] {
  const inList = new Map(list.map((c) => [c.id, c]));
  const grouped = new Set(squads.flatMap((s) => s.memberIds));
  const groups: SquadGroup[] = [{ members: list.filter((c) => !grouped.has(c.id)) }];
  for (const squad of squads) {
    const members = squad.memberIds.map((id) => inList.get(id)).filter((c): c is Creature => c !== undefined);
    if (members.length > 0) groups.push({ squad, members });
  }
  return groups;
}

/** "Existing creature…" choices: standalone creatures that are not crew and command no squad. */
export function staffableCreatures(creatures: Creature[], squads: Squad[], crewAssignments: CrewAssignment[]): Creature[] {
  const taken = new Set([
    ...squads.flatMap((s) => s.memberIds),
    ...squads.flatMap((s) => (s.commanderId ? [s.commanderId] : [])),
    ...crewAssignments.map((a) => a.creatureId),
  ]);
  return creatures.filter((c) => !taken.has(c.id));
}

/** Staffing from a monster or custom NPC: quantity 1 adds an individual, 2 or more adds one stack. */
export function toStaffMember(base: Creature, qty: number, existing: Creature[]): Creature {
  if (qty <= 1) return base;
  return { ...base, name: nextStackName(base.name, qty, existing), stack: { size: qty, bodies: qty } };
}

export function newSquadName(squads: Squad[]): string {
  let n = squads.length + 1;
  while (squads.some((s) => s.name === `Squad ${n}`)) n += 1;
  return `Squad ${n}`;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run src/utils/squads.test.ts`

Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc -p tsconfig.app.json && npx eslint src/utils/squads.ts src/utils/squads.test.ts`. Then:

```bash
git add src/utils/squads.ts src/utils/squads.test.ts
git commit -m "$(cat <<'EOF'
Squad rules: standing count, VVTT rules 1-5, grouping and staffing helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Migrate v2.11/v2.12 saves (`migrateSquads`)

**Files:**
- Create: `src/utils/migrateSquads.ts`
- Test: `src/utils/migrateSquads.test.ts`, `src/context/combatReducer.test.ts` (append)
- Modify: `src/context/CombatContext.tsx`: the `LOAD_ENCOUNTER` case and `getInitialState`.

**Interfaces:**
- Consumes: `Squad`, `Creature`, `MoralePrompt`, `CombatState` (Task 1).
- Produces:
  - `interface LegacyStack { size: number; bodies: number; leaderId?: string }`
  - `type LegacyCreature = Creature & { squad?: LegacyStack }`
  - `type SquadMigratable = Partial<Omit<CombatState, 'creatures'>> & { creatures?: LegacyCreature[] }`
  - `type SquadMigrated = Partial<CombatState> & Pick<CombatState, 'creatures' | 'squads'>`
  - `migrateSquads(state: SquadMigratable, newId: () => string): SquadMigrated`. It is idempotent: if `state.squads` and `state.creatures` exist and no creature has `squad`, it returns `state` itself.

Two decisions beyond the spec, both needed for the migration to work:
- A migrated squad copies the old creature's `initiative`, so the squad keeps its place when rounds re-sort.
- Crew assignments of migrated stack creatures are dropped, because a squad member cannot be crew.

- [ ] **Step 1: Write the failing unit tests** in `src/utils/migrateSquads.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { migrateSquads, type LegacyCreature } from './migrateSquads';
import type { MoralePrompt } from '../types';

const ids = () => {
  let i = 0;
  return () => `sq${++i}`;
};
const cr = (id: string, over: Partial<LegacyCreature> = {}) => ({
  id, name: id, currentHp: 10, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { type: 'humanoid', maxHp: 10 }, ...over,
}) as unknown as LegacyCreature;
const legacyStack = (id: string, size: number, bodies: number, leaderId?: string, over: Partial<LegacyCreature> = {}) =>
  cr(id, { name: `Hob ${id}`, squad: { size, bodies, ...(leaderId ? { leaderId } : {}) }, ...over });

describe('migrateSquads', () => {
  it('turns a plain v2.11 squad into a one-member Squad holding a stack', () => {
    const out = migrateSquads({ creatures: [legacyStack('a', 10, 7, undefined, { initiative: 12, position: { x: 1, y: 2 }, faction: 'party' })] }, ids());
    expect(out.squads).toEqual([{ id: 'sq1', name: 'Hob a', faction: 'party', memberIds: ['a'], position: { x: 1, y: 2 }, initiative: 12, startingCount: 10 }]);
    expect(out.creatures[0].stack).toEqual({ size: 10, bodies: 7 });
    expect('squad' in out.creatures[0]).toBe(false);
  });

  it('a v2.12 leader joins the squad and leads it; startingCount counts it', () => {
    const out = migrateSquads({ creatures: [cr('k'), legacyStack('a', 8, 6, 'k')] }, ids());
    expect(out.squads[0]).toMatchObject({ memberIds: ['a', 'k'], leaderId: 'k', startingCount: 9 });
  });

  it('a leader shared by several squads joins only the first; the others have no leader', () => {
    const out = migrateSquads({ creatures: [cr('k'), legacyStack('a', 5, 5, 'k'), legacyStack('b', 5, 5, 'k')] }, ids());
    expect(out.squads.map((s) => [s.memberIds, s.leaderId])).toEqual([[['a', 'k'], 'k'], [['b'], undefined]]);
  });

  it('a leader who is crew, missing, or itself a stack is not joined', () => {
    const crew = [{ creatureId: 'k', vehicleId: 'v', zoneId: 'helm' }];
    expect(migrateSquads({ creatures: [cr('k'), legacyStack('a', 5, 5, 'k')], crewAssignments: crew }, ids()).squads[0].memberIds).toEqual(['a']);
    expect(migrateSquads({ creatures: [legacyStack('a', 5, 5, 'gone')] }, ids()).squads[0].leaderId).toBeUndefined();
    expect(migrateSquads({ creatures: [legacyStack('b', 5, 5), legacyStack('a', 5, 5, 'b')] }, ids()).squads[1].memberIds).toEqual(['a']);
  });

  it('swaps stack ids for squad ids in initiative, drops a joined leader\'s slot and keeps the current turn', () => {
    const out = migrateSquads({
      creatures: [cr('x'), cr('k'), legacyStack('a', 5, 5, 'k'), legacyStack('b', 5, 5)],
      initiativeOrder: ['x', 'k', 'a', 'b'], currentTurnIndex: 2,
    }, ids());
    expect(out.initiativeOrder).toEqual(['x', 'sq1', 'sq2']);
    expect(out.currentTurnIndex).toBe(1);
  });

  it('re-points open prompts and moves morale to the squad', () => {
    const prompts: MoralePrompt[] = [
      { id: 'm1', creatureId: 'a', trigger: 'half-size' },
      { id: 'm2', creatureId: 'x', trigger: 'manual' },
    ];
    const out = migrateSquads({
      creatures: [cr('x'), legacyStack('a', 10, 5, undefined, { morale: { asked: ['half-size'] } })],
      moralePrompts: prompts,
    }, ids());
    expect(out.moralePrompts).toEqual([
      { id: 'm1', squadId: 'sq1', trigger: 'half-size' },
      { id: 'm2', creatureId: 'x', trigger: 'manual' },
    ]);
    expect(out.squads[0].morale).toEqual({ asked: ['half-size'] });
    expect(out.creatures[1].morale).toBeUndefined();
  });

  it('is idempotent, and gives state without squads an empty list', () => {
    const once = migrateSquads({ creatures: [legacyStack('a', 5, 5)] }, ids());
    expect(migrateSquads(once, ids())).toBe(once);
    expect(migrateSquads({ creatures: [cr('x')] }, ids()).squads).toEqual([]);
  });
});
```

- [ ] **Step 2: Append the failing reducer test** to `src/context/combatReducer.test.ts`

Change the type import at the top to `import type { CombatState, Creature, Squad, Vehicle } from '../types';`. `Squad` is used from Task 4 on. Then append:

```ts
describe('squad migration on load', () => {
  it('LOAD_ENCOUNTER turns a v2.12 squad creature into a Squad holding a stack', () => {
    const legacy = {
      ...initialCombatState, phase: 'combat' as const, round: 2,
      creatures: [
        { id: 'k', name: 'Captain', currentHp: 39, tempHp: 0, conditions: [], initiative: 18, initiativeModifier: 0, faction: 'enemy', statblock: { type: 'humanoid', maxHp: 39 } },
        { id: 'a', name: 'Hobgoblin ×8 (A)', currentHp: 11, tempHp: 0, conditions: [], initiative: 14, initiativeModifier: 1, faction: 'enemy', position: { x: 3, y: 4 }, statblock: { type: 'humanoid', maxHp: 11 }, squad: { size: 8, bodies: 6, leaderId: 'k' } },
      ],
      initiativeOrder: ['k', 'a'], currentTurnIndex: 1,
    } as unknown as CombatState;
    const out = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: legacy });
    expect(out.squads).toHaveLength(1);
    const squad = out.squads[0];
    expect(squad).toMatchObject({ name: 'Hobgoblin ×8 (A)', memberIds: ['a', 'k'], leaderId: 'k', startingCount: 9, position: { x: 3, y: 4 }, initiative: 14 });
    expect(out.creatures[1].stack).toEqual({ size: 8, bodies: 6 });
    // members are never re-added to initiative by the load safety net
    expect(out.initiativeOrder).toEqual([squad.id]);
    expect(out.currentTurnIndex).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/utils/migrateSquads.test.ts src/context/combatReducer.test.ts`

Expected: `migrateSquads.test.ts` fails to resolve the module. The new reducer test fails because `squads` is empty.

- [ ] **Step 4: Implement `src/utils/migrateSquads.ts`**

```ts
/**
 * Saves from v2.11/v2.12 stored a squad as one creature with `squad: { size, bodies, leaderId? }`. Each becomes
 * a stack member of a new Squad container (spec "Migration"). Pure and idempotent.
 */
import type { CombatState, Creature, MoralePrompt, Squad } from '../types';

export interface LegacyStack { size: number; bodies: number; leaderId?: string }
export type LegacyCreature = Creature & { squad?: LegacyStack };
export type SquadMigratable = Partial<Omit<CombatState, 'creatures'>> & { creatures?: LegacyCreature[] };
export type SquadMigrated = Partial<CombatState> & Pick<CombatState, 'creatures' | 'squads'>;

export function migrateSquads(state: SquadMigratable, newId: () => string): SquadMigrated {
  const creaturesIn = state.creatures ?? [];
  const legacy = creaturesIn.filter((c) => c.squad);
  if (legacy.length === 0) {
    if (state.squads && state.creatures) return state as SquadMigrated;
    return { ...state, creatures: creaturesIn, squads: state.squads ?? [] };
  }

  const crew = new Set((state.crewAssignments ?? []).map((a) => a.creatureId));
  const legacyIds = new Set(legacy.map((c) => c.id));
  const claimed = new Set((state.squads ?? []).flatMap((s) => s.memberIds));
  const squadIdFor = new Map<string, string>(); // old stack creature id → new squad id
  const joinedLeaders = new Set<string>();
  const newSquads: Squad[] = [];

  for (const c of legacy) {
    const old = c.squad as LegacyStack;
    const id = newId();
    squadIdFor.set(c.id, id);
    claimed.add(c.id);
    const L = old.leaderId;
    // One squad per creature: a leader joins only the first squad it led
    const leaderId = L && L !== c.id && !legacyIds.has(L) && !claimed.has(L) && !crew.has(L) && creaturesIn.some((x) => x.id === L)
      ? L
      : undefined;
    if (leaderId) {
      claimed.add(leaderId);
      joinedLeaders.add(leaderId);
    }
    newSquads.push({
      id,
      name: c.name,
      faction: c.faction ?? 'enemy',
      memberIds: leaderId ? [c.id, leaderId] : [c.id],
      ...(leaderId ? { leaderId } : {}),
      ...(c.position ? { position: c.position } : {}),
      initiative: c.initiative,
      startingCount: old.size + (leaderId ? 1 : 0),
      ...(c.morale ? { morale: c.morale } : {}),
    });
  }

  const creatures: Creature[] = creaturesIn.map((c) => {
    const old = c.squad;
    if (!old) return c;
    const { squad: _squad, morale: _morale, ...rest } = c;
    return { ...rest, stack: { size: old.size, bodies: old.bodies } };
  });

  const orderIn = state.initiativeOrder ?? [];
  const turn = state.currentTurnIndex ?? 0;
  const initiativeOrder: string[] = [];
  let currentTurnIndex = 0;
  orderIn.forEach((id, i) => {
    if (i === turn) currentTurnIndex = initiativeOrder.length;
    if (joinedLeaders.has(id)) return;
    initiativeOrder.push(squadIdFor.get(id) ?? id);
  });
  currentTurnIndex = Math.min(currentTurnIndex, Math.max(0, initiativeOrder.length - 1));

  const moralePrompts: MoralePrompt[] = (state.moralePrompts ?? []).map((p) => {
    const squadId = p.creatureId ? squadIdFor.get(p.creatureId) : undefined;
    if (!squadId) return p;
    const { creatureId: _creatureId, ...rest } = p;
    return { ...rest, squadId };
  });

  return {
    ...state,
    creatures,
    squads: [...(state.squads ?? []), ...newSquads],
    initiativeOrder,
    currentTurnIndex,
    moralePrompts,
    crewAssignments: (state.crewAssignments ?? []).filter((a) => !squadIdFor.has(a.creatureId)),
  };
}
```

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run src/utils/migrateSquads.test.ts`

Expected: PASS.

- [ ] **Step 6: Wire the migration into `LOAD_ENCOUNTER`**

In `src/context/CombatContext.tsx`, add the import `import { migrateSquads, type SquadMigratable } from '../utils/migrateSquads';`.

In `case 'LOAD_ENCOUNTER': {`, make this the first line:

```ts
      // v2.11/v2.12 squads → Squad containers (spec "Migration"); a no-op for current saves
      const payload = { ...action.payload, ...migrateSquads(action.payload, () => uuid()) } as CombatState;
```

Then, inside this case only, replace every remaining `action.payload` with `payload`. There are about 15 occurrences, including `...action.payload,` in the return.

Exclude squad members from the combat safety net. Replace:

```ts
        const assignedCreatureIds = new Set(migratedCrewAssignments.map((a) => a.creatureId));
        const creaturesOnBattlefield = migratedCreatures.filter(
          (c) => c.position && !assignedCreatureIds.has(c.id) && !migratedInitiativeOrder.includes(c.id)
        );
```

with:

```ts
        const assignedCreatureIds = new Set(migratedCrewAssignments.map((a) => a.creatureId));
        const squadMemberIds = new Set((payload.squads ?? []).flatMap((s) => s.memberIds));
        const creaturesOnBattlefield = migratedCreatures.filter(
          (c) => c.position && !assignedCreatureIds.has(c.id) && !squadMemberIds.has(c.id) && !migratedInitiativeOrder.includes(c.id)
        );
```

Change the Task 1 line `squads: action.payload.squads || [],` to `squads: payload.squads ?? [],`.

- [ ] **Step 7: Wire the migration into `getInitialState` (autosave restore)**

Replace:

```ts
      const loadedState = saved as Partial<CombatState>;
```

with:

```ts
      // v2.11/v2.12 squads → Squad containers (spec "Migration"); a no-op for current saves
      const rawSaved = saved as SquadMigratable;
      const loadedState = { ...rawSaved, ...migrateSquads(rawSaved, () => uuid()) } as Partial<CombatState>;
```

In `restoredState`, after `crewAssignments: loadedState.crewAssignments || [],`, add `squads: loadedState.squads ?? [],`.

The other load paths are already covered. `Header.tsx` loads saved encounters through `loadEncounter` → `LOAD_ENCOUNTER`. The player view only receives the DM's already-migrated state. Party presets are handled in Task 4.

- [ ] **Step 8: Run the suite and type-check**

Run: `npx vitest run && npx tsc -p tsconfig.app.json`

Expected: PASS and no type errors.

- [ ] **Step 9: Lint and commit**

Run: `npx eslint src/utils/migrateSquads.ts src/utils/migrateSquads.test.ts src/context/CombatContext.tsx src/context/combatReducer.test.ts`. Then:

```bash
git add src/utils/migrateSquads.ts src/utils/migrateSquads.test.ts src/context/CombatContext.tsx src/context/combatReducer.test.ts
git commit -m "$(cat <<'EOF'
Migrate v2.11/v2.12 squad creatures into Squad containers on load and restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 4: Reducer: squad actions, initiative, presets, reset, crew

**Files:**
- Modify: `src/context/CombatContext.tsx`
- Modify (dispatch shape only): `src/components/squads/SquadRowControls.tsx`, `src/components/squads/SquadAttackPanel.tsx`, `src/components/squads/SquadAreaDialog.tsx`
- Test: `src/context/combatReducer.test.ts`

**Interfaces:**
- Consumes:
  - `Squad`, `SquadUpdates` (Task 1);
  - `placeCommandedSquads`, `squadOf`, `squadStandingCount`, `standingCount` (Task 2);
  - `LegacyCreature` (Task 3);
  - `normalizeStack`, `applyStackHitsToState` (Task 1).
- Produces these `CombatAction` members, which later tasks dispatch exactly:
  - `{ type: 'ADD_SQUAD'; payload: Squad }`
  - `{ type: 'UPDATE_SQUAD'; payload: { id: string; updates: SquadUpdates } }`
  - `{ type: 'REMOVE_SQUAD'; payload: { id: string; deleteMembers: boolean } }`
  - `{ type: 'ADD_SQUAD_MEMBER'; payload: { squadId: string; creatureId?: string; creature?: Creature } }`. A `creature` is a new creature to add to the encounter, and it takes the squad's faction.
  - `{ type: 'REMOVE_SQUAD_MEMBER'; payload: { squadId: string; creatureId: string } }`
  - `{ type: 'SPLIT_STACK'; payload: { creatureId: string } }`
  - `{ type: 'GROW_STACK'; payload: { creatureId: string; amount: number } }`
  - `{ type: 'SQUAD_HIT'; payload: { squadId?: string; memberId: string; hits: number[]; source?: string } }`. It replaces `SQUAD_HITS`. `squadId` is omitted for a standalone stack.
  - `{ type: 'SQUAD_AREA'; payload: { squadId?: string; members: SquadAreaMemberResult[]; summary: string; details?: string } }` with `export interface SquadAreaMemberResult { memberId: string; currentHp: number; bodies?: number; tempHp?: number }`, exported from `CombatContext.tsx`.
  - The context value gains `currentTurnSquad: Squad | undefined`.

Rules decided here, beyond the spec's wording:
- During combat, removing a member (Remove, Split off 1, Delete creature) subtracts that member's standing count from `startingCount`. This mirrors staffing, which adds it.
- `REMOVE_CREATURE` keeps today's turn-order handling for everyone.

- [ ] **Step 1: Update the existing tests for the new action shapes**

In `src/context/combatReducer.test.ts`:

```bash
perl -pi -e "s/type: 'SQUAD_HITS', payload: \{ creatureId:/type: 'SQUAD_HIT', payload: { memberId:/g" src/context/combatReducer.test.ts
```

Edit the two `SQUAD_AREA` payloads to the per-member shape:

```ts
      type: 'SQUAD_AREA', payload: { members: [{ memberId: 'a', currentHp: 1, bodies: 6 }], summary: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' },
```

```ts
      const out = combatReducer(led(), { type: 'SQUAD_AREA', payload: { members: [{ memberId: 'a', currentHp: 11, bodies: 8 }], summary: 's' } });
```

Delete the test `'LOAD_PARTY_PRESET remaps squad leaderId and strips morale'`. Presets no longer carry leaders.

- [ ] **Step 2: Append the failing tests**

```ts
describe('battle mode squads tab', () => {
  const sb = (name: string, type: string, maxHp: number, ac: number) =>
    ({ name, type, maxHp, ac, abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 } }) as unknown as Creature['statblock'];
  const ind = (id: string, over: Partial<Creature> = {}) => ({
    id, name: id, currentHp: 10, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 0, faction: 'enemy',
    statblock: sb(id, 'humanoid', 10, 12), ...over,
  }) as unknown as Creature;
  const stk = (id: string, bodies: number, size = bodies) =>
    ind(id, { name: `Hobgoblin ×${size}`, currentHp: bodies === 0 ? 0 : 11, statblock: sb('Hobgoblin', 'humanoid', 11, 18), stack: { size, bodies } });
  const pc = (id: string, initiative = 15) => ind(id, { initiative, faction: 'party', statblock: sb(id, 'pc', 30, 15) });
  const sq = (id: string, memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id, name: id, faction: 'enemy', memberIds, startingCount: 0, ...over });
  const setup = (creatures: Creature[], squads: Squad[] = [], over: Partial<CombatState> = {}): CombatState => ({ ...initialCombatState, creatures, squads, ...over });
  const fight = (creatures: Creature[], squads: Squad[], initiativeOrder: string[], currentTurnIndex = 0) =>
    setup(creatures, squads, { phase: 'combat', round: 1, initiativeOrder, currentTurnIndex });
  const squadById = (s: CombatState, id: string) => s.squads.find((x) => x.id === id)!;

  it('ADD_SQUAD appends; UPDATE_SQUAD edits and ignores a leader who is not a member', () => {
    const added = combatReducer(setup([ind('k')]), { type: 'ADD_SQUAD', payload: sq('S', ['k']) });
    expect(added.squads).toHaveLength(1);
    const renamed = combatReducer(added, { type: 'UPDATE_SQUAD', payload: { id: 'S', updates: { name: 'Tower Guard', leaderId: 'k' } } });
    expect(squadById(renamed, 'S')).toMatchObject({ name: 'Tower Guard', leaderId: 'k' });
    const bad = combatReducer(renamed, { type: 'UPDATE_SQUAD', payload: { id: 'S', updates: { leaderId: 'nobody' } } });
    expect(squadById(bad, 'S').leaderId).toBe('k');
  });

  it('a commander must be a PC who is not a member and commands no other squad', () => {
    const s = setup([pc('p'), ind('k')], [sq('A', ['k']), sq('B', [])]);
    const a = combatReducer(s, { type: 'UPDATE_SQUAD', payload: { id: 'A', updates: { commanderId: 'p' } } });
    expect(squadById(a, 'A').commanderId).toBe('p');
    const b = combatReducer(a, { type: 'UPDATE_SQUAD', payload: { id: 'B', updates: { commanderId: 'p' } } });
    expect(squadById(b, 'B').commanderId).toBeUndefined();
    const npcCommander = combatReducer(s, { type: 'UPDATE_SQUAD', payload: { id: 'B', updates: { commanderId: 'k' } } });
    expect(squadById(npcCommander, 'B').commanderId).toBeUndefined();
    const cleared = combatReducer(a, { type: 'UPDATE_SQUAD', payload: { id: 'A', updates: { commanderId: undefined } } });
    expect(squadById(cleared, 'A').commanderId).toBeUndefined();
  });

  it('ADD_SQUAD_MEMBER staffs a standalone creature and recomputes the starting count in setup', () => {
    const s = setup([stk('h', 8), ind('k')], [sq('S', ['h'])]);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h', 'k'], startingCount: 9 });
  });

  it('ADD_SQUAD_MEMBER with a new creature adds it with the squad faction', () => {
    const out = combatReducer(setup([], [sq('S', [], { faction: 'party' })]), { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creature: stk('h', 8) } });
    expect(out.creatures[0]).toMatchObject({ id: 'h', faction: 'party' });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], startingCount: 8 });
  });

  it('ADD_SQUAD_MEMBER refuses crew, members of another squad, and commanders', () => {
    const s = setup([ind('c'), ind('m'), pc('p')], [sq('S', [], { commanderId: 'p' }), sq('T', ['m'])], { crewAssignments: [{ creatureId: 'c', vehicleId: 'v', zoneId: 'helm' }] });
    for (const creatureId of ['c', 'm', 'p']) {
      expect(combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId } })).toBe(s);
    }
  });

  it('ADD_SQUAD_MEMBER in combat adds the standing count and takes the creature out of the turn order', () => {
    const s = fight([stk('h', 8), ind('k')], [sq('S', ['h'], { startingCount: 8 })], ['k', 'S'], 1);
    const out = combatReducer(s, { type: 'ADD_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S').startingCount).toBe(9);
    expect(out.initiativeOrder).toEqual(['S']);
    expect(out.currentTurnIndex).toBe(0);
  });

  it('REMOVE_SQUAD_MEMBER makes a standalone creature at the squad position and clears the leader', () => {
    const s = setup([stk('h', 8), ind('k')], [sq('S', ['h', 'k'], { leaderId: 'k', position: { x: 5, y: 7 }, startingCount: 9 })]);
    const out = combatReducer(s, { type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], leaderId: undefined, startingCount: 8 });
    expect(out.creatures[1].position).toEqual({ x: 5, y: 7 });
  });

  it('REMOVE_SQUAD_MEMBER in combat acts right after the current turn and lowers the starting count', () => {
    const s = fight([stk('h', 8), ind('k'), ind('x')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S', 'x'], 0);
    const out = combatReducer(s, { type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: 'S', creatureId: 'k' } });
    expect(out.initiativeOrder).toEqual(['S', 'k', 'x']);
    expect(squadById(out, 'S').startingCount).toBe(8);
    expect(out.actionLog.at(-1)?.action).toBe('k leaves S');
  });

  it('SPLIT_STACK splits one body off as a fresh standalone creature', () => {
    const h = { ...stk('h', 8), currentHp: 5 };
    const s = setup([h], [sq('S', ['h'], { position: { x: 1, y: 2 }, startingCount: 8 })]);
    const out = combatReducer(s, { type: 'SPLIT_STACK', payload: { creatureId: 'h' } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 5, stack: { size: 7, bodies: 7 } });
    expect(out.creatures[1]).toMatchObject({ name: 'Hobgoblin', currentHp: 11, position: { x: 1, y: 2 } });
    expect(out.creatures[1].stack).toBeUndefined();
    expect(squadById(out, 'S')).toMatchObject({ memberIds: ['h'], startingCount: 7 });
    expect(combatReducer(setup([stk('h', 1)]), { type: 'SPLIT_STACK', payload: { creatureId: 'h' } }).creatures).toHaveLength(1);
  });

  it('GROW_STACK adds bodies (a wiped stack comes back with a full front body)', () => {
    const out = combatReducer(setup([stk('h', 0, 8)], [sq('S', ['h'])]), { type: 'GROW_STACK', payload: { creatureId: 'h', amount: 32 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { size: 40, bodies: 32 } });
    expect(squadById(out, 'S').startingCount).toBe(32);
  });

  it('REMOVE_SQUAD disbands (members stay, in member order after the current turn) or deletes members too', () => {
    const s = fight([stk('h', 8), ind('k'), ind('x')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['x', 'S'], 0);
    const disbanded = combatReducer(s, { type: 'REMOVE_SQUAD', payload: { id: 'S', deleteMembers: false } });
    expect(disbanded.squads).toEqual([]);
    expect(disbanded.creatures).toHaveLength(3);
    expect(disbanded.initiativeOrder).toEqual(['x', 'h', 'k']);
    const deleted = combatReducer(s, { type: 'REMOVE_SQUAD', payload: { id: 'S', deleteMembers: true } });
    expect(deleted.squads).toEqual([]);
    expect(deleted.creatures.map((c) => c.id)).toEqual(['x']);
    expect(deleted.initiativeOrder).toEqual(['x']);
  });

  it('SQUAD_HIT: a stack member loses front bodies; an individual takes normal damage', () => {
    const s = fight([stk('h', 8), ind('k', { tempHp: 3 })], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S']);
    const onStack = combatReducer(s, { type: 'SQUAD_HIT', payload: { squadId: 'S', memberId: 'h', hits: [11, 4] } });
    expect(onStack.creatures[0]).toMatchObject({ currentHp: 7, stack: { bodies: 7 } });
    const onLeader = combatReducer(s, { type: 'SQUAD_HIT', payload: { squadId: 'S', memberId: 'k', hits: [5, 4] } });
    expect(onLeader.creatures[1]).toMatchObject({ currentHp: 4, tempHp: 0 });
  });

  it('SQUAD_AREA stores each member result and logs once', () => {
    const s = fight([stk('h', 8), ind('k')], [sq('S', ['h', 'k'], { startingCount: 9 })], ['S']);
    const out = combatReducer(s, {
      type: 'SQUAD_AREA',
      payload: { squadId: 'S', members: [{ memberId: 'h', currentHp: 3, bodies: 5 }, { memberId: 'k', currentHp: 0, tempHp: 0 }], summary: 'Fireball on S', details: 'd' },
    });
    expect(out.creatures[0]).toMatchObject({ currentHp: 3, stack: { bodies: 5 } });
    expect(out.creatures[1].currentHp).toBe(0);
    expect(out.actionLog.at(-1)).toMatchObject({ type: 'damage', action: 'Fireball on S', details: 'd' });
  });

  it('REMOVE_CREATURE drops the creature from its squad, its leadership and any command', () => {
    const s = setup([stk('h', 8), ind('k'), pc('p')], [sq('S', ['h', 'k'], { leaderId: 'k', commanderId: 'p', startingCount: 9 })]);
    const noLeader = combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'k' });
    expect(squadById(noLeader, 'S')).toMatchObject({ memberIds: ['h'], leaderId: undefined, startingCount: 8 });
    expect(squadById(combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'p' }), 'S').commanderId).toBeUndefined();
  });

  it('LOAD_PARTY_PRESET clears squads, strips morale, and turns a legacy squad field into a stack', () => {
    const legacy = { ...ind('a'), squad: { size: 10, bodies: 7, leaderId: 'k' } } as unknown as Creature;
    const s = setup([ind('k')], [sq('S', ['k'])], { initiativeOrder: ['S'] });
    const out = combatReducer(s, { type: 'LOAD_PARTY_PRESET', payload: { vehicles: [], creatures: [ind('k', { morale: { asked: [], status: 'fleeing' } }), legacy], crewAssignments: [] } });
    expect(out.squads).toEqual([]);
    expect(out.initiativeOrder).toEqual([]);
    expect(out.creatures[0].morale).toBeUndefined();
    expect(out.creatures[1].stack).toEqual({ size: 10, bodies: 7 });
    expect('squad' in out.creatures[1]).toBe(false);
  });

  it('RESET_COMBAT keeps membership, restores bodies and clears squad morale and initiative', () => {
    const s = fight([stk('h', 2, 8)], [sq('S', ['h'], { startingCount: 8, initiative: 14, morale: { status: 'fleeing', asked: ['half-size'] } })], ['S']);
    const out = combatReducer(s, { type: 'RESET_COMBAT' });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, stack: { bodies: 8 } });
    expect(out.squads[0]).toEqual({ id: 'S', name: 'S', faction: 'enemy', memberIds: ['h'], startingCount: 8 });
  });

  it('ASSIGN_CREW refuses squad members', () => {
    const s = setup([ind('k')], [sq('S', ['k'])]);
    expect(combatReducer(s, { type: 'ASSIGN_CREW', payload: { creatureId: 'k', vehicleId: 'v', zoneId: 'helm' } })).toBe(s);
  });

  it('START_COMBAT gives each squad one slot, skips members and empty or wiped squads, and sets the starting count', () => {
    const s = setup(
      [ind('x', { initiative: 12 }), stk('h', 8), ind('k', { initiative: 20 }), stk('w', 0, 4)],
      [sq('S', ['h', 'k'], { initiative: 15 }), sq('E', []), sq('W', ['w'], { initiative: 30 })],
    );
    const out = combatReducer(s, { type: 'START_COMBAT' });
    expect(out.initiativeOrder).toEqual(['S', 'x']);
    expect(squadById(out, 'S').startingCount).toBe(9);
  });

  it('a commanded squad acts right after its commander, through NEXT_ROUND and manual reordering', () => {
    const s = setup([pc('p', 5), ind('x', { initiative: 12 }), stk('h', 8)], [sq('S', ['h'], { faction: 'party', commanderId: 'p', initiative: 20 })]);
    const started = combatReducer(s, { type: 'START_COMBAT' });
    expect(started.initiativeOrder).toEqual(['x', 'p', 'S']);
    const faster = { ...started, creatures: started.creatures.map((c) => (c.id === 'p' ? { ...c, initiative: 18 } : c)) };
    expect(combatReducer(faster, { type: 'NEXT_ROUND' }).initiativeOrder).toEqual(['p', 'S', 'x']);
    expect(combatReducer(started, { type: 'SET_INITIATIVE_ORDER', payload: ['S', 'p', 'x'] }).initiativeOrder).toEqual(['p', 'S', 'x']);
  });

  it('NEXT_TURN skips a squad with no one standing', () => {
    const s = fight([ind('x'), stk('h', 0, 8), ind('y')], [sq('S', ['h'], { startingCount: 8 })], ['x', 'S', 'y'], 0);
    const out = combatReducer(s, { type: 'NEXT_TURN' });
    expect(out.initiativeOrder[out.currentTurnIndex]).toBe('y');
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run src/context/combatReducer.test.ts`

Expected: the new tests fail (unknown action types, `squads` not handled). TypeScript errors in the test file are expected until Step 4.

- [ ] **Step 4: Add the action types and imports**

In `src/context/CombatContext.tsx`:
- Add `Squad` and `SquadUpdates` to the `../types` import.
- Add `import { placeCommandedSquads, squadOf, squadStandingCount, standingCount } from '../utils/squads';`.
- Add `type LegacyCreature` to the `../utils/migrateSquads` import.

Above `type CombatAction`, add:

```ts
/** One member's result from an area effect (computed and rolled in the UI). */
export interface SquadAreaMemberResult { memberId: string; currentHp: number; bodies?: number; tempHp?: number }
```

In `CombatAction`, replace the two lines `| { type: 'SQUAD_HITS'; … }` and `| { type: 'SQUAD_AREA'; … }` with:

```ts
  | { type: 'SQUAD_HIT'; payload: { squadId?: string; memberId: string; hits: number[]; source?: string } }
  | { type: 'SQUAD_AREA'; payload: { squadId?: string; members: SquadAreaMemberResult[]; summary: string; details?: string } }

  // Battle mode squads (v2.13.0)
  | { type: 'ADD_SQUAD'; payload: Squad }
  | { type: 'UPDATE_SQUAD'; payload: { id: string; updates: SquadUpdates } }
  | { type: 'REMOVE_SQUAD'; payload: { id: string; deleteMembers: boolean } }
  | { type: 'ADD_SQUAD_MEMBER'; payload: { squadId: string; creatureId?: string; creature?: Creature } }
  | { type: 'REMOVE_SQUAD_MEMBER'; payload: { squadId: string; creatureId: string } }
  | { type: 'SPLIT_STACK'; payload: { creatureId: string } }
  | { type: 'GROW_STACK'; payload: { creatureId: string; amount: number } }
```

- [ ] **Step 5: Add the squad helpers**

Add these after `applyStackHitsToState`, at the bottom of the helpers section:

```ts
/** Battle mode: drop an id from the turn order, keeping the current turn on the same entry. */
function removeFromOrder(state: CombatState, id: string): Pick<CombatState, 'initiativeOrder' | 'currentTurnIndex'> {
  const at = state.initiativeOrder.indexOf(id);
  if (at === -1) return { initiativeOrder: state.initiativeOrder, currentTurnIndex: state.currentTurnIndex };
  const initiativeOrder = state.initiativeOrder.filter((x) => x !== id);
  const shifted = at < state.currentTurnIndex ? state.currentTurnIndex - 1 : state.currentTurnIndex;
  return { initiativeOrder, currentTurnIndex: Math.min(shifted, Math.max(0, initiativeOrder.length - 1)) };
}

/** During combat, creatures leaving a squad act right after the current turn (as UNASSIGN_CREW does). */
function insertAfterCurrent(state: CombatState, ids: string[]): string[] {
  const toInsert = state.phase === 'combat' ? ids.filter((id) => !state.initiativeOrder.includes(id)) : [];
  if (toInsert.length === 0) return state.initiativeOrder;
  const at = state.currentTurnIndex + 1;
  return [...state.initiativeOrder.slice(0, at), ...toInsert, ...state.initiativeOrder.slice(at)];
}

/** VVTT rule 4 bookkeeping: setup recomputes the starting count; combat adjusts it by `delta`. */
function withStartingCount(state: CombatState, squad: Squad, creatures: Creature[], delta: number): Squad {
  return state.phase === 'combat'
    ? { ...squad, startingCount: Math.max(0, squad.startingCount + delta) }
    : { ...squad, startingCount: squadStandingCount(squad, creatures) };
}

/** Members leave a squad and become standalone at the squad's position (or unplaced). */
function releaseMembers(state: CombatState, squad: Squad, memberIds: string[]): CombatState {
  const leaving = new Set(memberIds);
  const leavers = state.creatures.filter((c) => leaving.has(c.id));
  const creatures = state.creatures.map((c) => (leaving.has(c.id) ? { ...c, position: squad.position } : c));
  const remaining: Squad = {
    ...squad,
    memberIds: squad.memberIds.filter((id) => !leaving.has(id)),
    leaderId: squad.leaderId && leaving.has(squad.leaderId) ? undefined : squad.leaderId,
  };
  const delta = -leavers.reduce((sum, c) => sum + standingCount(c), 0);
  const names = leavers.map((c) => c.name).join(', ');
  return {
    ...state,
    creatures,
    squads: state.squads.map((s) => (s.id === squad.id ? withStartingCount(state, remaining, creatures, delta) : s)),
    initiativeOrder: insertAfterCurrent(state, memberIds),
    actionLog: state.phase === 'combat' && names
      ? [...state.actionLog, createLogEntry(state.round, 'movement', `${names} ${leavers.length === 1 ? 'leaves' : 'leave'} ${squad.name}`, 'Acts immediately after current turn, then normal initiative next round')]
      : state.actionLog,
  };
}
```

- [ ] **Step 6: Add the squad cases**

Replace the two cases `case 'SQUAD_HITS': {…}` and `case 'SQUAD_AREA': {…}` with:

```ts
    case 'SQUAD_HIT': {
      const member = state.creatures.find((c) => c.id === action.payload.memberId);
      if (!member) return state;
      if (member.stack) return applyStackHitsToState(state, member, action.payload.hits, action.payload.source);
      return action.payload.hits
        .filter((h) => h > 0)
        .reduce(
          (s, amount) => baseCombatReducer(s, { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: member.id, amount, source: action.payload.source } }),
          state,
        );
    }

    case 'SQUAD_AREA': {
      const results = new Map(action.payload.members.map((m) => [m.memberId, m]));
      const creatures = state.creatures.map((c) => {
        const r = results.get(c.id);
        if (!r) return c;
        if (c.stack) {
          return { ...c, ...normalizeStack(c, { ...c, currentHp: r.currentHp, stack: { ...c.stack, bodies: r.bodies ?? c.stack.bodies } }) };
        }
        return { ...c, currentHp: Math.max(0, Math.min(c.statblock.maxHp, r.currentHp)), tempHp: r.tempHp ?? c.tempHp };
      });
      return {
        ...state,
        creatures,
        actionLog: [...state.actionLog, createLogEntry(state.round, 'damage', action.payload.summary, action.payload.details)],
      };
    }

    // ========== Battle mode squads ==========
    case 'ADD_SQUAD':
      return { ...state, squads: [...state.squads, action.payload] };

    case 'UPDATE_SQUAD': {
      const squad = state.squads.find((s) => s.id === action.payload.id);
      if (!squad) return state;
      const updates = { ...action.payload.updates };
      if (updates.leaderId && !squad.memberIds.includes(updates.leaderId)) delete updates.leaderId;
      if (updates.commanderId) {
        const pc = state.creatures.find((c) => c.id === updates.commanderId);
        const taken = state.squads.some((s) => s.id !== squad.id && s.commanderId === updates.commanderId);
        if (!pc || pc.statblock.type !== 'pc' || squad.memberIds.includes(pc.id) || taken) delete updates.commanderId;
      }
      const squads = state.squads.map((s) => (s.id === squad.id ? { ...s, ...updates } : s));
      return { ...state, squads, initiativeOrder: placeCommandedSquads(state.initiativeOrder, squads, state.crewAssignments) };
    }

    case 'REMOVE_SQUAD': {
      const squad = state.squads.find((s) => s.id === action.payload.id);
      if (!squad) return state;
      const base: CombatState = {
        ...state,
        ...removeFromOrder(state, squad.id),
        moralePrompts: state.moralePrompts.filter((p) => p.squadId !== squad.id),
      };
      if (action.payload.deleteMembers) {
        const gone = new Set(squad.memberIds);
        let next = base;
        for (const id of squad.memberIds) next = { ...next, ...removeFromOrder(next, id) };
        return {
          ...next,
          squads: next.squads.filter((s) => s.id !== squad.id),
          creatures: next.creatures.filter((c) => !gone.has(c.id)),
          moralePrompts: next.moralePrompts.filter((p) => !p.creatureId || !gone.has(p.creatureId)),
        };
      }
      const released = releaseMembers(base, squad, squad.memberIds);
      return { ...released, squads: released.squads.filter((s) => s.id !== squad.id) };
    }

    case 'ADD_SQUAD_MEMBER': {
      const squad = state.squads.find((s) => s.id === action.payload.squadId);
      if (!squad) return state;
      const incoming = action.payload.creature;
      const creatures = incoming ? [...state.creatures, { ...incoming, faction: squad.faction }] : state.creatures;
      const member = creatures.find((c) => c.id === (incoming?.id ?? action.payload.creatureId));
      if (
        !member
        || squadOf(member.id, state.squads)
        || state.squads.some((s) => s.commanderId === member.id)
        || state.crewAssignments.some((a) => a.creatureId === member.id)
      ) return state;
      const joined: Squad = { ...squad, memberIds: [...squad.memberIds, member.id] };
      return {
        ...state,
        ...removeFromOrder(state, member.id),
        creatures,
        squads: state.squads.map((s) => (s.id === squad.id ? withStartingCount(state, joined, creatures, standingCount(member)) : s)),
        moralePrompts: state.moralePrompts.filter((p) => p.creatureId !== member.id),
      };
    }

    case 'REMOVE_SQUAD_MEMBER': {
      const squad = state.squads.find((s) => s.id === action.payload.squadId);
      if (!squad || !squad.memberIds.includes(action.payload.creatureId)) return state;
      return releaseMembers(state, squad, [action.payload.creatureId]);
    }

    case 'SPLIT_STACK': {
      const source = state.creatures.find((c) => c.id === action.payload.creatureId);
      const stack = source?.stack;
      if (!source || !stack || stack.bodies < 2) return state;
      const squad = squadOf(source.id, state.squads);
      const { stack: _stack, morale: _morale, ...rest } = source;
      const single: Creature = {
        ...rest,
        id: uuid(),
        name: source.statblock.name,
        currentHp: source.statblock.maxHp,
        tempHp: 0,
        conditions: [],
        position: squad ? squad.position : source.position,
      };
      const creatures = [
        ...state.creatures.map((c) => (c.id === source.id ? { ...c, stack: { ...stack, size: stack.size - 1, bodies: stack.bodies - 1 } } : c)),
        single,
      ];
      return {
        ...state,
        creatures,
        initiativeOrder: insertAfterCurrent(state, [single.id]),
        squads: squad ? state.squads.map((s) => (s.id === squad.id ? withStartingCount(state, s, creatures, -1) : s)) : state.squads,
      };
    }

    case 'GROW_STACK': {
      const source = state.creatures.find((c) => c.id === action.payload.creatureId);
      const stack = source?.stack;
      const n = Math.max(0, Math.floor(action.payload.amount));
      if (!source || !stack || n === 0) return state;
      const grown: Creature = { ...source, stack: { ...stack, size: stack.size + n, bodies: stack.bodies + n } };
      const updated = { ...grown, ...normalizeStack(source, grown) };
      const creatures = state.creatures.map((c) => (c.id === source.id ? updated : c));
      const squad = squadOf(source.id, state.squads);
      return {
        ...state,
        creatures,
        squads: squad ? state.squads.map((s) => (s.id === squad.id ? withStartingCount(state, s, creatures, n) : s)) : state.squads,
      };
    }
```

- [ ] **Step 7: Extend `REMOVE_CREATURE`, `ASSIGN_CREW` and `LOAD_PARTY_PRESET`**

Replace the `REMOVE_CREATURE` case with the version below. It keeps today's initiative handling and adds the squad cleanup. Removing a member is not a morale trigger: Task 5 skips the leader-down check when the leader changes, and skips the half-size check when membership changes.

```ts
    case 'REMOVE_CREATURE': {
      const id = action.payload;
      const removed = state.creatures.find((c) => c.id === id);
      const creatures = state.creatures.filter((c) => c.id !== id);
      const squads = state.squads.map((s) => {
        let next = s.commanderId === id ? { ...s, commanderId: undefined } : s;
        if (!s.memberIds.includes(id)) return next;
        next = { ...next, memberIds: s.memberIds.filter((m) => m !== id), leaderId: s.leaderId === id ? undefined : s.leaderId };
        return withStartingCount(state, next, creatures, -(removed ? standingCount(removed) : 0));
      });
      return {
        ...state,
        creatures,
        squads,
        crewAssignments: state.crewAssignments.filter((a) => a.creatureId !== id),
        initiativeOrder: state.initiativeOrder.filter((x) => x !== id),
        moralePrompts: state.moralePrompts.filter((p) => p.creatureId !== id),
      };
    }
```

At the top of `case 'ASSIGN_CREW': {`, add:

```ts
      // A squad member cannot be crew (spec "Membership and assignments")
      if (state.squads.some((s) => s.memberIds.includes(action.payload.creatureId))) return state;
```

In `LOAD_PARTY_PRESET`, replace the `newCreatures` map body:

```ts
        const { morale: _morale, ...rest } = c;
        return {
          ...rest,
          id: newId,
          // Update vehicleId reference if assigned
          vehicleId: c.vehicleId ? vehicleIdMap.get(c.vehicleId) : undefined,
        };
```

with:

```ts
        // Presets carry no squads; a v2.11/v2.12 `squad` field becomes a plain stack (leader dropped)
        const { morale: _morale, squad: legacy, stack, ...rest } = c as LegacyCreature;
        const body = legacy ?? stack;
        return {
          ...rest,
          ...(body ? { stack: { size: body.size, bodies: body.bodies } } : {}),
          id: newId,
          // Update vehicleId reference if assigned
          vehicleId: c.vehicleId ? vehicleIdMap.get(c.vehicleId) : undefined,
        };
```

Then:
- Delete the "Remap squad leaders" block, the `remappedCreatures` map.
- Use `newCreatures` where `remappedCreatures` was used (two places).
- Add these two lines to the returned object:

```ts
        squads: [],
        initiativeOrder: state.initiativeOrder.filter((id) => !state.squads.some((s) => s.id === id)),
```

- [ ] **Step 8: Initiative: `START_COMBAT`, `NEXT_TURN`, `NEXT_ROUND`, `SET_INITIATIVE_ORDER`, `RESET_COMBAT`**

In `START_COMBAT`:
- Change the entry type to `type InitiativeEntry = { id: string; type: 'creature' | 'vehicle' | 'squad'; initiative: number; name: string };`.
- After `const crewCreatureIds = …`, add `const squadMemberIds = new Set(state.squads.flatMap((s) => s.memberIds));`.
- Change the creature condition to `if (!crewCreatureIds.has(creature.id) && !squadMemberIds.has(creature.id)) {`.
- Before the sort, add:

```ts
      // Battle mode squads: one slot each; a squad with no one standing gets none (VVTT rule 5)
      const squads = state.squads.map((s) => ({ ...s, startingCount: squadStandingCount(s, state.creatures) }));
      squads.forEach((squad) => {
        if (squad.startingCount === 0) return;
        initiativeEntries.push({ id: squad.id, type: 'squad', initiative: squad.initiative ?? 0, name: squad.name });
      });
```

In the return:
- Replace `initiativeOrder: initiativeEntries.map((e) => e.id),` with `initiativeOrder: placeCommandedSquads(initiativeEntries.map((e) => e.id), squads, state.crewAssignments),`.
- Add `squads,`.

In `NEXT_TURN`, inside the `while` loop after the dead-NPC skip, add:

```ts
        // Skip squads with no one standing
        const candidateSquad = state.squads.find((s) => s.id === candidateId);
        if (candidateSquad && squadStandingCount(candidateSquad, state.creatures) === 0) {
          nextIndex++;
          continue;
        }
```

After `const nextCreature = …`, add `const nextSquad = state.squads.find((s) => s.id === nextId);`. Extend the name chain with `} else if (nextSquad) { turnName = nextSquad.name; }`.

Change `rebuildInitiativeOrder`:
- The signature gains a fifth parameter, `squads: Squad[]`.
- Before the sort, add:

```ts
  // Battle mode squads in the current order (skip squads with no one standing)
  for (const squad of squads) {
    if (!currentOrderSet.has(squad.id)) continue;
    if (squadStandingCount(squad, creatures) === 0) continue;
    initiativeEntries.push({ id: squad.id, initiative: squad.initiative ?? 0, name: squad.name });
  }
```

- Replace `return initiativeEntries.map((e) => e.id);` with `return placeCommandedSquads(initiativeEntries.map((e) => e.id), squads, crewAssignments);`.
- Pass `state.squads` as the new last argument at its call site in `NEXT_ROUND`. Find every call with `grep -n "rebuildInitiativeOrder(" src/context/CombatContext.tsx`.

In `SET_INITIATIVE_ORDER`, use `initiativeOrder: placeCommandedSquads(action.payload, state.squads, state.crewAssignments),`.

In `RESET_COMBAT`, add `squads: state.squads.map(({ morale: _morale, initiative: _initiative, ...s }) => s),`. This keeps membership and `startingCount` while clearing morale and the rolled initiative.

- [ ] **Step 9: Expose the current squad turn**

In `CombatContextValue`, add `currentTurnSquad: Squad | undefined;` under `currentTurnDriver`.

In the provider, after `currentTurnCreature`, add `const currentTurnSquad = state.squads.find((s) => s.id === currentTurnId);`. Add `currentTurnSquad,` to `value`.

- [ ] **Step 10: Update the three dispatchers to the new shapes**

`src/components/squads/SquadRowControls.tsx` `handleHit`:

```ts
    dispatch({ type: 'SQUAD_HIT', payload: { memberId: creature.id, hits: Array(n).fill(each), source: type ? `${value} ${type} × ${n}` : undefined } });
```

`src/components/squads/SquadAttackPanel.tsx`:

```ts
        dispatch({ type: 'SQUAD_HIT', payload: { memberId: id, hits: perHit, source } });
```

`src/components/squads/SquadAreaDialog.tsx`, the `dispatch` in `handleApply`:

```ts
    dispatch({
      type: 'SQUAD_AREA',
      payload: {
        members: [{ memberId: creature.id, currentHp: area.currentHp, bodies: area.bodies }],
        summary: formatAreaSummary(source || 'Area effect', area, creature.stack?.size ?? bodies),
        details,
      },
    });
```

- [ ] **Step 11: Run the suite and type-check**

Run: `npx vitest run && npx tsc -p tsconfig.app.json`

Expected: PASS, including every pre-existing ship, morale and squad test. No type errors.

- [ ] **Step 12: Lint and commit**

Run: `npx eslint src/context/CombatContext.tsx src/context/combatReducer.test.ts src/components/squads/SquadRowControls.tsx src/components/squads/SquadAttackPanel.tsx src/components/squads/SquadAreaDialog.tsx`. Then:

```bash
git add src/context/CombatContext.tsx src/context/combatReducer.test.ts src/components/squads/SquadRowControls.tsx src/components/squads/SquadAttackPanel.tsx src/components/squads/SquadAreaDialog.tsx
git commit -m "$(cat <<'EOF'
Reducer: squad actions, squad initiative slots and commander placement, preset/reset/crew rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 5: Morale on squads

**Files:**
- Modify: `src/types/index.ts` (drop `leaderId` from `Creature.stack`), `src/utils/morale.ts`, `src/context/CombatContext.tsx`, `src/components/morale/MoralePromptCard.tsx`, `src/components/morale/MoraleRowControls.tsx`, `src/components/layout/Sidebar.tsx`
- Delete: `src/components/morale/SquadLeaderSelect.tsx`
- Test: `src/utils/morale.test.ts` (rewrite), `src/utils/stack.test.ts`, `src/context/combatReducer.test.ts`

**Interfaces:**
- Consumes:
  - `squadMembers`, `squadStandingCount`, `fallbackSaver` (Task 2);
  - `Squad`, `MoralePrompt.squadId` (Task 1).
- Produces:
  - `interface MoraleDetection { creatures: Creature[]; squads: Squad[]; prompts: MoralePrompt[] }`
  - `detectMoraleTriggers(prev, next, newId): MoraleDetection`. Arrays are returned unchanged (same reference) when nothing fires.
  - `moraleSaver(creature: Creature): { saver: Creature; bonus: number }`, for standalone creatures.
  - `squadMoraleSaver(squad: Squad, creatures: Creature[]): { saver: Creature; bonus: number; usingLeader: boolean } | undefined`
  - `moraleTriggerText(prompt: MoralePrompt, strength?: { standing: number; starting: number }): string`
  - Action changes:
    - `REQUEST_MORALE` payload becomes `{ creatureId?: string; squadId?: string }`.
    - `SET_MORALE_STATUS` payload becomes `{ creatureId?: string; squadId?: string; status?: MoraleStatus }`.
    - New `{ type: 'RESET_SQUAD_MORALE'; payload: { squadId: string } }`.

Squad trigger rules:
- **leader-down** fires only when the same `leaderId` is set before and after the action, and that leader goes from standing to down.
- **half-size** fires only when `memberIds` is unchanged by the action.

So staffing, removing or deleting a member never raises a prompt. Squad members never raise their own prompts. Standalone creatures keep the v2.12 rules: half-hp for individuals, half-size for standalone stacks.

- [ ] **Step 1: Drop the transitional `leaderId` and rewrite the morale tests**

In `src/types/index.ts`, set `stack?: { size: number; bodies: number };`.

In `src/utils/stack.test.ts`, delete the `describe('normalizeStack leaderId', …)` block at the end of the file.

Replace `src/utils/morale.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import { detectMoraleTriggers, moraleSaver, squadMoraleSaver, rollMorale, formatMoraleLog, moraleTriggerText } from './morale';
import type { CombatState, Creature, MoralePrompt, Squad } from '../types';

const dice = (...values: number[]) => {
  const queue = [...values];
  return () => {
    if (queue.length === 0) throw new Error('out of dice');
    return queue.shift()!;
  };
};
let counter = 0;
const newId = () => `p${++counter}`;

const npc = (id: string, currentHp: number, over: Partial<Creature> = {}, maxHp = 30) => ({
  id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy',
  statblock: { type: 'humanoid', maxHp, ac: 12, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } },
  ...over,
}) as unknown as Creature;
const stackOf = (id: string, bodies: number, size = 10, over: Partial<Creature> = {}) =>
  npc(id, bodies === 0 ? 0 : 11, { stack: { size, bodies }, ...over }, 11);
const pcOf = (id: string, currentHp: number) => {
  const base = npc(id, currentHp);
  return { ...base, statblock: { ...base.statblock, type: 'pc' } } as Creature;
};
const sq = (memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id: 'S', name: 'Tower Guard', faction: 'enemy', memberIds, startingCount: 14, ...over });
const st = (creatures: Creature[], squads: Squad[] = [], phase = 'combat', moralePrompts: MoralePrompt[] = []) =>
  ({ phase, creatures, squads, moralePrompts }) as unknown as CombatState;
const detect = (before: Creature[], after: Creature[], squadsBefore: Squad[] = [], squadsAfter: Squad[] = squadsBefore, phase = 'combat') =>
  detectMoraleTriggers(st(before, squadsBefore, phase), st(after, squadsAfter, phase), newId);
const triggers = (r: { prompts: MoralePrompt[] }) => r.prompts.map((p) => [p.squadId ?? p.creatureId, p.trigger]);
const withId = (list: Creature[], id: string, replacement: Creature) => list.map((c) => (c.id === id ? replacement : c));

// The tower: captain k (leader), Hobgoblin ×8, archers ×4, Karkajuk j; 14 standing
const tower = () => [npc('k', 30), stackOf('h', 8, 8), stackOf('a', 4, 4), npc('j', 60, {}, 60)];
const guard = (over: Partial<Squad> = {}) => sq(['k', 'h', 'a', 'j'], { leaderId: 'k', ...over });

describe('squad morale: leader down', () => {
  it('the leader dropping to 0 HP prompts the squad once', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 0));
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
    expect(r.prompts[0].creatureId).toBeUndefined();
    expect(r.squads[0].morale?.asked).toEqual(['leader-down']);
    expect(r.creatures).toBe(after);
    // healed, then dropped again: no second prompt
    expect(detect(withId(after, 'k', npc('k', 10)), after, r.squads).prompts).toEqual([]);
  });
  it('the leader becoming stunned prompts the squad', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 30, { conditions: [{ name: 'stunned' }] } as Partial<Creature>));
    expect(triggers(detect(before, after, [guard()]))).toEqual([['S', 'leader-down']]);
  });
  it('removing the leader is not a morale trigger', () => {
    const before = tower();
    const after = before.filter((c) => c.id !== 'k');
    expect(detect(before, after, [guard()], [sq(['h', 'a', 'j'], { startingCount: 13 })]).prompts).toEqual([]);
  });
});

describe('squad morale: half strength (VVTT rule 4)', () => {
  it('crossing to at or below half the starting count prompts once', () => {
    const before = tower();
    const after = withId(withId(before, 'h', stackOf('h', 2, 8)), 'a', stackOf('a', 2, 4)); // 1 + 2 + 2 + 1 = 6 of 14
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'half-size']]);
    expect(detect(before, after, r.squads).prompts).toEqual([]);
  });
  it('a membership change never prompts', () => {
    const before = tower();
    const after = withId(before, 'h', stackOf('h', 0, 8));
    expect(detect(before, after, [guard()], [sq(['k', 'a', 'j'], { leaderId: 'k' })]).prompts).toEqual([]);
  });
  it('leader-down outranks half-size; both are recorded', () => {
    const before = tower();
    const after = withId(withId(before, 'k', npc('k', 0)), 'h', stackOf('h', 1, 8)); // 0 + 1 + 4 + 1 = 6
    const r = detect(before, after, [guard()]);
    expect(triggers(r)).toEqual([['S', 'leader-down']]);
    expect(r.squads[0].morale?.asked).toEqual(['leader-down', 'half-size']);
  });
});

describe('squad morale: who is prompted', () => {
  it('members never raise their own prompts', () => {
    const before = tower();
    const after = withId(before, 'j', npc('j', 20, {}, 60));
    expect(detect(before, after, [guard()]).prompts).toEqual([]);
  });
  it('a former member falls back to half-hp', () => {
    const squads = [sq(['k', 'h', 'a'], { leaderId: 'k', startingCount: 13 })];
    const before = tower();
    const after = withId(before, 'j', npc('j', 20, {}, 60));
    expect(triggers(detect(before, after, squads))).toEqual([['j', 'half-hp']]);
  });
  it('a PC-only squad never prompts; a party squad with NPC members does', () => {
    expect(detect([pcOf('p', 30)], [pcOf('p', 0)], [sq(['p'], { faction: 'party', startingCount: 1 })]).prompts).toEqual([]);
    const party = [sq(['p', 'h'], { faction: 'party', startingCount: 9 })];
    expect(triggers(detect([pcOf('p', 30), stackOf('h', 8, 8)], [pcOf('p', 30), stackOf('h', 3, 8)], party))).toEqual([['S', 'half-size']]);
  });
  it('nothing outside combat, for a broken squad, or with an open squad prompt', () => {
    const before = tower();
    const after = withId(before, 'k', npc('k', 0));
    expect(detect(before, after, [guard()], [guard()], 'setup').prompts).toEqual([]);
    expect(detect(before, after, [guard({ morale: { status: 'fleeing', asked: [] } })]).prompts).toEqual([]);
    const open = [{ id: 'm1', squadId: 'S', trigger: 'manual' }] as MoralePrompt[];
    expect(detectMoraleTriggers(st(before, [guard()]), st(after, [guard()], 'combat', open), newId).prompts).toEqual([]);
  });
  it('returns the same arrays when nothing fires', () => {
    const squads = [guard()];
    const after = tower();
    const r = detect(tower(), after, squads);
    expect(r.creatures).toBe(after);
    expect(r.squads).toBe(squads);
  });
});

describe('standalone creatures (unchanged rules)', () => {
  it('a standalone stack crossing half its size is prompted once; a wipe straight to 0 is not', () => {
    const r = detect([stackOf('a', 6)], [stackOf('a', 5)]);
    expect(triggers(r)).toEqual([['a', 'half-size']]);
    expect(detect([{ ...r.creatures[0], stack: { size: 10, bodies: 6 } }], r.creatures).prompts).toEqual([]);
    expect(detect([stackOf('b', 6)], [stackOf('b', 0)]).prompts).toEqual([]);
  });
  it('a single NPC crossing half HP is prompted; not PCs, stacks, or a drop to 0', () => {
    expect(triggers(detect([npc('x', 30)], [npc('x', 15)]))).toEqual([['x', 'half-hp']]);
    expect(detect([npc('x', 30)], [npc('x', 16)]).prompts).toEqual([]);
    expect(detect([pcOf('p', 30)], [pcOf('p', 10)]).prompts).toEqual([]);
    expect(detect([stackOf('a', 10)], [{ ...stackOf('a', 10), currentHp: 5 }]).prompts).toEqual([]);
    expect(detect([npc('x', 30)], [npc('x', 0)]).prompts).toEqual([]);
  });
  it('a creature with an open prompt gets no automatic prompt', () => {
    const open = [{ id: 'm1', creatureId: 'x', trigger: 'manual' }] as MoralePrompt[];
    const r = detectMoraleTriggers(st([npc('x', 30)]), st([npc('x', 10)], [], 'combat', open), newId);
    expect(r.prompts).toEqual([]);
    expect(r.creatures[0].morale).toBeUndefined();
  });
});

describe('savers', () => {
  const wise = (c: Creature) => ({ ...c, statblock: { ...c.statblock, savingThrows: { wis: 4 } } }) as Creature;
  it('a squad uses its standing leader', () => {
    const r = squadMoraleSaver(guard(), withId(tower(), 'k', wise(npc('k', 30))));
    expect(r).toMatchObject({ bonus: 4, usingLeader: true });
    expect(r?.saver.id).toBe('k');
  });
  it('VVTT rule 3: with the leader down, the largest standing stack saves', () => {
    const r = squadMoraleSaver(guard(), withId(tower(), 'k', npc('k', 0)));
    expect(r).toMatchObject({ bonus: 2, usingLeader: false });
    expect(r?.saver.id).toBe('h');
    expect(squadMoraleSaver(sq(['k'], { leaderId: 'k' }), [npc('k', 0)])).toBeUndefined();
  });
  it('a standalone creature saves for itself', () => {
    expect(moraleSaver(npc('x', 10))).toMatchObject({ bonus: 2 });
  });
});

describe('rollMorale (DC 10)', () => {
  it('disadvantage keeps the lower die', () => {
    expect(rollMorale({ bonus: 1, disadvantage: true, roll: dice(15, 8) })).toEqual({ d20s: [15, 8], d20: 8, total: 9, success: false });
  });
  it('a total of 10 succeeds', () => {
    expect(rollMorale({ bonus: 0, disadvantage: false, roll: dice(10) })).toEqual({ d20s: [10], d20: 10, total: 10, success: true });
  });
});

describe('morale text', () => {
  it('formatMoraleLog', () => {
    expect(formatMoraleLog('Hob (A)', 'k is down', { kind: 'roll', saverName: 'k', bonus: 4, d20s: [3], d20: 3, total: 7, success: false }))
      .toBe('Hob (A) — morale (k is down): k WIS 3 + 4 = 7 vs DC 10 → flees');
    expect(formatMoraleLog('x', 'Below half HP', { kind: 'roll', saverName: 'x', bonus: -1, d20s: [15, 12], d20: 12, total: 11, success: true }))
      .toBe('x — morale (Below half HP): x WIS 12 (disadvantage: 15, 12) − 1 = 11 vs DC 10 → holds');
    expect(formatMoraleLog('Hob (A)', 'Morale check', { kind: 'auto' }))
      .toBe('Hob (A) — morale (Morale check): fails automatically (overwhelming opposition) → flees');
  });
  it('moraleTriggerText', () => {
    const p = (trigger: MoralePrompt['trigger'], leaderName?: string): MoralePrompt => ({ id: '1', squadId: 'S', trigger, leaderName });
    expect(moraleTriggerText(p('leader-down', 'k'))).toBe('k is down');
    expect(moraleTriggerText(p('half-size'), { standing: 6, starting: 14 })).toBe('Down to half strength (6/14)');
    expect(moraleTriggerText(p('half-hp'))).toBe('Below half HP');
    expect(moraleTriggerText(p('manual'))).toBe('Morale check');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/utils/morale.test.ts`

Expected: FAIL (`squadMoraleSaver` is not exported; the squad cases produce no prompts).

- [ ] **Step 3: Rewrite `src/utils/morale.ts`**

Replace everything from the `isOut` line through the end of `moraleSaver`, and the import lines, with the code below. Keep `MORALE_DC`, `INCAPACITATING`, `isLeaderDown`, `rollMorale`, `MoraleOutcome` and `formatMoraleLog` as they are. Then replace `moraleTriggerText` as shown.

```ts
/**
 * Battle mode morale — DMG 2014 p. 273 optional rule (the 2024 DMG has none).
 * Specs: docs/superpowers/specs/2026-10-20-battle-mode-morale-design.md and
 * docs/superpowers/specs/2026-10-20-battle-mode-squads-tab-design.md (squads). Pure; dice are injected.
 */
import type { CombatState, ConditionName, Creature, MoralePrompt, MoraleTrigger, Squad } from '../types';
import { saveBonus, type Roller } from './stack';
import { fallbackSaver, squadMembers, squadStandingCount } from './squads';
```

```ts
const isOut = (c: Creature) => c.currentHp <= 0 || (c.stack !== undefined && c.stack.bodies === 0);
const hasAsked = (m: { morale?: { asked: MoraleTrigger[] } }, t: MoraleTrigger) => m.morale?.asked.includes(t) ?? false;
const sameMembers = (a: Squad, b: Squad) =>
  a.memberIds.length === b.memberIds.length && a.memberIds.every((id, i) => b.memberIds[i] === id);

export interface MoraleDetection { creatures: Creature[]; squads: Squad[]; prompts: MoralePrompt[] }

/**
 * Compares two states and returns new morale prompts (each trigger once per creature or squad per battle).
 * Standalone creatures: half-size (stacks) and half-hp (individuals). Squads: leader-down, then half-size
 * (VVTT rule 4). Squad members never raise their own prompts. Unchanged arrays are returned as-is.
 */
export function detectMoraleTriggers(prev: CombatState, next: CombatState, newId: () => string): MoraleDetection {
  const nextSquads = next.squads ?? [];
  if (next.phase !== 'combat') return { creatures: next.creatures, squads: nextSquads, prompts: [] };
  const before = new Map(prev.creatures.map((c) => [c.id, c]));
  const now = new Map(next.creatures.map((c) => [c.id, c]));
  const prompts: MoralePrompt[] = [];
  const openCreatures = new Set((next.moralePrompts ?? []).map((p) => p.creatureId));
  const openSquads = new Set((next.moralePrompts ?? []).map((p) => p.squadId));
  const members = new Set(nextSquads.flatMap((s) => s.memberIds));

  let creaturesChanged = false;
  const creatures = next.creatures.map((c) => {
    const was = before.get(c.id);
    if (!was || members.has(c.id) || c.statblock.type === 'pc' || c.morale?.status || isOut(c) || openCreatures.has(c.id)) return c;
    let trigger: MoraleTrigger | undefined;
    if (c.stack && was.stack && !hasAsked(c, 'half-size')) {
      const half = c.stack.size / 2;
      if (was.stack.bodies > half && c.stack.bodies <= half) trigger = 'half-size';
    }
    if (!c.stack && !hasAsked(c, 'half-hp')) {
      const half = c.statblock.maxHp / 2;
      if (was.currentHp > half && c.currentHp <= half) trigger = 'half-hp';
    }
    if (!trigger) return c;
    creaturesChanged = true;
    prompts.push({ id: newId(), creatureId: c.id, trigger });
    return { ...c, morale: { ...c.morale, asked: [...(c.morale?.asked ?? []), trigger] } };
  });

  const prevSquads = new Map((prev.squads ?? []).map((s) => [s.id, s]));
  let squadsChanged = false;
  const squads = nextSquads.map((s) => {
    const was = prevSquads.get(s.id);
    if (!was || s.morale?.status || openSquads.has(s.id)) return s;
    const standing = squadStandingCount(s, next.creatures);
    if (standing === 0) return s;
    // PCs never make morale saves; a squad of PCs only is never prompted
    if (!squadMembers(s, next.creatures).some((m) => m.statblock.type !== 'pc')) return s;
    const fired: MoraleTrigger[] = [];
    let leaderName: string | undefined;
    if (s.leaderId && s.leaderId === was.leaderId && !hasAsked(s, 'leader-down')) {
      const leaderWas = before.get(s.leaderId);
      const leaderNow = now.get(s.leaderId);
      if (leaderWas && leaderNow && !isLeaderDown(leaderWas) && isLeaderDown(leaderNow)) {
        fired.push('leader-down');
        leaderName = leaderNow.name;
      }
    }
    if (!hasAsked(s, 'half-size') && sameMembers(was, s) && s.startingCount > 0) {
      const half = s.startingCount / 2;
      if (squadStandingCount(was, prev.creatures) > half && standing <= half) fired.push('half-size');
    }
    if (fired.length === 0) return s;
    squadsChanged = true;
    const trigger = fired[0];
    prompts.push({ id: newId(), squadId: s.id, trigger, ...(trigger === 'leader-down' ? { leaderName } : {}) });
    return { ...s, morale: { ...s.morale, asked: [...(s.morale?.asked ?? []), ...fired] } };
  });

  return {
    creatures: creaturesChanged ? creatures : next.creatures,
    squads: squadsChanged ? squads : nextSquads,
    prompts,
  };
}

/** A standalone creature makes its own save. */
export function moraleSaver(creature: Creature): { saver: Creature; bonus: number } {
  return { saver: creature, bonus: saveBonus(creature.statblock, 'wis') };
}

/** A squad's saver: its leader if standing (DMG 2014 p. 273), else VVTT rule 3. Undefined if nobody can save. */
export function squadMoraleSaver(squad: Squad, creatures: Creature[]): { saver: Creature; bonus: number; usingLeader: boolean } | undefined {
  const leader = squad.leaderId ? creatures.find((c) => c.id === squad.leaderId) : undefined;
  if (leader && !isLeaderDown(leader)) return { saver: leader, bonus: saveBonus(leader.statblock, 'wis'), usingLeader: true };
  const saver = fallbackSaver(squad, creatures);
  return saver ? { saver, bonus: saveBonus(saver.statblock, 'wis'), usingLeader: false } : undefined;
}
```

```ts
export function moraleTriggerText(prompt: MoralePrompt, strength?: { standing: number; starting: number }): string {
  switch (prompt.trigger) {
    case 'leader-down': return `${prompt.leaderName ?? 'Leader'} is down`;
    case 'half-size': return `Down to half strength (${strength?.standing ?? 0}/${strength?.starting ?? 0})`;
    case 'half-hp': return 'Below half HP';
    default: return 'Morale check';
  }
}
```

- [ ] **Step 4: Run the morale tests**

Run: `npx vitest run src/utils/morale.test.ts`

Expected: PASS.

- [ ] **Step 5: Update the reducer's morale actions and tests**

In `src/context/CombatContext.tsx`:

`applyMoraleDetection` becomes:

```ts
function applyMoraleDetection(prev: CombatState, next: CombatState): CombatState {
  if (next === prev) return next;
  const { creatures, squads, prompts } = detectMoraleTriggers(prev, next, () => uuid());
  if (prompts.length === 0) return next;
  return { ...next, creatures, squads, moralePrompts: [...(next.moralePrompts ?? []), ...prompts] };
}
```

In `CombatAction`, replace the `REQUEST_MORALE` and `SET_MORALE_STATUS` members and add `RESET_SQUAD_MORALE`:

```ts
  | { type: 'REQUEST_MORALE'; payload: { creatureId?: string; squadId?: string } }
  | { type: 'SET_MORALE_STATUS'; payload: { creatureId?: string; squadId?: string; status?: MoraleStatus } }
  | { type: 'RESET_SQUAD_MORALE'; payload: { squadId: string } }
```

Replace the cases `REQUEST_MORALE`, `RESOLVE_MORALE` and `SET_MORALE_STATUS` with:

```ts
    case 'REQUEST_MORALE': {
      const { creatureId, squadId } = action.payload;
      if (!creatureId && !squadId) return state;
      if (state.moralePrompts.some((p) => (squadId ? p.squadId === squadId : p.creatureId === creatureId))) return state;
      return {
        ...state,
        moralePrompts: [...state.moralePrompts, { id: uuid(), ...(squadId ? { squadId } : { creatureId }), trigger: 'manual' }],
      };
    }

    case 'RESOLVE_MORALE': {
      const prompt = state.moralePrompts.find((p) => p.id === action.payload.promptId);
      if (!prompt) return state;
      const fled = action.payload.fled;
      return {
        ...state,
        moralePrompts: state.moralePrompts.filter((p) => p.id !== prompt.id),
        creatures: fled && prompt.creatureId
          ? state.creatures.map((c) =>
              c.id === prompt.creatureId ? { ...c, morale: { asked: c.morale?.asked ?? [], status: 'fleeing' as const } } : c
            )
          : state.creatures,
        squads: fled && prompt.squadId
          ? state.squads.map((s) =>
              s.id === prompt.squadId ? { ...s, morale: { asked: s.morale?.asked ?? [], status: 'fleeing' as const } } : s
            )
          : state.squads,
        actionLog: [...state.actionLog, createLogEntry(state.round, 'system', action.payload.log, action.payload.details)],
      };
    }

    case 'SET_MORALE_STATUS': {
      const { creatureId, squadId, status } = action.payload;
      const squad = squadId ? state.squads.find((s) => s.id === squadId) : undefined;
      const creature = !squadId && creatureId ? state.creatures.find((c) => c.id === creatureId) : undefined;
      const name = squad?.name ?? creature?.name;
      if (!name) return state;
      const text = status === 'fleeing' ? 'is fleeing' : status === 'surrendered' ? 'surrenders' : 'rallies (morale status cleared)';
      return {
        ...state,
        creatures: creature
          ? state.creatures.map((c) => (c.id === creature.id ? { ...c, morale: { asked: c.morale?.asked ?? [], status } } : c))
          : state.creatures,
        squads: squad
          ? state.squads.map((s) => (s.id === squad.id ? { ...s, morale: { asked: s.morale?.asked ?? [], status } } : s))
          : state.squads,
        actionLog: [...state.actionLog, createLogEntry(state.round, 'system', `${name} ${text}`)],
      };
    }

    case 'RESET_SQUAD_MORALE': {
      const squad = state.squads.find((s) => s.id === action.payload.squadId);
      if (!squad) return state;
      return {
        ...state,
        squads: state.squads.map((s) => (s.id === squad.id ? { ...s, morale: undefined } : s)),
        moralePrompts: state.moralePrompts.filter((p) => p.squadId !== squad.id),
        actionLog: [...state.actionLog, createLogEntry(state.round, 'system', `${squad.name}: morale reset`)],
      };
    }
```

In `src/context/combatReducer.test.ts`, inside `describe('battle mode morale', …)`:

1. Replace the fixture line `const squadOf = …` with:

```ts
  const stackOf = (id: string, bodies: number) => npc(id, 11, 11, { stack: { size: 10, bodies } });
  const guardOf = (memberIds: string[], over: Partial<Squad> = {}): Squad => ({ id: 'S', name: 'Guard', faction: 'enemy', memberIds, startingCount: 11, ...over });
```

   Change the first test (`SQUAD_HIT crossing half strength…`) to use `stackOf('a', 6)`.

2. Replace the test `'DEAL_DAMAGE_TO_CREATURE dropping a leader prompts each squad it leads'` with:

```ts
  it('DEAL_DAMAGE_TO_CREATURE dropping a squad leader queues a leader-down prompt for the squad', () => {
    const s = { ...combat(npc('k', 30), stackOf('a', 10)), squads: [guardOf(['k', 'a'], { leaderId: 'k' })] };
    const out = combatReducer(s, { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'k', amount: 40 } });
    expect(out.moralePrompts.map((p) => [p.squadId, p.trigger, p.leaderName])).toEqual([['S', 'leader-down', 'k']]);
    expect(out.squads[0].morale?.asked).toEqual(['leader-down']);
  });
```

3. Replace the test `'REMOVE_CREATURE of a leader prompts its squads and drops prompts for the removed creature'` with:

```ts
  it('REMOVE_CREATURE of a squad leader raises no prompt; removing a creature drops its prompts', () => {
    const base = { ...combat(npc('k', 30), stackOf('a', 10), npc('x', 30)), squads: [guardOf(['k', 'a'], { leaderId: 'k' })] };
    const s = combatReducer(base, { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    expect(combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'k' }).moralePrompts.map((p) => p.creatureId)).toEqual(['x']);
    expect(combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'x' }).moralePrompts).toEqual([]);
  });
```

4. Delete the whole `describe('leaderId survives squad rebuilds', …)` block.

5. Append inside `describe('battle mode morale', …)`:

```ts
  describe('squad morale actions', () => {
    const withGuard = (over: Partial<Squad> = {}) => ({ ...combat(stackOf('a', 6)), squads: [guardOf(['a'], { startingCount: 10, ...over })] });

    it('SQUAD_HIT taking a squad to half strength queues one squad prompt (VVTT rule 4); members raise none', () => {
      const out = combatReducer(withGuard(), { type: 'SQUAD_HIT', payload: { squadId: 'S', memberId: 'a', hits: [11] } });
      expect(out.moralePrompts).toMatchObject([{ squadId: 'S', trigger: 'half-size' }]);
      expect(out.moralePrompts[0].creatureId).toBeUndefined();
      expect(out.squads[0].morale?.asked).toEqual(['half-size']);
      expect(out.creatures[0].morale).toBeUndefined();
    });

    it('REQUEST_MORALE, RESOLVE_MORALE and SET_MORALE_STATUS work on a squad', () => {
      const asked = combatReducer(withGuard(), { type: 'REQUEST_MORALE', payload: { squadId: 'S' } });
      const twice = combatReducer(asked, { type: 'REQUEST_MORALE', payload: { squadId: 'S' } });
      expect(twice.moralePrompts).toMatchObject([{ squadId: 'S', trigger: 'manual' }]);
      const fled = combatReducer(asked, { type: 'RESOLVE_MORALE', payload: { promptId: asked.moralePrompts[0].id, fled: true, log: 'Guard flees' } });
      expect(fled.squads[0].morale).toEqual({ asked: [], status: 'fleeing' });
      const sur = combatReducer(fled, { type: 'SET_MORALE_STATUS', payload: { squadId: 'S', status: 'surrendered' } });
      expect(sur.squads[0].morale?.status).toBe('surrendered');
      expect(sur.actionLog.at(-1)?.action).toBe('Guard surrenders');
    });

    it('RESET_SQUAD_MORALE clears the status, the asked list and open prompts', () => {
      const s = combatReducer(withGuard({ morale: { status: 'fleeing', asked: ['half-size'] } }), { type: 'REQUEST_MORALE', payload: { squadId: 'S' } });
      const out = combatReducer(s, { type: 'RESET_SQUAD_MORALE', payload: { squadId: 'S' } });
      expect(out.squads[0].morale).toBeUndefined();
      expect(out.moralePrompts).toEqual([]);
    });
  });
```

- [ ] **Step 6: Update the morale UI and remove the creature-level leader**

Replace `src/components/morale/MoralePromptCard.tsx` with:

```tsx
import { useState } from 'react';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoralePrompt } from '../../types';
import { moraleSaver, squadMoraleSaver, rollMorale, formatMoraleLog, moraleTriggerText, MORALE_DC, type MoraleOutcome } from '../../utils/morale';
import { squadStandingCount } from '../../utils/squads';
import { rollDie } from '../../utils/diceEngine';

/** One open morale check (DMG 2014 p. 273) for a squad or a standalone creature: Roll, Fails automatically, or Dismiss. */
export function MoralePromptCard({ prompt, onResolved }: { prompt: MoralePrompt; onResolved: (text: string, fled: boolean) => void }) {
  const { state, dispatch } = useCombat();
  const [disadvantage, setDisadvantage] = useState(false);
  const squad = prompt.squadId ? state.squads.find((s) => s.id === prompt.squadId) : undefined;
  const creature = !squad && prompt.creatureId ? state.creatures.find((c) => c.id === prompt.creatureId) : undefined;
  if (!squad && !creature) return null;

  const squadSaver = squad ? squadMoraleSaver(squad, state.creatures) : undefined;
  const saverInfo = squad ? squadSaver : creature ? moraleSaver(creature) : undefined;
  const strength = squad
    ? { standing: squadStandingCount(squad, state.creatures), starting: squad.startingCount }
    : creature?.stack ? { standing: creature.stack.bodies, starting: creature.stack.size } : undefined;
  const name = squad?.name ?? creature?.name ?? '';
  const reason = moraleTriggerText(prompt, strength);
  const bonus = saverInfo?.bonus ?? 0;
  const bonusText = `WIS ${bonus < 0 ? '−' : '+'}${Math.abs(bonus)}`;
  const who = !saverInfo
    ? 'No one standing can save: dismiss it, or mark it as failing'
    : squadSaver?.usingLeader
      ? `${saverInfo.saver.name} (leader) saves for the squad: ${bonusText}`
      : squad
        ? `Leader down: ${saverInfo.saver.name} saves (VVTT rule: largest standing stack): ${bonusText}`
        : `${bonusText} save`;

  const resolve = (outcome: MoraleOutcome) => {
    const fled = outcome.kind === 'auto' || !outcome.success;
    const log = formatMoraleLog(name, reason, outcome);
    dispatch({ type: 'RESOLVE_MORALE', payload: { promptId: prompt.id, fled, log } });
    onResolved(log, fled);
  };

  const handleRoll = () => {
    if (!saverInfo) return;
    const r = rollMorale({ bonus, disadvantage, roll: rollDie });
    resolve({ kind: 'roll', saverName: saverInfo.saver.name, bonus, ...r });
  };

  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={600}>{name}: {reason}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {who} · DC {MORALE_DC} (DMG 2014 p. 273)
      </Typography>
      {prompt.trigger === 'half-size' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {squad ? 'VVTT rule: half strength counts each stack body and each individual as 1. ' : ''}DMG: only if the other side has had no losses — dismiss otherwise.
        </Typography>
      )}
      <FormControlLabel
        control={<Switch size="small" checked={disadvantage} onChange={(e) => setDisadvantage(e.target.checked)} />}
        label={<Typography variant="caption">Disadvantage (overwhelming opposition)</Typography>}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={handleRoll} disabled={!saverInfo}>Roll</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => resolve({ kind: 'auto' })}>Fails automatically</Button>
        <Button size="small" onClick={() => dispatch({ type: 'DISMISS_MORALE', payload: { promptId: prompt.id } })}>Dismiss</Button>
      </Stack>
    </Box>
  );
}
```

In `src/components/morale/MoraleRowControls.tsx`:
- Delete the `leaderId` and `leader` lines.
- Change the guard to `if (!status && !canCheck) return null;`.
- Delete the `{leader && …led by…}` line.
- Update the doc comment to `/** Sidebar row (standalone creatures): the Fleeing/Surrendered chip (click cycles) and a manual Morale check button. */`.

Delete `src/components/morale/SquadLeaderSelect.tsx` with `git rm src/components/morale/SquadLeaderSelect.tsx`.

In `src/components/layout/Sidebar.tsx`:
- Delete the `SquadLeaderSelect` import.
- Delete the `editLeaderId` state line and the `setEditLeaderId(...)` line in `startEdit`.
- In `saveEdit`, use `...(existing.stack && { stack: { ...existing.stack, bodies: editBodies } }),`.
- Remove `editLeaderId, setEditLeaderId` from both `editState={{ … }}` objects.
- Remove `editLeaderId: string; setEditLeaderId: (v: string) => void;` from `CreatureEntryProps`.
- Delete the `{creature.stack && (<SquadLeaderSelect … />)}` block in the edit form.

- [ ] **Step 7: Run the suite and type-check**

Run: `npx vitest run && npx tsc -p tsconfig.app.json`

Expected: PASS. A grep for `leaderId` in `src` shows only `Squad.leaderId`, the squad reducer and squads code, `migrateSquads` (`LegacyStack`), and the tests.

- [ ] **Step 8: Lint and commit**

Run: `npx eslint src/utils/morale.ts src/utils/morale.test.ts src/utils/stack.test.ts src/types/index.ts src/context/CombatContext.tsx src/context/combatReducer.test.ts src/components/morale src/components/layout/Sidebar.tsx`. Then:

```bash
git add src/utils/morale.ts src/utils/morale.test.ts src/utils/stack.test.ts src/types/index.ts src/context/CombatContext.tsx src/context/combatReducer.test.ts src/components/morale/MoralePromptCard.tsx src/components/morale/MoraleRowControls.tsx src/components/layout/Sidebar.tsx
git commit -m "$(cat <<'EOF'
Morale on squads: leader-down and half-strength squad prompts, squad saver, squad morale actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(`git rm` already staged the deletion of `SquadLeaderSelect.tsx`.)

---
### Task 6: Shared creature pickers; remove "Add as one squad"

**Files:**
- Create: `src/services/open5e.ts`, `src/components/creatures/MonsterSearchDialog.tsx`, `src/utils/customNpc.ts`, `src/components/statblocks/StatblockDisplay.tsx`, `src/components/statblocks/StatblockDialog.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Test: `src/utils/customNpc.test.ts`

**Interfaces:**
- Produces:
  - `src/services/open5e.ts`: `export interface Open5eMonster`, `convertOpen5eToCreature(monster: Open5eMonster, position?: { x: number; y: number }): Creature`, `searchOpen5e(query: string): Promise<Open5eMonster[]>`
  - `<MonsterSearchDialog open onClose title maxQuantity quantityHint={(qty) => string} onPick={(monster, qty) => void} />`
  - `makeCustomNpc(input: CustomNpcInput): Creature` with `interface CustomNpcInput { name: string; hp: number; ac: number; speed: number; initiative?: number; size?: Statblock['size']; type?: string; cr?: string }`. It returns an enemy-faction creature with no position.
  - `<StatblockDisplay statblock />` and `<StatblockDialog creature={Creature | null} onClose />`

Sidebar behaviour after this task matches the spec. Adding from the sidebar with a quantity above 1 always adds separate numbered creatures (cap 20), and the "Add as one squad" switch is gone. Everything else in the sidebar is unchanged.

- [ ] **Step 1: Write the failing test** `src/utils/customNpc.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { makeCustomNpc } from './customNpc';

describe('makeCustomNpc', () => {
  it('builds the sidebar custom NPC: plain 10s, enemy, full HP, no position', () => {
    const c = makeCustomNpc({ name: 'Hobgoblin Archer', hp: 11, ac: 18, speed: 30 });
    expect(c).toMatchObject({ name: 'Hobgoblin Archer', currentHp: 11, tempHp: 0, conditions: [], initiative: 0, initiativeModifier: 0, faction: 'enemy' });
    expect(c.position).toBeUndefined();
    expect(c.statblock).toMatchObject({
      name: 'Hobgoblin Archer', source: 'custom', size: 'medium', type: 'humanoid', alignment: 'neutral', ac: 18, maxHp: 11,
      hitDice: '3d8', speed: { walk: 30 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, cr: '1',
    });
  });
  it('takes preset size, type, CR and initiative', () => {
    const c = makeCustomNpc({ name: 'Imp', hp: 10, ac: 13, speed: 20, initiative: 7, size: 'tiny', type: 'fiend', cr: '1' });
    expect(c).toMatchObject({ initiative: 7, statblock: { size: 'tiny', type: 'fiend', cr: '1' } });
    expect(makeCustomNpc({ name: 'a', hp: 5, ac: 10, speed: 30 }).id).not.toBe(makeCustomNpc({ name: 'a', hp: 5, ac: 10, speed: 30 }).id);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/utils/customNpc.test.ts`

Expected: FAIL (cannot resolve `./customNpc`).

- [ ] **Step 3: Implement `src/utils/customNpc.ts`**

```ts
import { v4 as uuid } from 'uuid';
import type { Creature, Statblock } from '../types';

export interface CustomNpcInput {
  name: string;
  hp: number;
  ac: number;
  speed: number;
  initiative?: number;
  size?: Statblock['size'];
  type?: string;
  cr?: string;
}

/** The sidebar's custom NPC (and the Squads tab's "Custom NPC…"): plain 10s, enemy faction, no position. */
export function makeCustomNpc(input: CustomNpcInput): Creature {
  const statblock: Statblock = {
    id: uuid(),
    name: input.name,
    source: 'custom',
    size: input.size ?? 'medium',
    type: input.type ?? 'humanoid',
    alignment: 'neutral',
    ac: input.ac,
    maxHp: input.hp,
    hitDice: `${Math.ceil(input.hp / 5)}d8`,
    speed: { walk: input.speed },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    senses: 'passive Perception 10',
    languages: 'Common',
    cr: input.cr ?? '1',
  };
  return {
    id: uuid(),
    name: input.name,
    statblock,
    currentHp: statblock.maxHp,
    tempHp: 0,
    conditions: [],
    initiative: input.initiative ?? 0,
    initiativeModifier: 0,
    faction: 'enemy',
  };
}
```

Run: `npx vitest run src/utils/customNpc.test.ts`

Expected: PASS.

- [ ] **Step 4: Move the Open5e code to `src/services/open5e.ts`**

1. Cut from `Sidebar.tsx` everything from the line `// Open5e API types` down to the closing `}` of `async function searchOpen5e`. That is the line just before `export function Sidebar() {`. It covers the interfaces `Open5eAction`, `Open5eMonster` and `Open5eResponse`, and the functions `mapOpen5eSize`, `convertOpen5eAction`, `parseStringToArray`, `convertOpen5eToCreature` and `searchOpen5e`.
2. Paste it into the new file under this header:

```ts
/**
 * Open5e (SRD) monster search and conversion to VVTT creatures.
 * Moved from Sidebar.tsx so the Squads tab can staff monsters too.
 */
import { v4 as uuid } from 'uuid';
import type { Creature, Statblock } from '../types';
```

3. Add `export` to `interface Open5eMonster`, `function convertOpen5eToCreature` and `async function searchOpen5e`.
4. Make the position optional: change the signature to `export function convertOpen5eToCreature(monster: Open5eMonster, position?: { x: number; y: number }): Creature {`. Change the returned `position,` to `...(position ? { position } : {}),`.

- [ ] **Step 5: Create `src/components/creatures/MonsterSearchDialog.tsx`**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, InputAdornment,
  List, ListItem, ListItemButton, ListItemText, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import { searchOpen5e, type Open5eMonster } from '../../services/open5e';

interface MonsterSearchDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxQuantity: number;
  /** Caption beside the quantity picker when the quantity is above 1. */
  quantityHint: (qty: number) => string;
  onPick: (monster: Open5eMonster, qty: number) => void;
}

/** Open5e monster search with a quantity picker. Used by the sidebar (Add) and the Squads tab (Staff). */
export function MonsterSearchDialog({ open, onClose, title, maxQuantity, quantityHint, onPick }: MonsterSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Open5eMonster[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Debounced search: waits 300ms after typing stops
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchOpen5e(query);
        setSearchResults(results);
        if (results.length === 0) setSearchError('No monsters found');
      } catch {
        setSearchError('Failed to search. Check your internet connection.');
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setQuantity(1);
    onClose();
  };

  const handlePick = (monster: Open5eMonster) => {
    onPick(monster, quantity);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search for monsters (e.g., 'goblin', 'dragon', 'devil')"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: isSearching ? (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ) : null,
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">Quantity:</Typography>
          <IconButton size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
            <RemoveIcon fontSize="small" />
          </IconButton>
          <TextField
            size="small" type="number" value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
            inputProps={{ min: 1, max: maxQuantity, style: { width: 40, textAlign: 'center', padding: '4px' } }}
          />
          <IconButton size="small" onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}>
            <AddIcon fontSize="small" />
          </IconButton>
          {quantity > 1 && <Typography variant="caption" color="text.secondary">{quantityHint(quantity)}</Typography>}
        </Box>

        {searchError && searchResults.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>{searchError}</Typography>
        )}

        {searchResults.length > 0 && (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {searchResults.map((monster) => (
              <ListItem key={monster.slug} disablePadding>
                <ListItemButton onClick={() => handlePick(monster)}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight={600}>{monster.name}</Typography>
                        <Chip label={`CR ${monster.challenge_rating}`} size="small" sx={{ height: 18, fontSize: '0.625rem' }} />
                        {quantity > 1 && <Chip label={`+${quantity}`} size="small" color="primary" sx={{ height: 18, fontSize: '0.625rem' }} />}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {monster.size} {monster.type} • HP {monster.hit_points} • AC {monster.armor_class}
                        {monster.document__title && ` • ${monster.document__title}`}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>Type at least 2 characters to search</Typography>
        )}

        {searchQuery.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
            Search the Open5e database for SRD monsters.
            <br />
            <Typography variant="caption" component="span">Includes monsters from the 5e SRD, Tome of Beasts, and more.</Typography>
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Move the statblock viewer**

1. Cut `// Statblock Display Component` and `function StatblockDisplay` (from the comment to the end of `Sidebar.tsx`) into `src/components/statblocks/StatblockDisplay.tsx`. Prefix the function with `export`, and put this header above it:

```tsx
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { Statblock } from '../../types';
```

   If `tsc` reports another missing name, add it to that import.

2. Create `src/components/statblocks/StatblockDialog.tsx`. It contains the Sidebar's statblock modal markup, unchanged:

```tsx
import { Box, Chip, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Creature } from '../../types';
import { StatblockDisplay } from './StatblockDisplay';

/** Full statblock for a creature (sidebar "View statblock" and the Squads tab member menu). */
export function StatblockDialog({ creature, onClose }: { creature: Creature | null; onClose: () => void }) {
  return (
    <Dialog open={!!creature} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      {creature && (
        <>
          <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5" fontWeight={700} sx={{ color: 'primary.main' }}>{creature.statblock.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {creature.statblock.size} {creature.statblock.type}
                  {creature.statblock.subtype && ` (${creature.statblock.subtype})`}
                  , {creature.statblock.alignment}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Chip label={`CR ${creature.statblock.cr}`} color="primary" />
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <StatblockDisplay statblock={creature.statblock} />
          </DialogContent>
        </>
      )}
    </Dialog>
  );
}
```

- [ ] **Step 7: Rewire `Sidebar.tsx`**

1. Imports:
   - Remove `import { nextStackName } from '../../utils/stack';`.
   - Add:

```ts
import { convertOpen5eToCreature, type Open5eMonster } from '../../services/open5e';
import { MonsterSearchDialog } from '../creatures/MonsterSearchDialog';
import { StatblockDialog } from '../statblocks/StatblockDialog';
import { makeCustomNpc } from '../../utils/customNpc';
```

2. In `Sidebar()`, delete:
   - the state `searchQuery`, `searchResults`, `isSearching`, `searchError`, `searchDebounceRef`, `addQuantity`, `addAsSquad`;
   - the debounce-cleanup `useEffect`;
   - `handleSearch`.

   Keep `showOpen5eSearch`.

3. Replace `handleAddOpen5eMonster` with:

```ts
  // Add monster(s) from Open5e: more than one adds separate numbered creatures (build squads in the Squads tab)
  const handleAddOpen5eMonster = (monster: Open5eMonster, qty: number) => {
    const existingNpcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    for (let i = 0; i < qty; i++) {
      const index = existingNpcCount + i;
      const offsetX = (index % 5) * 30 - 60;
      const offsetY = Math.floor(index / 5) * 30 + 50;
      const creature = convertOpen5eToCreature(monster, { x: offsetX, y: offsetY });
      if (qty > 1) creature.name = `${monster.name} ${i + 1}`;
      addCreature(creature);
    }
  };
```

4. Replace the body of `handleAddCreature` up to `addCreature(creature);` with:

```ts
    const name = preset?.name || creatureName || 'Unknown';
    const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc').length;
    const creature: Creature = {
      ...makeCustomNpc({
        name,
        hp: preset?.maxHp || creatureHp,
        ac: preset?.ac || creatureAc,
        speed: preset?.speed?.walk || creatureSpeed,
        initiative: creatureInit,
        size: preset?.size,
        type: preset?.type,
        cr: preset?.cr,
      }),
      position: { x: (npcCount % 5) * 30 - 60, y: Math.floor(npcCount / 5) * 30 + 50 },
    };
```

   Keep the `addCreature(creature);` and the form resets after it.

5. Replace the whole `{/* Open5e Search Dialog */} <Dialog …>…</Dialog>` block with:

```tsx
      {/* Open5e Search Dialog */}
      <MonsterSearchDialog
        open={showOpen5eSearch}
        onClose={() => setShowOpen5eSearch(false)}
        title="Search Open5e Monsters"
        maxQuantity={20}
        quantityHint={() => '(will be numbered, e.g. "Goblin 1", "Goblin 2")'}
        onPick={handleAddOpen5eMonster}
      />
```

6. Replace the whole `{/* Statblock Modal */} <Dialog …>…</Dialog>` block with:

```tsx
      {/* Statblock Modal */}
      <StatblockDialog creature={viewingCreature} onClose={() => setViewingCreature(null)} />
```

7. Run `npx eslint src/components/layout/Sidebar.tsx` and delete each import it reports as unused. Likely candidates are `useCallback`, `useEffect`, `List`, `ListItem`, `ListItemButton`, `CircularProgress`, `InputAdornment`, `Switch`, `FormControlLabel`, `Dialog`, `DialogTitle`, `DialogContent`, `CloseIcon` and `Statblock`. Keep any that are still used.

- [ ] **Step 8: Run the suite, type-check and lint**

Run: `npx vitest run && npx tsc -p tsconfig.app.json && npx eslint src/services/open5e.ts src/components/creatures/MonsterSearchDialog.tsx src/utils/customNpc.ts src/utils/customNpc.test.ts src/components/statblocks src/components/layout/Sidebar.tsx`

Expected: all clean.

- [ ] **Step 9: Smoke-check the sidebar**

If `npm run dev` starts within a minute, open `/app`. Check:
- Add → Search Open5e "goblin", quantity 3 → three rows "Goblin 1–3". The quantity cap is 20 and there is no squad switch.
- Custom NPC → Add works.
- The NPC row's statblock button opens the statblock.

If the dev server hangs (see the iCloud warning), skip this step and note it for the Browser checklist.

- [ ] **Step 10: Commit**

```bash
git add src/services/open5e.ts src/components/creatures/MonsterSearchDialog.tsx src/utils/customNpc.ts src/utils/customNpc.test.ts src/components/statblocks/StatblockDisplay.tsx src/components/statblocks/StatblockDialog.tsx src/components/layout/Sidebar.tsx
git commit -m "$(cat <<'EOF'
Extract Open5e search, custom NPC and statblock viewer; drop the "Add as one squad" switch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 7: The Squads tab: squad cards and staffing

**Files:**
- Create: `src/components/squads/SquadsView.tsx`, `src/components/squads/SquadCard.tsx`, `src/components/squads/SquadMoraleControls.tsx`, `src/components/squads/CustomNpcDialog.tsx`
- Modify: `src/components/layout/MainPanel.tsx`, `src/components/vehicles/VehicleCard.tsx`

**Interfaces:**
- Consumes:
  - actions `ADD_SQUAD`, `UPDATE_SQUAD`, `REMOVE_SQUAD`, `ADD_SQUAD_MEMBER`, `REMOVE_SQUAD_MEMBER`, `SPLIT_STACK`, `GROW_STACK` (Task 4);
  - `REQUEST_MORALE`, `SET_MORALE_STATUS`, `RESET_SQUAD_MORALE` with `squadId` (Task 5);
  - `squadMembers`, `squadStandingCount`, `isStanding`, `isHalfStrength`, `staffableCreatures`, `toStaffMember`, `newSquadName` (Task 2);
  - `MonsterSearchDialog`, `convertOpen5eToCreature`, `makeCustomNpc`, `StatblockDialog` (Task 6).
- Produces:
  - `<SquadsView />`
  - `<SquadCard squad index />`. Task 9 adds its Hit… and Area… buttons.
  - `<SquadMoraleControls squad />`
  - `<CustomNpcDialog open onClose maxQuantity onAdd={(creature, qty) => void} />`

This is UI only. All decisions are in the tested `squads.ts` and reducer. Verification is type-check, lint, the full suite, and the browser checklist.

- [ ] **Step 1: `src/components/squads/SquadMoraleControls.tsx`**

```tsx
import { Box, Button, Chip } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoraleStatus, Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';

const NEXT_STATUS: Record<MoraleStatus, MoraleStatus | undefined> = { fleeing: 'surrendered', surrendered: undefined };

/** Squad card: Steady / Fleeing / Surrendered chip (click cycles) and a manual morale check (DMG 2014 p. 273). */
export function SquadMoraleControls({ squad }: { squad: Squad }) {
  const { state, dispatch } = useCombat();
  const status = squad.morale?.status;
  const pending = state.moralePrompts.some((p) => p.squadId === squad.id);
  const canCheck = state.phase === 'combat' && squadStandingCount(squad, state.creatures) > 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {status ? (
        <Chip
          size="small" label={status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'} color={status === 'fleeing' ? 'warning' : 'default'}
          title="Click: Fleeing → Surrendered → Steady"
          onClick={() => dispatch({ type: 'SET_MORALE_STATUS', payload: { squadId: squad.id, status: NEXT_STATUS[status] } })}
        />
      ) : (
        <Chip size="small" variant="outlined" label="⚑ Steady" />
      )}
      {canCheck && (
        <Button
          size="small" disabled={pending} title="Ask for a morale check (surprise or any other DMG trigger)"
          onClick={() => dispatch({ type: 'REQUEST_MORALE', payload: { squadId: squad.id } })}
          sx={{ minWidth: 0, px: 0.75, fontSize: '0.7rem' }}
        >
          Morale
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: `src/components/squads/CustomNpcDialog.tsx`**

```tsx
import { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import type { Creature } from '../../types';
import { makeCustomNpc } from '../../utils/customNpc';

/** The custom-NPC form in staff mode: quantity 1 adds an individual, 2 or more adds one stack. */
export function CustomNpcDialog({ open, onClose, maxQuantity, onAdd }: {
  open: boolean; onClose: () => void; maxQuantity: number; onAdd: (creature: Creature, qty: number) => void;
}) {
  const [name, setName] = useState('');
  const [hp, setHp] = useState(30);
  const [ac, setAc] = useState(14);
  const [speed, setSpeed] = useState(30);
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    onAdd(makeCustomNpc({ name: name.trim(), hp, ac, speed }), qty);
    setName('');
    setQty(1);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Custom NPC</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField size="small" label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="HP" type="number" value={hp} onChange={(e) => setHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
            <TextField size="small" label="AC" type="number" value={ac} onChange={(e) => setAc(parseInt(e.target.value) || 10)} sx={{ flex: 1 }} />
            <TextField size="small" label="Speed" type="number" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value) || 30)} sx={{ flex: 1 }} />
          </Stack>
          <TextField
            size="small" label="Quantity" type="number" value={qty} inputProps={{ min: 1, max: maxQuantity }}
            onChange={(e) => setQty(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
          />
          <Typography variant="caption" color="text.secondary">
            {qty > 1 ? `Adds one stack: ${qty} bodies on one row (e.g. "${name || 'Guard'} ×${qty}").` : 'Adds one individual.'}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!name.trim()}>Add to squad</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 3: `src/components/squads/SquadCard.tsx`**

```tsx
import { useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton,
  ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useCombat } from '../../context/CombatContext';
import type { Creature, Squad, SquadUpdates } from '../../types';
import { isHalfStrength, isStanding, squadMembers, squadStandingCount, staffableCreatures, toStaffMember } from '../../utils/squads';
import { convertOpen5eToCreature } from '../../services/open5e';
import { factionColors } from '../../theme/customColors';
import { MonsterSearchDialog } from '../creatures/MonsterSearchDialog';
import { StatblockDialog } from '../statblocks/StatblockDialog';
import { CustomNpcDialog } from './CustomNpcDialog';
import { SquadMoraleControls } from './SquadMoraleControls';

const STAFF_MAX = 50; // fits the tower's 40 hobgoblins

/** One squad on the Squads tab: name, faction, initiative, commander, members, staffing, map placement, morale. */
export function SquadCard({ squad, index }: { squad: Squad; index: number }) {
  const { state, dispatch } = useCombat();
  const members = squadMembers(squad, state.creatures);
  const standing = squadStandingCount(squad, state.creatures);
  const commander = squad.commanderId ? state.creatures.find((c) => c.id === squad.commanderId) : undefined;
  const pcOptions = state.creatures.filter((c) =>
    c.statblock.type === 'pc' && c.faction === 'party' && !squad.memberIds.includes(c.id)
    && !state.squads.some((s) => s.id !== squad.id && s.commanderId === c.id));
  const existing = staffableCreatures(state.creatures, state.squads, state.crewAssignments);
  const stacks = members.filter((m) => m.stack);
  const color = squad.faction === 'party' ? factionColors.party : factionColors.enemy;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(squad.name);
  const [squadMenu, setSquadMenu] = useState<HTMLElement | null>(null);
  const [staffMenu, setStaffMenu] = useState<HTMLElement | null>(null);
  const [existingMenu, setExistingMenu] = useState<HTMLElement | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ anchor: HTMLElement; member: Creature } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [growOpen, setGrowOpen] = useState(false);
  const [growId, setGrowId] = useState('');
  const [growBy, setGrowBy] = useState(1);
  const [viewing, setViewing] = useState<Creature | null>(null);

  const update = (updates: SquadUpdates) => dispatch({ type: 'UPDATE_SQUAD', payload: { id: squad.id, updates } });
  const staff = (base: Creature, qty: number) =>
    dispatch({ type: 'ADD_SQUAD_MEMBER', payload: { squadId: squad.id, creature: toStaffMember(base, qty, state.creatures) } });
  const saveName = () => {
    const name = nameDraft.trim();
    if (name) update({ name });
    setEditingName(false);
  };
  const closeMemberMenu = () => setMemberMenu(null);
  const member = memberMenu?.member;

  return (
    <Card sx={{ borderLeft: 4, borderColor: color }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header: name, faction, initiative, morale, squad menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {editingName ? (
            <TextField
              size="small" autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={saveName}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
            />
          ) : (
            <Typography variant="h6" sx={{ cursor: 'pointer' }} onClick={() => { setNameDraft(squad.name); setEditingName(true); }}>
              {squad.name} <EditIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Typography>
          )}
          <TextField
            select size="small" value={squad.faction} onChange={(e) => update({ faction: e.target.value as Squad['faction'] })}
            sx={{ width: 110 }}
          >
            <MenuItem value="enemy">Enemy</MenuItem>
            <MenuItem value="party">Party</MenuItem>
          </TextField>
          {commander ? (
            <Tooltip title="VVTT rule: a commanded squad acts immediately after its commander" arrow>
              <Chip size="small" label={`Init: after ${commander.name}`} />
            </Tooltip>
          ) : (
            <Tooltip title="VVTT rule: d20 + the leader's DEX modifier (else the first member's). The Roll Init buttons roll it." arrow>
              <TextField
                size="small" type="number" label="Init" value={squad.initiative ?? ''} sx={{ width: 80 }}
                onChange={(e) => { const n = parseInt(e.target.value, 10); update({ initiative: Number.isFinite(n) ? n : undefined }); }}
              />
            </Tooltip>
          )}
          <Chip size="small" label={`${standing}/${squad.startingCount} standing`} />
          {state.phase === 'combat' && isHalfStrength(squad, state.creatures) && (
            <Chip size="small" color="warning" label="Half strength (VVTT rule)" />
          )}
          <Box sx={{ flex: 1 }} />
          <SquadMoraleControls squad={squad} />
          <IconButton size="small" onClick={(e) => setSquadMenu(e.currentTarget)} aria-label="Squad menu">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Commander */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">Commander:</Typography>
          <TextField
            select size="small" value={squad.commanderId ?? ''} sx={{ minWidth: 180 }}
            onChange={(e) => update({ commanderId: e.target.value || undefined })}
          >
            <MenuItem value="">— (none)</MenuItem>
            {commander && <MenuItem value={commander.id}>{commander.name}</MenuItem>}
            {pcOptions.filter((c) => c.id !== commander?.id).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          {commander && <Typography variant="caption" color="text.secondary">{commander.name} directs this squad and keeps their own turn</Typography>}
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Members */}
        {members.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No members yet. Use + Staff to add creatures.</Typography>
        ) : (
          <Stack spacing={0.25}>
            {members.map((m) => {
              const up = isStanding(m);
              return (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: up ? 1 : 0.45 }}>
                  <Typography sx={{ width: 16, color: 'warning.main' }} title={squad.leaderId === m.id ? 'Leader' : undefined}>
                    {squad.leaderId === m.id ? '★' : ''}
                  </Typography>
                  <Typography variant="body2" sx={{ flex: 1, textDecoration: up ? 'none' : 'line-through' }}>{m.name}</Typography>
                  <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                    {m.stack
                      ? `${m.stack.bodies}/${m.stack.size} bodies (front ${m.currentHp}/${m.statblock.maxHp})`
                      : `${m.currentHp}/${m.statblock.maxHp} HP`}
                    {` · AC ${m.statblock.ac}`}
                  </Typography>
                  <IconButton size="small" onClick={(e) => setMemberMenu({ anchor: e.currentTarget, member: m })} aria-label={`${m.name} menu`}>
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                </Box>
              );
            })}
          </Stack>
        )}

        {/* Footer: staffing and placement */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} endIcon={<ArrowDropDownIcon />} onClick={(e) => setStaffMenu(e.currentTarget)}>
            Staff
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small" variant="outlined"
            onClick={() => update({ position: squad.position ? undefined : { x: (index % 5) * 60 - 120, y: 120 + Math.floor(index / 5) * 60 } })}
          >
            {squad.position ? 'Remove from map' : 'Place on map'}
          </Button>
        </Box>
      </CardContent>

      {/* Squad menu */}
      <Menu anchorEl={squadMenu} open={Boolean(squadMenu)} onClose={() => setSquadMenu(null)}>
        <MenuItem onClick={() => { setSquadMenu(null); dispatch({ type: 'REMOVE_SQUAD', payload: { id: squad.id, deleteMembers: false } }); }}>
          <ListItemText primary="Disband" secondary="Members stay as standalone creatures" />
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            setSquadMenu(null);
            if (window.confirm(`Delete ${squad.name} and its ${members.length} member${members.length === 1 ? '' : 's'}?`)) {
              dispatch({ type: 'REMOVE_SQUAD', payload: { id: squad.id, deleteMembers: true } });
            }
          }}
        >
          Delete squad and members
        </MenuItem>
        <MenuItem onClick={() => { setSquadMenu(null); dispatch({ type: 'RESET_SQUAD_MORALE', payload: { squadId: squad.id } }); }}>
          Reset morale
        </MenuItem>
      </Menu>

      {/* Staff menu */}
      <Menu anchorEl={staffMenu} open={Boolean(staffMenu)} onClose={() => setStaffMenu(null)}>
        <MenuItem disabled={existing.length === 0} onClick={(e) => { setExistingMenu(e.currentTarget); setStaffMenu(null); }}>
          Existing creature…
        </MenuItem>
        <MenuItem onClick={() => { setStaffMenu(null); setSearchOpen(true); }}>Monster search…</MenuItem>
        <MenuItem onClick={() => { setStaffMenu(null); setCustomOpen(true); }}>Custom NPC…</MenuItem>
        <MenuItem disabled={stacks.length === 0} onClick={() => { setStaffMenu(null); setGrowId(stacks[0]?.id ?? ''); setGrowBy(1); setGrowOpen(true); }}>
          Add bodies…
        </MenuItem>
      </Menu>

      {/* Existing standalone creatures (not in a squad, not crew) */}
      <Menu anchorEl={existingMenu} open={Boolean(existingMenu)} onClose={() => setExistingMenu(null)} slotProps={{ paper: { sx: { maxHeight: 300 } } }}>
        {existing.map((c) => (
          <MenuItem
            key={c.id}
            onClick={() => { setExistingMenu(null); dispatch({ type: 'ADD_SQUAD_MEMBER', payload: { squadId: squad.id, creatureId: c.id } }); }}
          >
            <ListItemText
              primary={c.name}
              secondary={c.stack ? `${c.stack.bodies}/${c.stack.size} bodies` : `HP ${c.currentHp}/${c.statblock.maxHp}`}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Member menu */}
      <Menu anchorEl={memberMenu?.anchor} open={Boolean(memberMenu)} onClose={closeMemberMenu}>
        {member && squad.leaderId !== member.id && (
          <MenuItem onClick={() => { closeMemberMenu(); update({ leaderId: member.id }); }}>Make leader ★</MenuItem>
        )}
        {member && squad.leaderId === member.id && (
          <MenuItem onClick={() => { closeMemberMenu(); update({ leaderId: undefined }); }}>Clear leader</MenuItem>
        )}
        {member && (
          <MenuItem onClick={() => { closeMemberMenu(); dispatch({ type: 'REMOVE_SQUAD_MEMBER', payload: { squadId: squad.id, creatureId: member.id } }); }}>
            Remove from squad
          </MenuItem>
        )}
        {member?.stack && member.stack.bodies >= 2 && (
          <MenuItem onClick={() => { closeMemberMenu(); dispatch({ type: 'SPLIT_STACK', payload: { creatureId: member.id } }); }}>
            Split off 1
          </MenuItem>
        )}
        {member && (
          <MenuItem onClick={() => { closeMemberMenu(); setViewing(member); }}>View statblock</MenuItem>
        )}
      </Menu>

      <MonsterSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={`Staff ${squad.name}: search Open5e`}
        maxQuantity={STAFF_MAX}
        quantityHint={(qty) => `Adds one stack of ${qty} bodies on one row`}
        onPick={(monster, qty) => staff(convertOpen5eToCreature(monster), qty)}
      />
      <CustomNpcDialog open={customOpen} onClose={() => setCustomOpen(false)} maxQuantity={STAFF_MAX} onAdd={staff} />
      <StatblockDialog creature={viewing} onClose={() => setViewing(null)} />

      {/* Add bodies to a stack */}
      <Dialog open={growOpen} onClose={() => setGrowOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add bodies</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField select size="small" label="Stack" value={growId} onChange={(e) => setGrowId(e.target.value)}>
              {stacks.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <TextField
              size="small" type="number" label="Bodies to add" value={growBy} inputProps={{ min: 1, max: STAFF_MAX }}
              onChange={(e) => setGrowBy(Math.max(1, Math.min(STAFF_MAX, parseInt(e.target.value) || 1)))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrowOpen(false)}>Cancel</Button>
          <Button
            variant="contained" disabled={!growId}
            onClick={() => { dispatch({ type: 'GROW_STACK', payload: { creatureId: growId, amount: growBy } }); setGrowOpen(false); }}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 4: `src/components/squads/SquadsView.tsx`**

```tsx
import { v4 as uuid } from 'uuid';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCombat } from '../../context/CombatContext';
import { newSquadName } from '../../utils/squads';
import { SquadCard } from './SquadCard';

/** The Squads tab: build squads on purpose, then staff them like vehicles. */
export function SquadsView() {
  const { state, dispatch } = useCombat();
  const addSquad = () =>
    dispatch({ type: 'ADD_SQUAD', payload: { id: uuid(), name: newSquadName(state.squads), faction: 'enemy', memberIds: [], startingCount: 0 } });
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addSquad}>New squad</Button>
      </Box>
      {state.squads.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary" gutterBottom>No squads yet</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              A squad takes one initiative slot and one map token. Staff it with individuals or stacks (e.g. Hobgoblin ×8), mix creature types, and give it a PC commander if you like.
            </Typography>
            <Button variant="outlined" size="small" onClick={addSquad}>+ New squad</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {state.squads.map((squad, index) => <SquadCard key={squad.id} squad={squad} index={index} />)}
        </Stack>
      )}
    </Box>
  );
}
```

- [ ] **Step 5: Mount the tab in `src/components/layout/MainPanel.tsx`**

1. Change the type to `type ViewMode = 'battlefield' | 'cards' | 'squads';`.
2. Add the imports `import GroupsIcon from '@mui/icons-material/Groups';` and `import { SquadsView } from '../squads/SquadsView';`.
3. After the Vehicles `<ToggleButton value="cards">…</ToggleButton>`, add:

```tsx
            <ToggleButton value="squads">
              <GroupsIcon sx={{ mr: 1, fontSize: 18 }} />
              Squads
            </ToggleButton>
```

4. After the block `{viewMode === 'cards' && (<Box sx={{ mt: 3 }}><CombatLog /></Box>)}`, add:

```tsx
        {/* Squads View */}
        {viewMode === 'squads' && (
          <>
            <SquadsView />
            <Box sx={{ mt: 3 }}>
              <CombatLog />
            </Box>
          </>
        )}
```

- [ ] **Step 6: Keep squad members out of vehicle crew pickers**

In `src/components/vehicles/VehicleCard.tsx`, in `CrewZone`, replace:

```ts
  const unassignedCreatures = state.creatures.filter(
    (c) => !assignedCreatureIds.includes(c.id)
  );
```

with:

```ts
  // Squad members can't be crew (spec "Membership and assignments")
  const squadMemberIds = new Set(state.squads.flatMap((s) => s.memberIds));
  const unassignedCreatures = state.creatures.filter(
    (c) => !assignedCreatureIds.includes(c.id) && !squadMemberIds.has(c.id)
  );
```

- [ ] **Step 7: Verify**

Run: `npx tsc -p tsconfig.app.json && npx vitest run && npx eslint src/components/squads/SquadsView.tsx src/components/squads/SquadCard.tsx src/components/squads/SquadMoraleControls.tsx src/components/squads/CustomNpcDialog.tsx src/components/layout/MainPanel.tsx src/components/vehicles/VehicleCard.tsx`

Expected: clean.

If the dev server runs, open the Squads tab and check:
- **+ New squad** creates "Squad 1".
- The name edits inline, and the faction switches.
- Staff → Monster search "hobgoblin" with quantity 8 adds "Hobgoblin ×8 (A)" with 8/8 bodies.
- Staff → Custom NPC with quantity 1 adds an individual.
- Make leader moves the ★.
- Split off 1 drops the stack to 7, and a standalone Hobgoblin appears in the sidebar.
- **Place on map** toggles.

- [ ] **Step 8: Commit**

```bash
git add src/components/squads/SquadsView.tsx src/components/squads/SquadCard.tsx src/components/squads/SquadMoraleControls.tsx src/components/squads/CustomNpcDialog.tsx src/components/layout/MainPanel.tsx src/components/vehicles/VehicleCard.tsx
git commit -m "$(cat <<'EOF'
Squads tab: squad cards with staffing, leader, commander, faction, morale and map placement

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 8: Sidebar grouping, the initiative tracker, and squad initiative rolls

**Files:**
- Create: `src/components/squads/SquadListGroup.tsx`, `src/components/squads/SquadInitiativeRow.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes:
  - `groupBySquad`, `squadInitiativeBonus`, `squadStandingCount` (Task 2);
  - `UPDATE_SQUAD` (Task 4).
- Produces:
  - `<SquadListGroup squad>{children}</SquadListGroup>`
  - `<SquadInitiativeRow squad isActive />`
  - `CreatureEntry` gains an optional `inSquad` prop.

- [ ] **Step 1: `src/components/squads/SquadListGroup.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';

/** Sidebar heading for a squad's members (indented under it). The squad itself is managed in the Squads tab. */
export function SquadListGroup({ squad, children }: { squad: Squad; children: ReactNode }) {
  const { state } = useCombat();
  return (
    <Box>
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mt: 0.5 }} title="Manage in the Squads tab">
        ⚑ {squad.name} · {squadStandingCount(squad, state.creatures)}/{squad.startingCount} standing
      </Typography>
      <Stack spacing={0.5} sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>{children}</Stack>
    </Box>
  );
}
```

- [ ] **Step 2: `src/components/squads/SquadInitiativeRow.tsx`**

```tsx
import { Box, Paper, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';
import { factionColors, withOpacity } from '../../theme/customColors';

/** A squad's single slot in the initiative tracker. "↳" means it acts right after its commander (VVTT rule). */
export function SquadInitiativeRow({ squad, isActive }: { squad: Squad; isActive: boolean }) {
  const { state } = useCombat();
  const standing = squadStandingCount(squad, state.creatures);
  const commander = squad.commanderId ? state.creatures.find((c) => c.id === squad.commanderId) : undefined;
  const color = squad.faction === 'party' ? factionColors.party : factionColors.enemy;
  const out = standing === 0;
  return (
    <Paper sx={{ p: 1, bgcolor: isActive ? withOpacity(color, 0.15) : '#242424', borderLeft: 3, borderColor: color, opacity: out ? 0.6 : 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" fontFamily="monospace" sx={{ minWidth: 24 }}>{commander ? '↳' : (squad.initiative ?? '—')}</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ textDecoration: out ? 'line-through' : 'none' }}>⚑ {squad.name}</Typography>
          {commander && <Typography variant="caption" color="text.secondary">directed by {commander.name}</Typography>}
          {squad.morale?.status && (
            <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
              {squad.morale.status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" fontFamily="monospace">{standing}/{squad.startingCount}</Typography>
      </Box>
    </Paper>
  );
}
```

- [ ] **Step 3: Show squads in the initiative tracker**

In `Sidebar.tsx`, inside `state.initiativeOrder.map((entryId, index) => {`, find the line `const creature = state.creatures.find((c) => c.id === entryId);`. Insert this immediately before it:

```tsx
                const squad = state.squads.find((s) => s.id === entryId);
                if (squad) return <SquadInitiativeRow key={entryId} squad={squad} isActive={isActive} />;
```

- [ ] **Step 4: Roll squad initiative with the PC and NPC buttons (VVTT rule 5)**

Add these imports to `Sidebar.tsx`:

```ts
import { groupBySquad, squadInitiativeBonus } from '../../utils/squads';
import { SquadListGroup } from '../squads/SquadListGroup';
import { SquadInitiativeRow } from '../squads/SquadInitiativeRow';
```

After `rollShipsInit`, add:

```ts
  // VVTT rule 5: uncommanded squads roll d20 + the leader's DEX modifier (else the first member's).
  // Party squads roll with the PC button, enemy squads with the NPC button. Commanded squads follow their PC.
  const rollSquadsInit = (faction: 'party' | 'enemy') => {
    state.squads
      .filter((s) => s.faction === faction && !s.commanderId && s.memberIds.length > 0)
      .forEach((squad) => {
        const d20 = Math.floor(Math.random() * 20) + 1;
        const bonus = squadInitiativeBonus(squad, state.creatures);
        const total = d20 + bonus;
        dispatch({ type: 'UPDATE_SQUAD', payload: { id: squad.id, updates: { initiative: total } } });
        dispatch({
          type: 'LOG_ACTION',
          payload: { type: 'system', action: `${squad.name} initiative: ${d20} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)} = ${total} (VVTT rule: leader's DEX)` },
        });
      });
  };
```

Call it from the two roll handlers:
- `handleRollAllNpcInit`: add `rollSquadsInit('enemy');` before `rollShipsInit('enemy');`.
- `handleRollAllPcInit`: add `rollSquadsInit('party');` before `rollShipsInit('party');`.

Make the dice buttons appear when only squads exist:
- PC condition: add `|| state.squads.some((s) => s.faction === 'party')`.
- NPC condition: add `|| state.squads.some((s) => s.faction === 'enemy')`.
- Extend both tooltips with ` and squads (d20 + leader's DEX, VVTT rule)`.

- [ ] **Step 5: Group squad members under squad headings**

In `Sidebar()`, just before `return (`, hoist the shared edit state and the two row renderers:

```tsx
  const editState = { editName, setEditName, editHp, setEditHp, editMaxHp, setEditMaxHp, editAc, setEditAc, editInit, setEditInit, editSpeed, setEditSpeed, editDexSave, setEditDexSave, editFaction, setEditFaction, editBodies, setEditBodies };

  const renderPc = (creature: Creature, inSquad: boolean) => (
    <CreatureEntry
      key={creature.id}
      creature={creature}
      isPC={true}
      inSquad={inSquad}
      isEditing={editingCreatureId === creature.id}
      editState={editState}
      onStartEdit={() => startEdit(creature)}
      onSaveEdit={saveEdit}
      onCancelEdit={cancelEdit}
      onRemove={() => removeCreature(creature.id)}
      onToggleMap={() => {
        if (creature.position) {
          dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { position: undefined } } });
        } else {
          const pcCount = state.creatures.filter(c => c.statblock.type === 'pc' && c.position).length;
          dispatch({
            type: 'UPDATE_CREATURE',
            payload: { id: creature.id, updates: { position: { x: (pcCount % 5) * 30 - 60, y: Math.floor(pcCount / 5) * 30 - 50 } } },
          });
        }
      }}
      assignment={getCreatureAssignment(creature.id)}
    />
  );

  const renderNpc = (creature: Creature, inSquad: boolean) => (
    <CreatureEntry
      key={creature.id}
      creature={creature}
      isPC={false}
      inSquad={inSquad}
      isEditing={editingCreatureId === creature.id}
      editState={editState}
      onStartEdit={() => startEdit(creature)}
      onSaveEdit={saveEdit}
      onCancelEdit={cancelEdit}
      onRemove={() => removeCreature(creature.id)}
      onViewStatblock={() => setViewingCreature(creature)}
      onHpChange={(newHp) => {
        dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { currentHp: newHp } } });
      }}
      onToggleMap={() => {
        if (creature.position) {
          dispatch({ type: 'UPDATE_CREATURE', payload: { id: creature.id, updates: { position: undefined } } });
        } else {
          const npcCount = state.creatures.filter(c => c.statblock.type !== 'pc' && c.position).length;
          dispatch({
            type: 'UPDATE_CREATURE',
            payload: { id: creature.id, updates: { position: { x: (npcCount % 5) * 30 - 60, y: Math.floor(npcCount / 5) * 30 + 50 } } },
          });
        }
      }}
      assignment={getCreatureAssignment(creature.id)}
    />
  );
```

Replace the PC list body, `<Stack spacing={0.5}>{pcs.map((creature) => (<CreatureEntry … />))}</Stack>`, with:

```tsx
            <Stack spacing={0.5}>
              {groupBySquad(pcs, state.squads).map((group) =>
                group.squad ? (
                  <SquadListGroup key={group.squad.id} squad={group.squad}>
                    {group.members.map((creature) => renderPc(creature, true))}
                  </SquadListGroup>
                ) : (
                  group.members.map((creature) => renderPc(creature, false))
                ),
              )}
            </Stack>
```

Replace the NPC list body the same way, using `npcs` and `renderNpc`:

```tsx
            <Stack spacing={0.5}>
              {groupBySquad(npcs, state.squads).map((group) =>
                group.squad ? (
                  <SquadListGroup key={group.squad.id} squad={group.squad}>
                    {group.members.map((creature) => renderNpc(creature, true))}
                  </SquadListGroup>
                ) : (
                  group.members.map((creature) => renderNpc(creature, false))
                ),
              )}
            </Stack>
```

- [ ] **Step 6: `CreatureEntry` for squad members**

- Add `inSquad?: boolean; // member of a squad: managed in the Squads tab, no own token or morale` to `CreatureEntryProps`. Add `inSquad = false` to the destructured parameters.
- Wrap the `{/* Map button in lower right corner */}` `<Tooltip …>…</Tooltip>` block in `{!inSquad && ( … )}`. Members have no tokens of their own.
- Change `{!isPC && creature.stack && <SquadRowControls creature={creature} />}` to `{!isPC && !inSquad && creature.stack && <SquadRowControls creature={creature} />}`.
- Change `{!isPC && <MoraleRowControls creature={creature} />}` to `{!isPC && !inSquad && <MoraleRowControls creature={creature} />}`.

The ±HP controls, the edit form (HP, bodies) and conditions stay for members. The spec says HP editing and conditions still work there. Hit and Area for squads live on the squad card and token.

- [ ] **Step 7: Verify**

Run: `npx tsc -p tsconfig.app.json && npx vitest run && npx eslint src/components/squads/SquadListGroup.tsx src/components/squads/SquadInitiativeRow.tsx src/components/layout/Sidebar.tsx`

Expected: clean.

If the dev server runs, check:
- Staffed creatures appear indented under "⚑ Squad name · n/m standing".
- Standalone ones list as before.
- Rolling NPC initiative logs "Squad 1 initiative: … (VVTT rule: leader's DEX)".
- Start Combat shows one ⚑ row for the squad, and no rows for its members.

- [ ] **Step 8: Commit**

```bash
git add src/components/squads/SquadListGroup.tsx src/components/squads/SquadInitiativeRow.tsx src/components/layout/Sidebar.tsx
git commit -m "$(cat <<'EOF'
Sidebar: group squad members under their squad, squad initiative rows and rolls

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Hit… and Area… on squads

**Files:**
- Modify: `src/utils/squads.ts`, `src/utils/squads.test.ts`
- Create: `src/components/squads/SquadHitDialog.tsx`
- Rewrite: `src/components/squads/SquadAreaDialog.tsx`
- Modify: `src/components/squads/SquadRowControls.tsx`, `src/components/squads/SquadCard.tsx`

**Interfaces:**
- Consumes:
  - `saveBonus`, `adjustForDefenses`, `resolveStackArea`, `formatAreaSummary`, `aoeTargetCount`, `aoeAdvice`, `AreaSave`, `Roller` (`./stack`);
  - `splitAreaCount`, `defaultHitTarget` (Task 2);
  - `SQUAD_HIT`, `SQUAD_AREA`, `SquadAreaMemberResult` (Task 4).
- Produces:
  - `interface IndividualAreaResult { save: AreaSave; currentHp: number; tempHp: number }`
  - `resolveIndividualArea({ creature, dc, ability, damage, halfOnSave, damageType, magical?, roll }): IndividualAreaResult`
  - `formatSquadAreaSummary(source: string, squadName: string, totals: { caught: number; failed: number; fell: number }, standing: number, starting: number): string`
  - `<SquadHitDialog squad open onClose />`
  - `<SquadAreaDialog members title squadId? open onClose />`. This replaces the old `{ creature }` prop. A standalone stack passes `members={[creature]}` and no `squadId`, and gets exactly the v2.11 summary and details text.

- [ ] **Step 1: Append the failing tests** to `src/utils/squads.test.ts`

Add `resolveIndividualArea` and `formatSquadAreaSummary` to the import from `./squads`. Then append:

```ts
describe('resolveIndividualArea (one save per individual, own bonus, temp HP first)', () => {
  const dice = (...values: number[]) => () => values.shift()!;
  const captain = (over: Partial<Creature> = {}) => ind('k', 39, {
    tempHp: 5,
    statblock: { name: 'k', type: 'humanoid', maxHp: 39, ac: 17, abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 }, savingThrows: { dex: 3 } },
    ...over,
  } as Partial<Creature>);
  const base = { dc: 15, ability: 'dex' as const, damage: 28, halfOnSave: true, damageType: 'fire' };
  it('a save halves the damage; temp HP soaks first', () => {
    expect(resolveIndividualArea({ ...base, creature: captain(), roll: dice(12) })).toEqual({
      save: { d20: 12, total: 15, success: true, taken: 14, fell: false }, currentHp: 30, tempHp: 0,
    });
  });
  it('a failure takes full damage; resistance halves it', () => {
    expect(resolveIndividualArea({ ...base, creature: captain(), roll: dice(2) }).currentHp).toBe(16);
    const resistant = captain({ statblock: { ...captain().statblock, damageResistances: ['fire'] } });
    expect(resolveIndividualArea({ ...base, creature: resistant, roll: dice(2) }).save.taken).toBe(14);
  });
  it('dropping to 0 counts as falling', () => {
    const r = resolveIndividualArea({ ...base, creature: captain({ currentHp: 10, tempHp: 0 }), roll: dice(2) });
    expect(r).toMatchObject({ currentHp: 0, save: { fell: true } });
  });
});

describe('formatSquadAreaSummary', () => {
  it('names the squad and the standing count after the effect', () => {
    expect(formatSquadAreaSummary('Fireball', 'Tower Guard', { caught: 4, failed: 3, fell: 3 }, 11, 14))
      .toBe('Fireball on Tower Guard: 4 caught, 3 failed → 3 fall (11/14 standing)');
    expect(formatSquadAreaSummary('Cone of Cold', 'Tower Guard', { caught: 2, failed: 0, fell: 0 }, 14, 14))
      .toBe('Cone of Cold on Tower Guard: 2 caught, 0 failed → none fall (14/14 standing)');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/utils/squads.test.ts`

Expected: FAIL (the functions are not exported).

- [ ] **Step 3: Implement in `src/utils/squads.ts`**

Change the imports:

```ts
import type { AbilityName, CrewAssignment, Creature, Squad } from '../types';
import { adjustForDefenses, nextStackName, saveBonus, type AreaSave, type Roller } from './stack';
```

Append:

```ts
export interface IndividualAreaResult { save: AreaSave; currentHp: number; tempHp: number }

/** An individual caught in an area: its own save (PHB), resistances, temporary HP first. Damage is rolled once by the caller. */
export function resolveIndividualArea({ creature, dc, ability, damage, halfOnSave, damageType, magical = false, roll }: {
  creature: Creature; dc: number; ability: AbilityName; damage: number; halfOnSave: boolean; damageType: string; magical?: boolean; roll: Roller;
}): IndividualAreaResult {
  const d20 = roll(20);
  const total = d20 + saveBonus(creature.statblock, ability);
  const success = total >= dc;
  const raw = success ? (halfOnSave ? Math.floor(damage / 2) : 0) : damage;
  const taken = adjustForDefenses(raw, damageType, creature.statblock, magical);
  const fromTemp = Math.min(creature.tempHp, taken);
  const currentHp = Math.max(0, creature.currentHp - (taken - fromTemp));
  return {
    save: { d20, total, success, taken, fell: currentHp === 0 && creature.currentHp > 0 },
    currentHp,
    tempHp: creature.tempHp - fromTemp,
  };
}

/** "Fireball on Tower Guard: 4 caught, 3 failed → 3 fall (11/14 standing)" */
export function formatSquadAreaSummary(
  source: string, squadName: string, totals: { caught: number; failed: number; fell: number }, standing: number, starting: number,
): string {
  const fall = totals.fell === 0 ? 'none fall' : `${totals.fell} fall`;
  return `${source} on ${squadName}: ${totals.caught} caught, ${totals.failed} failed → ${fall} (${standing}/${starting} standing)`;
}
```

Run: `npx vitest run src/utils/squads.test.ts`

Expected: PASS.

- [ ] **Step 4: `src/components/squads/SquadHitDialog.tsx`**

```tsx
import { useState } from 'react';
import {
  Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Squad } from '../../types';
import { adjustForDefenses, DAMAGE_TYPES } from '../../utils/stack';
import { defaultHitTarget, isStanding, squadMembers } from '../../utils/squads';

/** Single-target hits on a squad: pick the member (VVTT rule 1 default) and the damage. */
export function SquadHitDialog({ squad, open, onClose }: { squad: Squad; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useCombat();
  const members = squadMembers(squad, state.creatures).filter(isStanding);
  const [memberId, setMemberId] = useState(() => defaultHitTarget(squad, state.creatures)?.id ?? '');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const [type, setType] = useState('');
  const [magical, setMagical] = useState(false);
  const member = members.find((m) => m.id === memberId);
  const value = parseInt(amount, 10);
  const n = Math.max(1, parseInt(count, 10) || 1);
  const valid = member !== undefined && !isNaN(value) && value > 0;

  const handleApply = () => {
    if (!member || !valid) return;
    const each = adjustForDefenses(value, type, member.statblock, magical);
    dispatch({
      type: 'SQUAD_HIT',
      payload: { squadId: squad.id, memberId: member.id, hits: Array(n).fill(each), source: `${value}${type ? ` ${type}` : ''} × ${n}` },
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Hit {squad.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField
            select size="small" label="Member hit" value={member ? memberId : ''} onChange={(e) => setMemberId(e.target.value)}
            helperText="VVTT rule: in 5e the attacker picks the target; the default is the largest stack (the front rank), never the leader."
          >
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {squad.leaderId === m.id ? '★ ' : ''}{m.name}{m.stack ? ` (${m.stack.bodies} bodies)` : ` (${m.currentHp} HP)`}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField size="small" type="number" label="Damage" value={amount} onChange={(e) => setAmount(e.target.value)} sx={{ flex: 1 }} autoFocus />
            <TextField size="small" type="number" label="Hits" value={count} onChange={(e) => setCount(e.target.value)} sx={{ flex: 1 }} />
            <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value)} sx={{ flex: 1 }}>
              <MenuItem value="">(none)</MenuItem>
              {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
          </Stack>
          <FormControlLabel control={<Checkbox size="small" checked={magical} onChange={(e) => setMagical(e.target.checked)} />} label="Magical" />
          {member?.stack && (
            <Typography variant="caption" color="text.secondary">
              VVTT rule: each hit damages the stack's front body only; a body that falls loses its overkill.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={handleApply} disabled={!valid}>Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 5: Rewrite `src/components/squads/SquadAreaDialog.tsx`**

```tsx
import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem,
  FormControlLabel, Switch, Typography, Table, TableBody, TableRow, TableCell, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { useCombat, type SquadAreaMemberResult } from '../../context/CombatContext';
import type { AbilityName, Creature, DmgEdition } from '../../types';
import {
  AOE_SHAPES, aoeTargetCount, aoeAdvice, resolveStackArea, formatAreaSummary, DAMAGE_TYPES, damageNotation,
  type AoeShape, type AreaSave,
} from '../../utils/stack';
import { formatSquadAreaSummary, isStanding, resolveIndividualArea, splitAreaCount, squadStandingCount, standingCount } from '../../utils/squads';
import { rollDie, roll } from '../../utils/diceEngine';

const ABILITIES: AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

interface MemberOutcome { member: Creature; saves: AreaSave[]; fell: number }

/**
 * Area effect on a squad (or a lone stack). The suggested total comes from DMG 2014 p. 249 / DMG 2024 p. 82, is capped
 * at the standing count, and is split across members by VVTT rule 2. Every count is editable. Damage is rolled once;
 * each caught body saves with its own member's bonus, and magical and resistances apply per member.
 */
export function SquadAreaDialog({ members, title, squadId, open, onClose }: {
  members: Creature[]; title: string; squadId?: string; open: boolean; onClose: () => void;
}) {
  const { state, dispatch } = useCombat();
  const edition: DmgEdition = state.dmgEdition ?? '2014';
  const [widthText, setWidthText] = useState('5');
  const width = Math.max(5, parseInt(widthText) || 5);
  const [source, setSource] = useState('Area effect');
  const [shape, setShape] = useState<AoeShape>('sphere');
  const [size, setSize] = useState(20);
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [memberOverrides, setMemberOverrides] = useState<Record<string, number>>({});
  const [ability, setAbility] = useState<AbilityName>('dex');
  const [dc, setDc] = useState(15);
  const [damageText, setDamageText] = useState('8d6');
  const [damageType, setDamageType] = useState('');
  const [halfOnSave, setHalfOnSave] = useState(true);
  const [magical, setMagical] = useState(false);
  const [outcome, setOutcome] = useState<{ summary: string; rows: MemberOutcome[] } | null>(null);

  const squad = squadId ? state.squads.find((s) => s.id === squadId) : undefined;
  const totalStanding = members.reduce((sum, m) => sum + standingCount(m), 0);
  const suggested = Math.min(aoeTargetCount(shape, size, edition, width), totalStanding);
  const advice = aoeAdvice(edition);
  const total = Math.min(totalOverride ?? suggested, totalStanding);
  const split = new Map(splitAreaCount(total, members).map((a) => [a.memberId, a.caught]));
  const caughtOf = (m: Creature) => Math.min(memberOverrides[m.id] ?? split.get(m.id) ?? 0, standingCount(m));
  const caughtSum = members.reduce((sum, m) => sum + caughtOf(m), 0);
  const damagePreview = damageNotation(damageText);
  const sizeLabel = AOE_SHAPES.find((s) => s.value === shape)?.sizeLabel ?? 'Size (ft)';
  const resetCounts = () => { setTotalOverride(null); setMemberOverrides({}); };

  const handleApply = () => {
    const notation = damageNotation(damageText);
    if (notation === null) return;
    let damage: number;
    try {
      damage = /^\d+$/.test(notation) ? Number(notation) : roll(notation).total;
    } catch {
      return;
    }
    const results: SquadAreaMemberResult[] = [];
    const rows: MemberOutcome[] = [];
    let stackSummary = '';
    for (const m of members) {
      const caught = caughtOf(m);
      if (caught === 0) continue;
      if (m.stack) {
        const area = resolveStackArea({ creature: m, caught, dc, ability, damage, halfOnSave, damageType, magical, roll: rollDie });
        results.push({ memberId: m.id, currentHp: area.currentHp, bodies: area.bodies });
        rows.push({ member: m, saves: area.saves, fell: area.fell });
        stackSummary = formatAreaSummary(source || 'Area effect', area, m.stack.size);
      } else {
        const r = resolveIndividualArea({ creature: m, dc, ability, damage, halfOnSave, damageType, magical, roll: rollDie });
        results.push({ memberId: m.id, currentHp: r.currentHp, tempHp: r.tempHp });
        rows.push({ member: m, saves: [r.save], fell: r.save.fell ? 1 : 0 });
      }
    }
    const caught = rows.reduce((sum, r) => sum + r.saves.length, 0);
    const failed = rows.reduce((sum, r) => sum + r.saves.filter((s) => !s.success).length, 0);
    const fell = rows.reduce((sum, r) => sum + r.fell, 0);
    const summary = squad
      ? formatSquadAreaSummary(source || 'Area effect', squad.name, { caught, failed, fell }, squadStandingCount(squad, state.creatures) - fell, squad.startingCount)
      : stackSummary || `${source || 'Area effect'}: ${caught} caught, ${failed} failed`;
    const saveText = (s: AreaSave) => `${s.d20} (${s.total}) ${s.success ? 'save' : 'fail'} −${s.taken}${s.fell ? ' falls' : ''}`;
    const details = `${damage}${damageType ? ` ${damageType}` : ''} damage, DC ${dc} ${ability.toUpperCase()} save: ` +
      (squad
        ? rows.map((r) => `${r.member.name}: ${r.saves.map(saveText).join(', ')}`).join('; ')
        : rows.flatMap((r) => r.saves.map(saveText)).join('; '));
    dispatch({ type: 'SQUAD_AREA', payload: { squadId, members: results, summary, details } });
    setOutcome({ summary, rows });
  };

  const handleClose = () => {
    setOutcome(null);
    resetCounts();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {outcome ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={600}>{outcome.summary}</Typography>
            <Table size="small">
              <TableBody>
                {outcome.rows.flatMap((r) => r.saves.map((s, i) => (
                  <TableRow key={`${r.member.id}-${i}`}>
                    <TableCell>{r.member.stack ? `${r.member.name} body ${i + 1}` : r.member.name}</TableCell>
                    <TableCell>{s.d20} ({s.total}) {s.success ? 'save' : 'fail'}</TableCell>
                    <TableCell>−{s.taken}</TableCell>
                    <TableCell>{s.fell ? 'falls' : 'stands'}</TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">DMG rules</Typography>
              <ToggleButtonGroup
                size="small" exclusive value={edition}
                onChange={(_, value: DmgEdition | null) => {
                  if (!value) return;
                  dispatch({ type: 'SET_DMG_EDITION', payload: { edition: value } });
                  resetCounts();
                }}
              >
                <ToggleButton value="2014" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2014</ToggleButton>
                <ToggleButton value="2024" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2024</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <TextField size="small" label="Effect" value={source} onChange={(e) => setSource(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Shape" value={shape} onChange={(e) => { setShape(e.target.value as AoeShape); resetCounts(); }} sx={{ flex: 2 }}>
                {AOE_SHAPES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label={sizeLabel} value={size} onChange={(e) => { setSize(Math.max(0, parseInt(e.target.value) || 0)); resetCounts(); }} sx={{ flex: 1 }} />
            </Stack>
            {shape === 'line' && edition === '2024' && (
              <TextField size="small" type="number" label="Width (ft)" value={widthText} inputProps={{ min: 5, step: 5 }}
                onChange={(e) => { setWidthText(e.target.value); resetCounts(); }} />
            )}
            <TextField
              size="small" type="number" label={members.length > 1 ? 'Caught in total' : 'Bodies caught'} value={total}
              onChange={(e) => { setTotalOverride(Math.max(0, parseInt(e.target.value) || 0)); setMemberOverrides({}); }}
              helperText={`${advice.citation} suggests ${suggested} — ${advice.advice} (${totalStanding} standing)${edition === '2024' ? '. VVTT rule: sizes between rows use the row below' : ''}`}
            />
            {members.length > 1 && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  VVTT rule: the total is split by standing bodies (an individual counts 1, largest remainder). Edit any member's count.
                </Typography>
                {members.filter(isStanding).map((m) => (
                  <TextField
                    key={m.id} size="small" type="number" label={`${m.name} (of ${standingCount(m)})`} value={caughtOf(m)}
                    onChange={(e) => setMemberOverrides((o) => ({ ...o, [m.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
                  />
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Save" value={ability} onChange={(e) => setAbility(e.target.value as AbilityName)} sx={{ flex: 1 }}>
                {ABILITIES.map((a) => <MenuItem key={a} value={a}>{a.toUpperCase()}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="DC" value={dc} onChange={(e) => setDc(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small" label="Damage" value={damageText} onChange={(e) => setDamageText(e.target.value)} sx={{ flex: 1 }}
                error={damagePreview === null} helperText="A number, or dice rolled once (e.g. 8d6)"
              />
              <TextField select size="small" label="Type" value={damageType} onChange={(e) => setDamageType(e.target.value)} sx={{ flex: 1 }}>
                <MenuItem value="">(none)</MenuItem>
                {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Stack>
            <FormControlLabel control={<Switch checked={halfOnSave} onChange={(e) => setHalfOnSave(e.target.checked)} />} label="Half damage on a successful save" />
            <FormControlLabel control={<Switch checked={magical} onChange={(e) => setMagical(e.target.checked)} />} label="Magical damage" />
            <Typography variant="caption" color="text.secondary">
              Each caught body saves with its own member's bonus. VVTT rule: in a stack, the wounded front body is caught first; of the bodies left wounded, the most hurt becomes the new front body.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {outcome ? (
          <Button onClick={handleClose} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleApply} variant="contained" disabled={damagePreview === null || caughtSum === 0}>Roll saves &amp; apply</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

- [ ] **Step 6: Mount the dialogs**

In `src/components/squads/SquadRowControls.tsx`, the standalone stack row, change the dialog line to:

```tsx
      {areaOpen && <SquadAreaDialog members={[creature]} title={`Area effect on ${creature.name}`} open={areaOpen} onClose={() => setAreaOpen(false)} />}
```

In `src/components/squads/SquadCard.tsx`:
- Import `SquadHitDialog` and `SquadAreaDialog` from `./SquadHitDialog` and `./SquadAreaDialog`.
- Add the state `const [hitOpen, setHitOpen] = useState(false);` and `const [areaOpen, setAreaOpen] = useState(false);`.
- In the footer, after the Staff button, add:

```tsx
          <Button size="small" variant="outlined" color="error" disabled={standing === 0} onClick={() => setHitOpen(true)}>Hit…</Button>
          <Button size="small" variant="outlined" disabled={standing === 0} onClick={() => setAreaOpen(true)}>Area…</Button>
```

- Before `</Card>`, add:

```tsx
      {hitOpen && <SquadHitDialog squad={squad} open onClose={() => setHitOpen(false)} />}
      {areaOpen && <SquadAreaDialog squadId={squad.id} title={`Area effect on ${squad.name}`} members={members} open onClose={() => setAreaOpen(false)} />}
```

- [ ] **Step 7: Verify**

Run: `npx vitest run && npx tsc -p tsconfig.app.json && npx eslint src/utils/squads.ts src/utils/squads.test.ts src/components/squads/SquadHitDialog.tsx src/components/squads/SquadAreaDialog.tsx src/components/squads/SquadRowControls.tsx src/components/squads/SquadCard.tsx`

Expected: clean.

If the dev server runs, open Area… on a tower squad: a 20 ft sphere suggests 4 (2014), split 1/2/1/0. Switching to 2024 suggests 10, split by standing bodies.

- [ ] **Step 8: Commit**

```bash
git add src/utils/squads.ts src/utils/squads.test.ts src/components/squads/SquadHitDialog.tsx src/components/squads/SquadAreaDialog.tsx src/components/squads/SquadRowControls.tsx src/components/squads/SquadCard.tsx
git commit -m "$(cat <<'EOF'
Hit and Area on squads: default member, per-member area split, individual saves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 10: Squad tokens on the DM map and the player view

**Files:**
- Create: `src/components/squads/SquadToken.tsx`
- Modify: `src/components/battlefield/BattlefieldMap.tsx`, `src/components/battlefield/PlayerViewMap.tsx`, `src/hooks/useBroadcastChannel.ts`

**Interfaces:**
- Consumes:
  - `squadStandingCount` (Task 2);
  - `UPDATE_SQUAD`, `currentTurnSquad` (Task 4);
  - `SquadHitDialog`, `SquadAreaDialog` (Task 9);
  - the existing `SquadTokenOverlay` (the badge and ring) and `MoraleTokenMarker`.
- Produces:
  - `<SquadTokenFace squad creatures pixelsPerFoot isCurrentTurn? showLabel? />`. It is centred on its own box; wrap it in an element positioned at the token centre with `translate(-50%, -50%)`.
  - `BattlefieldSyncState.squads?: Squad[]`

Behaviour:
- A placed squad shows one token. Its members never get their own tokens.
- The token shows:
  - the squad name;
  - the standing count against `startingCount` (e.g. "13/14");
  - the ★ while its leader stands;
  - the morale marker.
- The player view shows the same token and never a member breakdown.
- On the DM map the token drags freely. Squads have no movement budget. In combat only the squad whose turn it is can be dragged, unless Reposition is on.
- Right-click opens Hit… and Area….

- [ ] **Step 1: `src/components/squads/SquadToken.tsx`**

```tsx
import type { Creature, Squad } from '../../types';
import { squadStandingCount } from '../../utils/squads';
import { factionColors } from '../../theme/customColors';
import { SquadTokenOverlay } from './SquadTokenOverlay';
import { MoraleTokenMarker } from '../morale/MoraleTokenMarker';

/**
 * A squad's map token: name initial, ★ while its leader stands, standing/starting badge and ring, morale marker.
 * Drawn 10 ft across so it reads as a group. Shared by the DM map and the player view; never shows members.
 */
export function SquadTokenFace({ squad, creatures, pixelsPerFoot, isCurrentTurn = false, showLabel = true }: {
  squad: Squad; creatures: Creature[]; pixelsPerFoot: number; isCurrentTurn?: boolean; showLabel?: boolean;
}) {
  const tokenSize = Math.max(24, 10 * pixelsPerFoot);
  const standing = squadStandingCount(squad, creatures);
  const leader = squad.leaderId ? creatures.find((c) => c.id === squad.leaderId) : undefined;
  const leaderUp = leader !== undefined && leader.currentHp > 0;
  const out = standing === 0;
  const color = squad.faction === 'party' ? factionColors.party : factionColors.npc;
  return (
    <div style={{ position: 'relative', width: tokenSize, height: tokenSize }}>
      <div
        style={{
          width: tokenSize, height: tokenSize, borderRadius: '50%', boxSizing: 'border-box', position: 'relative',
          background: out ? '#333' : 'var(--color-bg-secondary, #1f1f1f)',
          border: `${isCurrentTurn ? 4 : 3}px solid ${out ? '#666' : isCurrentTurn ? '#ff4500' : color}`,
          boxShadow: isCurrentTurn ? '0 0 12px rgba(255, 69, 0, 0.6)' : 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.max(10, tokenSize * 0.4), fontWeight: 'bold', color: out ? '#666' : '#f3f4f6',
          filter: out ? 'grayscale(1) brightness(0.6)' : 'none',
        }}
      >
        {squad.name.charAt(0).toUpperCase()}
        {leaderUp && (
          <span style={{ position: 'absolute', top: -tokenSize * 0.22, right: -tokenSize * 0.12, fontSize: Math.max(10, tokenSize * 0.3), color: '#f59e0b', textShadow: '0 0 3px #000', pointerEvents: 'none' }}>
            ★
          </span>
        )}
        <SquadTokenOverlay squad={{ size: squad.startingCount, bodies: standing }} tokenSize={tokenSize} />
        {squad.morale?.status && <MoraleTokenMarker status={squad.morale.status} tokenSize={tokenSize} />}
      </div>
      {showLabel && (
        <div
          style={{
            position: 'absolute', top: tokenSize + 4, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            fontSize: 9, fontWeight: 'bold', color: '#f3f4f6', background: 'rgba(0,0,0,0.75)', padding: '1px 4px', borderRadius: 2,
            pointerEvents: 'none',
          }}
        >
          {squad.name}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Sync squads to the player view**

In `src/hooks/useBroadcastChannel.ts`:
- Add `Squad` to the types import.
- Add to `BattlefieldSyncState`: `squads?: Squad[]; // Battle mode squads (v2.13.0); optional for older DM windows`.

In `BattlefieldMap.tsx`'s broadcast effect:
- Add `squads: state.squads,` to the payload, after `creatures`.
- Add `state.squads` to the dependency list.

- [ ] **Step 3: DM map: hide member tokens, render draggable squad tokens**

In `src/components/battlefield/BattlefieldMap.tsx`:

1. Add imports:

```tsx
import { Menu, MenuItem } from '@mui/material';
import type { Squad } from '../../types';
import { squadMembers } from '../../utils/squads';
import { SquadTokenFace } from '../squads/SquadToken';
import { SquadHitDialog } from '../squads/SquadHitDialog';
import { SquadAreaDialog } from '../squads/SquadAreaDialog';
```

   If the file already imports `Squad`'s neighbours from `'../../types'`, add `Squad` to that import instead.

2. Add `currentTurnSquad` to the `useCombat()` destructuring on the first line of the component.

3. In the creature-token filter, change `return !isAssigned && c.position;` to:

```tsx
              const inSquad = state.squads.some((s) => s.memberIds.includes(c.id));
              return !isAssigned && !inSquad && c.position;
```

4. Right after the creature-token `.map(…)` block closes, add:

```tsx
          {/* Squad tokens (members have no tokens of their own) */}
          {state.squads.filter((s) => s.position).map((squad) => {
            const isThisSquadTurn = currentTurnSquad?.id === squad.id;
            return (
              <DraggableSquadToken
                key={squad.id}
                squad={squad}
                creatures={state.creatures}
                screenPosition={worldToScreen(squad.position!)}
                pixelsPerFoot={pixelsPerFoot}
                isCurrentTurn={isThisSquadTurn}
                disabled={state.phase === 'combat' && !isThisSquadTurn && !repositionMode}
                showLabel={showHpBars}
              />
            );
          })}
```

5. In `handleDragEnd`, before the `// Check if this is a creature drag` block, add:

```tsx
    // Squad drag: free movement (squads aren't movement-tracked)
    if (activeIdStr.startsWith('squad-')) {
      const squad = state.squads.find((s) => `squad-${s.id}` === activeIdStr);
      if (!squad?.position) return;
      const worldDelta = screenDeltaToWorld(delta);
      const position = constrainToImageBounds({ x: squad.position.x + worldDelta.x, y: squad.position.y + worldDelta.y });
      dispatch({ type: 'UPDATE_SQUAD', payload: { id: squad.id, updates: { position } } });
      return;
    }
```

6. Add this component next to `CreatureToken`, at the end of the file:

```tsx
// ==========================================
// Squad Token (one per placed squad)
// ==========================================

function DraggableSquadToken({ squad, creatures, screenPosition, pixelsPerFoot, isCurrentTurn, disabled, showLabel }: {
  squad: Squad; creatures: Creature[]; screenPosition: Position; pixelsPerFoot: number;
  isCurrentTurn: boolean; disabled: boolean; showLabel: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `squad-${squad.id}`, disabled });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hitOpen, setHitOpen] = useState(false);
  const [areaOpen, setAreaOpen] = useState(false);
  const drag = CSS.Translate.toString(transform);
  return (
    <>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="creature-token"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setMenu({ x: e.clientX, y: e.clientY }); }}
        title={`${squad.name}\nRight-click: Hit… / Area…`}
        style={{
          position: 'absolute', left: screenPosition.x, top: screenPosition.y,
          transform: [drag, 'translate(-50%, -50%)'].filter(Boolean).join(' '),
          opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1000 : isCurrentTurn ? 500 : 6,
          cursor: disabled ? 'not-allowed' : 'grab',
        }}
      >
        <SquadTokenFace squad={squad} creatures={creatures} pixelsPerFoot={pixelsPerFoot} isCurrentTurn={isCurrentTurn} showLabel={showLabel} />
      </div>
      <Menu
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        <MenuItem onClick={() => { setMenu(null); setHitOpen(true); }}>Hit…</MenuItem>
        <MenuItem onClick={() => { setMenu(null); setAreaOpen(true); }}>Area…</MenuItem>
      </Menu>
      {hitOpen && <SquadHitDialog squad={squad} open onClose={() => setHitOpen(false)} />}
      {areaOpen && (
        <SquadAreaDialog
          squadId={squad.id} title={`Area effect on ${squad.name}`} members={squadMembers(squad, creatures)}
          open onClose={() => setAreaOpen(false)}
        />
      )}
    </>
  );
}
```

   `useDraggable`, `CSS`, `useState`, `Creature` and `Position` are already imported by this file. If `tsc` reports any as missing, add it to the existing import.

- [ ] **Step 4: Player view**

In `src/components/battlefield/PlayerViewMap.tsx`:

1. Add `import { SquadTokenFace } from '../squads/SquadToken';`.

2. In the creature-token filter, change `return !isAssigned && c.position;` to:

```tsx
            const inSquad = (state.squads ?? []).some((s) => s.memberIds.includes(c.id));
            return !isAssigned && !inSquad && c.position;
```

3. Right after the creature-token `.map(…)` closes, inside the same container, add:

```tsx
        {/* Squad tokens: same face as the DM map, never a member breakdown */}
        {(state.squads ?? []).filter((s) => s.position).map((squad) => {
          const screenPos = worldToScreen(squad.position!);
          return (
            <div
              key={squad.id}
              className="player-view-token"
              style={{ position: 'absolute', left: screenPos.x, top: screenPos.y, transform: 'translate(-50%, -50%)' }}
            >
              <SquadTokenFace squad={squad} creatures={state.creatures} pixelsPerFoot={pixelsPerFoot} showLabel={state.showHpBars !== false} />
            </div>
          );
        })}
```

   `pixelsPerFoot` and `worldToScreen` are already in scope there, since the creature tokens use them.

- [ ] **Step 5: Verify**

Run: `npx tsc -p tsconfig.app.json && npx vitest run && npx eslint src/components/squads/SquadToken.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx src/hooks/useBroadcastChannel.ts`

Expected: clean.

If the dev server runs:
- Place a squad from its card. One token appears with "n/n", and member tokens disappear.
- Open the player view: the same token shows, with no member list.
- Drag in setup.
- Right-click → Hit… opens the dialog.

- [ ] **Step 6: Commit**

```bash
git add src/components/squads/SquadToken.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx src/hooks/useBroadcastChannel.ts
git commit -m "$(cat <<'EOF'
Squad tokens on the DM map and player view; members have no tokens of their own

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: The squad's turn (`SquadTurnPanel`)

**Files:**
- Modify: `src/utils/squads.ts`, `src/utils/squads.test.ts`
- Create: `src/components/squads/SquadTurnPanel.tsx`
- Delete: `src/components/squads/SquadAttackPanel.tsx`
- Modify: `src/components/layout/RightPanel.tsx`

**Interfaces:**
- Consumes:
  - `parseActionDamage`, `parseMultiattackCount`, `rollGroupAttack`, `adjustForDefenses`, `formatGroupAttack`, `formatAttackRolls` (`./stack`);
  - `defaultHitTarget`, `isStanding`, `squadMembers`, `squadStandingCount` (Task 2);
  - `SQUAD_HIT` (Task 4);
  - `currentTurnSquad` (Task 4).
- Produces:
  - `interface AttackOption { key: string; label: string; action: StatblockAction; attacksEach: number }`
  - `attackOptions(statblock: Statblock): AttackOption[]`. It puts Multiattack first when present (n × the first attack, VVTT rule), then each action that has a to-hit bonus.
  - `<SquadTurnPanel attackerName members excludeIds />`. It is used for squads, with all members, and for a standalone stack's turn, with `[creature]`.

- [ ] **Step 1: Append the failing test** to `src/utils/squads.test.ts`

Add `attackOptions` to the import from `./squads` and `Statblock` to the type import. Then append:

```ts
describe('attackOptions', () => {
  const captainSb = (actions: Statblock['actions']) => ({ name: 'Captain', actions }) as unknown as Statblock;
  const greatsword = { name: 'Greatsword', description: 'Melee Weapon Attack: +6 to hit. Hit: 13 (2d6 + 4) slashing damage.', attackBonus: 6 };
  const javelin = { name: 'Javelin', description: 'Ranged Weapon Attack: +6 to hit. Hit: 7 (1d6 + 4) piercing damage.', attackBonus: 6 };
  it('defaults to Multiattack (n × the first attack, VVTT rule), then each attack', () => {
    const opts = attackOptions(captainSb([{ name: 'Multiattack', description: 'The captain makes two greatsword attacks.' }, greatsword, javelin]));
    expect(opts.map((o) => [o.key, o.label, o.attacksEach, o.action.name])).toEqual([
      ['multiattack', 'Multiattack (2 × Greatsword)', 2, 'Greatsword'],
      ['Greatsword', 'Greatsword (+6)', 1, 'Greatsword'],
      ['Javelin', 'Javelin (+6)', 1, 'Javelin'],
    ]);
  });
  it('without Multiattack, the first attack comes first; without attacks, nothing', () => {
    expect(attackOptions(captainSb([greatsword, javelin]))[0].key).toBe('Greatsword');
    expect(attackOptions(captainSb([{ name: 'Multiattack', description: 'Makes two attacks.' }]))).toEqual([]);
    expect(attackOptions(captainSb(undefined))).toEqual([]);
  });
});
```

Run: `npx vitest run src/utils/squads.test.ts`

Expected: FAIL (`attackOptions` is not exported).

- [ ] **Step 2: Implement `attackOptions`**

In `src/utils/squads.ts`:
- Extend the type import to `import type { AbilityName, CrewAssignment, Creature, Squad, Statblock, StatblockAction } from '../types';`.
- Add `parseMultiattackCount` to the `./stack` import.
- Append:

```ts
export interface AttackOption { key: string; label: string; action: StatblockAction; attacksEach: number }

/**
 * A member's attack choices for its squad's turn. Multiattack comes first when the statblock has one; VVTT rule: it
 * rolls its count (from "makes two … attacks") of the first attack with a to-hit bonus. Then each such attack once.
 */
export function attackOptions(statblock: Statblock): AttackOption[] {
  const attacks = (statblock.actions ?? []).filter((a) => typeof a.attackBonus === 'number');
  if (attacks.length === 0) return [];
  const single = attacks.map((a) => ({ key: a.name, label: `${a.name} (+${a.attackBonus})`, action: a, attacksEach: 1 }));
  const multi = statblock.actions?.find((a) => /multiattack/i.test(a.name));
  if (!multi) return single;
  const n = parseMultiattackCount(statblock);
  return [{ key: 'multiattack', label: `Multiattack (${n} × ${attacks[0].name})`, action: attacks[0], attacksEach: n }, ...single];
}
```

Run: `npx vitest run src/utils/squads.test.ts`

Expected: PASS.

- [ ] **Step 3: Create `src/components/squads/SquadTurnPanel.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, Collapse, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';
import {
  adjustForDefenses, formatAttackRolls, formatGroupAttack, parseActionDamage, rollGroupAttack,
  type DamagePart, type GroupAttackResult,
} from '../../utils/stack';
import { attackOptions, defaultHitTarget, isStanding, squadStandingCount } from '../../utils/squads';
import { rollDie } from '../../utils/diceEngine';

type TargetKey = `c:${string}` | `s:${string}` | `v:${string}`;
interface Line { ticked: boolean; optionKey: string; targetKey: TargetKey | ''; ac: number; attackers: number; manualDamage: number }
interface Rolled { memberId: string; memberName: string; targetKey: TargetKey; targetLabel: string; ac: number; actionName: string; result: GroupAttackResult }

const initialLine = (m: Creature): Line => {
  const opts = attackOptions(m.statblock);
  return { ticked: opts.length > 0, optionKey: opts[0]?.key ?? '', targetKey: '', ac: 10, attackers: m.stack?.bodies ?? 1, manualDamage: 0 };
};

/**
 * A squad's turn (or a lone stack's): one line per standing member. Roll all rolls every attack of every ticked
 * member (natural 20 crits, natural 1 misses; each against the AC it was rolled against); Apply hits sends each
 * target its hits through its own damage path. Squad targets take hits on their front rank (VVTT rule 1).
 */
export function SquadTurnPanel({ attackerName, members, excludeIds }: { attackerName: string; members: Creature[]; excludeIds: string[] }) {
  const { state, dispatch } = useCombat();
  const standing = members.filter(isStanding);
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [rolled, setRolled] = useState<Rolled[]>([]);
  const [applied, setApplied] = useState(false);
  const [showRolls, setShowRolls] = useState(false);

  const targets = useMemo(() => {
    const memberIds = new Set(state.squads.flatMap((s) => s.memberIds));
    return [
      ...state.squads
        .filter((s) => !s.memberIds.some((id) => excludeIds.includes(id)) && squadStandingCount(s, state.creatures) > 0)
        .map((s) => ({ key: `s:${s.id}` as TargetKey, label: `⚑ ${s.name}`, ac: defaultHitTarget(s, state.creatures)?.statblock.ac ?? 10 })),
      ...state.creatures
        .filter((c) => !excludeIds.includes(c.id) && !memberIds.has(c.id) && (c.currentHp > 0 || c.statblock.type === 'pc'))
        .map((c) => ({ key: `c:${c.id}` as TargetKey, label: c.name, ac: c.statblock.ac })),
      ...state.vehicles
        .filter((v) => v.currentHp > 0 && !v.isInoperative)
        .map((v) => ({ key: `v:${v.id}` as TargetKey, label: v.name, ac: v.template.ac })),
    ];
  }, [state.squads, state.creatures, state.vehicles, excludeIds]);

  const lineFor = (m: Creature): Line => lines[m.id] ?? initialLine(m);
  const patch = (m: Creature, change: Partial<Line>) => {
    setLines((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? initialLine(m)), ...change } }));
    setRolled([]);
    setApplied(false);
  };
  const ready = standing.some((m) => {
    const l = lineFor(m);
    return l.ticked && l.optionKey && l.targetKey;
  });

  const handleRollAll = () => {
    const out: Rolled[] = [];
    for (const m of standing) {
      const line = lineFor(m);
      const option = attackOptions(m.statblock).find((o) => o.key === line.optionKey);
      const target = targets.find((t) => t.key === line.targetKey);
      if (!line.ticked || !option || !target) continue;
      const parsed = parseActionDamage(option.action);
      const damage: DamagePart[] = parsed.length > 0 ? parsed : [{ count: 0, sides: 0, bonus: line.manualDamage, type: '' }];
      const bodies = m.stack ? Math.min(m.stack.bodies, Math.max(0, line.attackers)) : 1;
      const result = rollGroupAttack({ attackBonus: option.action.attackBonus ?? 0, ac: line.ac, damage, attacks: bodies * option.attacksEach, roll: rollDie });
      dispatch({
        type: 'LOG_ACTION',
        payload: {
          type: 'attack',
          action: `${formatGroupAttack({ attackerName: m.name, actionName: option.action.name, ac: line.ac, result })} (${target.label})`,
          details: formatAttackRolls(result),
        },
      });
      out.push({ memberId: m.id, memberName: m.name, targetKey: target.key, targetLabel: target.label, ac: line.ac, actionName: option.action.name, result });
    }
    setRolled(out);
    setApplied(false);
    setShowRolls(false);
  };

  const handleApply = () => {
    for (const r of rolled) {
      const source = `${r.memberName} (${r.actionName})`;
      const id = r.targetKey.slice(2);
      const hitRolls = r.result.rolls.filter((x) => x.hit);
      if (r.targetKey.startsWith('v:')) {
        hitRolls.forEach((x) => {
          const amount = x.damage.reduce((sum, d) => sum + d.amount, 0);
          if (amount > 0) dispatch({ type: 'DEAL_DAMAGE_TO_VEHICLE', payload: { vehicleId: id, amount, source } });
        });
        continue;
      }
      const squad = r.targetKey.startsWith('s:') ? state.squads.find((s) => s.id === id) : undefined;
      const victim = squad ? defaultHitTarget(squad, state.creatures) : state.creatures.find((c) => c.id === id);
      if (!victim) continue;
      const perHit = hitRolls.map((x) => x.damage.reduce((sum, d) => sum + adjustForDefenses(d.amount, d.type, victim.statblock), 0));
      if (squad || victim.stack) {
        dispatch({ type: 'SQUAD_HIT', payload: { squadId: squad?.id, memberId: victim.id, hits: perHit, source } });
      } else {
        perHit.filter((a) => a > 0).forEach((amount) => dispatch({ type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: victim.id, amount, source } }));
      }
    }
    setApplied(true);
  };

  const num = (v: string) => Math.max(0, parseInt(v) || 0);
  const totalHits = rolled.reduce((sum, r) => sum + r.result.hits, 0);

  if (standing.length === 0) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>{attackerName}: attacks</Typography>
      <Stack spacing={1.5}>
        {standing.map((m) => {
          const line = lineFor(m);
          const opts = attackOptions(m.statblock);
          const option = opts.find((o) => o.key === line.optionKey);
          const needsDamage = option !== undefined && parseActionDamage(option.action).length === 0;
          return (
            <Box key={m.id}>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Checkbox size="small" checked={line.ticked} disabled={opts.length === 0} onChange={(e) => patch(m, { ticked: e.target.checked })} sx={{ p: 0.25 }} />
                <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                {m.stack && <Typography variant="caption" color="text.secondary">({m.stack.bodies} standing)</Typography>}
              </Stack>
              {opts.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No actions with a to-hit bonus.</Typography>
              ) : (
                <Stack spacing={1} sx={{ pl: 3.5, mt: 0.5 }}>
                  <TextField select size="small" label="Attack" value={line.optionKey} onChange={(e) => patch(m, { optionKey: e.target.value })}>
                    {opts.map((o) => <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>)}
                  </TextField>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      select size="small" label="Target" value={line.targetKey} sx={{ flex: 2 }}
                      onChange={(e) => {
                        const key = e.target.value as TargetKey;
                        patch(m, { targetKey: key, ac: targets.find((t) => t.key === key)?.ac ?? line.ac });
                      }}
                    >
                      {targets.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
                    </TextField>
                    <TextField size="small" type="number" label="AC" value={line.ac} onChange={(e) => patch(m, { ac: num(e.target.value) })} sx={{ flex: 1 }} />
                  </Stack>
                  {m.stack && (
                    <TextField
                      size="small" type="number" label={`Bodies attacking (of ${m.stack.bodies})`} value={line.attackers}
                      onChange={(e) => patch(m, { attackers: Math.min(m.stack?.bodies ?? 0, num(e.target.value)) })}
                    />
                  )}
                  {needsDamage && (
                    <TextField
                      size="small" type="number" label="Damage per hit" value={line.manualDamage}
                      onChange={(e) => patch(m, { manualDamage: num(e.target.value) })} helperText="Couldn't read this action's damage; enter it"
                    />
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
        <Button variant="contained" size="small" onClick={handleRollAll} disabled={!ready}>Roll all</Button>
        {rolled.length > 0 && (
          <Box>
            {rolled.map((r) => (
              <Typography key={r.memberId} variant="body2" fontWeight={600}>
                {formatGroupAttack({ attackerName: r.memberName, actionName: r.actionName, ac: r.ac, result: r.result })} ({r.targetLabel})
              </Typography>
            ))}
            <Button size="small" onClick={() => setShowRolls((s) => !s)} sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }}>
              {showRolls ? 'Hide rolls' : 'Show rolls'}
            </Button>
            <Collapse in={showRolls}>
              {rolled.map((r) => (
                <Typography key={r.memberId} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {r.memberName}: {formatAttackRolls(r.result)}
                </Typography>
              ))}
            </Collapse>
            <Button size="small" variant="outlined" color="error" onClick={handleApply} disabled={applied || totalHits === 0} sx={{ mt: 0.5 }}>
              {applied ? 'Applied' : 'Apply hits'}
            </Button>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          Every attack of every body is rolled (not the DMG 2014 p. 250 mob shortcut). VVTT rules: a stack attacks with every standing body unless you lower it; Multiattack rolls its count of the first attack; a squad target takes hits on its largest stack.
        </Typography>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 4: Mount it in `src/components/layout/RightPanel.tsx`**

1. Replace the import `import { SquadAttackPanel } from '../squads/SquadAttackPanel';` with:

```tsx
import { SquadTurnPanel } from '../squads/SquadTurnPanel';
import { squadMembers, squadStandingCount } from '../../utils/squads';
```

2. In `CurrentTurnInfo`, add `currentTurnSquad` to the `useCombat()` destructuring. Immediately before the comment `// Creature turn (independent creature not on a vehicle)`, insert:

```tsx
  // Squad turn (v2.13.0): one panel for every member
  if (currentTurnSquad) {
    const members = squadMembers(currentTurnSquad, state.creatures);
    const commander = currentTurnSquad.commanderId ? state.creatures.find((c) => c.id === currentTurnSquad.commanderId) : undefined;
    const status = currentTurnSquad.morale?.status;
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight={600}>⚑ {currentTurnSquad.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {squadStandingCount(currentTurnSquad, state.creatures)}/{currentTurnSquad.startingCount} standing
        </Typography>
        {commander && (
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>{commander.name} directs this squad</Typography>
        )}
        {status ? (
          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
            {status === 'fleeing' ? 'Fleeing: moves away by the quickest route (DMG 2014 p. 273)' : 'Surrendered'}
          </Alert>
        ) : (
          <SquadTurnPanel key={currentTurnSquad.id} attackerName={currentTurnSquad.name} members={members} excludeIds={currentTurnSquad.memberIds} />
        )}
      </Box>
    );
  }
```

3. In the creature turn, replace:

```tsx
      {currentTurnCreature.stack && !currentTurnCreature.morale?.status && (
        <SquadAttackPanel key={currentTurnCreature.id} squad={currentTurnCreature} />
      )}
```

with:

```tsx
      {currentTurnCreature.stack && !currentTurnCreature.morale?.status && (
        <SquadTurnPanel key={currentTurnCreature.id} attackerName={currentTurnCreature.name} members={[currentTurnCreature]} excludeIds={[currentTurnCreature.id]} />
      )}
```

4. Delete the old panel with `git rm src/components/squads/SquadAttackPanel.tsx`.

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc -p tsconfig.app.json && npx eslint src/utils/squads.ts src/utils/squads.test.ts src/components/squads/SquadTurnPanel.tsx src/components/layout/RightPanel.tsx`

Expected: clean. Also check that `grep -rn SquadAttackPanel src` finds nothing.

- [ ] **Step 6: Commit**

```bash
git add src/utils/squads.ts src/utils/squads.test.ts src/components/squads/SquadTurnPanel.tsx src/components/layout/RightPanel.tsx
git commit -m "$(cat <<'EOF'
SquadTurnPanel: per-member attacks and targets, Roll all and Apply hits; replaces SquadAttackPanel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(`git rm` already staged the deletion.)

---
### Task 12: Help and changelog (v2.13.0)

**Files:**
- Modify: `src/components/help/HelpGuide.tsx` (the Battle Mode section), `src/data/changelog.ts`

**Interfaces:**
- Consumes: nothing new. This is copy only.

- [ ] **Step 1: Rewrite the Battle Mode section of `HelpGuide.tsx`**

Another agent is restructuring this file. Find the "Battle Mode" accordion section (section 7) by its title, not by line number. If that restructure has not landed yet, find the paragraphs that start with `Battle mode: squads.`, `Morale (DMG 2014 p. 273` and `VVTT rules`, and replace those instead.

Replace that section's body (its `<AccordionDetails>` children) with the paragraphs below. Keep the section's existing `Accordion`/`AccordionSummary` wrapper and title.

```tsx
            <Typography variant="body2" paragraph>
              <strong>The Squads tab</strong> sits next to Map and Vehicles. Click <strong>+ New squad</strong>, name it,
              pick <strong>Enemy</strong> or <strong>Party</strong>, then use <strong>+ Staff</strong> the way you crew a
              vehicle: an <strong>Existing creature</strong> (one not already in a squad or on a vehicle), a
              <strong> Monster search</strong> or <strong>Custom NPC</strong> (quantity 1 adds one creature; 2 or more adds
              one <em>stack</em> such as &quot;Hobgoblin ×8&quot;, up to 50), or <strong>Add bodies</strong> to a stack.
              Squads can mix creature types, for example a captain, Hobgoblin ×8, archers ×4 and Karkajuk.
            </Typography>
            <Typography variant="body2" paragraph>
              Each member&apos;s <strong>⋯</strong> menu has <strong>Make leader</strong> (★), <strong>Remove from
              squad</strong> (it becomes a standalone creature where the squad stands; in combat it acts right after the
              current turn), <strong>Split off 1</strong> (stacks only) and <strong>View statblock</strong>. The
              <strong> ⋮</strong> menu disbands the squad, deletes it with its members, or resets its morale. Members at
              0 HP or 0 bodies stay on the card, greyed out. In the sidebar, members are listed under their squad.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>In combat</strong> a squad takes one initiative slot and one map token. The token shows the squad&apos;s
              name, how many still stand against how many started (e.g. 13/14), the leader&apos;s ★ and its morale. The
              player view shows the same token, never the members. On the squad&apos;s turn the right panel lists every
              standing member with an attack and a target: <strong>Roll all</strong> rolls every attack of every body
              (natural 20 crits, natural 1 misses; not the DMG 2014 p. 250 mob shortcut), then <strong>Apply hits</strong>.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>PC commanders:</strong> <strong>Assign PC</strong> on the card makes a PC the squad&apos;s commander.
              The PC keeps their own turn; the squad acts right after them and follows them if their initiative changes.
              A PC can command one squad and is never a member.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Hurting squads:</strong> <strong>Hit…</strong> and <strong>Area…</strong> are on the squad card and
              on the token&apos;s right-click menu. A hit on a stack damages its front body only and overkill is lost.
              Area… suggests how many are caught from the DMG area-of-effect table (DMG 2014 p. 249 or DMG 2024 p. 82, by
              the encounter&apos;s DMG edition), caps it at the number standing, and splits it across members; every count
              can be edited. Each caught body saves with its own member&apos;s bonus. Healing works per member and never
              revives a fallen body.
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>Morale (DMG 2014 p. 273, optional rule; the 2024 DMG has none):</strong> a morale card appears when
              a squad&apos;s leader goes down (0 HP, dead or incapacitated) or the squad drops to half strength, and when
              a lone monster drops to half its HP. The leader makes the DC 10 Wisdom save. A failed save marks the squad
              <strong> Fleeing</strong> on its card, its turn and its token on both maps. PCs never make morale saves.
            </Typography>
            <Typography variant="body2" component="div" sx={{ mb: 1 }}>
              <strong>VVTT rules</strong> (not in the books, to keep big fights fast):
            </Typography>
            <Typography variant="body2" component="div" sx={{ pl: 2, mb: 1 }}>
              • <strong>VVTT rule 1 — default hit target:</strong> in 5e the attacker picks; Hit… defaults to the largest
              stack (the front rank), never the leader.<br />
              • <strong>VVTT rule 2 — area split:</strong> the area&apos;s total is split by standing bodies (an individual
              counts 1), largest remainder first, never more than a member has standing.<br />
              • <strong>VVTT rule 3 — morale without a leader:</strong> the largest standing stack saves; with no stacks,
              the first standing member.<br />
              • <strong>VVTT rule 4 — half strength:</strong> standing members (each stack body and each individual counts
              1) at or below half of the count when combat started.<br />
              • <strong>VVTT rule 5 — squad initiative:</strong> a commanded squad acts right after its commander; otherwise
              d20 + the leader&apos;s DEX modifier (else the first member&apos;s), rolled with the PC button for party
              squads and the NPC button for enemy squads.<br />
              • Each morale trigger is asked once per battle; fleeing and surrendered squads keep their initiative slot;
              squad tokens move freely (no movement budget); Multiattack rolls its count of the first attack.
            </Typography>
            <Typography variant="body2">
              <strong>Older saves:</strong> squads from v2.11–v2.12 open as a squad holding a stack, with their old leader
              as a member. A leader shared by several squads joins only the first.
            </Typography>
```

If the section's existing copy mentions the "Add as one squad" switch or the creature-level Leader picker, remove it. Both are gone.

- [ ] **Step 2: Add the v2.13.0 changelog entry**

In `src/data/changelog.ts`, insert this as the first element of `changelog`, above `2.12.0`:

```ts
  {
    version: '2.13.0',
    date: '2026-10-20',
    changes: [
      { type: 'feature', description: 'Squads tab: next to Map and Vehicles. Create a squad, name it, pick Enemy or Party, then staff it like a vehicle — an existing creature, an Open5e monster or a custom NPC (quantity 2 or more adds one stack such as "Hobgoblin ×8", up to 50), or more bodies for a stack.' },
      { type: 'feature', description: 'Mixed squads: one squad can hold different creatures (e.g. a captain, Hobgoblin ×8, archers ×4 and Karkajuk). It takes one initiative slot and one map token showing how many still stand (e.g. 13/14) on the DM map and the player view, and its turn resolves in one panel that rolls every member\'s attacks and applies the hits.' },
      { type: 'feature', description: 'PC commanders: make a PC a squad\'s commander. The PC keeps their own turn and the squad acts right after them (VVTT rule).' },
      { type: 'feature', description: 'Morale on squads: the leader (★) and morale now belong to the squad. A morale card comes up when the leader goes down or the squad drops to half its starting strength (VVTT rule); with the leader down, the largest stack saves (VVTT rule).' },
      { type: 'improvement', description: 'Hit… and Area… on the squad card and token: hits default to the largest stack (VVTT rule); area effects split the DMG 2014 p. 249 / DMG 2024 p. 82 count across members by standing bodies (VVTT rule), and every count can be edited.' },
      { type: 'improvement', description: 'Saved squads migrate automatically: each v2.11/v2.12 squad opens as a squad holding a stack, with its leader as a member. A leader shared by several squads joins only the first; the others migrate without a leader.' },
      { type: 'improvement', description: 'The "Add as one squad" switch is replaced by staffing from the Squads tab: adding several monsters from the sidebar now always adds separate numbered creatures.' },
    ],
  },
```

- [ ] **Step 3: Verify**

Run: `npx tsc -p tsconfig.app.json && npx vitest run && npx eslint src/components/help/HelpGuide.tsx src/data/changelog.ts`

Expected: clean. Then check the copy:
- Every rule that isn't in a book in the new copy says "VVTT rule".
- The citations read exactly "DMG 2014 p. 249", "DMG 2024 p. 82", "DMG 2014 p. 273" and "DMG 2014 p. 250".

- [ ] **Step 4: Commit**

```bash
git add src/components/help/HelpGuide.tsx src/data/changelog.ts
git commit -m "$(cat <<'EOF'
Help and changelog for the Squads tab (v2.13.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Browser checklist

Run the tower assault end to end in a browser. Use `npm run dev` with `/app`; if the dev server hangs, use the scratch copy from the iCloud warning. Do not deploy. Load one standalone NPC as a control, and confirm it behaves exactly as it does on `main` throughout.

1. **Build Tower Guard.** In the Squads tab, create "Tower Guard" (Enemy) and staff it:
   - a Hobgoblin Captain (Monster search, quantity 1);
   - Hobgoblin ×8 (quantity 8);
   - Hobgoblin Archer ×4 (Custom NPC, quantity 4);
   - Karkajuk (Custom NPC, quantity 1).

   Make the captain leader (★). The card reads 14/14 standing. The sidebar lists the four members indented under "⚑ Tower Guard". No vehicle crew picker offers them.
2. **Place it and start combat.** Click **Place on map**. One token shows "T", ★ and 14/14, and the members have no tokens. Roll NPC initiative; the log shows "Tower Guard initiative: … (VVTT rule: leader's DEX)". Start combat. The tracker has one ⚑ Tower Guard row and no rows for its members.
3. **Roll its turn against two targets.** On Tower Guard's turn:
   - Set Hobgoblin ×8 → Multiattack → PC A, and the archers → Longbow → PC B.
   - **Roll all** logs one line per member, each against its target's AC.
   - **Apply hits** damages both PCs through their normal damage path.
4. **Fireball it with 2014, then 2024, and compare the counts.**
   - Open Area… from the token's right-click menu, with a 20 ft sphere. 2014 suggests 4, split 1/2/1/0. Switching to 2024 suggests 10, split by standing bodies, each editable.
   - Roll saves & apply. The summary reads "Fireball on Tower Guard: … (n/14 standing)", and the token count drops.
5. **Kill the captain → morale prompt → fleeing on both maps.** Hit… the captain (pick it in the member list) for 39.
   - A morale card "Tower Guard: Hobgoblin Captain is down" appears. With the leader down, the largest stack saves, and the card says "VVTT rule".
   - Click **Fails automatically**. The card chip, the right panel and the token's ↩ marker show Fleeing on the DM map and on the player view.
6. **Party squad with a PC commander.**
   - Create "Militia" (Party), staff Guard ×6, and set its Commander to PC A.
   - Start combat. Militia sits directly after PC A, and its tracker row shows "↳ … directed by PC A".
   - Change PC A's initiative (edit it in the sidebar), then advance the round. Militia moves with PC A.
   - Drag PC A in the tracker order; Militia stays right behind.
7. **Load a v2.11 save with a squad and confirm it migrates.** Load a saved encounter from v2.11 or v2.12 that has a squad: one with a leader, or another with "Add as one squad", or check out `85c0746`, create a squad with a leader, and save.
   - It opens as a squad holding "Hobgoblin ×N (A)" with the leader as ★ member.
   - The initiative slot, morale status and token carry over.
   - Reload the page (autosave restore). Nothing is duplicated.

## Self-review notes

- **Spec coverage:**

  | Spec section | Task |
  |---|---|
  | Data model, rename | 1 |
  | VVTT rules 1–5 | 2 |
  | Rule 1 in the UI | 9, 11 |
  | Rule 2 in the UI | 9 |
  | Rule 3 in the UI | 5 |
  | Rule 4 in the UI | 5, 7 |
  | Rule 5 in the UI | 4, 8 |
  | Migration (plus autosave restore, preset stripping) | 3, 4 |
  | Reducer actions and extended actions | 4 |
  | Morale squad pass, saver, prompt `squadId` | 5 |
  | Squads tab: card, staff menu (cap 50), Assign PC, member and squad menus, Place on map, morale chip, greyed members | 7 |
  | Sidebar grouping, switch removal | 8, 6 |
  | Initiative tracker and roll buttons | 8 |
  | Map tokens, player view | 10 |
  | `SquadTurnPanel` | 11 |
  | Hit/Area on card and token | 9, 10 |
  | Help and changelog | 12 |
  | Browser checklist | above |

- **Decisions beyond the spec's wording**, each also stated in its task:
  - `SQUAD_HIT`/`SQUAD_AREA` take an optional `squadId`, so standalone stacks and attack targets share them.
  - In combat, removing a member subtracts its standing count from `startingCount`.
  - Half-size fires only when membership is unchanged, and leader-down only when the same leader is set before and after.
  - Migrated squads copy the old creature's initiative and drop crew assignments of migrated stacks.
  - A commander who is crew is anchored by their vehicle.
  - The default hit target falls back to the leader only when nobody else stands.
  - Multiattack rolls its count of the first attack.
  - Squad tokens are not movement-tracked.
  - The custom-NPC staff form is a dialog with the sidebar form's fields plus quantity.
