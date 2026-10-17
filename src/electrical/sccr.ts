/**
 * Panel short-circuit current rating by the UL 508A Supplement SB method (SB4): every component in the power
 * circuit with its own rating (catalog SCCR, interrupting rating, or the Table SB4.1 default where SB allows
 * one); the panel rating is the lowest, limited by the parts that carry it. The isolated 24 VDC secondary is
 * not part of the determination.
 */
import { buildModel, isFuseCartridge, supplyText, terminalPlan, type DrawingContext, type ResolvedComponent } from './derive';

export interface SccrRow { tag: string; component: string; circuit: string; kA: number | null; source: string; note: string }
export interface PanelSccr {
  rows: SccrRow[];
  /** Lowest rating found (kA), null when no rating is known. */
  lowest: number | null;
  /** Tags that set the lowest rating. */
  limiting: string[];
  /** Tags without a rating: the panel cannot be marked until they are known. */
  unknown: string[];
  /** One-paragraph result for the documents. */
  result: string;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

const cache = new WeakMap<DrawingContext, PanelSccr>();

export function panelSccr(ctx: DrawingContext): PanelSccr {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const m = buildModel(ctx);
  const rows: SccrRow[] = [];
  const unknown: string[] = [];
  let lowest: number | null = null, limiting: string[] = [];
  const add = (c: ResolvedComponent, circuit: string, kA: number | null, source: string, note = '') => {
    rows.push({ tag: c.tag, component: `${c.tag} ${c.partNumber}`, circuit, kA, source, note });
    if (kA === null) { unknown.push(c.tag); return; }
    if (lowest === null || kA < lowest) { lowest = kA; limiting = [c.tag]; } else if (kA === lowest) limiting.push(c.tag);
  };
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
  const powerTerms = terminalPlan(ctx).flatMap((s) => s.terminals).filter((t) => m.motors.some((mm) => mm.loadWires.includes(t.wire)));
  if (powerTerms.length) {
    const tb = m.rc.find((c) => c.category === 'terminal' && !/ground|pe\b|fused/i.test(c.part?.description ?? ''));
    if (tb) add(tb, 'Motor feeder terminals', num(r(tb).sccrKA) ?? 10, num(r(tb).sccrKA) !== null ? 'Catalog' : 'Default 10 kA (UL 508A Table SB4.1, terminal blocks)', `${powerTerms.length} terminals carry motor power`);
  }
  const low = lowest as number | null;
  const result = low === null
    ? 'Panel SCCR cannot be determined: no component ratings available.'
    : `Preliminary panel SCCR = ${low} kA at ${supplyText(m.supply)} (lowest rating, limited by ${limiting.join(', ')}).${unknown.length ? ` UNKNOWN ratings for ${unknown.join(', ')} must be obtained before the nameplate is marked.` : ''} The available fault current at the installation must not exceed the marked SCCR.`;
  const out = { rows, lowest: low, limiting, unknown, result };
  cache.set(ctx, out);
  return out;
}
