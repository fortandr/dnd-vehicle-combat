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
