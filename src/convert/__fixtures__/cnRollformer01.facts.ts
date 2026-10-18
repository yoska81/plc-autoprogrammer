/**
 * Ground truth for the shared fixture cn-rollformer-01 (HC-YX840-E01 rev B, a roll-forming line with a
 * servo flying shear and relay logic, no PLC; 8 bilingual A3 sheets). The drawing files are held outside
 * this public repo; these are the facts the side manager gave for them. Some part numbers were written
 * from memory: the score never treats a part number as verified.
 */
import type { ExpectedFacts } from '../score';

export const CN_ROLLFORMER_01: ExpectedFacts = {
  name: 'cn-rollformer-01',
  hasPlc: false,
  supply: { volts: 380, hz: 50, phases: 3 },
  motors: [
    { tag: 'M1', kw: 5.5, driveTag: 'U1' },
    { tag: 'M2', kw: 2.2, driveTag: null },
    { tag: 'M3', kw: 1.5, driveTag: 'U2', servo: true },
  ],
  // the 28 field signals
  signals: ['SB0', 'SB10', 'SQ5', 'SB9', 'SB1', 'SB2', 'SB3', 'SB4', 'SB5', 'SB6', 'SB7', 'SB8', 'SA1', 'SQ1', 'SQ2', 'SQ3', 'SQ4', 'B1',
    'U1 RA/RB/RC', 'U2 DO', 'H7CX', 'HL1', 'HL2', 'HL3', 'HL4', 'HL5', 'YV1', 'YV2'],
  relays: ['KA0', 'KA1', 'KA2', 'KA3', 'KA4', 'KA5', 'KA6', 'KA7', 'KA8', 'KA9', 'KA10', 'KT1', 'H7CX'],
  // each coil and the devices whose contacts are in its path (C1–C11)
  relayLogic: [
    { id: 'C1', coil: 'KM1', contacts: ['KA0', 'SB2', 'SB1', 'KM1', 'FR1'], sealIn: 'KM1' },
    { id: 'C2', coil: 'KA1', contacts: ['SB4', 'KM1', 'KA5', 'KA6', 'U1', 'KT1', 'H7CX', 'KA9', 'KA10', 'SB3', 'KA1'], sealIn: 'KA1' },
    { id: 'C3a', coil: 'KA2', contacts: ['KA1', 'SB5', 'KA3'], sealIn: null },
    { id: 'C3b', coil: 'KA3', contacts: ['KA1', 'SB6', 'KA2'], sealIn: null },
    { id: 'C4', coil: 'KA4', contacts: ['SA1'], sealIn: null },
    { id: 'C5a', coil: 'KA9', contacts: ['SQ3'], sealIn: null },
    { id: 'C5b', coil: 'KA10', contacts: ['SQ4'], sealIn: null },
    { id: 'C6a', coil: 'KA5', contacts: ['U2'], sealIn: null },
    { id: 'C6b', coil: 'KA6', contacts: ['U2'], sealIn: null },
    { id: 'C6c', coil: 'KA7', contacts: ['U2'], sealIn: null },
    { id: 'C7', coil: 'YV1', contacts: ['KA7', 'SB7', 'KA8'], sealIn: null },
    { id: 'C7t', coil: 'KT1', contacts: ['KA7', 'SB7', 'KA8'], sealIn: null },
    { id: 'C8', coil: 'KA8', contacts: ['SQ1', 'KA8', 'SQ2'], sealIn: 'KA8' },
    { id: 'C8v', coil: 'YV2', contacts: ['KA8'], sealIn: null },
    { id: 'C9', coil: 'H7CX', contacts: ['KA8', 'SB8'], sealIn: null },
    { id: 'C10', coil: 'HL4', contacts: ['KA6', 'U1'], sealIn: null },
    { id: 'C11', coil: 'U1 MI1', contacts: ['KA1', 'KA2'], sealIn: null },
  ],
  motion: { axisDrive: 'U2', encoder: 'B1', mode: /cam|flying/i, cutLength: [300, 6000] },
  safety: { estops: ['SB0', 'SB10'], guards: ['SQ5'], safetyRelay: 'KA0', claimed: /cat\s*3|pl\s*d/i, stoFinding: true },
};
