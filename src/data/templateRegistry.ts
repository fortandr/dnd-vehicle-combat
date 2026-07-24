/**
 * Vehicle Template Registry
 *
 * The single seam through which the app discovers vehicle templates. Consumers
 * ask for "what can I add to an encounter?" here instead of importing the
 * built-in array directly, so future tiers (personal library, shared community
 * library) can be plugged in without touching call sites.
 *
 * See VEHICLE_LIBRARY_PLAN.md for the full design.
 *
 * Phase 0: only the built-in (Avernus) tier is populated. The personal-template
 * cache below is the Phase 1 plug-in point — it stays empty until the personal
 * library ships.
 */
import { VehicleTemplate } from '../types';
import { VEHICLE_TEMPLATES } from './vehicleTemplates';

// Tag the shipped Avernus templates as 'builtin' here, so the source-of-truth
// data file stays free of registry concerns. Copied once at module load.
const BUILTIN_TEMPLATES: VehicleTemplate[] = VEHICLE_TEMPLATES.map((t) => ({
  ...t,
  source: 'builtin' as const,
}));

// Populated in Phase 1 from the signed-in user's Firestore vehicleTemplates
// collection. Kept as a synchronous in-memory cache so consumers stay sync —
// the async load happens once elsewhere and calls setPersonalTemplates().
let personalTemplates: VehicleTemplate[] = [];

/**
 * Replace the in-memory personal-template cache. Phase 1 will call this after
 * loading the user's saved templates; until then it is unused and the personal
 * tier is empty.
 */
export function setPersonalTemplates(templates: VehicleTemplate[]): void {
  personalTemplates = templates.map((t) => ({ ...t, source: 'personal' as const }));
}

/** Every template a user can currently add to an encounter, across all tiers. */
export function getAvailableTemplates(): VehicleTemplate[] {
  return [...BUILTIN_TEMPLATES, ...personalTemplates];
}

/** Resolve a single template by id across all known tiers. */
export function resolveTemplate(id: string): VehicleTemplate | undefined {
  return getAvailableTemplates().find((t) => t.id === id);
}
