/**
 * Power section of the rule-based design: motor branches (breaker or Class CC fuses, contactor +
 * overload, motor protector or VFD), the main disconnect and the 24 VDC control power (3-phase supply,
 * single-phase supply, or control transformer + supply on 600 V). Every part comes from the catalog
 * through the Picker; anything the catalog cannot cover becomes a note, never an invented part.
 */
import { motorFla } from '../derive';
import { isIec, powerText, SUPPLY_INFO, type Region } from '../../standards/regions';
import type { CatalogPart, DesignComponent, SupplyVoltage } from '../types';
import type { ModelMotor } from './machineModel';
import { coversSupply, hpKeys, num, type Picker } from './select';

export const comp = (tag: string, partNumber: string, quantity: number, fn: string, motorTag: string | null = null): DesignComponent => ({ tag, partNumber, quantity, function: fn, motorTag });

/** Device tag allocator: K1, K2 … per prefix, skipping tags already taken (required parts). */
export class Tags {
  private n = new Map<string, number>();
  private used: Set<string>;
  constructor(used: Iterable<string> = []) { this.used = new Set(used); }
  next(prefix: string): string {
    let k = this.n.get(prefix) ?? 0;
    let tag: string;
    do { k++; tag = `${prefix}${k}`; } while (this.used.has(tag));
    this.n.set(prefix, k);
    this.used.add(tag);
    return tag;
  }
  take(tag: string) { this.used.add(tag); }
}

export interface MotorBranch {
  motor: ModelMotor;
  fla: number;
  /** Contactor tags in order (forward first for reversing motors). */
  contactors: string[];
  vfd?: string;
  overload?: string;
  /** VFD with Safe Torque Off wired from the safety relay. */
  sto: boolean;
  reversing: boolean;
}

export interface PowerResult {
  components: DesignComponent[];
  branches: MotorBranch[];
  notes: string[];
}

const amps = (p: CatalogPart) => num(p.ratings.amps) ?? 0;
const phasesOf = (s: SupplyVoltage) => SUPPLY_INFO[s].phases;

/** Hp rating of a part for the supply (the first catalog key that applies). */
function hpRating(p: CatalogPart, supply: SupplyVoltage): number | undefined {
  for (const k of hpKeys(supply)) { const v = num(p.ratings[k]); if (v !== undefined) return v; }
  return undefined;
}

/** Branch breaker: UL 489 (branch rated), enough poles, rated for the supply, smallest ≥ 2×FLA (C curve rides through the start), else ≥ 1.25×FLA. */
export function pickBranchBreaker(pk: Picker, supply: SupplyVoltage, current: number, poles: number, factor = 2): CatalogPart | null {
  const ok = (min: number) => (p: CatalogPart) => num(p.ratings.poles) === poles && coversSupply(p, supply) && String(p.ratings.branchRated ?? 'yes') !== 'no' && amps(p) >= min;
  return pk.pick('breaker', ok(current * factor), amps) ?? pk.pick('breaker', ok(current * 1.25), amps);
}

const isClass = (p: CatalogPart, cls: string) => String(p.ratings.fuseClass ?? '').toUpperCase() === cls;

/** Class CC time-delay fuses (Canada / 600 V): holder with the poles, cartridges ≥ 1.25×FLA (CEC Table 29 allows up to 175%). */
function pickFuses(pk: Picker, current: number, poles: number): { holder: CatalogPart; fuse: CatalogPart } | null {
  const holder = pk.pick('fuse', (p) => isClass(p, 'CC') && num(p.ratings.poles) === poles && amps(p) >= current * 1.25, amps);
  const fuse = pk.pick('fuse', (p) => isClass(p, 'CC') && num(p.ratings.poles) === undefined && amps(p) >= current * 1.25 && amps(p) <= (holder ? amps(holder) : 30), amps);
  return holder && fuse ? { holder, fuse } : null;
}

/**
 * The drive's own branch fuses from its manual's fuse chart (`ratings.fuseClass` / `fusePart`, Class T for the
 * DURApulse drives — the condition of their 100 kA SCCR) and a Class T block with the poles. `holder` is null when
 * the catalog has no block for that size (AutomationDirect's Class T blocks stop at 60 A).
 */
