import type { CombatState, LogEntry } from '../types';

function toDate(ts: Date | string): Date {
  return typeof ts === 'string' ? new Date(ts) : ts;
}

function formatTime(ts: Date | string): string {
  const d = toDate(ts);
  if (isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatEntry(entry: LogEntry): string {
  const time = formatTime(entry.timestamp);
  const detail = entry.details ? ` _(${entry.details})_` : '';
  return `- \`[${time}]\` **${entry.type}** — ${entry.action}${detail}`;
}

export function formatLogAsMarkdown(state: CombatState): string {
  const partyVehicles = state.vehicles.filter((v) => v.type === 'party').map((v) => v.name);
  const enemyVehicles = state.vehicles.filter((v) => v.type === 'enemy').map((v) => v.name);

  const lines: string[] = [];
  lines.push(`# Combat Log — ${state.name}`);
  lines.push('');
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push(`**Round:** ${state.round}  ·  **Phase:** ${state.phase}`);
  if (partyVehicles.length > 0) lines.push(`**Party:** ${partyVehicles.join(', ')}`);
  if (enemyVehicles.length > 0) lines.push(`**Enemies:** ${enemyVehicles.join(', ')}`);

  if (state.actionLog.length === 0) {
    lines.push('');
    lines.push('_No actions logged._');
    return lines.join('\n') + '\n';
  }

  // actionLog is appended chronologically in the reducer — iterate as-is and
  // group by round.
  let currentRound: number | null = null;
  for (const entry of state.actionLog) {
    if (entry.round !== currentRound) {
      currentRound = entry.round;
      lines.push('');
      lines.push(`## Round ${currentRound}`);
    }
    lines.push(formatEntry(entry));
  }
  return lines.join('\n') + '\n';
}

export function formatLogAsJson(state: CombatState): string {
  return JSON.stringify(
    {
      encounter: state.name,
      exportedAt: new Date().toISOString(),
      round: state.round,
      phase: state.phase,
      vehicles: state.vehicles.map((v) => ({ id: v.id, name: v.name, type: v.type })),
      actionLog: state.actionLog,
    },
    null,
    2,
  );
}

export function buildLogFilename(state: CombatState, ext: 'md' | 'json'): string {
  const safeName = (state.name || 'encounter').replace(/[^a-z0-9-]+/gi, '_').replace(/^_+|_+$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `combat-log-${safeName || 'encounter'}-${date}.${ext}`;
}

export function downloadText(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
