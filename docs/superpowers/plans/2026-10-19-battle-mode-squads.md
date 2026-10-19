# Battle Mode: Squads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the GM run a group of identical monsters as one squad: one row, one initiative slot and one token. The squad rolls every attack in one click, and it loses bodies to single hits and area effects using DMG rules.

**Architecture:**
- A squad is an ordinary `Creature` with an optional `squad: { size, bodies }`. The front body's HP is the creature's `currentHp`, so `bodies === 0` exactly when `currentHp === 0`.
- All rules live in a new pure module, `src/utils/squad.ts`, with dice injected.
- The reducer gets two deterministic actions (`SQUAD_HITS`, `SQUAD_AREA`) and squad-aware branches in `DEAL_DAMAGE_TO_CREATURE`, `HEAL_CREATURE` and `UPDATE_CREATURE`.
- UI changes:
  - new components live in `src/components/squads/`;
  - the sidebar gets the add-as-squad switch and the row controls;
  - the RightPanel creature turn gets a Squad attack block;
  - both map renderers get a body badge and ring.

**Tech Stack:** React 18 + TypeScript + Vite + MUI, React Context + useReducer, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-battle-mode-squads-design.md`

## Global Constraints

- Creatures without a `squad` field, and all vehicles, must behave exactly as they do today.
- Rules text in the UI and help must label VVTT inventions as **VVTT rule** (spec decisions 1–3, 5, 7, 11) and cite book rules (DMG p. 249 for the area table).
- Area-of-effect table (DMG p. 249), all rounded up: Cone size ÷ 10, Cube or square size ÷ 5, Cylinder radius ÷ 5, Line length ÷ 30, Sphere or circle radius ÷ 5.
- Attacks: a natural 20 always hits and is a critical hit (it doubles the damage dice, not the bonus); a natural 1 always misses; otherwise the attack hits if total ≥ AC.
- Defenses: immunity → 0; resistance → half, rounded down; vulnerability → double; applied in that order.
- Damage that half-succeeds a save is halved and rounded down.
- Healing a squad never brings back fallen bodies.
- Pure logic goes in `src/utils/*.ts` with sibling `*.test.ts` (vitest). The reducer stays free of randomness.
- Run tests with `npx vitest run <file>`; type-check with `npx tsc --noEmit`; lint changed files with `npx eslint <files>` (full `npm run lint` hangs in the sandbox).
- Never stage `NAVAL_MECHANICS_SALTMARSH.md`, `COMBAT_LOG_EXPORT_PLAN.md` or `.firebase/hosting.ZGlzdA.cache`. Stage files by explicit path only.
- Every commit message ends with exactly: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work on branch `feat/battle-mode-squads` (created from `main`).
- Release is v2.11.0 (a changelog entry; there is no other version constant to bump).

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/squad.ts` (create) | All squad rules: damage parsing, group attacks, defenses, body math, area resolution, healing, naming, log text |
| `src/utils/squad.test.ts` (create) | Unit tests for the above |
| `src/types/index.ts` (modify) | `Creature.squad` |
| `src/context/CombatContext.tsx` (modify) | `SQUAD_HITS`, `SQUAD_AREA`, squad branches in damage/heal/update |
| `src/context/combatReducer.test.ts` (modify) | Reducer tests |
| `src/components/squads/SquadRowControls.tsx` (create) | Sidebar row: Hit × n, Heal, Area… |
| `src/components/squads/SquadAreaDialog.tsx` (create) | Area-effect dialog |
| `src/components/squads/SquadAttackPanel.tsx` (create) | The squad's turn: action, target, roll, apply |
| `src/components/squads/SquadTokenOverlay.tsx` (create) | Badge + ring, shared by both maps |
| `src/components/layout/Sidebar.tsx` (modify) | Add-as-squad switch, row display, edit Bodies field |
| `src/components/layout/RightPanel.tsx` (modify) | Mount `SquadAttackPanel`; bodies in the turn header |
| `src/components/battlefield/BattlefieldMap.tsx` (modify) | Mount overlay in `CreatureToken` |
| `src/components/battlefield/PlayerViewMap.tsx` (modify) | Mount overlay in the player-view creature token |
| `src/components/help/HelpGuide.tsx`, `src/data/changelog.ts` (modify) | Help section, v2.11.0 entry |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch**

```bash
cd "/Users/fortfamily/Documents/Andrew Stewart Fort/Projects/avernus-vehicle-combat"
git checkout main && git checkout -b feat/battle-mode-squads
```

(The controller does this before Task 1; it needs no review.)

---

### Task 1: Squad rules, part 1: damage parsing, group attacks, defenses, log text

**Files:**
- Create: `src/utils/squad.ts`
- Create: `src/utils/squad.test.ts`

**Interfaces:**
- Consumes: `Statblock`, `StatblockAction` from `src/types` (`StatblockAction = { name; description; attackBonus?; damage?: string; ... }`; `Statblock.damageResistances/Immunities/Vulnerabilities?: string[]`, `Statblock.actions?: StatblockAction[]`).
- Produces (later tasks rely on these exact names):
  - `type Roller = (sides: number) => number`
  - `interface DamagePart { count: number; sides: number; bonus: number; type: string }`
  - `DAMAGE_TYPES` (readonly tuple of 13 lower-case types)
  - `parseDamage(text: string): DamagePart[]`
  - `parseActionDamage(action: StatblockAction): DamagePart[]`
  - `parseMultiattackCount(statblock: Statblock): number`
  - `rollDamageParts(parts: DamagePart[], crit: boolean, roll: Roller): { type: string; amount: number }[]`
  - `interface AttackRoll { d20: number; total: number; hit: boolean; crit: boolean; damage: { type: string; amount: number }[] }`
  - `interface GroupAttackResult { rolls: AttackRoll[]; hits: number; crits: number; totalByType: Record<string, number>; total: number }`
  - `rollGroupAttack(args: { attackBonus: number; ac: number; damage: DamagePart[]; attacks: number; roll: Roller }): GroupAttackResult`
  - `adjustForDefenses(amount: number, type: string, statblock: Statblock, magical?: boolean): number`
  - `formatDamageTotals(totalByType: Record<string, number>): string`
  - `formatGroupAttack(args: { attackerName: string; actionName: string; ac: number; result: GroupAttackResult }): string`
  - `formatAttackRolls(result: GroupAttackResult): string`

- [ ] **Step 1: Write the failing tests** in `src/utils/squad.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  parseDamage, parseActionDamage, parseMultiattackCount, rollGroupAttack,
  adjustForDefenses, formatDamageTotals, formatGroupAttack, formatAttackRolls,
} from './squad';
import type { Statblock, StatblockAction } from '../types';

/** Scripted dice: returns the given values in order and throws if it runs out. */
const dice = (...values: number[]) => {
  const queue = [...values];
  return () => {
    if (queue.length === 0) throw new Error('out of dice');
    return queue.shift()!;
  };
};

const statblock = (over: Partial<Statblock> = {}) =>
  ({ name: 'Hobgoblin', ac: 18, maxHp: 11, abilities: { str: 13, dex: 12, con: 12, int: 10, wis: 10, cha: 9 }, actions: [], ...over }) as unknown as Statblock;

describe('parseDamage', () => {
  it('parses a single typed part', () => {
    expect(parseDamage('2d6+4 slashing')).toEqual([{ count: 2, sides: 6, bonus: 4, type: 'slashing' }]);
  });
  it('parses spaces, a negative bonus and a "plus" rider', () => {
    expect(parseDamage('1d8 - 1 piercing plus 2d6 fire')).toEqual([
      { count: 1, sides: 8, bonus: -1, type: 'piercing' },
      { count: 2, sides: 6, bonus: 0, type: 'fire' },
    ]);
  });
  it('leaves the type empty when the word is not a damage type', () => {
    expect(parseDamage('1d8+1 plus stuff')).toEqual([{ count: 1, sides: 8, bonus: 1, type: '' }]);
  });
  it('returns [] for text with no dice', () => {
    expect(parseDamage('1 piercing')).toEqual([]);
  });
});

describe('parseActionDamage', () => {
  const action = (description: string, damage?: string) => ({ name: 'Longsword', description, damage }) as StatblockAction;
  it('reads the Hit: clause, takes the first versatile option, and keeps types', () => {
    const a = action('Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.', '1d8+1');
    expect(parseActionDamage(a)).toEqual([{ count: 1, sides: 8, bonus: 1, type: 'slashing' }]);
  });
  it('reads a "plus" rider from the description', () => {
    const a = action('Hit: 10 (2d6 + 3) piercing damage plus 7 (2d6) fire damage.');
    expect(parseActionDamage(a)).toEqual([
      { count: 2, sides: 6, bonus: 3, type: 'piercing' },
      { count: 2, sides: 6, bonus: 0, type: 'fire' },
    ]);
  });
  it('falls back to the damage field (untyped Open5e dice)', () => {
    expect(parseActionDamage(action('Some text without a hit clause.', '1d6+2'))).toEqual([{ count: 1, sides: 6, bonus: 2, type: '' }]);
  });
  it('returns [] when nothing parses', () => {
    expect(parseActionDamage(action('Nothing here.'))).toEqual([]);
  });
});

describe('parseMultiattackCount', () => {
  const withMulti = (description: string) => statblock({ actions: [{ name: 'Multiattack', description }] as StatblockAction[] });
  it('reads number words', () => {
    expect(parseMultiattackCount(withMulti('The devil makes three melee attacks.'))).toBe(3);
    expect(parseMultiattackCount(withMulti('The orc makes two attacks with its greataxe.'))).toBe(2);
  });
  it('defaults to 1 with no Multiattack', () => {
    expect(parseMultiattackCount(statblock())).toBe(1);
  });
});

