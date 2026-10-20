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
