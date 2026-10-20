# Battle Mode: Morale, Commanders and DMG Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Squads and single monsters get DMG 2014 morale checks. The app spots the triggers, and the GM rolls or dismisses each check from a card. Squads can be led by a commander. The squad area dialog follows a per-encounter DMG 2014 or 2024 edition setting.

**Architecture:**
- Pure rules live in `src/utils/morale.ts` (new) and in `src/utils/squad.ts`, which gains the 2024 area table.
- Trigger detection is a pure before/after comparison run after every reducer action. The existing reducer is renamed `baseCombatReducer`, and the exported `combatReducer` wraps it. Prompts queue in `CombatState.moralePrompts`.
- New UI lives in `src/components/morale/`: prompt cards in the right panel, the leader picker and morale controls in the sidebar row, and a token marker.

**Tech Stack:** React 18 + TypeScript + Vite + MUI, React Context + useReducer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-20-battle-mode-morale-design.md`

## Global Constraints

- Creatures without `squad`/`morale` involvement, and all vehicles, must behave exactly as they do today. With `dmgEdition` unset (= 2014), the area dialog behaves exactly as in v2.11.0.
- Morale is the **DMG 2014** optional rule (p. 273): DC 10 Wisdom save, made by the creature or the group's leader. Disadvantage, or an automatic failure, applies if the opposition is overwhelming. A failed save means fleeing. Cite it as "DMG 2014 p. 273". The 2024 DMG has no morale rule.
- Automatic triggers: leader to 0 HP; leader gains incapacitated, paralyzed, petrified, stunned or unconscious; leader removed; squad first at ≤ half its `size` (and > 0 bodies); single non-PC, non-squad creature first at ≤ half max HP (and > 0 HP). There are no prompts for PCs, outside `phase === 'combat'`, for creatures at 0 HP or 0 bodies, or for creatures with a morale status. Each automatic trigger fires at most once per creature per battle (`morale.asked`).
- Who saves for a squad: its leader if the leader is standing (HP > 0, not incapacitated); otherwise the squad's own statblock. The bonus is `saveBonus(statblock, 'wis')`.
- The reducer stays free of randomness: dice are rolled in the UI and the reducer receives results. Prompt ids come from `uuid()`.
- DMG 2024 area table (p. 82), with "use the largest listed size at or below the given size; below the smallest gives 1; size 0 gives 0" (VVTT rule):
  - **Cone:** 10→1, 15→2, 25→3, 30→5, 35→6, 40→8, 45→9, 50→10, 55→12, 60→16.
  - **Cube:** 5→1, 15→2, 20→4, 25→6, 30→8, 35→10, 40→12, 45→16, 50→20.
  - **Circular** (cylinder and sphere, by radius): 5→1, 10→3, 15→6, 20→10, 25→16, 30→20.
  - **Line, width under 10:** 30→2, 60→3, 90→4, 120→5.
  - **Line, width 10 or more:** 30→3, 60→5, 90→8, 120→10.
- Citations: "DMG 2014 p. 249" with the advice "add or remove for how bunched up they are"; "DMG 2024 p. 82" with the advice "−1d3 if spread out, +1d3 if bunched up".
- UI text labels VVTT inventions **VVTT rule**: once-per-battle triggers, the leaderless squad saving with its own statblock, fleeing and surrendered creatures staying in initiative, and the 2024 table interpolation.
- Pure logic goes in `src/utils/*.ts` with sibling `*.test.ts` (vitest).
- Commands:
  - run tests with `npx vitest run <file>` and `npm test`;
  - type-check with `npx tsc --noEmit`;
  - lint changed files with `npx eslint <files>` (if it hasn't finished after about 4 minutes, stop waiting and report it). Never run `npm run lint`.
- Never stage `NAVAL_MECHANICS_SALTMARSH.md`, `COMBAT_LOG_EXPORT_PLAN.md` or `.firebase/hosting.ZGlzdA.cache`. Stage by explicit path.
- Every commit message ends with exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Branch: `feat/battle-mode-morale` (from `main`). Release: v2.12.0, dated 2026-10-20.

## File Structure

| File | Responsibility |
|---|---|
| `src/types/index.ts` (modify) | `DmgEdition`, `MoraleTrigger`, `MoralePrompt`, `Creature.morale`, `squad.leaderId`, `CombatState.moralePrompts` / `dmgEdition` |
| `src/utils/squad.ts` + test (modify) | Edition-aware `aoeTargetCount`, `aoeAdvice` |
| `src/utils/morale.ts` + test (create) | Trigger detection, saver choice, morale roll, log and trigger text |
| `src/context/CombatContext.tsx` + `combatReducer.test.ts` (modify) | Reducer wrapper, morale actions, `SET_DMG_EDITION`, reset/remove/load |
| `src/components/squads/SquadAreaDialog.tsx` (modify) | Edition toggle, line width, edition advice |
| `src/components/morale/MoralePromptStack.tsx`, `MoralePromptCard.tsx` (create) | Prompt cards and recent results |
| `src/components/layout/RightPanel.tsx` (modify) | Mount the stack; fleeing/surrendered banner; hide the squad attack panel |
| `src/components/morale/SquadLeaderSelect.tsx`, `MoraleRowControls.tsx`, `MoraleTokenMarker.tsx` (create) | Leader picker, row Morale button and status chip, token marker |
| `src/components/layout/Sidebar.tsx`, `BattlefieldMap.tsx`, `PlayerViewMap.tsx` (modify) | Mount the above |
| `src/components/help/HelpGuide.tsx`, `src/data/changelog.ts` (modify) | Help text, v2.12.0 |

---

### Task 1: Edition-aware area table

**Files:**
- Modify: `src/types/index.ts`: add `export type DmgEdition = '2014' | '2024';` near `CombatPhase`, and `dmgEdition?: DmgEdition;` at the end of `CombatState` (with a comment `// Battle mode: DMG edition for area suggestions; undefined = '2014'`).
- Modify: `src/utils/squad.ts`: `aoeTargetCount` (currently `export function aoeTargetCount(shape: AoeShape, size: number): number` at ~line 196, after `AOE_DIVISOR`).
- Test: `src/utils/squad.test.ts` (append).

**Interfaces:**
- Produces:
  - `DmgEdition`
  - `aoeTargetCount(shape: AoeShape, size: number, edition: DmgEdition = '2014', width = 5): number`
  - `aoeAdvice(edition: DmgEdition): { citation: string; advice: string }`

- [ ] **Step 1: Write the failing tests** (append; add `aoeAdvice` to the existing import from `./squad`)

```ts
describe('aoeTargetCount by edition', () => {
  it('2014 is the default and unchanged', () => {
    expect(aoeTargetCount('sphere', 20)).toBe(4);
    expect(aoeTargetCount('sphere', 20, '2014')).toBe(4);
    expect(aoeTargetCount('line', 100, '2014', 10)).toBe(4);
  });
  it.each([
    ['sphere', 20, 10], ['cylinder', 10, 3], ['cone', 15, 2], ['cone', 20, 2], ['cube', 15, 2],
    ['cube', 10, 1], ['cone', 60, 16], ['cube', 50, 20], ['cone', 33, 5], ['cone', 70, 16], ['cone', 5, 1], ['sphere', 0, 0],
  ] as const)('2024 %s %i ft → %i', (shape, size, expected) => {
    expect(aoeTargetCount(shape, size, '2024')).toBe(expected);
  });
  it('2024 lines use length and width', () => {
    expect(aoeTargetCount('line', 30, '2024', 5)).toBe(2);
    expect(aoeTargetCount('line', 60, '2024', 10)).toBe(5);
    expect(aoeTargetCount('line', 100, '2024', 5)).toBe(4);
    expect(aoeTargetCount('line', 20, '2024', 5)).toBe(1);
    expect(aoeTargetCount('line', 120, '2024', 15)).toBe(10);
    expect(aoeTargetCount('line', 120, '2024')).toBe(5);
  });
  it('aoeAdvice cites each edition', () => {
    expect(aoeAdvice('2014')).toEqual({ citation: 'DMG 2014 p. 249', advice: 'add or remove for how bunched up they are' });
    expect(aoeAdvice('2024')).toEqual({ citation: 'DMG 2024 p. 82', advice: '−1d3 if spread out, +1d3 if bunched up' });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail:** `npx vitest run src/utils/squad.test.ts`. Expected: the new 2024 cases fail.

- [ ] **Step 3: Implement.** In `src/utils/squad.ts`:
  - change the type import to include `DmgEdition`;
  - replace the `aoeTargetCount` function and its doc comment with the code below. Keep `AOE_DIVISOR` above it.

```ts
/** DMG 2024 p. 82 "Targets in Area of Effect": [smallest size for the row, targets], ascending. */
const AOE_2024: Record<'cone' | 'cube' | 'circular', [number, number][]> = {
  cone: [[10, 1], [15, 2], [25, 3], [30, 5], [35, 6], [40, 8], [45, 9], [50, 10], [55, 12], [60, 16]],
  cube: [[5, 1], [15, 2], [20, 4], [25, 6], [30, 8], [35, 10], [40, 12], [45, 16], [50, 20]],
  circular: [[5, 1], [10, 3], [15, 6], [20, 10], [25, 16], [30, 20]],
};
const AOE_2024_LINE: Record<5 | 10, [number, number][]> = {
  5: [[30, 2], [60, 3], [90, 4], [120, 5]],
  10: [[30, 3], [60, 5], [90, 8], [120, 10]],
};

