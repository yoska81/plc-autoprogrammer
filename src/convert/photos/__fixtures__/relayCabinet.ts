import type { PhotoReading } from '../recognise';

/**
 * A reading of a relay cabinet without a PLC (the roll-former kind): a 24 VDC supply, a pump
 * contactor with start / stop buttons on the door and its overload, a relay switched by a field limit
 * switch (out and back on XT1), the VFD's run input from that relay, a timer after the pump and a
 * pilot light from the timer. One photo per rail; every wire number readable.
 */
const box = (photo: number, x: number) => [{ photo, x, y: 0.3, w: 0.08, h: 0.2 }];
export const RELAY_CABINET: PhotoReading = {
  summary: 'Relay control cabinet: 24 VDC supply, pump contactor with overload, two relays, a timer, a VFD and a field terminal strip; start / stop buttons on the door.',
  rails: [],
  ducts: 2,
  devices: [
    { tag: 'PS1', category: 'powerSupply', manufacturer: 'Mean Well', partNumber: 'NDR-120-24', ratings: '24 VDC 5 A', rail: 1, order: 1, confidence: 'high', seen: box(0, 0.05), wires: [{ terminal: '+V', wire: '24+' }, { terminal: '-V', wire: '0V' }] },
    { tag: 'KM1', category: 'contactor', manufacturer: 'Schneider', partNumber: 'LC1D09BD', ratings: '24 VDC coil', rail: 1, order: 2, confidence: 'high', seen: box(0, 0.2), wires: [{ terminal: '13', wire: '3' }, { terminal: '14', wire: '5' }, { terminal: '23', wire: '24+' }, { terminal: '24', wire: '13' }, { terminal: 'A1', wire: '7' }, { terminal: 'A2', wire: '0V' }] },
    { tag: 'FR1', category: 'overload', manufacturer: 'Schneider', partNumber: 'LRD08', ratings: '2.5-4 A', rail: 1, order: 3, confidence: 'high', seen: box(0, 0.3), wires: [{ terminal: '95', wire: '5' }, { terminal: '96', wire: '7' }] },
    { tag: 'KA2', category: 'relay', manufacturer: 'Omron', partNumber: 'MY2N-24VDC', ratings: '24 VDC coil', rail: 1, order: 4, confidence: 'high', seen: box(0, 0.4), wires: [{ terminal: 'A1', wire: '9' }, { terminal: 'A2', wire: '0V' }, { terminal: '23', wire: '24+' }, { terminal: '24', wire: '11' }] },
    { tag: 'KT1', category: 'relay', manufacturer: 'Omron', partNumber: 'H3Y-2', ratings: 'timer 0.1 s-10 min, 24 VDC', rail: 1, order: 5, confidence: 'high', seen: box(0, 0.5), wires: [{ terminal: 'A1', wire: '13' }, { terminal: 'A2', wire: '0V' }, { terminal: '15', wire: '24+' }, { terminal: '18', wire: '15' }] },
    { tag: 'VFD1', category: 'vfd', manufacturer: 'Delta', partNumber: 'VFD015EL43A', ratings: '1.5 kW', rail: 2, order: 1, confidence: 'high', seen: box(1, 0.1), wires: [{ terminal: 'MI1', wire: '11' }, { terminal: 'DCM', wire: '0V' }] },
    // on the door
    { tag: 'SB1', category: 'pushbutton', manufacturer: '', partNumber: '', ratings: 'stop, red', rail: 0, order: 1, confidence: 'high', seen: box(2, 0.1), wires: [{ terminal: '11', wire: '24+' }, { terminal: '12', wire: '3' }] },
    { tag: 'SB2', category: 'pushbutton', manufacturer: '', partNumber: '', ratings: 'start, green', rail: 0, order: 2, confidence: 'high', seen: box(2, 0.2), wires: [{ terminal: '13', wire: '3' }, { terminal: '14', wire: '5' }] },
    { tag: 'HL1', category: 'pilotLight', manufacturer: '', partNumber: '', ratings: '24 VDC green', rail: 0, order: 3, confidence: 'high', seen: box(2, 0.3), wires: [{ terminal: 'X1', wire: '15' }, { terminal: 'X2', wire: '0V' }] },
  ],
  strips: [
    // XT1-2 / XT1-3: out to the limit switch SQ1 and back; XT1-4 / XT1-5: the motor's PTC (field only)
    { tag: 'XT1', rail: 3, order: 1, confidence: 'high', seen: box(1, 0.6), terminals: [{ terminal: '1', wire: '24+' }, { terminal: '2', wire: '24+' }, { terminal: '3', wire: '9' }, { terminal: '4', wire: 'T1' }, { terminal: '5', wire: 'T2' }, { terminal: '6', wire: '0V' }] },
  ],
  unseen: [],
};
