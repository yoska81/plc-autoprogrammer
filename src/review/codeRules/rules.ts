/**
 * Electrical code compliance rules: the deterministic checks a senior electrical engineer applies
 * before signing the drawings. Region aware: US = NFPA 79 (2024) + UL 508A + NEC (NFPA 70);
 * Canada = CSA C22.2 No. 14 + CEC Part I (CSA C22.1); IEC regions (Europe, Israel …) = IEC 60204-1:2016+A1:2021
 * with the IEC-only rules in iec.ts. Every hit names its clause; clauses not
 * confirmed against the standard text carry "(verify clause)".
 * Pure functions of the electrical design (no stores, no React).
 */
import {
  buildModel, codeRefs, isFuseCartridge, panelLayout, panelNameplate, spareSpace,
  type DrawingContext, type ElectricalModel, type PanelLayout, type ResolvedComponent, type WireRecord,
} from '../../electrical/derive';
import type { SpecSections } from '../../spec/types';
import type { ReviewArea, Severity } from '../types';
import { IEC_RULES } from './iec';
import { isIec } from '../../standards/regions';

export interface CodeInput {
  ctx: DrawingContext;
  spec?: Partial<SpecSections>;
  /** From the SCCR table (UL 508A SB method): components without a rating and the lowest rating. */
  sccr?: { unknown: string[]; lowest: number | null };
  /** Rule set to apply; defaults to the project's region (see ruleSetOf). */
  ruleSet?: RuleSet;
}

/** NA = NFPA 79 / UL 508A / NEC / CSA + CEC; IEC = IEC 60204-1 (+ ISO 13849 / ISO 13850). */
export type RuleSet = 'NA' | 'IEC';

/** Rule set of a region: the region profile's standards family (src/standards/regions.ts). */
export function ruleSetOf(region: string | undefined): RuleSet {
  return isIec(region) ? 'IEC' : 'NA';
}

export interface CodeHit {
  rule: string;
  /** What the hit is about (tag, wire, circuit) — part of the stable finding id. */
  subject: string;
  severity: Severity;
  area: Extract<ReviewArea, 'electrical' | 'safety'>;
  title: string;
  detail: string;
  fix: string;
  clause: string;
}

export interface Env {
  m: ElectricalModel;
  L: PanelLayout;
  canada: boolean;
  /** IEC 60204-1 rule set. */
  iec: boolean;
  wires: WireRecord[];
}

