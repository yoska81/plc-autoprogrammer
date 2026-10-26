/**
 * PREVIEW FIXTURE ONLY — do not import from app code.
 * A realistic sample machine used to preview/screenshot the drawing set:
 * CLICK C0-10DD1E-D, 480VAC 3PH, NEMA 12, M1 2HP contactor+overload, M2 1HP VFD,
 * E-stop + safety relay, start/stop/reset, 3 pilot lights, 8 sensors, 4 solenoids, stack light.
 * Part numbers prefixed "FX-" are placeholders and every description says FIXTURE; the
 * CLICK CPU/module numbers are real AutomationDirect numbers but their data here is
 * fixture data, not verified catalog data.
 */
import type { CatalogPart, ElectricalDesign } from '../../types';
import type { DrawingContext } from '../../derive';

const P = (p: Omit<CatalogPart, 'url' | 'verified' | 'manufacturer'> & { manufacturer?: string }): CatalogPart => ({
  manufacturer: 'AutomationDirect', url: 'https://www.automationdirect.com', verified: false, ...p,
  description: `FIXTURE — ${p.description}`,
});

export const FIXTURE_PARTS: CatalogPart[] = [
  P({ partNumber: 'FX-ENC-363010', category: 'enclosure', description: 'NEMA 12 enclosure 36"H x 30"W x 10"D, with back panel', mount: 'backplate', widthMm: 762, heightMm: 914, ratings: { nema: '12', backPanelWidthMm: 686, backPanelHeightMm: 838, depthMm: 254 } }),
  P({ partNumber: 'FX-DISC-40A-3P', category: 'disconnect', description: 'Rotary disconnect switch 40A 3P, through-door handle', mount: 'backplate', widthMm: 70, heightMm: 105, ratings: { amps: 40, poles: 3 } }),
  P({ partNumber: 'FX-CB-D10-3P', category: 'breaker', description: 'UL 489 circuit breaker 10A 3P D-curve', mount: 'backplate', widthMm: 54, heightMm: 90, ratings: { amps: 10, poles: 3 } }),
  P({ partNumber: 'FX-CB-C4-2P', category: 'breaker', description: 'UL 489 circuit breaker 4A 2P C-curve', mount: 'backplate', widthMm: 36, heightMm: 90, ratings: { amps: 4, poles: 2 } }),
  P({ partNumber: 'FX-PS24-240W', category: 'powerSupply', description: '24VDC 10A 240W power supply, 380-480VAC 2-phase input', mount: 'backplate', widthMm: 63, heightMm: 125, ratings: { outputVoltage: '24VDC', amps: 10, watts: 240, phases: 2 } }),
  P({ partNumber: 'C0-10DD1E-D', category: 'plc', description: 'CLICK Ethernet Basic PLC, 8 DC in / 6 DC sinking out, 24VDC', mount: 'backplate', widthMm: 54.6, heightMm: 90, ratings: { inputs: 8, outputs: 6, outputType: 'sinking' } }),
  P({ partNumber: 'C0-16ND3', category: 'plcModule', description: 'CLICK 16-point 24VDC sink/source input module', mount: 'backplate', widthMm: 25.2, heightMm: 90, ratings: { inputs: 16, slot: 1 } }),
  P({ partNumber: 'C0-08TD2', category: 'plcModule', description: 'CLICK 8-point 24VDC sourcing output module', mount: 'backplate', widthMm: 25.2, heightMm: 90, ratings: { outputs: 8, slot: 2, outputType: 'sourcing' } }),
  P({ partNumber: 'FX-CTR-9A-24D', category: 'contactor', description: 'IEC contactor 9A, 24VDC coil, 1NO aux', mount: 'backplate', widthMm: 45, heightMm: 82, ratings: { amps: 9, coil: '24VDC', poles: 3 } }),
  P({ partNumber: 'FX-OL-2.5-4', category: 'overload', description: 'Thermal overload relay 2.5-4A, direct mount', mount: 'backplate', widthMm: 45, heightMm: 70, ratings: { range: '2.5-4' } }),
  P({ partNumber: 'FX-VFD-1HP-480', category: 'vfd', description: 'AC drive 1HP 480VAC 3PH input', mount: 'backplate', widthMm: 72, heightMm: 142, ratings: { hp480: 1, amps: 2.1 } }),
  P({ partNumber: 'FX-SR-24DC', category: 'safetyRelay', description: 'Safety relay, dual channel E-stop, manual reset, 2NO + 1NC, 24VDC', mount: 'backplate', widthMm: 22.5, heightMm: 100, ratings: { coil: '24VDC' } }),
  P({ partNumber: 'FX-RLY-24D-2C', category: 'relay', description: 'Force-guided relay 24VDC, 2NO/2NC (MCR)', mount: 'backplate', widthMm: 22.5, heightMm: 85, ratings: { coil: '24VDC' } }),
  P({ partNumber: 'FX-PB-GRN-NO', category: 'pushbutton', description: '22mm flush pushbutton green 1NO', mount: 'door', ratings: { color: 'green' } }),
  P({ partNumber: 'FX-PB-RED-NC', category: 'pushbutton', description: '22mm flush pushbutton red 1NC', mount: 'door', ratings: { color: 'red' } }),
  P({ partNumber: 'FX-PB-BLU-NO', category: 'pushbutton', description: '22mm flush pushbutton blue 1NO', mount: 'door', ratings: { color: 'blue' } }),
  P({ partNumber: 'FX-ES-40-2NC1NO', category: 'estop', description: '40mm E-stop mushroom, twist release, 2NC + 1NO', mount: 'door', ratings: { color: 'red' } }),
  P({ partNumber: 'FX-PL-WHT-24', category: 'pilotLight', description: '22mm LED pilot light white 24VAC/DC', mount: 'door', ratings: { color: 'white' } }),
  P({ partNumber: 'FX-PL-GRN-24', category: 'pilotLight', description: '22mm LED pilot light green 24VAC/DC', mount: 'door', ratings: { color: 'green' } }),
  P({ partNumber: 'FX-PL-RED-24', category: 'pilotLight', description: '22mm LED pilot light red 24VAC/DC', mount: 'door', ratings: { color: 'red' } }),
  P({ partNumber: 'FX-STK-3C-24', category: 'stackLight', description: 'Stack light red/amber/green 24VDC', mount: 'field', ratings: {} }),
  P({ partNumber: 'FX-PRX-M18-PNP', category: 'sensor', description: 'Inductive prox M18 PNP NO 3-wire, M12 connector', mount: 'field', ratings: { output: 'PNP' } }),
  P({ partNumber: 'FX-SOL-24D', category: 'solenoidValve', description: '5/2 solenoid valve 24VDC', mount: 'field', ratings: { coil: '24VDC' } }),
  P({ partNumber: 'FX-TB-2.5', category: 'terminal', description: 'Feed-through terminal block 2.5mm2, grey', mount: 'backplate', widthMm: 5.2, heightMm: 45, ratings: {} }),
  P({ partNumber: 'FX-TB-2.5-PE', category: 'terminal', description: 'Ground (PE) terminal block 2.5mm2, green/yellow', mount: 'backplate', widthMm: 5.2, heightMm: 45, ratings: { type: 'ground' } }),
  P({ partNumber: 'FX-TB-EC', category: 'terminalAccessory', description: 'Terminal end cover (end plate)', mount: 'backplate', ratings: {} }),
  P({ partNumber: 'FX-TB-ES', category: 'terminalAccessory', description: 'Terminal end stop (end bracket)', mount: 'backplate', ratings: {} }),
  P({ partNumber: 'FX-DIN-35', category: 'dinRail', description: '35mm DIN rail, 1m', mount: 'backplate', ratings: {} }),
  P({ partNumber: 'FX-DUCT-1.5X3', category: 'wireDuct', description: 'Slotted wire duct 1.5"W x 3"H, 2m with cover', mount: 'backplate', ratings: {} }),
  P({ partNumber: 'FX-GB-14', category: 'groundBar', description: 'Ground bar kit, 14 terminals', mount: 'backplate', widthMm: 120, heightMm: 25, ratings: {} }),
];

