/**
 * Battle mode squads: the container (v2.13.0). Pure rules.
 * Spec: docs/superpowers/specs/2026-10-20-battle-mode-squads-tab-design.md. Rules not in the books are
 * VVTT rules, numbered as in the spec.
 */
import type { AbilityName, CrewAssignment, Creature, Squad, Statblock, StatblockAction } from '../types';
import { adjustForDefenses, nextStackName, parseMultiattackCount, saveBonus, type AreaSave, type Roller } from './stack';

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
