import type { Vehicle } from '../types';
import { NAVAL_TEMPLATES } from '../data/navalTemplates';

/**
 * Encounters saved before 2.9.0 carry ship templates without wind speeds, speed loss or oar crew.
 * For vehicles built from a built-in Saltmarsh ship (matched by template.id), copy those fields
 * (and the component description) onto movement components that lack them. Anything else is untouched.
 */
export function backfillNavalMovement(vehicle: Vehicle): Vehicle {
  const builtIn = NAVAL_TEMPLATES.find((t) => t.id === vehicle.template.id);
  const components = vehicle.template.components;
  if (!builtIn?.components || !components) return vehicle;

  let changed = false;
  const newComponents = components.map((c) => {
    if (c.kind !== 'movement') return c;
    const ref = builtIn.components!.find((b) => b.id === c.id);
    if (!ref) return c;
    if (c.windSpeeds !== undefined || c.speedLoss !== undefined || c.crewRequired !== undefined) return c;
    changed = true;
    return {
      ...c,
      windSpeeds: ref.windSpeeds,
      speedLoss: ref.speedLoss,
      crewRequired: ref.crewRequired,
      description: ref.description,
    };
  });

  return changed ? { ...vehicle, template: { ...vehicle.template, components: newComponents } } : vehicle;
}
