import type { PhotoReading } from '../recognise';

/**
 * A recorded reading of 3 photos of one small cabinet (0 = overview with the door open, 1 = close-up
 * of the top rail's nameplates, 2 = close-up of the PLC rail and terminal strip). The AI reported some
 * devices twice (once per photo) — as it does — so the merge has work to do.
 */
export const SMALL_CABINET: PhotoReading = {
  summary: 'Small 16 x 12 in control cabinet: main breaker and two branch breakers, a 24 VDC supply, a CLICK PLC with one input module, one motor starter and a terminal strip.',
  rails: [
    { rail: 1, seen: [{ photo: 0, x: 0.1, y: 0.18, w: 0.8, h: 0.04 }, { photo: 1, x: 0.02, y: 0.45, w: 0.96, h: 0.08 }] },
    { rail: 2, seen: [{ photo: 0, x: 0.1, y: 0.45, w: 0.8, h: 0.04 }, { photo: 2, x: 0.02, y: 0.3, w: 0.96, h: 0.08 }] },
    { rail: 3, seen: [{ photo: 0, x: 0.1, y: 0.72, w: 0.8, h: 0.04 }, { photo: 2, x: 0.02, y: 0.75, w: 0.96, h: 0.06 }] },
  ],
  ducts: 4,
  devices: [
    // Photo 0 (overview): labels readable, most nameplates not.
    { tag: 'CB1', category: 'breaker', manufacturer: '', partNumber: '', ratings: '', rail: 1, order: 1, confidence: 'medium', seen: [{ photo: 0, x: 0.12, y: 0.12, w: 0.06, h: 0.14 }], wires: [] },
    { tag: 'CB2', category: 'breaker', manufacturer: '', partNumber: '', ratings: '', rail: 1, order: 2, confidence: 'medium', seen: [{ photo: 0, x: 0.19, y: 0.12, w: 0.03, h: 0.14 }], wires: [] },
    { tag: 'PS1', category: 'powerSupply', manufacturer: 'RHINO', partNumber: 'PSL-24-030', ratings: '24 VDC 3 A', rail: 1, order: 3, confidence: 'high', seen: [{ photo: 0, x: 0.3, y: 0.11, w: 0.1, h: 0.16 }], wires: [{ terminal: '+V', wire: '24+' }] },
    { tag: 'PLC1', category: 'plc', manufacturer: 'AutomationDirect', partNumber: 'C0-10DD1E-D', ratings: '24 VDC', rail: 2, order: 1, confidence: 'high', seen: [{ photo: 0, x: 0.12, y: 0.38, w: 0.1, h: 0.15 }], wires: [] },
    { tag: '', category: 'contactor', manufacturer: 'Fuji Electric', partNumber: '', ratings: '', rail: 2, order: 3, confidence: 'low', seen: [{ photo: 0, x: 0.45, y: 0.38, w: 0.07, h: 0.13 }], wires: [] },
    // Photo 1 (top rail close-up): the breakers' nameplates — CB1 and CB2 a second time.
    { tag: 'CB1', category: 'breaker', manufacturer: 'Gladiator', partNumber: 'GMCBU-1C-5', ratings: 'C5, 1-pole', rail: 1, order: 1, confidence: 'high', seen: [{ photo: 1, x: 0.05, y: 0.3, w: 0.15, h: 0.4 }], wires: [{ terminal: '1', wire: 'L1' }, { terminal: '2', wire: '101' }] },
    { tag: 'CB2', category: 'breaker', manufacturer: 'Gladiator', partNumber: 'GMCBU-1C-2', ratings: 'C2, 1-pole', rail: 1, order: 2, confidence: 'high', seen: [{ photo: 1, x: 0.22, y: 0.3, w: 0.15, h: 0.4 }], wires: [{ terminal: '2', wire: '102' }] },
    // Photo 2 (PLC rail + terminals): the PLC again, its module, the starter's nameplates.
    { tag: 'PLC1', category: 'plc', manufacturer: 'AutomationDirect', partNumber: 'C0-10DD1E-D', ratings: '', rail: 2, order: 1, confidence: 'high', seen: [{ photo: 2, x: 0.04, y: 0.12, w: 0.18, h: 0.35 }], wires: [{ terminal: 'X1', wire: '1001' }, { terminal: 'Y1', wire: '2001' }, { terminal: 'X2', wire: '1002' }] },
    { tag: '', category: 'plcModule', manufacturer: 'AutomationDirect', partNumber: 'C0-08ND3', ratings: '8 inputs 24 VDC', rail: 2, order: 2, confidence: 'high', seen: [{ photo: 2, x: 0.23, y: 0.12, w: 0.08, h: 0.35 }], wires: [{ terminal: '1', wire: '1101' }] },
    { tag: 'K1', category: 'contactor', manufacturer: 'Fuji Electric', partNumber: 'SC-E02PG-24VDC', ratings: '24 VDC coil', rail: 2, order: 3, confidence: 'high', seen: [{ photo: 2, x: 0.5, y: 0.1, w: 0.12, h: 0.3 }], wires: [{ terminal: 'A1', wire: '2001' }] },
    { tag: 'OL1', category: 'overload', manufacturer: 'Fuji Electric', partNumber: 'TK-E02-72', ratings: '5-8 A', rail: 2, order: 4, confidence: 'medium', seen: [{ photo: 2, x: 0.5, y: 0.4, w: 0.12, h: 0.12 }], wires: [] },
    // A relay half hidden behind the duct: label and nameplate unreadable.
    { tag: '', category: 'relay', manufacturer: '', partNumber: '', ratings: '', rail: 2, order: 5, confidence: 'low', seen: [{ photo: 2, x: 0.7, y: 0.15, w: 0.05, h: 0.2 }], wires: [] },
  ],
  strips: [
    { tag: 'TB1', rail: 3, order: 1, confidence: 'medium', seen: [{ photo: 0, x: 0.12, y: 0.68, w: 0.6, h: 0.08 }], terminals: [{ terminal: '1', wire: '24+' }] },
    { tag: 'TB1', rail: 3, order: 1, confidence: 'high', seen: [{ photo: 2, x: 0.05, y: 0.7, w: 0.9, h: 0.15 }], terminals: [{ terminal: '1', wire: '24+' }, { terminal: '2', wire: '0V' }, { terminal: '3', wire: '1001' }, { terminal: '4', wire: '1101' }] },
  ],
  unseen: ['Wires 101 and 102 from CB1 and CB2 run behind the left duct: what do they feed?', 'What feeds the main breaker CB1 (supply voltage and source)?'],
};
