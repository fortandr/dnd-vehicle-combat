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
    version: '2.3.1',
    date: '2026-07-28',
    changes: [
      { type: 'fix', description: 'Ships no longer show Avernus mishap UI (mishap threshold, the "Roll Mishap" button, and mishap-on-damage rolls). Mishaps are an infernal war-machine mechanic; Saltmarsh ships take harm through their components instead, so it never applied to boats.' },
    ],
  },
  {
    version: '2.3.0',
    date: '2026-07-27',
    changes: [
      { type: 'feature', description: 'Component combat for ships: each part (hull, helm, sails/oars, weapon stations) tracks its own HP in a new Components panel for targeted damage and repair, respecting per-part damage thresholds.' },
      { type: 'feature', description: 'Destroyed components have consequences — a wrecked hull disables the ship, a destroyed helm stops it from turning, lost movement components cut its speed (0 if all propulsion is gone), and a destroyed weapon can no longer fire.' },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-07-27',
    changes: [
      { type: 'feature', description: 'Added the Naval customization pack — "Ship Upgrades" (Superior Ship Upgrades from Ghosts of Saltmarsh): 22 hull, movement, weapon, figurehead, and miscellaneous upgrades installable per ship (e.g. Reinforced Hull, Ever-Full Sails, Arcane Artillery, Red Dragon Figurehead). Shown only on naval vehicles, the water-side analog to Avernus gadgets.' },
    ],
  },
  {
    version: '2.1.2',
    date: '2026-07-27',
    changes: [
      { type: 'fix', description: 'Vehicle customization (Avernus armor upgrades, magical gadgets, and weapon stations) now only appears on Avernus war machines — ships and other-campaign vehicles no longer show infernal upgrades. Groundwork for per-pack content.' },
    ],
  },
  {
    version: '2.1.1',
    date: '2026-07-27',
    changes: [
      { type: 'fix', description: 'Ships now render as chunky, readable boat tokens (capped at ~2.5:1) instead of book-accurate slivers, and no longer shrink to a sliver at coarse map zoom — they stay boat-shaped and clickable at any scale' },
      { type: 'feature', description: 'Added a Passengers zone to every ship (book passenger capacity, e.g. Sailing Ship 20, Longship 100) so you can place your party aboard, separate from the working crew' },
      { type: 'improvement', description: 'You can now create a character directly in any vehicle seat — the "+" on a crew or passenger station offers "New crew/passenger here", instead of a dead end when no creatures exist yet' },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-07-27',
    changes: [
      { type: 'feature', description: 'Added distinct top-down token icons for each ship type (rowboat, keelboat, longship, sailing ship, warship, galley) on both the DM and player battlefield views' },
      { type: 'feature', description: 'Ships now use true rectangular footprints scaled to their book dimensions (a 130-ft galley towers over a 10-ft rowboat) instead of a one-size square' },
      { type: 'fix', description: 'Fixed ship crew stations — ships now show a Helm, a station per weapon, and a Deck Crew/Rowers station (e.g. the Sailing Ship has 4 stations for its 30 crew, not 2)' },
      { type: 'improvement', description: 'Large deck/rowers crew is shown as a compact count (e.g. "5 / 73") instead of a slot per crew member, so big ships stay readable' },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-07-24',
    changes: [
      { type: 'feature', description: 'Renamed the app to VVTT (Vehicular Virtual Table Top), now hosted at vvtt.lukantan.com' },
      { type: 'feature', description: 'Added a personal vehicle library — create, edit, duplicate, and delete your own custom vehicle templates right from the Add Vehicle dialog' },
      { type: 'feature', description: 'Vehicle templates now support a per-component HP model (hull, helm, sails/oars, weapon stations) so ships can be represented faithfully' },
      { type: 'feature', description: 'Added six built-in ships from Ghosts of Saltmarsh — rowboat, keelboat, longship, sailing ship, warship, and galley — each with full per-component stats' },
      { type: 'feature', description: 'Added an environment field (land / water / air) to vehicles — groundwork for naval and aerial combat beyond Avernus' },
      { type: 'improvement', description: 'Vehicle templates are now served through a registry that merges the built-in Avernus vehicles with your personal library' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-04-22',
    changes: [
      { type: 'feature', description: 'Added combat log export — copy as Markdown (for pasting into Claude to generate recaps), copy as JSON, or download as .md' },
      { type: 'fix', description: 'Fixed vehicle movement distance resetting when switching between the Map and Vehicles tabs mid-turn — partial movement now persists for the full round' },
      { type: 'improvement', description: 'Undo stack for battlefield moves also persists across tab switches' },
    ],
  },
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
