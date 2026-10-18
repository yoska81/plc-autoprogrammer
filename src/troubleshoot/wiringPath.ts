/**
 * Wiring path engine for guided fault finding. From any PLC point (input or output, discrete or analog) it
 * walks the electrical design: PLC terminal → terminal strip terminals → series contacts → junction box →
 * field device, then the device's supply back to its source (power supply, safety relay output, breaker,
 * fuse, main disconnect) and its return (0 V / neutral). Every hop says where it is (drawing number and
 * line), the wire number arriving there, and what a meter should read there.
 *
 * Wire numbers are potentials: every conductor with the same number is the same net. The path is found
 * on those nets, so it works for any design whose wire list follows that rule, imported drawings too
 * (pass their wire list as `wires`).
 */
import { buildModel, junctionBoxPlans, type DrawingContext, type ElectricalModel, type IoPoint, type ResolvedComponent, type WireRecord } from '../electrical/derive';
import { planDrawings, type DrawingPlan } from '../electrical/drawings/plan';
import { SUPPLY_INFO } from '../standards/regions';

/** One reading the technician can take at a hop. */
export interface Measure {
  /** The two points of the meter leads, as printed on the panel ("TB2-1", "TB1 0V", "PS1 +V"). */
  between: [string, string];
  kind: 'VDC' | 'VAC' | 'mA' | 'mV' | 'continuity';
  /** The normal reading in plain words: "24 VDC", "about 0 V", "4–20 mA". */
  expect: string;
  /** When the reading applies ("when the sensor sees a part", "with the output ON"); empty = always (power on). */
  when: string;
  /** The reading in the other state, when it changes with the point ("0 V when the sensor is clear"). */
  otherwise?: string;
}

export type HopKind = 'plc' | 'terminal' | 'contact' | 'cable' | 'junction-box' | 'device' | 'source' | 'protection' | 'disconnect' | 'supply';

/** One place along the path. */
export interface PathHop {
  kind: HopKind;
  /** Device or strip tag ("TB2", "PE1", "CB2", "PLC", "W002"). */
  tag: string;
  /** Terminal / pin / core at this hop ("1", "BK", "X004", "+V", "core 3"). */
  terminal?: string;
  /** Wire number arriving at this hop. */
  wire?: string;
  /** What to look for, in plain words: "Terminal strip TB2, terminal 1". */
  label: string;
  /** Drawing number and line (e.g. { sheet: "CNV-E-07", line: "7.03" }) or null when not drawn. */
  where: { sheet: string; line?: string } | null;
  /** In the cabinet, on the door or out at the machine. */
  location: 'cabinet' | 'door' | 'field';
  measure?: Measure;
  note?: string;
  /** The PLC module's common (or output supply) and its strip terminal: shared by every point of the group. */
  common?: boolean;
}

export interface WiringPath {
  address: string;
  description: string;
  type: 'input' | 'output';
  analog: boolean;
  /** Field device tag at the end of the signal path ("PE1"), "" when not known. */
  device: string;
  /** PLC terminal → field device. */
  signal: PathHop[];
  /** Field device / load → its supply source → protection → main disconnect. */
  supply: PathHop[];
  /** Return conductor (0 V / neutral) back to its source. */
  ret: PathHop[];
  /** Reference point for voltage readings ("TB1 0V"). */
  reference: string;
  /** One-line summary for the step list. */
  summary: string;
  /** Other devices on the same signal wire (parallel contacts / sensors), each a device hop. */
  parallel: PathHop[];
  /** True when the PLC terminal has no wire in the design (only the PLC hop is given). */
  noWire?: boolean;
}

/** A design prepared once for many path lookups (live UI, why-stuck analysis). */
export interface WiringContext { readonly prepared: true }

export interface WiringPathOptions {
  /** Wire list to use instead of the derived one (imported drawings keep their own wire numbers). */
  wires?: WireRecord[];
}

// ---------------------------------------------------------------------------

interface End { raw: string; tag: string; pin: string; strip?: string; jbDevice?: string }
interface Edge { wire: string; a: End; b: End; color: string; size: string; fn: string }

const DC_SUPPLY = /^(24\+|24V|\+24|L\+|24\+S|24\+\w+)$/i;
const DC_ZERO = /^(0V|0 V|M|L-|0VDC|COM)$/i;
const isPe = (w: string) => /^PE$|^GND$|SH$/i.test(w);

/** The pin a contact / pole / coil terminal pairs with inside the device. */
export function partnerPins(pin: string): string[] {
  const p = pin.trim().toUpperCase();
  let m = /^(\d)(\d)$/.exec(p);
  if (m) {
    const d = Number(m[2]);
    const other = d % 2 ? d + 1 : d - 1;
    return [`${m[1]}${other}`];
  }
  m = /^([ABX])([12])$/.exec(p);
  if (m) return [`${m[1]}${m[2] === '1' ? '2' : '1'}`];
  m = /^([LT])(\d)$/.exec(p);
  if (m) return [`${m[1] === 'L' ? 'T' : 'L'}${m[2]}`];
  m = /^([LT])$/.exec(p);
  if (m) return [m[1] === 'L' ? 'T' : 'L'];
  if (p === '1' || p === '2') return [p === '1' ? '2' : '1'];
  if (p === 'NO' || p === 'NC') return ['C'];
  if (p === 'C') return ['NO', 'NC'];
  if (/^(\+V|V\+|\+|-V|V-|DC\+|DC-)$/.test(p)) return ['L1', 'L', 'L2', 'L3', 'N', 'AC(L)', 'AC(N)'];
  if (p === 'BK' || p === 'WH') return ['BN'];
  // Drive relays: R1O / R1C share the common R1 (GS drives); RA → RC, MO1 → MC1-style commons.
  if (/^R\d[OC]$/.test(p)) return [p.slice(0, 2), `${p.slice(0, 2)}C`].filter((x) => x !== p);
  if (/^(R\dA|MO\d)$/.test(p)) return [p.replace(/O$|A$/, 'C')];
  if (/^CH\d\+$/.test(p)) return [p.replace('+', '-')];
  return [];
}

