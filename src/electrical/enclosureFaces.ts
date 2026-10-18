/**
 * Enclosure wall machining (bottom, top, left, right): cable glands / cord grips for every cable
 * that leaves the cabinet, filter-fan and outlet-filter cutouts when the heat calculation needs
 * ventilation, the stack light on the top and the air inlet of a pneumatic panel.
 *
 * Nothing is invented: hole sizes are the standard knockout / clearance holes of the gland thread;
 * cable outside diameters, fan cutouts and fitting holes are not in the catalog, so they are stated
 * as assumptions, and parts without a known hole are marked (centre mark + outline, not cut).
 *
 * Views (each face seen from outside, datum lower-left):
 *  - BOTTOM / TOP: X along the width from the left side (as seen from the front), Y from the door edge to the back.
 *  - LEFT: X from the back wall to the door edge, Y up.  RIGHT: X from the door edge to the back wall, Y up.
 */
import { isIec } from '../standards/regions';
import { getHmi } from '../hmi/hmiCatalog';
import {
  buildModel, dualDim, dualSize, finishCodes, numberIds, panelLayout, MACHINING_SCALE_NOTE,
  type Cable, type DrawingContext, type DrillCutout, type DrillingPlan, type EnclosureFace,
} from './derive';
import { cabinetHeat } from './thermal';

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Clear of the door return / gasket and of the back wall (subpanel studs), mm. */
const FRONT_CLEAR = 60;
const BACK_CLEAR = 40;
const SIDE_CLEAR = 40;
/** Depth used when the catalog has no enclosure depth (stated on the drawing). */
const DEFAULT_DEPTH = 200;

/** Gland / cord grip sizes: entry hole (standard) and typical cable OD range (check the gland datasheet). */
interface GlandSize { size: string; hole: number; minOd: number; maxOd: number }
/** Metric cable glands (EN 62444, thread EN 60423): hole = thread + 0.5 mm. */
const METRIC: GlandSize[] = [
  { size: 'M16', hole: 16.5, minOd: 4.5, maxOd: 10 }, { size: 'M20', hole: 20.5, minOd: 6, maxOd: 12 },
  { size: 'M25', hole: 25.5, minOd: 9, maxOd: 17 }, { size: 'M32', hole: 32.5, minOd: 13, maxOd: 21 },
  { size: 'M40', hole: 40.5, minOd: 19, maxOd: 28 }, { size: 'M50', hole: 50.5, minOd: 27, maxOd: 35 },
  { size: 'M63', hole: 63.5, minOd: 34, maxOd: 48 },
];
/** NPT cord grips in standard conduit knockouts (1/2" KO = 0.875" etc.). */
const NPT: GlandSize[] = [
  { size: '1/2" NPT', hole: 22.2, minOd: 3, maxOd: 13 }, { size: '3/4" NPT', hole: 28.2, minOd: 8, maxOd: 18 },
  { size: '1" NPT', hole: 34.9, minOd: 12, maxOd: 24 }, { size: '1-1/4" NPT', hole: 44.0, minOd: 18, maxOd: 31 },
  { size: '1-1/2" NPT', hole: 50.4, minOd: 24, maxOd: 37 }, { size: '2" NPT', hole: 62.7, minOd: 30, maxOd: 48 },
];

// Estimated cable OD: insulated core diameter x lay-up factor + jacket (+ shield).
const COND_MM: Record<string, number> = { '22': 0.76, '20': 0.96, '18': 1.22, '16': 1.5, '14': 1.9, '12': 2.4, '10': 3.0, '8': 3.9, '6': 4.9, '4': 6.2, '2': 7.8 };
const LAYUP: Record<number, number> = { 1: 1, 2: 2, 3: 2.16, 4: 2.42, 5: 2.7, 6: 3, 7: 3, 8: 3.3, 9: 3.6, 10: 3.9, 12: 4.2, 14: 4.4, 16: 4.7, 19: 5, 24: 5.6, 25: 6, 27: 6.15, 30: 6.5, 37: 7 };

function condMm(size: string): number {
  const awg = /(\d+)\s*AWG/i.exec(size)?.[1];
  if (awg) return COND_MM[awg] ?? 1.22;
  const mm2 = parseFloat(size);
  return Number.isFinite(mm2) && mm2 > 0 ? 1.15 * Math.sqrt((4 * mm2) / Math.PI) : 1.22;
}

