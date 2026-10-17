/**
 * Cost-down pass: every breaker, contactor, drive, power supply, disconnect and the enclosure is checked
 * against the load it serves, with the same sizing rules the engine designs with (engine/power.ts). Where a
 * smaller catalog part of the same brand (and family, so add-on blocks, overloads and handles still fit)
 * meets the rule, it is proposed with the calculation and the saving. Nothing is changed until the user
 * accepts a line; `applyProposal` swaps the part and the checks run again on the changed design.
 */
import { awgFor, buildModel, motorFla, panelLayout, spareSpace, SPARE_RULE, type DrawingContext } from '../derive';
import { ALL_PARTS } from '../catalogs';
import { dcLoad } from '../engine';
import { coversSupply, hpKeys, num } from '../engine/select';
import { isIec, SUPPLY_INFO } from '../../standards/regions';
import type { CatalogCategory, CatalogPart, DesignComponent, ElectricalDesign, SupplyVoltage } from '../types';
import { usd } from './facts';
import { piecePrice, priceLine } from '../pricing';

export interface Swap { tag: string; from: string; to: string }

export interface Proposal {
  /** Stable id: tag + new part number. */
  id: string;
  tag: string;
  category: CatalogCategory;
  /** What it is, in plain words ("Motor M1 branch breaker"). */
  what: string;
  from: string;
  to: string;
  fromText: string;
  toText: string;
  /** The calculation, step by step, in plain words. */
  calc: string[];
  /** Saving for the whole line (quantity included), USD; null = a price is still to confirm. */
  saving: number | null;
  /** Part numbers changed (an enclosure takes its back panel along). */
  swaps: Swap[];
}

export interface Checked { tag: string; what: string; result: string }

export interface CostDown { proposals: Proposal[]; checked: Checked[]; total: number; unpricedCount: number }

const amps = (p: CatalogPart) => num(p.ratings.amps) ?? 0;
const vendorOf = (p: CatalogPart) => p.vendor ?? 'automationdirect';
const sameVendor = (a: CatalogPart) => (b: CatalogPart) => vendorOf(b) === vendorOf(a) && b.partNumber !== a.partNumber;

function hpRating(p: CatalogPart, supply: SupplyVoltage): number | undefined {
  for (const k of hpKeys(supply)) { const v = num(p.ratings[k]); if (v !== undefined) return v; }
  return undefined;
}

/** Saving of `qty` pieces from → to, as the order list would price both; null when either price is not known. */
function savingOf(from: string, to: string, qty: number): number | null {
  const a = priceLine(from, qty, undefined, false).extended, b = priceLine(to, qty, undefined, false).extended;
  return a === undefined || b === undefined ? null : Math.round((a - b) * 100) / 100;
}

/** Smallest candidate by `size`, ties broken by price (cheapest first). */
function smallest(cands: CatalogPart[], size: (p: CatalogPart) => number): CatalogPart | undefined {
  return [...cands].sort((a, b) => size(a) - size(b) || (piecePrice(a.partNumber) ?? Infinity) - (piecePrice(b.partNumber) ?? Infinity))[0];
}

const fieldInputs = (d: ElectricalDesign, getPart: DrawingContext['getPart']) =>
  d.ioWiring.filter((w) => w.location && w.location !== 'Cabinet' && w.location !== 'Cabinet door' && !getPart(d.components.find((c) => c.tag === w.deviceTag)?.partNumber ?? '')).length;

