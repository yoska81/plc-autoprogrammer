import { byRegion, isIec, regionSize } from '../../standards/regions';
import type { ProjectSnapshot } from '../collect';
import {
  buildModel, ratingText, supplyText, cableSchedule, naturalCompare,
  type ResolvedComponent, type ElectricalModel,
} from '../../electrical/derive';
import { calculations, num, type CalcSection } from './calcs';
import { makeTable, type DocRow, type DocTable } from './table';
import { cableTotals } from '../../electrical/layout/suggest';
import { panelSccr } from '../../electrical/sccr';

/**
 * Electrical design basis tables: supply, enclosure, protective devices,
 * conductors, 24 VDC load, heat, SCCR (UL 508A Supplement SB method) and
 * voltage drop. Every value is read from the electrical design / catalog or
 * labelled as an estimate or assumption.
 */

const SUPPLY_V: Record<string, number> = { '120VAC-1PH': 120, '208VAC-3PH': 208, '240VAC-3PH': 240, '480VAC-3PH': 480, '600VAC-3PH': 600 };

function model(p: ProjectSnapshot): ElectricalModel | null {
  return p.drawingCtx ? buildModel(p.drawingCtx) : null;
}

const devText = (c?: ResolvedComponent) => (c ? `${c.tag} ${c.partNumber}`.trim() : '—');

function kaText(c?: ResolvedComponent): string {
  const r = c?.part?.ratings;
  if (!r) return '—';
  const v = num(r.sccrKA480) ?? num(r.sccrKA) ?? num(r.interruptingKA);
  return v !== null ? `${v} kA` : '—';
}

/** Supply, voltages and frequency. */
export function supplyTable(p: ProjectSnapshot): DocTable {
  const m = model(p);
  const d = p.electrical;
  if (!m || !d) return makeTable([['Parameter', 30], ['Value', 40], ['Basis', 50]], []);
  const ps = m.psBranches.map((b) => b.ps);
  const rows: string[][] = [
    ['Incoming supply', supplyText(m.supply), 'Specification / electrical design input'],
    ['System', m.phases === 3 ? '3-phase, 3-wire + PE (no neutral required)' : '1-phase, L + N + PE', 'Electrical design'],
    ['Frequency', '60 Hz', 'North American supply'],
    ['Main disconnect', m.disconnect ? `${devText(m.disconnect)} — ${ratingText(m.disconnect)}` : 'NOT IN DESIGN', 'NFPA 79 5.3 supply disconnecting means'],
    ['Incoming conductors (estimate)', `${m.mainAwg} Cu 75 °C`, 'Sum of motor FLA + 25% of largest + 2 A per power supply (estimate; verify by site)'],
    ['Control voltage', ps.length ? `24 VDC from ${ps.map((x) => `${x.tag} (${ratingText(x)})`).join(', ')}` : 'none', 'NFPA 79 9.1 control circuits'],
  ];
  if (m.transformer) rows.push(['Control transformer', `${devText(m.transformer)} — ${ratingText(m.transformer)}`, 'X2 grounded, bonded to PE']);
  rows.push(['DC common', '0 V bonded to PE at the power supply (grounded control circuit)', 'NFPA 79 9.4.3 (grounded control circuits)']);
  rows.push(['Safety-switched supply', m.safety.outputSupply === '24+S' ? '24+S — PLC output supply removed by the safety circuit' : 'none — outputs fed from unswitched 24+', 'Electrical design']);
  rows.push(['Enclosure type rating (required)', d.inputs.enclosureRating, 'Specification']);
  rows.push(['Ambient temperature (assumption)', '0–40 °C, non-condensing, indoor', 'Assumption — confirm site conditions']);
  rows.push(['Available fault current at the site', 'TO BE PROVIDED BY CUSTOMER', `Needed to confirm the panel ${byRegion(p.info.region, 'SCCR (NEC 409.22)', 'SCCR (CSA C22.2 No. 14)', 'short-circuit rating Icc (IEC 61439-1 5.3)')}`]);
  return makeTable([['Parameter', 30], ['Value', 46], ['Basis', 50]], rows);
}

