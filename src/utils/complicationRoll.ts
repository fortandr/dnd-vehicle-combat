/**
 * Chase complication roll: the pure decision behind the header's
 * "roll a complication" action (manual, or automatically on Next Round).
 *
 * Given a d20 result and the current scale, decide what was rolled, what to
 * write to the combat log, and which dialog the DM should see next.
 */

import { rollComplication, getComplicationRollRange } from '../data/chaseComplications';
import type { ChaseComplication, ScaleName } from '../types';

export type ComplicationModal = 'creatureChase' | 'resolution' | 'info';

export interface ComplicationRollResult {
  roll: number;
  rollRange: string;
  complication: ChaseComplication | null;
  /** Combat-log headline, e.g. "Complication Roll: 3 - Fire Tornado". */
  logLine: string;
  /** Combat-log detail: the complication's effect text, or the "no threat" line. */
  logDetails: string;
  modal: ComplicationModal;
}

const NO_COMPLICATION_TEXT = 'The hellish terrain poses no additional threats this round.';

export function resolveComplicationRoll(roll: number, scale: ScaleName): ComplicationRollResult {
  const complication = rollComplication(roll, scale);
  const rollRange = getComplicationRollRange(roll);

  let modal: ComplicationModal = 'info';
  if (roll <= 2 && complication?.name === 'Creature Chase') {
    modal = 'creatureChase';
  } else if (complication?.mechanicalEffect?.skillCheck) {
    modal = 'resolution';
  }

  return {
    roll,
    rollRange,
    complication,
    logLine: complication
      ? `Complication Roll: ${roll} - ${complication.name}`
      : `Complication Roll: ${roll} - No complication`,
    logDetails: complication ? complication.effect : NO_COMPLICATION_TEXT,
    modal,
  };
}

/** A fresh d20. Kept separate so the decision above stays deterministic and testable. */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}