/** Estimated outside diameter (mm) of a multi-core cable. */
export function estimateCableOd(cores: number, size: string, shielded: boolean): number {
  const d = condMm(size);
  const ins = d + 2 * (d < 1.6 ? 0.5 : d < 3.5 ? 0.76 : 1.1);
  const n = Math.max(1, Math.round(cores));
  const k = LAYUP[n] ?? LAYUP[Object.keys(LAYUP).map(Number).filter((x) => x >= n)[0]] ?? 1.155 * Math.sqrt(n) + 0.3;
  const core = ins * k;
  return r1(core + 2 * (core > 10 ? 1.5 : 1.1) + (shielded ? 0.6 : 0));
}

const coresOf = (c: Cable) => Number(/(\d+)\s*-?\s*core/i.exec(c.type)?.[1]) || c.cores.length + c.spareCores || 3;

export interface CableEntry { tag: string; to: string; od: number; gland: GlandSize | null; power: boolean }

/** Every cable that leaves the cabinet (field cables from the cabinet terminals and the incoming supply). */
export function cableEntries(ctx: DrawingContext): CableEntry[] {
  const m = buildModel(ctx);
  const sizes = isIec(ctx.region) ? METRIC : NPT;
  const pick = (od: number) => sizes.find((g) => od >= g.minOd && od <= g.maxOd) ?? null;
  const jbs = new Set(m.machine.jbs.map((j) => j.tag));
  const out: CableEntry[] = [];
  for (const c of m.machine.cables) {
    if (jbs.has(c.from)) continue; // starts at a junction box, not at the cabinet
    const od = estimateCableOd(coresOf(c), c.size, /shield|screen/i.test(c.type));
    out.push({ tag: c.tag, to: c.to, od, gland: pick(od), power: c.kind === 'motor' });
  }
  const supplyOd = estimateCableOd(m.incoming.length + 1, m.mainAwg, false);
  out.push({ tag: 'SUPPLY', to: `${m.incoming.join('/')}+PE ${m.mainAwg}`, od: supplyOd, gland: pick(supplyOd), power: true });
  return out;
}

/** Typical filter-fan cutout of the size class for an air flow (common makers' sizes), mm. */
function fanClass(m3h: number): { cutout: number; upTo: number } | null {
  for (const c of [{ cutout: 92, upTo: 55 }, { cutout: 125, upTo: 105 }, { cutout: 177, upTo: 230 }, { cutout: 224, upTo: 550 }, { cutout: 292, upTo: 900 }]) if (m3h <= c.upTo) return c;
  return null;
}

const FACE_TITLE: Record<EnclosureFace, string> = { bottom: 'ENCLOSURE BOTTOM', top: 'ENCLOSURE TOP', left: 'ENCLOSURE LEFT SIDE', right: 'ENCLOSURE RIGHT SIDE' };
const FACE_VIEW: Record<EnclosureFace, string> = {
  bottom: 'VIEWED FROM BELOW (OUTSIDE). X FROM THE LEFT SIDE AS SEEN FROM THE FRONT, Y FROM THE DOOR EDGE TOWARDS THE BACK.',
  top: 'VIEWED FROM ABOVE (OUTSIDE). X FROM THE LEFT SIDE AS SEEN FROM THE FRONT, Y FROM THE DOOR EDGE TOWARDS THE BACK.',
  left: 'VIEWED FROM THE LEFT (OUTSIDE). X FROM THE BACK WALL TOWARDS THE DOOR, Y UP FROM THE BOTTOM.',
  right: 'VIEWED FROM THE RIGHT (OUTSIDE). X FROM THE DOOR EDGE TOWARDS THE BACK WALL, Y UP FROM THE BOTTOM.',
};

/**
 * Machining of the enclosure walls, one plan per wall that has something on it (bottom, top, left, right).
 */
