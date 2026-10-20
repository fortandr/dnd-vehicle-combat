import type { MoraleStatus } from '../../types';

/** Small ↩ (fleeing) or ⚐ (surrendered) marker in a token's top-left corner. Shared by the DM map and the player view. */
export function MoraleTokenMarker({ status, tokenSize }: { status: MoraleStatus; tokenSize: number }) {
  return (
    <span
      title={status === 'fleeing' ? 'Fleeing' : 'Surrendered'}
      style={{
        position: 'absolute',
        left: -tokenSize * 0.2,
        top: -tokenSize * 0.2,
        fontSize: Math.max(10, tokenSize * 0.35),
        lineHeight: 1,
        padding: '1px 3px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.85)',
        color: status === 'fleeing' ? '#f59e0b' : '#e5e7eb',
        border: '1px solid currentColor',
        pointerEvents: 'none',
      }}
    >
      {status === 'fleeing' ? '↩' : '⚐'}
    </span>
  );
}
