/**
 * Battle mode stacks: one creature row standing for N identical bodies (v2.11.0 "squads", renamed in v2.13.0
 * when "squad" became the container; see src/utils/squads.ts). Pure rules only. Dice come in through `roll`.
 */
import type { AbilityName, Creature, DmgEdition, Statblock, StatblockAction } from '../types';

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
  // Open5e lists are comma-split, so a "nonmagical" qualifier may sit only on the last fragment;
  // rejoin and test per ';'-separated clause.
  const has = (list?: string[]) => (list ?? []).length > 0 && (list ?? []).join(', ').toLowerCase().split(';').some(
    (clause) => clause.includes(type) && !(magical && clause.includes('nonmagical')),
  );
  if (has(statblock.damageImmunities)) return 0;
  let result = amount;
  if (has(statblock.damageResistances)) result = Math.floor(result / 2);
  if (has(statblock.damageVulnerabilities)) result *= 2;
  return result;
}

/** One typed part of one hit; the reducer meets it with the defenses of the member it resolves (ruling P5). */
export interface HitPart { amount: number; type: string; magical?: boolean }
/** A hit: typed parts, or a plain number (untyped damage, taken as is). */
export type SquadHit = number | HitPart[];

/** Final damage of one hit against a statblock: each typed part through adjustForDefenses. */
export function resolveHit(hit: SquadHit, statblock: Statblock): number {
  if (typeof hit === 'number') return hit;
  return hit.reduce((sum, p) => sum + adjustForDefenses(p.amount, p.type, statblock, p.magical ?? false), 0);
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

// ==========================================
// Bodies (VVTT rule: front body = currentHp)
// ==========================================

/** Single-target hits, in order: each hit damages only the front body; a body that falls loses its overkill. */
export function applyStackHits(creature: Creature, hits: number[]): { currentHp: number; bodies: number; fell: number } {
  const max = creature.statblock.maxHp;
  let currentHp = creature.currentHp;
  let bodies = creature.stack?.bodies ?? 0;
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

export function saveBonus(statblock: Statblock, ability: AbilityName): number {
  return statblock.savingThrows?.[ability] ?? Math.floor(((statblock.abilities?.[ability] ?? 10) - 10) / 2);
}

export interface AreaSave { d20: number; total: number; success: boolean; taken: number; fell: boolean }
export interface StackAreaResult { saves: AreaSave[]; currentHp: number; bodies: number; fell: number }

/**
 * Area damage is rolled once (passed in as `damage`); each caught body rolls its own save.
 * The wounded front body is caught first, then fresh bodies. VVTT rule: of the damaged survivors,
 * the one with the lowest HP becomes the front body; damage to other survivors is dropped.
 */
export function resolveStackArea({ creature, caught, dc, ability, damage, halfOnSave, damageType, magical = false, roll }: {
  creature: Creature; caught: number; dc: number; ability: AbilityName; damage: number;
  halfOnSave: boolean; damageType: string; magical?: boolean; roll: Roller;
}): StackAreaResult {
  const max = creature.statblock.maxHp;
  const startBodies = creature.stack?.bodies ?? 0;
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
export function healStack(creature: Creature, amount: number): number {
  if ((creature.stack?.bodies ?? 0) === 0) return creature.currentHp;
  return Math.min(creature.statblock.maxHp, creature.currentHp + Math.max(0, amount));
}

/**
 * Keeps a squad consistent after a manual update: bodies within 0..size; 0 bodies ⇔ 0 HP;
 * raising bodies from 0 restores a full front body; HP set to 0 with bodies left means the front body fell.
 */
export function normalizeStack(prev: Creature, next: Creature): { currentHp: number; stack: Creature['stack'] } {
  if (!next.stack) return { currentHp: next.currentHp, stack: next.stack };
  const max = next.statblock.maxHp;
  const size = next.stack.size;
  let bodies = Math.max(0, Math.min(next.stack.bodies, size));
  let currentHp = Math.min(next.currentHp, max);
  if (bodies === 0) {
    currentHp = 0;
  } else if (currentHp <= 0) {
    const wasWiped = (prev.stack?.bodies ?? 0) === 0;
    if (!wasWiped) bodies -= 1;
    currentHp = bodies > 0 ? max : 0;
  }
  return { currentHp, stack: { ...next.stack, size, bodies } };
}

// ==========================================
// Naming and log text
// ==========================================

/** "Hobgoblin ×10 (A)": the letter counts existing squads of the same monster. */
export function nextStackName(baseName: string, qty: number, creatures: Creature[]): string {
  const existing = creatures.filter((c) => c.stack && c.name.startsWith(`${baseName} ×`)).length;
  return `${baseName} ×${qty} (${String.fromCharCode(65 + (existing % 26))})`;
}

export function formatStackTally(bodies: number, size: number): string {
  return bodies === 0 ? `(0/${size}) — squad destroyed` : `(${bodies}/${size})`;
}

const fallText = (fell: number) => (fell === 0 ? 'none fall' : `${fell} fall`);

export function formatStackHits(name: string, hitCount: number, fell: number, bodies: number, size: number): string {
  return `${name} takes ${hitCount} hit${hitCount === 1 ? '' : 's'}: ${fallText(fell)} ${formatStackTally(bodies, size)}`;
}

/** "Fireball: 4 caught, 3 failed → 4 fall (6/10)" */
export function formatAreaSummary(source: string, result: StackAreaResult, size: number): string {
  const failed = result.saves.filter((s) => !s.success).length;
  return `${source}: ${result.saves.length} caught, ${failed} failed → ${fallText(result.fell)} ${formatStackTally(result.bodies, size)}`;
}

/**
 * Normalise a damage field: a plain integer, or dice notation in the exact grammar
 * diceEngine.roll() accepts (NdM, dM, optional +/-N). Returns null if not usable. Pure: never rolls.
 */
export function damageNotation(text: string): string | null {
  const t = text.replace(/\s+/g, '');
  if (/^\d+$/.test(t)) return t;
  if (/^\d*d\d+([+-]\d+)?$/i.test(t)) return t.toLowerCase();
  return null;
}
