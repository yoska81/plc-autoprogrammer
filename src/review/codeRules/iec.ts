/**
 * IEC 60204-1:2016+A1:2021 rules (Europe, Israel and other IEC regions). The rules that read the same
 * under both code families (disconnect, PE, E-stop, stop category, EDM, reset, overload, heights) live
 * in rules.ts with an IEC clause; these are the IEC-only ones: supply, conductor sizes in mm² (Table 5),
 * current-carrying capacity (Table 6), PE size (Table 1), conductor colours (13.2), short-circuit
 * protection, control circuit supply, IP rating, and the marking of the equipment (16.4).
 * Clauses not confirmed against the standard text carry "(verify clause)".
 */
import { panelNameplate, type ResolvedComponent, type WireRecord } from '../../electrical/derive';
import { IEC_AMPACITY, mm2FromAwg, SUPPLY_INFO } from '../../standards/regions';
import { AC_POWER, num, ratingA, type CodeRule, type Env } from './rules';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Conductor cross-section in mm² from "1.5 mm²", "1,5 mm2", or an AWG size as the IEC size drawn for it; null when unknown. */
export function mm2Of(size: string): number | null {
  const m = /([\d.,]+)\s*mm(?:²|2|\^2)/i.exec(size);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return mm2FromAwg(size);
}

/**
 * Current-carrying capacity (A), PVC copper at 40 °C, method B2 (in trunking): IEC 60204-1 Table 6
 * (IEC_AMPACITY in the region profile). Sizes between table steps use the next smaller step.
 */
export function iecAmpacity(mm2: number): number {
  let a = 0;
  for (const [s, b2] of IEC_AMPACITY) if (mm2 + 1e-6 >= s) a = b2;
  return a;
}

