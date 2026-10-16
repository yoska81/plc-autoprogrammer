/**
 * PREVIEW FIXTURE ONLY — do not import from app code.
 * A small machine built from real catalog parts (src/electrical/catalog.ts) to check
 * the panel/door layout against real enclosure, subpanel and accessory data.
 */
import { getPart } from '../../catalog';
import type { ElectricalDesign } from '../../types';
import type { DrawingContext } from '../../derive';

const C = (tag: string, partNumber: string, fn: string, motorTag: string | null = null, quantity = 1) => ({ tag, partNumber, quantity, function: fn, motorTag });

export function realCatalogDesign(): ElectricalDesign {
  return {
    inputs: {
      supply: '240VAC-3PH', enclosureRating: 'NEMA 12', notes: '',
      motors: [{ tag: 'M1', description: 'Conveyor', hp: 0.5, voltage: '240VAC-3PH', starter: 'contactor-overload', reversing: false }],
      requiredParts: [],
    },
    components: [
      C('ENC1', 'SCE-24EL2008LP', 'Main control enclosure'),
      C('SP1', 'SCE-24P20', 'Subpanel'),
      C('DS1', '22013003', 'Main disconnect'),
      C('DS1H', '14831111', 'Disconnect handle'),
      C('DS1S', '14070520', 'Disconnect shaft'),
      C('CB1', 'GMCBU-3C-5', 'M1 branch circuit protection', 'M1'),
      C('CB2', 'GMCBU-2C-10', 'Power supply PS1 primary protection'),
      C('PS1', 'PSR-24-120', '24VDC control power supply'),
      C('K1', 'SC-E02PG-24VDC', 'M1 contactor', 'M1'),
      C('OL1', 'TK-E02-220', 'M1 overload relay', 'M1'),
      C('PLC1', 'C0-10DD1E-D', 'PLC CPU'),
      C('SR1', 'LG5925-48-61-24', 'E-stop safety relay'),
      C('PB1', 'GCX1102', 'Start'),
      C('PB2', 'GCX1101', 'Stop'),
      C('PB3', 'GCX1104', 'Reset'),
      C('ES1', 'GCX1131', 'Emergency stop'),
      C('PL1', 'GCX1232-24L', 'Running'),
      C('PRS1', 'PNK-AP-3H', 'Part present'),
      C('PRS2', 'PNK-AP-3H', 'Conveyor end'),
      C('SOL1', '100222015324006', 'Pusher extend'),
      C('TB', 'DN-T10-A', 'Terminal blocks', null, 40),
      C('TBEC', 'DN-EC1210', 'Terminal end covers', null, 3),
      C('TBES', 'DN-EB35', 'DIN rail end stops', null, 6),
      C('TBJ', 'DN-2J4Y', 'Terminal jumpers', null, 10),
      C('TBM', 'DN-L50', 'Terminal markers'),
      C('GB1', 'SCE-GB10', 'Ground bar'),
      C('WD', 'T1-1530G-1', 'Wire duct', null, 3),
      C('DIN', 'DN-R35S1', 'DIN rail', null, 1),
    ],
    ioWiring: [
      { address: 'X001', deviceTag: 'PB1', deviceType: 'pushbutton-no', description: 'Start' },
      { address: 'X002', deviceTag: 'PB2', deviceType: 'pushbutton-nc', description: 'Stop' },
      { address: 'X003', deviceTag: 'PB3', deviceType: 'pushbutton-no', description: 'Reset' },
      { address: 'X004', deviceTag: 'SR1', deviceType: 'safety-relay-output', description: 'Safety OK' },
      { address: 'X005', deviceTag: 'PRS1', deviceType: 'sensor-pnp', description: 'Part present' },
      { address: 'X006', deviceTag: 'PRS2', deviceType: 'sensor-pnp', description: 'Conveyor end' },
      { address: 'Y001', deviceTag: 'K1', deviceType: 'contactor-coil', description: 'Conveyor run' },
      { address: 'Y002', deviceTag: 'SOL1', deviceType: 'solenoid', description: 'Pusher extend' },
      { address: 'Y003', deviceTag: 'PL1', deviceType: 'pilot-light', description: 'Running lamp' },
    ],
    notes: ['Real-catalog preview fixture.'],
    generatedAt: '2026-10-16T12:00:00.000Z',
  };
}

export function realCatalogContext(): DrawingContext {
  const design = realCatalogDesign();
  return {
    projectName: 'Real Catalog Check',
    design,
    getPart,
    plc: { vendor: 'AutomationDirect', name: 'CLICK', cpuPartNumber: 'C0-10DD1E-D', cpuLabel: 'C0-10DD1E-D — Ethernet Basic (8 DC in / 6 DC sinking out)' },
    io: design.ioWiring.map((w) => ({ address: w.address, description: w.description, type: w.address.startsWith('X') ? 'input' as const : 'output' as const })),
  };
}