export function driveFuses(pk: Picker, drive: CatalogPart, poles: number): { fuse: CatalogPart; holder: CatalogPart | null; qty: number } | null {
  const base = String(drive.ratings.fusePart ?? '');
  if (!base || !isClass(drive, 'T')) return null;
  const fuse = pk.byNumber(`${base}-1`) ?? pk.byNumber(base);
  if (!fuse) return null;
  const holder = String(fuse.ratings.holder ?? '').split('/').map((h) => pk.byNumber(h.trim())).find((h) => !!h && num(h.ratings.poles) === poles) ?? null;
  return { fuse, holder, qty: Math.ceil(poles / (num(fuse.ratings.packQty) ?? 1)) };
}

function pickContactor(pk: Picker, supply: SupplyVoltage, fla: number, hp: number): CatalogPart | null {
  const iec = SUPPLY_INFO[supply].hz === 50;
  return pk.pick('contactor', (p) => {
    if (!/24\s*V?DC/i.test(String(p.ratings.coilVoltage ?? p.ratings.coil ?? ''))) return false;
    if (amps(p) < fla) return false;
    // US/Canada: the horsepower rating at the supply voltage; IEC: the AC-3 current (hp at 480 V does not apply at 400 V).
    const r = hpRating(p, supply);
    return iec || r === undefined || r >= hp;
  }, amps);
}

/**
 * Overload whose dial range includes the FLA, for the contactor family when the catalog says which.
 * When the FLA falls between two ranges, the next range up set at its minimum (≤ 115% of FLA,
 * within NEC 430.32 / IEC 60947-4-1 class 10 practice) — flagged in `setAbove`.
 */
function pickOverload(pk: Picker, fla: number, contactor: CatalogPart | null): { part: CatalogPart; setAbove: boolean } | null {
  const family = String(contactor?.ratings.family ?? '');
  const forFamily = (p: CatalogPart) => { const f = String(p.ratings.forUse ?? ''); return !family || !f || f.includes(family); };
  const range = (p: CatalogPart) => [num(p.ratings.minAmps), num(p.ratings.maxAmps)] as const;
  const exact = pk.pick('overload', (p) => { const [lo, hi] = range(p); return lo !== undefined && hi !== undefined && fla >= lo && fla <= hi && forFamily(p); }, (p) => num(p.ratings.maxAmps) ?? 0);
  if (exact) return { part: exact, setAbove: false };
  const above = pk.pick('overload', (p) => { const [lo] = range(p); return lo !== undefined && lo > fla && lo <= fla * 1.15 && forFamily(p); }, (p) => num(p.ratings.minAmps) ?? 0);
  return above ? { part: above, setAbove: true } : null;
}

function pickProtector(pk: Picker, fla: number): CatalogPart | null {
  return pk.pick('motorProtector', (p) => {
    const lo = num(p.ratings.minAmps), hi = num(p.ratings.maxAmps);
    return lo !== undefined && hi !== undefined && fla >= lo && fla <= hi;
  }, (p) => num(p.ratings.maxAmps) ?? 0);
}

/** VFD for the supply class: GS20-style drives with STO first, then the others; output current ≥ FLA. */
function pickVfd(pk: Picker, supply: SupplyVoltage, fla: number, hp: number): { part: CatalogPart; sto: boolean } | null {
  const v = SUPPLY_INFO[supply].volts;
  const cls = v >= 380 && v <= 500 ? 460 : v >= 200 && v <= 250 ? 230 : 0;
  if (!cls) return null;
  const single = SUPPLY_INFO[supply].phases === 1;
  const fits = (p: CatalogPart) => {
    if (num(p.ratings.inputVolts) !== cls) return false;
    if (single && !/1/.test(String(p.ratings.inputPhases ?? ''))) return false;
    if ((num(p.ratings.outputAmps) ?? 0) < fla) return false;
    const r = single ? num(p.ratings.hp1ph) : num(p.ratings[cls === 460 ? 'hp480' : 'hp230']);
    return r === undefined || r >= hp;
  };
  const size = (p: CatalogPart) => num(p.ratings.outputAmps) ?? 0;
  const sto = pk.pick('vfd', (p) => fits(p) && /GS2\d|STO/i.test(`${p.ratings.series ?? ''} ${p.description}`), size);
  if (sto) return { part: sto, sto: true };
  const any = pk.pick('vfd', fits, size);
  return any ? { part: any, sto: false } : null;
}

/** Fuji SC-E contactors have no built-in auxiliary contact: the EDM / interlock N.C. needs a front block. */
const needsAuxBlock = (k: CatalogPart) => /^SC-E/i.test(k.partNumber) || /SC-E/i.test(String(k.ratings.family ?? ''));

