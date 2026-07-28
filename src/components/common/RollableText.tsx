/**
 * RollableText — renders a string and turns any dice notation inside it
 * (e.g. "5d10", "2d10+8", "1d20-1") into a clickable element that rolls the dice
 * via the shared dice engine, shows the result in a toast, and logs it to the
 * combat log. Non-dice text renders normally.
 *
 * Drop it in anywhere dice appear (weapon damage, effects, traits, upgrades…):
 *   <RollableText text={weapon.damage} source={`${vehicle.name} · ${weapon.name}`} />
 */
import { useState } from 'react';
import { Box, Snackbar } from '@mui/material';
import { useCombat } from '../../context/CombatContext';
import { roll as rollNotation, formatRollResult } from '../../utils/diceEngine';

const DICE_RE = /\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?/gi;

interface RollableTextProps {
  text?: string;
  /** Optional context recorded in the combat log (e.g. weapon / vehicle name). */
  source?: string;
}

export function RollableText({ text, source }: RollableTextProps) {
  const { dispatch } = useCombat();
  const [snack, setSnack] = useState<string | null>(null);

  if (!text) return null;

  // Split into plain segments and clickable dice notations.
  const parts: { text: string; dice?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(DICE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ text: text.slice(last, idx) });
    parts.push({ text: m[0], dice: m[0].replace(/\s+/g, '') });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });

  const handleRoll = (notation: string) => {
    const result = rollNotation(notation);
    const formatted = formatRollResult(result);
    setSnack(`🎲 ${formatted}`);
    dispatch({
      type: 'LOG_ACTION',
      payload: {
        type: 'system',
        action: source ? `${source} — rolled ${notation}` : `Rolled ${notation}`,
        details: formatted,
      },
    });
  };

  return (
    <Box component="span">
      {parts.map((p, i) =>
        p.dice ? (
          <Box
            key={i}
            component="span"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); handleRoll(p.dice!); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleRoll(p.dice!); }
            }}
            title={`Roll ${p.dice}`}
            sx={{
              cursor: 'pointer',
              color: 'primary.main',
              fontWeight: 600,
              textDecoration: 'underline dotted',
              textUnderlineOffset: '2px',
              borderRadius: 0.5,
              px: 0.25,
              '&:hover': { color: 'primary.light', bgcolor: 'action.hover' },
            }}
          >
            {p.text}
          </Box>
        ) : (
          <Box component="span" key={i}>{p.text}</Box>
        )
      )}
      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
