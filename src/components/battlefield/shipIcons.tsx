/**
 * Top-down token icons for the Saltmarsh ships (naval templates).
 *
 * Shared by the DM battlefield (VehicleIcon) and the player view
 * (PlayerViewVehicleIcon) so the six ships are defined once. Bow points UP;
 * orange dots are weapon stations, the black dot is the helm.
 *
 * Each ship is drawn in a viewBox whose height matches its real length:beam
 * ratio (viewBox 24 × H, H = 24 · length / beam), so when it's rendered into a
 * rectangular token box of the same ratio it fills exactly, with no distortion.
 *
 * renderShipIcon(id, width, height, color) returns the SVG for a known ship, or
 * null if the id isn't a ship (callers then fall through to vehicle icons).
 */
import type { ReactElement } from 'react';

const WEAPON = '#ff6b35';

interface ShipSpec {
  H: number; // viewBox height = round(24 * length / beam)
  ram?: boolean;
  pointedStern?: boolean; // longship-style sharp stern
  masts?: number[]; // y-fractions (0..1) along the length
  oarRows?: number[]; // y-fractions; each draws a pair of side oars
  stations?: { x: number; y: number; r?: number }[]; // x in units 8..16, y as a fraction
  helm?: number; // y-fraction of the helm dot
}

function buildShip(width: number, height: number, color: string, spec: ShipSpec): ReactElement {
  const { H, ram, pointedStern, masts = [], oarRows = [], stations = [], helm } = spec;
  const bowY = Math.round(H * 0.14);
  const sternY = Math.round(H * 0.88);
  const endY = H - 1;

  const hullPath = pointedStern
    ? `M12,1 L16,${bowY} L16,${sternY} L12,${endY} L8,${sternY} L8,${bowY} Z`
    : `M12,${ram ? bowY : 1} L17,${bowY} L17,${sternY} Q17,${endY} 12,${endY} Q7,${endY} 7,${sternY} L7,${bowY} Z`;

  const els: ReactElement[] = [<path key="hull" d={hullPath} fill={color} opacity="0.9" />];

  if (ram) els.push(<polygon key="ram" points={`12,0 9,${bowY} 15,${bowY}`} fill={color} />);

  oarRows.forEach((f, i) => {
    const y = Math.round(f * H);
    els.push(
      <g key={`o${i}`}>
        <line x1="7" y1={y} x2="2.5" y2={y - 2} stroke={color} strokeWidth="0.8" opacity="0.85" />
        <line x1="17" y1={y} x2="21.5" y2={y - 2} stroke={color} strokeWidth="0.8" opacity="0.85" />
      </g>
    );
  });

  masts.forEach((f, i) => {
    const cy = Math.round(f * H);
    els.push(
      <g key={`m${i}`}>
        <circle cx="12" cy={cy} r="1.6" fill="none" stroke={color} strokeWidth="1" />
        <line x1="9" y1={cy} x2="15" y2={cy} stroke={color} strokeWidth="0.8" />
      </g>
    );
  });

  stations.forEach((s, i) => {
    els.push(<circle key={`s${i}`} cx={s.x} cy={Math.round(s.y * H)} r={s.r ?? 2} fill={WEAPON} stroke={color} strokeWidth="0.8" />);
  });

  if (helm != null) {
    els.push(<circle key="helm" cx="12" cy={Math.round(helm * H)} r="2.2" fill="#000" stroke={color} strokeWidth="1.2" />);
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 24 ${H}`} preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
      {els}
    </svg>
  );
}

const SPECS: Record<string, ShipSpec> = {
  // Keelboat 60×20 → H 72
  keelboat: { H: 72, masts: [0.46], stations: [{ x: 12, y: 0.2 }], helm: 0.86, oarRows: [0.58, 0.7] },
  // Longship 70×20 → H 84, sharp bow & stern, oar banks, no siege weapons
  longship: { H: 84, pointedStern: true, masts: [0.45], helm: 0.9, oarRows: [0.24, 0.38, 0.52, 0.66] },
  // Sailing ship 100×20 → H 120, three masts, ballista fore + mangonel aft
  sailing_ship: { H: 120, masts: [0.26, 0.46, 0.66], stations: [{ x: 12, y: 0.13 }, { x: 12, y: 0.8, r: 2.4 }], helm: 0.92 },
  // Warship 100×20 → H 120, ram, 2 ballistas fore + 2 mangonels aft
  warship: { H: 120, ram: true, masts: [0.42, 0.66], stations: [{ x: 8, y: 0.24 }, { x: 16, y: 0.24 }, { x: 8, y: 0.78, r: 2.4 }, { x: 16, y: 0.78, r: 2.4 }], helm: 0.93 },
  // Galley 130×20 → H 156, ram, oar banks, 4 ballistas + 2 mangonels
  galley: {
    H: 156,
    ram: true,
    masts: [0.44, 0.68],
    oarRows: [0.3, 0.42, 0.54, 0.66, 0.78],
    stations: [
      { x: 9, y: 0.15, r: 1.6 }, { x: 15, y: 0.15, r: 1.6 },
      { x: 9, y: 0.22, r: 1.6 }, { x: 15, y: 0.22, r: 1.6 },
      { x: 9, y: 0.8, r: 2.2 }, { x: 15, y: 0.8, r: 2.2 },
    ],
    helm: 0.94,
  },
};

export function renderShipIcon(id: string, width: number, height: number, color: string): ReactElement | null {
  if (id.includes('rowboat')) {
    // Small 10×5 boat (H 48): benches + four oars, no mast or weapons.
    return (
      <svg width={width} height={height} viewBox="0 0 24 48" preserveAspectRatio="xMidYMid meet" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12,10 L16,22 L16,34 Q16,39 12,39 Q8,39 8,34 L8,22 Z" fill={color} opacity="0.9" />
        <line x1="8.5" y1="24" x2="15.5" y2="24" stroke="#000" strokeWidth="1" opacity="0.5" />
        <line x1="8.5" y1="30" x2="15.5" y2="30" stroke="#000" strokeWidth="1" opacity="0.5" />
        <line x1="8" y1="26" x2="2" y2="21" stroke={color} strokeWidth="1.2" />
        <line x1="16" y1="26" x2="22" y2="21" stroke={color} strokeWidth="1.2" />
        <line x1="8" y1="31" x2="2" y2="36" stroke={color} strokeWidth="1.2" />
        <line x1="16" y1="31" x2="22" y2="36" stroke={color} strokeWidth="1.2" />
      </svg>
    );
  }

  for (const key of Object.keys(SPECS)) {
    if (id.includes(key)) return buildShip(width, height, color, SPECS[key]);
  }
  return null;
}