function parseEnd(raw: string, strips: string[], plcTags: Set<string>): End {
  const s = raw.trim();
  const jb = /^(\S+)\s+\((.+)\)$/.exec(s);
  if (jb) return { raw: s, tag: jb[1], pin: '', jbDevice: jb[2] };
  for (const st of strips) {
    if (s === st) return { raw: s, tag: st, pin: '', strip: st };
    if (s.startsWith(`${st}-`) && /^\d+$/.test(s.slice(st.length + 1))) return { raw: s, tag: st, pin: s.slice(st.length + 1), strip: st };
    if (s.startsWith(`${st} `)) return { raw: s, tag: st, pin: s.slice(st.length + 1), strip: st };
  }
  const c = s.indexOf(':');
  if (c > 0) return { raw: s, tag: s.slice(0, c), pin: s.slice(c + 1) };
  const sp = /^(\S+)\s+(.+)$/.exec(s);
  if (sp && !/\(/.test(s) && !plcTags.has(sp[1])) return { raw: s, tag: sp[1], pin: sp[2] };
  return { raw: s, tag: s, pin: '' };
}

const key = (e: End) => e.raw;

interface Ctx {
  m: ElectricalModel;
  plan: DrawingPlan | null;
  edges: Edge[];
  byNet: Map<string, Edge[]>;
  netsOf: Map<string, Set<string>>; // device tag → nets touching it
  pinsOf: Map<string, Map<string, string>>; // device tag → pin → net
  rc: Map<string, ResolvedComponent>;
  plcTags: Set<string>;
  zero: string;
  zeroRef: string;
  /** The 24 V bus terminal ("TB1 24+"): the reference for checking a 0 V return. */
  plusRef: string;
  acVolts: number;
  sheetOf: (n: number) => string;
  jbs: ReturnType<typeof junctionBoxPlans>;
  /** Nets on a power supply's + output (24 V) — found from the supply, so imported wire numbers work too. */
  dcNets: Set<string>;
}

function build(ctx: DrawingContext, opts: WiringPathOptions): Ctx {
  const m = buildModel(ctx);
  let plan: DrawingPlan | null;
  try { plan = planDrawings(ctx); } catch { plan = null; }
  const strips = [...new Set([...m.strips.map((s) => s.tag), ...(m.analog.strip ? [m.analog.strip.tag] : [])])].sort((a, b) => b.length - a.length);
  const plcTags = new Set([m.plcTag, ...m.rc.filter((c) => c.category === 'plc' || c.category === 'plcModule').map((c) => c.tag)]);
  const edges: Edge[] = (opts.wires ?? m.wires).map((w) => ({ wire: w.wire, a: parseEnd(w.from, strips, plcTags), b: parseEnd(w.to, strips, plcTags), color: w.color, size: w.size, fn: w.function }));
  const byNet = new Map<string, Edge[]>();
  const netsOf = new Map<string, Set<string>>();
  const pinsOf = new Map<string, Map<string, string>>();
  for (const e of edges) {
    (byNet.get(e.wire) ?? byNet.set(e.wire, []).get(e.wire)!).push(e);
    for (const end of [e.a, e.b]) {
      (netsOf.get(end.tag) ?? netsOf.set(end.tag, new Set()).get(end.tag)!).add(e.wire);
      if (end.pin) (pinsOf.get(end.tag) ?? pinsOf.set(end.tag, new Map()).get(end.tag)!).set(end.pin.toUpperCase(), e.wire);
    }
  }
  // 0 V and 24 V nets: from the power supplies' output pins first, then by name.
  const psTags = m.rc.filter((x) => x.category === 'powerSupply').map((x) => x.tag);
  const psPin = (re: RegExp) => psTags.flatMap((t) => [...(pinsOf.get(t) ?? new Map<string, string>()).entries()].filter(([pp]) => re.test(pp)).map(([, n]) => n));
  const dcNets = new Set([...psPin(/^(\+V|V\+|DC\+|\+)$/), ...[...byNet.keys()].filter((w) => DC_SUPPLY.test(w) || /^24\+/.test(w))]);
  const zero = psPin(/^(-V|V-|DC-|-)$/)[0] ?? [...byNet.keys()].find((w) => DC_ZERO.test(w)) ?? '0V';
  // The 0 V bus terminal of the first strip that carries it ("TB1 0V").
  const zeroEnd = (byNet.get(zero) ?? []).flatMap((e) => [e.a, e.b]).find((x) => x.strip && !/^\d+$/.test(x.pin));
  const plus = psPin(/^(\+V|V\+|DC\+|\+)$/)[0] ?? [...byNet.keys()].find((w) => /^24\+$/.test(w)) ?? '24+';
  const plusEnd = (byNet.get(plus) ?? []).flatMap((e) => [e.a, e.b]).find((x) => x.strip && !/^\d+$/.test(x.pin));
  const sheetNo = new Map((plan?.sheets ?? []).map((s) => [s.n, s.drawingNo]));
  return {
    m, plan, edges, byNet, netsOf, pinsOf, rc: new Map(m.rc.map((c) => [c.tag, c])), plcTags, zero,
    zeroRef: zeroEnd?.raw ?? `${strips[strips.length - 1] ?? 'TB1'} ${zero}`,
    plusRef: plusEnd?.raw ?? `${strips[strips.length - 1] ?? 'TB1'} 24+`,
    acVolts: SUPPLY_INFO[m.supply]?.volts ?? 480,
    sheetOf: (n) => sheetNo.get(n) ?? `sheet ${n}`,
    jbs: (() => { try { return junctionBoxPlans(ctx); } catch { return []; } })(),
    dcNets,
  };
}

/** Drawing reference for a tag, preferring the sheet kinds that show it best, with the line when known. */
function whereOf(c: Ctx, tag: string, xrefKey?: string, prefer: string[] = []): PathHop['where'] {
  const plan = c.plan;
  if (!plan) return null;
  const line = xrefKey ? plan.xref.get(xrefKey) : undefined;
  if (line && /^\d+\.\d+$/.test(line)) return { sheet: c.sheetOf(Number(line.split('.')[0])), line };
  const sheets = plan.where.get(tag) ?? [];
  if (!sheets.length) return null;
  const kindOf = (n: number) => plan.sheets.find((s) => s.n === n)?.spec.kind ?? '';
  const pick = prefer.map((k) => sheets.find((n) => kindOf(n) === k)).find((n) => n !== undefined) ?? sheets[0];
  return { sheet: c.sheetOf(pick) };
}

function locationOf(c: Ctx, tag: string, p?: IoPoint): PathHop['location'] {
  const rc = c.rc.get(tag);
  if (rc?.mount === 'door') return 'door';
  if (rc?.mount === 'field') return 'field';
  if (p && p.deviceTag === tag) return p.location === 'internal' ? 'cabinet' : p.location;
  if (c.m.machine.cables.some((x) => x.to === tag) || c.m.motors.some((x) => x.motor.tag === tag)) return 'field';
  return 'cabinet';
}

const describe = (c: Ctx, tag: string) => {
  const rc = c.rc.get(tag);
  return rc ? (rc.comp.function || rc.part?.description || rc.partNumber) : '';
};

function endLabel(c: Ctx, e: End): string {
  if (e.jbDevice) return `Junction box ${e.tag}, terminals for ${e.jbDevice}`;
  if (e.strip) return /^\d+$/.test(e.pin) ? `Terminal strip ${e.strip}, terminal ${e.pin}` : `Terminal strip ${e.strip}, ${e.pin} terminals`;
  if (c.plcTags.has(e.tag)) return `${e.tag === c.m.plcTag ? 'PLC' : `PLC module ${e.tag}`} terminal ${e.pin}`;
  const d = describe(c, e.tag);
  return `${e.tag}${d ? ` (${d})` : ''}${e.pin ? `, terminal ${e.pin}` : ''}`;
}

const ACTIVE: Record<string, [string, string]> = {
  'pushbutton-no': ['while the button is pressed', 'when it is released'],
  'pushbutton-nc': ['with the button released', 'while it is pressed'],
  'estop-contact': ['with the E-stop pulled out (released)', 'when it is pressed in'],
  selector: ['with the selector in the ON position', 'in the OFF position'],
  'sensor-pnp': ['when the sensor detects (its LED on)', 'when it does not'],
  'sensor-npn': ['when the sensor detects (its LED on)', 'when it does not'],
  'limit-switch': ['when the switch is actuated', 'when it is not'],
  'pressure-switch': ['when the pressure is above the setting', 'below it'],
  'safety-relay-output': ['when the safety circuit is OK (relay outputs ON)', 'after an E-stop or open guard'],
};

/** What the signal wire reads against 0 V for this point. */
function signalMeasure(c: Ctx, p: IoPoint, at: string, wire: string): Measure {
  const ref = c.zeroRef;
  if (p.type === 'input') {
    // A group with its common on +24 V (NPN sensors in it) switches 0 V: every device in it, dry contacts
    // too, reads about 0 V when ON and 24 V when OFF.
    const npn = p.deviceType === 'sensor-npn' || c.m.groups.find((g) => g.key === p.group)?.commonTo === '24+';
    const [on, off] = ACTIVE[p.deviceType] ?? ['when the device is ON', 'when it is OFF'];
    return { between: [at, ref], kind: 'VDC', expect: npn ? 'about 0 V' : '24 VDC', when: on, otherwise: `${npn ? '24 VDC' : 'about 0 V'} ${off}` };
  }
  const sink = p.coilChain?.sink || c.m.groups.find((g) => g.key === p.group)?.outputStyle === 'sinking';
  const name = wire === p.address ? `output ${p.address}` : `output ${p.address} (through the contacts before it)`;
  return sink
    ? { between: [at, ref], kind: 'VDC', expect: 'about 0 V', when: `with ${name} ON (its LED lit)`, otherwise: '24 VDC with the output OFF' }
    : { between: [at, ref], kind: 'VDC', expect: '24 VDC', when: `with ${name} ON (its LED lit)`, otherwise: 'about 0 V with the output OFF' };
}

function netMeasure(c: Ctx, wire: string, at: string, color: string): Measure | undefined {
  if (isPe(wire)) return { between: [at, 'PE bar'], kind: 'continuity', expect: 'continuity (under 1 Ω) to the PE bar', when: 'with the power OFF and locked out' };
  if (wire === c.zero) return { between: [at, 'PE bar'], kind: 'VDC', expect: 'about 0 V (0 V is bonded to PE at the power supply)', when: '' };
  if (c.dcNets.has(wire) || DC_SUPPLY.test(wire) || /^24\+/.test(wire)) {
    const safe = /S$/i.test(wire);
    return { between: [at, c.zeroRef], kind: 'VDC', expect: '24 VDC', when: safe ? 'when the safety circuit is OK (24+S is switched by the safety relay)' : '', ...(safe ? { otherwise: 'about 0 V after an E-stop or open guard' } : {}) };
  }
  if (/^X1$|^X2$|^N$/.test(wire)) return { between: [at, wire === 'X1' ? 'X2' : 'PE bar'], kind: 'VAC', expect: wire === 'X1' ? '120 VAC' : 'about 0 V', when: '' };
  if (/BK|BLACK/i.test(color) && /L\d|T\d|^L$|-L\d|-T\d|C\d$/.test(wire)) {
    const v = c.acVolts;
    return { between: [at, 'another phase'], kind: 'VAC', expect: c.m.phases === 3 ? `${v} VAC phase to phase` : `${v} VAC to neutral`, when: 'with the main disconnect ON (DANGER: live mains — qualified person, rated meter, PPE)' };
  }
  return undefined;
}

function hopOf(c: Ctx, e: End, wire: string, p?: IoPoint, color = ''): PathHop {
  const kind: HopKind = e.jbDevice ? 'junction-box'
    : e.strip ? 'terminal'
    : c.plcTags.has(e.tag) ? 'plc'
    : e.tag === 'SUPPLY' ? 'supply'
    : c.rc.get(e.tag)?.category === 'disconnect' ? 'disconnect'
    : ['breaker', 'fuse', 'motorProtector'].includes(c.rc.get(e.tag)?.category ?? '') ? 'protection'
    : c.rc.get(e.tag)?.category === 'powerSupply' ? 'source'
    : 'device';
  const prefer = kind === 'terminal' ? ['io', 'terminals', 'analog'] : kind === 'plc' ? ['io'] : ['io', 'control', 'power', 'motors', 'analog', 'drive', 'machine'];
  const xrefKey = kind === 'plc' && p ? `io:${p.address}` : kind === 'source' ? `ps:${e.tag}` : undefined;
  const tagForWhere = e.jbDevice ? e.jbDevice : e.tag;
  const hop: PathHop = {
    kind, tag: e.tag, ...(e.pin ? { terminal: e.pin } : {}), wire, label: kind === 'supply' ? 'Incoming supply (feeder from the site)' : endLabel(c, e),
    where: whereOf(c, tagForWhere, xrefKey, prefer), location: e.jbDevice ? 'field' : kind === 'terminal' || kind === 'plc' ? 'cabinet' : locationOf(c, e.tag, p),
  };
  const meas = netMeasure(c, wire, e.raw, color);
  if (meas) hop.measure = meas;
  return hop;
}

/** The ends of one net in order, walking from `start` along its wires. */
function walkNet(c: Ctx, wire: string, start: string): { end: End; color: string }[] {
  const es = c.byNet.get(wire) ?? [];
  const out: { end: End; color: string }[] = [];
  const seen = new Set<string>([start]);
  let frontier = [start];
  while (frontier.length) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const e of es) {
        for (const [x, y] of [[e.a, e.b], [e.b, e.a]] as const) {
          if (key(x) !== f || seen.has(key(y))) continue;
          seen.add(key(y));
          out.push({ end: y, color: e.color });
          next.push(key(y));
        }
      }
    }
    frontier = next;
  }
  return out;
}

