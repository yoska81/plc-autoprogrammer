/**
 * Plain-English suggestions from the machine layout (pure). Each has a stable id so the user's
 * accept / ignore decision sticks. Nothing here invents a part number: accepted manifolds and
 * remote I/O blocks appear in the BOM as "part to be selected".
 */
import type { Cable, MachineDevice } from '../derive';
import { dist, manhattan, routedLength, withService, type Pt } from './geometry';
import { AIR, CABINET, type LayoutForDesign } from './types';

export type SuggestionKind = 'manifold' | 'jb-move' | 'jb-split' | 'jb-merge' | 'remote-io' | 'tray' | 'cabinet';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  /** Cable saved (m), when it can be estimated. */
  savingM?: number;
  /** Data the UI applies on accept (positions in metres). */
  manifold?: { tag: string; valves: string[]; at: Pt; tubes: { valve: string; lengthM: number }[]; airFrom: string; airM: number };
  jbMove?: { jb: string; to: Pt };
  jbSplit?: { jb: string; newJb: string; devices: string[]; at: Pt };
  jbMerge?: { from: string; into: string };
  remoteIo?: { tag: string; devices: string[]; at: Pt };
  cabinet?: { to: Pt };
  /** Advice only (nothing to apply). */
  info?: boolean;
}

export interface SuggestOptions {
  /** Valves of cylinders closer than this share a manifold (m). */
  manifoldRadiusM: number;
  /** Devices further than this from the cabinet count as remote (m). */
  remoteM?: number;
  /** Minimum devices in a remote cluster for a remote I/O suggestion. */
  remoteMin?: number;
}

const centroid = (ps: Pt[]): Pt => [ps.reduce((a, p) => a + p[0], 0) / ps.length, ps.reduce((a, p) => a + p[1], 0) / ps.length];

/** Single-linkage clusters: items closer than r (m) end up together. */
export function clusters<T>(items: { id: T; p: Pt }[], r: number): { id: T; p: Pt }[][] {
  const groups: { id: T; p: Pt }[][] = [];
  const seen = new Set<number>();
  items.forEach((_, i) => {
    if (seen.has(i)) return;
    const g: { id: T; p: Pt }[] = [];
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      const k = stack.pop()!;
      g.push(items[k]);
      items.forEach((o, j) => { if (!seen.has(j) && dist(items[k].p, o.p) <= r) { seen.add(j); stack.push(j); } });
    }
    groups.push(g);
  });
  return groups;
}

/** Rough outside diameter (mm) of a field cable from its description, for tray / conduit fill. */
export function cableOdMm(c: Cable): number {
  const t = c.type.toLowerCase();
  const n = Number(/(\d+)-core/.exec(t)?.[1] ?? c.cores.length) || 3;
  if (/m12/.test(t)) return 5;
  if (/pigtail/.test(t)) return 4.5;
  if (c.kind === 'motor') return /vfd|shield/.test(t) ? 13 : /14 awg/.test(t) ? 11 : 14;
  return n <= 4 ? 6.5 : n <= 8 ? 8.5 : n <= 12 ? 10.5 : n <= 19 ? 12.5 : 15;
}

const TRAY_IN = [2, 4, 6, 8, 12, 16, 18, 24];
const CONDUIT = [{ size: '1/2"', mm2: 78 }, { size: '3/4"', mm2: 137 }, { size: '1"', mm2: 222 }, { size: '1-1/4"', mm2: 387 }, { size: '1-1/2"', mm2: 526 }, { size: '2"', mm2: 866 }, { size: '2-1/2"', mm2: 1236 }, { size: '3"', mm2: 1910 }];