export function enclosureFaceDrilling(ctx: DrawingContext): DrillingPlan[] {
  const L = panelLayout(ctx);
  const m = buildModel(ctx);
  const W = L.enclosure.w, H = L.enclosure.h;
  const D = L.enclosure.d ?? DEFAULT_DEPTH;
  const depthNote = L.enclosure.d ? [] : [`ENCLOSURE DEPTH NOT IN THE CATALOG: ${dualDim(DEFAULT_DEPTH)} ASSUMED — CHECK BEFORE CUTTING.`];
  const encName = `${L.enclosure.tag ?? 'ENCLOSURE'} ${L.enclosure.partNumber ?? ''}`.trim();
  const iec = isIec(ctx.region);
  const faces: Record<EnclosureFace, { cutouts: DrillCutout[]; notes: string[]; specs: Record<string, string> }> = {
    bottom: { cutouts: [], notes: [], specs: {} }, top: { cutouts: [], notes: [], specs: {} }, left: { cutouts: [], notes: [], specs: {} }, right: { cutouts: [], notes: [], specs: {} },
  };

  // 1. Cable entries on the bottom (drip-proof for NEMA 12 / IP54): control on the left, power to the right, supply at the right end (disconnect side).
  const entries = cableEntries(ctx);
  const control = entries.filter((e) => !e.power);
  const power = [...entries.filter((e) => e.tag === 'SUPPLY'), ...entries.filter((e) => e.power && e.tag !== 'SUPPLY')]; // from the right end
  const pitchOf = (e: CableEntry) => (e.gland?.hole ?? e.od + 6) + 22; // gland nut across flats + spanner room (typical)
  const rowPitch = Math.max(...entries.map(pitchOf), 40);
  const fitRows = Math.max(1, Math.floor((D - FRONT_CLEAR - BACK_CLEAR) / rowPitch) + 1);
  const usable = W - 2 * SIDE_CLEAR;
  const place = (e: CableEntry, cx: number, y: number) => faces.bottom.cutouts.push(e.gland
    ? { id: '', tag: e.tag, kind: 'round', x: r1(cx), y: r1(y), w: e.gland.hole, h: e.gland.hole, code: 'H', verified: false }
    : { id: '', tag: e.tag, kind: 'round', x: r1(cx), y: r1(y), w: r1(e.od + 6), h: r1(e.od + 6), code: 'H', verified: false, template: `GLAND FOR Ø${dualDim(e.od)} CABLE` });
  // each row: control cables packed from the left, power cables from the right
  let ci = 0, pi = 0;
  for (let ri = 0; ri < fitRows && (ci < control.length || pi < power.length); ri++) {
    const y = FRONT_CLEAR + ri * rowPitch;
    let l = 0, r = 0;
    for (let more = true; more;) {
      more = false;
      if (ci < control.length && l + r + pitchOf(control[ci]) <= usable) { place(control[ci], SIDE_CLEAR + l + pitchOf(control[ci]) / 2, y); l += pitchOf(control[ci++]); more = true; }
      if (pi < power.length && l + r + pitchOf(power[pi]) <= usable) { place(power[pi], W - SIDE_CLEAR - r - pitchOf(power[pi]) / 2, y); r += pitchOf(power[pi++]); more = true; }
    }
  }
  const left = [...control.slice(ci), ...power.slice(pi)];
  const glandText = (e: CableEntry) => `${e.tag} (${e.to}) ~Ø${dualDim(e.od)} -> ${e.gland ? e.gland.size : 'SIZE PER CABLE OD'}`;
  faces.bottom.specs.H = `${iec ? 'CABLE GLAND' : 'CORD GRIP'} ENTRY HOLES, ONE PER CABLE LEAVING THE CABINET; SIZE FROM THE ESTIMATED CABLE OD (TYPICAL CLAMPING RANGES — CHECK THE ${iec ? 'GLAND' : 'CORD GRIP'} AND CABLE DATASHEETS BEFORE PUNCHING)`;
  faces.bottom.notes.push(
    `CABLE ENTRIES (ESTIMATED OD -> ${iec ? 'GLAND' : 'CORD GRIP'}): ${entries.map(glandText).join('; ')}.`,
    `OD ESTIMATED FROM CORE COUNT AND CONDUCTOR SIZE (CABLE SCHEDULE). ${iec ? 'METRIC GLANDS EN 62444, HOLE = THREAD + 0.5 [0.020].' : 'NPT CORD GRIPS IN STANDARD CONDUIT KNOCKOUTS (1/2" = 0.875 [22.2]).'} USE LOCKNUTS AND SEALING WASHERS TO KEEP THE ENCLOSURE RATING.`,
    'POWER AND CONTROL CABLES ENTER SEPARATELY (CONTROL LEFT, MOTOR CABLES RIGHT, SUPPLY AT THE DISCONNECT SIDE); REARRANGE TO SUIT THE ROUTING. VFD MOTOR CABLES: EMC GLANDS BONDING THE SHIELD 360°.',
    ...(left.length ? [`DOES NOT FIT THE BOTTOM WITH THESE CLEARANCES: ${left.map((e) => e.tag).join(', ')} — USE A GLAND PLATE / MULTI-CABLE ENTRY OR A SIDE WALL.`] : []),
  );

  // 2. Ventilation: filter fan low on the left, outlet filter high on the right (air flows across the cabinet).
  const hmi = ctx.hmiPartNumber ? getHmi(ctx.hmiPartNumber) : undefined;
  const heat = cabinetHeat(ctx.design.components, ctx.getPart, hmi ? { partNumber: hmi.partNumber, sizeIn: hmi.sizeIn } : undefined);
  const fanRc = m.rc.find((c) => c.category === 'fan' && c.part?.ratings.kind === 'filter fan');
  const exRc = m.rc.find((c) => c.category === 'fan' && c.part?.ratings.kind === 'exhaust filter');
  const fanTags = m.rc.filter((c) => c.category === 'fan').map((c) => c.tag);
  const closedLoop = m.rc.filter((c) => ['heat exchanger', 'air conditioner'].includes(String(c.part?.ratings.kind ?? '')));
  // the catalog part's own cutout (fans and exhaust filters publish it); else a typical size for the air flow
  const cutoutOf = (rcx: typeof fanRc) => {
    const w = Number(rcx?.part?.ratings.cutoutWidthMm), h = Number(rcx?.part?.ratings.cutoutHeightMm);
    return w > 0 && h > 0 ? { w, h } : null;
  };
  if ((heat.ventilation && !closedLoop.length) || fanTags.length) {
    const flow = heat.ventilation?.airflowM3h ?? 0;
    const cls = fanClass(flow) ?? { cutout: 292, upTo: 900 };
    const fc = cutoutOf(fanRc), ec = cutoutOf(exRc) ?? fc;
    const s = Math.min(cls.cutout, D - FRONT_CLEAR - BACK_CLEAR);
    const xMid = BACK_CLEAR + (D - FRONT_CLEAR - BACK_CLEAR) / 2;
    const assumed = fc ? `${dualSize(fc.w, fc.h)} CUTOUT OF ${fanRc!.partNumber}${exRc ? ` / ${exRc.partNumber}` : ''} (CATALOG)` : `${dualSize(cls.cutout, cls.cutout)} TYPICAL CUTOUT OF A ${cls.upTo} m³/h FILTER FAN (ASSUMED) — CUT PER THE CHOSEN FAN'S DATASHEET`;
    const fw = fc?.w ?? s, fh = fc?.h ?? s, ew = ec?.w ?? s, eh = ec?.h ?? s;
    faces.left.cutouts.push(fc
      ? { id: '', tag: fanRc!.tag, kind: 'rect', x: r1(xMid), y: r1(80 + fh / 2), w: fw, h: fh, code: 'J', verified: true }
      : { id: '', tag: fanTags[0] ?? 'FAN1', kind: 'rect', x: r1(xMid), y: r1(80 + s / 2), w: s, h: s, code: 'J', verified: false, template: 'FILTER FAN (INLET)' });
    faces.right.cutouts.push(ec
      ? { id: '', tag: exRc?.tag ?? fanTags[1] ?? 'FLT1', kind: 'rect', x: r1(D - xMid), y: r1(H - 80 - eh / 2), w: ew, h: eh, code: 'J', verified: !!cutoutOf(exRc) }
      : { id: '', tag: fanTags[1] ?? 'FLT1', kind: 'rect', x: r1(D - xMid), y: r1(H - 80 - s / 2), w: s, h: s, code: 'J', verified: false, template: 'OUTLET FILTER' });
    const why = heat.ventilation ? `HEAT ${heat.watts.toFixed(0)} W, ${heat.rise!.toFixed(0)} °C RISE WITHOUT FAN (LIMIT 15 °C): FAN ≥ ${Math.ceil(flow)} m³/h (${Math.ceil(flow / 1.699)} CFM)` : `FAN ${fanTags.join(', ')} IN THE DESIGN`;
    faces.left.specs.J = faces.right.specs.J = `FILTER FAN / OUTLET FILTER: ${assumed}`;
    faces.left.notes.push(`VENTILATION: ${why}. FILTER FAN LOW ON THE LEFT, OUTLET FILTER (SAME SIZE CLASS) HIGH ON THE RIGHT.`);
    faces.right.notes.push(`VENTILATION: ${why}. OUTLET FILTER HIGH ON THE RIGHT, FILTER FAN LOW ON THE LEFT.`);
    if ((fc ? fc.w : cls.cutout) > D - FRONT_CLEAR - BACK_CLEAR) faces.left.notes.push(`THE ${fc ? `${fanRc!.partNumber} ${Math.round(fc.w)} mm CUTOUT` : `${cls.cutout} mm FAN CLASS`} IS DEEPER THAN THE WALL ALLOWS: USE A DOOR-MOUNTED FAN OR A DEEPER ENCLOSURE.`);
  }
  // closed-loop cooling (heat exchanger / air conditioner): mounted and cut per the maker's drawing
  for (const c of closedLoop) {
    const w = Number(c.part?.ratings.cutoutWidthMm), h = Number(c.part?.ratings.cutoutHeightMm);
    faces.right.notes.push(`${c.tag} ${c.partNumber} (${String(c.part?.ratings.kind).toUpperCase()}): ${w > 0 && h > 0 ? `CUTOUT ${dualSize(w, h)} PER THE MAKER'S DRAWING` : `CUTOUT${c.part?.ratings.cutoutCount ? 'S' : ''} PER THE MAKER'S DRAWING (${String(c.part?.ratings.cutoutNote ?? 'see datasheet')})`} — SIDE WALL OR DOOR; SEAL PER THE MAKER TO KEEP THE ENCLOSURE RATING.`);
  }

  // 3. Stack light on the top (direct base mount), drilled per the manufacturer's template.
  const stacks = L.unplaced.filter((u) => /stack light/i.test(u.reason));
  stacks.forEach((u, i) => {
    const part = ctx.getPart(u.partNumber);
    const dia = Number(part?.ratings.diameterMm) || 40;
    faces.top.cutouts.push({ id: '', tag: u.tag, kind: 'round', x: r1(W - SIDE_CLEAR - dia - i * (dia + 30)), y: r1(D / 2), w: dia, h: dia, code: 'K', verified: false, template: 'STACK LIGHT BASE' });
  });
  if (stacks.length) {
    faces.top.specs.K = 'STACK LIGHT: CENTRE MARK AND BASE OUTLINE (Ø = BODY DIAMETER FROM THE CATALOG) — DRILL THE MOUNTING AND CABLE HOLES PER THE MANUFACTURER\'S TEMPLATE';
    faces.top.notes.push('TOP: KEEP OTHER PENETRATIONS OFF THE TOP (DRIPPING WATER). SEAL THE STACK LIGHT BASE WITH ITS GASKET.');
  }

  // 4. Air inlet of a pneumatic panel (valves inside the cabinet): bulkhead fitting on the bottom, left end.
  const valves = m.rc.filter((c) => c.category === 'solenoidValve' && c.mount !== 'field');
  if (valves.length) {
    const port = /(\d+\/\d+)\s*(?:in|")\s*NPT/i.exec(valves[0].part?.description ?? '')?.[1];
    faces.bottom.cutouts.push({ id: '', tag: 'AIR IN', kind: 'round', x: r1(SIDE_CLEAR + 15), y: r1(D - BACK_CLEAR - 15), w: 20, h: 20, code: 'L', verified: false, template: `AIR INLET BULKHEAD${port ? ` ${port}" NPT` : ''}` });
    faces.bottom.specs.L = `AIR INLET: BULKHEAD FITTING${port ? ` FOR ${port}" NPT (VALVE PORT ${valves[0].partNumber})` : ''} — HOLE PER THE FITTING DATASHEET (Ø20 [0.787] OUTLINE IS A PLACEHOLDER)`;
    faces.bottom.notes.push(`PNEUMATICS IN THE CABINET (${valves.map((v) => v.tag).join(', ')}): AIR INLET AT THE LEFT END; VALVE EXHAUSTS THROUGH A SILENCER OR PIPED OUT.`);
  }

  const out: DrillingPlan[] = [];
  for (const face of ['bottom', 'top', 'left', 'right'] as EnclosureFace[]) {
    const f = faces[face];
    if (!f.cutouts.length) continue;
    const [w, h] = face === 'bottom' || face === 'top' ? [W, D] : [D, H];
    const ids = numberIds(f.cutouts);
    out.push({
      kind: face, title: `${FACE_TITLE[face]} CUTOUTS`, part: encName, w: r1(w), h: r1(h), holes: [], cutouts: ids, codes: finishCodes([], ids, f.specs),
      notes: [
        `DATUM: LOWER-LEFT CORNER. ${FACE_VIEW[face]} DIMENSIONS IN INCHES [mm]. TOLERANCE ±0.020 [±0.5] UNLESS NOTED.`,
        ...depthNote,
        ...f.notes,
        'DASHED OUTLINES ARE NOT CUT FROM THIS DRAWING: SIZE PER THE PART DATASHEET / TEMPLATE. DEBURR, TOUCH UP PAINT, KEEP THE GASKET LAND CLEAR.',
        MACHINING_SCALE_NOTE,
      ],
    });
  }
  return out;
}