/** Cable cores carrying this wire into the field, in order from the cabinet. */
function cableHops(c: Ctx, wire: string, device: string): PathHop[] {
  const hops: PathHop[] = [];
  const cables = c.m.machine.cables.filter((x) => x.cores.some((k) => k.wire === wire));
  const jbs = c.jbs;
  // Trunk first (cabinet → JB), then the device cable.
  cables.sort((a, b) => Number(a.kind !== 'trunk') - Number(b.kind !== 'trunk'));
  for (const cab of cables) {
    if (cab.kind !== 'trunk' && device && cab.to !== device) continue;
    const core = cab.cores.find((k) => k.wire === wire)!;
    hops.push({
      kind: 'cable', tag: cab.tag, terminal: `core ${core.core}`, wire, label: `Cable ${cab.tag} (${cab.from} → ${cab.to}), core ${core.core}${core.color ? ` (${core.color})` : ''}`,
      where: whereOf(c, cab.to, undefined, ['cables', 'machine', 'jb']), location: 'field',
    });
    if (cab.kind === 'trunk') {
      const jb = jbs.find((j) => j.tag === cab.to);
      const t = jb?.terminals.find((x) => x.wire === wire && (!device || x.device === device || !x.device));
      if (jb && t) hops.push({ kind: 'junction-box', tag: jb.tag, terminal: String(t.number), wire, label: `Junction box ${jb.tag}, terminal ${t.number}`, where: whereOf(c, jb.tag, `jb:${jb.tag}`, ['jb']), location: 'field' });
    }
  }
  return hops;
}