describe('rollGroupAttack', () => {
  const longsword = [{ count: 1, sides: 8, bonus: 1, type: 'slashing' }];
  it('a natural 1 misses even when the total meets AC', () => {
    const r = rollGroupAttack({ attackBonus: 20, ac: 10, damage: longsword, attacks: 1, roll: dice(1) });
    expect(r.hits).toBe(0);
    expect(r.rolls[0]).toEqual({ d20: 1, total: 21, hit: false, crit: false, damage: [] });
  });
  it('a natural 20 hits and crits below AC; crit doubles dice, not the bonus', () => {
    const r = rollGroupAttack({ attackBonus: 0, ac: 30, damage: longsword, attacks: 1, roll: dice(20, 5, 7) });
    expect(r.hits).toBe(1);
    expect(r.crits).toBe(1);
    expect(r.rolls[0].damage).toEqual([{ type: 'slashing', amount: 13 }]); // 5 + 7 + 1
  });
  it('rolls each attack in order and totals per damage type', () => {
    // attack 1: d20 15 (+3 = 18 vs 16) hit, 1d8 → 4; attack 2: d20 10 (13) miss; attack 3: d20 13 (16) hit, 1d8 → 8
    const r = rollGroupAttack({ attackBonus: 3, ac: 16, damage: longsword, attacks: 3, roll: dice(15, 4, 10, 13, 8) });
    expect(r.hits).toBe(2);
    expect(r.totalByType).toEqual({ slashing: 14 });
    expect(r.total).toBe(14);
  });
  it('damage never goes below 0 per part', () => {
    const r = rollGroupAttack({ attackBonus: 5, ac: 10, damage: [{ count: 1, sides: 4, bonus: -3, type: '' }], attacks: 1, roll: dice(15, 1) });
    expect(r.rolls[0].damage).toEqual([{ type: '', amount: 0 }]);
  });
});

describe('adjustForDefenses', () => {
  it('resistance halves rounding down, case-insensitive', () => {
    expect(adjustForDefenses(9, 'fire', statblock({ damageResistances: ['Fire'] }))).toBe(4);
  });
  it('immunity gives 0; vulnerability doubles', () => {
    expect(adjustForDefenses(9, 'poison', statblock({ damageImmunities: ['poison'] }))).toBe(0);
    expect(adjustForDefenses(9, 'cold', statblock({ damageVulnerabilities: ['cold'] }))).toBe(18);
  });
  it('untyped damage is unchanged', () => {
    expect(adjustForDefenses(9, '', statblock({ damageResistances: ['fire'] }))).toBe(9);
  });
  it('"nonmagical" resistance applies unless the attack is magical', () => {
    const devil = statblock({ damageResistances: ["bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered"] });
    expect(adjustForDefenses(9, 'slashing', devil)).toBe(4);
    expect(adjustForDefenses(9, 'slashing', devil, true)).toBe(9);
  });
});