export function motorBranches(pk: Picker, tags: Tags, motors: ModelMotor[], supply: SupplyVoltage, region: Region | undefined, reversingByIo: Set<string>): PowerResult {
  const components: DesignComponent[] = [];
  const branches: MotorBranch[] = [];
  const notes: string[] = [];
  const ph = phasesOf(supply);
  const poles = ph === 3 ? 3 : SUPPLY_INFO[supply].volts <= 130 || SUPPLY_INFO[supply].neutral ? 1 : 2;
  const fuses = region === 'Canada' || SUPPLY_INFO[supply].volts >= 575;
  const auxBlock = pk.byNumber('SZ-A11T');
  const interlock = pk.byNumber('SZ-RM');

  const P = (hp: number) => powerText(hp, region);
  for (const m of motors) {
    const fla = motorFla(m.hp, supply);
    const name = m.description || `Motor ${m.tag}`;
    let start = m.start;
    const reversing = start === 'reversing' || (start === 'vfd' && reversingByIo.has(m.tag));
    const branch: MotorBranch = { motor: m, fla, contactors: [], sto: false, reversing };

    // VFD first: it decides the branch protection current and whether a contactor is needed.
    let vfd: { part: CatalogPart; sto: boolean } | null = null;
    if (start === 'vfd') {
      vfd = pickVfd(pk, supply, fla, m.hp);
      if (!vfd) { notes.push(`${m.tag} ${name}: no catalog VFD for ${SUPPLY_INFO[supply].label} ${P(m.hp)} — designed across the line (contactor + overload); select a drive.`); start = 'dol'; }
    }

    // Branch short-circuit protection
    if (start === 'motor-protector') {
      const mp = pickProtector(pk, fla);
      if (mp) components.push(comp(tags.next('MP'), mp.partNumber, 1, `${name} motor protector (branch protection + overload) — dial ${num(mp.ratings.minAmps)}-${num(mp.ratings.maxAmps)} A covers FLA ${fla.toFixed(1)} A`, m.tag));
      else { notes.push(`${m.tag}: no motor protector covers ${fla.toFixed(1)} A — breaker, contactor and overload used instead.`); start = 'dol'; }
    }
    // Drive branches (UL / CSA): the drive's own Class T fuses in a Class T block — the condition of its SCCR. Without
    // an orderable block for that fuse size the branch keeps a breaker and the design review says so.
    const df = vfd && !isIec(region) ? driveFuses(pk, vfd.part, poles) : null;
    if (df?.holder) {
      const t = tags.next('FU');
      components.push(comp(t, df.holder.partNumber, 1, `Motor ${m.tag} drive branch fuses — Class T block (the ${vfd!.part.partNumber} fuses for its ${num(vfd!.part.ratings.sccrKA) ?? '?'} kA SCCR)`, m.tag));
      components.push(comp(`${t}F`, df.fuse.partNumber, df.qty, `Class T fuses ${amps(df.fuse)}A for ${t} — ${vfd!.part.partNumber} manual fuse chart`, m.tag));
    } else if (start !== 'motor-protector') {
      if (df && !df.holder) notes.push(`${m.tag} ${name}: the ${vfd!.part.partNumber} needs Class T ${String(vfd!.part.ratings.fusePart)} (${amps(df.fuse)} A) for its SCCR, but no orderable Class T fuse block that size is in the catalog — branch breaker used; see the design review.`);
      const factor = vfd ? 1.75 : 2;
      const f = fuses ? pickFuses(pk, fla * (vfd ? 1.4 : 1), poles) : null;
      if (f) {
        const t = tags.next('FU');
        components.push(comp(t, f.holder.partNumber, 1, `Motor ${m.tag} branch fuses — Class CC (${region === 'Canada' ? 'CEC' : '600 V'} branch protection)`, m.tag));
        components.push(comp(`${t}F`, f.fuse.partNumber, poles, `Class CC fuses ${amps(f.fuse)}A for ${t} — time-delay, >= 1.25 x FLA ${fla.toFixed(1)} A`, m.tag));
      } else {
        const cb = pickBranchBreaker(pk, supply, fla, poles, factor);
        if (cb) components.push(comp(tags.next('CB'), cb.partNumber, 1, `Motor ${m.tag} branch protection — ${amps(cb)} A ${cb.ratings.curve ?? ''}-curve, ${(amps(cb) / fla).toFixed(1)} x FLA ${fla.toFixed(1)} A (rides through the start, ${isIec(region) ? 'IEC 60947-2 / IEC 60204-1 7.2.10' : region === 'Canada' ? 'CEC 28-200' : 'max. 250% NEC 430.52'})`.replace(' -curve', ''), m.tag));
        else notes.push(`${m.tag}: no branch breaker in the catalog for ${fla.toFixed(1)} A at ${SUPPLY_INFO[supply].label} — select branch protection.`);
      }
    }

    if (vfd) {
      const t = tags.next('VFD');
      branch.vfd = t; branch.sto = vfd.sto;
      components.push(comp(t, vfd.part.partNumber, 1, `${name} drive${vfd.sto ? ', STO from safety relay' : ''} — ${num(vfd.part.ratings.outputAmps)} A output >= FLA ${fla.toFixed(1)} A${vfd.sto ? '; Safe Torque Off for the safety stop' : ''}`, m.tag));
      if (!vfd.sto) {
        // No STO terminals: the safety relay drops a contactor ahead of the drive.
        const k = pickContactor(pk, supply, fla, m.hp);
        if (k) {
          const kt = tags.next('K');
          branch.contactors.push(kt);
          components.push(comp(kt, k.partNumber, 1, `${name} drive safety contactor (dropped by the safety relay) — the drive has no STO input`, m.tag));
          if (auxBlock && needsAuxBlock(k)) components.push(comp(`${kt}-AUX`, auxBlock.partNumber, 1, `${kt} aux contact — N.C. 61-62 for the safety relay feedback (EDM); ${k.partNumber} has no built-in aux`, m.tag));
        }
      }
      if (m.vertical) notes.push(`${m.tag} ${name}: vertical / overhauling load — braking resistor and motor brake to be sized per the drive manual (not in the catalog).`);
      branches.push(branch);
      continue;
    }

    const k = pickContactor(pk, supply, fla, m.hp);
    if (!k) { notes.push(`${m.tag}: no 24 VDC-coil contactor in the catalog for ${P(m.hp)} / ${fla.toFixed(1)} A — select a starter.`); branches.push(branch); continue; }
    const dirs = reversing ? ['forward', 'reverse'] : [''];
    for (const d of dirs) {
      const kt = tags.next('K');
      branch.contactors.push(kt);
      const rating = hpRating(k, supply);
      components.push(comp(kt, k.partNumber, 1, `${name} ${d ? `${d} ` : ''}contactor — ${rating !== undefined && SUPPLY_INFO[supply].hz !== 50 ? `rated ${rating} HP at ${SUPPLY_INFO[supply].label}` : `AC-3 ${amps(k)} A`} >= ${P(m.hp)} / ${fla.toFixed(1)} A, 24 VDC coil`, m.tag));
      if (auxBlock && needsAuxBlock(k)) components.push(comp(`${kt}-AUX`, auxBlock.partNumber, 1, `${kt} aux contact — N.C. 61-62 for the safety relay feedback (EDM)${reversing ? ' and the reversing interlock' : ''}; ${k.partNumber} has no built-in aux`, m.tag));
    }
    if (reversing) {
      if (interlock && needsAuxBlock(k)) components.push(comp(`${branch.contactors[0]}-MI`, interlock.partNumber, 1, `${branch.contactors.join('/')} mechanical reversing interlock — both directions can never pull in together`, m.tag));
      else notes.push(`${m.tag}: add the mechanical reversing interlock for ${k.partNumber} (not in the catalog).`);
    }
    if (start !== 'motor-protector') {
      const ol = pickOverload(pk, fla, k);
      if (ol) {
        const t = tags.next('OL'); branch.overload = t;
        components.push(comp(t, ol.part.partNumber, 1, `${name} overload — range ${num(ol.part.ratings.minAmps)}-${num(ol.part.ratings.maxAmps)} A, set to FLA ${fla.toFixed(1)} A`, m.tag));
        if (ol.setAbove) notes.push(`${t} ${ol.part.partNumber}: no range brackets the ${fla.toFixed(1)} A FLA; set at its minimum ${num(ol.part.ratings.minAmps)} A (${Math.round((num(ol.part.ratings.minAmps)! / fla) * 100)}% of FLA) or fit the next smaller range if the nameplate current is lower.`);
      }
      else notes.push(`${m.tag}: no overload relay range covers ${fla.toFixed(1)} A — select one.`);
    }
    branches.push(branch);
  }
  return { components, branches, notes };
}

