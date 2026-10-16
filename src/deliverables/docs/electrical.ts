import type { ProjectSnapshot } from '../collect';
import {
  buildModel, ratingText, supplyText, terminalPlan, cableSchedule, naturalCompare, isFuseCartridge,
  type ResolvedComponent, type ElectricalModel,
} from '../../electrical/derive';
import { calculations, num, type CalcSection } from './calcs';
import { makeTable, type DocRow, type DocTable } from './table';

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
  rows.push(['Available fault current at the site', 'TO BE PROVIDED BY CUSTOMER', `Needed to confirm the panel SCCR (${p.info.region === 'Canada' ? 'CSA C22.2 No. 14' : 'NEC 409.22'})`]);
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
  const ca = p.info.region === 'Canada';
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
  rows.push(['Main', 'Complete panel', `${(totalFla + largest * 0.25).toFixed(1)} A motors (125% largest) + control`, devText(m.disconnect), ratingText(m.disconnect) || '—', kaText(m.disconnect), m.mainAwg, ca ? 'CEC 28-600 / CSA C22.2 No. 14' : 'NFPA 79 5.3 / NEC 430.109, 670']);
  if (m.mainBreaker) rows.push(['Main', 'Main overcurrent protection', '', devText(m.mainBreaker), ratingText(m.mainBreaker), kaText(m.mainBreaker), m.mainAwg, ca ? 'CEC Section 28' : 'NEC 430.62 / NFPA 79 7.2']);
  if (m.motors.length) rows.push({ group: 'Motor branch circuits' });
  for (const mm of m.motors) {
    const load = `${mm.motor.tag} ${mm.motor.description || 'motor'}, ${mm.motor.hp} HP ${mm.motor.voltage}`;
    rows.push([`${mm.motor.tag} SCPD`, load, `FLA ${mm.fla} A`, devText(mm.protection), ratingText(mm.protection) || '—', kaText(mm.protection), mm.awg, ca ? 'CEC 28-200, 28-106 (125%)' : 'NEC 430.52, 430.22 (125%)']);
    for (const c of mm.contactors) rows.push([`${mm.motor.tag} starter`, `${mm.motor.tag} ${c.comp.function || 'contactor'}`, `FLA ${mm.fla} A`, devText(c), ratingText(c) || String(c.part?.ratings.hp480 ? `${c.part.ratings.hp480} HP @ 480 V` : '—'), '—', mm.awg, ca ? 'CEC Section 28 (controllers)' : 'NEC 430.83']);
    if (mm.overload) {
      const lo = num(mm.overload.part?.ratings.minAmps), hi = num(mm.overload.part?.ratings.maxAmps);
      rows.push([`${mm.motor.tag} overload`, `${mm.motor.tag} running overload`, `Set ${mm.fla} A (FLA)`, devText(mm.overload), lo !== null ? `${lo}–${hi} A, class ${mm.overload.part?.ratings.tripClass ?? '—'}` : ratingText(mm.overload), '—', mm.awg, ca ? 'CEC 28-306' : 'NEC 430.32']);
    }
    if (mm.vfd) rows.push([`${mm.motor.tag} drive`, `${mm.motor.tag} VFD`, `FLA ${mm.fla} A`, devText(mm.vfd), ratingText(mm.vfd), kaText(mm.vfd), mm.awg, ca ? 'CEC 28-200; drive manual' : 'NEC 430.122, 430.130; drive manual']);
  }
  rows.push({ group: 'Control power' });
  if (m.xfmrBranch) {
    rows.push(['CPT primary', `${m.xfmrBranch.xfmr.tag} control transformer`, ratingText(m.xfmrBranch.xfmr), devText(m.xfmrBranch.protection), ratingText(m.xfmrBranch.protection) || (/yes/i.test(String(m.xfmrBranch.xfmr.part?.ratings.fused ?? '')) ? 'integral fuseblock' : 'NOT ASSIGNED'), kaText(m.xfmrBranch.protection), '14 AWG', ca ? 'CEC 26-256' : 'NEC 450.3(B) / UL 508A']);
  }
  for (const b of m.psBranches) {
    rows.push([`${b.ps.tag} primary`, `${b.ps.tag} 24 VDC power supply (${ratingText(b.ps)})`, psIn(b.ps), devText(b.protection), ratingText(b.protection) || 'NOT ASSIGNED', kaText(b.protection), wireSize(b.feedWires[0]) || '14 AWG', ca ? 'CEC 14-104 / CSA C22.2 No. 14' : 'NFPA 79 7.2 / UL 508A']);
    rows.push([`${b.ps.tag} output`, '24 VDC distribution (TB1)', `${ratingText(b.ps)} max`, `${b.ps.tag} electronic current limit`, `${num(b.ps.part?.ratings.outputAmps) ?? '—'} A`, '—', '16 AWG', 'NFPA 79 7.2 (conductor protected by source current limit — verify)']);
  }
  for (const b of m.auxBranches) rows.push([b.protection.tag, b.protection.comp.function || 'auxiliary circuit', '—', devText(b.protection), ratingText(b.protection), kaText(b.protection), wireSize(b.feedWires[0]) || '14 AWG', ca ? 'CEC 14-104' : 'NFPA 79 7.2']);
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
  rows.push(['—', `Sizes are suggestions for 75 °C copper in the enclosure; verify against ${ca ? 'CEC Table 2 / CSA C22.2 No. 14' : 'NFPA 79 Ch. 12 / UL 508A'} and the protective device ratings. Colours per NFPA 79 13.2.`, '', '', '']);
  return makeTable([['Colour', 14], ['Use', 52], ['Sizes', 18], ['Wires', 8, 'center'], ['Wire numbers (examples)', 40]], rows);
}