export function costDownPass(ctx: DrawingContext): CostDown {
  const d = ctx.design;
  const supply = d.inputs.supply;
  const iec = isIec(ctx.region);
  const info = SUPPLY_INFO[supply];
  const get = ctx.getPart;
  const proposals: Proposal[] = [];
  const checked: Checked[] = [];
  const parts = d.components.map((c) => ({ c, p: get(c.partNumber) })).filter((x): x is { c: DesignComponent; p: CatalogPart } => !!x.p);
  const motorOf = (tag: string | null | undefined) => (tag ? d.inputs.motors.find((m) => m.tag === tag) : undefined);
  const flaText = iec ? 'IEC 60947-4-1 Annex G' : 'NEC Table 430.250';

  /** `mustFix`: the fitted part breaks a sizing limit, so the line is proposed even without a saving. */
  const propose = (c: DesignComponent, from: CatalogPart, to: CatalogPart, what: string, fromText: string, toText: string, calcIn: string[], extra: Swap[] = [], mustFix = '') => {
    let calc = calcIn;
    const swaps = [{ tag: c.tag, from: from.partNumber, to: to.partNumber }, ...extra];
    let saving: number | null = 0;
    for (const s of swaps) {
      const qty = d.components.find((x) => x.tag === s.tag)?.quantity ?? 1;
      const v = savingOf(s.from, s.to, qty);
      saving = v === null || saving === null ? null : saving + v;
    }
    // A smaller part that costs the same or more is no saving: keep the fitted one.
    if (mustFix) calc = [...calc, mustFix];
    else if (saving !== null && saving <= 0) { checked.push({ tag: c.tag, what, result: `${fromText}: a smaller ${toText} part (${to.partNumber}) also meets the rule but costs the same or more — kept.` }); return; }
    proposals.push({ id: `${c.tag}:${to.partNumber}`, tag: c.tag, category: from.category, what, from: from.partNumber, to: to.partNumber, fromText, toText, calc, saving: saving === null ? null : Math.round(saving * 100) / 100, swaps });
  };
  const ok = (c: DesignComponent, what: string, result: string) => checked.push({ tag: c.tag, what, result });

  // Motor branches: breakers, contactors, drives.
  for (const { c, p } of parts) {
    const m = motorOf(c.motorTag);
    if (!m) continue;
    const fla = motorFla(m.hp, supply);
    const flaLine = `Motor ${m.tag} (${m.description || 'motor'}), ${m.hp} HP: full-load current ${fla.toFixed(1)} A (${flaText}).`;
    const onDrive = d.components.some((x) => x.motorTag === m.tag && get(x.partNumber)?.category === 'vfd');
    if (p.category === 'breaker') {
      const factor = onDrive ? 1.75 : 2;
      const poles = num(p.ratings.poles);
      const fits = (min: number) => (x: CatalogPart) => x.category === 'breaker' && num(x.ratings.poles) === poles && coversSupply(x, supply) && String(x.ratings.branchRated ?? 'yes') !== 'no' && amps(x) >= min;
      const pool = ALL_PARTS.filter(sameVendor(p));
      const min = fla * factor;
      const best = smallest(pool.filter(fits(min)), amps) ?? smallest(pool.filter(fits(fla * 1.25)), amps);
      const what = `Motor ${m.tag} branch breaker`;
      const rule = `The breaker must carry the start: at least ${factor} x ${fla.toFixed(1)} A = ${min.toFixed(1)} A${onDrive ? ' (drive input)' : ''}, ${poles}-pole, rated for ${info.label}.`;
      // NEC 430.52: an inverse-time breaker at most 250% of FLA (next size up allowed when that is not a standard size).
      const max = fla * 2.5;
      const over = !iec && amps(p) > max ? `The fitted ${amps(p)} A is above the ${max.toFixed(1)} A limit (250% of FLA, NEC 430.52): the motor is not protected — change it even without a saving.` : '';
      if (best && amps(best) < amps(p)) propose(c, p, best, what, `${amps(p)} A`, `${amps(best)} A`, [flaLine, rule, `Fitted: ${amps(p)} A. Smallest that meets the rule: ${amps(best)} A (${best.partNumber}).`], [], over);
      else ok(c, what, `${amps(p)} A for ${fla.toFixed(1)} A — right size.`);
    } else if (p.category === 'contactor') {
      const coil = (x: CatalogPart) => String(x.ratings.coilVoltage ?? x.ratings.coil ?? '');
      // Same series (SC-E02 → SC-E0x), and the motor's overload must still mount on it.
      const series = (x: CatalogPart) => String(x.ratings.family ?? '').replace(/\d+[A-Z]?$/i, '');
      const ol = d.components.find((x) => x.motorTag === m.tag && get(x.partNumber)?.category === 'overload');
      const forUse = String((ol && get(ol.partNumber)?.ratings.forUse) ?? '');
      const mounts = (x: CatalogPart) => !forUse || !x.ratings.family || forUse.includes(String(x.ratings.family));
      const fits = (x: CatalogPart) => x.category === 'contactor' && coil(x) === coil(p) && series(x) === series(p) && mounts(x) && amps(x) >= fla
        && (info.hz === 50 || (hpRating(x, supply) ?? Infinity) >= m.hp);
      const best = smallest(ALL_PARTS.filter(sameVendor(p)).filter(fits), amps);
      const what = `Motor ${m.tag} contactor`;
      const rule = info.hz === 50 ? `The contactor must switch ${fla.toFixed(1)} A (AC-3).` : `The contactor must be rated for ${m.hp} HP at ${info.label} and ${fla.toFixed(1)} A.`;
      if (best && amps(best) < amps(p)) propose(c, p, best, what, `${amps(p)} A`, `${amps(best)} A`, [flaLine, rule, `Fitted: ${amps(p)} A${hpRating(p, supply) !== undefined ? ` / ${hpRating(p, supply)} HP` : ''}. Smallest of the same family that meets it: ${amps(best)} A${hpRating(best, supply) !== undefined ? ` / ${hpRating(best, supply)} HP` : ''} (${best.partNumber}).`]);
      else ok(c, what, `${amps(p)} A for ${fla.toFixed(1)} A — right size.`);
    } else if (p.category === 'vfd') {
      const out = (x: CatalogPart) => num(x.ratings.outputAmps) ?? 0;
      const single = info.phases === 1;
      const fits = (x: CatalogPart) => x.category === 'vfd' && num(x.ratings.inputVolts) === num(p.ratings.inputVolts) && String(x.ratings.series ?? '') === String(p.ratings.series ?? '')
        && String(x.ratings.inputPhases ?? '') === String(p.ratings.inputPhases ?? '') && out(x) >= fla
        && ((single ? num(x.ratings.hp1ph) : hpRating(x, supply)) ?? Infinity) >= m.hp;
      const best = smallest(ALL_PARTS.filter(sameVendor(p)).filter(fits), out);
      const what = `Motor ${m.tag} drive`;
      if (best && out(best) < out(p)) propose(c, p, best, what, `${out(p)} A output`, `${out(best)} A output`, [flaLine, `The drive must deliver at least ${fla.toFixed(1)} A and be rated for ${m.hp} HP.`, `Fitted: ${out(p)} A. Smallest of the same series: ${out(best)} A (${best.partNumber}).`]);
      else ok(c, what, `${out(p)} A for ${fla.toFixed(1)} A — right size.`);
    }
  }

  // 24 VDC power supplies, then their primary breakers.
  const load = dcLoad(d.components, get, ctx.hmiPartNumber, fieldInputs(d, get));
  const outA = (x: CatalogPart) => num(x.ratings.outputAmps) ?? 0;
  const supplies = parts.filter(({ p }) => p.category === 'powerSupply');
  for (const { c, p } of supplies) {
    const need = (load / supplies.length) * 1.25;
    const fits = (x: CatalogPart) => x.category === 'powerSupply' && num(x.ratings.phases) === num(p.ratings.phases) && String(x.ratings.inputVolts ?? '') === String(p.ratings.inputVolts ?? '') && outA(x) >= need;
    const best = smallest(ALL_PARTS.filter(sameVendor(p)).filter(fits), outA);
    const what = '24 VDC power supply';
    const calc = [`24 VDC load: ${load.toFixed(2)} A (PLC, I/O, relays, valves, HMI and field sensors at typical draw)${supplies.length > 1 ? ` shared by ${supplies.length} supplies` : ''}.`, `Plus 25% reserve: ${need.toFixed(2)} A.`];
    if (best && outA(best) < outA(p)) propose(c, p, best, what, `${outA(p)} A`, `${outA(best)} A`, [...calc, `Fitted: ${outA(p)} A. Smallest of the same input type: ${outA(best)} A (${best.partNumber}).`]);
    else ok(c, what, `${outA(p)} A for ${need.toFixed(2)} A — right size.`);
  }
  for (const { c, p } of parts) {
    if (p.category !== 'breaker' || c.motorTag || !/power supply primary/i.test(c.function)) continue;
    const ps = supplies[0]?.p;
    if (!ps) continue;
    const w = num(ps.ratings.watts) ?? outA(ps) * 24;
    const min = Math.max(2.4, w / 60);
    const poles = num(p.ratings.poles);
    const best = smallest(ALL_PARTS.filter(sameVendor(p)).filter((x) => x.category === 'breaker' && num(x.ratings.poles) === poles && coversSupply(x, supply) && String(x.ratings.branchRated ?? 'yes') !== 'no' && amps(x) >= min), amps);
    const what = 'Power supply primary breaker';
    if (best && amps(best) < amps(p)) {
      const wire = iec ? [] : [`Wire on this breaker can drop from ${awgFor(amps(p))} to ${awgFor(amps(best))} (14 AWG minimum for power).`];
      propose(c, p, best, what, `${amps(p)} A`, `${amps(best)} A`, [`${ps.partNumber}: ${w} W output; the breaker must ride through its switch-on surge: at least ${min.toFixed(1)} A.`, `Fitted: ${amps(p)} A. Smallest that meets it: ${amps(best)} A (${best.partNumber}).`, ...wire]);
    } else ok(c, what, `${amps(p)} A — right size for the ${w} W supply.`);
  }

  // Main disconnect: motors + 25% of the largest + control, x 1.15 (as the engine sizes it). Skipped with heaters.
  const ds = parts.find(({ c, p }) => c.tag === 'DS1' && p.category === 'disconnect' && p.mount === 'backplate');
  const heaters = d.components.some((c) => /heater/i.test(c.function));
  if (ds && !heaters) {
    const flas = d.inputs.motors.map((m) => motorFla(m.hp, supply));
    const ps = supplies[0]?.p;
    const three = info.phases === 3 && info.volts >= 380;
    const ctlA = ps ? ((num(ps.ratings.watts) ?? outA(ps) * 24) / 0.85) / (three ? info.volts * 1.732 : info.volts) : 1;
    const loadA = flas.reduce((a, b) => a + b, 0) + (flas.length ? Math.max(...flas) * 0.25 : 0) + ctlA;
    const maxHp = Math.max(0, ...d.inputs.motors.map((m) => m.hp));
    const handle = String(ds.p.ratings.handleSize ?? '');
    const best = smallest(ALL_PARTS.filter(sameVendor(ds.p)).filter((x) => x.category === 'disconnect' && x.mount === 'backplate' && String(x.ratings.handleSize ?? '') === handle
      && amps(x) >= loadA * 1.15 && coversSupply(x, supply) && (hpRating(x, supply) ?? Infinity) >= maxHp), amps);
    const what = 'Main disconnect';
    if (best && amps(best) < amps(ds.p)) propose(ds.c, ds.p, best, what, `${amps(ds.p)} A`, `${amps(best)} A`, [
      `Load: motors ${flas.map((f) => f.toFixed(1)).join(' + ') || '0'} A + 25% of the largest + control ${ctlA.toFixed(1)} A = ${loadA.toFixed(1)} A.`,
      `With 15% margin: ${(loadA * 1.15).toFixed(1)} A.`, `Fitted: ${amps(ds.p)} A. Smallest with the same handle: ${amps(best)} A (${best.partNumber}).`]);
    else ok(ds.c, what, `${amps(ds.p)} A for ${(loadA * 1.15).toFixed(1)} A — right size.`);
  }

  // Enclosure: the smallest one of the same maker, rating and material that holds everything with the spare rule.
  const enc = proposalForEnclosure(ctx);
  if (enc) {
    const encC = d.components.find((c) => c.tag === enc.tag)!;
    propose(encC, get(enc.from)!, get(enc.to)!, 'Enclosure', enc.fromText, enc.toText, enc.calc, enc.extra);
  } else {
    const e = parts.find(({ p }) => p.category === 'enclosure' && p.ratings.kind === 'enclosure');
    if (e) ok(e.c, 'Enclosure', `${e.p.ratings.heightIn} x ${e.p.ratings.widthIn} x ${e.p.ratings.depthIn} in — no smaller one holds everything with ${Math.round(SPARE_RULE * 100)}% spare space.`);
  }

  const wires = d.inputs.motors.length ? 'Motor and feeder wires are sized from the load (motor current x 125%), not from the breaker: nothing to save there.' : '';
  if (wires) checked.push({ tag: '—', what: 'Wire sizes', result: wires });

  const total = proposals.reduce((s, p) => s + (p.saving ?? 0), 0);
  return { proposals, checked, total: Math.round(total * 100) / 100, unpricedCount: proposals.filter((p) => p.saving === null).length };
}

