/**
 * The engineer's own checks (beyond the Design review rules): SCCR weak link, heat load, spare I/O and
 * panel space, motor-cable voltage drop, selectivity, safety rating, maintainability and obsolete
 * parts. Each finding names where it is on the drawings and, where a part swap fixes it, offers it.
 */
import { billOfMaterials, buildModel, cableSchedule, panelLayout, type DrawingContext } from '../electrical/derive';
import { planDrawings } from '../electrical/drawings/plan';
import { panelSccr } from '../electrical/sccr';
import { ALLOWED_RISE_C, cabinetHeat } from '../electrical/thermal';
import { awgToMm2, SUPPLY_INFO } from '../standards/regions';
import { equivalentsOf, sourcingFlags, sourcingOf } from '../sourcing/data';
import type { Finding, Severity, ReviewArea } from '../review/types';
import type { ProjectSnapshot } from '../deliverables/collect';
import { ioCapacity, moduleSlots } from '../plc/core/modules';

/** A finding with where it is on the drawings and an optional one-click fix. */
export interface EngineerFinding extends Finding {
  /** Drawing sheets showing the device, e.g. "CNV-E-04, CNV-E-05". */
  ref?: string;
  oneClick?: { label: string; kind: 'swap'; from: string; to: string };
}

export interface EngineerInput {
  ctx: DrawingContext;
  /** I/O points used and the PLC's capacity (CPU + modules). */
  io: { inputs: number; outputs: number; capInputs: number; capOutputs: number };
  /** Safety performance level the description asks for ("d"), if any. */
  requiredPL?: string | null;
}

const num = (v: unknown) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : NaN; };

/** Drawing numbers of the sheets that show these tags. */
export function drawingRefs(ctx: DrawingContext): (tags: string[]) => string {
  try {
    const plan = planDrawings(ctx);
    const noOf = new Map(plan.sheets.map((s) => [s.n, s.drawingNo]));
    return (tags) => [...new Set(tags.flatMap((t) => plan.where.get(t) ?? []))].sort((a, b) => a - b).map((n) => noOf.get(n) ?? `sheet ${n}`).join(', ');
  } catch { return () => ''; }
}

