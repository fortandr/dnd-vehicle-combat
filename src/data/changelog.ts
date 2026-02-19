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
    version: '1.7.0',
    date: '2026-02-19',
    changes: [
      { type: 'feature', description: 'Added custom weapon station upgrade for vehicles' },
      { type: 'fix', description: 'Fixed custom weapon station to properly convert passenger seat' },
      { type: 'fix', description: 'Fixed Crew HP panel showing "-" for crew assigned to custom weapon stations' },
      { type: 'improvement', description: 'Extended metric units to BattlefieldMap, PlayerViewMap, TargetStatus, and VehicleCard (community contribution by @fuinotto)' },
      { type: 'fix', description: 'Fixed encounter saves failing when battlemap background image is set — images now uploaded to Firebase Storage instead of stored inline' },
      { type: 'fix', description: 'Fixed encounter saves failing with undefined field values in Firestore' },
      { type: 'fix', description: 'Fixed loading encounters with corrupted timestamps from earlier saves' },
      { type: 'fix', description: 'Fixed map resize warning dialog spamming on every slider tick — now debounced so it appears once after adjusting' },
      { type: 'fix', description: 'Fixed Firebase deploy hanging in non-interactive environments' },
      { type: 'fix', description: 'Fixed crew zone lookups failing for custom weapon stations across all panels (unified resolveZone utility)' },
      { type: 'fix', description: 'Fixed removing a vehicle during combat leaving stale entries in initiative order' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-02-19',
    changes: [
      { type: 'feature', description: 'Added quantity selector when adding monsters from Open5e — add multiple of the same creature at once' },
      { type: 'fix', description: 'Fixed encounter saves silently failing with no feedback — save/load/delete operations now show success or error notifications' },
      { type: 'fix', description: 'Fixed combat archive save being fire-and-forget (now properly awaited)' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-01-29',
    changes: [
      { type: 'feature', description: 'Added elevation combat mechanics (+2/-2 attack modifiers based on high/low ground)' },
      { type: 'feature', description: 'Added weapon range extension when firing from elevation (10% per 10ft)' },
      { type: 'feature', description: 'Added Target Status panel showing distance, range status, and elevation bonuses per target' },
      { type: 'feature', description: 'Added tabbed Map/Vehicles view in main panel for better workflow' },
      { type: 'feature', description: 'Added PC initiative roll button in sidebar' },
      { type: 'improvement', description: 'Enhanced Vehicle Cards with inline damage dealing, auto-mishap triggering, and crew HP management' },
      { type: 'improvement', description: 'Elevation zone opacity slider now affects borders and labels' },
      { type: 'improvement', description: 'Added map resize warning with proportional scaling option for vehicles and zones' },
      { type: 'fix', description: 'Fixed elevation zones being draggable during combat (now locked)' },
      { type: 'fix', description: 'Fixed elevation zone changes not persisting on save' },
    ],
  },
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