/** Enclosure selection. */
export function enclosureTable(p: ProjectSnapshot, calcs: CalcSection[] = calculations(p)): DocTable {
  const m = model(p);
  const rows: string[][] = [];
  if (m && p.electrical) {
    const enc = m.rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind === 'enclosure') ?? m.rc.find((c) => c.category === 'enclosure');
    const r = enc?.part?.ratings ?? {};
    rows.push(['Enclosure', enc ? devText(enc) : 'NOT SELECTED', enc?.part?.description ?? '']);
    rows.push(['Type rating', r.nema ? `NEMA ${String(r.nema)}` : '—', `Required: ${p.electrical.inputs.enclosureRating}${r.nema && String(r.nema).includes(p.electrical.inputs.enclosureRating.replace('NEMA ', '')) ? ' — met' : ' — check'}`]);
    if (r.heightIn) rows.push(['Size (H x W x D)', `${r.heightIn} x ${r.widthIn} x ${r.depthIn} in`, r.material ? String(r.material) : '']);
    const sub = m.rc.find((c) => c.category === 'enclosure' && c !== enc);
    if (sub || r.subpanel) rows.push(['Subpanel', sub ? devText(sub) : String(r.subpanel), r.panelHeightIn ? `Usable ${r.panelHeightIn} x ${r.panelWidthIn} in` : '']);
    const door = m.rc.filter((c) => c.mount === 'door');
    rows.push(['Door devices', String(door.length + (p.hmi ? 1 : 0)), [...door.map((c) => c.tag), ...(p.hmi ? [`HMI ${p.hmi.hmiPartNumber}`] : [])].join(', ')]);
    const heat = calcs.find((s) => s.title === 'Cabinet temperature rise');
    if (heat) rows.push(['Thermal check', heat.ok ? 'Natural convection adequate' : 'Cooling required', heat.result]);
    const fan = m.rc.find((c) => c.category === 'fan');
    rows.push(['Cooling', fan ? devText(fan) : 'None (sealed enclosure)', fan?.part?.description ?? '']);
  }
  return makeTable([['Item', 22], ['Selection', 40], ['Notes', 60]], rows);
}

