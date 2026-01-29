/**
 * Application Changelog
 * Tracks version history and feature additions
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: 'feature' | 'fix' | 'improvement';
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.4.0',
    date: '2026-01-28',
    changes: [
      { type: 'feature', description: 'Added mobile-responsive layout with bottom navigation' },
      { type: 'feature', description: 'Added damage controls for NPCs/enemies in sidebar' },
      { type: 'feature', description: 'Added in-app changelog' },
      { type: 'fix', description: 'Fixed vehicle token drag when overlapping with other tokens' },
      { type: 'fix', description: 'Fixed vehicle token sizing (template IDs now match correctly)' },
      { type: 'fix', description: 'Fixed creature token scaling at close zoom levels' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-01-27',
    changes: [
      { type: 'feature', description: 'Added metric units option in settings' },
      { type: 'fix', description: 'Fixed Open5e monster search debouncing' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-01-26',
    changes: [
      { type: 'feature', description: 'Added Firebase authentication with Google Sign-In' },
      { type: 'feature', description: 'Added cloud storage for encounters and party presets' },
      { type: 'feature', description: 'Added creature factions (party/enemy)' },
      { type: 'feature', description: 'Added chase complication system' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-01-25',
    changes: [
      { type: 'feature', description: 'Added Open5e monster search integration' },
      { type: 'feature', description: 'Added player view broadcast' },
      { type: 'feature', description: 'Added vehicle weapon range arcs visualization' },
      { type: 'improvement', description: 'Improved initiative tracker with turn indicators' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-01-20',
    changes: [
      { type: 'feature', description: 'Initial release' },
      { type: 'feature', description: 'Vehicle combat tracking with Avernus war machines' },
      { type: 'feature', description: 'Creature management and crew assignments' },
      { type: 'feature', description: 'Battlefield map with drag-and-drop positioning' },
      { type: 'feature', description: 'Mishap system with damage thresholds' },
      { type: 'feature', description: 'Multi-scale combat (point blank to strategic)' },
    ],
  },
];
