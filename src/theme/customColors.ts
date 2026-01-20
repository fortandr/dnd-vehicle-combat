/**
 * Custom color definitions for domain-specific UI elements
 * These colors are used for scale indicators, cover types, and faction identification
 */

export const scaleColors = {
  strategic: '#8b5cf6',   // Purple
  approach: '#3b82f6',    // Blue
  tactical: '#22c55e',    // Green
  point_blank: '#ef4444', // Red
} as const;

export const coverColors = {
  none: '#ef4444',          // Red - no cover
  half: '#eab308',          // Yellow - half cover (+2 AC)
  three_quarters: '#22c55e', // Green - three-quarters cover (+5 AC)
  full: '#3b82f6',          // Blue - full cover (untargetable)
} as const;

export const factionColors = {
  party: '#22c55e',   // Green - player party vehicles
  enemy: '#ff4500',   // Fire red - enemy vehicles
  pc: '#3b82f6',      // Blue - player characters
  npc: '#a855f7',     // Purple - NPCs
} as const;

// Helper to get color with opacity for backgrounds
export const withOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgba
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Scale display names
export const scaleDisplayNames = {
  strategic: 'Strategic',
  approach: 'Approach',
  tactical: 'Tactical',
  point_blank: 'Point Blank',
} as const;

// Cover display names
export const coverDisplayNames = {
  none: 'No Cover',
  half: 'Half Cover (+2)',
  three_quarters: '3/4 Cover (+5)',
  full: 'Full Cover',
} as const;