/** Protective device schedule. */
export function protectiveDeviceTable(p: ProjectSnapshot): DocTable {
  const m = model(p);
  const rows: DocRow[] = [];
  if (!m) return makeTable([['Circuit', 14], ['Load', 30], ['Current', 18], ['Device', 24], ['Rating', 18], ['kA', 8], ['Conductor', 10], ['Code reference', 26]], rows);
  const V = SUPPLY_V[m.supply] ?? 480;
  const wireSize = (w: string | undefined) => (w ? m.wires.find((x) => x.wire === w)?.size ?? '' : '');
  const psIn = (ps: ResolvedComponent) => {
    const w = num(ps.part?.ratings.watts);
    if (w === null) return '—';
    const v = ps.part && num(ps.part.ratings.phases) === 3 ? V * Math.sqrt(3) : (m.transformer ? 120 : V);
    return `${(w / 0.88 / v).toFixed(2)} A in (est., 88% eff.)`;
  };
  const totalFla = m.motors.reduce((s, x) => s + x.fla, 0);
  const largest = m.motors.reduce((s, x) => Math.max(s, x.fla), 0);
  rows.push({ group: 'Feeder' });
  rows.push(['Main', 'Complete panel', `${(totalFla + largest * 0.25).toFixed(1)} A motors (125% largest) + control`, devText(m.disconnect), ratingText(m.disconnect) || '—', kaText(m.disconnect), m.mainAwg, byRegion(p.info.region, 'NFPA 79 5.3 / NEC 430.109, 670', 'CEC 28-600 / CSA C22.2 No. 14', 'IEC 60204-1 5.3 (main switch)')]);
  if (m.mainBreaker) rows.push(['Main', 'Main overcurrent protection', '', devText(m.mainBreaker), ratingText(m.mainBreaker), kaText(m.mainBreaker), m.mainAwg, byRegion(p.info.region, 'NEC 430.62 / NFPA 79 7.2', 'CEC Section 28', 'IEC 60204-1 7.2 / IEC 60898-1')]);
  if (m.motors.length) rows.push({ group: 'Motor branch circuits' });
  for (const mm of m.motors) {
    const load = `${mm.motor.tag} ${mm.motor.description || 'motor'}, ${mm.motor.hp} HP ${mm.motor.voltage}`;
    rows.push([`${mm.motor.tag} SCPD`, load, `FLA ${mm.fla} A`, devText(mm.protection), ratingText(mm.protection) || '—', kaText(mm.protection), mm.awg, byRegion(p.info.region, 'NEC 430.52, 430.22 (125%)', 'CEC 28-200, 28-106 (125%)', 'IEC 60204-1 7.2, 7.3; IEC 60947-2 / -4-1')]);
    for (const c of mm.contactors) rows.push([`${mm.motor.tag} starter`, `${mm.motor.tag} ${c.comp.function || 'contactor'}`, `FLA ${mm.fla} A`, devText(c), ratingText(c) || String(c.part?.ratings.hp480 ? `${c.part.ratings.hp480} HP @ 480 V` : '—'), '—', mm.awg, byRegion(p.info.region, 'NEC 430.83', 'CEC Section 28 (controllers)', 'IEC 60947-4-1 (AC-3)')]);
    if (mm.overload) {
      const lo = num(mm.overload.part?.ratings.minAmps), hi = num(mm.overload.part?.ratings.maxAmps);
      rows.push([`${mm.motor.tag} overload`, `${mm.motor.tag} running overload`, `Set ${mm.fla} A (FLA)`, devText(mm.overload), lo !== null ? `${lo}–${hi} A, class ${mm.overload.part?.ratings.tripClass ?? '—'}` : ratingText(mm.overload), '—', mm.awg, byRegion(p.info.region, 'NEC 430.32', 'CEC 28-306', 'IEC 60204-1 7.3; IEC 60947-4-1 (trip class)')]);
    }
    if (mm.vfd) rows.push([`${mm.motor.tag} drive`, `${mm.motor.tag} VFD`, `FLA ${mm.fla} A`, devText(mm.vfd), ratingText(mm.vfd), kaText(mm.vfd), mm.awg, byRegion(p.info.region, 'NEC 430.122, 430.130; drive manual', 'CEC 28-200; drive manual', 'IEC 61800-5-1; drive manual')]);
  }
  rows.push({ group: 'Control power' });
  if (m.xfmrBranch) {
    rows.push(['CPT primary', `${m.xfmrBranch.xfmr.tag} control transformer`, ratingText(m.xfmrBranch.xfmr), devText(m.xfmrBranch.protection), ratingText(m.xfmrBranch.protection) || (/yes/i.test(String(m.xfmrBranch.xfmr.part?.ratings.fused ?? '')) ? 'integral fuseblock' : 'NOT ASSIGNED'), kaText(m.xfmrBranch.protection), regionSize('14 AWG', p.info.region), byRegion(p.info.region, 'NEC 450.3(B) / UL 508A', 'CEC 26-256', 'IEC 60204-1 7.2.7 / IEC 61558-2-2')]);
  }
  for (const b of m.psBranches) {
    rows.push([`${b.ps.tag} primary`, `${b.ps.tag} 24 VDC power supply (${ratingText(b.ps)})`, psIn(b.ps), devText(b.protection), ratingText(b.protection) || 'NOT ASSIGNED', kaText(b.protection), wireSize(b.feedWires[0]) || regionSize('14 AWG', p.info.region), byRegion(p.info.region, 'NFPA 79 7.2 / UL 508A', 'CEC 14-104 / CSA C22.2 No. 14', 'IEC 60204-1 7.2 / IEC 60898-1 curve C')]);
    rows.push([`${b.ps.tag} output`, '24 VDC distribution (TB1)', `${ratingText(b.ps)} max`, `${b.ps.tag} electronic current limit`, `${num(b.ps.part?.ratings.outputAmps) ?? '—'} A`, '—', '16 AWG', 'NFPA 79 7.2 (conductor protected by source current limit — verify)']);
  }
  for (const b of m.auxBranches) rows.push([b.protection.tag, b.protection.comp.function || 'auxiliary circuit', '—', devText(b.protection), ratingText(b.protection), kaText(b.protection), wireSize(b.feedWires[0]) || regionSize('14 AWG', p.info.region), byRegion(p.info.region, 'NFPA 79 7.2', 'CEC 14-104', 'IEC 60204-1 7.2')]);
  return makeTable([['Circuit', 14], ['Load', 30], ['Current', 20], ['Device', 24], ['Rating', 18], ['kA', 8, 'center'], ['Conductor', 10], ['Code reference', 26]], rows);
}

