import type { PhotoDevice, PhotoReading, TerminalStrip } from '../recognise';

/**
 * The cabinet of fixtures/import/cn-rollformer-01 (no PLC: relays KA1–KA10, timer KT1, counter H7CX,
 * VFD U1, safety relay KA0) as the photos would read it: each device with the wire numbers at its
 * terminals, taken from the fixture's drawings (sheets 3–6), and the terminal strips XT0–XT2 from its
 * terminal list (expected.json). On the real cabinet two wires land on KA8:11 (361 from KA7, 341 from
 * the manual-cut button), so both are read there. The coils of KA5–KA7 (switched by the servo drive's
 * outputs) and the field devices are not read.
 */
type Terminal = { strip: string; no: number; wire: string };

const d = (tag: string, category: PhotoDevice['category'], partNumber: string, ratings: string, rail: number, order: number, wires: string): PhotoDevice => ({
  tag, category, manufacturer: '', partNumber, ratings, rail, order, confidence: 'high',
  seen: [{ photo: rail, x: 0.05 + order * 0.07, y: 0.3, w: 0.06, h: 0.2 }],
  wires: wires.split(/\s+/).filter(Boolean).map((tw) => { const [terminal, wire] = tw.split('='); return { terminal, wire }; }),
});

export const ROLLFORMER_DEVICES: PhotoDevice[] = [
  d('QF5', 'breaker', 'NXB-63 1P C6', 'C6 1-pole', 1, 1, '1=L2 2=101'),
  d('G1', 'powerSupply', 'NDR-120-24', '24 VDC 5 A', 1, 2, '+V=24V1 -V=0V'),
  d('KA0', 'safetyRelay', 'PNOZ s3', '24 VDC', 1, 3, '13=101 14=103 23=24V1 24=24VS S12=404 S22=408'),
  d('KM1', 'contactor', 'NXC-12', '220 VAC coil', 1, 4, '13=105 14=107 53=301 54=302 63=24V1 64=601 A1=109 A2=N51'),
  d('FR1', 'overload', 'NXR-12', '4-6 A', 1, 5, '95=107 96=109'),
  d('U1', 'vfd', 'VFD055E43A', '5.5 kW', 1, 6, 'RB=304 RC=305 DCM=501 MI1=502 MI2=503 MI3=504'),
  d('KA1', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 1, '11=309 14=310 21=501 24=502 41=24VS 42=321 A1=310 A2=0V'),
  d('KA2', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 2, '11=324 12=325 21=501 24=502 31=501 34=504 A1=323 A2=0V'),
  d('KA3', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 3, '11=322 12=323 21=501 24=503 31=501 34=504 A1=325 A2=0V'),
  d('KA4', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 4, 'A1=331 A2=0V'),
  d('KA5', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 5, '11=302 14=303'),
  d('KA6', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 6, '11=303 12=304'),
  d('KA7', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 7, '11=24VS 14=361'),
  d('KA8', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 8, '11=361 11=341 12=362 21=24VS 24=363 31=24VS 34=365 A1=364 A2=0V'),
  d('KA9', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 9, '11=307 12=308 A1=24VS A2=332'),
  d('KA10', 'relay', 'JZX-22F(D)/4Z', 'DC24V', 2, 10, '11=308 14=309 A1=24VS A2=333'),
  d('KT1', 'relay', 'H3Y-2', 'timer 2 s, DC24V', 2, 11, '15=305 16=306 A1=362 A2=0V'),
  d('H7CX', 'other', 'H7CX-AD', 'counter', 2, 12, 'OUT=306 NC=307'),
  // on the door
  d('SB1', 'pushbutton', '', 'pump start', 0, 1, '13=105 14=107'),
  d('SB2', 'pushbutton', '', 'pump stop', 0, 2, '11=103 12=105'),
  d('SB3', 'pushbutton', '', 'line start', 0, 3, '13=309 14=310'),
  d('SB4', 'pushbutton', '', 'line stop', 0, 4, '11=24VS 12=301'),
  d('SB5', 'pushbutton', '', 'jog forward', 0, 5, '13=321 14=322'),
  d('SB6', 'pushbutton', '', 'jog reverse', 0, 6, '13=321 14=324'),
  d('SB7', 'pushbutton', '', 'manual cut', 0, 7, '13=321 14=341'),
  d('SA1', 'selector', '', 'servo on', 0, 8, '13=24VS 14=331'),
  d('HL2', 'pilotLight', '', 'pump running', 0, 9, 'X1=601 X2=0V'),
  d('HL3', 'pilotLight', '', 'line running', 0, 10, 'X1=310 X2=0V'),
];

/** The terminal strips as photographed, from the fixture's terminal list. */
export function rollformerReading(terminals: Terminal[]): PhotoReading {
  const strips: TerminalStrip[] = [...new Set(terminals.map((t) => t.strip))].map((tag, i) => ({
    tag, rail: 3, order: i + 1, confidence: 'high', seen: [{ photo: 3, x: 0.1 + i * 0.3, y: 0.7, w: 0.25, h: 0.1 }],
    terminals: terminals.filter((t) => t.strip === tag).map((t) => ({ terminal: String(t.no), wire: t.wire })),
  }));
  return { summary: 'Roll-former relay cabinet (cn-rollformer-01), no PLC.', rails: [], ducts: 4, devices: ROLLFORMER_DEVICES, strips, unseen: [] };
}