/** Pins of a device on other nets, the partner pins first. */
function otherPins(c: Ctx, tag: string, pin: string, strict = false): { pin: string; net: string }[] {
  const pins = c.pinsOf.get(tag);
  if (!pins) return [];
  const partners = partnerPins(pin);
  const here = pins.get(pin.toUpperCase());
  const all = [...pins.entries()].filter(([pp, net]) => pp !== pin.toUpperCase() && net !== here && !isPe(net));
  const pref = all.filter(([pp]) => partners.includes(pp));
  return (pref.length || strict ? pref : all).map(([pp, net]) => ({ pin: pp, net }));
}

const SOURCE_CATS = new Set(['powerSupply', 'safetyRelay', 'breaker', 'fuse', 'disconnect', 'motorProtector', 'relay', 'contactor', 'overload', 'other']);

/** From a supply net, walk back to where it comes from, up to the incoming supply. */
function supplyChain(c: Ctx, net: string, p: IoPoint | undefined, seen: Set<string>, depth = 0): PathHop[] {
  if (depth > 10 || seen.has(net) || isPe(net)) return [];
  seen.add(net);
  const ends = (c.byNet.get(net) ?? []).flatMap((e) => [{ end: e.a, color: e.color }, { end: e.b, color: e.color }]);
  if (ends.some((x) => x.end.tag === 'SUPPLY')) {
    const s = ends.find((x) => x.end.tag === 'SUPPLY')!;
    return [{ ...hopOf(c, s.end, net, p, s.color), label: `Incoming supply ${net} (feeder from the site)`, location: 'cabinet' }];
  }
  // The source on this net: a power supply output, a relay / breaker / fuse load side…
  const cand = ends.filter((x) => !x.end.strip && !x.end.jbDevice && x.end.pin && c.rc.has(x.end.tag) && SOURCE_CATS.has(c.rc.get(x.end.tag)!.category) && !c.plcTags.has(x.end.tag));
  const rank = (x: typeof cand[number]) => {
    const cat = c.rc.get(x.end.tag)!.category;
    const pin = x.end.pin.toUpperCase();
    if (cat === 'powerSupply' && /\+V|V\+|-V|V-/.test(pin)) return 0;
    if (/^T\d?$|^\d[2468]$|^96$|^14$|^24$/.test(pin)) return 1; // load side of a pole / NO contact output
    return 5;
  };
  cand.sort((a, b) => rank(a) - rank(b));
  const src = cand[0];
  if (!src) {
    // A terminal that joins two wire numbers (fused terminal: 24+ in, 24+H out): go through it.
    for (const x of ends) {
      if (!x.end.strip || !/^\d+$/.test(x.end.pin)) continue;
      const other = c.edges.find((e) => e.wire !== net && !seen.has(e.wire) && (e.a.raw === x.end.raw || e.b.raw === x.end.raw));
      if (!other) continue;
      const t = c.m.strips.flatMap((st) => st.terminals).find((tt) => tt.label === x.end.raw);
      const hop = hopOf(c, x.end, net, p, x.color);
      if (t?.fuse) { hop.kind = 'protection'; hop.label = `Fused terminal ${x.end.raw} (${t.fuse} fuse)`; hop.note = `The fuse in ${x.end.raw} feeds wire ${net}: a blown fuse (its LED lit) leaves ${net} dead while ${other.wire} is live.`; }
      return [hop, ...supplyChain(c, other.wire, p, seen, depth + 1)];
    }
    return [];
  }
  const hop = hopOf(c, src.end, net, p, src.color);
  const cat = c.rc.get(src.end.tag)!.category;
  if (cat === 'powerSupply') {
    const pos = [...(c.pinsOf.get(src.end.tag) ?? new Map()).entries()].find(([pp]) => /\+V|V\+/.test(pp));
    const neg = [...(c.pinsOf.get(src.end.tag) ?? new Map()).entries()].find(([pp]) => /-V|V-/.test(pp));
    hop.measure = { between: [`${src.end.tag} ${pos?.[0] ?? '+V'}`, `${src.end.tag} ${neg?.[0] ?? '-V'}`], kind: 'VDC', expect: '24 VDC (adjustable 22.5–28.5 V on most supplies)', when: '', otherwise: '0 V: check its DC OK lamp and the primary protection' };
    hop.note = 'Power supply output. Its primary side is fed from the protection below.';
  }
  const up = otherPins(c, src.end.tag, src.end.pin).filter((x) => !seen.has(x.net));
  if (cat === 'powerSupply') {
    // One phase is enough to follow; the others go through the same protection.
    const l = up.find((x) => /^(L1|L|AC\(L\))$/.test(x.pin)) ?? up[0];
    return [hop, ...(l ? supplyChain(c, l.net, p, seen, depth + 1) : [])];
  }
  if (!up.length) return [hop];
  if (!['breaker', 'fuse', 'disconnect', 'motorProtector'].includes(cat)) {
    hop.kind = 'contact';
    hop.note = `${src.end.tag} contact ${up[0].pin}-${src.end.pin}: closed only when ${src.end.tag} is ${cat === 'overload' ? 'not tripped' : 'ON'}.`;
  }
  return [hop, ...supplyChain(c, up[0].net, p, seen, depth + 1)];
}