const COLOR_USE: Record<string, string> = {
  BK: 'Ungrounded AC power conductors (line and load)',
  RD: 'Ungrounded AC control conductors',
  BU: 'Ungrounded DC control conductors (+24 V, 24+S, signals)',
  'WH/BU': 'Grounded DC control conductor (0 V)',
  WH: 'Grounded AC conductor (neutral / X2)',
  'GN/YE': 'Protective earth (PE)',
  OR: 'Interlock from an external source (live with the disconnect OFF)',
  YE: 'Interlock from an external source (live with the disconnect OFF)',
};

/** Conductor colours and sizes actually used in the wire list. */
export function conductorTable(p: ProjectSnapshot): DocTable {
  const m = model(p);
  const ca = p.info.region === 'Canada';
  const by = new Map<string, { sizes: Set<string>; n: number; wires: Set<string> }>();
  for (const w of m?.wires ?? []) {
    const k = w.color.replace(/\s*\(cable\)/i, ' (cable core)');
    const g = by.get(k) ?? { sizes: new Set(), n: 0, wires: new Set() };
    g.sizes.add(w.size); g.n++; g.wires.add(w.wire);
    by.set(k, g);
  }
  const rows = [...by].sort(([a], [b]) => naturalCompare(a, b)).map(([color, g]) => [
    color,
    COLOR_USE[color] ?? (/cable core/.test(color) ? 'Factory core colour of a sensor cordset / pigtail' : 'See wire list'),
    [...g.sizes].sort(naturalCompare).join(', '),
    String(g.n),
    [...g.wires].sort(naturalCompare).slice(0, 8).join(', ') + (g.wires.size > 8 ? ', …' : ''),
  ]);
  rows.push(['—', isIec(p.info.region) ? 'Sizes in mm² per IEC 60204-1 Table 6 (PVC copper, 40 °C, method B2) or the copper area of the equivalent AWG size; verify against the protective device ratings and grouping factors (Table D.2). Colours per IEC 60204-1 13.2.' : `Sizes are suggestions for 75 °C copper in the enclosure; verify against ${ca ? 'CEC Table 2 / CSA C22.2 No. 14' : 'NFPA 79 Ch. 12 / UL 508A'} and the protective device ratings. Colours per NFPA 79 13.2.`, '', '', '']);
  return makeTable([['Colour', 14], ['Use', 52], ['Sizes', 18], ['Wires', 8, 'center'], ['Wire numbers (examples)', 40]], rows);
}

export function calcTable(s: CalcSection): DocTable {
  return makeTable([['Item', 46], ['Value', 18, 'right'], ['Basis', 40], ['Estimate', 10, 'center']], s.lines.map((l) => [l.item, l.value, l.basis, l.estimate ? 'yes' : '']));
}

/** UL 508A Supplement SB style SCCR determination. */
export function sccrTable(p: ProjectSnapshot): { table: DocTable; result: string; unknown: string[]; lowest: number | null } {
  const sc = p.drawingCtx ? panelSccr(p.drawingCtx) : null;
  const rows = (sc?.rows ?? []).map((r) => [r.component, r.circuit, r.kA !== null ? `${r.kA} kA` : 'UNKNOWN', r.source, r.note]);
  rows.push(['24 VDC control circuit', 'Load side of the power supply', 'n/a', 'Isolated secondary control circuit', 'Not considered in the SCCR determination (UL 508A SB) — verify']);
  return { table: makeTable([['Component', 30], ['Circuit', 20], ['SCCR / IR', 12, 'center'], ['Source', 40], ['Note', 50]], rows), result: sc?.result ?? 'Panel SCCR cannot be determined: no electrical design.', unknown: sc?.unknown ?? [], lowest: sc?.lowest ?? null };
}

/** Ohms per 1000 ft, uncoated stranded copper at 75 °C (NEC Chapter 9 Table 8). */
const OHM_KFT: Record<string, number> = { '18 AWG': 8.08, '16 AWG': 5.08, '14 AWG': 3.14, '12 AWG': 1.98, '10 AWG': 1.24, '8 AWG': 0.778, '6 AWG': 0.491, '4 AWG': 0.308, '2 AWG': 0.194, '1/0 AWG': 0.122, '2/0 AWG': 0.0967, '4/0 AWG': 0.0608 };