export function suggest(ml: LayoutForDesign, devices: MachineDevice[], cables: Cable[], o: SuggestOptions): Suggestion[] {
  const out: Suggestion[] = [];
  const P = (tag: string): Pt | null => { const p = ml.pos[tag]; return p ? [p.x, p.y] : null; };
  const cab = P(CABINET);
  const r = o.manifoldRadiusM;
  const fmt = (m: number) => `${m.toFixed(1)} m`;
  const onManifold = new Set(ml.manifolds.flatMap((m) => m.valves));

  // --- valve manifolds: solenoid valves of cylinders that are close together
  const valves = devices.filter((d) => d.deviceType === 'solenoid' && !onManifold.has(d.tag)).map((d) => ({ id: d.tag, p: P(d.tag) })).filter((v): v is { id: string; p: Pt } => !!v.p);
  let mvN = ml.manifolds.length;
  for (const g of clusters(valves, r)) {
    if (g.length < 2) continue;
    const at = centroid(g.map((x) => x.p));
    const tag = `MV${++mvN}`;
    const ids = g.map((x) => x.id).sort();
    // 5/2 valves: two tubes (A, B) per cylinder, routed with 20 % slack
    const tubes = g.map((x) => ({ valve: x.id, lengthM: Math.ceil(manhattan(at, x.p) * 1.2 * 10) / 10 }));
    const air = P(AIR) ?? cab;
    const airM = air ? Math.ceil(manhattan(air, at) * 1.2 * 10) / 10 : 0;
    const cablesNow = cables.filter((c) => ids.includes(c.to));
    out.push({
      id: `manifold:${ids.join('+')}`, kind: 'manifold',
      title: `Put the valves of ${ids.join(', ')} on one manifold`,
      detail: `${g.length} cylinders are within ${r} m of each other. A ${g.length}-station valve manifold at their centre shortens the air tubing and needs one cable instead of ${cablesNow.length || g.length}. Tubing to each cylinder (A and B ports, +20 %): ${tubes.map((t) => `${t.valve} 2 × ${fmt(t.lengthM)}`).join(', ')}. Air supply from ${P(AIR) ? 'the air supply point' : 'the cabinet side'}: ${fmt(airM)}.`,
      manifold: { tag, valves: ids, at, tubes, airFrom: P(AIR) ? AIR : CABINET, airM },
    });
  }

  // --- junction boxes
  const jbTags = [...new Set(devices.map((d) => d.jb).filter((j): j is string => !!j))];
  const jbDevs = new Map(jbTags.map((j) => [j, devices.filter((d) => d.jb === j).map((d) => ({ id: d.tag, p: P(d.tag) })).filter((x): x is { id: string; p: Pt } => !!x.p)]));
  for (const [jb, ds] of jbDevs) {
    if (!ds.length) continue;
    const c = centroid(ds.map((d) => d.p));
    const cur = P(jb);
    const sum = (at: Pt) => ds.reduce((a, d) => a + manhattan(at, d.p), 0) + (cab ? manhattan(at, cab) : 0);
    if (!cur || dist(cur, c) > 1.5) {
      const saving = cur ? sum(cur) - sum(c) : undefined;
      if (!cur || (saving ?? 0) > 1) out.push({ id: `jb-move:${jb}`, kind: 'jb-move', title: cur ? `Move ${jb} to the centre of its devices` : `Place ${jb} at the centre of its devices`,
        detail: `${jb} serves ${ds.map((d) => d.id).join(', ')}.${saving !== undefined ? ` Moving it saves about ${fmt(saving)} of device cable.` : ' It is not placed on the layout yet.'}`, savingM: saving, jbMove: { jb, to: c } });
    }
    if (ds.length >= 4) {
      // two groups far apart: split into two boxes
      const far = ds.reduce((a, d) => (dist(d.p, c) > dist(a.p, c) ? d : a), ds[0]);
      const near = ds.filter((d) => dist(d.p, far.p) <= 2 * r);
      const rest = ds.filter((d) => !near.includes(d));
      if (rest.length && near.length >= 2 && dist(centroid(near.map((d) => d.p)), centroid(rest.map((d) => d.p))) > 4 * r) {
        const newJb = `JB${jbTags.length + 1}`;
        out.push({ id: `jb-split:${jb}:${near.map((d) => d.id).sort().join('+')}`, kind: 'jb-split', title: `Split ${jb}: a second box for ${near.map((d) => d.id).join(', ')}`,
          detail: `${near.length} of the devices on ${jb} are more than ${fmt(4 * r)} away from the others. A second junction box ${newJb} near them shortens the device cables; it adds one trunk cable from the cabinet.`,
          jbSplit: { jb, newJb, devices: near.map((d) => d.id), at: centroid(near.map((d) => d.p)) } });
      }
    }
  }
  for (let i = 0; i < jbTags.length; i++) for (let j = i + 1; j < jbTags.length; j++) {
    const a = jbDevs.get(jbTags[i]) ?? [], b = jbDevs.get(jbTags[j]) ?? [];
    if (!a.length || !b.length) continue;
    if (dist(centroid(a.map((d) => d.p)), centroid(b.map((d) => d.p))) <= 2 * r && a.length + b.length <= 16) {
      const [small, big] = a.length <= b.length ? [jbTags[i], jbTags[j]] : [jbTags[j], jbTags[i]];
      out.push({ id: `jb-merge:${small}:${big}`, kind: 'jb-merge', title: `Merge ${small} into ${big}`,
        detail: `The devices of ${small} and ${big} are within ${fmt(2 * r)} of each other; one box (${a.length + b.length} devices) saves a box and a trunk cable.`, jbMerge: { from: small, into: big } });
    }
  }

  // --- remote I/O / IO-Link block for many devices far from the cabinet
  if (cab) {
    const remoteM = o.remoteM ?? 15, min = o.remoteMin ?? 6;
    const far = devices.filter((d) => d.kind === 'io').map((d) => ({ id: d.tag, p: P(d.tag) })).filter((x): x is { id: string; p: Pt } => !!x.p && manhattan(x.p, cab) > remoteM);
    let n = ml.remoteIo.length;
    for (const g of clusters(far, 5)) {
      if (g.length < min) continue;
      const ids = g.map((x) => x.id).sort();
      if (ml.remoteIo.some((x) => x.devices.join() === ids.join())) continue;
      out.push({ id: `remote-io:${ids.join('+')}`, kind: 'remote-io', title: `Remote I/O block near ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '…' : ''}`,
        detail: `${g.length} devices are more than ${remoteM} m from the cabinet. A remote I/O or IO-Link block near them replaces ${g.length} long cables (or a big trunk) with one network + power cable. The PLC program addresses would change — ask your controls engineer.`,
        remoteIo: { tag: `RIO${++n}`, devices: ids, at: centroid(g.map((x) => x.p)) } });
    }
  }

  // --- tray / conduit fill per route (estimate)
  const use = new Map<number, Cable[]>();
  const end = (c: Cable): [Pt | null, Pt | null] => [c.kind === 'device' && ml.pos[c.from] ? P(c.from) : cab, P(c.to)];
  for (const c of cables) {
    const [a, b] = end(c);
    if (!a || !b) continue;
    for (const ri of routedLength(a, b, ml.routes).routes) use.set(ri, [...(use.get(ri) ?? []), c]);
  }
  for (const [ri, cs] of use) {
    const route = ml.routes[ri];
    const area = cs.reduce((a, c) => a + Math.PI * (cableOdMm(c) / 2) ** 2, 0);
    let advice: string;
    if (route.kind === 'conduit') {
      const fit = CONDUIT.find((x) => x.mm2 * 0.4 >= area); // 40 % fill (NEC Chapter 9 Table 1, verify)
      advice = fit ? `conduit trade size ${fit.size} or larger (40 % fill)` : 'more than one conduit, or a tray';
    } else {
      const widthMm = area / (50 * 0.4); // 2 in deep tray at 40 % fill (estimate)
      const w = TRAY_IN.find((x) => x * 25.4 >= widthMm) ?? 24;
      advice = route.kind === 'chain' ? `a drag chain with at least ${Math.ceil(area / 0.4)} mm² inside (cables must be rated for continuous flexing)` : `a ${w} in wide cable tray (2 in deep, 40 % fill)`;
    }
    out.push({ id: `tray:${ri}:${cs.length}`, kind: 'tray', info: true, title: `Route ${ri + 1} (${route.kind}): ${cs.length} cables`,
      detail: `Cables ${cs.map((c) => c.tag).join(', ')} use this route (about ${Math.round(area)} mm² of cable). Use ${advice}. Estimate from typical cable diameters — check the actual cables.` });
  }

  // --- cabinet location: shortest total cable (cabinet-side cable ends)
  if (cab) {
    const ends = cables.filter((c) => !(c.kind === 'device' && ml.pos[c.from])).map((c) => P(c.to)).filter((p): p is Pt => !!p);
    if (ends.length >= 3) {
      const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
      const total = (at: Pt) => ends.reduce((a, p) => a + withService(manhattan(at, p), ml.service), 0);
      // The median is often a device's own spot: keep the cabinet at least 1 m from every other item,
      // taking the cheapest free point on a 0.5 m grid around it.
      const others = Object.entries(ml.pos).filter(([t]) => t !== CABINET).map(([, q]) => [q.x, q.y] as Pt);
      const free = (at: Pt) => others.every((q) => Math.hypot(at[0] - q[0], at[1] - q[1]) >= 1);
      const m0: Pt = [med(ends.map((p) => p[0])), med(ends.map((p) => p[1]))];
      let best: Pt = m0;
      if (!free(m0)) {
        const cands: Pt[] = [];
        for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) cands.push([m0[0] + dx * 0.5, m0[1] + dy * 0.5]);
        best = cands.filter(free).sort((a, b) => total(a) - total(b))[0] ?? cab;
      }
      const now = total(cab), then = total(best);
      if (now - then > Math.max(5, now * 0.15)) out.push({ id: `cabinet:${Math.round(best[0])}:${Math.round(best[1])}`, kind: 'cabinet', title: 'A different cabinet location would save cable',
        detail: `Placing the cabinet near the middle of the devices it feeds would cut the field cable from about ${fmt(now)} to ${fmt(then)} (straight-line estimate). Keep it where operators and maintenance can reach it and away from wash-down / heat.`, savingM: now - then, cabinet: { to: best } });
    }
  }
  return out;
}

/** Cable totals per cable type (m, with service allowance) for purchasing. */
export function cableTotals(cables: Cable[]): { type: string; partNumber?: string; count: number; lengthM: number; unknown: number }[] {
  const by = new Map<string, { type: string; partNumber?: string; count: number; lengthM: number; unknown: number }>();
  for (const c of cables) {
    const k = c.partNumber ?? c.type;
    const cur = by.get(k) ?? { type: c.type, partNumber: c.partNumber, count: 0, lengthM: 0, unknown: 0 };
    cur.count += 1;
    const m = /([\d.]+)\s*m\b/.exec(c.length);
    if (m) cur.lengthM += parseFloat(m[1]); else cur.unknown += 1;
    by.set(k, cur);
  }
  return [...by.values()].map((x) => ({ ...x, lengthM: Math.round(x.lengthM * 10) / 10 }));
}