/** Build the nets, the drawing plan and the junction boxes once, for many lookups. */
export function prepareWiring(ctx: DrawingContext, opts: WiringPathOptions = {}): WiringContext {
  return { prepared: true, ...build(ctx, opts) } as unknown as WiringContext;
}
const isPrepared = (x: DrawingContext | WiringContext): x is WiringContext => (x as WiringContext).prepared === true;
const ctxOf = (x: DrawingContext | WiringContext, opts: WiringPathOptions): Ctx => (isPrepared(x) ? (x as unknown as Ctx) : build(x, opts));

/** The path of one PLC point (address as in the I/O list, e.g. "X004", "Y001", "DF1"). */
export function wiringPath(ctx: DrawingContext | WiringContext, address: string, opts: WiringPathOptions = {}): WiringPath | null {
  return pathIn(ctxOf(ctx, opts), address);
}

/** Paths of every PLC point of the design. */
export function wiringPaths(ctx: DrawingContext | WiringContext, opts: WiringPathOptions = {}): WiringPath[] {
  const c = ctxOf(ctx, opts);
  const out: WiringPath[] = [];
  for (const p of c.m.io) { const w = pathIn(c, p.address); if (w) out.push(w); }
  for (const a of c.m.analog.circuits) { const w = pathIn(c, a.row.address); if (w && !out.some((x) => x.address === w.address)) out.push(w); }
  return out;
}