function lengthFt(s: string): number | null {
  const mm = /([\d.]+)\s*(m|ft|')/i.exec(s);
  if (!mm) return null;
  const v = parseFloat(mm[1]);
  return /m/i.test(mm[2]) ? v * 3.281 : v;
}

/** Voltage drop for field cables: actual when the length is known, else the maximum length allowed. */
export function voltageDropTable(p: ProjectSnapshot): DocTable {
  const m = model(p);
  const rows: string[][] = [];
  if (m && p.drawingCtx) {
    for (const c of cableSchedule(p.drawingCtx)) {
      const r = OHM_KFT[c.size];
      let amps: number, volts = 24, factor = 2, limitPct = 5, load: string;
      const mm = m.motors.find((x) => x.motor.tag === c.to);
      if (c.kind === 'motor' && mm) {
        amps = mm.fla; volts = SUPPLY_V[mm.motor.voltage] ?? 480; factor = mm.motor.voltage === '120VAC-1PH' ? 2 : Math.sqrt(3); limitPct = 3; load = `FLA ${mm.fla} A`;
      } else {
        const dev = m.rc.find((x) => x.tag === c.to);
        const w = num(dev?.part?.ratings.watts);
        if (w !== null) { amps = w / 24; load = `${w} W coil -> ${amps.toFixed(3)} A`; }
        else if (dev?.category === 'sensor') { amps = 0.03; load = '0.03 A sensor (typical)'; }
        else if (c.kind === 'trunk') { amps = 0.5; load = '0.5 A trunk total (assumed)'; }
        else { amps = 0.1; load = '0.1 A (assumed)'; }
      }
      if (!r) continue;
      const len = lengthFt(c.length);
      const allowV = (volts * limitPct) / 100;
      const maxFt = allowV / (factor * amps * (r / 1000));
      const drop = len !== null ? factor * amps * (r / 1000) * len : null;
      rows.push([c.tag, `${c.from} -> ${c.to}`, load, c.size, `${volts} V`, c.length,
        drop !== null ? `${drop.toFixed(2)} V (${((drop / volts) * 100).toFixed(1)}%)` : '—',
        `${Math.floor(maxFt).toLocaleString('en-US')} ft for ${limitPct}%`,
        drop !== null ? (drop <= allowV ? 'OK' : 'EXCEEDS — upsize') : 'Confirm route length < max']);
    }
  }
  return makeTable([['Cable', 8], ['Route', 26], ['Load', 22], ['Size', 9], ['Circuit', 8], ['Length', 9], ['Drop', 14], ['Max one-way length', 16], ['Result', 18]], rows);
}

/** Field cable schedule summary (one line per cable). */
export function cableSummaryTable(p: ProjectSnapshot): DocTable {
  const rows = p.drawingCtx ? cableSchedule(p.drawingCtx).map((c) => [c.tag, c.kind, c.zone, c.from, c.to, c.type, c.partNumber ?? '—', String(c.cores.length) + (c.spareCores ? ` (+${c.spareCores} spare)` : ''), c.length]) : [];
  return makeTable([['Cable', 8], ['Kind', 8], ['Zone', 14], ['From', 18], ['To', 10], ['Type', 44], ['Part no.', 14], ['Cores', 10, 'center'], ['Length', 10]], rows);
}

/** Field cable to order per cable type, from the machine layout lengths (m, with service allowance). */
export function cableTotalsTable(p: ProjectSnapshot): DocTable {
  const rows = p.drawingCtx ? cableTotals(cableSchedule(p.drawingCtx)).map((t) => [t.type, t.partNumber ?? '—', String(t.count), t.lengthM ? `${t.lengthM.toFixed(1)} m (${Math.ceil(t.lengthM / 0.3048)} ft)` : '—', t.unknown ? `${t.unknown} by site` : '']) : [];
  return makeTable([['Cable type', 60], ['Part no.', 18], ['Cables', 10, 'center'], ['Total length', 22], ['Not on the layout', 18]], rows);
}