/** VVTT rule: use the largest listed size at or below `size`; below the smallest row gives 1. */
function lookup2024(rows: [number, number][], size: number): number {
  let targets = 1;
  for (const [min, n] of rows) if (size >= min) targets = n;
  return targets;
}

/**
 * Suggested number of targets caught. 2014: DMG p. 249 formula (round up).
 * 2024: DMG p. 82 lookup table; cylinders and spheres use the circular column, lines use length and width.
 */
export function aoeTargetCount(shape: AoeShape, size: number, edition: DmgEdition = '2014', width = 5): number {
  if (size <= 0) return 0;
  if (edition === '2014') return Math.ceil(size / AOE_DIVISOR[shape]);
  if (shape === 'line') return lookup2024(AOE_2024_LINE[width >= 10 ? 10 : 5], size);
  return lookup2024(AOE_2024[shape === 'cylinder' || shape === 'sphere' ? 'circular' : shape], size);
}

export function aoeAdvice(edition: DmgEdition): { citation: string; advice: string } {
  return edition === '2024'
    ? { citation: 'DMG 2024 p. 82', advice: '−1d3 if spread out, +1d3 if bunched up' }
    : { citation: 'DMG 2014 p. 249', advice: 'add or remove for how bunched up they are' };
}
```

- [ ] **Step 4: Run the tests to see them pass:** `npx vitest run src/utils/squad.test.ts`. Expected: PASS, including the existing 2014 `aoeTargetCount` tests.

- [ ] **Step 5: Verify and commit.** Run `npx tsc --noEmit && npx eslint src/utils/squad.ts src/utils/squad.test.ts src/types/index.ts`, then:

```bash
git add src/types/index.ts src/utils/squad.ts src/utils/squad.test.ts
git commit -m "Area suggestion by DMG edition: 2014 formula or 2024 table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Morale rules

**Files:**
- Modify: `src/types/index.ts`.
- Modify: `src/context/CombatContext.tsx`: only `initialCombatState` (~line 40), adding `moralePrompts: [],` after `shipActionsUsed: {},`.
- Create: `src/utils/morale.ts`, `src/utils/morale.test.ts`.

**Interfaces:**
- Consumes: `saveBonus(statblock, ability)` and `type Roller` from `./squad`.
- Produces:
  - types `MoraleTrigger`, `MoralePrompt`, `MoraleStatus`; `Creature.morale`; `squad.leaderId`; `CombatState.moralePrompts`;
  - `MORALE_DC`, `INCAPACITATING`;
  - `isLeaderDown(leader?: Creature): boolean`;
  - `detectMoraleTriggers(prev: CombatState, next: CombatState, newId: () => string): { creatures: Creature[]; prompts: MoralePrompt[] }`;
  - `moraleSaver(creature: Creature, creatures: Creature[]): { saver: Creature; bonus: number; usingLeader: boolean }`;
  - `rollMorale(args: { bonus: number; disadvantage: boolean; roll: Roller }): { d20s: number[]; d20: number; total: number; success: boolean }`;
  - `type MoraleOutcome`;
  - `formatMoraleLog(creatureName: string, reason: string, outcome: MoraleOutcome): string`;
  - `moraleTriggerText(prompt: MoralePrompt, creature: Creature): string`.

- [ ] **Step 1: Types.** In `src/types/index.ts`:
  1. Change the `squad` field on `Creature` to:

```ts
  /** Battle mode: this creature stands for a squad of identical bodies. Front body HP = currentHp. */
  squad?: { size: number; bodies: number; leaderId?: string };
  /** Battle mode morale (DMG 2014 p. 273). */
  morale?: { status?: MoraleStatus; asked: MoraleTrigger[] };
```

  2. Add after the `Creature` interface:

```ts
export type MoraleStatus = 'fleeing' | 'surrendered';
export type MoraleTrigger = 'leader-down' | 'half-size' | 'half-hp';
export interface MoralePrompt {
  id: string;
  creatureId: string; // the squad or creature that may flee
  trigger: MoraleTrigger | 'manual';
  leaderName?: string; // for leader-down text, kept in case the leader was removed
}
```

  3. Add to `CombatState`, before `dmgEdition`:

```ts
  // Battle mode: open morale checks, oldest first
  moralePrompts: MoralePrompt[];
```

  4. Add `moralePrompts: [],` to `initialCombatState` in `src/context/CombatContext.tsx`.