const mm2Txt = (v: number) => `${+v.toFixed(2)} mm²`;
const wireSizes = (env: Env, wire: string) => env.wires.filter((w) => w.wire === wire).map((w) => mm2Of(w.size)).filter((x): x is number => x !== null);
const smallest = (env: Env, wire: string): number | null => { const s = wireSizes(env, wire); return s.length ? Math.min(...s) : null; };
const isCable = (w: WireRecord) => /\(cable\)/.test(w.color);
const isPe = (w: WireRecord) => w.wire === 'PE' || /protective earth|ground$|ground\b(?!ed)/i.test(w.function);

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const IEC_RULES: CodeRule[] = [
  {
    id: 'iec-supply',
    name: 'Supply voltage and frequency of the site',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 4.3 / IEC 60038 (verify clause)' },
    run: (input) => {
      const s = input.ctx.design.inputs.supply;
      const info = SUPPLY_INFO[s as keyof typeof SUPPLY_INFO];
      if (info?.hz === 50) return [];
      return [{ subject: 'supply', severity: 'major', area: 'electrical', title: `Supply ${info?.label ?? s.replace(/-/g, ' ')} is not a 50 Hz IEC supply`,
        detail: 'Sites in Europe and Israel are supplied at 400/230 V 50 Hz. Motors, transformers, power supplies and protective devices must be rated for the actual supply.', fix: 'Confirm the site supply and select it in the project (e.g. 400 V 3-phase 50 Hz); re-check motor currents and device ratings.' }];
    },
  },
  {
    id: 'iec-min-conductor',
    name: 'Minimum conductor cross-section',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 12.4 and Table 5 (verify clause)' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      const seen = new Set<string>();
      for (const w of env.wires) {
        const a = mm2Of(w.size);
        if (a === null || seen.has(w.wire)) continue;
        const power = AC_POWER.test(w.function) || isPe(w);
        const min = power ? 0.75 : 0.2;
        if (a + 1e-6 < min) {
          seen.add(w.wire);
          out.push({ subject: w.wire, severity: 'major', area: 'electrical', title: `${w.wire} ${mm2Txt(a)} below the ${min} mm² minimum`,
            detail: `${w.function}: ${power ? 'power' : 'control'} conductors need at least ${min} mm² copper${isCable(w) ? ' (multicore cable)' : ''}.`, fix: `Use ${min} mm² or larger.` });
        }
      }
      return out;
    },
  },
  {
    id: 'iec-conductor-ocpd',
    name: 'Conductors protected by their overcurrent device',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 7.2.1 / 7.2.3 / 12.4 and Table 6 (verify clause)' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      const branches = [
        ...env.m.psBranches.filter((b) => !b.fromXfmr).map((b) => ({ tag: b.ps.tag, prot: b.protection, wires: b.feedWires })),
        ...env.m.auxBranches.map((b) => ({ tag: b.protection.tag, prot: b.protection as ResolvedComponent | undefined, wires: b.feedWires })),
        ...(env.m.xfmrBranch ? [{ tag: env.m.xfmrBranch.xfmr.tag, prot: env.m.xfmrBranch.protection, wires: env.m.xfmrBranch.primaryWires }] : []),
      ];
      for (const b of branches) {
        const a = ratingA(b.prot, env);
        if (!b.prot || a === undefined) continue;
        for (const w of b.wires.filter((x) => x !== 'N')) {
          const s = smallest(env, w);
          if (s === null) continue;
          const iz = iecAmpacity(s);
          if (a > iz) out.push({ subject: `${b.tag}:${w}`, severity: 'major', area: 'electrical', title: `${w} (${mm2Txt(s)}, ${iz} A) on a ${a} A device`,
            detail: `Conductor ${w} feeding ${b.tag} carries ${iz} A (Table 6, method B2), but ${b.prot.tag} is rated ${a} A.`, fix: `Use a device of ${iz} A or less, or a larger conductor.` });
        }
      }
      // motor conductors: current-carrying capacity at least the motor rated current
      for (const mm of env.m.motors) {
        const s = smallest(env, mm.lineWires[0]);
        if (s === null) continue;
        const iz = iecAmpacity(s);
        if (iz < mm.fla) out.push({ subject: mm.motor.tag, severity: 'major', area: 'electrical', title: `${mm.motor.tag} conductors (${mm2Txt(s)}) carry less than the motor current`,
          detail: `${mm.motor.tag} rated current ${mm.fla} A; ${mm2Txt(s)} carries ${iz} A (Table 6, method B2).`, fix: 'Use a larger conductor for this motor branch.' });
      }
      return out;
    },
  },
  {
    id: 'iec-dc-control-protection',
    name: 'Control circuit conductors protected',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 7.2.4 / 9.4.3 (verify clause)' },
    run: (_i, env) => {
      const dc = env.wires.filter((w) => /^(BU|WH\/BU)/.test(w.color) && !isCable(w));
      if (!dc.length || !env.m.psBranches.length) return [];
      const sizes = dc.map((w) => mm2Of(w.size)).filter((x): x is number => x !== null);
      if (!sizes.length) return [];
      const s = Math.min(...sizes), iz = iecAmpacity(s);
      const acProt = new Set<ResolvedComponent | undefined>([...env.m.psBranches.map((b) => b.protection), ...env.m.auxBranches.map((b) => b.protection), env.m.xfmrBranch?.protection, ...env.m.motors.map((mm) => mm.protection)]);
      const dcProt = env.m.rc.some((c) => !acProt.has(c) && !/primary/i.test(c.comp.function) && (
        (c.category === 'terminal' && /fused/i.test(c.part?.description ?? ''))
        || (['breaker', 'fuse'].includes(c.category) && /\b24 ?v|\bdc\b|vdc/i.test(c.comp.function))
        || /electronic circuit breaker|\becb\b/i.test(c.part?.description ?? '')));
      return env.m.psBranches.flatMap((b) => {
        const a = num(b.ps.part?.ratings.outputAmps ?? b.ps.part?.ratings.amps);
        if (a === undefined || a <= iz || dcProt) return [];
        return [{ subject: b.ps.tag, severity: 'major' as const, area: 'electrical' as const, title: `${mm2Txt(s)} control wiring on a ${a} A supply without protection`,
          detail: `The smallest control conductors are ${mm2Txt(s)} (${iz} A), but ${b.ps.tag} can deliver ${a} A and no control-circuit fuse or breaker protects them.`,
          fix: `Add control-circuit protection of ${iz} A or less, or use conductors that carry the supply current.` }];
      });
    },
  },
  {
    id: 'iec-pe-size',
    name: 'Protective conductor cross-section',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 5.2 Table 1 / 8.2.2 (verify clause)' },
    run: (_i, env) => env.m.motors.flatMap((mm) => {
      const s = smallest(env, mm.lineWires[0]);
      const pe = env.wires.filter((w) => new RegExp(`^${mm.motor.tag} motor ground`, 'i').test(w.function)).map((w) => mm2Of(w.size)).filter((x): x is number => x !== null);
      if (s === null || !pe.length) return [];
      const need = s <= 16 ? s : s <= 35 ? 16 : s / 2; // Table 1: S ≤ 16 → S; 16 < S ≤ 35 → 16; S > 35 → S/2
      const p = Math.min(...pe);
      return p + 0.01 >= need ? [] : [{ subject: mm.motor.tag, severity: 'major' as const, area: 'electrical' as const, title: `${mm.motor.tag} PE conductor ${mm2Txt(p)} smaller than required ${mm2Txt(need)}`,
        detail: `Phase conductors ${mm2Txt(s)} need a protective conductor of at least ${mm2Txt(need)}.`, fix: 'Use a PE conductor of the required size.' }];
    }),
  },
  {
    id: 'iec-wire-colours',
    name: 'Conductor colours',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 13.2.2 (PE green-yellow), 13.2.3 (neutral light blue), 13.2.4 (BK power, RD AC control, BU DC control, OR excepted circuits)' },
    run: (_i, env) => {
      const expect = (w: WireRecord): string[] | null => {
        if (isCable(w)) return null;
        if (isPe(w)) return ['GN/YE'];
        if (/secondary/i.test(w.function) && /^(X2)$/.test(w.wire)) return ['RD']; // earthed side of the control transformer: AC control
        if (/^(X2|N)$/.test(w.wire) || /neutral|grounded conductor/i.test(w.function)) return ['BU(LT)', 'LBU', 'BU'];
        if (/^X1$/.test(w.wire) || /secondary 1[12]0VAC|1[12]0VAC feed|230VAC feed/i.test(w.function)) return ['RD'];
        if (AC_POWER.test(w.function)) return ['BK'];
        if (/foreign|external source/i.test(w.function)) return ['OG', 'OR'];
        if (/^0V/.test(w.wire) || /^24\+/.test(w.wire)) return ['BU', 'WH/BU', 'DBU'];
        return null;
      };
      const bad = new Map<string, { w: WireRecord; want: string[] }>();
      for (const w of env.wires) {
        const want = expect(w);
        if (want && !want.includes(w.color) && !bad.has(w.wire)) bad.set(w.wire, { w, want });
      }
      return [...bad.values()].map(({ w, want }) => ({ subject: w.wire, severity: 'minor' as const, area: 'electrical' as const, title: `Wire ${w.wire} is ${w.color}, expected ${want[0]}`,
        detail: `${w.function}: ${want[0] === 'BU(LT)' ? 'light blue (neutral)' : want[0]} is the colour for this conductor under IEC 60204-1${want[0] === 'BU(LT)' ? '; white is the North American neutral colour' : ''}.`, fix: `Use ${want[0]} insulation for ${w.wire}.` }));
    },
  },
  {
    id: 'iec-short-circuit-protection',
    name: 'Short-circuit protection of motor and transformer circuits',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 7.2.1 / 7.2.7 / 7.2.10, coordination per IEC 60947-4-1 (verify clause)' },
    run: (_i, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      for (const mm of env.m.motors) {
        if (!mm.protection) out.push({ subject: mm.motor.tag, severity: 'major', area: 'electrical', title: `${mm.motor.tag} has no short-circuit protection`,
          detail: `No circuit-breaker, fuse or motor protector protects motor ${mm.motor.tag}.`, fix: 'Add short-circuit protection (motor circuit-breaker or fuses) coordinated with the contactor.' });
      }
      const t = env.m.transformer, br = env.m.xfmrBranch;
      if (t && br && !br.protection && !/yes/i.test(String(t.part?.ratings.fused ?? ''))) out.push({ subject: t.tag, severity: 'major', area: 'electrical', title: `${t.tag} primary not protected`,
        detail: `Control transformer ${t.tag} has no primary protection and no integral fuses.`, fix: 'Protect the transformer per the manufacturer (primary fuses or a breaker).' });
      if (env.m.motors.some((mm) => mm.protection && mm.contactors.length && !mm.vfd && mm.protection.category !== 'motorProtector')) out.push({ subject: 'coordination', severity: 'info', area: 'electrical', title: 'Check short-circuit coordination of breaker / fuse and contactor',
        detail: 'Under IEC the starter combination is selected from the manufacturer\'s coordination tables (type 1 or type 2, IEC 60947-4-1) for the prospective short-circuit current.', fix: 'Confirm each starter combination against the manufacturer\'s coordination table and note the type on the drawings.' });
      return out;
    },
  },
  {
    id: 'iec-control-supply',
    name: 'Control circuit supply and voltage',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 9.1.1 / 9.1.2 (verify clause)' },
    run: (input, env) => {
      const out: ReturnType<CodeRule['run']> = [];
      const acControl = env.wires.some((w) => /^X1$/.test(w.wire) || /control.*(1[12]0|230) ?vac|(1[12]0|230) ?vac.*control/i.test(w.function));
      const fromMains = acControl && !env.m.transformer;
      const starters = env.m.motors.length;
      if (fromMains && starters > 1) out.push({ subject: 'transformer', severity: 'minor', area: 'electrical', title: 'AC control circuits supplied directly from the mains',
        detail: 'AC control circuits must be supplied from a transformer with separate windings, except for machines with a single motor starter and no more than two control devices.', fix: 'Add a control transformer, or use 24 VDC control from a power supply with separate windings.' });
      const cv = /(\d{2,3})\s*V\s*AC|(\d{2,3})\s*VAC/i.exec(input.ctx.design.inputs.notes ?? '');
      const v = cv ? Number(cv[1] ?? cv[2]) : null;
      if (v !== null && v > 230) out.push({ subject: 'voltage', severity: 'minor', area: 'electrical', title: `Control voltage ${v} VAC above 230 V`,
        detail: 'AC control circuit voltage should not exceed 230 V (50 Hz).', fix: 'Use 230 VAC or lower (24 VDC preferred).' });
      return out;
    },
  },
  {
    id: 'iec-enclosure-ip',
    name: 'Degree of protection (IP) of the enclosure',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 11.3 / IEC 60529 (verify clause)' },
    run: (input, env) => {
      const enc = env.m.rc.find((c) => c.category === 'enclosure' && String(c.part?.ratings.kind ?? '') !== 'subpanel');
      // Approximate equivalents (NEMA 250 Annex / IEC 60529); a NEMA rating is not an IP rating.
      const IP: Record<string, number> = { '1': 20, '12': 54, '12K': 54, '13': 54, '3R': 24, '4': 66, '4X': 66 };
      const types = String(enc?.part?.ratings.nema ?? input.ctx.design.inputs.enclosureRating ?? '').replace(/NEMA\s*/gi, '').split('/').map((x) => x.trim().toUpperCase()).filter((x) => IP[x] !== undefined);
      const nema = types.reduce((b, x) => (IP[x] > (IP[b] ?? -1) ? x : b), types[0] ?? '');
      const ip = IP[nema];
      const out: ReturnType<CodeRule['run']> = [];
      const text = Object.values(input.spec ?? {}).join(' ').toLowerCase();
      const need = /wash ?down|hose|food.*sanit/.test(text) ? 66 : /outdoor|rain|wet/.test(text) ? 55 : 54;
      if (ip === undefined) out.push({ subject: 'ip', severity: 'minor', area: 'electrical', title: 'Enclosure IP rating not known',
        detail: 'IEC 60204-1 requires at least IP22 for control gear enclosures; typical industrial locations need IP54.', fix: `State the enclosure IP rating (IP${need} or better for this location).` });
      else if (ip < need) out.push({ subject: enc?.tag ?? 'enclosure', severity: ip < 22 ? 'major' : 'minor', area: 'electrical', title: `Enclosure about IP${ip}, location needs IP${need}`,
        detail: `NEMA ${nema} corresponds to about IP${ip}; ${need >= 66 ? 'wash-down' : need >= 55 ? 'wet / outdoor' : 'dust and splashing liquids in'} locations need IP${need}.`, fix: `Use an enclosure rated IP${need} or better.` });
      else out.push({ subject: 'ip-mark', severity: 'info', area: 'electrical', title: `State the enclosure as IP${ip} (NEMA ${nema})`,
        detail: 'IEC documentation and the nameplate state the IP code, not the NEMA type.', fix: `Write IP${ip} on the layout drawing and nameplate (confirm with the enclosure datasheet).` });
      return out;
    },
  },
  {
    id: 'iec-marking',
    name: 'Marking of the electrical equipment (nameplate)',
    clause: { US: '', Canada: '', IEC: 'IEC 60204-1 16.4' },
    run: (input) => {
      const n = panelNameplate(input.ctx);
      const missing: string[] = [];
      if (/tbd/i.test(n.sccr)) missing.push(`rated short-circuit current${input.sccr?.unknown.length ? ` (no rating yet for ${input.sccr.unknown.join(', ')})` : ''}`);
      if (SUPPLY_INFO[input.ctx.design.inputs.supply as keyof typeof SUPPLY_INFO]?.hz !== 50 && n.hz !== 50) missing.push('frequency for the site (50 Hz)');
      return missing.length ? [{ subject: 'nameplate', severity: 'minor' as const, area: 'electrical' as const, title: `Nameplate incomplete: ${missing.join(', ')}`,
        detail: 'The equipment must be marked with the supplier, type, serial number, rated voltage, phases, frequency, full-load current, rated short-circuit current and the main document number.', fix: 'Complete the nameplate data (determine the short-circuit rating per IEC 61439-1 / the component ratings).' }] : [];
    },
  },
];
