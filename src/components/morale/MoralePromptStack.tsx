import { useState } from 'react';
import { Alert, Stack } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { MoralePromptCard } from './MoralePromptCard';

/** Open morale checks, plus the results of ones just resolved (until closed). */
export function MoralePromptStack() {
  const { state } = useCombat();
  const [results, setResults] = useState<{ id: string; text: string; fled: boolean }[]>([]);
  const prompts = state.moralePrompts ?? [];
  if (prompts.length === 0 && results.length === 0) return null;
  return (
    <Stack spacing={1} sx={{ mb: 2 }}>
      {results.map((r) => (
        <Alert key={r.id} severity={r.fled ? 'warning' : 'success'} onClose={() => setResults((rs) => rs.filter((x) => x.id !== r.id))}>
          {r.text}
        </Alert>
      ))}
      {prompts.map((p) => (
        <MoralePromptCard key={p.id} prompt={p} onResolved={(text, fled) => setResults((rs) => [...rs, { id: p.id, text, fled }])} />
      ))}
    </Stack>
  );
}
