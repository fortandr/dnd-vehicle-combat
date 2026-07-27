/**
 * Top-down token icons for the Saltmarsh ships (naval templates).
 *
 * Shared by both the DM battlefield (VehicleIcon) and the player view
 * (PlayerViewVehicleIcon) so the six ships are defined once. Same convention as
 * the vehicle icons: top-down, bow pointing UP, orange circles are weapon
 * stations, the black circle is the helm.
 *
 * renderShipIcon returns the SVG for a known ship id, or null if the id isn't a
 * ship (so callers fall through to their existing vehicle-icon logic).
 */
import type { ReactElement } from 'react';

const WEAPON = '#ff6b35';

// A weapon station: orange dot with a hull-coloured ring.
function station(cx: number, cy: number, color: string, r = 2) {
  return <circle cx={cx} cy={cy} r={r} fill={WEAPON} stroke={color} strokeWidth="0.8" />;
}
// The helm: black dot ringed in the hull colour.
function helmDot(cx: number, cy: number, color: string) {
  return <circle cx={cx} cy={cy} r="2.2" fill="#000" stroke={color} strokeWidth="1.2" />;
}
// A mast: small ring with a cross-spar.
function mast(cx: number, cy: number, color: string) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="1.6" fill="none" stroke={color} strokeWidth="1" />
      <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke={color} strokeWidth="0.8" />
    </g>
  );
}

export function renderShipIcon(id: string, size: number, color: string): ReactElement | null {
  if (id.includes('rowboat')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        <path d="M12,10 L16,22 L16,34 Q16,39 12,39 Q8,39 8,34 L8,22 Z" fill={color} opacity="0.9" />
        <line x1="8.5" y1="24" x2="15.5" y2="24" stroke="#000" strokeWidth="1" opacity="0.5" />
        <line x1="8.5" y1="30" x2="15.5" y2="30" stroke="#000" strokeWidth="1" opacity="0.5" />
        {/* oars */}
        <line x1="8" y1="26" x2="2" y2="21" stroke={color} strokeWidth="1.2" />
        <line x1="16" y1="26" x2="22" y2="21" stroke={color} strokeWidth="1.2" />
        <line x1="8" y1="31" x2="2" y2="36" stroke={color} strokeWidth="1.2" />
        <line x1="16" y1="31" x2="22" y2="36" stroke={color} strokeWidth="1.2" />
      </svg>
    );
  }

  if (id.includes('keelboat')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        <path d="M12,4 L17,16 L17,40 Q17,44 12,44 Q7,44 7,40 L7,16 Z" fill={color} opacity="0.9" />
        {station(12, 12, color)}
        {mast(12, 24, color)}
        {helmDot(12, 38, color)}
        {/* a couple of oars */}
        <line x1="7" y1="30" x2="2" y2="27" stroke={color} strokeWidth="1" />
        <line x1="17" y1="30" x2="22" y2="27" stroke={color} strokeWidth="1" />
      </svg>
    );
  }

  if (id.includes('longship')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        {/* long narrow hull with sharp bow and stern */}
        <path d="M12,2 L16,12 L16,38 L12,46 L8,38 L8,12 Z" fill={color} opacity="0.9" />
        {mast(12, 24, color)}
        {helmDot(12, 40, color)}
        {/* shield rows / oars along both rails */}
        {[14, 20, 26, 32].map((y) => (
          <g key={y}>
            <line x1="8" y1={y} x2="3" y2={y - 2} stroke={color} strokeWidth="0.9" />
            <line x1="16" y1={y} x2="21" y2={y - 2} stroke={color} strokeWidth="0.9" />
          </g>
        ))}
      </svg>
    );
  }

  if (id.includes('sailing')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        <path d="M12,3 L18,14 L18,40 Q18,45 12,45 Q6,45 6,40 L6,14 Z" fill={color} opacity="0.9" />
        {/* three masts down the centreline */}
        {mast(12, 14, color)}
        {mast(12, 24, color)}
        {mast(12, 34, color)}
        {/* ballista fore, mangonel aft-ish */}
        {station(12, 9, color)}
        {station(12, 39, color, 2.4)}
        {helmDot(12, 43, color)}
      </svg>
    );
  }

  if (id.includes('warship')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        {/* broad hull with a ram point at the bow */}
        <path d="M12,1 L19,13 L19,40 Q19,45 12,45 Q5,45 5,40 L5,13 Z" fill={color} opacity="0.9" />
        <polygon points="12,1 10,6 14,6" fill={color} />
        {mast(12, 20, color)}
        {mast(12, 33, color)}
        {/* two ballistas fore (sides), two mangonels aft (sides) */}
        {station(8, 12, color)}
        {station(16, 12, color)}
        {station(8, 38, color, 2.4)}
        {station(16, 38, color, 2.4)}
        {helmDot(12, 43, color)}
      </svg>
    );
  }

  if (id.includes('galley')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 48">
        {/* longest hull, ram bow */}
        <path d="M12,1 L18,11 L18,42 Q18,46 12,46 Q6,46 6,42 L6,11 Z" fill={color} opacity="0.9" />
        <polygon points="12,1 10,5 14,5" fill={color} />
        {mast(12, 22, color)}
        {mast(12, 34, color)}
        {/* oar banks along both sides */}
        {[16, 22, 28, 34, 40].map((y) => (
          <g key={y}>
            <line x1="6" y1={y} x2="1.5" y2={y - 2} stroke={color} strokeWidth="0.7" opacity="0.8" />
            <line x1="18" y1={y} x2="22.5" y2={y - 2} stroke={color} strokeWidth="0.7" opacity="0.8" />
          </g>
        ))}
        {/* four ballistas + two mangonels */}
        {station(9, 9, color, 1.6)}
        {station(15, 9, color, 1.6)}
        {station(9, 15, color, 1.6)}
        {station(15, 15, color, 1.6)}
        {station(9, 40, color, 2.2)}
        {station(15, 40, color, 2.2)}
        {helmDot(12, 44, color)}
      </svg>
    );
  }

  return null;
}
