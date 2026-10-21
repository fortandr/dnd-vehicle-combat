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
      const victim = squad ? undefined : state.creatures.find((c) => c.id === id);
      if (squad || victim?.stack) {
        // Typed parts, no memberId for a squad: the reducer picks the front stack from current state at apply time
        // and meets each part with that member's defenses (a second line can't hit, or use the vulnerabilities of,
        // a stack the first line already wiped).
        const hits = hitRolls.map((x) => x.damage.map((d) => ({ amount: d.amount, type: d.type })));
        dispatch({ type: 'SQUAD_HIT', payload: squad ? { squadId: squad.id, hits, source } : { memberId: id, hits, source } });
      } else if (victim) {
        hitRolls
          .map((x) => x.damage.reduce((sum, d) => sum + adjustForDefenses(d.amount, d.type, victim.statblock), 0))
          .filter((a) => a > 0)
          .forEach((amount) => dispatch({ type: 'DEAL_DAMAGE_TO_CREATURE', payload: { creatureId: victim.id, amount, source } }));
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
