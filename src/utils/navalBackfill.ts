import type { Vehicle } from '../types';
import { NAVAL_TEMPLATES } from '../data/navalTemplates';

/**
 * Encounters saved before 2.9.0 carry ship templates without wind speeds, speed loss or oar crew.
 * For vehicles built from a built-in Saltmarsh ship (matched by template.id), copy those fields
 * (and the component description) onto movement components that lack them. Also restores ship actions (added in 2.10.0).
 * Anything else is untouched.
 */
export function backfillNavalMovement(vehicle: Vehicle): Vehicle {
  const builtIn = NAVAL_TEMPLATES.find((t) => t.id === vehicle.template.id);
  if (!builtIn) return vehicle;

  let template = vehicle.template;

  const components = template.components;
  if (builtIn.components && components) {
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
    if (changed) template = { ...template, components: newComponents };
  }

  if (!template.shipActions && builtIn.shipActions) {
    template = { ...template, shipActions: builtIn.shipActions };
  }

  return template === vehicle.template ? vehicle : { ...vehicle, template };
}