const byPn = new Map(FIXTURE_PARTS.map((p) => [p.partNumber, p] as const));
export const fixtureGetPart = (pn: string): CatalogPart | undefined => byPn.get(pn);

const C = (tag: string, partNumber: string, fn: string, motorTag: string | null = null, quantity = 1) => ({ tag, partNumber, quantity, function: fn, motorTag });

export function sampleDesign(opts: { reversing?: boolean } = {}): ElectricalDesign {
  return {
    inputs: {
      supply: '480VAC-3PH', enclosureRating: 'NEMA 12', notes: 'Stack light on enclosure top. 20% spare space.',
      motors: [
        { tag: 'M1', description: 'Infeed conveyor', hp: 2, voltage: '480VAC-3PH', starter: 'contactor-overload', reversing: !!opts.reversing },
        { tag: 'M2', description: 'Discharge conveyor', hp: 1, voltage: '480VAC-3PH', starter: 'vfd', reversing: false },
      ],
      requiredParts: [],
    },
    components: [
      C('ENC1', 'FX-ENC-363010', 'Main control enclosure'),
      C('DS1', 'FX-DISC-40A-3P', 'Main disconnect'),
      C('CB1', 'FX-CB-D10-3P', 'M1 branch circuit protection', 'M1'),
      C('CB2', 'FX-CB-D10-3P', 'M2 VFD branch circuit protection', 'M2'),
      C('CB3', 'FX-CB-C4-2P', 'Power supply PS1 primary protection'),
      C('PS1', 'FX-PS24-240W', '24VDC control power supply'),
      C('PLC1', 'C0-10DD1E-D', 'PLC CPU'),
      C('IO1', 'C0-16ND3', 'Input module slot 1'),
      C('IO2', 'C0-08TD2', 'Output module slot 2'),
      ...(opts.reversing
        ? [C('K1F', 'FX-CTR-9A-24D', 'M1 forward contactor', 'M1'), C('K1R', 'FX-CTR-9A-24D', 'M1 reverse contactor', 'M1')]
        : [C('K1', 'FX-CTR-9A-24D', 'M1 run contactor', 'M1')]),
      C('OL1', 'FX-OL-2.5-4', 'M1 overload relay', 'M1'),
      C('VFD1', 'FX-VFD-1HP-480', 'M2 drive', 'M2'),
      C('SR1', 'FX-SR-24DC', 'E-stop safety relay'),
      C('CR1', 'FX-RLY-24D-2C', 'Master control relay (MCR)'),
      C('PB1', 'FX-PB-GRN-NO', 'Start'),
      C('PB2', 'FX-PB-RED-NC', 'Stop'),
      C('PB3', 'FX-PB-BLU-NO', 'Reset'),
      C('ES1', 'FX-ES-40-2NC1NO', 'Emergency stop'),
      C('PL1', 'FX-PL-WHT-24', 'Control power on'),
      C('PL2', 'FX-PL-GRN-24', 'Running'),
      C('PL3', 'FX-PL-RED-24', 'Fault'),
      C('SL1', 'FX-STK-3C-24', 'Machine status stack light'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => C(`PRS${i}`, 'FX-PRX-M18-PNP', `Part sensor ${i}`)),
      ...[1, 2, 3, 4].map((i) => C(`SOL${i}`, 'FX-SOL-24D', `Cylinder ${i} extend`)),
      C('TB', 'FX-TB-2.5', 'Feed-through terminals', null, 60),
      C('TBPE', 'FX-TB-2.5-PE', 'Ground terminals', null, 4),
      C('TBEC', 'FX-TB-EC', 'Terminal end covers', null, 3),
      C('TBES', 'FX-TB-ES', 'Terminal end stops', null, 6),
      C('DIN', 'FX-DIN-35', 'DIN rail', null, 3),
      C('WD', 'FX-DUCT-1.5X3', 'Wire duct', null, 4),
      C('GND1', 'FX-GB-14', 'Main ground bar'),
    ],
    ioWiring: [
      { address: 'X001', deviceTag: 'PB1', deviceType: 'pushbutton-no', description: 'Start' },
      { address: 'X002', deviceTag: 'PB2', deviceType: 'pushbutton-nc', description: 'Stop' },
      { address: 'X003', deviceTag: 'PB3', deviceType: 'pushbutton-no', description: 'Reset' },
      { address: 'X004', deviceTag: 'SR1', deviceType: 'safety-relay-output', description: 'Safety OK' },
      { address: 'X005', deviceTag: 'ES1', deviceType: 'estop-contact', description: 'E-stop pressed (monitor)' },
      ...[1, 2, 3].map((i) => ({ address: `X00${5 + i}`, deviceTag: `PRS${i}`, deviceType: 'sensor-pnp' as const, description: `Part sensor ${i}` })),
      ...[4, 5, 6, 7, 8].map((i) => ({ address: `X10${i - 3}`, deviceTag: `PRS${i}`, deviceType: 'sensor-pnp' as const, description: `Part sensor ${i}` })),
      ...[1, 2, 3, 4].map((i) => ({ address: `Y00${i}`, deviceTag: `SOL${i}`, deviceType: 'solenoid' as const, description: `Cylinder ${i} extend` })),
      { address: 'Y005', deviceTag: 'PL2', deviceType: 'pilot-light', description: 'Running lamp' },
      { address: 'Y006', deviceTag: 'PL3', deviceType: 'pilot-light', description: 'Fault lamp' },
      ...(opts.reversing
        ? [{ address: 'Y201', deviceTag: 'K1F', deviceType: 'contactor-coil' as const, description: 'M1 infeed forward' }, { address: 'Y209', deviceTag: 'K1R', deviceType: 'contactor-coil' as const, description: 'M1 infeed reverse' }]
        : [{ address: 'Y201', deviceTag: 'K1', deviceType: 'contactor-coil' as const, description: 'M1 infeed conveyor run' }]),
      { address: 'Y202', deviceTag: 'VFD1', deviceType: 'vfd-input', description: 'M2 discharge conveyor run' },
      { address: 'Y203', deviceTag: 'SL1', deviceType: 'stack-light', description: 'Stack light red' },
      { address: 'Y204', deviceTag: 'SL1', deviceType: 'stack-light', description: 'Stack light amber' },
      { address: 'Y205', deviceTag: 'SL1', deviceType: 'stack-light', description: 'Stack light green' },
    ],
    notes: [
      'M1 overload set to motor nameplate FLA (approx. 3.4A at 480V).',
      'VFD1 parameters: 2-wire run from PLC Y202; set accel/decel per conveyor.',
      'E-stop ES1: 2NC to safety relay SR1, 1NO to PLC X005 for indication only.',
    ],
    generatedAt: '2026-10-16T12:00:00.000Z',
  };
}

export function sampleContext(opts: { reversing?: boolean } = {}): DrawingContext {
  const design = sampleDesign(opts);
  const io = design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: (w.address.startsWith('X') ? 'input' : 'output') as 'input' | 'output' }));
  return {
    projectName: 'Infeed Transfer Cell',
    design,
    getPart: fixtureGetPart,
    plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: 'C0-10DD1E-D — Ethernet Basic (8 DC in / 6 DC sinking out)' },
    io,
  };
}
