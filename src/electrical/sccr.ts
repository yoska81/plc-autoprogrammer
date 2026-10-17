/**
 * Panel short-circuit current rating by the UL 508A Supplement SB method (SB4): every component in the power
 * circuit with its own rating (catalog SCCR, interrupting rating, or the Table SB4.1 default where SB allows
 * one); the panel rating is the lowest, limited by the parts that carry it. The isolated 24 VDC secondary is
 * not part of the determination.
 */
import { SUPPLY_INFO } from '../standards/regions';
import { buildModel, isFuseCartridge, supplyText, terminalPlan, upstreamOcpd, type DrawingContext, type ResolvedComponent } from './derive';

export interface SccrRow {
  tag: string; component: string; circuit: string; kA: number | null; source: string; note: string;
  /** Catalog condition for the rating ("with Class J fuses, 30 A max."), empty when unconditional. */
  condition: string;
  /** False when the design does not meet the condition: the rating is not counted. */
  met: boolean;
  /** Where the rating comes from (manual URL). */
  sourceUrl?: string;
}
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
  /** Counted ratings that hold only under a condition ("SCCR valid with …" on the nameplate). */
  conditions: { tag: string; condition: string }[];
  /** Parts without a published SCCR that UL 508A SB4 may exempt (power supplies): not counted, not blocking. */
  exemptCheck: string[];
  /** Ratings not counted because the design does not (visibly) meet their condition. */
  unmet: { tag: string; condition: string; why: string }[];
}

const CLASS = '(?:J|CC|T|RK1|RK5|L|G)';
/** Fuse classes a text names, slash lists included ("Class CC/J/T" → CC, J, T). */
function fuseClasses(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(new RegExp(`\\bclass\\s*(${CLASS}(?:\\s*\\/\\s*${CLASS})*)\\b`, 'gi'))) for (const c of m[1].split('/')) out.add(c.trim().toUpperCase());
  return [...out];
}

/** The protection a condition asks for, in a few words for the nameplate and the review ("CLASS CC/J/T FUSES, 30 A MAX."). */
export function shortCondition(condition: string): string {
  const classes = fuseClasses(condition);
  const maxA = /max\.?\s*(\d+(?:\.\d+)?)\s*A\b/i.exec(condition)?.[1] ?? /(\d+(?:\.\d+)?)\s*A\s*max/i.exec(condition)?.[1];
  if (classes.length) return `Class ${classes.join('/')} fuses${maxA ? `, ${maxA} A max.` : ''}`;
  if (/\btype e\b|self[- ]protected/i.test(condition)) return 'Type E self-protected starter';
  if (/\b(circuit )?breaker|\bMCCB\b/i.test(condition)) return `branch-circuit breaker${maxA ? `, ${maxA} A max.` : ''}`;
  return condition.length > 70 ? `${condition.slice(0, 67).replace(/\s+\S*$/, '')}...` : condition;
}

/**
 * Does the protection ahead of a part meet its SCCR condition? Read from the condition's words: a fuse class
 * ("Class J / CC / T / RK1 / RK5"), a circuit breaker, a Type E / self-protected starter, and an amp limit
 * ("30 A max."). A condition the design cannot be checked against is not met (the review asks to confirm it).
 */