- [ ] **Step 2: Write the failing tests** in `src/utils/morale.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { detectMoraleTriggers, moraleSaver, rollMorale, formatMoraleLog, moraleTriggerText } from './morale';
import type { CombatState, Creature, MoralePrompt } from '../types';

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
const squadOf = (id: string, bodies: number, leaderId?: string, over: Partial<Creature> = {}) =>
  npc(id, 11, { squad: { size: 10, bodies, leaderId }, ...over }, 11);
const pcOf = (id: string, currentHp: number) => {
  const base = npc(id, currentHp);
  return { ...base, statblock: { ...base.statblock, type: 'pc' } } as Creature;
};
const st = (creatures: Creature[], phase = 'combat') => ({ phase, creatures }) as unknown as CombatState;
const detect = (before: Creature[], after: Creature[], phase = 'combat') =>
  detectMoraleTriggers(st(before, phase), st(after, phase), newId);
const triggers = (r: { prompts: MoralePrompt[] }) => r.prompts.map((p) => [p.creatureId, p.trigger]);
const withId = (list: Creature[], id: string, replacement: Creature) => list.map((c) => (c.id === id ? replacement : c));

describe('detectMoraleTriggers: leader down', () => {
  it('a leader dropping to 0 HP prompts each squad it leads, once', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k'), squadOf('b', 10, 'k'), squadOf('c', 10)];
    const after = withId(before, 'k', npc('k', 0));
    const r = detect(before, after);
    expect(triggers(r)).toEqual([['a', 'leader-down'], ['b', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
    expect(r.creatures.find((c) => c.id === 'a')!.morale!.asked).toEqual(['leader-down']);
    // healed, then dropped again: no second prompt
    const again = detect(withId(r.creatures, 'k', npc('k', 10)), r.creatures);
    expect(again.prompts).toEqual([]);
  });
  it('a leader becoming stunned prompts its squads', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k')];
    const after = withId(before, 'k', npc('k', 30, { conditions: [{ name: 'stunned' }] } as Partial<Creature>));
    expect(triggers(detect(before, after))).toEqual([['a', 'leader-down']]);
  });
  it('a leader removed from the encounter prompts its squads', () => {
    const before = [npc('k', 30), squadOf('a', 10, 'k')];
    const r = detect(before, [squadOf('a', 10, 'k')]);
    expect(triggers(r)).toEqual([['a', 'leader-down']]);
    expect(r.prompts[0].leaderName).toBe('k');
  });
});

describe('detectMoraleTriggers: half size and half HP', () => {
  it('a squad crossing half strength is prompted once; a wipe straight to 0 is not', () => {
    const r = detect([squadOf('a', 6)], [squadOf('a', 5)]);
    expect(triggers(r)).toEqual([['a', 'half-size']]);
    const asked = r.creatures[0];
    expect(detect([{ ...asked, squad: { size: 10, bodies: 6 } }], [asked]).prompts).toEqual([]);
    expect(detect([squadOf('b', 6)], [{ ...squadOf('b', 0), currentHp: 0 }]).prompts).toEqual([]);
  });
  it('a single NPC crossing half HP is prompted; not PCs, squads, or a drop to 0', () => {
    expect(triggers(detect([npc('x', 30)], [npc('x', 15)]))).toEqual([['x', 'half-hp']]);
    expect(detect([npc('x', 30)], [npc('x', 16)]).prompts).toEqual([]);
    expect(detect([pcOf('p', 30)], [pcOf('p', 10)]).prompts).toEqual([]);
    expect(detect([squadOf('a', 10)], [{ ...squadOf('a', 10), currentHp: 5 }]).prompts).toEqual([]);
    expect(detect([npc('x', 30)], [npc('x', 0)]).prompts).toEqual([]);
  });
  it('nothing outside combat, and nothing for creatures already broken', () => {
    expect(detect([npc('x', 30)], [npc('x', 15)], 'setup').prompts).toEqual([]);
    const fleeing = { morale: { status: 'fleeing' as const, asked: [] } };
    expect(detect([npc('x', 30, fleeing)], [npc('x', 15, fleeing)]).prompts).toEqual([]);
  });
  it('returns the same creatures array when nothing fires', () => {
    const after = [npc('x', 20)];
    expect(detect([npc('x', 25)], after).creatures).toBe(after);
  });
});

describe('moraleSaver', () => {
  const leader = (hp: number) => {
    const k = npc('k', hp);
    return { ...k, statblock: { ...k.statblock, savingThrows: { wis: 4 } } } as Creature;
  };
  it('uses the leader when standing', () => {
    const r = moraleSaver(squadOf('a', 10, 'k'), [leader(30)]);
    expect(r).toMatchObject({ bonus: 4, usingLeader: true });
    expect(r.saver.id).toBe('k');
  });
  it('falls back to the squad when the leader is down or absent', () => {
    expect(moraleSaver(squadOf('a', 10, 'k'), [leader(0)])).toMatchObject({ bonus: 2, usingLeader: false });
    expect(moraleSaver(squadOf('a', 10), []).saver.id).toBe('a');
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
    const p = (trigger: MoralePrompt['trigger'], leaderName?: string) => ({ id: '1', creatureId: 'a', trigger, leaderName });
    expect(moraleTriggerText(p('leader-down', 'k'), squadOf('a', 10))).toBe('k is down');
    expect(moraleTriggerText(p('half-size'), squadOf('a', 5))).toBe('Down to half strength (5/10)');
    expect(moraleTriggerText(p('half-hp'), npc('x', 10))).toBe('Below half HP');
    expect(moraleTriggerText(p('manual'), npc('x', 10))).toBe('Morale check');
  });
});
```

- [ ] **Step 3: Run the tests to see them fail:** `npx vitest run src/utils/morale.test.ts`. Expected: FAIL (cannot resolve `./morale`).

- [ ] **Step 4: Implement** `src/utils/morale.ts`