function proposalForEnclosure(ctx: DrawingContext): { tag: string; from: string; to: string; fromText: string; toText: string; calc: string[]; extra: Swap[] } | null {
  const d = ctx.design;
  const m = buildModel(ctx);
  const encC = m.rc.find((c) => c.category === 'enclosure' && c.part?.ratings.kind === 'enclosure');
  if (!encC?.part) return null;
  const cur = encC.part;
  const subC = d.components.find((c) => ctx.getPart(c.partNumber)?.ratings.kind === 'subpanel');
  const area = (p: CatalogPart) => (num(p.ratings.heightIn) ?? 0) * (num(p.ratings.widthIn) ?? 0);
  const depth = (p: CatalogPart) => num(p.ratings.depthIn) ?? 8;
  const stainless = (p: CatalogPart) => /stainless/i.test(String(p.ratings.material ?? ''));
  const need = String(d.inputs.enclosureRating ?? '').replace(/^NEMA\s*/i, '');
  const L0 = panelLayout(ctx);
  const cands = ALL_PARTS.filter((p) => p.category === 'enclosure' && p.ratings.kind === 'enclosure' && p.manufacturer === cur.manufacturer && p.partNumber !== cur.partNumber
    && stainless(p) === stainless(cur) && String(p.ratings.mounting ?? '') === String(cur.ratings.mounting ?? '')
    && (!need || need === '1' || String(p.ratings.nema ?? '').split('/').includes(need))
    // The disconnect shaft is cut for the depth class (up to 8 in, or deeper).
    && (depth(p) > 8) === (depth(cur) > 8) && area(p) < area(cur))
    .sort((a, b) => area(a) - area(b));
  for (const p of cands) {
    const sub = String(p.ratings.subpanel ?? '');
    if (subC && !ALL_PARTS.some((x) => x.partNumber === sub)) continue;
    const components = d.components.map((c) => (c.tag === encC.tag ? { ...c, partNumber: p.partNumber } : subC && c.tag === subC.tag ? { ...c, partNumber: sub } : c));
    const c2: DrawingContext = { ...ctx, design: { ...d, components }, machineLayout: undefined };
    const L = panelLayout(c2);
    if (L.overflow || L.notFit.length || L.door.overflow) continue;
    const spare = spareSpace(c2).panel;
    if (spare < SPARE_RULE) continue;
    const before = spareSpace(ctx).panel;
    const size = (x: CatalogPart) => `${x.ratings.heightIn} x ${x.ratings.widthIn} x ${x.ratings.depthIn} in`;
    return {
      tag: encC.tag, from: cur.partNumber, to: p.partNumber, fromText: size(cur), toText: size(p),
      calc: [
        `Every back-panel part was placed on the smaller back panel: ${Math.round(spare * 100)}% spare space left (rule: at least ${Math.round(SPARE_RULE * 100)}%; now ${Math.round(before * 100)}%).`,
        `The door still holds the touch panel, buttons and handle${L0.door.items.length ? ` (${L.door.items.length} items)` : ''}.`,
        `Same maker, rating (${d.inputs.enclosureRating}) and depth class, so the disconnect shaft still fits.`,
        ...(subC ? [`Back panel changes with it: ${subC.partNumber} → ${sub}.`] : []),
      ],
      extra: subC ? [{ tag: subC.tag, from: subC.partNumber, to: sub }] : [],
    };
  }
  return null;
}

/** The design with one proposal applied: parts swapped and the reason noted in each function text. */
export function applyProposal(design: ElectricalDesign, p: Proposal): ElectricalDesign {
  const byTag = new Map(p.swaps.map((s) => [s.tag, s]));
  return {
    ...design,
    components: design.components.map((c) => {
      const s = byTag.get(c.tag);
      if (!s || c.partNumber !== s.from) return c;
      const base = c.function.replace(/ — right-sized.*$/, '');
      return { ...c, partNumber: s.to, function: s.tag === p.tag ? `${base} — right-sized (cost-down): ${p.fromText} → ${p.toText}` : c.function };
    }),
  };
}

/** Plain-words line for a proposal's saving. */
export const savingText = (p: Proposal) => (p.saving === null ? 'saving: price to confirm' : `saves ${usd(p.saving)}`);
