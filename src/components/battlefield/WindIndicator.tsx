import type { CompassPoint } from '../../types';
import { compassToDegrees } from '../../utils/navalMovement';

/** Corner overlay: arrow points the way the wind blows; label says where it blows from. */
export function WindIndicator({ wind }: { wind?: CompassPoint }) {
  if (!wind) return null;
  const blowsToward = (compassToDegrees(wind) + 180) % 360;
  return (
    <div
      title={`Wind from the ${wind}`}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        padding: '4px 8px',
        borderRadius: 6,
        background: 'rgba(0, 0, 0, 0.6)',
        color: '#fff',
        fontSize: 11,
        pointerEvents: 'none',
      }}
    >
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: `rotate(${blowsToward}deg)` }} aria-hidden="true">
        <path d="M14 3 L21 13 H16.5 V25 H11.5 V13 H7 Z" fill="currentColor" />
      </svg>
      <span>Wind from {wind}</span>
    </div>
  );
}
