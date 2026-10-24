/**
 * Process loads of the rule-based design: resistive heaters (branch fuses, a safety / limit contactor and the
 * PLC-switched SSR), the hardware over-temperature limit that drops the contactor, and the temperature
 * transmitter of a thermocouple analog input. Every part is a catalog part picked by its ratings; what the
 * catalog cannot cover becomes a note, never an invented part.
 */
import type { IOPoint } from '../../types/io';
import { SUPPLY_INFO } from '../../standards/regions';
import type { CatalogPart, DesignComponent, SupplyVoltage } from '../types';
import type { ModelHeater } from './machineModel';
import { comp, type Tags } from './power';
import { num, type Picker } from './select';

export interface HeaterBranch {
  heater: ModelHeater;
  amps: number;
  /** PLC-switched solid-state relay (the heater's output point is wired to it). */
  ssr?: string;
  contactor?: string;
}

export interface ProcessResult {
  components: DesignComponent[];
  heaters: HeaterBranch[];
  /** Hardware over-temperature limit alarm (its latched relay drops the heater contactors). */
  limit?: string;
  /** Temperature transmitter per analog input id. */
  transmitters: Map<string, string>;
  /** Heater current added to the main disconnect. */
  amps: number;
  notes: string[];
  askUser: string[];
}

const volts = (s: string | number | undefined) => [...String(s ?? '').matchAll(/(\d+)/g)].map((m) => Number(m[1]));
/** Does an SSR's load-voltage range ("24-600 VAC") cover the line voltage? */
// A margin of 10% over the nominal line voltage (480 V nominal needs a 600 V SSR).
const loadCovers = (p: CatalogPart, v: number) => { const [lo, hi] = volts(p.ratings.loadVolts as string); return lo !== undefined && hi !== undefined && v >= lo && v * 1.1 <= hi; };

function pickSsr(pk: Picker, phases: 1 | 3, lineV: number, amps: number): CatalogPart | null {
  const ok = (p: CatalogPart) => /zero cross/i.test(String(p.ratings.switching ?? '')) && /VDC/i.test(String(p.ratings.controlVolts ?? '')) && loadCovers(p, lineV)
    && (num(p.ratings.amps) ?? 0) >= amps * 1.25 && (phases === 3 ? (num(p.ratings.phases) ?? 1) === 3 : (num(p.ratings.poles) ?? 1) === 1);
  // DIN-rail SSRs with an integral heat sink first (nothing else to select), then panel SSRs with a heat sink.
  return pk.pick('relay', (p) => ok(p) && /integral/i.test(String(p.ratings.mounting ?? '')), (p) => num(p.ratings.amps) ?? 99)
    ?? pk.pick('relay', ok, (p) => num(p.ratings.amps) ?? 99);
}

