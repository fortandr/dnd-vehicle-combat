/**
 * Battle mode morale — DMG 2014 p. 273 optional rule (the 2024 DMG has none).
 * Specs: docs/superpowers/specs/2026-10-20-battle-mode-morale-design.md and
 * docs/superpowers/specs/2026-10-20-battle-mode-squads-tab-design.md (squads). Pure; dice are injected.
 */
import type { CombatState, ConditionName, Creature, MoralePrompt, MoraleTrigger, Squad } from '../types';
import { saveBonus, type Roller } from './stack';
import { fallbackSaver, squadMembers, squadStandingCount } from './squads';

export const MORALE_DC = 10;
export const INCAPACITATING: ConditionName[] = ['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'];

/** A leader is down when missing, at 0 HP, or incapacitated. */
export function isLeaderDown(leader?: Creature): boolean {
  if (!leader) return true;
  if (leader.currentHp <= 0) return true;
  return leader.conditions.some((c) => INCAPACITATING.includes(c.name));
}

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
  const openCreatures = new Set((next.moralePrompts ?? []).flatMap((p) => (p.creatureId ? [p.creatureId] : [])));
  const openSquads = new Set((next.moralePrompts ?? []).flatMap((p) => (p.squadId ? [p.squadId] : [])));
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
  // a PC never makes a morale save: a PC leader falls through to VVTT rule 3
  if (leader && leader.statblock.type !== 'pc' && !isLeaderDown(leader)) return { saver: leader, bonus: saveBonus(leader.statblock, 'wis'), usingLeader: true };
  const saver = fallbackSaver(squad, creatures);
  return saver ? { saver, bonus: saveBonus(saver.statblock, 'wis'), usingLeader: false } : undefined;
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

export function moraleTriggerText(prompt: MoralePrompt, strength?: { standing: number; starting: number }): string {
  switch (prompt.trigger) {
    case 'leader-down': return `${prompt.leaderName ?? 'Leader'} is down`;
    case 'half-size': return `Down to half strength (${strength?.standing ?? 0}/${strength?.starting ?? 0})`;
    case 'half-hp': return 'Below half HP';
    default: return 'Morale check';
  }
}