export function calcTable(s: CalcSection): DocTable {
  return makeTable([['Item', 46], ['Value', 18, 'right'], ['Basis', 40], ['Estimate', 10, 'center']], s.lines.map((l) => [l.item, l.value, l.basis, l.estimate ? 'yes' : '']));
}

/** UL 508A Supplement SB style SCCR determination. */
export function sccrTable(p: ProjectSnapshot): { table: DocTable; result: string; unknown: string[]; lowest: number | null } {
  const m = model(p);
  const rows: string[][] = [];
  const unknown: string[] = [];
  let lowest: number | null = null, limiting: string[] = [];
  const add = (c: ResolvedComponent, circuit: string, kA: number | null, source: string, note = '') => {
    rows.push([`${c.tag} ${c.partNumber}`, circuit, kA !== null ? `${kA} kA` : 'UNKNOWN', source, note]);
    if (kA === null) { unknown.push(c.tag); return; }
    if (lowest === null || kA < lowest) { lowest = kA; limiting = [c.tag]; } else if (kA === lowest) limiting.push(c.tag);
  };
  if (m) {
    const r = (c: ResolvedComponent) => c.part?.ratings ?? {};
    const seen = new Set<ResolvedComponent>();
    const protectiveRow = (c: ResolvedComponent | undefined, circuit: string) => {
      if (!c || seen.has(c)) return;
      seen.add(c);
      if (c.category === 'disconnect') {
        const k = num(r(c).sccrKA);
        add(c, circuit, k, k !== null ? 'Catalog SCCR' : 'Not published', r(c).sccrNote ? `Rating ${r(c).sccrNote} — confirm this condition applies (no such fuses in the design)` : '');
      } else if (c.category === 'breaker') {
        const k = num(r(c).interruptingKA);
        const branch = String(r(c).branchRated ?? '');
        add(c, circuit, k, k !== null ? `Interrupting rating (UL ${r(c).ul ?? '—'})` : 'Not published', /no/i.test(branch) ? 'Supplementary protector (UL 1077): not a branch-circuit device — needs branch protection ahead' : '');
      } else if (c.category === 'motorProtector') {
        const k = num(r(c).sccrKA480) ?? num(r(c).sccrKA);
        add(c, circuit, k, k !== null ? 'Catalog SCCR at 480 V' : 'Not published', String(r(c).ul ?? ''));
      } else if (c.category === 'fuse' && !isFuseCartridge(c)) {
        const k = num(r(c).sccrKA);
        add(c, circuit, k, k !== null ? 'Fuse holder SCCR (catalog)' : 'Not published', c.fuse ? `Fuse ${c.fuse.partNumber}` : 'No fuse cartridge in design');
      } else {
        add(c, circuit, num(r(c).sccrKA) ?? num(r(c).interruptingKA), 'Catalog');
      }
    };
    protectiveRow(m.disconnect, 'Main');
    protectiveRow(m.mainBreaker, 'Main');
    for (const mm of m.motors) {
      protectiveRow(mm.protection, `${mm.motor.tag} branch`);
      for (const c of [...mm.contactors, ...(mm.overload ? [mm.overload] : [])]) {
        const k = num(r(c).sccrKA480) ?? num(r(c).sccrKA);
        add(c, `${mm.motor.tag} branch`, k ?? 5, k !== null ? 'Catalog SCCR' : 'Default 5 kA (UL 508A Table SB4.1, motor controller 0–50 hp)', 'Assumed default — a tested combination rating from the manufacturer can raise it');
      }
      if (mm.vfd) { const k = num(r(mm.vfd).sccrKA480) ?? num(r(mm.vfd).sccrKA); add(mm.vfd, `${mm.motor.tag} branch`, k, k !== null ? 'Catalog SCCR' : 'Not in catalog', 'Obtain the drive SCCR and required protection from the drive manual'); }
    }
    if (m.xfmrBranch) { protectiveRow(m.xfmrBranch.protection, 'Control transformer'); add(m.xfmrBranch.xfmr, 'Control transformer', num(r(m.xfmrBranch.xfmr).sccrKA), 'Not published', 'Confirm rating / exemption with the manufacturer'); }
    for (const b of m.psBranches) {
      protectiveRow(b.protection, `${b.ps.tag} primary`);
      if (!b.fromXfmr) add(b.ps, `${b.ps.tag} primary`, num(r(b.ps).sccrKA), 'Not published in catalog', 'Obtain SCCR from the manufacturer before marking the panel');
    }
    for (const b of m.auxBranches) protectiveRow(b.protection, b.protection.comp.function || 'Auxiliary');
    const powerTerms = terminalPlan(p.drawingCtx!).flatMap((s) => s.terminals).filter((t) => m.motors.some((mm) => mm.loadWires.includes(t.wire)));
    if (powerTerms.length) {
      const tb = m.rc.find((c) => c.category === 'terminal' && !/ground|pe\b/i.test(c.part?.description ?? ''));
      if (tb) add(tb, 'Motor feeder terminals', num(r(tb).sccrKA) ?? 10, num(r(tb).sccrKA) !== null ? 'Catalog' : 'Default 10 kA (UL 508A Table SB4.1, terminal blocks)', `${powerTerms.length} terminals carry motor power`);
    }
  }
  rows.push(['24 VDC control circuit', 'Load side of the power supply', 'n/a', 'Isolated secondary control circuit', 'Not considered in the SCCR determination (UL 508A SB) — verify']);
  const result = lowest === null
    ? 'Panel SCCR cannot be determined: no component ratings available.'
    : `Preliminary panel SCCR = ${lowest} kA at ${m ? supplyText(m.supply) : 'the supply voltage'} (lowest rating, limited by ${limiting.join(', ')}).${unknown.length ? ` UNKNOWN ratings for ${unknown.join(', ')} must be obtained before the nameplate is marked.` : ''} The available fault current at the installation must not exceed the marked SCCR.`;
  return { table: makeTable([['Component', 30], ['Circuit', 20], ['SCCR / IR', 12, 'center'], ['Source', 40], ['Note', 50]], rows), result, unknown, lowest };
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
