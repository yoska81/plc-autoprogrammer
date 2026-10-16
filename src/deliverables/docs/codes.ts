import type { ProjectSnapshot } from '../collect';
import type { DocMeta } from './meta';
import { isIec, NEMA_TO_IP, regionSpec } from '../../standards/regions';
import { makeTable, type DocTable } from './table';

/** Codes and standards that apply, region-correct (US: NEC / UL 508A, Canada: CEC / CSA). */
export function standardsTable(p: ProjectSnapshot, m: DocMeta): DocTable {
  const rows: string[][] = [];
  if (isIec(m.region)) return makeTable([['Standard', 22], ['Title', 60], ['Applied to', 40]], iecStandards(p, m.region));
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

/** IEC regions (Europe, Israel, other IEC countries): IEC 60204-1 practice. */
function iecStandards(p: ProjectSnapshot, region: string): string[][] {
  const r = regionSpec(region);
  const rows: string[][] = [];
  if (r.value === 'Israel') {
    rows.push(['SI 60204-1 (IEC 60204-1)', 'Safety of machinery — electrical equipment of machines (Israeli adoption; confirm edition and official status with SII)', 'Machine electrical equipment, colours, protection, testing']);
    rows.push(['Electricity Law 1954 and Regulations', 'Israeli electricity regulations, incl. earthing and protection against electric shock up to 1000 V (1991)', 'Installation; site earthing system (TN-C-S/TN-S or TT); licensed electrician']);
  } else rows.push(['IEC 60204-1 (EN 60204-1)', 'Safety of machinery — electrical equipment of machines', 'Machine electrical equipment, colours, protection, testing']);
  rows.push(['IEC 61439-1 / -2', 'Low-voltage switchgear and controlgear assemblies (power switchgear assemblies)', 'Control panel design and routine verification, rating plate, Icc']);
  rows.push(['IEC 60364 series', 'Low-voltage electrical installations (national wiring rules)', 'Supply to the machine, earthing system']);
  rows.push(['IEC 60898-1 / IEC 60947-2', 'Circuit breakers (MCB) / low-voltage circuit breakers', 'Branch protection, curves B / C / D']);
  rows.push(['IEC 60947-4-1', 'Contactors and motor starters', 'Motor starters; Annex G rated motor currents']);
  rows.push(['EN ISO 12100', 'Safety of machinery — general principles, risk assessment and risk reduction', 'Risk assessment (required, by others)']);
  rows.push(['EN ISO 13849-1 / -2', 'Safety-related parts of control systems — design and validation', 'Safety functions: PLr / PL, category']);
  rows.push(['IEC 62061', 'Functional safety of safety-related control systems', 'Alternative to ISO 13849-1 (SIL)']);
  rows.push(['EN ISO 13850', 'Emergency stop function — principles for design', 'E-stop devices and stop category']);
  rows.push(['IEC 60529', 'Degrees of protection provided by enclosures (IP code)', `Enclosure IP rating${p.electrical ? ` (${NEMA_TO_IP[p.electrical.inputs.enclosureRating] ?? p.electrical.inputs.enclosureRating})` : ''}`]);
  rows.push(['IEC 81346-2', 'Industrial systems — reference designations, classification of objects', 'Device designations (-Q, -K, -F…)']);
  rows.push(['IEC 60617', 'Graphical symbols for diagrams', 'Schematic symbols']);
  if (r.value === 'EU') {
    rows.push(['2006/42/EC → (EU) 2023/1230', 'Machinery Directive; Machinery Regulation applies from 20 January 2027', 'CE marking, technical file, declaration of conformity']);
    rows.push(['2014/35/EU, 2014/30/EU', 'Low Voltage and EMC directives', 'CE marking of the electrical equipment']);
    rows.push(['UK SI 2008/1597', 'Supply of Machinery (Safety) Regulations 2008 (Great Britain)', 'UKCA marking for Great Britain']);
  }
  if (p.hmi) rows.push(['ANSI/ISA-101.01', 'Human machine interfaces for process automation systems', 'HMI colours, navigation and alarm presentation']);
  rows.push(['IEC 61131-3', 'Programmable controllers — programming languages', `PLC program structure (${p.profile.language === 'ladder' ? 'ladder diagram' : 'structured text'})`]);
  return rows;
}

const ABBREVIATIONS: [string, string, (p: ProjectSnapshot) => boolean][] = [
  ['AWG', 'American Wire Gauge', (p) => !isIec(p.info.region)],
  ['CE', 'Conformité Européenne (EU conformity marking)', (p) => p.info.region === 'EU'],
  ['IEC', 'International Electrotechnical Commission', (p) => isIec(p.info.region)],
  ['IP', 'Ingress protection code (IEC 60529)', (p) => isIec(p.info.region)],
  ['Icc', 'Rated conditional short-circuit current (IEC 61439)', (p) => isIec(p.info.region)],
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
  ['NEC', 'National Electrical Code (NFPA 70)', (p) => p.info.region !== 'Canada' && !isIec(p.info.region)],
  ['NEMA', 'National Electrical Manufacturers Association', (p) => !isIec(p.info.region)],
  ['NFPA', 'National Fire Protection Association', (p) => !isIec(p.info.region)],
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
  ['UL', 'Underwriters Laboratories', (p) => !isIec(p.info.region)],
  ['UKCA', 'UK Conformity Assessed (Great Britain marking)', (p) => p.info.region === 'EU'],
  ['VFD', 'Variable frequency drive', (p) => !!p.electrical?.inputs.motors.some((x) => x.starter === 'vfd')],
];

export function abbreviationsTable(p: ProjectSnapshot): DocTable {
  return makeTable([['Abbreviation', 18], ['Meaning', 80]], ABBREVIATIONS.filter(([, , f]) => f(p)).map(([a, b]) => [a, b]));
}