/** Main disconnect (+ handle + shaft for the enclosure depth) sized for the motors plus the control power. */
export function mainDisconnect(pk: Picker, branches: MotorBranch[], supply: SupplyVoltage, controlA: number, nema4: boolean, depthIn: number, heaterA = 0): { components: DesignComponent[]; notes: string[]; amps: number } {
  const flas = branches.map((b) => b.fla);
  // Heaters are continuous loads: 125% of their current.
  const load = flas.reduce((a, b) => a + b, 0) + (flas.length ? Math.max(...flas) * 0.25 : 0) + controlA + heaterA * 1.25;
  const maxHp = Math.max(0, ...branches.map((b) => b.motor.hp));
  const ds = pk.pick('disconnect', (p) => p.mount === 'backplate' && amps(p) >= load * 1.15 && coversSupply(p, supply) && (hpRating(p, supply) ?? Infinity) >= maxHp, amps);
  const notes: string[] = [];
  const components: DesignComponent[] = [];
  if (!ds) { notes.push(`No catalog disconnect is rated for ${load.toFixed(0)} A: select a main disconnect.`); return { components, notes, amps: load }; }
  components.push(comp('DS1', ds.partNumber, 1, `Main disconnect ${amps(ds)}A — load ${load.toFixed(1)} A (motors + 25% of the largest${heaterA ? ' + 125% of the heaters' : ''} + control) x 1.15`));
  const size = String(ds.ratings.handleSize ?? '').split('/')[0];
  const vendor = ds.vendor ?? 'automationdirect';
  const same = (p: CatalogPart) => (p.vendor ?? 'automationdirect') === vendor && (!size || String(p.ratings.handleSize ?? p.ratings.forUse ?? '').includes(size));
  const handle = pk.pick('disconnect', (p) => p.mount === 'door' && same(p) && /black/i.test(String(p.ratings.color ?? 'black')) && (nema4 ? /\b4/ : /\b12\b/).test(String(p.ratings.nema ?? '')));
  if (handle) components.push(comp('DS1H', handle.partNumber, 1, 'Disconnect handle'));
  // Shaft long enough for the enclosure depth: 200 mm up to 8 in deep, else the longer one.
  const shaft = pk.pick('disconnect', (p) => num(p.ratings.lengthMm) !== undefined && same(p) && (num(p.ratings.lengthMm)! >= (depthIn > 8 ? 300 : 150)), (p) => num(p.ratings.lengthMm) ?? 0);
  if (shaft) components.push(comp('DS1S', shaft.partNumber, 1, 'Disconnect shaft'));
  if (!handle || !shaft) notes.push(`${ds.partNumber}: select the matching external handle and shaft.`);
  return { components, notes, amps: load };
}