export function conditionMet(condition: string, prot: ResolvedComponent | undefined): { met: boolean; why: string } {
  if (!prot) return { met: false, why: 'no protective device ahead of it in the design' };
  const rr = prot.part?.ratings ?? {};
  const desc = `${prot.part?.description ?? ''} ${prot.fuse?.description ?? ''}`;
  const classes = fuseClasses(condition);
  if (classes.length) {
    const have = String(prot.fuse?.ratings.fuseClass ?? rr.fuseClass ?? (fuseClasses(desc)[0] ?? '')).toUpperCase();
    if (prot.category !== 'fuse' || !classes.includes(have)) return { met: false, why: `${prot.tag} is not a Class ${classes.join(' / ')} fuse` };
  } else if (/\b(circuit )?breaker|\bMCCB\b|inverse[- ]time/i.test(condition)) {
    if (prot.category !== 'breaker' || /no/i.test(String(rr.branchRated ?? ''))) return { met: false, why: `${prot.tag} is not a branch-circuit breaker` };
  } else if (/\btype e\b|self[- ]protected|manual motor (starter|protector)/i.test(condition)) {
    if (prot.category !== 'motorProtector') return { met: false, why: `${prot.tag} is not a Type E / self-protected starter` };
  } else if (!/\bfuse/i.test(condition) || prot.category !== 'fuse') {
    return { met: false, why: 'condition not checkable from the design' };
  }
  const maxA = Number(/(\d+(?:\.\d+)?)\s*A\b[^.]*\bmax/i.exec(condition)?.[1] ?? /max\.?\s*(\d+(?:\.\d+)?)\s*A\b/i.exec(condition)?.[1] ?? NaN);
  const amps = Number(prot.fuse?.ratings.amps ?? rr.amps ?? NaN);
  if (Number.isFinite(maxA) && Number.isFinite(amps) && amps > maxA) return { met: false, why: `${prot.tag} is ${amps} A, above the ${maxA} A allowed` };
  return { met: true, why: '' };
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
  const conditions: PanelSccr['conditions'] = [];
  const exemptCheck: string[] = [];
  const unmet: PanelSccr['unmet'] = [];
  let lowest: number | null = null, limiting: string[] = [];
  // The protection ahead of each part, for its rating's condition. The main disconnect without main protection
  // in the panel: the condition is a requirement on the upstream protection by others (stated with it).
  const upstream = upstreamOcpd(ctx);
  const protOf = new Map<ResolvedComponent, ResolvedComponent | 'upstream' | undefined>();
  if (m.disconnect) protOf.set(m.disconnect, upstream ? 'upstream' : m.mainBreaker);
  for (const mm of m.motors) for (const c of [...mm.contactors, mm.overload, mm.vfd]) if (c) protOf.set(c, mm.protection);
  for (const b of m.psBranches) protOf.set(b.ps, b.protection);
  if (m.xfmrBranch) protOf.set(m.xfmrBranch.xfmr, m.xfmrBranch.protection);
  const add = (c: ResolvedComponent, circuit: string, kA: number | null, source: string, note = '') => {
    const rr = c.part?.ratings ?? {};
    const condition = String(rr.sccrCondition ?? rr.sccrNote ?? '').trim();
    const sourceUrl = rr.sccrSource ? String(rr.sccrSource) : undefined;
    let met = true;
    if (kA !== null && condition) {
      const prot = protOf.get(c);
      const chk = prot === 'upstream' ? { met: true, why: '' } : conditionMet(condition, prot);
      met = chk.met;
      const short = shortCondition(condition);
      if (met) conditions.push({ tag: c.tag, condition: prot === 'upstream' ? `${short} (upstream protection by others)` : short });
      else unmet.push({ tag: c.tag, condition: short, why: chk.why });
    }
    rows.push({ tag: c.tag, component: `${c.tag} ${c.partNumber}`, circuit, kA, source, note: [note, condition && `${met ? 'Valid with' : 'NOT COUNTED — needs'}: ${condition}`].filter(Boolean).join('; '), condition, met, sourceUrl });
    if (kA === null) { unknown.push(c.tag); return; }
    if (!met) return;
    if (lowest === null || kA < lowest) { lowest = kA; limiting = [c.tag]; } else if (kA === lowest) limiting.push(c.tag);
  };
  const r = (c: ResolvedComponent) => c.part?.ratings ?? {};
  // a separate 480 V rating applies on 480 V and higher supplies
  const hi = SUPPLY_INFO[m.supply].volts >= 480;
  const kA = (c: ResolvedComponent) => (hi ? num(r(c).sccrKA480) : null) ?? num(r(c).sccrKA);
  const seen = new Set<ResolvedComponent>();
  const protectiveRow = (c: ResolvedComponent | undefined, circuit: string) => {
    if (!c || seen.has(c)) return;
    seen.add(c);
    if (c.category === 'disconnect') {
      const k = num(r(c).sccrKA);
      add(c, circuit, k, k !== null ? 'Catalog SCCR' : 'Not published');
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
    if (mm.vfd) { const k = kA(mm.vfd); add(mm.vfd, `${mm.motor.tag} branch`, k, k !== null ? 'Catalog SCCR' : 'Not in catalog', k !== null ? '' : 'Obtain the drive SCCR and required protection from the drive manual'); }
  }
  if (m.xfmrBranch) { protectiveRow(m.xfmrBranch.protection, 'Control transformer'); add(m.xfmrBranch.xfmr, 'Control transformer', num(r(m.xfmrBranch.xfmr).sccrKA), 'Not published', 'Confirm rating / exemption with the manufacturer'); }
  for (const b of m.psBranches) {
    protectiveRow(b.protection, `${b.ps.tag} primary`);
    if (b.fromXfmr) continue;
    const k = kA(b.ps);
    if (k !== null) { add(b.ps, `${b.ps.tag} primary`, k, 'Catalog SCCR'); continue; }
    // Makers publish no SCCR for power supplies: not counted and not blocking, listed for the UL 508A SB4 check
    // (Class 2 / isolated-secondary sources and branch-protected supplies are handled by the SB4 exemptions).
    const class2 = /yes/i.test(String(r(b.ps).necClass2 ?? ''));
    exemptCheck.push(b.ps.tag);
    rows.push({ tag: b.ps.tag, component: `${b.ps.tag} ${b.ps.partNumber}`, circuit: `${b.ps.tag} primary`, kA: null, source: 'Not published by the maker',
      note: `Check the UL 508A SB4 exemption${class2 ? ' (NEC Class 2 supply)' : b.protection ? ` (branch protection ${b.protection.tag} ahead)` : ''}; not counted`, condition: '', met: true });
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
    : `Preliminary panel SCCR = ${low} kA at ${supplyText(m.supply)} (lowest rating, limited by ${limiting.join(', ')}).${unknown.length ? ` UNKNOWN ratings for ${unknown.join(', ')} must be obtained before the nameplate is marked.` : ''}${unmet.length ? ` Not counted (condition not met): ${unmet.map((u) => `${u.tag} needs ${u.condition}`).join('; ')}.` : ''}${conditions.length ? ` Valid with: ${conditions.map((x) => `${x.tag} ${x.condition}`).join('; ')}.` : ''}${exemptCheck.length ? ` Not published, check the UL 508A SB4 exemption: ${exemptCheck.join(', ')}.` : ''} The available fault current at the installation must not exceed the marked SCCR.`;
  const out = { rows, lowest: low, limiting, unknown, result, conditions, unmet, exemptCheck };
  cache.set(ctx, out);
  return out;
}
