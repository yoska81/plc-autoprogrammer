import { CATALOG } from './catalog';
import { foreignPart } from './catalogs/foreignParts';
import { differences, functionKey } from './crossref';
import type { CatalogPart } from './types';

/**
 * North American (UL) catalog parts that do the job of an imported IEC / Chinese part, for "Convert existing
 * drawings". Matching is by function and rating, from the maker's published data on both sides:
 * - contactors: same poles, AC-3 current at least the drawn one (next size up first);
 * - miniature breakers: same poles and curve, current within 20 % (IEC 16 / 32 A have no US twin: 15 / 30 A
 *   are offered with the change listed); UL 489 (branch rated) first, since IEC 60898 MCBs and UL 1077
 *   supplementary protectors may not protect a branch circuit;
 * - relays: same contact arrangement (1CO = SPDT, 2CO = DPDT …), same coil voltage first;
 * - 22 / 30 mm operators and pilot lights: same size and colour, same contacts first;
 * - overloads / motor protectors: a setting range that contains the drawn range's middle;
 * - power supplies: same output voltage, at least the drawn current;
 * - drives: the cross-reference key (same HP class and input voltage class);
 * - PLC CPUs: at least the built-in inputs and outputs, same output type (relay / sinking / sourcing), smallest first;
 * - prox / photo sensors: same type and output (PNP / NPN), same barrel size first;
 * - encoders: same pulses per revolution and output type;
 * - everything else: the cross-reference function key (crossref.ts).
 * Each match lists what changes (coil voltage, footprint, UL status …). No match = nothing returned, never a guess.
 */

export interface NaEquivalent { part: CatalogPart; differences: string[] }

const n = (v: unknown): number | undefined => {
  const x = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(x) ? x : undefined;
};
/** '1CO' → 'SPDT', '2CO' → 'DPDT', '4CO' → '4PDT'. */
const contactsOf = (v: unknown) => {
  const s = String(v ?? '').toUpperCase().replace(/\s+/g, '');
  const co = s.match(/^(\d)C\/?O$/);
  return co ? ({ 1: 'SPDT', 2: 'DPDT', 3: '3PDT', 4: '4PDT' } as Record<string, string>)[co[1]] ?? s : s;
};
/** '(1) N.O.' and '1NO' → '1NO'; '1NO+1NC' kept in order. */
const nonc = (v: unknown) => String(v ?? '').toUpperCase().replace(/[().\s]/g, '');
const sizeMm = (p: CatalogPart) => n(p.ratings.diameterMm) ?? n(String(p.ratings.size ?? '').match(/(\d+)\s*mm/i)?.[1]);
/** Coil voltages a part accepts: '24VAC/VDC' → 24VAC, 24VDC. */
const coils = (v: unknown) => {
  const m = String(v ?? '').toUpperCase().replace(/\s+/g, '').match(/^([\d.\-/]+)V(AC|DC)(?:\/V?(AC|DC))?$/);
  return m ? [`${m[1]}V${m[2]}`, ...(m[3] ? [`${m[1]}V${m[3]}`] : [])] : [String(v ?? '').toUpperCase()];
};
const coilMatches = (a: unknown, b: unknown) => a !== undefined && coils(b).includes(String(a).toUpperCase());
const isBranch = (p: CatalogPart) => /yes/i.test(String(p.ratings.branchRated ?? '')) || /489/.test(String(p.ratings.ul ?? ''));