function pathIn(c: Ctx, address: string): WiringPath | null {
  const p = c.m.io.find((x) => x.address === address);
  const an = c.m.analog.circuits.find((x) => x.row.address === address);
  if (!p && !an) return null;
  if (an && !p) return analogPath(c, an);
  const point = p!;
  // Signal net: the wire on the PLC terminal of this address.
  const plcEnd = c.edges.flatMap((e) => [e.a, e.b]).find((x) => c.plcTags.has(x.tag) && x.pin.toUpperCase() === address.toUpperCase());
  const signal: PathHop[] = [];
  const seen = new Set<string>();
  let device = point.deviceTag;
  let deviceEnd: End | undefined;
  const parallel: PathHop[] = [];
  if (!plcEnd) {
    return {
      address: point.address, description: point.description, type: point.type, analog: false, device: device ?? '', noWire: true, parallel,
      signal: [{ kind: 'plc', tag: c.m.plcTag, terminal: address, wire: point.wire || address, label: `PLC terminal ${address} (no wire in the design)`, where: whereOf(c, c.m.plcTag, `io:${address}`, ['io']), location: 'cabinet' }],
      supply: [], ret: [], reference: c.zeroRef, summary: `${point.address} ${point.description}: no wire on the PLC terminal in the design`,
    };
  }
  {
    let net = c.edges.find((e) => key(e.a) === key(plcEnd) || key(e.b) === key(plcEnd))?.wire ?? address;
    signal.push({ ...hopOf(c, plcEnd, net, point), measure: signalMeasure(c, point, plcEnd.raw, net) });
    let from = key(plcEnd);
    for (let guard = 0; guard < 8 && net; guard++) {
      seen.add(net);
      const ends = walkNet(c, net, from);
      let next: { tag: string; pin: string } | null = null;
      for (const { end, color } of ends) {
        if (c.plcTags.has(end.tag)) continue;
        const atDevice = end.jbDevice ? end.jbDevice === device || !device : end.tag === device;
        if (end.jbDevice || (!end.strip && (atDevice || deviceEnd))) {
          signal.push(...cableHops(c, net, end.jbDevice ?? end.tag));
          const h = hopOf(c, end, net, point, color);
          if (end.jbDevice) { h.label = `${end.jbDevice}${describe(c, end.jbDevice) ? ` (${describe(c, end.jbDevice)})` : ''}, wired in junction box ${end.tag}`; h.tag = end.jbDevice; h.where = whereOf(c, end.jbDevice, undefined, ['io', 'machine', 'jb']); }
          h.kind = 'device';
          h.measure = signalMeasure(c, point, end.jbDevice ? `${end.tag} (${end.jbDevice})` : end.raw, net);
          if (deviceEnd) { parallel.push(h); continue; }
          signal.push(h);
          deviceEnd = end;
          if (!device) device = end.jbDevice ?? end.tag;
          next = null;
          continue;
        }
        if (deviceEnd) {
          // Another device on the same wire after the first: a parallel branch.
          if (!end.strip) { const h = hopOf(c, end, net, point, color); h.kind = 'device'; h.measure = signalMeasure(c, point, end.raw, net); parallel.push(h); }
          continue;
        }
        const h = hopOf(c, end, net, point, color);
        if (h.kind === 'terminal') { h.measure = signalMeasure(c, point, end.raw, net); signal.push(h); continue; }
        // A device in series (safety relay contact, interlock, overload contact): go through it.
        const through = otherPins(c, end.tag, end.pin).find((x) => !seen.has(x.net));
        h.kind = 'contact';
        h.measure = signalMeasure(c, point, end.raw, net);
        if (through) {
          h.label = `${end.tag}${describe(c, end.tag) ? ` (${describe(c, end.tag)})` : ''}, contact ${end.pin}-${through.pin}`;
          h.note = `The signal passes through ${end.tag} ${end.pin}-${through.pin}: it is closed only when ${end.tag} is ON.`;
          signal.push(h);
          next = { tag: end.tag, pin: through.pin };
          net = through.net;
          break;
        }
        signal.push(h);
      }
      if (!next) break;
      const nx = c.edges.flatMap((e) => [e.a, e.b]).find((x) => x.tag === next!.tag && x.pin.toUpperCase() === next!.pin);
      from = nx ? key(nx) : '';
    }
  }
  // Supply and return of the field device: through the device from the pin the signal reached (C → NO,
  // BK → BN, A2 → A1, 24 → 23), and its 0 V / neutral pins for the return.
  const supply: PathHop[] = [];
  const ret: PathHop[] = [];
  const dTag = deviceEnd?.jbDevice ?? deviceEnd?.tag ?? device;
  const isZero = (n: string) => n === c.zero || /^(N|X2)$/.test(n);
  const pins = c.pinsOf.get(dTag);
  let feed: string[] = [];
  let back: string[] = [];
  if (deviceEnd && !deviceEnd.jbDevice && pins) {
    feed = otherPins(c, dTag, deviceEnd.pin, true).map((x) => x.net).filter((n) => !seen.has(n) && !isZero(n));
    back = [...pins.values()].filter(isZero);
    if (!feed.length && point.type === 'input') {
      // No known partner pin (drive relay outputs, special devices): the common of the device, else its only DC supply.
      const dc = [...pins.entries()].filter(([, n]) => !seen.has(n) && !isZero(n) && !isPe(n) && (c.dcNets.has(n) || DC_SUPPLY.test(n) || /^24\+/.test(n)));
      const common = dc.find(([pp]) => /^(C|COM|RC|R\d|R\dC|\+24V?|24V)$/i.test(pp))
        ?? dc.find(([, n]) => (c.byNet.get(n) ?? []).some((e) => (e.a.tag === dTag || e.b.tag === dTag) && /relay common|common/i.test(e.fn)));
      feed = common ? [common[1]] : dc.length === 1 ? [dc[0][1]] : [];
    }
  } else {
    // Junction-box devices: their supply / return terminals in the cabinet.
    for (const t of [point.supplyTerminal, point.returnTerminal]) {
      const e = t ? c.edges.find((x) => x.a.raw === t || x.b.raw === t) : undefined;
      if (e && !seen.has(e.wire)) (isZero(e.wire) ? back : feed).push(e.wire);
    }
  }
  const terms = [point.supplyTerminal, point.returnTerminal].filter(Boolean) as string[];
  const termOn = (n: string) => {
    const e = (c.byNet.get(n) ?? []).find((x) => x.a.tag === dTag || x.b.tag === dTag || terms.includes(x.a.raw) || terms.includes(x.b.raw));
    const t = e ? [e.a, e.b].find((x) => x.strip) : undefined;
    return t && e ? { t, color: e.color } : null;
  };
  const supplySeen = new Set(seen);
  for (const n of [...new Set(feed)].slice(0, 1)) {
    const t = termOn(n);
    if (t) supply.push(hopOf(c, t.t, n, point, t.color));
    supply.push(...supplyChain(c, n, point, supplySeen));
  }
  // A 0 V return is checked from 24 V: 24 VDC across means the 0 V side is connected (an open 0 V floats up).
  const retMeasure = (at: string): Measure => ({ between: [c.plusRef, at], kind: 'VDC', expect: '24 VDC', when: `with ${dTag || 'the device'} powered`, otherwise: `about 0 V: the 0 V wire is open between here and the power supply` });
  for (const n of [...new Set(back)]) {
    // The contact's own partner pin when it is on 0 V (a dry contact fed from 0 V on an NPN common), else
    // the device's first 0 V pin.
    const partner = deviceEnd ? partnerPins(deviceEnd.pin).find((pp) => pins?.get(pp) === n) : undefined;
    const pin = partner ?? (pins && [...pins.entries()].find(([, x]) => x === n)?.[0]);
    if (pin && deviceEnd && !deviceEnd.jbDevice) {
      const e = (c.byNet.get(n) ?? []).find((x) => (x.a.tag === dTag && x.a.pin.toUpperCase() === pin) || (x.b.tag === dTag && x.b.pin.toUpperCase() === pin));
      const end = e ? (e.a.tag === dTag ? e.a : e.b) : undefined;
      if (end) ret.push({ ...hopOf(c, end, n, point, e!.color), kind: 'device', measure: partner ? { ...retMeasure(`${dTag}:${end.pin}`), when: '', otherwise: 'about 0 V: the 0 V feed of the contact is open' } : retMeasure(`${dTag}:${end.pin}`) });
    }
    const t = termOn(n);
    if (t) ret.push({ ...hopOf(c, t.t, n, point, t.color), measure: retMeasure(t.t.raw) });
    ret.push(...supplyChain(c, n, point, new Set(supplySeen)).slice(0, 1));
  }
  // Sourcing outputs: the load is fed by the output itself; its supply is the module's output supply terminal.
  if (point.type === 'output' && !supply.length && plcEnd) {
    const mod = c.m.groups.find((g) => g.key === point.group)?.devTag;
    const e = c.edges.find((x) => /output supply/i.test(x.fn) && (x.a.tag === mod || x.b.tag === mod))
      ?? c.edges.find((x) => /output supply/i.test(x.fn) && (x.a.tag === plcEnd.tag || x.b.tag === plcEnd.tag));
    if (e) {
      const pe = c.plcTags.has(e.a.tag) ? e.a : e.b;
      supply.push({ ...hopOf(c, pe, e.wire, point, e.color), common: true, label: `${endLabel(c, pe)} — the supply of the outputs`, note: 'The outputs of this module switch this supply to their loads.' });
      const t = [e.a, e.b].find((x) => x.strip);
      if (t) supply.push({ ...hopOf(c, t, e.wire, point, e.color), common: true });
      supply.push(...supplyChain(c, e.wire, point, new Set(supplySeen)));
    }
  }
  // The module common the current returns through (Input common / Output common): an open common is a classic fault.
  if (plcEnd) {
    const kind = point.type === 'input' ? /input common/i : /output common/i;
    // The common of the point's own module / slot (IO1:COM for a point on IO1), not the first one on the PLC.
    const mod = c.m.groups.find((g) => g.key === point.group)?.devTag;
    const own = (x: Edge) => [x.a.tag, x.b.tag].some((t) => t === mod);
    const e = c.edges.find((x) => kind.test(x.fn) && own(x)) ?? c.edges.find((x) => kind.test(x.fn) && (x.a.tag === plcEnd.tag || x.b.tag === plcEnd.tag));
    if (e) {
      const pe = c.plcTags.has(e.a.tag) ? e.a : e.b;
      const t = pe === e.a ? e.b : e.a;
      const common: PathHop = { ...hopOf(c, pe, e.wire, point, e.color), common: true, label: `${endLabel(c, pe)} — the common of ${point.address}`, note: `All the ${point.type}s of this group return through this common: if it is open, they all stay OFF.` };
      common.measure = isZero(e.wire)
        ? { between: [c.plusRef, pe.raw], kind: 'VDC', expect: '24 VDC', when: '', otherwise: 'about 0 V: the common wire is open' }
        : { between: [pe.raw, c.zeroRef], kind: 'VDC', expect: '24 VDC', when: '', otherwise: 'about 0 V: the common wire is open' };
      const target = isZero(e.wire) ? ret : supply;
      const strip = t.strip ? [{ ...hopOf(c, t, e.wire, point, e.color), common: true, ...(isZero(e.wire) ? { measure: { ...retMeasure(t.raw), when: '' } } : {}) }] : [];
      target.unshift(common, ...strip);
    }
  }
  // Hops between the device and its 24 V source (overload contact, safety relay output…): 24 VDC to 0 V while
  // every contact between them is closed.
  const lastSrc = supply.map((h) => h.kind).lastIndexOf('source');
  const src = lastSrc >= 0 ? lastSrc : -1;
  if (src > 0) {
    for (let i = src - 1; i >= 0; i--) {
      const h = supply[i];
      if (h.measure || /^(L\d|T\d|\d?L\d)$/.test(h.wire ?? '')) continue;
      const contacts = supply.slice(i, src).filter((x) => x.kind === 'device' || x.kind === 'contact').map((x) => x.tag);
      h.measure = { between: [`${h.tag}${h.terminal ? `:${h.terminal}` : ''}`, c.zeroRef], kind: 'VDC', expect: '24 VDC', when: contacts.length ? `while ${[...new Set(contacts)].join(' and ')} ${contacts.length > 1 ? 'are' : 'is'} closed / ON` : '', otherwise: `about 0 V: the break is between here and ${supply[src].tag}` };
    }
  }
  // One hop per terminal (the module common and the device return can land on the same 0 V terminal).
  const retKeys = new Set<string>();
  const retOnce = ret.filter((h) => { const k = `${h.tag}:${h.terminal ?? ''}`; return !retKeys.has(k) && Boolean(retKeys.add(k)); });
  ret.splice(0, ret.length, ...retOnce);
  // Hops drawn on the PLC point's own I/O sheet share its line.
  const io = signal[0]?.where;
  if (io?.line) for (const h of [...signal, ...parallel, ...supply.slice(0, 2), ...ret.slice(0, 2)]) if (h.where && h.where.sheet === io.sheet && !h.where.line) h.where = { ...h.where, line: io.line };
  const dev = signal.find((h) => h.kind === 'device');
  const summary = `${point.address} ${point.description}: ${signal.filter((h) => h.kind !== 'cable').map((h) => h.terminal && h.kind !== 'device' ? `${h.tag}${h.kind === 'terminal' ? '-' : ':'}${h.terminal}` : h.tag).join(' → ')}${supply.length ? `; supply ${supply.map((h) => h.tag).filter((t, i, a) => a.indexOf(t) === i).join(' ← ')}` : ''}`;
  return { address: point.address, description: point.description, type: point.type, analog: false, device: dev?.tag ?? device, signal, supply, ret, reference: c.zeroRef, summary, parallel };
}