describe('log text', () => {
  const result = rollGroupAttack({ attackBonus: 3, ac: 16, damage: [{ count: 1, sides: 8, bonus: 1, type: 'slashing' }], attacks: 3, roll: dice(20, 4, 2, 10, 1) });
  it('formatDamageTotals joins types and omits an empty type label', () => {
    expect(formatDamageTotals({ slashing: 38, fire: 12 })).toBe('38 slashing + 12 fire');
    expect(formatDamageTotals({ '': 7 })).toBe('7');
  });
  it('formatGroupAttack summarises', () => {
    // attack 1: nat 20 crit, 2d8 → 4 + 2 + 1 = 7; attack 2: 10 + 3 = 13 miss; attack 3: nat 1 miss
    expect(formatGroupAttack({ attackerName: 'Hobgoblin ×10 (A)', actionName: 'Longsword', ac: 16, result }))
      .toBe('Hobgoblin ×10 (A) — Longsword: 3 attacks vs AC 16 → 1 hit (1 crit) → 7 slashing');
  });
  it('formatGroupAttack with no hits', () => {
    const miss = rollGroupAttack({ attackBonus: 0, ac: 30, damage: [], attacks: 1, roll: dice(2) });
    expect(formatGroupAttack({ attackerName: 'A', actionName: 'Bite', ac: 30, result: miss })).toBe('A — Bite: 1 attack vs AC 30 → no hits');
  });
  it('formatAttackRolls lists each roll', () => {
    expect(formatAttackRolls(result)).toBe('20 crit: 7 slashing; 10 (13) miss; 1 miss');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/squad.test.ts`
Expected: FAIL (cannot resolve `./squad`).

- [ ] **Step 3: Write the implementation** in `src/utils/squad.ts`

```ts
/**
 * Battle mode squads (spec: docs/superpowers/specs/2026-10-19-battle-mode-squads-design.md).
 * Pure rules only. Dice come in through `roll` so tests are deterministic.
 */
import type { Statblock, StatblockAction } from '../types';

export type Roller = (sides: number) => number;

export interface DamagePart {
  count: number; // dice count (0 = flat damage)
  sides: number;
  bonus: number;
  type: string; // lower-case damage type, '' when unknown
}

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
] as const;

const asType = (word: string | undefined): string => {
  const w = (word ?? '').toLowerCase();
  return (DAMAGE_TYPES as readonly string[]).includes(w) ? w : '';
};

const toPart = (count: string, sides: string, sign: string | undefined, bonus: string | undefined, type: string | undefined): DamagePart => ({
  count: Number(count),
  sides: Number(sides),
  bonus: bonus ? (sign === '-' ? -1 : 1) * Number(bonus) : 0,
  type: asType(type),
});

/** "2d6+4 slashing", "1d8 + 1 piercing plus 2d6 fire" → parts. [] when nothing parses. */
export function parseDamage(text: string): DamagePart[] {
  const re = /(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?(?:\s+([a-z]+))?/gi;
  return [...text.matchAll(re)].map((m) => toPart(m[1], m[2], m[3], m[4], m[5]));
}

/**
 * Damage for one hit of a statblock action. Prefers the description's "Hit:" clause (it carries damage
 * types and "plus" riders; only the first "or" option counts), else the `damage` field.
 */
export function parseActionDamage(action: StatblockAction): DamagePart[] {
  const hit = action.description?.split(/Hit:/i)[1];
  if (hit) {
    const firstOption = hit.split(/\bor\b/i)[0];
    const re = /\((\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?\)\s*([a-z]+)\s+damage/gi;
    const parts = [...firstOption.matchAll(re)].map((m) => toPart(m[1], m[2], m[3], m[4], m[5]));
    if (parts.length > 0) return parts;
  }
  return action.damage ? parseDamage(action.damage) : [];
}

const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Attacks per body from "makes two/three… attacks" in Multiattack; 1 otherwise. VVTT rule (default only). */
export function parseMultiattackCount(statblock: Statblock): number {
  const multi = statblock.actions?.find((a) => /multiattack/i.test(a.name));
  const m = multi?.description?.match(/makes (\w+)/i);
  if (!m) return 1;
  const word = m[1].toLowerCase();
  const n = COUNT_WORDS[word] ?? Number(word);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function rollDamageParts(parts: DamagePart[], crit: boolean, roll: Roller): { type: string; amount: number }[] {
  return parts.map((p) => {
    let sum = p.bonus;
    const diceCount = crit ? p.count * 2 : p.count;
    for (let i = 0; i < diceCount; i++) sum += roll(p.sides);
    return { type: p.type, amount: Math.max(0, sum) };
  });
}

export interface AttackRoll {
  d20: number;
  total: number;
  hit: boolean;
  crit: boolean;
  damage: { type: string; amount: number }[];
}

export interface GroupAttackResult {
  rolls: AttackRoll[];
  hits: number;
  crits: number;
  totalByType: Record<string, number>;
  total: number;
}

/** Rolls every attack (PHB): nat 20 hits and crits, nat 1 misses, else total >= AC. Dice order: d20, then that hit's damage. */
export function rollGroupAttack({ attackBonus, ac, damage, attacks, roll }: {
  attackBonus: number; ac: number; damage: DamagePart[]; attacks: number; roll: Roller;
}): GroupAttackResult {
  const rolls: AttackRoll[] = [];
  for (let i = 0; i < attacks; i++) {
    const d20 = roll(20);
    const total = d20 + attackBonus;
    const crit = d20 === 20;
    const hit = crit || (d20 !== 1 && total >= ac);
    rolls.push({ d20, total, hit, crit, damage: hit ? rollDamageParts(damage, crit, roll) : [] });
  }
  const totalByType: Record<string, number> = {};
  for (const r of rolls) for (const d of r.damage) totalByType[d.type] = (totalByType[d.type] ?? 0) + d.amount;
  return {
    rolls,
    hits: rolls.filter((r) => r.hit).length,
    crits: rolls.filter((r) => r.crit).length,
    totalByType,
    total: Object.values(totalByType).reduce((a, b) => a + b, 0),
  };
}

/** PHB: immunity → 0, resistance → half (round down), vulnerability → double. "nonmagical" entries skip magical attacks. */
export function adjustForDefenses(amount: number, type: string, statblock: Statblock, magical = false): number {
  if (!type) return amount;
  const has = (list?: string[]) => (list ?? []).some((entry) => {
    const e = entry.toLowerCase();
    return e.includes(type) && !(magical && e.includes('nonmagical'));
  });
  if (has(statblock.damageImmunities)) return 0;
  let result = amount;
  if (has(statblock.damageResistances)) result = Math.floor(result / 2);
  if (has(statblock.damageVulnerabilities)) result *= 2;
  return result;
}

export function formatDamageTotals(totalByType: Record<string, number>): string {
  return Object.entries(totalByType).map(([type, amount]) => (type ? `${amount} ${type}` : `${amount}`)).join(' + ');
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Hobgoblin ×10 (A) — Longsword: 10 attacks vs AC 16 → 4 hits (1 crit) → 38 slashing" */
export function formatGroupAttack({ attackerName, actionName, ac, result }: {
  attackerName: string; actionName: string; ac: number; result: GroupAttackResult;
}): string {
  const head = `${attackerName} — ${actionName}: ${plural(result.rolls.length, 'attack')} vs AC ${ac}`;
  if (result.hits === 0) return `${head} → no hits`;
  const crits = result.crits > 0 ? ` (${plural(result.crits, 'crit')})` : '';
  return `${head} → ${plural(result.hits, 'hit')}${crits} → ${formatDamageTotals(result.totalByType)}`;
}

/** "20 crit: 7 slashing; 10 (13) miss; 1 miss" */
export function formatAttackRolls(result: GroupAttackResult): string {
  return result.rolls.map((r) => {
    const dmg = formatDamageTotals(Object.fromEntries(r.damage.map((d) => [d.type, d.amount])));
    if (r.crit) return `20 crit: ${dmg}`;
    if (r.d20 === 1) return '1 miss';
    return r.hit ? `${r.d20} (${r.total}) hit: ${dmg}` : `${r.d20} (${r.total}) miss`;
  }).join('; ');
}
```

Note: `formatAttackRolls` builds a per-roll type map with `Object.fromEntries`. Two parts of the same type in one hit (rare) would collapse to the last one. Accept that: it only affects the detail text, never the totals.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/squad.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Type-check, lint, commit**

```bash
npx tsc --noEmit && npx eslint src/utils/squad.ts src/utils/squad.test.ts
git add src/utils/squad.ts src/utils/squad.test.ts
git commit -m "Squad rules: damage parsing, group attack rolls, defenses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Squad rules, part 2: bodies, area effects, healing, naming

**Files:**
- Modify: `src/utils/squad.ts` (append)
- Modify: `src/utils/squad.test.ts` (append)
- Modify: `src/types/index.ts` (add `Creature.squad`; needed so `squad.ts` type-checks)

**Interfaces:**
- Consumes: `adjustForDefenses`, `Roller` (Task 1); `Creature`, `Statblock`, `AbilityName` from `src/types`.
- Produces:
  - `Creature.squad?: { size: number; bodies: number }` in `src/types/index.ts`
  - `applySquadHits(creature: Creature, hits: number[]): { currentHp: number; bodies: number; fell: number }`
  - `type AoeShape = 'cone' | 'cube' | 'cylinder' | 'line' | 'sphere'`
  - `AOE_SHAPES: { value: AoeShape; label: string; sizeLabel: string }[]`
  - `aoeTargetCount(shape: AoeShape, size: number): number`
  - `saveBonus(statblock: Statblock, ability: AbilityName): number`
  - `interface AreaSave { d20: number; total: number; success: boolean; taken: number; fell: boolean }`
  - `interface SquadAreaResult { saves: AreaSave[]; currentHp: number; bodies: number; fell: number }`
  - `resolveSquadArea(args: { creature: Creature; caught: number; dc: number; ability: AbilityName; damage: number; halfOnSave: boolean; damageType: string; magical?: boolean; roll: Roller }): SquadAreaResult`
  - `healSquad(creature: Creature, amount: number): number`
  - `normalizeSquad(prev: Creature, next: Creature): { currentHp: number; squad: Creature['squad'] }`
  - `nextSquadName(baseName: string, qty: number, creatures: Creature[]): string`
  - `formatSquadTally(bodies: number, size: number): string`
  - `formatSquadHits(name: string, hitCount: number, fell: number, bodies: number, size: number): string`
  - `formatAreaSummary(source: string, result: SquadAreaResult, size: number): string`

- [ ] **Step 1: Add the type** to `Creature` in `src/types/index.ts`, after `notes?: string;`:

```ts
  /** Battle mode: this creature stands for a squad of identical bodies. Front body HP = currentHp. */
  squad?: { size: number; bodies: number };
```

- [ ] **Step 2: Write the failing tests** (append to `src/utils/squad.test.ts`; add the new names to the import from `./squad`, and `Creature` to the type import)

```ts
import {
  applySquadHits, aoeTargetCount, saveBonus, resolveSquadArea, healSquad, normalizeSquad,
  nextSquadName, formatSquadHits, formatAreaSummary,
} from './squad';
import type { Creature } from '../types';

const squad = (bodies: number, currentHp: number, size = 10, over: Partial<Statblock> = {}) =>
  ({ id: 's', name: 'Hobgoblin ×10 (A)', currentHp, statblock: statblock(over), squad: { size, bodies } }) as unknown as Creature;

describe('applySquadHits (front body only; overkill lost)', () => {
  it('a non-lethal hit wounds the front body', () => {
    expect(applySquadHits(squad(10, 11), [4])).toEqual({ currentHp: 7, bodies: 10, fell: 0 });
  });
  it('an exactly lethal hit drops one body; the next steps up at full HP', () => {
    expect(applySquadHits(squad(10, 7), [7])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('overkill is lost: a 100-damage hit drops one body', () => {
    expect(applySquadHits(squad(10, 11), [100])).toEqual({ currentHp: 11, bodies: 9, fell: 1 });
  });
  it('several hits walk through bodies in order; zero hits are ignored', () => {
    // 5 drops body 1 (next at 11); 0 ignored; 4 → 7; 11 drops body 2 (next at 11); 3 → 8
    expect(applySquadHits(squad(3, 5), [5, 0, 4, 11, 3])).toEqual({ currentHp: 8, bodies: 1, fell: 2 });
  });
  it('the last body falls → bodies 0, currentHp 0; extra hits do nothing', () => {
    expect(applySquadHits(squad(1, 3), [3, 9])).toEqual({ currentHp: 0, bodies: 0, fell: 1 });
  });
});

describe('aoeTargetCount (DMG p. 249)', () => {
  it.each([
    ['cone', 15, 2], ['cone', 60, 6], ['cube', 10, 2], ['cube', 12, 3],
    ['cylinder', 10, 2], ['line', 100, 4], ['line', 30, 1], ['sphere', 20, 4], ['sphere', 0, 0],
  ] as const)('%s %i ft → %i', (shape, size, expected) => {
    expect(aoeTargetCount(shape, size)).toBe(expected);
  });
});

describe('saveBonus', () => {
  it('uses the saving throw when listed, else the ability modifier', () => {
    expect(saveBonus(statblock({ savingThrows: { dex: 5 } }), 'dex')).toBe(5);
    expect(saveBonus(statblock(), 'dex')).toBe(1); // DEX 12
    expect(saveBonus(statblock(), 'cha')).toBe(-1); // CHA 9
  });
});

describe('resolveSquadArea', () => {
  // DEX 12 → +1. DC 15. 20 damage, half on save.
  const base = { dc: 15, ability: 'dex' as const, damage: 20, halfOnSave: true, damageType: 'fire' };
  it('front body is caught first; failures fall; the lowest damaged survivor becomes the front', () => {
    // 3 caught: front (7 HP) saves 14+1=15 → takes 10 → falls; body 2 rolls 2 → fails, 20 → falls;
    // body 3 rolls 19 → saves, takes 10 → survives at 1.
    const r = resolveSquadArea({ ...base, creature: squad(10, 7), caught: 3, roll: dice(14, 2, 19) });
    expect(r.saves.map((s) => [s.success, s.taken, s.fell])).toEqual([[true, 10, true], [false, 20, true], [true, 10, false]]);
    expect(r).toMatchObject({ bodies: 8, fell: 2, currentHp: 1 });
  });
  it('when every caught body falls, the next uncaught body is at full HP', () => {
    const r = resolveSquadArea({ ...base, creature: squad(5, 11), caught: 2, roll: dice(3, 4) });
    expect(r).toMatchObject({ bodies: 3, fell: 2, currentHp: 11 });
  });
  it('resistance applies to each body, after halving', () => {
    const r = resolveSquadArea({ ...base, creature: squad(2, 11, 10, { damageResistances: ['fire'] }), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(5); // 20 → 10 (save) → 5 (resist)
    expect(r.currentHp).toBe(6);
  });
  it('caught is capped at the bodies left', () => {
    const r = resolveSquadArea({ ...base, creature: squad(2, 11), caught: 6, roll: dice(1, 1) });
    expect(r.saves).toHaveLength(2);
    expect(r).toMatchObject({ bodies: 0, currentHp: 0, fell: 2 });
  });
  it('no damage on a save when halfOnSave is off', () => {
    const r = resolveSquadArea({ ...base, halfOnSave: false, creature: squad(2, 11), caught: 1, roll: dice(20) });
    expect(r.saves[0].taken).toBe(0);
    expect(r.currentHp).toBe(11);
  });
});

describe('healSquad (never revives)', () => {
  it('caps the front body at max HP', () => {
    expect(healSquad(squad(4, 6), 20)).toBe(11);
  });
  it('does nothing at 0 bodies', () => {
    expect(healSquad(squad(0, 0), 5)).toBe(0);
  });
});

describe('normalizeSquad', () => {
  it('0 bodies forces 0 HP', () => {
    expect(normalizeSquad(squad(3, 5), squad(0, 5))).toEqual({ currentHp: 0, squad: { size: 10, bodies: 0 } });
  });
  it('raising bodies from 0 restores the front body to full HP', () => {
    expect(normalizeSquad(squad(0, 0), squad(4, 0))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 4 } });
  });
  it('HP set to 0 with bodies left means the front body fell', () => {
    expect(normalizeSquad(squad(4, 6), squad(4, 0))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 3 } });
    expect(normalizeSquad(squad(1, 6), squad(1, 0))).toEqual({ currentHp: 0, squad: { size: 10, bodies: 0 } });
  });
  it('clamps bodies to 0..size and HP to max', () => {
    expect(normalizeSquad(squad(4, 6), squad(14, 40))).toEqual({ currentHp: 11, squad: { size: 10, bodies: 10 } });
  });
  it('leaves a consistent squad unchanged, and passes non-squads through', () => {
    expect(normalizeSquad(squad(4, 6), squad(4, 6))).toEqual({ currentHp: 6, squad: { size: 10, bodies: 4 } });
    const solo = { currentHp: 3, statblock: statblock() } as unknown as Creature;
    expect(normalizeSquad(solo, solo)).toEqual({ currentHp: 3, squad: undefined });
  });
});

describe('naming and log text', () => {
  it('nextSquadName lettering counts existing squads of the same monster', () => {
    const existing = [squad(10, 11), { name: 'Hobgoblin 3' } as Creature, { name: 'Hobgoblin ×5 (B)', squad: { size: 5, bodies: 5 } } as Creature];
    expect(nextSquadName('Hobgoblin', 8, [])).toBe('Hobgoblin ×8 (A)');
    expect(nextSquadName('Hobgoblin', 8, existing)).toBe('Hobgoblin ×8 (C)');
  });
  it('formatSquadHits', () => {
    expect(formatSquadHits('Hob (A)', 3, 2, 8, 10)).toBe('Hob (A) takes 3 hits: 2 fall (8/10)');
    expect(formatSquadHits('Hob (A)', 1, 0, 8, 10)).toBe('Hob (A) takes 1 hit: none fall (8/10)');
    expect(formatSquadHits('Hob (A)', 2, 1, 0, 10)).toBe('Hob (A) takes 2 hits: 1 fall (0/10) — squad destroyed');
  });
  it('formatAreaSummary', () => {
    const r = resolveSquadArea({ creature: squad(10, 11), caught: 4, dc: 15, ability: 'dex', damage: 28, halfOnSave: true, damageType: 'fire', roll: dice(2, 3, 4, 20) });
    expect(formatAreaSummary('Fireball', r, 10)).toBe('Fireball: 4 caught, 3 failed → 4 fall (6/10)');
  });
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run src/utils/squad.test.ts`
Expected: FAIL (new exports missing).

- [ ] **Step 4: Append the implementation** to `src/utils/squad.ts` (and extend the type import to `import type { AbilityName, Creature, Statblock, StatblockAction } from '../types';`)

```ts
// ==========================================
// Bodies (VVTT rule: front body = currentHp)
// ==========================================

/** Single-target hits, in order: each hit damages only the front body; a body that falls loses its overkill. */
export function applySquadHits(creature: Creature, hits: number[]): { currentHp: number; bodies: number; fell: number } {
  const max = creature.statblock.maxHp;
  let currentHp = creature.currentHp;
  let bodies = creature.squad?.bodies ?? 0;
  let fell = 0;
  for (const hit of hits) {
    if (bodies === 0) break;
    if (hit <= 0) continue;
    if (hit >= currentHp) {
      bodies -= 1;
      fell += 1;
      currentHp = bodies > 0 ? max : 0;
    } else {
      currentHp -= hit;
    }
  }
  return { currentHp, bodies, fell };
}

// ==========================================
// Area effects (DMG p. 249, Targets in Areas of Effect)
// ==========================================

export type AoeShape = 'cone' | 'cube' | 'cylinder' | 'line' | 'sphere';

export const AOE_SHAPES: { value: AoeShape; label: string; sizeLabel: string }[] = [
  { value: 'cone', label: 'Cone', sizeLabel: 'Size (ft)' },
  { value: 'cube', label: 'Cube or square', sizeLabel: 'Size (ft)' },
  { value: 'cylinder', label: 'Cylinder', sizeLabel: 'Radius (ft)' },
  { value: 'line', label: 'Line', sizeLabel: 'Length (ft)' },
  { value: 'sphere', label: 'Sphere or circle', sizeLabel: 'Radius (ft)' },
];

const AOE_DIVISOR: Record<AoeShape, number> = { cone: 10, cube: 5, cylinder: 5, line: 30, sphere: 5 };

/** DMG p. 249: suggested number of targets caught (round up). */
export function aoeTargetCount(shape: AoeShape, size: number): number {
  return size > 0 ? Math.ceil(size / AOE_DIVISOR[shape]) : 0;
}

export function saveBonus(statblock: Statblock, ability: AbilityName): number {
  return statblock.savingThrows?.[ability] ?? Math.floor(((statblock.abilities?.[ability] ?? 10) - 10) / 2);
}

export interface AreaSave { d20: number; total: number; success: boolean; taken: number; fell: boolean }
export interface SquadAreaResult { saves: AreaSave[]; currentHp: number; bodies: number; fell: number }

/**
 * Area damage is rolled once (passed in as `damage`); each caught body rolls its own save.
 * The wounded front body is caught first, then fresh bodies. VVTT rule: of the damaged survivors,
 * the one with the lowest HP becomes the front body; damage to other survivors is dropped.
 */
export function resolveSquadArea({ creature, caught, dc, ability, damage, halfOnSave, damageType, magical = false, roll }: {
  creature: Creature; caught: number; dc: number; ability: AbilityName; damage: number;
  halfOnSave: boolean; damageType: string; magical?: boolean; roll: Roller;
}): SquadAreaResult {
  const max = creature.statblock.maxHp;
  const startBodies = creature.squad?.bodies ?? 0;
  const n = Math.max(0, Math.min(caught, startBodies));
  const bonus = saveBonus(creature.statblock, ability);
  const saves: AreaSave[] = [];
  const survivorsHp: number[] = [];
  for (let i = 0; i < n; i++) {
    const hpBefore = i === 0 ? creature.currentHp : max;
    const d20 = roll(20);
    const total = d20 + bonus;
    const success = total >= dc;
    const raw = success ? (halfOnSave ? Math.floor(damage / 2) : 0) : damage;
    const taken = adjustForDefenses(raw, damageType, creature.statblock, magical);
    const fell = taken >= hpBefore;
    if (!fell) survivorsHp.push(hpBefore - taken);
    saves.push({ d20, total, success, taken, fell });
  }
  const fell = saves.filter((s) => s.fell).length;
  const bodies = startBodies - fell;
  if (n === 0) return { saves, currentHp: creature.currentHp, bodies, fell };
  const currentHp = bodies === 0 ? 0 : survivorsHp.length > 0 ? Math.min(...survivorsHp) : max;
  return { saves, currentHp, bodies, fell };
}

/** Healing restores the front body only and never brings back fallen bodies. */
export function healSquad(creature: Creature, amount: number): number {
  if ((creature.squad?.bodies ?? 0) === 0) return creature.currentHp;
  return Math.min(creature.statblock.maxHp, creature.currentHp + Math.max(0, amount));
}

/**
 * Keeps a squad consistent after a manual update: bodies within 0..size; 0 bodies ⇔ 0 HP;
 * raising bodies from 0 restores a full front body; HP set to 0 with bodies left means the front body fell.
 */
export function normalizeSquad(prev: Creature, next: Creature): { currentHp: number; squad: Creature['squad'] } {
  if (!next.squad) return { currentHp: next.currentHp, squad: next.squad };
  const max = next.statblock.maxHp;
  const size = next.squad.size;
  let bodies = Math.max(0, Math.min(next.squad.bodies, size));
  let currentHp = Math.min(next.currentHp, max);
  if (bodies === 0) {
    currentHp = 0;
  } else if (currentHp <= 0) {
    const wasWiped = (prev.squad?.bodies ?? 0) === 0;
    if (!wasWiped) bodies -= 1;
    currentHp = bodies > 0 ? max : 0;
  }
  return { currentHp, squad: { size, bodies } };
}

// ==========================================
// Naming and log text
// ==========================================

/** "Hobgoblin ×10 (A)": the letter counts existing squads of the same monster. */
export function nextSquadName(baseName: string, qty: number, creatures: Creature[]): string {
  const existing = creatures.filter((c) => c.squad && c.name.startsWith(`${baseName} ×`)).length;
  return `${baseName} ×${qty} (${String.fromCharCode(65 + (existing % 26))})`;
}

export function formatSquadTally(bodies: number, size: number): string {
  return bodies === 0 ? `(0/${size}) — squad destroyed` : `(${bodies}/${size})`;
}

const fallText = (fell: number) => (fell === 0 ? 'none fall' : `${fell} fall`);

export function formatSquadHits(name: string, hitCount: number, fell: number, bodies: number, size: number): string {
  return `${name} takes ${hitCount} hit${hitCount === 1 ? '' : 's'}: ${fallText(fell)} ${formatSquadTally(bodies, size)}`;
}

/** "Fireball: 4 caught, 3 failed → 4 fall (6/10)" */
export function formatAreaSummary(source: string, result: SquadAreaResult, size: number): string {
  const failed = result.saves.filter((s) => !s.success).length;
  return `${source}: ${result.saves.length} caught, ${failed} failed → ${fallText(result.fell)} ${formatSquadTally(result.bodies, size)}`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/utils/squad.test.ts`
Expected: PASS.

Check against the `formatAreaSummary` test: 28 damage, DEX +1, DC 15.
- Front body (11): rolls 2 → total 3, fails, takes 28 → falls.
- Second body: 3 → 4, fails → falls.
- Third body: 4 → 5, fails → falls.
- Fourth body: 20 → 21, saves, takes 14 ≥ 11 → falls.

That gives 4 fall, 3 failed, 6/10.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npx tsc --noEmit && npx eslint src/utils/squad.ts src/utils/squad.test.ts src/types/index.ts
git add src/utils/squad.ts src/utils/squad.test.ts src/types/index.ts
git commit -m "Squad rules: body loss, DMG area-of-effect table, saves, healing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reducer support

**Files:**
- Modify: `src/context/CombatContext.tsx` (action union near line 114; `UPDATE_CREATURE` ~584; `DEAL_DAMAGE_TO_CREATURE` ~1152; `HEAL_CREATURE` ~1208; a helper next to `createLogEntry` ~1718)
- Modify: `src/context/combatReducer.test.ts` (append)

**Interfaces:**
- Consumes: `applySquadHits`, `healSquad`, `normalizeSquad`, `formatSquadHits` from `../utils/squad` (Task 2).
- Produces (UI tasks dispatch these):
  - `{ type: 'SQUAD_HITS'; payload: { creatureId: string; hits: number[]; source?: string } }`: `hits` are final per-hit damage (defenses already applied).
  - `{ type: 'SQUAD_AREA'; payload: { creatureId: string; currentHp: number; bodies: number; summary: string; details?: string } }`

- [ ] **Step 1: Write the failing tests** (append to `src/context/combatReducer.test.ts`)

```ts
describe('battle mode squads', () => {
  const hob = (id: string, bodies: number, currentHp: number, size = 10) => ({
    id, name: `Hob ${id}`, currentHp, tempHp: 0, conditions: [], initiative: 10, initiativeModifier: 1, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp: 11, ac: 18 }, squad: { size, bodies },
  }) as unknown as Creature;
  const solo = (id: string, currentHp: number) => ({
    id, name: id, currentHp, tempHp: 2, conditions: [], initiative: 5, initiativeModifier: 0, faction: 'enemy',
    statblock: { type: 'humanoid', maxHp: 20, ac: 12 },
  }) as unknown as Creature;
  const withCreatures = (...creatures: Creature[]) => ({ ...initialCombatState, round: 1, creatures });

  it('SQUAD_HITS drops bodies and logs', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), { type: 'SQUAD_HITS', payload: { creatureId: 'a', hits: [11, 4], source: 'Bitter Breath' } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 7, squad: { size: 10, bodies: 9 } });
    expect(out.actionLog.at(-1)).toMatchObject({ type: 'damage', action: 'Hob a takes 2 hits: 1 fall (9/10)', details: 'Bitter Breath' });
  });

  it('SQUAD_AREA stores the resolved result and logs the summary', () => {
    const out = combatReducer(withCreatures(hob('a', 10, 11)), {
      type: 'SQUAD_AREA', payload: { creatureId: 'a', currentHp: 1, bodies: 6, summary: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' },
    });
    expect(out.creatures[0]).toMatchObject({ currentHp: 1, squad: { bodies: 6 } });
    expect(out.actionLog.at(-1)).toMatchObject({ action: 'Fireball: 4 caught, 3 failed → 4 fall (6/10)', details: 'saves…' });
  });

  it('DEAL_DAMAGE_TO_CREATURE on a squad is one hit (overkill lost)', () => {
    const out = combatReducer(withCreatures(hob('a', 3, 11)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 2 } });
  });

  it('HEAL_CREATURE heals the front body and never revives', () => {
    const healed = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 50 } });
    expect(healed.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 3 } });
    const wiped = combatReducer(withCreatures(hob('a', 0, 0)), { type: 'HEAL_CREATURE', payload: { creatureId: 'a', amount: 5 } });
    expect(wiped.creatures[0]).toMatchObject({ currentHp: 0, squad: { bodies: 0 } });
  });

  it('UPDATE_CREATURE keeps the bodies/HP invariant', () => {
    const zero = combatReducer(withCreatures(hob('a', 3, 4)), { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { squad: { size: 10, bodies: 0 } } } });
    expect(zero.creatures[0].currentHp).toBe(0);
    const back = combatReducer(zero, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { squad: { size: 10, bodies: 5 } } } });
    expect(back.creatures[0]).toMatchObject({ currentHp: 11, squad: { bodies: 5 } });
    const init = combatReducer(back, { type: 'UPDATE_CREATURE', payload: { id: 'a', updates: { initiative: 17 } } });
    expect(init.creatures[0]).toMatchObject({ initiative: 17, currentHp: 11, squad: { bodies: 5 } });
  });

  it('a wiped squad is skipped in turn order like a dead NPC', () => {
    const s = { ...withCreatures(solo('x', 20), hob('a', 0, 0), solo('y', 20)), phase: 'combat' as const, initiativeOrder: ['x', 'a', 'y'], currentTurnIndex: 0 };
    const out = combatReducer(s, { type: 'NEXT_TURN' });
    expect(out.initiativeOrder[out.currentTurnIndex]).toBe('y');
  });

  it('creatures without squad behave as before (temp HP absorbs first; HP clamps to 0)', () => {
    const out = combatReducer(withCreatures(solo('x', 20)), { type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: 'x', amount: 25 } });
    expect(out.creatures[0]).toMatchObject({ currentHp: 0, tempHp: 0 });
    expect(out.creatures[0].squad).toBeUndefined();
    const healed = combatReducer(out, { type: 'HEAL_CREATURE', payload: { creatureId: 'x', amount: 5 } });
    expect(healed.creatures[0].currentHp).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/context/combatReducer.test.ts`
Expected: the new SQUAD_* tests fail (type errors or unhandled actions); the existing tests still pass.

- [ ] **Step 3: Implement.** In `src/context/CombatContext.tsx`:

(a) Import the squad rules next to the other `../utils` imports:

```ts
import { applySquadHits, healSquad, normalizeSquad, formatSquadHits } from '../utils/squad';
```

(b) Add to the `CombatAction` union, after the `DEAL_DAMAGE_TO_CREATURE` member:

```ts
  | { type: 'SQUAD_HITS'; payload: { creatureId: string; hits: number[]; source?: string } }
  | { type: 'SQUAD_AREA'; payload: { creatureId: string; currentHp: number; bodies: number; summary: string; details?: string } }
```

(c) Add this helper directly after the `createLogEntry` function:

```ts
/** Battle mode: single-target hits on a squad (front body only; overkill lost). */
function applySquadHitsToState(state: CombatState, creature: Creature, hits: number[], source?: string): CombatState {
  const size = creature.squad?.size ?? 0;
  const result = applySquadHits(creature, hits);
  return {
    ...state,
    creatures: state.creatures.map((c) =>
      c.id === creature.id ? { ...c, currentHp: result.currentHp, squad: { size, bodies: result.bodies } } : c
    ),
    actionLog: [
      ...state.actionLog,
      createLogEntry(state.round, 'damage', formatSquadHits(creature.name, hits.length, result.fell, result.bodies, size), source),
    ],
  };
}
```

(d) In `case 'UPDATE_CREATURE'`, replace `const updates = action.payload.updates;` with:

```ts
      let updates = action.payload.updates;
      if (creature.squad || updates.squad) {
        updates = { ...updates, ...normalizeSquad(creature, { ...creature, ...updates }) };
      }
```

(The rest of the case already reads `updates.currentHp`, so the "incapacitated at station" log keeps working.)

(e) In `case 'DEAL_DAMAGE_TO_CREATURE'`, directly after `if (!creature) return state;` add:

```ts
      if (creature.squad) {
        return applySquadHitsToState(state, creature, [action.payload.amount], action.payload.source);
      }
```

(f) In `case 'HEAL_CREATURE'`, replace the `newHp` computation with:

```ts
      const newHp = creature.squad
        ? healSquad(creature, action.payload.amount)
        : Math.min(creature.statblock.maxHp, creature.currentHp + action.payload.amount);
```

(g) Add the two new cases directly after `case 'HEAL_CREATURE'`:

```ts
    case 'SQUAD_HITS': {
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);
      if (!creature?.squad) return state;
      return applySquadHitsToState(state, creature, action.payload.hits, action.payload.source);
    }

    case 'SQUAD_AREA': {
      const creature = state.creatures.find((c) => c.id === action.payload.creatureId);
      if (!creature?.squad) return state;
      const next = normalizeSquad(creature, {
        ...creature,
        currentHp: action.payload.currentHp,
        squad: { ...creature.squad, bodies: action.payload.bodies },
      });
      return {
        ...state,
        creatures: state.creatures.map((c) => (c.id === creature.id ? { ...c, ...next } : c)),
        actionLog: [...state.actionLog, createLogEntry(state.round, 'damage', action.payload.summary, action.payload.details)],
      };
    }
```

Squads ignore temp HP (spec decision 11). There is no temp-HP control in the UI today, so nothing needs hiding; the squad branch in (e) bypasses `tempHp`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/context/combatReducer.test.ts src/utils/squad.test.ts`
Expected: PASS. If the `NEXT_TURN` test fails only because `initialCombatState` lacks a field the case reads, set that field in the test state; do not change `NEXT_TURN`.

- [ ] **Step 5: Full suite, type-check, lint, commit**

```bash
npm test && npx tsc --noEmit && npx eslint src/context/CombatContext.tsx src/context/combatReducer.test.ts
git add src/context/CombatContext.tsx src/context/combatReducer.test.ts
git commit -m "Reducer: squad hits, area results, squad-aware damage/heal/update

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sidebar: add as squad, squad row, Hit/Heal/Area, edit Bodies

**Files:**
- Create: `src/components/squads/SquadRowControls.tsx`
- Create: `src/components/squads/SquadAreaDialog.tsx`
- Modify: `src/components/layout/Sidebar.tsx`:
  - `addQuantity` state ~301;
  - `handleAddOpen5eMonster` ~354;
  - `startEdit` / `saveEdit` ~471–511;
  - the NPC `CreatureEntry` `editState` prop ~973;
  - the quantity stepper UI ~1120–1145;
  - `CreatureEntryProps` / `CreatureEntry` ~1252–1600.

**Interfaces:**
- Consumes:
  - from `src/utils/squad`: `adjustForDefenses`, `DAMAGE_TYPES`, `nextSquadName`, `AOE_SHAPES`, `AoeShape`, `aoeTargetCount`, `resolveSquadArea`, `formatAreaSummary`;
  - `rollDie(sides)` and `roll(notation).total` from `src/utils/diceEngine`;
  - actions `SQUAD_HITS`, `SQUAD_AREA`, `HEAL_CREATURE`;
  - `useCombat()` → `{ state, dispatch }`.
- Produces:
  - `<SquadRowControls creature={Creature} />`
  - `<SquadAreaDialog creature={Creature} open={boolean} onClose={() => void} />`

- [ ] **Step 1: Create `src/components/squads/SquadAreaDialog.tsx`**

```tsx
import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem,
  FormControlLabel, Switch, Typography, Table, TableBody, TableRow, TableCell,
} from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { AbilityName, Creature } from '../../types';
import {
  AOE_SHAPES, aoeTargetCount, resolveSquadArea, formatAreaSummary, DAMAGE_TYPES,
  type AoeShape, type SquadAreaResult,
} from '../../utils/squad';
import { rollDie, roll } from '../../utils/diceEngine';

const ABILITIES: AbilityName[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Plain integer, or dice notation rolled once (area damage is rolled once for every creature caught). */
function resolveDamage(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (/\d+\s*d\s*\d+/i.test(t)) return roll(t.replace(/\s+/g, '')).total;
  return null;
}

export function SquadAreaDialog({ creature, open, onClose }: { creature: Creature; open: boolean; onClose: () => void }) {
  const { dispatch } = useCombat();
  const bodies = creature.squad?.bodies ?? 0;
  const [source, setSource] = useState('Area effect');
  const [shape, setShape] = useState<AoeShape>('sphere');
  const [size, setSize] = useState(20);
  const [caughtOverride, setCaughtOverride] = useState<number | null>(null);
  const [ability, setAbility] = useState<AbilityName>('dex');
  const [dc, setDc] = useState(15);
  const [damageText, setDamageText] = useState('8d6');
  const [damageType, setDamageType] = useState('');
  const [halfOnSave, setHalfOnSave] = useState(true);
  const [result, setResult] = useState<{ damage: number; area: SquadAreaResult } | null>(null);

  const suggested = Math.min(aoeTargetCount(shape, size), bodies);
  const caught = Math.min(caughtOverride ?? suggested, bodies);
  const damagePreview = resolveDamage(damageText);
  const sizeLabel = AOE_SHAPES.find((s) => s.value === shape)?.sizeLabel ?? 'Size (ft)';

  const handleApply = () => {
    const damage = resolveDamage(damageText);
    if (damage === null) return;
    const area = resolveSquadArea({ creature, caught, dc, ability, damage, halfOnSave, damageType, roll: rollDie });
    const details = `${damage}${damageType ? ` ${damageType}` : ''} damage, DC ${dc} ${ability.toUpperCase()} save: ` +
      area.saves.map((s) => `${s.d20} (${s.total}) ${s.success ? 'save' : 'fail'} −${s.taken}${s.fell ? ' falls' : ''}`).join('; ');
    dispatch({
      type: 'SQUAD_AREA',
      payload: {
        creatureId: creature.id,
        currentHp: area.currentHp,
        bodies: area.bodies,
        summary: formatAreaSummary(source || 'Area effect', area, creature.squad?.size ?? bodies),
        details,
      },
    });
    setResult({ damage, area });
  };

  const handleClose = () => {
    setResult(null);
    setCaughtOverride(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Area effect on {creature.name}</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {formatAreaSummary(source || 'Area effect', result.area, creature.squad?.size ?? bodies)}
            </Typography>
            <Table size="small">
              <TableBody>
                {result.area.saves.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell>Body {i + 1}</TableCell>
                    <TableCell>{s.d20} ({s.total}) {s.success ? 'save' : 'fail'}</TableCell>
                    <TableCell>−{s.taken}</TableCell>
                    <TableCell>{s.fell ? 'falls' : 'stands'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField size="small" label="Effect" value={source} onChange={(e) => setSource(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField select size="small" label="Shape" value={shape} onChange={(e) => { setShape(e.target.value as AoeShape); setCaughtOverride(null); }} sx={{ flex: 2 }}>
                {AOE_SHAPES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label={sizeLabel} value={size} onChange={(e) => { setSize(Math.max(0, parseInt(e.target.value) || 0)); setCaughtOverride(null); }} sx={{ flex: 1 }} />
            </Stack>
            <TextField
              size="small" type="number" label="Bodies caught" value={caught}
              onChange={(e) => setCaughtOverride(Math.max(0, parseInt(e.target.value) || 0))}
              helperText={`DMG p. 249 suggests ${suggested} — add or remove for how bunched up they are (${bodies} left)`}
            />
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
            <Typography variant="caption" color="text.secondary">
              VVTT rule: the wounded front body is caught first; of the bodies left wounded, the most hurt becomes the new front body.
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button onClick={handleClose} variant="contained">Done</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button onClick={handleApply} variant="contained" disabled={damagePreview === null || caught === 0}>Roll saves &amp; apply</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
```

Note: `damagePreview` only checks that the damage text is valid. When the text is dice, calling `resolveDamage` during render rolls dice it then discards; that is harmless. Apply rolls again, and that roll is the one used and logged.

- [ ] **Step 2: Create `src/components/squads/SquadRowControls.tsx`**

```tsx
import { useState } from 'react';
import { Box, Button, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';
import { adjustForDefenses, DAMAGE_TYPES } from '../../utils/squad';
import { SquadAreaDialog } from './SquadAreaDialog';

/** Sidebar row controls for a squad: Hit [dmg] × [n] (single-target hits), Heal (front body), Area… */
export function SquadRowControls({ creature }: { creature: Creature }) {
  const { dispatch } = useCombat();
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('1');
  const [type, setType] = useState('');
  const [areaOpen, setAreaOpen] = useState(false);
  const value = parseInt(amount, 10);
  const n = Math.max(1, parseInt(count, 10) || 1);
  const valid = !isNaN(value) && value > 0;
  const wiped = (creature.squad?.bodies ?? 0) === 0;

  const handleHit = () => {
    if (!valid) return;
    const each = adjustForDefenses(value, type, creature.statblock);
    dispatch({ type: 'SQUAD_HITS', payload: { creatureId: creature.id, hits: Array(n).fill(each), source: type ? `${value} ${type} × ${n}` : undefined } });
    setAmount('');
    setCount('1');
  };

  const handleHeal = () => {
    if (!valid) return;
    dispatch({ type: 'HEAL_CREATURE', payload: { creatureId: creature.id, amount: value } });
    setAmount('');
  };

  const small = { style: { textAlign: 'center' as const, padding: '3px', fontSize: '0.7rem' } };
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      <TextField type="number" size="small" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="dmg"
        sx={{ width: 50 }} inputProps={{ min: 1, ...small }} onKeyDown={(e) => { if (e.key === 'Enter') handleHit(); }} />
      <Typography variant="caption" color="text.secondary">×</Typography>
      <TextField type="number" size="small" value={count} onChange={(e) => setCount(e.target.value)}
        sx={{ width: 40 }} inputProps={{ min: 1, ...small }} />
      <TextField select size="small" value={type} onChange={(e) => setType(e.target.value)} sx={{ width: 78 }}
        SelectProps={{ displayEmpty: true }} inputProps={{ style: { fontSize: '0.7rem', padding: '3px' } }}>
        <MenuItem value=""><em>type</em></MenuItem>
        {DAMAGE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
      </TextField>
      <Button size="small" color="error" variant="outlined" onClick={handleHit} disabled={!valid || wiped}
        sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: '0.65rem' }} title="Single-target hits: each damages the front body only">
        Hit
      </Button>
      <IconButton size="small" color="success" onClick={handleHeal} disabled={!valid || wiped} title="Heal the front body (never revives)" sx={{ p: 0.25 }}>
        <AddIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Button size="small" variant="outlined" onClick={() => setAreaOpen(true)} disabled={wiped}
        sx={{ minWidth: 0, px: 0.75, py: 0, fontSize: '0.65rem' }}>
        Area…
      </Button>
      {areaOpen && <SquadAreaDialog creature={creature} open={areaOpen} onClose={() => setAreaOpen(false)} />}
    </Box>
  );
}
```

- [ ] **Step 3: Sidebar: the add-as-squad switch.** In `src/components/layout/Sidebar.tsx`:

(a) Add `Switch` and `FormControlLabel` to the existing `@mui/material` import block (lines 8–35), skipping any that are already there. Add these imports:

```ts
import { nextSquadName } from '../../utils/squad';
import { SquadRowControls } from '../squads/SquadRowControls';
```

(b) After `const [addQuantity, setAddQuantity] = useState(1);` add:

```ts
  const [addAsSquad, setAddAsSquad] = useState(false);
```

(c) In `handleAddOpen5eMonster`, directly after `const existingNpcCount = …;` add the squad branch; the existing loop stays below it unchanged:

```ts
    if (qty > 1 && addAsSquad) {
      const offsetX = (existingNpcCount % 5) * 30 - 60;
      const offsetY = Math.floor(existingNpcCount / 5) * 30 + 50;
      const creature = convertOpen5eToCreature(monster, { x: offsetX, y: offsetY });
      creature.name = nextSquadName(monster.name, qty, state.creatures);
      creature.squad = { size: qty, bodies: qty };
      addCreature(creature);
      setShowOpen5eSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      setAddQuantity(1);
      return;
    }
```

(d) In the dialog, replace the existing `{addQuantity > 1 && ( … "will be numbered" caption … )}` block (~line 1140) with this. Keep the existing caption element's exact markup and styling inside the `!addAsSquad` branch; read the current block first:

```tsx
            {addQuantity > 1 && (
              <Box>
                <FormControlLabel
                  control={<Switch size="small" checked={addAsSquad} onChange={(e) => setAddAsSquad(e.target.checked)} />}
                  label={<Typography variant="caption">Add as one squad</Typography>}
                />
                {addAsSquad ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    One row and token; tracks bodies (e.g. 8/{addQuantity})
                  </Typography>
                ) : (
                  /* existing "will be numbered, e.g. Goblin 1, Goblin 2" caption, unchanged */
                )}
              </Box>
            )}
```

- [ ] **Step 4: Sidebar: edit Bodies.**

(a) Next to the other edit states (search for `const [editFaction, setEditFaction]`), add:

```ts
  const [editBodies, setEditBodies] = useState(0);
```

(b) In `startEdit`, add `setEditBodies(creature.squad?.bodies ?? 0);`.

(c) In `saveEdit`, change `const existingStatblock = …` to:

```ts
    const existing = state.creatures.find(c => c.id === editingCreatureId)!;
    const existingStatblock = existing.statblock;
```

Then add `...(existing.squad && { squad: { ...existing.squad, bodies: editBodies } }),` inside `updates` (after `faction: editFaction,`).

(d) Add `editBodies: number; setEditBodies: (v: number) => void;` to `CreatureEntryProps.editState`. Add `editBodies, setEditBodies` to **both** `editState={{ … }}` objects passed to `CreatureEntry` (the PC list ~857 and the NPC list ~973).

(e) In `CreatureEntry`'s edit form, change the HP row to show a Bodies field for squads:

```tsx
          <Stack direction="row" spacing={1}>
            {creature.squad && (
              <TextField size="small" label={`Bodies (of ${creature.squad.size})`} type="number" value={editState.editBodies}
                onChange={(e) => editState.setEditBodies(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            )}
            <TextField size="small" label={creature.squad ? 'Front HP' : 'HP'} type="number" value={editState.editHp} onChange={(e) => editState.setEditHp(parseInt(e.target.value) || 0)} sx={{ flex: 1 }} />
            <TextField size="small" label="Max" type="number" value={editState.editMaxHp} onChange={(e) => editState.setEditMaxHp(parseInt(e.target.value) || 1)} sx={{ flex: 1 }} />
          </Stack>
```

- [ ] **Step 5: Sidebar: the squad row display.** In `CreatureEntry`:

(a) In the non-dead caption, replace `HP: {creature.currentHp}/{creature.statblock.maxHp}` with:

```tsx
{creature.squad
  ? <>Bodies {creature.squad.bodies}/{creature.squad.size} · front {creature.currentHp}/{creature.statblock.maxHp} HP</>
  : <>HP: {creature.currentHp}/{creature.statblock.maxHp}</>}
```

(b) Replace the damage-controls condition `{!isPC && onHpChange && (` so that squads get the squad controls:

```tsx
        {!isPC && creature.squad && <SquadRowControls creature={creature} />}
        {!isPC && !creature.squad && onHpChange && (
```

The existing damage/heal block that follows stays unchanged.

- [ ] **Step 6: Verify.** There are no unit tests for these components (the logic lives in `squad.ts`).

```bash
npx tsc --noEmit && npx eslint src/components/squads/SquadRowControls.tsx src/components/squads/SquadAreaDialog.tsx src/components/layout/Sidebar.tsx && npm test
```

Expected: no errors, and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/squads/SquadRowControls.tsx src/components/squads/SquadAreaDialog.tsx src/components/layout/Sidebar.tsx
git commit -m "Sidebar: add monsters as a squad; squad row with hits, heal, area effect, bodies edit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The squad's turn: Squad attack panel

**Files:**
- Create: `src/components/squads/SquadAttackPanel.tsx`
- Modify: `src/components/layout/RightPanel.tsx` (creature branch of the current-turn component, ~577–620)

**Interfaces:**
- Consumes:
  - from `src/utils/squad`: `parseActionDamage`, `parseMultiattackCount`, `rollGroupAttack`, `adjustForDefenses`, `formatGroupAttack`, `formatAttackRolls`, `GroupAttackResult`, `DamagePart`;
  - `rollDie` from `src/utils/diceEngine`;
  - actions `LOG_ACTION`, `SQUAD_HITS`, `DEAL_DAMAGE_TO_CREATURE`, `DEAL_DAMAGE_TO_VEHICLE`.
- Produces: `<SquadAttackPanel squad={Creature} />`

- [ ] **Step 1: Create `src/components/squads/SquadAttackPanel.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { Box, Button, Collapse, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import type { Creature } from '../../types';
import {
  parseActionDamage, parseMultiattackCount, rollGroupAttack, adjustForDefenses,
  formatGroupAttack, formatAttackRolls, type DamagePart, type GroupAttackResult,
} from '../../utils/squad';
import { rollDie } from '../../utils/diceEngine';

type TargetKey = `c:${string}` | `v:${string}`;

/** On a squad's turn: pick action + target, roll every attack, then apply hit by hit through the target's own damage path. */
export function SquadAttackPanel({ squad }: { squad: Creature }) {
  const { state, dispatch } = useCombat();
  const attacks = useMemo(() => (squad.statblock.actions ?? []).filter((a) => a.attackBonus !== undefined), [squad.statblock.actions]);
  const bodies = squad.squad?.bodies ?? 0;

  const targets = useMemo(() => [
    ...state.creatures
      .filter((c) => c.id !== squad.id && (c.currentHp > 0 || c.statblock.type === 'pc'))
      .map((c) => ({ key: `c:${c.id}` as TargetKey, label: c.name, ac: c.statblock.ac })),
    ...state.vehicles
      .filter((v) => v.currentHp > 0 && !v.isInoperative)
      .map((v) => ({ key: `v:${v.id}` as TargetKey, label: v.name, ac: v.template.ac })),
  ], [state.creatures, state.vehicles, squad.id]);

  const [actionName, setActionName] = useState(attacks[0]?.name ?? '');
  const [targetKey, setTargetKey] = useState<TargetKey | ''>('');
  const [ac, setAc] = useState(10);
  const [attackers, setAttackers] = useState(bodies);
  const [attacksEach, setAttacksEach] = useState(() => parseMultiattackCount(squad.statblock));
  const [manualDamage, setManualDamage] = useState(0);
  const [result, setResult] = useState<GroupAttackResult | null>(null);
  const [applied, setApplied] = useState(false);
  const [showRolls, setShowRolls] = useState(false);

  if (bodies === 0) return null;
  if (attacks.length === 0) {
    return <Typography variant="caption" color="text.secondary">Squad attack: this statblock has no actions with a to-hit bonus.</Typography>;
  }

  const action = attacks.find((a) => a.name === actionName) ?? attacks[0];
  const parsed = parseActionDamage(action);
  const damage: DamagePart[] = parsed.length > 0 ? parsed : [{ count: 0, sides: 0, bonus: manualDamage, type: '' }];
  const target = targets.find((t) => t.key === targetKey);

  const handleTarget = (key: TargetKey) => {
    setTargetKey(key);
    const t = targets.find((x) => x.key === key);
    if (t) setAc(t.ac);
  };

  const handleRoll = () => {
    const r = rollGroupAttack({ attackBonus: action.attackBonus ?? 0, ac, damage, attacks: Math.max(0, attackers) * Math.max(1, attacksEach), roll: rollDie });
    setResult(r);
    setApplied(false);
    setShowRolls(false);
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'attack',
        action: formatGroupAttack({ attackerName: squad.name, actionName: action.name, ac, result: r }) + (target ? ` (${target.label})` : ''),
        details: formatAttackRolls(r),
      },
    });
  };

  const handleApply = () => {
    if (!result || !target) return;
    const source = `${squad.name} (${action.name})`;
    const id = target.key.slice(2);
    const hitRolls = result.rolls.filter((r) => r.hit);
    if (target.key.startsWith('v:')) {
      hitRolls.forEach((r) => {
        const amount = r.damage.reduce((sum, d) => sum + d.amount, 0);
        if (amount > 0) dispatch({ type: 'DEAL_DAMAGE_TO_VEHICLE', payload: { vehicleId: id, amount, source } });
      });
    } else {
      const victim = state.creatures.find((c) => c.id === id);
      if (!victim) return;
      const perHit = hitRolls.map((r) => r.damage.reduce((sum, d) => sum + adjustForDefenses(d.amount, d.type, victim.statblock), 0));
      if (victim.squad) {
        dispatch({ type: 'SQUAD_HITS', payload: { creatureId: id, hits: perHit, source } });
      } else {
        perHit.filter((a) => a > 0).forEach((amount) => dispatch({ type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: id, amount, source } }));
      }
    }
    setApplied(true);
  };

  const num = (v: string) => Math.max(0, parseInt(v) || 0);
  return (
    <Box sx={{ mt: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1 }}>Squad attack</Typography>
      <Stack spacing={1}>
        <TextField select size="small" label="Action" value={action.name} onChange={(e) => { setActionName(e.target.value); setResult(null); }}>
          {attacks.map((a) => <MenuItem key={a.name} value={a.name}>{a.name} (+{a.attackBonus})</MenuItem>)}
        </TextField>
        {parsed.length === 0 && (
          <TextField size="small" type="number" label="Damage per hit" value={manualDamage} onChange={(e) => setManualDamage(num(e.target.value))}
            helperText="Couldn't read this action's damage; enter it" />
        )}
        <Stack direction="row" spacing={1}>
          <TextField select size="small" label="Target" value={targetKey} onChange={(e) => handleTarget(e.target.value as TargetKey)} sx={{ flex: 2 }}>
            {targets.map((t) => <MenuItem key={t.key} value={t.key}>{t.label}</MenuItem>)}
          </TextField>
          <TextField size="small" type="number" label="AC" value={ac} onChange={(e) => setAc(num(e.target.value))} sx={{ flex: 1 }} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField size="small" type="number" label={`Attackers (of ${bodies})`} value={attackers} onChange={(e) => setAttackers(Math.min(bodies, num(e.target.value)))} sx={{ flex: 1 }} />
          <TextField size="small" type="number" label="Attacks each" value={attacksEach} onChange={(e) => setAttacksEach(Math.max(1, num(e.target.value)))} sx={{ flex: 1 }} />
        </Stack>
        <Button variant="contained" size="small" onClick={handleRoll} disabled={attackers === 0}>Roll {Math.max(0, attackers) * Math.max(1, attacksEach)} attacks</Button>
        {result && (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {formatGroupAttack({ attackerName: squad.name, actionName: action.name, ac, result })}
            </Typography>
            <Button size="small" onClick={() => setShowRolls((s) => !s)} sx={{ p: 0, minWidth: 0, fontSize: '0.7rem' }}>
              {showRolls ? 'Hide rolls' : 'Show rolls'}
            </Button>
            <Collapse in={showRolls}>
              <Typography variant="caption" color="text.secondary">{formatAttackRolls(result)}</Typography>
            </Collapse>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <Button size="small" variant="outlined" color="error" onClick={handleApply} disabled={!target || applied || result.hits === 0}>
                {applied ? 'Applied' : `Apply to ${target?.label ?? '…'}`}
              </Button>
              {!target && <Typography variant="caption" color="text.secondary">Pick a target to apply</Typography>}
            </Stack>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">
          VVTT rule: attackers default to every standing body; lower it if not all can reach.
        </Typography>
      </Stack>
    </Box>
  );
}
```

- [ ] **Step 2: Mount it in `RightPanel.tsx`.** Add the import:

```ts
import { SquadAttackPanel } from '../squads/SquadAttackPanel';
```

In the creature-turn return (the block that starts `<Typography variant="subtitle1" fontWeight={600}>{currentTurnCreature.name}</Typography>`), replace the HP caption so squads show bodies:

```tsx
      <Typography variant="caption" color="text.secondary">
        {currentTurnCreature.squad
          ? <>Bodies: {currentTurnCreature.squad.bodies}/{currentTurnCreature.squad.size} · front {currentTurnCreature.currentHp}/{currentTurnCreature.statblock.maxHp} HP | </>
          : <>HP: {currentTurnCreature.currentHp}/{currentTurnCreature.statblock.maxHp} | </>}
        AC: {currentTurnCreature.statblock.ac}
      </Typography>
```

Then, just before the closing `</Box>` of that return, add:

```tsx
      {currentTurnCreature.squad && <SquadAttackPanel key={currentTurnCreature.id} squad={currentTurnCreature} />}
```

(The `key` resets the panel's local state whenever a different squad takes its turn.)

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npx eslint src/components/squads/SquadAttackPanel.tsx src/components/layout/RightPanel.tsx && npm test
```

Expected: no errors, and all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/squads/SquadAttackPanel.tsx src/components/layout/RightPanel.tsx
git commit -m "Squad turn: roll every attack in one click, apply hit by hit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Squad token badge and ring (DM map and player view)

**Files:**
- Create: `src/components/squads/SquadTokenOverlay.tsx`
- Modify: `src/components/battlefield/BattlefieldMap.tsx` (`CreatureToken`, ~3834; the token circle `<div>` with `position: 'relative'`)
- Modify: `src/components/battlefield/PlayerViewMap.tsx` (creature token map, ~336–405; the `token-circle` `<div>`)

**Interfaces:**
- Consumes: `Creature.squad`.
- Produces: `<SquadTokenOverlay squad={{ size, bodies }} tokenSize={number} />`, rendered inside a `position: relative` token circle.

- [ ] **Step 1: Create `src/components/squads/SquadTokenOverlay.tsx`**

```tsx
/** Body-count badge plus a ring that drains as bodies fall. Shared by the DM map and the player view. */
export function SquadTokenOverlay({ squad, tokenSize }: { squad: { size: number; bodies: number }; tokenSize: number }) {
  const fraction = squad.size > 0 ? squad.bodies / squad.size : 0;
  const stroke = Math.max(2, tokenSize * 0.08);
  const box = tokenSize + stroke * 4;
  const r = (box - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <>
      <svg
        width={box}
        height={box}
        style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)', pointerEvents: 'none' }}
      >
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={stroke} />
        <circle
          cx={box / 2} cy={box / 2} r={r} fill="none" stroke="#f59e0b" strokeWidth={stroke}
          strokeDasharray={`${circumference * fraction} ${circumference}`}
        />
      </svg>
      <span
        style={{
          position: 'absolute',
          right: -tokenSize * 0.25,
          bottom: -tokenSize * 0.15,
          fontSize: Math.max(9, tokenSize * 0.3),
          fontWeight: 700,
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.85)',
          color: squad.bodies === 0 ? '#dc2626' : '#f59e0b',
          border: '1px solid #f59e0b',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {squad.bodies}/{squad.size}
      </span>
    </>
  );
}
```

- [ ] **Step 2: Mount on the DM map.** In `BattlefieldMap.tsx`, import the overlay:

```ts
import { SquadTokenOverlay } from '../squads/SquadTokenOverlay';
```

Inside `CreatureToken`'s token circle `<div>` (the one with `borderRadius: '50%'` and `position: 'relative'`), after the death-saves indicator, add:

```tsx
        {creature.squad && <SquadTokenOverlay squad={creature.squad} tokenSize={tokenSize} />}
```

Also extend that div's `title` so hovering shows bodies. Before `HP:` insert:

```ts
${creature.squad ? `\nBodies: ${creature.squad.bodies}/${creature.squad.size}` : ''}
```

- [ ] **Step 3: Mount on the player view.** In `PlayerViewMap.tsx`, import it the same way. Inside the `token-circle` `<div>` (which has `position: 'relative'`), after the `isInDeathSaves` block, add:

```tsx
                  {creature.squad && <SquadTokenOverlay squad={creature.squad} tokenSize={tokenSize} />}
```

The player view already receives whole `Creature` objects through `BattlefieldSyncState.creatures` (`src/hooks/useBroadcastChannel.ts`). Confirm that no field whitelist strips `squad`: `grep -n "creatures" src/hooks/useBroadcastChannel.ts src/components/battlefield/BattlefieldMap.tsx` around the broadcast call. If creatures are mapped to a subset of fields there, add `squad`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npx eslint src/components/squads/SquadTokenOverlay.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx && npm test
```

Expected: no errors, and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/squads/SquadTokenOverlay.tsx src/components/battlefield/BattlefieldMap.tsx src/components/battlefield/PlayerViewMap.tsx
git commit -m "Squad tokens: body badge and draining ring on DM map and player view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Help section and v2.11.0 changelog

**Files:**
- Modify: `src/components/help/HelpGuide.tsx` (append a paragraph to the "5. Run Combat" accordion, after the "Ship turns" paragraph ~254; that paragraph currently has no `paragraph` prop, so add `paragraph` to it)
- Modify: `src/data/changelog.ts` (new first entry)

- [ ] **Step 1: Help.** After the "Ship turns" `<Typography>` in section 5, add:

```tsx
            <Typography variant="body2" paragraph sx={{ mt: 2 }}>
              <strong>Battle mode: squads.</strong> When adding several of the same monster, switch on
              <strong> Add as one squad</strong> to get one row, one initiative slot and one token showing how many
              are still standing (e.g. 8/10). On a squad&apos;s turn, the right panel&apos;s <strong>Squad attack</strong>
              rolls every attack at once: a natural 20 is a critical hit and a natural 1 misses. Then <strong>Apply</strong>
              sends each hit to the target. In the squad&apos;s row, <strong>Hit</strong> deals single-target hits,
              and <strong>Area…</strong> handles spells like fireball. It suggests how many bodies are caught using the
              DMG&apos;s Targets in Areas of Effect table (p. 249), which you can adjust, then rolls each body&apos;s
              save. Healing restores the front body only and never brings back the fallen.
            </Typography>
            <Typography variant="body2">
              <strong>VVTT rules</strong> (not in the books, to keep big fights fast): a squad acts as one creature
              on one initiative; only its front body is tracked, so a single hit can drop at most one body and
              overkill is lost; attackers default to every standing body; after an area effect the most wounded
              survivor becomes the front body; squads don&apos;t use temporary HP.
            </Typography>
```

- [ ] **Step 2: Changelog.** Insert as the first element of `changelog`:

```ts
  {
    version: '2.11.0',
    date: '2026-10-19',
    changes: [
      { type: 'feature', description: 'Battle mode squads: add several of the same monster as one squad — one row, one initiative slot and one token with a body count (e.g. 8/10) on both the DM map and the player view.' },
      { type: 'feature', description: 'Squad attacks: on a squad\'s turn, roll every attack in one click (natural 20 crits, natural 1 misses), see "10 attacks → 4 hits (1 crit) → 38 slashing", expand the rolls, then apply hit by hit to a creature, squad or vehicle.' },
      { type: 'feature', description: 'Hurting squads: single-target hits drop one body at a time; Area… suggests how many are caught from the DMG Targets in Areas of Effect table (p. 249), rolls each body\'s save and removes the fallen. Healing never revives bodies.' },
    ],
  },
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npx eslint src/components/help/HelpGuide.tsx src/data/changelog.ts && npm test
git add src/components/help/HelpGuide.tsx src/data/changelog.ts
git commit -m "Help and changelog for Battle mode squads (v2.11.0)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Manual browser checklist (user, after deploy)

1. Search Hobgoblin, set quantity 10, switch on **Add as one squad**, add → one row "Hobgoblin ×10 (A)", "Bodies 10/10 · front 11/11 HP".
2. Place it on the map: the token shows a 10/10 badge and a full ring. Open the player view: the same badge is there.
3. Press **Roll NPC Init**, Start Combat, and advance to the squad's turn. The Squad attack block lists Longsword (+3); pick a PC and roll 10 attacks. The summary is logged, and Show rolls lists every roll.
4. Apply → the PC's HP drops once per hit.
5. In the squad's row: Hit 20 × 1 → 9/10, front 11. Hit 5 × 1 → front 6.
6. Area… → Sphere, radius 20: the suggestion reads 4. DEX DC 15, 8d6 fire → the summary is logged, and bodies and the badge update on both views.
7. Heal 50 → front 11 and no bodies return. Edit → Bodies 0 → the row reads DEAD and the squad is skipped in turn order.
8. Save the encounter, reload, load → the squad keeps its bodies.