function candidates(f: CatalogPart, pool: CatalogPart[]): CatalogPart[] {
  const r = f.ratings;
  const same = pool.filter((p) => p.category === f.category);
  switch (f.category) {
    case 'contactor': {
      const a = n(r.amps), poles = n(r.poles);
      if (!a || !poles) return [];
      return same.filter((p) => n(p.ratings.poles) === poles && (n(p.ratings.amps) ?? 0) >= a)
        .sort((x, y) => n(x.ratings.amps)! - n(y.ratings.amps)!);
    }
    case 'breaker': {
      const a = n(r.amps), poles = n(r.poles), curve = String(r.curve ?? '');
      if (!a || !poles) return [];
      const near = (p: CatalogPart) => Math.abs(n(p.ratings.amps)! - a) / a;
      return same.filter((p) => n(p.ratings.amps) !== undefined && near(p) <= 0.2 && n(p.ratings.poles) === poles && (!curve || String(p.ratings.curve ?? '') === curve))
        .sort((x, y) => Number(isBranch(y)) - Number(isBranch(x)) || near(x) - near(y));
    }
    case 'overload':
    case 'motorProtector': {
      const lo = n(r.minAmps), hi = n(r.maxAmps);
      if (lo === undefined || hi === undefined) return [];
      const mid = (lo + hi) / 2;
      return same.filter((p) => (n(p.ratings.minAmps) ?? Infinity) <= mid && mid <= (n(p.ratings.maxAmps) ?? -Infinity))
        .sort((x, y) => Math.abs((n(x.ratings.minAmps)! + n(x.ratings.maxAmps)!) / 2 - mid) - Math.abs((n(y.ratings.minAmps)! + n(y.ratings.maxAmps)!) / 2 - mid));
    }
    case 'powerSupply': {
      const v = n(r.outputVolts), a = n(r.outputAmps);
      if (!v || !a) return [];
      return same.filter((p) => n(p.ratings.outputVolts) === v && (n(p.ratings.outputAmps) ?? 0) >= a)
        .sort((x, y) => n(x.ratings.outputAmps)! - n(y.ratings.outputAmps)!);
    }
    case 'relay': {
      if (r.switching !== undefined || r.loadVolts !== undefined || r.kind === 'timer') break;
      const c = contactsOf(r.contacts);
      if (!c) return [];
      return same.filter((p) => contactsOf(p.ratings.contacts) === c && p.ratings.switching === undefined)
        .sort((x, y) => Number(coilMatches(r.coilVoltage, y.ratings.coilVoltage ?? y.ratings.coil)) - Number(coilMatches(r.coilVoltage, x.ratings.coilVoltage ?? x.ratings.coil)));
    }
    case 'plc': {
      const di = n(r.discreteInputs), dout = n(r.discreteOutputs), type = String(r.outputType ?? '').toLowerCase();
      if (di === undefined || dout === undefined) return [];
      const size = (p: CatalogPart) => (n(p.ratings.discreteInputs) ?? 0) + (n(p.ratings.discreteOutputs) ?? 0);
      return same.filter((p) => (n(p.ratings.discreteInputs) ?? -1) >= di && (n(p.ratings.discreteOutputs) ?? -1) >= dout
        && (!type || String(p.ratings.outputType ?? '').toLowerCase().includes(type)))
        .sort((x, y) => size(x) - size(y));
    }
    case 'sensor': {
      const type = String(r.type ?? '').toLowerCase(), out = String(r.output ?? '').toUpperCase(), d = n(r.diameterMm);
      if (!type || !out) return [];
      return same.filter((p) => String(p.ratings.type ?? '').toLowerCase() === type && String(p.ratings.output ?? '').toUpperCase() === out)
        .sort((x, y) => Number(n(y.ratings.diameterMm) === d) - Number(n(x.ratings.diameterMm) === d));
    }
    case 'encoder': {
      const ppr = n(r.ppr), type = String(r.outputType ?? '').toLowerCase();
      if (!ppr) return [];
      const kind = (s: string) => (/line/.test(s) ? 'line driver' : /totem|push/.test(s) ? 'push-pull' : /collector/.test(s) ? 'open collector' : s);
      return same.filter((p) => n(p.ratings.ppr) === ppr && (!type || kind(String(p.ratings.outputType ?? '').toLowerCase()) === kind(type)));
    }
    case 'pushbutton':
    case 'pilotLight':
    case 'selector':
    case 'estop': {
      const d = sizeMm(f), color = String(r.color ?? '').toLowerCase();
      if (!d) return [];
      return same.filter((p) => sizeMm(p) === d && (!color || f.category === 'estop' || String(p.ratings.color ?? '').toLowerCase() === color))
        .sort((x, y) => Number(nonc(y.ratings.contacts) === nonc(r.contacts)) - Number(nonc(x.ratings.contacts) === nonc(r.contacts)));
    }
  }
  const k = functionKey(f)?.join('|');
  return k ? same.filter((p) => functionKey(p)?.join('|') === k) : [];
}

/** UL catalog parts that can replace a foreign part (by part number as printed, or the full record). */
export function foreignEquivalents(partOrPn: string | CatalogPart, pool: CatalogPart[] = CATALOG, limit = 8): NaEquivalent[] {
  const f = typeof partOrPn === 'string' ? foreignPart(partOrPn)?.part : partOrPn;
  if (!f) return [];
  return candidates(f, pool).slice(0, limit).map((p) => {
    const d = differences(f, p);
    if (f.category === 'breaker' && !isBranch(p)) d.push('Not branch rated (UL 1077 supplementary): needs upstream branch protection');
    // The imported part's own UL status as its maker states it (catalog parts are the UL path).
    d.push(`Imported part UL status: ${String(f.ratings.ul ?? 'not stated')}`);
    return { part: p, differences: d };
  });
}
