import type { ProjectSnapshot } from '../collect';
import type { DocMeta } from './meta';
import { makeTable, type DocTable } from './table';

/** Codes and standards that apply, region-correct (US: NEC / UL 508A, Canada: CEC / CSA). */
export function standardsTable(p: ProjectSnapshot, m: DocMeta): DocTable {
  const rows: string[][] = [];
  if (m.region === 'Canada') {
    rows.push(['CSA C22.1', 'Canadian Electrical Code (CEC), Part I — installation; Section 28 (motors), Section 26 (transformers)', 'Installation, branch circuits, motor protection']);
    rows.push(['CSA C22.2 No. 14', 'Industrial control equipment', 'Control panel construction and certification']);
    rows.push(['CSA C22.2 No. 301', 'Industrial electrical machinery', 'Machine electrical equipment (Canadian counterpart of NFPA 79)']);
    rows.push(['NFPA 79', 'Electrical Standard for Industrial Machinery', 'Design practice reference: conductor colours, control circuits, testing']);
    rows.push(['UL 508A Supplement SB', 'Short-circuit current rating of industrial control panels', 'Method used for the SCCR determination (reference)']);
    rows.push(['CSA Z432', 'Safeguarding of machinery', 'Guarding and safety functions']);
    rows.push(['CSA Z460', 'Control of hazardous energy — lockout and other methods', 'Lockout / tagout']);
    rows.push(['CSA Z462', 'Workplace electrical safety', 'Energized work, arc-flash labelling']);
  } else {
    rows.push(['NFPA 70 (NEC)', 'National Electrical Code — Art. 409 (industrial control panels), Art. 430 (motors), Art. 670 (industrial machinery)', 'Installation, branch circuits, motor protection']);
    rows.push(['NFPA 79', 'Electrical Standard for Industrial Machinery', 'Machine electrical equipment, conductor colours, control circuits, testing']);
    rows.push(['UL 508A', 'Industrial Control Panels', 'Control panel construction and listing']);
    rows.push(['UL 508A Supplement SB', 'Short-circuit current rating of industrial control panels', 'Panel SCCR determination and marking']);
    rows.push(['ANSI B11.19', 'Performance requirements for risk reduction measures (safeguarding)', 'Guarding and safety functions']);
    rows.push(['OSHA 29 CFR 1910.147', 'Control of hazardous energy (lockout/tagout)', 'Lockout / tagout']);
    rows.push(['NFPA 70E', 'Standard for Electrical Safety in the Workplace', 'Energized work, arc-flash labelling']);
  }
  rows.push(['ANSI B11.0 / ISO 12100', 'Safety of machinery — general principles, risk assessment and risk reduction', 'Risk assessment (required, by others)']);
  rows.push(['ISO 13849-1 / -2', 'Safety-related parts of control systems — design principles and validation', 'Safety functions, PLr / PL, category']);
  rows.push(['IEC 60204-1', 'Safety of machinery — electrical equipment of machines (reference)', 'Stop categories 0 / 1 / 2, international reference']);
  rows.push(['NEMA 250', 'Enclosures for electrical equipment (1000 V maximum)', `Enclosure type rating${p.electrical ? ` (${p.electrical.inputs.enclosureRating})` : ''}`]);
  if (p.hmi) rows.push(['ANSI/ISA-101.01', 'Human machine interfaces for process automation systems', 'HMI colours, navigation and alarm presentation']);
  rows.push(['IEC 61131-3', 'Programmable controllers — programming languages', `PLC program structure (${p.profile.language === 'ladder' ? 'ladder diagram' : 'structured text'})`]);
  return makeTable([['Standard', 22], ['Title', 60], ['Applied to', 40]], rows);
}

const ABBREVIATIONS: [string, string, (p: ProjectSnapshot) => boolean][] = [
  ['AWG', 'American Wire Gauge', () => true],
  ['BOM', 'Bill of materials', () => true],
  ['CEC', 'Canadian Electrical Code (CSA C22.1)', (p) => p.info.region === 'Canada'],
  ['CSA', 'Canadian Standards Association', (p) => p.info.region === 'Canada'],
  ['DI / DO', 'Discrete (digital) input / output', () => true],
  ['EDM', 'External device monitoring (contactor feedback to the safety relay)', () => true],
  ['E-stop', 'Emergency stop', () => true],
  ['FAT', 'Factory acceptance test', () => true],
  ['FDS', 'Functional design specification', () => true],
  ['FLA', 'Full-load amperes (motor)', () => true],
  ['HMI', 'Human-machine interface (operator touch panel)', () => true],
  ['I/O', 'Inputs and outputs', () => true],
  ['ISA', 'International Society of Automation', () => true],
  ['kA', 'Kiloampere (short-circuit current)', () => true],
  ['LOTO', 'Lockout / tagout', () => true],
  ['MCB', 'Miniature circuit breaker', () => true],
  ['MCR', 'Master control relay', () => true],
  ['MMP', 'Manual motor protector', () => true],
  ['NC / NO', 'Normally closed / normally open contact', () => true],
  ['NEC', 'National Electrical Code (NFPA 70)', (p) => p.info.region !== 'Canada'],
  ['NEMA', 'National Electrical Manufacturers Association', () => true],
  ['NFPA', 'National Fire Protection Association', () => true],
  ['OCPD', 'Overcurrent protective device', () => true],
  ['OL', 'Overload relay', () => true],
  ['PE', 'Protective earth (equipment ground)', () => true],
  ['PL / PLr', 'Performance level / required performance level (ISO 13849-1)', () => true],
  ['PLC', 'Programmable logic controller', () => true],
  ['PM', 'Preventive maintenance', () => true],
  ['PNP', 'Sourcing (positive-switching) sensor output', () => true],
  ['SAT', 'Site acceptance test', () => true],
  ['SCCR', 'Short-circuit current rating', () => true],
  ['SF', 'Safety function', () => true],
  ['TB', 'Terminal block / terminal strip', () => true],
  ['UL', 'Underwriters Laboratories', () => true],
  ['VFD', 'Variable frequency drive', (p) => !!p.electrical?.inputs.motors.some((x) => x.starter === 'vfd')],
];

export function abbreviationsTable(p: ProjectSnapshot): DocTable {
  return makeTable([['Abbreviation', 18], ['Meaning', 80]], ABBREVIATIONS.filter(([, , f]) => f(p)).map(([a, b]) => [a, b]));
}