export function processLoads(pk: Picker, tags: Tags, heaters: ModelHeater[], supply: SupplyVoltage, io: IOPoint[], hasLimitInput: boolean): ProcessResult {
  const out: ProcessResult = { components: [], heaters: [], transmitters: new Map(), amps: 0, notes: [], askUser: [] };
  const add = (c: DesignComponent) => { out.components.push(c); return c.tag; };
  const info = SUPPLY_INFO[supply];
  const lineV = info.volts;

  if (heaters.length) {
    // Hardware over-temperature limit: a limit alarm on its own thermocouple; its latched relay drops the heater contactor.
    const lim = pk.pick('other', (p) => p.ratings.kind === 'limitAlarm');
    if (lim) {
      out.limit = add(comp(tags.next('TAH'), lim.partNumber, 1, `Heater over-temperature limit — own thermocouple, latched relay 1 drops the heater contactor${heaters.length > 1 ? 's' : ''}${hasLimitInput ? ', relay 2 to the PLC' : ''} (independent of the PLC)`));
      out.askUser.push(`${out.limit} (${lim.partNumber}): order its SCU-PDM2 programming / display module (sold separately, not in this catalog) and a second thermocouple in the heater for the limit; set the trip point and the latch.`);
    } else out.notes.push('No limit alarm in the catalog: add a hardware over-temperature limit that drops the heater contactor independently of the PLC.');
  }

  for (const h of heaters) {
    const phases = info.phases === 1 ? 1 : h.phases;
    const amps = phases === 3 ? (h.kw * 1000) / (Math.sqrt(3) * lineV) : (h.kw * 1000) / lineV;
    const br: HeaterBranch = { heater: h, amps };
    out.amps += amps;
    const poles = info.phases === 1 ? 1 : phases === 3 ? 3 : 2;
    const ssr = h.switching === 'ssr' ? pickSsr(pk, phases, lineV, amps) : null;
    // Contactor ahead of the SSR (an SSR fails short): rated AC-1 for the resistive load, 24 VDC coil.
    const k = pk.pick('contactor', (p) => (num(p.ratings.ampsAC1) ?? 0) >= amps * 1.25 && /24\s*V?DC/i.test(String(p.ratings.coilVoltage ?? '')), (p) => num(p.ratings.ampsAC1) ?? 99);
    // SSR protection: Class J high-speed fuses; without an SSR, Class CC fuses for the resistive branch.
    const fuse = pk.pick('fuse', (p) => (ssr ? /high-speed/i.test(String(p.ratings.type ?? '')) && p.ratings.fuseClass === 'J' : p.ratings.fuseClass === 'CC' && /resistive/i.test(String(p.ratings.application ?? '')))
      && (num(p.ratings.amps) ?? 0) >= amps * 1.25, (p) => num(p.ratings.amps) ?? 99);
    const holder = fuse ? pk.pick('fuse', (p) => !p.ratings.fuseClass ? false : p.ratings.fuseClass === fuse.ratings.fuseClass && num(p.ratings.poles) === poles && (num(p.ratings.amps) ?? 0) >= (num(fuse.ratings.amps) ?? 0) && !p.ratings.type) : null;
    const name = `${h.tag} ${h.description}`;
    if (k) {
      br.contactor = add(comp(tags.next('K'), k.partNumber, 1, h.switching === 'ssr'
        ? `${name} safety contactor — AC-1 ${num(k.ratings.ampsAC1)} A >= 1.25 x ${amps.toFixed(1)} A; held by 24+S${out.limit ? ` through ${out.limit}` : ''}, so the safety stop and the over-temperature limit cut the heater even if the SSR fails short`
        : `${name} contactor — AC-1 ${num(k.ratings.ampsAC1)} A >= 1.25 x ${amps.toFixed(1)} A, switched by the PLC output${out.limit ? ` through ${out.limit}'s latched relay (over-temperature cuts it without the PLC)` : ''}`));
    }
    else out.notes.push(`${name}: no contactor with an AC-1 rating for ${amps.toFixed(1)} A x 1.25 — select one.`);
    if (ssr) {
      br.ssr = add(comp(tags.next('SSR'), ssr.partNumber, 1, `${name} solid-state relay — ${num(ssr.ratings.amps)} A zero-cross >= 1.25 x ${amps.toFixed(1)} A, switched by the PLC output (time-proportioned temperature control)`));
      if (/yes/i.test(String(ssr.ratings.heatsinkRequired ?? ''))) {
        const hs = pk.pick('other', (p) => p.ratings.kind === 'heatsink' && (num(p.ratings.recommendedMaxLoadAmps) ?? 0) >= amps, (p) => num(p.ratings.recommendedMaxLoadAmps) ?? 99);
        if (hs) add(comp(tags.next('HS'), hs.partNumber, 1, `Heat sink for ${br.ssr} — rated for ${num(hs.ratings.recommendedMaxLoadAmps)} A >= ${amps.toFixed(1)} A at 40 C`));
        else out.notes.push(`${br.ssr}: select a heat sink for ${amps.toFixed(1)} A.`);
      }
    } else if (h.switching === 'ssr') out.notes.push(`${name}: no SSR in the catalog for ${amps.toFixed(1)} A at ${lineV} V — the PLC output switches the contactor instead (no time-proportioned control).`);
    // Branch fuses, named with the path they feed (the power sheet prints this as the branch's load).
    if (holder && fuse) {
      const path = [br.contactor, br.ssr].filter(Boolean).join(' and ');
      // the cartridges take the holder's tag + F (like the motor branch fuses): they are drawn in the holder
      const ft = tags.next('FU');
      add(comp(ft, holder.partNumber, 1, `${name}${path ? ` via ${path}` : ''} — branch fuses ${num(fuse.ratings.amps)} A Class ${fuse.ratings.fuseClass}${ssr ? ' high-speed (SSR protection)' : ''}, >= 1.25 x ${amps.toFixed(1)} A heater current`));
      add(comp(`${ft}F`, fuse.partNumber, poles, `Fuse cartridges for ${ft} (the ${h.tag} branch)`));
    } else out.notes.push(`${name}: no fuse holder / fuses in the catalog for ${amps.toFixed(1)} A x 1.25 on ${poles} pole(s) — select the branch protection.`);
    out.heaters.push(br);
  }

  // Thermocouple inputs read through a 4-20 mA transmitter (the PLC has no thermocouple input on this card).
  for (const p of io.filter((x) => x.type === 'input' && x.signal === 'analog' && /\b(thermocouple|tc|temperature|temp)\b/i.test(x.description) && /\b(transmitter|4-20|ma)\b/i.test(`${x.description} ${x.analog?.range ?? ''}`))) {
    const units = p.analog?.units ?? '';
    const maxF = /F/.test(units) && !/C/.test(units) ? p.analog?.max ?? 0 : ((p.analog?.max ?? 0) * 9) / 5 + 32;
    const fixed = pk.pick('other', (q) => q.ratings.kind === 'temperatureTransmitter' && /fixed/i.test(String(q.ratings.range ?? '')) && maxF <= (num(String(q.ratings.range).replace(/^[^-]*-/, '')) ?? 0) && /K\b/.test(String(q.ratings.inputTypes ?? '')));
    const any = fixed ?? pk.pick('other', (q) => q.ratings.kind === 'temperatureTransmitter' && /yes/i.test(String(q.ratings.configurable ?? '')) && !/hazardous/i.test(String(q.ratings.hazloc ?? '')));
    if (any) {
      const t = add(comp(tags.next('TT'), any.partNumber, 1, `Temperature transmitter for ${p.description.replace(/\s*\(.*\)$/, '')} — thermocouple in, loop-powered 4-20 mA to the analog input (${p.analog?.min ?? 0}-${p.analog?.max ?? 0} ${units})`));
      out.transmitters.set(p.id, t);
    } else out.notes.push(`${p.description}: select a thermocouple transmitter (4-20 mA), or a thermocouple input module.`);
  }
  return out;
}