function analogPath(c: Ctx, a: ElectricalModel['analog']['circuits'][number]): WiringPath {
  const row = a.row;
  const tc = a.loop === 'thermocouple';
  const twoWire = a.loop === 'two-wire';
  const mod = a.moduleTag;
  const endsOf = (net: string) => (c.byNet.get(net) ?? []).flatMap((e) => [{ end: e.a, color: e.color }, { end: e.b, color: e.color }]);
  // The module terminal of the channel: on the + net for voltage / thermocouple / outputs, on the − net for a
  // 2-wire loop (24 V → transmitter → TBA → CHn).
  const modOn = (net: string) => endsOf(net).find((x) => x.end.tag === mod && !/^0V$/i.test(x.end.pin));
  const nets = [a.wires.plus, a.wires.minus];
  const sigNet = nets.find((n) => modOn(n)) ?? a.wires.plus;
  const otherNet = nets.find((n) => n !== sigNet)!;
  const modEnd = modOn(sigNet);
  const label = (h: PathHop) => ({ ...h, where: whereOf(c, h.tag, undefined, ['analog']) ?? h.where });
  // PLC side → field along one net (terminals), then its cable cores.
  const along = (net: string, from?: string): PathHop[] => {
    const start = from ?? endsOf(net).find((x) => x.end.strip)?.end.raw;
    if (!start) return [];
    const hs = walkNet(c, net, start).filter((x) => x.end.tag !== mod && x.end.raw !== start).map((x) => label(hopOf(c, x.end, net, undefined, x.color)));
    const first = endsOf(net).find((x) => x.end.raw === start);
    return [...(from ? [] : first ? [label(hopOf(c, first.end, net, undefined, first.color))] : []), ...hs.filter((h) => h.kind === 'terminal')];
  };
  const signal: PathHop[] = [];
  if (modEnd) signal.push({ ...hopOf(c, modEnd.end, sigNet), kind: 'plc', label: `${endLabel(c, modEnd.end)} (${row.address})`, where: whereOf(c, mod, undefined, ['analog', 'io']) });
  signal.push(...along(sigNet, modEnd?.end.raw), ...cableHops(c, sigNet, a.deviceTag));
  const dev: PathHop | null = a.deviceTag && !a.internal ? {
    kind: 'device', tag: a.deviceTag, label: `${a.deviceTag} (${tc ? 'thermocouple' : twoWire ? '2-wire transmitter' : row.kind === 'output' ? 'analog output device' : 'transmitter'}) — ${row.description}`,
    wire: sigNet, where: whereOf(c, a.deviceTag, undefined, ['analog', 'machine']), location: 'field',
    ...(tc ? { note: 'Thermocouple + / − must not be swapped: a reversed pair reads below room temperature and falls as it heats.' } : {}),
  } : null;
  if (dev) signal.push(dev);
  // Back from the device on the other conductor: its cable core, the terminals, then the module (or the loop supply).
  const back = [...cableHops(c, otherNet, a.deviceTag).reverse(), ...along(otherNet).reverse()];
  const otherMod = endsOf(otherNet).find((x) => x.end.tag === mod);
  if (otherMod) back.push({ ...hopOf(c, otherMod.end, otherNet), kind: 'plc', label: `${endLabel(c, otherMod.end)} (${row.address} ${tc ? '−' : 'common'})`, where: whereOf(c, mod, undefined, ['analog', 'io']) });
  signal.push(...back);
  const plus = a.plus || 'the + terminal', minus = a.minus || 'the − terminal';
  const mA = row.range.includes('mA');
  const lo = `${row.scaleMin} ${row.units}`, hi = `${row.scaleMax} ${row.units}`;
  if (signal[0]) {
    signal[0].measure = tc
      ? { between: [plus, minus], kind: 'mV', expect: 'a few millivolts that rise with temperature (type J ≈ 0.05 mV per °C above the panel temperature)', when: '', otherwise: 'an open circuit (the module shows burnout) means a broken thermocouple or extension wire' }
      : mA
        ? { between: [minus, `the lifted ${twoWire ? 'wire' : 'conductor'}`], kind: 'mA', expect: `4–20 mA (4 mA = ${lo}, 20 mA = ${hi})`, when: `with the loop BROKEN at ${minus} and the meter in SERIES on its mA range — never put the meter across the terminals on mA (that shorts the ${twoWire ? 'transmitter' : 'output'})`, otherwise: 'below 3.8 mA: open loop, no loop supply or a dead transmitter' }
        : { between: [plus, minus], kind: 'VDC', expect: `${row.range} (${row.range.split('-')[0]} = ${lo}, top of range = ${hi})`, when: '' };
  }
  // Across the transmitter's OWN terminals in the field: at the cabinet terminals an open cable core would show the
  // full 24 V across the gap and look like a healthy loop.
  if (twoWire && dev) dev.measure = { between: [`${a.deviceTag} +`, `${a.deviceTag} −`], kind: 'VDC', expect: 'about 12–24 VDC (the loop supply minus the input drop)', when: `at the transmitter itself, loop connected, meter on VOLTS (safe across the terminals)`, otherwise: '0 V: no loop supply or the loop is open on its way' };
  const supply = twoWire ? (() => {
    const src = endsOf(otherNet).find((x) => !x.end.strip && x.end.tag !== mod);
    const net = src && (c.dcNets.has(src.end.raw) || DC_SUPPLY.test(src.end.raw)) ? src.end.raw : '24+';
    return supplyChain(c, net, undefined, new Set([a.wires.plus, a.wires.minus]));
  })() : [];
  return {
    address: row.address, description: row.description, type: row.kind, analog: true, device: a.deviceTag, signal, supply, ret: [], reference: tc ? minus : c.zeroRef, parallel: [],
    summary: `${row.address} ${row.description}: ${tc ? 'thermocouple' : a.loop} loop ${a.plus || ''} / ${a.minus || ''} to ${a.deviceTag}${a.cable ? ` (cable ${a.cable})` : ''}`,
  };
}
