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