export function engineerChecks({ ctx, io, requiredPL }: EngineerInput): EngineerFinding[] {
  const out: EngineerFinding[] = [];
  const ref = drawingRefs(ctx);
  const add = (id: string, severity: Severity, area: ReviewArea, title: string, detail: string, fix: string, tags: string[] = [], oneClick?: EngineerFinding['oneClick']) =>
    out.push({ id: `eng:${id}`, source: 'check', severity, area, title, detail, fix, page: 'electrical', item: tags[0] ?? '', ...(tags.length ? { ref: ref(tags) } : {}), ...(oneClick ? { oneClick } : {}) });
  const m = buildModel(ctx);

  // SCCR weak link: the lowest-rated part sets the panel's marked SCCR.
  const sccr = panelSccr(ctx);
  if (sccr.lowest !== null && sccr.limiting.length) {
    const tag = sccr.limiting[0];
    const pn = m.rc.find((c) => c.tag === tag)?.partNumber ?? '';
    const better = pn ? equivalentsOf(pn).find((e) => num(e.part.ratings.interruptingKA ?? e.part.ratings.sccrKA) > sccr.lowest!) : undefined;
    // minor: the site's available fault current is not known, so a low rating is advice, not a defect (the SCCR code rule agrees)
    add(`sccr-weak:${tag}`, 'minor', 'electrical', `SCCR weak link: ${sccr.limiting.join(', ')} (${sccr.lowest} kA)`,
      `The panel can only be marked ${sccr.lowest} kA because of ${sccr.limiting.join(', ')}. If the available fault current at the site is higher, the panel may not be installed there (UL 508A SB / NEC 409.22).`,
      better ? `Use ${better.part.partNumber} (${better.part.manufacturer}, ${better.part.ratings.interruptingKA ?? better.part.ratings.sccrKA} kA) or add current-limiting fuses ahead of it.` : 'Use a higher-rated part or current-limiting protection ahead of it; confirm the site fault current.',
      sccr.limiting, better && pn ? { label: `Use ${better.part.partNumber}`, kind: 'swap', from: pn, to: better.part.partNumber } : undefined);
  }
  if (sccr.unknown.length) add('sccr-unknown', 'major', 'electrical', `No SCCR known for ${sccr.unknown.join(', ')}`, 'Without a short-circuit rating for every power part the panel SCCR cannot be calculated or marked.', 'Find the rating in the maker\'s SCCR / UL data, or choose parts that publish one.', sccr.unknown);

  // Heat load.
  const heat = cabinetHeat(ctx.design.components, ctx.getPart);
  if (heat.rise !== null && heat.rise > ALLOWED_RISE_C) {
    add('heat', heat.rise > ALLOWED_RISE_C * 1.5 ? 'major' : 'minor', 'electrical', `Cabinet runs ${Math.round(heat.rise)} °C above ambient`,
      `${Math.round(heat.watts)} W of heat in ${heat.area?.toFixed(2)} m² of surface: more than the ${ALLOWED_RISE_C} °C rise the parts are rated for at a 40 °C room.`,
      heat.ventilation ? `Fit a filter fan for about ${Math.round(heat.ventilation.airflowM3h)} m³/h, or a larger enclosure.` : 'Fit a filter fan or a larger enclosure.');
  }

  // Spare I/O (20 % is the usual design allowance) and panel space.
  for (const [kind, used, cap] of [['inputs', io.inputs, io.capInputs], ['outputs', io.outputs, io.capOutputs]] as const) {
    if (!cap) continue;
    const spare = (cap - used) / cap;
    if (used > cap) add(`io-over-${kind}`, 'critical', 'equipment', `More ${kind} than the PLC has (${used} of ${cap})`, `The I/O list uses ${used} ${kind}; the CPU and modules have ${cap}.`, 'Add an I/O module on the Equipment page.');
    else if (spare < 0.15) add(`io-spare-${kind}`, 'minor', 'equipment', `Only ${cap - used} spare ${kind} (${Math.round(spare * 100)} %)`, `${used} of ${cap} ${kind} are used. A machine usually keeps 15-20 % spare for changes during commissioning.`, 'Add an I/O module or a larger CPU on the Equipment page.');
  }
  const lay = panelLayout(ctx);
  if (lay.overflow || lay.notFit.length) add('space', 'major', 'electrical', 'Parts do not fit on the back panel', `${lay.notFit.map((n) => n.tag).join(', ') || 'Some parts'} do not fit in the ${lay.enclosure.w}×${lay.enclosure.h} mm enclosure.`, 'Choose a larger enclosure, or narrower parts.', lay.notFit.map((n) => n.tag));

  // Voltage drop of motor cables with a known length (3-phase: √3·I·L·ρ/A; copper ρ = 0.0175 Ω·mm²/m).
  const volts = SUPPLY_INFO[ctx.design.inputs.supply]?.volts ?? 480;
  for (const c of cableSchedule(ctx).filter((x) => x.kind === 'motor')) {
    const len = c.length.match(/([\d.]+)\s*(m|ft)\b/i);
    const mm2 = /mm²/.test(c.size) ? num(c.size) : awgToMm2(c.size);
    const motor = m.motors.find((x) => x.motor.tag === c.to);
    if (!len || !mm2 || !motor) continue;
    const meters = num(len[1]) * (/ft/i.test(len[2]) ? 0.3048 : 1);
    const drop = (Math.sqrt(3) * motor.fla * meters * 0.0175) / mm2 / volts * 100;
    if (drop > 3) add(`vdrop:${c.tag}`, drop > 5 ? 'major' : 'minor', 'electrical', `Voltage drop ${drop.toFixed(1)} % on ${c.tag} to ${c.to}`,
      `${motor.fla.toFixed(1)} A over ${Math.round(meters)} m of ${c.size}: ${drop.toFixed(1)} % drop (3 % is the usual limit for a branch circuit, 5 % in total).`, 'Use the next larger conductor size for this cable.', [c.to]);
  }

  // Selectivity: a branch breaker as large as the main protection trips together with it.
  const mainA = num(m.mainBreaker?.part?.ratings.amps ?? m.disconnect?.part?.ratings.fuseAmps);
  if (Number.isFinite(mainA)) {
    for (const mm of m.motors) {
      const a = num(mm.protection?.part?.ratings.amps);
      if (Number.isFinite(a) && a >= mainA) add(`select:${mm.motor.tag}`, 'minor', 'electrical', `${mm.protection!.tag} (${a} A) is not selective with the main protection (${mainA} A)`, 'A fault on this motor branch may trip the main breaker too and stop the whole machine.', 'Use a smaller branch breaker (sized to the motor) or a larger main.', [mm.protection!.tag]);
    }
  }

  // Safety: relay rating against what the description asks for.
  const relay = m.safety.relay;
  const pl = String(relay?.part?.ratings.PL ?? '').toLowerCase();
  if (relay && requiredPL && pl && pl < requiredPL.toLowerCase()) add('safety-pl', 'critical', 'safety', `Safety relay ${relay.tag} is PL ${pl}; the description asks for PL ${requiredPL}`, 'The safety function cannot reach the required performance level with this relay.', 'Choose a safety relay rated for the required PL and category (ISO 13849-1), and dual-channel devices.', [relay.tag]);
  else if (relay && !pl && m.safety.estops.length) add('safety-pl-unknown', 'minor', 'safety', `Performance level of ${relay.tag} not in the catalog`, 'The safety function\'s PL / category cannot be shown without the relay\'s rating.', 'Check the relay datasheet and record the PL / category in the safety validation.', [relay.tag]);

  // Maintainability: plain fuses on control circuits (no blown-fuse indication).
  const plainFuses = m.rc.filter((c) => c.category === 'fuse' && !/indicat|led/i.test(`${c.part?.description ?? ''} ${c.part?.ratings.indicator ?? ''}`));
  if (plainFuses.length) add('maint-fuses', 'info', 'electrical', 'Fuses without blown-fuse indication', `${plainFuses.map((c) => c.tag).join(', ')}: a maintenance technician has to test each fuse to find a blown one.`, 'Use indicating fuse holders or miniature circuit breakers where the SCCR allows.', plainFuses.map((c) => c.tag));

  // Obsolete / end-of-life / back-ordered parts.
  for (const g of billOfMaterials(ctx)) for (const l of g.lines) {
    if (!l.partNumber) continue;
    const s = sourcingOf(l.partNumber);
    const f = sourcingFlags(s);
    if (!f.length) continue;
    const alt = s.successor ?? equivalentsOf(l.partNumber)[0]?.part.partNumber;
    add(`sourcing:${l.partNumber}`, f.some((x) => x.level === 'red') ? 'major' : 'minor', 'equipment', `${l.partNumber}: ${f.map((x) => x.text).join(', ')}`,
      `${l.description}. ${f.map((x) => x.text).join('; ')}${s.checkedOn ? ` (checked ${s.checkedOn})` : ''}.`,
      alt ? `Replace it with ${alt}.` : 'Choose an available part on the Sourcing page.', l.tags, alt ? { label: `Use ${alt}`, kind: 'swap', from: l.partNumber, to: alt } : undefined);
  }
  return out;
}

/** The engineer rule checks for a project snapshot (part of the Design review, so every count agrees). */
export function engineerChecksFor(p: ProjectSnapshot): EngineerFinding[] {
  if (!p.drawingCtx) return [];
  const cap = ioCapacity(p.cpu, moduleSlots(p.modules));
  const used = (t: 'input' | 'output') => p.io.filter((pt) => pt.type === t && p.addresses.get(pt.id)).length;
  const pl = `${p.spec.safety ?? ''} ${p.spec.guarding ?? ''}`.match(/\bPL\s*([a-e])\b/i)?.[1] ?? null;
  return engineerChecks({ ctx: p.drawingCtx, io: { inputs: used('input'), outputs: used('output'), capInputs: cap.inputs, capOutputs: cap.outputs }, requiredPL: pl });
}