/**
 * 24 VDC control power for `loadA` (+25%): a 3-phase supply on 380–575 V, a single-phase supply on
 * 120–240 V (two phases on 208/240 V 3-phase), a 600 V-primary control transformer + single-phase
 * supply on 600 V.
 */
export function controlPower(pk: Picker, tags: Tags, supply: SupplyVoltage, loadA: number): { components: DesignComponent[]; notes: string[]; inputA: number } {
  const components: DesignComponent[] = [];
  const notes: string[] = [];
  const need = loadA * 1.25;
  const out = (p: CatalogPart) => num(p.ratings.outputAmps) ?? 0;
  const inRange = (p: CatalogPart, v: number) => {
    const m = /(\d+)\s*-\s*(\d+)\s*VAC/.exec(String(p.ratings.inputVolts ?? ''));
    return !m || (v >= Number(m[1]) && v <= Number(m[2]));
  };
  const info = SUPPLY_INFO[supply];
  const v = info.volts;
  const psuPrimary = (ps: CatalogPart, poles: number, feed: SupplyVoltage, what: string) => {
    const w = num(ps.ratings.watts) ?? out(ps) * 24;
    const cb = pickBranchBreaker(pk, feed, Math.max(2.4, w / 60) / 1.25, poles, 1.25);
    if (cb) components.push(comp(tags.next('CB'), cb.partNumber, 1, `${what} — ${amps(cb)} A for a ${w} W supply (inrush)`));
    else notes.push(`${ps.partNumber}: select primary protection.`);
  };

  if (v >= 575) {
    // No 24 VDC supply takes 600 V directly: control transformer 600:120 V (integral fuse block) + 120 V supply.
    const ps = pk.pick('powerSupply', (p) => num(p.ratings.phases) !== 3 && inRange(p, 120) && out(p) >= need, out);
    const va = ps ? ((num(ps.ratings.watts) ?? out(ps) * 24) / 0.85) * 1.25 : 0;
    const t = pk.pick('other', (p) => p.ratings.kind === 'transformer' && String(p.ratings.primaryVolts ?? '').split('/').map(Number).includes(600) && (num(p.ratings.va) ?? 0) >= va && /yes/i.test(String(p.ratings.fused ?? '')), (p) => num(p.ratings.va) ?? 0)
      ?? pk.pick('other', (p) => p.ratings.kind === 'transformer' && String(p.ratings.primaryVolts ?? '').split('/').map(Number).includes(600) && (num(p.ratings.va) ?? 0) >= va, (p) => num(p.ratings.va) ?? 0);
    if (!ps || !t) { notes.push(`${info.label}: no control transformer / 24 VDC supply in the catalog for ${need.toFixed(1)} A — select them.`); return { components, notes, inputA: 1 }; }
    const tt = tags.next('T');
    components.push(comp(tt, t.partNumber, 1, `Control transformer 600:120 V, ${num(t.ratings.va)} VA — no 24 VDC supply takes 600 V; >= ${Math.ceil(va)} VA for ${ps.partNumber} + 25%`));
    if (/yes/i.test(String(t.ratings.fused ?? ''))) {
      const vaT = num(t.ratings.va) ?? 100;
      const prim = vaT / 600, sec = vaT / 120;
      const fuse = (a: number) => pk.pick('fuse', (p) => num(p.ratings.poles) === undefined && amps(p) >= a, amps);
      const fp = fuse(prim * 2.5), fs = fuse(sec * 1.25);
      if (fp) components.push(comp(`${tt}FP`, fp.partNumber, 2, `Class CC fuses ${amps(fp)}A, ${tt} primary (integral fuse block)`));
      if (fs) components.push(comp(`${tt}FS`, fs.partNumber, 1, `Class CC fuse ${amps(fs)}A, ${tt} secondary (integral fuse block)`));
      notes.push(`${tt} fuses sized from the transformer rating (primary ${(prim * 2.5).toFixed(2)} A min., secondary ${(sec * 1.25).toFixed(2)} A min.): confirm against the transformer label (NEC 450.3 / CEC Rule 26-256).`);
    } else notes.push(`${tt}: add primary and secondary fuses (transformer has no fuse block).`);
    components.push(comp(tags.next('PS'), ps.partNumber, 1, `24VDC control power supply, fed from ${tt} 120 V secondary — ${out(ps)} A >= load ${loadA.toFixed(1)} A + 25%`));
    return { components, notes, inputA: (num(t.ratings.va) ?? 100) / 600 };
  }

  const three = info.phases === 3 && v >= 380;
  const ps = three
    ? pk.pick('powerSupply', (p) => num(p.ratings.phases) === 3 && inRange(p, v) && out(p) >= need, out)
    : pk.pick('powerSupply', (p) => num(p.ratings.phases) !== 3 && inRange(p, info.phases === 3 ? v : v) && out(p) >= need, out);
  if (!ps) { notes.push(`No 24 VDC supply in the catalog for ${need.toFixed(1)} A at ${info.label} — select one.`); return { components, notes, inputA: 1 }; }
  const w = num(ps.ratings.watts) ?? out(ps) * 24;
  const poles = three ? 3 : info.phases === 3 ? 2 : info.neutral || v <= 130 ? 1 : 2;
  psuPrimary(ps, poles, supply, '24VDC power supply primary');
  components.push(comp(tags.next('PS'), ps.partNumber, 1, `24VDC control power supply${three ? `, 3-phase ${v} VAC input` : info.phases === 3 ? `, fed L1-L2 ${v} VAC` : ''} — ${out(ps)} A >= load ${loadA.toFixed(1)} A + 25%`));
  if (out(ps) > 7) notes.push(`${ps.partNumber} can deliver ${out(ps)} A: protect each 24 VDC branch at or below its wire rating (18 AWG max. 7 A) with fused terminals or DC breakers.`);
  return { components, notes, inputA: (w / 0.85) / (three ? v * 1.732 : v) };
}