```ts
/**
 * Battle mode morale — DMG 2014 p. 273 optional rule (the 2024 DMG has none).
 * Spec: docs/superpowers/specs/2026-10-20-battle-mode-morale-design.md. Pure; dice are injected.
 */
import type { CombatState, ConditionName, Creature, MoralePrompt, MoraleTrigger } from '../types';
import { saveBonus, type Roller } from './squad';

export const MORALE_DC = 10;
export const INCAPACITATING: ConditionName[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];

/** A leader is down when missing, at 0 HP, or incapacitated. */
export function isLeaderDown(leader?: Creature): boolean {
  if (!leader) return true;
  if (leader.currentHp <= 0) return true;
  return leader.conditions.some((c) => INCAPACITATING.includes(c.name));
}

const isOut = (c: Creature) => c.currentHp <= 0 || (c.squad !== undefined && c.squad.bodies === 0);
const hasAsked = (c: Creature, t: MoraleTrigger) => c.morale?.asked.includes(t) ?? false;

/**
 * Compares two states and returns new morale prompts (DMG triggers, each once per creature per battle).
 * Returns `next.creatures` unchanged (same array) when nothing fires.
 */
export function detectMoraleTriggers(prev: CombatState, next: CombatState, newId: () => string): { creatures: Creature[]; prompts: MoralePrompt[] } {
  if (next.phase !== 'combat') return { creatures: next.creatures, prompts: [] };
  const before = new Map(prev.creatures.map((c) => [c.id, c]));
  const now = new Map(next.creatures.map((c) => [c.id, c]));
  const prompts: MoralePrompt[] = [];
  let changed = false;

  const creatures = next.creatures.map((c) => {
    const was = before.get(c.id);
    if (!was || c.statblock.type === 'pc' || c.morale?.status || isOut(c)) return c;
    const fired: MoraleTrigger[] = [];
    let leaderName: string | undefined;

    const leaderId = c.squad?.leaderId;
    if (leaderId && !hasAsked(c, 'leader-down')) {
      const leaderWas = before.get(leaderId);
      const leaderNow = now.get(leaderId);
      if (!isLeaderDown(leaderWas) && isLeaderDown(leaderNow)) {
        fired.push('leader-down');
        leaderName = (leaderNow ?? leaderWas)?.name;
      }
    }
    if (c.squad && was.squad && !hasAsked(c, 'half-size')) {
      const half = c.squad.size / 2;
      if (was.squad.bodies > half && c.squad.bodies <= half) fired.push('half-size');
    }
    if (!c.squad && !hasAsked(c, 'half-hp')) {
      const half = c.statblock.maxHp / 2;
      if (was.currentHp > half && c.currentHp <= half) fired.push('half-hp');
    }

    if (fired.length === 0) return c;
    changed = true;
    for (const trigger of fired) {
      prompts.push({ id: newId(), creatureId: c.id, trigger, ...(trigger === 'leader-down' ? { leaderName } : {}) });
    }
    return { ...c, morale: { ...c.morale, asked: [...(c.morale?.asked ?? []), ...fired] } };
  });

  return { creatures: changed ? creatures : next.creatures, prompts };
}

/** Who makes the save: the squad's leader if standing, else the creature itself (VVTT rule for leaderless squads). */
export function moraleSaver(creature: Creature, creatures: Creature[]): { saver: Creature; bonus: number; usingLeader: boolean } {
  const leaderId = creature.squad?.leaderId;
  const leader = leaderId ? creatures.find((c) => c.id === leaderId) : undefined;
  if (leader && !isLeaderDown(leader)) {
    return { saver: leader, bonus: saveBonus(leader.statblock, 'wis'), usingLeader: true };
  }
  return { saver: creature, bonus: saveBonus(creature.statblock, 'wis'), usingLeader: false };
}

/** DC 10 Wisdom save; with disadvantage roll twice and keep the lower. */
export function rollMorale({ bonus, disadvantage, roll }: { bonus: number; disadvantage: boolean; roll: Roller }): {
  d20s: number[]; d20: number; total: number; success: boolean;
} {
  const d20s = disadvantage ? [roll(20), roll(20)] : [roll(20)];
  const d20 = Math.min(...d20s);
  const total = d20 + bonus;
  return { d20s, d20, total, success: total >= MORALE_DC };
}

export type MoraleOutcome =
  | { kind: 'roll'; saverName: string; bonus: number; d20s: number[]; d20: number; total: number; success: boolean }
  | { kind: 'auto' };

export function formatMoraleLog(creatureName: string, reason: string, outcome: MoraleOutcome): string {
  const head = `${creatureName} — morale (${reason}): `;
  if (outcome.kind === 'auto') return `${head}fails automatically (overwhelming opposition) → flees`;
  const sign = outcome.bonus < 0 ? '−' : '+';
  const dis = outcome.d20s.length > 1 ? ` (disadvantage: ${outcome.d20s.join(', ')})` : '';
  return `${head}${outcome.saverName} WIS ${outcome.d20}${dis} ${sign} ${Math.abs(outcome.bonus)} = ${outcome.total} vs DC ${MORALE_DC} → ${outcome.success ? 'holds' : 'flees'}`;
}

export function moraleTriggerText(prompt: MoralePrompt, creature: Creature): string {
  switch (prompt.trigger) {
    case 'leader-down': return `${prompt.leaderName ?? 'Leader'} is down`;
    case 'half-size': return `Down to half strength (${creature.squad?.bodies ?? 0}/${creature.squad?.size ?? 0})`;
    case 'half-hp': return 'Below half HP';
    default: return 'Morale check';
  }
}
```

- [ ] **Step 5: Run the tests to see them pass:** `npx vitest run src/utils/morale.test.ts`, then `npm test`. Expected: PASS everywhere.

- [ ] **Step 6: Verify and commit.** Run `npx tsc --noEmit && npx eslint src/utils/morale.ts src/utils/morale.test.ts src/types/index.ts src/context/CombatContext.tsx`, then:

```bash
git add src/types/index.ts src/context/CombatContext.tsx src/utils/morale.ts src/utils/morale.test.ts
git commit -m "Morale rules: DMG 2014 triggers, saver, DC 10 roll, log text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reducer — detection wrapper and morale actions

**Files:**
- Modify: `src/context/CombatContext.tsx`:
  - the `combatReducer` declaration (~line 163);
  - the `CombatAction` union;
  - `LOAD_ENCOUNTER` (~line 293, next to `shipActionsUsed: action.payload.shipActionsUsed || {},`);
  - `REMOVE_CREATURE` (~575);
  - `RESET_COMBAT` (~956).
- Test: `src/context/combatReducer.test.ts` (append).

**Interfaces:**
- Consumes: `detectMoraleTriggers` from `../utils/morale` (Task 2).
- Produces these actions (the UI dispatches them):
  - `{ type: 'REQUEST_MORALE'; payload: { creatureId: string } }`
  - `{ type: 'RESOLVE_MORALE'; payload: { promptId: string; fled: boolean; log: string; details?: string } }`
  - `{ type: 'DISMISS_MORALE'; payload: { promptId: string } }`
  - `{ type: 'SET_MORALE_STATUS'; payload: { creatureId: string; status?: MoraleStatus } }`
  - `{ type: 'SET_DMG_EDITION'; payload: { edition: DmgEdition } }`

- [ ] **Step 1: Write the failing tests** (append to `src/context/combatReducer.test.ts`)

```ts
describe('battle mode morale', () => {
  const npc = (id: string, currentHp: number, maxHp = 30, over: Partial<Creature> = {}) => ({
    id, name: id, currentHp, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 0, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp, ac: 12, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } },
    ...over,
  }) as unknown as Creature;
  const squadOf = (id: string, bodies: number, leaderId?: string) => npc(id, 11, 11, { squad: { size: 10, bodies, leaderId } });
  const combat = (...creatures: Creature[]) => ({ ...initialCombatState, phase: 'combat' as const, round: 1, creatures });

  it('SQUAD_HITS crossing half strength queues a half-size prompt', () => {
    const out = combatReducer(combat(squadOf('a', 6)), { type: 'SQUAD_HITS', payload: { creatureId: 'a', hits: [11] } });
    expect(out.moralePrompts).toMatchObject([{ creatureId: 'a', trigger: 'half-size' }]);
    expect(out.creatures[0].morale?.asked).toEqual(['half-size']);
  });

  it('DEAL_DAMAGE_TO_CREATURE dropping a leader prompts each squad it leads', () => {
    const s = combat(npc('k', 30), squadOf('a', 10, 'k'), squadOf('b', 10, 'k'), squadOf('c', 10));
    const out = combatReducer(s, { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'k', amount: 40 } });
    expect(out.moralePrompts.map((p) => [p.creatureId, p.trigger, p.leaderName])).toEqual([['a', 'leader-down', 'k'], ['b', 'leader-down', 'k']]);
  });

  it('UPDATE_CREATURE below half HP prompts a single NPC in combat, not in setup', () => {
    const upd = { type: 'UPDATE_CREATURE' as const, payload: { id: 'x', updates: { currentHp: 15 } } };
    expect(combatReducer(combat(npc('x', 30)), upd).moralePrompts).toMatchObject([{ creatureId: 'x', trigger: 'half-hp' }]);
    expect(combatReducer({ ...combat(npc('x', 30)), phase: 'setup' as const }, upd).moralePrompts).toEqual([]);
  });

  it('an action that fires nothing leaves moralePrompts untouched', () => {
    const s = combat(npc('x', 30));
    const out = combatReducer(s, { type: 'UPDATE_CREATURE', payload: { id: 'x', updates: { initiative: 12 } } });
    expect(out.moralePrompts).toBe(s.moralePrompts);
  });

  it('REQUEST_MORALE adds one manual prompt per creature', () => {
    const once = combatReducer(combat(npc('x', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const twice = combatReducer(once, { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    expect(twice.moralePrompts).toMatchObject([{ creatureId: 'x', trigger: 'manual' }]);
  });

  it('RESOLVE_MORALE removes the prompt, logs, and marks fleeing only when fled', () => {
    const s = combatReducer(combat(npc('x', 30), npc('y', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const fled = combatReducer(s, { type: 'RESOLVE_MORALE', payload: { promptId: s.moralePrompts[0].id, fled: true, log: 'x flees' } });
    expect(fled.moralePrompts).toEqual([]);
    expect(fled.creatures[0].morale).toEqual({ asked: [], status: 'fleeing' });
    expect(fled.actionLog.at(-1)).toMatchObject({ type: 'system', action: 'x flees' });
    const held = combatReducer(s, { type: 'RESOLVE_MORALE', payload: { promptId: s.moralePrompts[0].id, fled: false, log: 'x holds' } });
    expect(held.creatures[0].morale).toBeUndefined();
    expect(held.actionLog.at(-1)?.action).toBe('x holds');
  });

  it('DISMISS_MORALE removes the prompt without logging', () => {
    const s = combatReducer(combat(npc('x', 30)), { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const out = combatReducer(s, { type: 'DISMISS_MORALE', payload: { promptId: s.moralePrompts[0].id } });
    expect(out.moralePrompts).toEqual([]);
    expect(out.actionLog).toBe(s.actionLog);
  });

  it('SET_MORALE_STATUS sets, changes and clears the status with a log line', () => {
    const s = combat(npc('x', 30));
    const sur = combatReducer(s, { type: 'SET_MORALE_STATUS', payload: { creatureId: 'x', status: 'surrendered' } });
    expect(sur.creatures[0].morale).toEqual({ asked: [], status: 'surrendered' });
    expect(sur.actionLog.at(-1)?.action).toBe('x surrenders');
    const cleared = combatReducer(sur, { type: 'SET_MORALE_STATUS', payload: { creatureId: 'x' } });
    expect(cleared.creatures[0].morale?.status).toBeUndefined();
    expect(cleared.actionLog.at(-1)?.action).toBe('x rallies (morale status cleared)');
  });

  it('REMOVE_CREATURE of a leader prompts its squads and drops prompts for the removed creature', () => {
    const s = combatReducer(combat(npc('k', 30), squadOf('a', 10, 'k')), { type: 'REQUEST_MORALE', payload: { creatureId: 'k' } });
    const out = combatReducer(s, { type: 'REMOVE_CREATURE', payload: 'k' });
    expect(out.moralePrompts.map((p) => [p.creatureId, p.trigger])).toEqual([['a', 'leader-down']]);
  });

  it('RESET_COMBAT clears morale and prompts but keeps the DMG edition', () => {
    const s = { ...combat(npc('x', 15, 30, { morale: { status: 'fleeing', asked: ['half-hp'] } })), dmgEdition: '2024' as const };
    const withPrompt = combatReducer(s, { type: 'REQUEST_MORALE', payload: { creatureId: 'x' } });
    const out = combatReducer(withPrompt, { type: 'RESET_COMBAT' });
    expect(out.moralePrompts).toEqual([]);
    expect(out.creatures[0].morale).toBeUndefined();
    expect(out.dmgEdition).toBe('2024');
  });

  it('SET_DMG_EDITION sets the edition', () => {
    expect(combatReducer(initialCombatState, { type: 'SET_DMG_EDITION', payload: { edition: '2024' } }).dmgEdition).toBe('2024');
  });

  it('LOAD_ENCOUNTER of an older save defaults moralePrompts and leaves the edition unset', () => {
    const { moralePrompts: _m, ...old } = initialCombatState;
    const loaded = combatReducer(initialCombatState, { type: 'LOAD_ENCOUNTER', payload: old as typeof initialCombatState });
    expect(loaded.moralePrompts).toEqual([]);
    expect(loaded.dmgEdition).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail:** `npx vitest run src/context/combatReducer.test.ts`. Expected: the new tests fail; the existing ones pass.

- [ ] **Step 3: Implement** in `src/context/CombatContext.tsx`.

(a) Imports. Add `MoraleStatus, DmgEdition` to the existing `../types` import. Add:

```ts
import { detectMoraleTriggers } from '../utils/morale';
```

(b) Add to the `CombatAction` union:

```ts
  | { type: 'REQUEST_MORALE'; payload: { creatureId: string } }
  | { type: 'RESOLVE_MORALE'; payload: { promptId: string; fled: boolean; log: string; details?: string } }
  | { type: 'DISMISS_MORALE'; payload: { promptId: string } }
  | { type: 'SET_MORALE_STATUS'; payload: { creatureId: string; status?: MoraleStatus } }
  | { type: 'SET_DMG_EDITION'; payload: { edition: DmgEdition } }
```

(c) Rename `export function combatReducer(state: CombatState, action: CombatAction): CombatState {` to `function baseCombatReducer(state: CombatState, action: CombatAction): CombatState {`. Directly **above** it, add:

```ts
/** Battle mode morale (DMG 2014 p. 273): queue morale prompts when an action crosses a trigger. */
function applyMoraleDetection(prev: CombatState, next: CombatState): CombatState {
  if (next === prev) return next;
  const { creatures, prompts } = detectMoraleTriggers(prev, next, () => uuid());
  if (prompts.length === 0) return next;
  return { ...next, creatures, moralePrompts: [...(next.moralePrompts ?? []), ...prompts] };
}

export function combatReducer(state: CombatState, action: CombatAction): CombatState {
  return applyMoraleDetection(state, baseCombatReducer(state, action));
}
```

Function declarations are hoisted, so `baseCombatReducer` being declared below is fine. `useReducer(combatReducer, …)` keeps working unchanged.

(d) Add these cases to `baseCombatReducer` (after `case 'SQUAD_AREA'`):

```ts
    // ========== Battle mode morale ==========
    case 'REQUEST_MORALE': {
      if (state.moralePrompts.some((p) => p.creatureId === action.payload.creatureId)) return state;
      return {
        ...state,
        moralePrompts: [...state.moralePrompts, { id: uuid(), creatureId: action.payload.creatureId, trigger: 'manual' }],
      };
    }

    case 'RESOLVE_MORALE': {
      const prompt = state.moralePrompts.find((p) => p.id === action.payload.promptId);
      if (!prompt) return state;
      return {
        ...state,
        moralePrompts: state.moralePrompts.filter((p) => p.id !== prompt.id),
        creatures: action.payload.fled
          ? state.creatures.map((c) =>
              c.id === prompt.creatureId ? { ...c, morale: { asked: c.morale?.asked ?? [], status: 'fleeing' as const } } : c
            )
          : state.creatures,
        actionLog: [...state.actionLog, createLogEntry(state.round, 'system', action.payload.log, action.payload.details)],
      };
    }

    case 'DISMISS_MORALE':
      return { ...state, moralePrompts: state.moralePrompts.filter((p) => p.id !== action.payload.promptId) };

    case 'SET_MORALE_STATUS': {
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);
      if (!creature) return state;
      const status = action.payload.status;
      const text = status === 'fleeing' ? 'is fleeing' : status === 'surrendered' ? 'surrenders' : 'rallies (morale status cleared)';
      return {
        ...state,
        creatures: state.creatures.map((c) =>
          c.id === creature.id ? { ...c, morale: { asked: c.morale?.asked ?? [], status } } : c
        ),
        actionLog: [...state.actionLog, createLogEntry(state.round, 'system', `${creature.name} ${text}`)],
      };
    }

    case 'SET_DMG_EDITION':
      return { ...state, dmgEdition: action.payload.edition };
```

(e) `LOAD_ENCOUNTER`: after `shipActionsUsed: action.payload.shipActionsUsed || {},`, add `moralePrompts: action.payload.moralePrompts || [],`. The autosave load already spreads `initialCombatState` first, so it gets `[]` with no change.

(f) `REMOVE_CREATURE`: add `moralePrompts: state.moralePrompts.filter((p) => p.creatureId !== action.payload),` to the returned object.

(g) `RESET_COMBAT`: add `moralePrompts: [],` next to `shipActionsUsed: {},`, and add `morale: undefined,` inside the creature map (next to `initiative: 0,`). `dmgEdition` is kept automatically by `...state`.

- [ ] **Step 4: Run the tests to see them pass:** `npx vitest run src/context/combatReducer.test.ts src/utils/morale.test.ts`, then `npm test`. Expected: PASS everywhere.

- [ ] **Step 5: Verify and commit.** Run `npx tsc --noEmit && npx eslint src/context/CombatContext.tsx src/context/combatReducer.test.ts`, then:

```bash
git add src/context/CombatContext.tsx src/context/combatReducer.test.ts
git commit -m "Reducer: morale prompts from triggers, resolve/dismiss/status actions, DMG edition setting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Area dialog follows the DMG edition

**Files:**
- Modify: `src/components/squads/SquadAreaDialog.tsx`

**Interfaces:**
- Consumes: `aoeTargetCount(shape, size, edition, width)` and `aoeAdvice(edition)` (Task 1); the `SET_DMG_EDITION` action (Task 3); `state.dmgEdition`.

- [ ] **Step 1: Edit the dialog.**
  1. Add `ToggleButton, ToggleButtonGroup` to the `@mui/material` import, `aoeAdvice` to the `../../utils/squad` import, and `type DmgEdition` to the `../../types` import.
  2. Replace `const { dispatch } = useCombat();` with `const { state, dispatch } = useCombat();` and add, below it:

```ts
  const edition: DmgEdition = state.dmgEdition ?? '2014';
  const [width, setWidth] = useState(5);
```

  3. Replace the `suggested` line with:

```ts
  const suggested = Math.min(aoeTargetCount(shape, size, edition, width), bodies);
  const advice = aoeAdvice(edition);
```

  4. In the form (the non-result branch), add this block as the **first** child of the `<Stack spacing={1.5} …>`:

```tsx
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" color="text.secondary">DMG rules</Typography>
              <ToggleButtonGroup
                size="small" exclusive value={edition}
                onChange={(_, value: DmgEdition | null) => {
                  if (!value) return;
                  dispatch({ type: 'SET_DMG_EDITION', payload: { edition: value } });
                  setCaughtOverride(null);
                }}
              >
                <ToggleButton value="2014" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2014</ToggleButton>
                <ToggleButton value="2024" sx={{ py: 0.25, px: 1, fontSize: '0.7rem' }}>2024</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
```

  5. Directly after the Shape/Size `<Stack direction="row" …>`, add:

```tsx
            {shape === 'line' && edition === '2024' && (
              <TextField size="small" type="number" label="Width (ft)" value={width}
                onChange={(e) => { setWidth(Math.max(5, parseInt(e.target.value) || 5)); setCaughtOverride(null); }} />
            )}
```

  6. Replace the Bodies caught `helperText` with:

```tsx
              helperText={`${advice.citation} suggests ${suggested} — ${advice.advice} (${bodies} left)${edition === '2024' ? '. VVTT rule: sizes between rows use the row below' : ''}`}
```

- [ ] **Step 2: Verify.** Run `npx tsc --noEmit && npx eslint src/components/squads/SquadAreaDialog.tsx && npm test`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/squads/SquadAreaDialog.tsx
git commit -m "Area dialog: DMG 2014/2024 toggle, line width, edition advice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Morale cards in the right panel

**Files:**
- Create: `src/components/morale/MoralePromptCard.tsx`, `src/components/morale/MoralePromptStack.tsx`
- Modify: `src/components/layout/RightPanel.tsx`: the outer `<Box component="aside" …>` (~line 52); the creature-turn return (~line 594), where `{currentTurnCreature.squad && <SquadAttackPanel … />}` is the last child.

**Interfaces:**
- Consumes:
  - `moraleSaver`, `rollMorale`, `formatMoraleLog`, `moraleTriggerText`, `MORALE_DC`, `type MoraleOutcome` from `src/utils/morale`;
  - `rollDie` from `src/utils/diceEngine`;
  - the `RESOLVE_MORALE` and `DISMISS_MORALE` actions; `state.moralePrompts`.
- Produces: `<MoralePromptStack />`.

- [ ] **Step 1: Create `src/components/morale/MoralePromptCard.tsx`**

```tsx
import { useState } from 'react';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { MoralePrompt } from '../../types';
import { moraleSaver, rollMorale, formatMoraleLog, moraleTriggerText, MORALE_DC, type MoraleOutcome } from '../../utils/morale';
import { rollDie } from '../../utils/diceEngine';

/** One open morale check (DMG 2014 p. 273): Roll, Fails automatically, or Dismiss. */
export function MoralePromptCard({ prompt, onResolved }: { prompt: MoralePrompt; onResolved: (text: string, fled: boolean) => void }) {
  const { state, dispatch } = useCombat();
  const [disadvantage, setDisadvantage] = useState(false);
  const creature = state.creatures.find((c) => c.id === prompt.creatureId);
  if (!creature) return null;

  const { saver, bonus, usingLeader } = moraleSaver(creature, state.creatures);
  const reason = moraleTriggerText(prompt, creature);
  const bonusText = `WIS ${bonus < 0 ? '−' : '+'}${Math.abs(bonus)}`;
  const who = usingLeader
    ? `${saver.name} saves for the squad: ${bonusText}`
    : creature.squad
      ? `No leader standing — the squad saves (VVTT rule): ${bonusText}`
      : `${bonusText} save`;

  const resolve = (outcome: MoraleOutcome) => {
    const fled = outcome.kind === 'auto' || !outcome.success;
    const log = formatMoraleLog(creature.name, reason, outcome);
    dispatch({ type: 'RESOLVE_MORALE', payload: { promptId: prompt.id, fled, log } });
    onResolved(log, fled);
  };

  const handleRoll = () => {
    const r = rollMorale({ bonus, disadvantage, roll: rollDie });
    resolve({ kind: 'roll', saverName: saver.name, bonus, ...r });
  };

  return (
    <Box sx={{ p: 1, border: 1, borderColor: 'warning.main', borderRadius: 1 }}>
      <Typography variant="body2" fontWeight={600}>{creature.name}: {reason}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {who} · DC {MORALE_DC} (DMG 2014 p. 273)
      </Typography>
      {prompt.trigger === 'half-size' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          DMG: only if the other side has had no losses — dismiss otherwise.
        </Typography>
      )}
      <FormControlLabel
        control={<Switch size="small" checked={disadvantage} onChange={(e) => setDisadvantage(e.target.checked)} />}
        label={<Typography variant="caption">Disadvantage (overwhelming opposition)</Typography>}
      />
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="contained" onClick={handleRoll}>Roll</Button>
        <Button size="small" variant="outlined" color="warning" onClick={() => resolve({ kind: 'auto' })}>Fails automatically</Button>
        <Button size="small" onClick={() => dispatch({ type: 'DISMISS_MORALE', payload: { promptId: prompt.id } })}>Dismiss</Button>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 2: Create `src/components/morale/MoralePromptStack.tsx`**

```tsx
import { useState } from 'react';
import { Alert, Stack } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { MoralePromptCard } from './MoralePromptCard';

/** Open morale checks, plus the results of ones just resolved (until closed). */
export function MoralePromptStack() {
  const { state } = useCombat();
  const [results, setResults] = useState<{ id: string; text: string; fled: boolean }[]>([]);
  const prompts = state.moralePrompts ?? [];
  if (prompts.length === 0 && results.length === 0) return null;
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {results.map((r) => (
        <Alert key={r.id} severity={r.fled ? 'warning' : 'success'} onClose={() => setResults((rs) => rs.filter((x) => x.id !== r.id))}>
          {r.text}
        </Alert>
      ))}
      {prompts.map((p) => (
        <MoralePromptCard key={p.id} prompt={p} onResolved={(text, fled) => setResults((rs) => [...rs, { id: p.id, text, fled }])} />
      ))}
    </Stack>
  );
}
```

- [ ] **Step 3: Mount in `RightPanel.tsx`.**
  1. Add `import { MoralePromptStack } from '../morale/MoralePromptStack';` and add `Alert` to the `@mui/material` import if it isn't there.
  2. Make `<MoralePromptStack />` the first child inside the `<Box component="aside" …>`, before `{/* Setup Phase - Show placeholder content */}`.
  3. In the creature-turn return, replace `{currentTurnCreature.squad && <SquadAttackPanel key={currentTurnCreature.id} squad={currentTurnCreature} />}` with:

```tsx
      {currentTurnCreature.morale?.status && (
        <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
          {currentTurnCreature.morale.status === 'fleeing'
            ? 'Fleeing: moves away by the quickest route (DMG 2014 p. 273)'
            : 'Surrendered'}
        </Alert>
      )}
      {currentTurnCreature.squad && !currentTurnCreature.morale?.status && (
        <SquadAttackPanel key={currentTurnCreature.id} squad={currentTurnCreature} />
      )}
```

- [ ] **Step 4: Verify.** Run `npx tsc --noEmit && npx eslint src/components/morale/MoralePromptCard.tsx src/components/morale/MoralePromptStack.tsx src/components/layout/RightPanel.tsx && npm test`. Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/morale/MoralePromptCard.tsx src/components/morale/MoralePromptStack.tsx src/components/layout/RightPanel.tsx
git commit -m "Morale cards in the right panel; fleeing/surrendered turn banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Leader picker, row morale controls, token marker

**Files:**
- Create: `src/components/morale/SquadLeaderSelect.tsx`, `src/components/morale/MoraleRowControls.tsx`, `src/components/morale/MoraleTokenMarker.tsx`
- Modify: `src/components/layout/Sidebar.tsx`:
  - the edit states near `const [editBodies, setEditBodies]` (~284);
  - `startEdit` (~504);
  - `saveEdit` (~521);
  - both `editState={{ … }}` objects (~882, ~996);
  - `CreatureEntryProps.editState` (~1301);
  - the edit form's Bodies row (~1411);
  - the controls line `{!isPC && creature.squad && <SquadRowControls creature={creature} />}` (~1594).
- Modify: `src/components/battlefield/BattlefieldMap.tsx` (~3958) and `src/components/battlefield/PlayerViewMap.tsx` (~400), next to the existing `SquadTokenOverlay` mounts.

**Interfaces:**
- Consumes: the `REQUEST_MORALE` and `SET_MORALE_STATUS` actions; `state.moralePrompts`, `state.phase`; `Creature.morale`, `squad.leaderId`.
- Produces:
  - `<SquadLeaderSelect squad={Creature} value={string} onChange={(id: string) => void} />`
  - `<MoraleRowControls creature={Creature} />`
  - `<MoraleTokenMarker status={MoraleStatus} tokenSize={number} />`

- [ ] **Step 1: Create `src/components/morale/SquadLeaderSelect.tsx`**

```tsx
import { MenuItem, TextField } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';

/** Pick the creature that leads a squad for morale (DMG 2014 p. 273). Same faction, not a squad. */
export function SquadLeaderSelect({ squad, value, onChange }: { squad: Creature; value: string; onChange: (id: string) => void }) {
  const { state } = useCombat();
  const options = state.creatures.filter((c) => c.id !== squad.id && !c.squad && c.faction === squad.faction && c.currentHp > 0);
  const current = value ? state.creatures.find((c) => c.id === value) : undefined;
  const list = current && !options.includes(current) ? [current, ...options] : options;
  return (
    <TextField
      select size="small" fullWidth label="Leader" value={list.some((c) => c.id === value) ? value : ''}
      onChange={(e) => onChange(e.target.value)} helperText="Rolls this squad's morale (DMG 2014 p. 273)"
    >
      <MenuItem value="">(none)</MenuItem>
      {list.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
    </TextField>
  );
}
```

- [ ] **Step 2: Create `src/components/morale/MoraleRowControls.tsx`**

```tsx
import { Box, Button, Chip, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature, MoraleStatus } from '../../types';

const NEXT_STATUS: Record<MoraleStatus, MoraleStatus | undefined> = { fleeing: 'surrendered', surrendered: undefined };

/** Sidebar row: "led by", the Fleeing/Surrendered chip (click cycles), and a manual Morale check button. */
export function MoraleRowControls({ creature }: { creature: Creature }) {
  const { state, dispatch } = useCombat();
  const status = creature.morale?.status;
  const leaderId = creature.squad?.leaderId;
  const leader = leaderId ? state.creatures.find((c) => c.id === leaderId) : undefined;
  const pending = (state.moralePrompts ?? []).some((p) => p.creatureId === creature.id);
  const canCheck = state.phase === 'combat' && creature.currentHp > 0;
  if (!leader && !status && !canCheck) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      {leader && <Typography variant="caption" color="text.secondary">led by {leader.name}</Typography>}
      {status && (
        <Chip
          size="small" label={status === 'fleeing' ? '↩ Fleeing' : '⚐ Surrendered'} color={status === 'fleeing' ? 'warning' : 'default'}
          title="Click: Fleeing → Surrendered → cleared"
          onClick={() => dispatch({ type: 'SET_MORALE_STATUS', payload: { creatureId: creature.id, status: NEXT_STATUS[status] } })}
          sx={{ height: 18, fontSize: '0.6rem' }}
        />
      )}
      {canCheck && (
        <Button
          size="small" disabled={pending} title="Ask for a morale check (surprise or any other DMG trigger)"
          onClick={() => dispatch({ type: 'REQUEST_MORALE', payload: { creatureId: creature.id } })}
          sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: '0.65rem' }}
        >
          Morale
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Create `src/components/morale/MoraleTokenMarker.tsx`**

```tsx
import type { MoraleStatus } from '../../types';

/** Small ↩ (fleeing) or ⚐ (surrendered) marker in a token's top-left corner. Shared by the DM map and the player view. */
export function MoraleTokenMarker({ status, tokenSize }: { status: MoraleStatus; tokenSize: number }) {
  return (
    <span
      title={status === 'fleeing' ? 'Fleeing' : 'Surrendered'}
      style={{
        position: 'absolute',
        left: -tokenSize * 0.2,
        top: -tokenSize * 0.2,
        fontSize: Math.max(10, tokenSize * 0.35),
        lineHeight: 1,
        padding: '1px 3px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.85)',
        color: status === 'fleeing' ? '#f59e0b' : '#e5e7eb',
        border: '1px solid currentColor',
        pointerEvents: 'none',
      }}
    >
      {status === 'fleeing' ? '↩' : '⚐'}
    </span>
  );
}
```

- [ ] **Step 4: Sidebar wiring.**
  1. Add the imports `import { SquadLeaderSelect } from '../morale/SquadLeaderSelect';` and `import { MoraleRowControls } from '../morale/MoraleRowControls';`.
  2. Add `const [editLeaderId, setEditLeaderId] = useState('');` next to `editBodies`.
  3. In `startEdit`, add `setEditLeaderId(creature.squad?.leaderId ?? '');`.
  4. In `saveEdit`, change the squad spread to `...(existing.squad && { squad: { ...existing.squad, bodies: editBodies, leaderId: editLeaderId || undefined } }),`.
  5. Add `editLeaderId: string; setEditLeaderId: (v: string) => void;` to `CreatureEntryProps.editState`, and `editLeaderId, setEditLeaderId` to **both** `editState={{ … }}` objects.
  6. In the edit form, directly after the `<Stack direction="row" spacing={1}>` that holds the Bodies / Front HP / Max fields, add:

```tsx
          {creature.squad && (
            <SquadLeaderSelect squad={creature} value={editState.editLeaderId} onChange={editState.setEditLeaderId} />
          )}
```

  7. Directly after `{!isPC && creature.squad && <SquadRowControls creature={creature} />}`, add:

```tsx
        {!isPC && <MoraleRowControls creature={creature} />}
```

- [ ] **Step 5: Tokens.** In both `BattlefieldMap.tsx` and `PlayerViewMap.tsx`, import `MoraleTokenMarker` from `'../morale/MoraleTokenMarker'`. Directly after each `{creature.squad && <SquadTokenOverlay … />}` line, add:

```tsx
        {creature.morale?.status && <MoraleTokenMarker status={creature.morale.status} tokenSize={tokenSize} />}
```

(Keep the surrounding indentation.)

- [ ] **Step 6: Verify.** Run `npx tsc --noEmit && npx eslint src/components/morale/SquadLeaderSelect.tsx src/components/morale/MoraleRowControls.tsx src/components/morale/MoraleTokenMarker.tsx src/components/layout/Sidebar.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx && npm test`. Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/morale/SquadLeaderSelect.tsx src/components/morale/MoraleRowControls.tsx src/components/morale/MoraleTokenMarker.tsx src/components/layout/Sidebar.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx
git commit -m "Squad leader picker, row morale button and status chip, token morale marker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Help and v2.12.0 changelog

**Files:**
- Modify: `src/components/help/HelpGuide.tsx`: the "Battle mode: squads" paragraph and the "VVTT rules" paragraph that follows it (~263–278), in section 5.
- Modify: `src/data/changelog.ts`: add a new first entry.

- [ ] **Step 1: Help.** In the squads paragraph, replace:

```
DMG&apos;s Targets in Areas of Effect table (p. 249), which you can adjust, then rolls each body&apos;s
              save.
```

with:

```
DMG&apos;s area-of-effect guidance — 2014 (p. 249) or 2024 (p. 82); pick the edition with the
              <strong> DMG rules</strong> toggle at the top of the dialog (the 2024 table catches more creatures) — which
              you can adjust, then rolls each body&apos;s save.
```

Directly before the `<Typography variant="body2">` that starts `<strong>VVTT rules</strong>`, insert:

```tsx
            <Typography variant="body2" paragraph>
              <strong>Morale (DMG 2014 p. 273, optional rule; the 2024 DMG has none).</strong> Give a squad a
              <strong> Leader</strong> in its edit form. The app shows a morale card at the top of the right panel when
              a squad&apos;s leader drops to 0 HP, is incapacitated or is removed; when a squad first falls to half
              strength (the DMG only counts this if the other side has had no losses, so dismiss it otherwise); or when
              a single monster first drops to half its HP. The leader, or the squad itself if no leader is standing,
              makes a DC 10 Wisdom save. Tick disadvantage for overwhelming odds, or mark it as failing automatically.
              A failure marks the creature <strong>Fleeing</strong>; click the chip in its row to change it to
              <strong> Surrendered</strong> or clear it. Use the row&apos;s <strong>Morale</strong> button for surprise
              or any other reason.
            </Typography>
```

In the "VVTT rules" paragraph, replace `squads don&apos;t use temporary HP.` with:

```
squads don&apos;t use temporary HP; each morale trigger is asked only once per battle; a squad with no
              leader standing saves with its own statblock; fleeing and surrendered creatures keep their place in
              initiative; with the 2024 area table, sizes between rows use the row below.
```

- [ ] **Step 2: Changelog.** Insert as the first element of `changelog`:

```ts
  {
    version: '2.12.0',
    date: '2026-10-20',
    changes: [
      { type: 'feature', description: 'Morale (DMG 2014 optional rule): squads can have a Leader, and the app raises a morale card when a leader falls, a squad drops to half strength, or a single monster drops below half HP. Roll the DC 10 Wisdom save (with disadvantage for overwhelming odds), mark it as failing automatically, or dismiss it.' },
      { type: 'feature', description: 'Fleeing and Surrendered: shown on the creature\'s row, its turn panel and its token on both the DM map and the player view. A manual Morale button covers surprise and other judgement calls.' },
      { type: 'feature', description: 'DMG edition: the squad Area dialog can follow the 2014 (p. 249) or 2024 (p. 82) area-of-effect guidance. The choice is saved with the encounter.' },
    ],
  },
```

- [ ] **Step 3: Verify and commit.** Run `npx tsc --noEmit && npx eslint src/components/help/HelpGuide.tsx src/data/changelog.ts && npm test`, then:

```bash
git add src/components/help/HelpGuide.tsx src/data/changelog.ts
git commit -m "Help and changelog for morale, commanders and DMG edition (v2.12.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Manual browser checklist (user, after deploy)

1. Add Karkajuk (a hobgoblin captain) and two hobgoblin squads of 10. In each squad's edit form, set **Leader** to Karkajuk. Each row shows "led by Karkajuk". Roll NPC Init and start combat.
2. In Squad A's row, Hit 11 × 5 → 5/10. A "Down to half strength" card appears with the DMG reminder. Roll it, and the result appears above the cards and in the log.
3. Deal Karkajuk enough damage to reach 0 HP. Two "Karkajuk is down" cards appear, each saying the squad saves itself. Roll one; mark the other **Fails automatically**.
4. A fleeing squad shows the ↩ chip in its row and the token marker on both the DM map and the player view. On its turn the panel shows the Fleeing banner and no Squad attack. Click the chip: it changes to Surrendered (⚐), then clears.
5. Drop a single NPC below half HP: a "Below half HP" card appears. Use **Morale** on another NPC: a "Morale check" card appears, and the button greys out while it's open.
6. Open Area… on a squad, switch DMG rules to 2024, and set a 20-ft-radius sphere: it suggests 10, capped at the bodies left. A 60-ft line shows a Width field. Close and reopen the dialog: it is still on 2024.
7. Reset Combat: the chips, markers and cards clear, and the Area dialog stays on 2024.
