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
  const open = new Set((next.moralePrompts ?? []).map((p) => p.creatureId));

  const creatures = next.creatures.map((c) => {
    const was = before.get(c.id);
    if (!was || c.statblock.type === 'pc' || c.morale?.status || isOut(c)) return c;
    if (open.has(c.id)) return c;
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
    // One prompt per creature per step, by priority (fired is already in priority order); all triggers recorded.
    const trigger = fired[0];
    prompts.push({ id: newId(), creatureId: c.id, trigger, ...(trigger === 'leader-down' ? { leaderName } : {}) });
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