export interface CodeRule {
  id: string;
  name: string;
  /** IEC: the IEC 60204-1 clause; rules without one do not apply under IEC. */
  clause: { US: string; Canada: string; IEC?: string };
  run(input: CodeInput, env: Env): Omit<CodeHit, 'rule' | 'clause'>[];
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** AWG as a number, 1/0 = 0, 2/0 = -1 … ; null when not an AWG size. */
export function awgOf(size: string): number | null {
  const m = /^(\d+)(?:\/0)?\s*AWG/i.exec(size.trim());
  if (!m) return null;
  return /\/0/.test(size) ? 1 - Number(m[1]) : Number(m[1]);
}

/** Copper ampacity, 75 °C column (NEC Table 310.16; NFPA 79 Table 12.5.1 for 18 / 16 AWG). */
const AMPACITY: Record<number, number> = { 18: 7, 16: 10, 14: 20, 12: 25, 10: 35, 8: 50, 6: 65, 4: 85, 3: 100, 2: 115, 1: 130, 0: 150, [-1]: 175, [-2]: 200, [-3]: 230 };
/** Small-conductor overcurrent limits (NEC 240.4(D); NFPA 79 7.2.? / 12.5 for 18 and 16 AWG). */
const SMALL_MAX: Record<number, number> = { 18: 7, 16: 10, 14: 15, 12: 20, 10: 30 };
const STD = [1, 3, 6, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400];

export const ampacity = (awg: number): number => AMPACITY[awg] ?? 0;
/** Largest overcurrent device allowed on a non-motor conductor of this size. */
export function maxOcpd(awg: number): number {
  if (SMALL_MAX[awg] !== undefined) return SMALL_MAX[awg];
  const a = ampacity(awg);
  return STD.find((s) => s >= a) ?? a; // next standard size up (NEC 240.4(B))
}

export const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

/** Rating of a protective device in amps: fuse cartridge in a holder, else the device. */
export function ratingA(c: ResolvedComponent | undefined, env: Env): number | undefined {
  if (!c) return undefined;
  if (c.category === 'fuse' && !isFuseCartridge(c)) {
    const cart = c.fuse ?? env.m.rc.find((x) => isFuseCartridge(x) && x.comp.motorTag && x.comp.motorTag === c.comp.motorTag)?.part;
    const a = num(cart?.ratings.amps);
    if (a !== undefined) return a;
  }
  return num(c.part?.ratings.amps ?? c.part?.ratings.maxAmps);
}

const sizeOfWire = (env: Env, wire: string): number | null => {
  const sizes = env.wires.filter((w) => w.wire === wire).map((w) => awgOf(w.size)).filter((x): x is number => x !== null);
  return sizes.length ? Math.max(...sizes) : null; // larger AWG number = smaller conductor
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const AC_POWER = /incoming supply|power bus|line side|contactor to overload|motor leads|motor cable|primary|disconnect to main|feed$/i;

// Safety devices and process heaters the I/O list or spec asks for, checked against what the design
// actually has: plain PLC inputs and standard sensors are not a safety function, and a heater needs
// its own power circuit and an over-temperature cutoff that does not depend on the PLC.
const TWO_HAND = /\btwo[- ]?hand/i;
const LIGHT_CURTAIN = /\blight[- ]?curtain|\bOSSD\b|\bsafety (light )?(mat|edge|scanner)/i;
const HEATER = /\bheat(er|ers|ing)\b|\bhot ?plate\b|\bseal(ing)? (bar|jaw)s?\b/i;
/** A heater the machine has, as the spec words it (not "heat dissipation" or "heat sink"). */
const HEATER_SPEC = /\bheaters?\b|\bheating element|\bhot ?plate\b|\bseal(ing)? (bar|jaw)s?\b|\bheat[- ]seal/i;
const OVERTEMP = /\bover[- ]?temp\w*|\bhigh[- ]?limit\b|\btemperature limit\b|\bthermal (cut-?out|limit)\b/i;
const THERMOCOUPLE = /\bthermocouple|\bT\/C\b|\btype [JK]\b/i;
const partText = (c: ResolvedComponent) => `${c.part?.description ?? ''} ${c.comp.function} ${c.partNumber}`;
const specText = (i: CodeInput) => Object.values(i.spec ?? {}).filter((t): t is string => typeof t === 'string').join('\n');
const ioOf = (i: CodeInput) => [...(i.ctx.design.ioWiring ?? []).map((w) => ({ address: w.address, description: w.description, tag: w.deviceTag, location: w.location ?? '' })),
  ...(i.ctx.analog ?? []).map((a) => ({ address: a.address, description: a.description, tag: '', location: '' }))];

const SAFETY_PROCESS_RULES: CodeRule[] = [
  {
    id: 'output-load-circuit',
    name: 'Every PLC-output load sits between the output and the right supply',
    clause: { US: 'NFPA 79 9.1 / PLC output wiring per manufacturer (verify clause)', Canada: 'CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 9.1 (verify clause)' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      const groupOf = new Map(env.m.groups.flatMap((g) => g.points.map((p) => [p.address, g] as const)));
      for (const p of env.m.io) {
        if (p.type !== 'output' || !p.deviceTag || !['contactor-coil', 'relay-coil', 'pilot-light', 'solenoid'].includes(p.deviceType)) continue;
        const style = groupOf.get(p.address)?.outputStyle;
        if (style !== 'sinking' && style !== 'sourcing') continue;
        const [a, b] = p.deviceType === 'pilot-light' ? ['X1', 'X2'] : ['A1', 'A2'];
        // what each end of the load is wired to, by wire number (one number per potential; chain letters follow the chain)
        const side = (term: string) => {
          const nums = env.wires.filter((w) => w.from === `${p.deviceTag}:${term}` || w.to === `${p.deviceTag}:${term}`).map((w) => w.wire);
          if (!nums.length) return null;
          if (nums.includes('0V')) return '0V';
          if (nums.some((n) => n === '24+' || n === '24+S')) return '24V';
          if (nums.includes(p.address)) return 'OUT';
          if (nums.some((n) => n.startsWith(p.address))) return p.coilChain?.sink ? '24V' : 'OUT';
          return 'OTHER';
        };
        const ends = [side(a), side(b)];
        if (ends.includes(null)) continue; // field device wired through a cable: judged by the cable check
        const want = style === 'sinking' ? '24V' : '0V';
        if (ends.includes('OUT') && ends.includes(want)) continue;
        out.push({
          subject: p.address, severity: 'critical', area: 'electrical', title: `${p.deviceTag} on ${p.address} cannot switch: its circuit does not match the ${style} output`,
          detail: `${p.deviceTag} ${a} is on ${ends[0]}, ${b} on ${ends[1]}. A ${style} PLC output ${style === 'sinking' ? 'switches its load to 0V, so the load must be fed from +24 V (24+S) on its other side' : 'sources +24 V, so the load must return to 0V on its other side'}; otherwise the load never energizes.`,
          fix: style === 'sinking' ? `Wire 24+S → (series contacts) → ${p.deviceTag} ${a}, ${p.deviceTag} ${b} → ${p.address}.` : `Wire ${p.address} → (series contacts) → ${p.deviceTag} ${a}, ${p.deviceTag} ${b} → 0V.`,
        });
      }
      return out;
    },
  },
  {
    id: 'two-hand-control',
    name: 'Two-hand control through a two-hand safety relay',
    clause: { US: 'ANSI B11.19 / ISO 13851 type IIIC, NFPA 79 9.2.3.8 (verify clause)', Canada: 'CSA Z432 / ISO 13851 type IIIC (verify clause)', IEC: 'IEC 60204-1 9.2.3.8 / ISO 13851 type IIIC (verify clause)' },
    run: (i, env) => {
      const pts = ioOf(i).filter((p) => TWO_HAND.test(p.description));
      if (!pts.length && !TWO_HAND.test(specText(i))) return [];
      const relay = env.m.rc.find((c) => c.category === 'safetyRelay' && /two[- ]?hand|13851|type III/i.test(partText(c)));
      const onDoor = pts.filter((p) => /door|cabinet/i.test(p.location));
      const out: ReturnType<CodeRule['run']> = [];
      if (!relay) out.push({
        subject: 'two-hand', severity: 'critical', area: 'safety', title: 'Two-hand control without a two-hand safety relay',
        detail: `${pts.length ? `${pts.map((p) => `${p.address} ${p.description}`).join(', ')} ${pts.length > 1 ? 'are' : 'is'} wired as plain pushbuttons to PLC inputs` : 'The specification asks for a two-hand start, but the design has no two-hand control device'}. A two-hand control is a safety function: each button needs an N.O. + N.C. contact into a two-hand safety relay that requires both within 0.5 s and stops the hazardous motion when either is released; the PLC only reads the relay's output.`,
        fix: 'Add a two-hand control relay (type IIIC) and two-hand buttons with N.O. + N.C. contacts; drive the closing valve from the relay\'s safety output, give the PLC its status input.',
      });
      if (onDoor.length) out.push({
        subject: 'two-hand-door', severity: 'major', area: 'safety', title: 'Two-hand buttons on the cabinet door',
        detail: `${onDoor.map((p) => p.tag || p.address).join(', ')} are placed on the cabinet door. Two-hand buttons belong on an operator station at the machine, at the safety distance from the hazard (ISO 13855), shrouded against accidental operation and far enough apart that one hand (or hand and elbow) cannot press both.`,
        fix: 'Move the two-hand buttons to a two-hand station at the sealing head; size the distance from the closing time.',
      });
      return out;
    },
  },
  {
    id: 'safety-device-standard-part',
    name: 'Safety devices are safety-rated parts',
    clause: { US: 'ANSI B11.19 / NFPA 79 9.4 (verify clause)', Canada: 'CSA Z432 (verify clause)', IEC: 'IEC 60204-1 9.4 / IEC 61496 (verify clause)' },
    run: (i, env) => ioOf(i).filter((p) => LIGHT_CURTAIN.test(p.description) && p.tag).flatMap((p) => {
      const c = env.m.rc.find((x) => x.tag === p.tag);
      if (!c || c.category === 'safetyRelay' || !/sensor|other/.test(c.category)) return [];
      return [{
        subject: p.tag, severity: 'critical' as const, area: 'safety' as const, title: `${p.tag} "${p.description}" is a standard sensor, not a safety device`,
        detail: `${p.address} ${p.description} is wired to ${p.tag} ${c.partNumber} (${c.part?.description ?? c.category}). A light curtain / safety sensor must be a safety-rated device (type 4 ESPE, IEC 61496) whose OSSD outputs go to a safety relay; a standard sensor on a PLC input gives no protection.`,
        fix: 'Remove the standard sensor from the BOM; select a type 4 light curtain and wire its OSSDs to a safety relay channel; the PLC reads the relay status.',
      }];
    }),
  },
  {
    id: 'light-curtain-relay',
    name: 'Light curtain on a safety relay that accepts OSSD outputs',
    clause: { US: 'ANSI B11.19 / ISO 13855 (verify clause)', Canada: 'CSA Z432 / ISO 13855 (verify clause)', IEC: 'IEC 61496-1 / ISO 13855 / IEC 60204-1 9.4 (verify clause)' },
    run: (i, env) => {
      if (!ioOf(i).some((p) => LIGHT_CURTAIN.test(p.description)) && !LIGHT_CURTAIN.test(specText(i))) return [];
      if (env.m.rc.some((c) => c.category === 'safetyRelay' && /light curtain|OSSD|ESPE|universal|semiconductor/i.test(partText(c)))) return [];
      const relays = env.m.rc.filter((c) => c.category === 'safetyRelay').map((c) => `${c.tag} ${c.partNumber}`);
      return [{
        subject: 'light-curtain', severity: 'critical', area: 'safety', title: 'Light curtain without a safety relay channel for its OSSD outputs',
        detail: `The machine has a light curtain but ${relays.length ? `the only safety relay (${relays.join(', ')}) is an E-stop / gate relay with dry-contact inputs` : 'no safety relay'}. OSSD outputs are 24 V semiconductor outputs with their own cross-fault test: they need a safety relay input made for them, normally with automatic reset (start interlock) separate from the E-stop's manual reset, and they must stop the closing stroke.`,
        fix: 'Add a safety relay (or a channel of a configurable safety relay) that accepts OSSD inputs for the light curtain; its output removes the closing valve\'s supply; the PLC reads its status.',
      }];
    },
  },
  {
    id: 'heater-power-circuit',
    name: 'Heater has its own power circuit',
    clause: { US: 'NFPA 79 7.2 / UL 508A (verify clause)', Canada: 'CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 7.2 (verify clause)' },
    run: (i, env) => ioOf(i).filter((p) => /^Y|^Q/.test(p.address) && HEATER.test(p.description) && !/\b(light|lamp|pilot|alarm)\b/i.test(p.description)).flatMap((p) => {
      const switching = env.m.rc.filter((c) => (c.category === 'contactor' || c.category === 'relay' || /solid.state|SSR/i.test(partText(c))) && HEATER.test(partText(c)) && !/interposing/i.test(c.comp.function));
      const protectedBy = env.m.rc.filter((c) => (c.category === 'breaker' || c.category === 'fuse') && HEATER.test(partText(c)));
      if (switching.length && protectedBy.length) return [];
      return [{
        subject: p.address, severity: 'major' as const, area: 'electrical' as const, title: `Heater output ${p.address} has no heater power circuit`,
        detail: `${p.address} "${p.description}" drives ${p.tag || 'a relay'} only. The heater itself is not in the design: it needs a solid-state relay (zero-cross, with heat sink) or a contactor rated for the heater current, its own branch protection, and its load in the disconnect and supply sizing.${switching.length ? '' : ' No SSR / heater contactor found.'}${protectedBy.length ? '' : ' No heater branch protection found.'}`,
        fix: 'Add the heater (power, voltage), an SSR or contactor and fuses / breaker for it; size the disconnect for the heater current.',
      }];
    }),
  },
  {
    id: 'heater-overtemperature',
    name: 'Independent over-temperature cutoff for heaters',
    clause: { US: 'NFPA 79 7.4 (verify clause)', Canada: 'CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 7.4 (verify clause)' },
    run: (i, env) => {
      const io = ioOf(i);
      const heater = io.some((p) => HEATER.test(p.description) && /^Y|^Q/.test(p.address)) || HEATER_SPEC.test(specText(i));
      if (!heater) return [];
      const out: ReturnType<CodeRule['run']> = [];
      const limits = io.filter((p) => OVERTEMP.test(p.description));
      const hardwired = env.m.rc.some((c) => OVERTEMP.test(c.comp.function) && /contactor|safety|cut/i.test(`${c.category} ${c.comp.function}`) && c.category !== 'sensor');
      if (!hardwired) out.push({
        subject: 'overtemp', severity: 'major', area: 'safety', title: 'Heater over-temperature cutoff is not hardwired',
        detail: limits.length
          ? `${limits.map((p) => `${p.address} ${p.description}`).join(', ')} only signals the PLC. An over-temperature limit must switch the heater off by itself (high-limit controller or thermal cut-out opening the heater contactor), so a stuck SSR or a PLC fault cannot overheat the seal bar.`
          : 'The design has a heater but no independent over-temperature limit. A stuck SSR or a PLC fault would heat the seal bar without limit.',
        fix: 'Add a high-limit controller / thermal cut-out (own sensor) that opens a heater contactor in series with the SSR; manual reset; the PLC reads its status.',
      });
      const tc = io.filter((p) => THERMOCOUPLE.test(p.description));
      if (tc.length && !env.m.rc.some((c) => /thermocouple|transmitter|THM|TC input/i.test(partText(c)) && c.category !== 'sensor')) out.push({
        subject: 'thermocouple', severity: 'major', area: 'electrical', title: 'Thermocouple without a transmitter or thermocouple input',
        detail: `${tc.map((p) => `${p.address} ${p.description}`).join(', ')}: a thermocouple gives millivolts and needs cold-junction compensation; it cannot connect to a 4-20 mA / 0-10 V input${tc.some((p) => /transmitter/i.test(p.description)) ? ' — the I/O list counts on a transmitter, but none is in the design\'s parts list' : ''}. The design has neither a thermocouple transmitter nor a thermocouple input module.`,
        fix: 'Add a thermocouple transmitter (TC → 4-20 mA, type J/K as fitted) or a thermocouple input module, with thermocouple extension cable of the same type.',
      });
      return out;
    },
  },
];

export const RULES: CodeRule[] = [
  {
    id: 'min-conductor',
    name: 'Minimum conductor size',
    clause: { US: 'NFPA 79 12.6.1 / Table 12.6.1 (verify clause)', Canada: 'CSA C22.2 No. 14 / CEC 4-004 (verify clause)' },
    run: (_i, env) => {
      const small = env.wires.filter((w) => AC_POWER.test(w.function) && !/\(cable\)/.test(w.color) && (awgOf(w.size) ?? 0) > 14);
      return [...new Set(small.map((w) => w.wire))].map((wire) => ({
        subject: wire, severity: 'major', area: 'electrical', title: `Power conductor ${wire} smaller than 14 AWG`,
        detail: `Wire ${wire} is a power conductor sized ${small.find((w) => w.wire === wire)!.size}; power circuits need at least 14 AWG copper.`,
        fix: 'Use 14 AWG or larger for power wiring.',
      }));
    },
  },
  {
    id: 'branch-conductor-ocpd',
    name: 'Branch conductor protected by its overcurrent device',
    clause: { US: 'NEC 240.4(D) / NFPA 79 7.2.3 and Table 12.5.1 (verify clause)', Canada: 'CEC 14-104 / Table 13 (verify clause)' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      const branches = [
        ...env.m.psBranches.filter((b) => !b.fromXfmr).map((b) => ({ tag: b.ps.tag, prot: b.protection, wires: b.feedWires })),
        ...env.m.auxBranches.map((b) => ({ tag: b.protection.tag, prot: b.protection as ResolvedComponent | undefined, wires: b.feedWires })),
        ...(env.m.xfmrBranch ? [{ tag: env.m.xfmrBranch.xfmr.tag, prot: env.m.xfmrBranch.protection, wires: env.m.xfmrBranch.primaryWires }] : []),
      ];
      for (const b of branches) {
        const a = ratingA(b.prot, env);
        if (!b.prot || a === undefined) continue; // missing protection: own rules / design warnings
        for (const w of b.wires.filter((x) => x !== 'N')) {
          const awg = sizeOfWire(env, w);
          if (awg === null) continue;
          if (a > maxOcpd(awg)) {
            out.push({ subject: `${b.tag}:${w}`, severity: 'major', area: 'electrical', title: `${w} (${awg} AWG) on a ${a} A device`,
              detail: `Conductor ${w} feeding ${b.tag} is ${awg} AWG, which may be protected at no more than ${maxOcpd(awg)} A, but ${b.prot.tag} is rated ${a} A.`,
              fix: `Use a protective device of ${maxOcpd(awg)} A or less, or a larger conductor.` });
          }
        }
      }
      return out;
    },
  },
  {
    id: 'dc-control-protection',
    name: '24 VDC control conductors protected',
    clause: { US: 'NFPA 79 7.2.4 / 9.4.3 and NEC 240.4(D) (verify clause)', Canada: 'CSA C22.2 No. 14 / CEC 14-104 (verify clause)' },
    run: (_i, env) => {
      const dc = env.wires.filter((w) => /^(BU|WH\/BU)/.test(w.color));
      if (!dc.length || !env.m.psBranches.length) return [];
      const smallest = Math.max(...dc.map((w) => awgOf(w.size) ?? 0));
      const limit = SMALL_MAX[smallest] ?? maxOcpd(smallest);
      // DC-side protection: fused terminals, DC breakers or electronic circuit breakers on the 24 V output —
      // not the AC branch protection in front of the supply / transformer / motors.
      const acProt = new Set<ResolvedComponent | undefined>([...env.m.psBranches.map((b) => b.protection), ...env.m.auxBranches.map((b) => b.protection), env.m.xfmrBranch?.protection, ...env.m.motors.map((mm) => mm.protection)]);
      const dcProt = env.m.rc.some((c) => !acProt.has(c) && !/primary/i.test(c.comp.function) && (
        (c.category === 'terminal' && /fused/i.test(c.part?.description ?? ''))
        || (['breaker', 'fuse'].includes(c.category) && /\b24 ?v|\bdc\b|vdc/i.test(c.comp.function))
        || /electronic circuit breaker|\becb\b/i.test(c.part?.description ?? '')));
      const out: ReturnType<CodeRule['run']> = [];
      for (const b of env.m.psBranches) {
        const a = num(b.ps.part?.ratings.outputAmps ?? b.ps.part?.ratings.amps);
        if (a === undefined || a <= limit || dcProt) continue;
        out.push({ subject: b.ps.tag, severity: 'major', area: 'electrical', title: `${smallest} AWG 24 VDC wiring on a ${a} A supply without DC protection`,
          detail: `The smallest 24 VDC conductors are ${smallest} AWG (max. ${limit} A), but ${b.ps.tag} can deliver ${a} A and no 24 VDC fuse or breaker protects the distribution.`,
          fix: `Add 24 VDC branch protection of ${limit} A or less (fused terminals or a DC breaker per group), or use a supply / larger wire that the conductors can carry.` });
      }
      return out;
    },
  },
  {
    id: 'motor-conductor',
    name: 'Motor branch conductor at least 125 % of FLA',
    clause: { US: 'NEC 430.22 / NFPA 79 12.5.3 (verify clause)', Canada: 'CEC 28-106' },
    run: (_i, env) => env.m.motors.flatMap((mm) => {
      const awg = sizeOfWire(env, mm.lineWires[0]);
      if (awg === null) return [];
      const need = mm.fla * 1.25;
      return ampacity(awg) >= need ? [] : [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${mm.motor.tag} conductors too small for 125 % of FLA`,
        detail: `${mm.motor.tag} (${mm.motor.hp} HP, FLA ${mm.fla} A) needs conductors for ${need.toFixed(1)} A; ${awg} AWG carries ${ampacity(awg)} A.`,
        fix: 'Use the next larger conductor size for this motor branch.' }];
    }),
  },
  {
    id: 'motor-overload',
    name: 'Motor overload set to the motor FLA',
    clause: { US: 'NEC 430.32(A)(1) / NFPA 79 7.3.1', Canada: 'CEC 28-306', IEC: 'IEC 60204-1 7.3.1 / 7.3.2' },
    run: (_i, env) => env.m.motors.flatMap((mm) => {
      if (mm.vfd) return [];
      const ol = mm.overload ?? (mm.protection?.category === 'motorProtector' ? mm.protection : undefined);
      // IEC 60204-1 7.3.1: overload protection is required for motors rated more than 0.5 kW
      if (!ol && env.iec && mm.motor.hp * 0.7457 <= 0.5) return [];
      if (!ol) return [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${mm.motor.tag} has no overload protection`,
        detail: `Motor ${mm.motor.tag} is started across the line but no overload relay or motor protector is assigned.`, fix: 'Add an overload relay sized for the motor FLA.' }];
      const lo = num(ol.part?.ratings.minAmps), hi = num(ol.part?.ratings.maxAmps);
      if (lo === undefined || hi === undefined) return [];
      if (mm.fla >= lo && mm.fla <= hi) return [];
      return [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${ol.tag} range ${lo}–${hi} A does not cover ${mm.motor.tag} FLA ${mm.fla} A`,
        detail: `The overload must be set at the motor full-load current (max. 125 % for service factor ≥ 1.15); ${ol.tag} ${ol.partNumber} adjusts ${lo}–${hi} A.`,
        fix: `Choose an overload whose range includes ${mm.fla} A.` }];
    }),
  },
  {
    id: 'motor-scpd',
    name: 'Motor branch short-circuit protection within the code maximum',
    clause: { US: 'NEC 430.52 and Table 430.52 / NFPA 79 7.2.10', Canada: 'CEC 28-200 and Table 29' },
    run: (_i, env) => env.m.motors.flatMap((mm) => {
      const p = mm.protection;
      if (!p) return [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${mm.motor.tag} has no branch short-circuit protection`,
        detail: `No breaker, fuse or motor protector is assigned to motor ${mm.motor.tag}.`, fix: 'Add branch short-circuit and ground-fault protection for the motor.' }];
      if (mm.vfd || p.category === 'motorProtector') return [];
      const a = ratingA(p, env);
      if (a === undefined) return [];
      const fuse = p.category === 'fuse';
      const cart = fuse ? (p.fuse ?? env.m.rc.find((x) => isFuseCartridge(x) && x.comp.motorTag === mm.motor.tag)?.part) : undefined;
      const pct = !fuse ? 2.5 : /time.?delay|dual/i.test(`${cart?.ratings.type ?? ''} ${cart?.description ?? ''}`) ? 1.75 : 3;
      const max = [...(fuse ? [1, 3, 6, 10] : []), ...STD.filter((s) => s >= 15)].find((s) => s >= mm.fla * pct - 1e-9) ?? mm.fla * pct;
      return a <= max ? [] : [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${p.tag} ${a} A above the ${max} A maximum for ${mm.motor.tag}`,
        detail: `${mm.motor.tag} FLA ${mm.fla} A × ${pct * 100} % (${fuse ? 'fuse' : 'inverse-time breaker'}) → next standard size ${max} A; ${p.tag} is ${a} A.`,
        fix: `Use a ${max} A or smaller ${fuse ? 'fuse' : 'breaker'}.` }];
    }),
  },
  {
    id: 'transformer-protection',
    name: 'Control transformer primary and secondary protection',
    clause: { US: 'NFPA 79 7.2.7 / NEC 450.3(B)', Canada: 'CEC 26-256 / 26-258 (verify clause)' },
    run: (_i, env) => {
      const t = env.m.transformer, br = env.m.xfmrBranch;
      if (!t || !br) return [];
      const fused = /yes/i.test(String(t.part?.ratings.fused ?? ''));
      if (fused && !br.protection) return [];
      if (!br.protection) return [{ subject: t.tag, severity: 'major', area: 'electrical', title: `${t.tag} primary not protected`,
        detail: `Control transformer ${t.tag} ${t.partNumber} has no primary fuses or breaker and no integral fuse block.`, fix: 'Add primary protection sized per the transformer nameplate (or use the fused CT-…-1 model).' }];
      const va = num(t.part?.ratings.va), pv = Math.max(...String(t.part?.ratings.primaryVolts ?? '').split('/').map(Number).filter((x) => x > 0));
      const a = ratingA(br.protection, env);
      if (!va || !Number.isFinite(pv) || a === undefined) return [];
      const ip = va / pv;
      const pct = ip < 2 ? 3 : ip < 9 ? 1.67 : 1.25;
      const max = [1, 3, 6, 10, ...STD.filter((s) => s >= 15)].find((s) => s >= ip * pct) ?? ip * pct;
      return a <= max ? [] : [{ subject: t.tag, severity: 'major', area: 'electrical', title: `${t.tag} primary protection ${a} A above ${max} A`,
        detail: `${t.tag} ${va} VA at ${pv} V draws ${ip.toFixed(2)} A; primary-only protection may be at most ${Math.round(pct * 100)} % → ${max} A.`, fix: `Use ${max} A or smaller primary fuses.` }];
    },
  },
  {
    id: 'disconnect',
    name: 'Supply disconnect rating and lockable handle',
    clause: { US: 'NFPA 79 5.3.2 / 5.3.3 and NEC 430.110(A) (verify clause)', Canada: 'CEC 28-602 / CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 5.3.2 / 5.3.3' },
    run: (input, env) => {
      const ds = env.m.disconnect;
      if (!ds) return [{ subject: 'none', severity: 'critical', area: 'electrical', title: 'No supply disconnecting means', detail: 'The panel has no main disconnect switch or breaker.', fix: 'Add a lockable main disconnect sized for the panel full-load current.' }];
      const out: ReturnType<CodeRule['run']> = [];
      const flc = panelNameplate(input.ctx).fullLoadAmps;
      const a = num(ds.part?.ratings.amps);
      // NEC 430.110: 115 % of the full-load current; IEC 60204-1 5.3.2: at least the full-load current
      const k = env.iec ? 1 : 1.15;
      if (a !== undefined && a < flc * k) out.push({ subject: ds.tag, severity: 'major', area: 'electrical', title: `${ds.tag} ${a} A below ${env.iec ? '' : '115 % of '}the panel full-load current`,
        detail: `Panel full-load current is ${flc} A; the disconnect must be rated at least ${(flc * k).toFixed(1)} A.`, fix: 'Choose a larger disconnect.' });
      const handle = env.m.rc.find((c) => c.category === 'disconnect' && c.mount === 'door') ?? env.m.rc.find((c) => /handle/i.test(c.part?.description ?? ''));
      const lockable = /padlock|lockable|lock/i.test(`${handle?.part?.description ?? ''} ${handle?.part?.ratings.lockable ?? ''} ${ds.part?.description ?? ''}`);
      if (!lockable) out.push({ subject: `${ds.tag}-lock`, severity: 'major', area: 'electrical', title: `${ds.tag} handle not lockable in OFF`,
        detail: 'The supply disconnect must be lockable in the OFF position for lockout / tagout.', fix: 'Use a padlockable external handle.' });
      return out;
    },
  },
  {
    id: 'mounting-heights',
    name: 'Disconnect handle and operator device heights',
    clause: { US: 'NFPA 79 5.3.4 (handle ≤ 2.0 m) and 10.1.1 (operator devices ≥ 0.6 m) (verify clause)', Canada: 'CEC 2-308 / CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 5.3.4 (handle 0.6–1.9 m) and 10.1.1 (operator devices ≥ 0.6 m) (verify clause)' },
    run: (_i, env) => {
      const D = env.L.door;
      const top = env.iec ? 1.9 : 2.0;
      if (!D.handle && !D.items.length) return [];
      const fromBottom = (cy: number) => (D.h - cy) / 1000;
      const handleUp = D.handle ? fromBottom(D.handle.cy) : null;
      const lowest = D.items.length ? Math.min(...D.items.map((d) => fromBottom(d.cy + d.h / 2))) : null;
      const maxBottom = handleUp !== null ? top - handleUp : Infinity;
      const minBottom = lowest !== null ? 0.6 - lowest : 0;
      const range = `${Math.max(0, minBottom).toFixed(2)}–${Number.isFinite(maxBottom) ? maxBottom.toFixed(2) : '—'} m`;
      if (maxBottom < minBottom) return [{ subject: 'door', severity: 'minor', area: 'electrical', title: 'No mounting height satisfies the handle and operator-height limits',
        detail: `The handle is ${handleUp!.toFixed(2)} m and the lowest operator device ${lowest!.toFixed(2)} m above the enclosure bottom: the handle must stay ≤ ${top} m and devices ≥ 0.6 m above the floor.`,
        fix: 'Rearrange the door (move low devices up or the handle down) or use a different enclosure.' }];
      return [{ subject: 'door', severity: 'info', area: 'electrical', title: `Mount the enclosure with its bottom ${range} above the floor`,
        detail: `Handle centre ${handleUp !== null ? `${handleUp.toFixed(2)} m` : '—'} and lowest operator device ${lowest !== null ? `${lowest.toFixed(2)} m` : '—'} above the enclosure bottom. Bottom edge ${range} above the servicing level keeps the handle ≤ ${top} m and devices ≥ 0.6 m.`,
        fix: 'Put the mounting height on the layout drawing / installation notes.' }];
    },
  },
  {
    id: 'wire-colours',
    name: 'Conductor colour code',
    clause: { US: 'NFPA 79 13.2.2 (PE) and 13.2.4 (BK power, RD AC control, BU DC control, WH grounded, OR foreign voltage)', Canada: 'CSA C22.2 No. 14 / CEC 4-036, 4-038 (verify clause)' },
    run: (_i, env) => {
      const expect = (w: WireRecord): string[] | null => {
        if (/\(cable\)/.test(w.color)) return null; // factory core colours of multiconductor cables
        if (w.wire === 'PE' || /protective earth|ground$|ground\b(?!ed)/i.test(w.function)) return ['GN/YE', 'GN'];
        if (/^X1$/.test(w.wire) || /secondary 120VAC|120VAC feed/i.test(w.function)) return ['RD'];
        if (/^(X2|N)$/.test(w.wire) || /neutral|grounded conductor/i.test(w.function)) return ['WH', 'GY'];
        if (AC_POWER.test(w.function)) return ['BK'];
        if (/^0V/.test(w.wire)) return ['WH/BU'];
        if (/^24\+/.test(w.wire)) return ['BU'];
        if (/foreign|external source/i.test(w.function)) return ['OR', 'YE'];
        return ['BU', 'WH/BU'];
      };
      const bad = new Map<string, { w: WireRecord; want: string[] }>();
      for (const w of env.wires) {
        const want = expect(w);
        if (want && !want.includes(w.color) && !bad.has(w.wire)) bad.set(w.wire, { w, want });
      }
      return [...bad.values()].map(({ w, want }) => ({ subject: w.wire, severity: 'minor' as const, area: 'electrical' as const, title: `Wire ${w.wire} is ${w.color}, expected ${want[0]}`,
        detail: `${w.function}: ${want[0]} is the colour for this kind of conductor.`, fix: `Use ${want[0]} insulation for ${w.wire}.` }));
    },
  },
  {
    id: 'protective-earth',
    name: 'Protective earth: ground bar, incoming PE and motor PE conductors',
    clause: { US: 'NFPA 79 8.2.1 / 8.2.2 / 8.2.3 (verify clause)', Canada: 'CEC 10-400 / CSA C22.2 No. 14 (verify clause)', IEC: 'IEC 60204-1 5.2 / 8.2.1 / 8.2.2' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      if (!env.m.groundBar) out.push({ subject: 'bar', severity: 'major', area: 'electrical', title: 'No PE ground bar', detail: 'There is no protective-earth bar for the incoming PE and the equipment grounding conductors.', fix: 'Add a ground bar bonded to the enclosure and back panel.' });
      if (!env.wires.some((w) => /incoming protective earth/i.test(w.function))) out.push({ subject: 'incoming', severity: 'major', area: 'electrical', title: 'No incoming PE conductor', detail: 'The supply PE conductor is not shown.', fix: 'Land the incoming PE on the ground bar.' });
      for (const mm of env.m.motors) {
        if (!env.wires.some((w) => new RegExp(`^${mm.motor.tag} motor ground`, 'i').test(w.function))) out.push({ subject: mm.motor.tag, severity: 'major', area: 'electrical', title: `${mm.motor.tag} has no PE conductor`, detail: `Motor ${mm.motor.tag} cable has no protective earth conductor.`, fix: 'Add a green/yellow PE conductor in the motor cable.' });
      }
      return out;
    },
  },
  {
    id: 'sccr',
    name: 'Short-circuit current rating determined and marked',
    clause: { US: 'UL 508A Supplement SB / NFPA 79 4.4.2 and 16.4.1 / NEC 409.110', Canada: 'CSA C22.2 No. 14 (SCCR marking) (verify clause)' },
    run: (input, env) => {
      const s = input.sccr;
      const out: ReturnType<CodeRule['run']> = [];
      // Missing datasheet data, not a design error: minor until the ratings are looked up.
      if (s?.unknown.length) out.push({ subject: 'unknown', severity: 'minor', area: 'electrical', title: `SCCR cannot be determined: no rating for ${s.unknown.join(', ')}`,
        detail: 'Every power-circuit component needs a short-circuit rating (or the default from UL 508A Table SB4.1) before the panel SCCR can be marked.', fix: 'Get the ratings from the datasheets or use parts with published SCCR.' });
      if (/tbd/i.test(panelNameplate(input.ctx).sccr) || !env.m.disconnect) out.push({ subject: 'marking', severity: 'minor', area: 'electrical', title: `Nameplate SCCR not stated${s?.lowest ? ` (SB calculation: ${s.lowest} kA)` : ''}`,
        detail: 'The panel nameplate must show the short-circuit current rating; it currently reads "to be determined".', fix: `Mark the SCCR on the nameplate${s?.lowest ? ` (${s.lowest} kA after review)` : ''} and confirm the available fault current at the site.` });
      return out;
    },
  },
  {
    id: 'enclosure-type',
    name: 'Enclosure type suits the location',
    clause: { US: 'NFPA 79 11.3 / UL 50E (NEMA 250) (verify clause)', Canada: 'CSA C22.2 No. 94.2 / CEC 2-400 (verify clause)' },
    run: (input, env) => {
      const want = input.ctx.design.inputs.enclosureRating;
      const enc = env.m.rc.find((c) => c.category === 'enclosure' && String(c.part?.ratings.kind ?? '') !== 'subpanel');
      const out: ReturnType<CodeRule['run']> = [];
      const list = String(enc?.part?.ratings.nema ?? '').split('/').map((x) => x.trim().toUpperCase());
      const need = String(want ?? '').replace(/^NEMA\s*/i, '').toUpperCase();
      if (enc && need && list.length && list[0] && !list.includes(need)) out.push({ subject: enc.tag, severity: 'major', area: 'electrical', title: `${enc.tag} is not ${want}`,
        detail: `The design asks for ${want}; ${enc.partNumber} is rated NEMA ${list.join('/')}.`, fix: `Choose an enclosure rated ${want}.` });
      const text = Object.values(input.spec ?? {}).join(' ').toLowerCase();
      const loc = /wash ?down|hose|wet location|food.*sanit/.test(text) ? '4X' : /outdoor|rain|outside/.test(text) ? '4' : null;
      if (loc && !(loc === '4X' ? list.includes('4X') : list.some((x) => ['3R', '4', '4X'].includes(x)))) out.push({ subject: 'location', severity: 'major', area: 'electrical', title: `Location needs NEMA ${loc}`,
        detail: `The specification mentions ${loc === '4X' ? 'wash-down / wet' : 'outdoor'} conditions; the enclosure is NEMA ${list.join('/') || '?'}.`, fix: `Use a NEMA ${loc} enclosure${loc === '4X' ? ' (stainless)' : ''}.` });
      return out;
    },
  },
  {
    id: 'spare-space',
    name: 'Spare space for later additions',
    clause: { US: 'Good practice / customer specification (no code clause)', Canada: 'Good practice / customer specification (no code clause)', IEC: 'Good practice / customer specification (no code clause)' },
    // Reported by the design review's spare-space finding; listed here so the rule table is complete.
    run: (input) => { spareSpace(input.ctx); return []; },
  },
  {
    id: 'estop-device',
    name: 'Emergency stop: red mushroom on a yellow background',
    clause: { US: 'NFPA 79 10.7.2 (verify clause) / ISO 13850', Canada: 'CSA C22.2 No. 14 / CSA Z432 (verify clause)', IEC: 'IEC 60204-1 10.7.3 / ISO 13850 (verify clause)' },
    run: (input, env) => {
      const es = env.m.rc.filter((c) => c.category === 'estop');
      const spec = Object.values(input.spec ?? {}).join(' ');
      if (!es.length) return /e-?stop|emergency stop/i.test(spec) ? [{ subject: 'none', severity: 'critical' as const, area: 'safety' as const, title: 'Emergency stop missing', detail: 'The specification calls for an emergency stop but the design has no E-stop device.', fix: 'Add a red mushroom E-stop wired to the safety relay.' }] : [];
      const yellow = env.m.rc.some((c) => /yellow/i.test(`${c.part?.description ?? ''} ${c.comp.function}`) && /legend|background|plate|e-?stop/i.test(`${c.part?.description ?? ''} ${c.comp.function}`));
      return es.flatMap((c) => {
        const d = `${c.part?.description ?? ''} ${c.part?.ratings.color ?? ''}`;
        const out: ReturnType<CodeRule['run']> = [];
        if (!/red/i.test(d) || !/mushroom|palm|e-?stop/i.test(d)) out.push({ subject: c.tag, severity: 'major', area: 'safety', title: `${c.tag} is not a red mushroom operator`, detail: `${c.partNumber}: ${c.part?.description ?? ''}`, fix: 'Use a red mushroom-head, latching E-stop operator.' });
        if (!yellow) out.push({ subject: `${c.tag}-bg`, severity: 'minor', area: 'safety', title: `No yellow background for ${c.tag}`, detail: 'The E-stop actuator must be red on a yellow background (legend plate or enclosure area); no yellow legend plate is in the BOM.', fix: 'Add a yellow E-stop legend plate under the E-stop (e.g. AutomationDirect ECX1651, "EMERGENCY STOP").' });
        return out;
      });
    },
  },
  {
    id: 'stop-category',
    name: 'Stop category stated',
    clause: { US: 'NFPA 79 9.2.2 / 9.2.5.4', Canada: 'CSA C22.2 No. 14 / CSA Z432 (verify clause)', IEC: 'IEC 60204-1 9.2.2 / 9.2.3.4.2' },
    run: (input, env) => {
      if (!env.m.safety.relay && !env.m.rc.some((c) => c.category === 'estop')) return [];
      const t = `${input.spec?.safety ?? ''} ${input.spec?.modes ?? ''}`;
      return /stop category\s*[012]|category\s*[012]\s*stop/i.test(t) ? [] : [{ subject: 'spec', severity: 'minor', area: 'safety', title: 'Stop category of the emergency stop not stated',
        detail: 'The specification does not say whether the emergency stop is stop category 0 or 1.', fix: 'State the stop category (0 = immediate removal of power, 1 = controlled stop then removal) in the safety section.' }];
    },
  },
  {
    id: 'safety-edm',
    name: 'Safety relay monitors the contactors it switches (EDM)',
    clause: { US: 'NFPA 79 9.4.2 / ISO 13849-1 (verify clause)', Canada: 'CSA Z432 / ISO 13849-1 (verify clause)', IEC: 'ISO 13849-1 / IEC 60204-1 9.4 (verify clause)' },
    run: (_i, env) => {
      const s = env.m.safety;
      if (!s.relay) return [];
      const switched = env.m.motors.flatMap((mm) => mm.contactors.map((c) => c.tag));
      if (switched.length && !s.edm.length) return [{ subject: s.relay.tag, severity: 'major', area: 'safety', title: `${s.relay.tag} does not monitor the motor contactors`,
        detail: 'The contactors switched off by the safety function are not in the safety relay feedback (EDM) loop, so a welded contactor would go unnoticed.', fix: 'Wire an N.C. auxiliary contact of each safety contactor into the reset / feedback circuit (S33–S34).' }];
      return [];
    },
  },
  {
    id: 'safety-reset',
    name: 'Manual, separate safety reset',
    clause: { US: 'NFPA 79 9.2.5.4.1.2 / ISO 13850 (verify clause)', Canada: 'CSA Z432 (verify clause)', IEC: 'IEC 60204-1 9.2.3.4.2 / ISO 13850 (verify clause)' },
    run: (_i, env) => {
      const s = env.m.safety;
      if (!s.relay) return [];
      if (!s.reset) return [{ subject: s.relay.tag, severity: 'major', area: 'safety', title: 'No reset pushbutton for the safety relay',
        detail: 'After an emergency stop the safety function must be reset by a deliberate manual action; no reset button is assigned.', fix: 'Add a blue "Safety Reset" pushbutton wired to the relay reset input.' }];
      const startIo = env.m.io.find((p) => p.deviceTag === s.reset && /start/i.test(p.description));
      return startIo ? [{ subject: s.reset, severity: 'major', area: 'safety', title: `Safety reset ${s.reset} is also the Start button`,
        detail: 'Resetting the safety function must not start the machine; the reset must be a separate action from Start.', fix: 'Use a separate reset pushbutton.' }] : [];
    },
  },
  ...SAFETY_PROCESS_RULES,

];

/** Run every rule (region-aware clauses). */
export function makeEnv(ctx: DrawingContext, ruleSet: RuleSet = ruleSetOf(ctx.region)): Env {
  const m = buildModel(ctx);
  return { m, L: panelLayout(ctx), canada: codeRefs(ctx).region === 'Canada', iec: ruleSet === 'IEC', wires: m.wires };
}

/** The rules of a rule set, each with its clause for the region. */
export function rulesFor(ruleSet: RuleSet): CodeRule[] {
  return ruleSet === 'IEC' ? [...RULES.filter((r) => r.clause.IEC), ...IEC_RULES] : RULES;
}

export function runCodeRules(input: CodeInput, env: Env = makeEnv(input.ctx, input.ruleSet)): CodeHit[] {
  const set: RuleSet = env.iec ? 'IEC' : 'NA';
  return rulesFor(set).flatMap((r) => r.run(input, env).map((h) => ({ ...h, rule: r.id, clause: env.iec ? r.clause.IEC ?? '' : env.canada ? r.clause.Canada : r.clause.US })));
}
