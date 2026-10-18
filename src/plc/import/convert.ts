/**
 * ForeignProgram (the program's own names) → the app's program with neutral addresses.
 *   physical inputs / outputs → "@IN:n" / "@OUT:n" (n = position in the imported I/O list); materialize()
 *                                replaces them with the chosen PLC's addresses (X001…, Y001…, analog DF…);
 *   BOOL → C, INT → DS, DINT → DD, REAL → DF, TIMER / TON / TOF → T (members: done → T, elapsed → TD),
 *   COUNTER / CTU / CTD → CT (done → CT, count → CTD), first scan → SC2.
 * The original names become nicknames (program.tags) or I/O descriptions, and `names` maps back.
 */
import { rawTextNames, type LadderElement, type LadderOutput, type LadderProgram, type ProgramBlock, type Rung, type TagDefinition } from '../core/ladder';
import type { CpuModel, ModuleSlot, PlcProfile } from '../core/profile';
import { resolveAddresses } from '../core/profile';
import { siemensAddress, siemensAnalogChannels } from '../core/profiles/siemens';
import type { AnalogRange } from '../../types/io';
import type { IOPoint } from '../../types/io';
import type { ForeignProgram, ForeignTag, ImportedIoPoint, ImportedProgram, ImportReport } from './types';
import { slug } from './l5x';

const NUM = /^[-+]?(\d+(\.\d+)?|\d+#[0-9A-Fa-f_]+)$/;
const TIMER_DONE = /^(DN|Q)$/i;
const TIMER_ACC = /^(ACC|ET)$/i;
const COUNTER_DONE = /^(DN|Q|QU)$/i;
const COUNTER_ACC = /^(ACC|CV)$/i;

type Kind = 'bit' | 'timer' | 'counter' | 'int' | 'dint' | 'real';

/** Operand → base name + member ("Tmr.DN" → Tmr / DN). Module points and "%I0.0" are bases as they are. */
function split(op: string, isStruct: (base: string) => boolean): { base: string; member: string } {
  const m = /^(.*)\.([A-Za-z]+|\d+)$/.exec(op);
  if (m && !/^%/.test(op) && !/:\d+:[IO]\./i.test(op) && (isStruct(m[1]) || /^\d+$/.test(m[2]))) return { base: m[1], member: m[2] };
  return { base: op, member: '' };
}

/** Names inside an expression ("Tank_Level * 10 / Scale.ACC" → Tank_Level, Scale.ACC). */
const NAME_RE = /%[A-Za-z]+[\d.]+|[A-Za-z_][\w]*(?::\d+:[IO])?(?:\.[\w]+|\[[^\]]*\])*/g;
const RESERVED = new Set(['MOD', 'AND', 'OR', 'XOR', 'NOT', 'SQRT', 'ABS', 'SIN', 'COS', 'TAN', 'LN', 'LOG', 'TRUE', 'FALSE']);

export function convertForeign(fp: ForeignProgram, fileName: string): ImportedProgram {
  const tagBy = new Map<string, ForeignTag>();
  for (const t of fp.tags) tagBy.set(t.name.toLowerCase(), t);
  const notes = [...fp.notes];
  const typeOf = (base: string) => tagBy.get(base.toLowerCase());
  const structKind = (base: string): Kind | null => {
    const t = typeOf(base);
    const raw = (t?.rawType ?? t?.dataType ?? '').toUpperCase();
    if (/^(TIMER|TON|TOF|TP|TONR|IEC_TIMER|TON_TIME)$/.test(raw) || t?.dataType === 'TIMER') return 'timer';
    if (/^(COUNTER|CTU|CTD|CTUD|IEC_COUNTER)$/.test(raw) || t?.dataType === 'COUNTER') return 'counter';
    return null;
  };

  // ── 1. Every operand, with how it is used ──
  const uses = new Map<string, Set<string>>(); // base → roles: contact, coil, timer, counter, word, real
  const addUse = (base: string, role: string) => { const k = base; if (!uses.has(k)) uses.set(k, new Set()); uses.get(k)!.add(role); };
  const rungs: { rung: Rung; block: string }[] = [];
  for (const r of fp.routines) for (const g of r.rungs) rungs.push({ rung: g, block: r.name });
  const isStructUse = new Set<string>();
  for (const { rung } of rungs) for (const o of rung.outputs) if (o.type === 'TMR' || o.type === 'CNT') isStructUse.add(o.address.toLowerCase());
  const isStruct = (b: string) => structKind(b) !== null || isStructUse.has(b.toLowerCase());
  const operand = (op: string, role: string) => {
    if (NUM.test(op.trim())) return;
    const { base, member } = split(op.trim(), isStruct);
    addUse(base, member ? (/^\d+$/.test(member) ? 'wordbit' : `member:${member.toUpperCase()}`) : role);
  };
  const exprNames = (e: string) => (e.match(NAME_RE) ?? []).filter((n) => !RESERVED.has(n.toUpperCase()));
  // Names a kept instruction of a tag-based PLC uses (SCL, ST) become operands of the program too, so the
  // export declares them (Logix instructions bring their own definitions instead).
  const rawNames = (text: string) => rawTextNames(text).map((x) => x.name)
    .filter((n) => ['BOOL', 'INT', 'DINT', 'REAL'].includes(tagBy.get(n.toLowerCase())?.dataType ?? ''));
  for (const { rung } of rungs) {
    for (const x of [...rung.branches.flat(), ...rung.outputs]) {
      if (x.type === 'RAW' && x.vendor !== 'logix' && !/^\s*(FUNCTION|FUNCTION_BLOCK|ORGANIZATION_BLOCK|DATA_BLOCK)\b/i.test(x.text)) {
        for (const n of rawNames(x.text)) operand(n, tagBy.get(n.toLowerCase())!.dataType === 'BOOL' ? 'contact' : 'word');
      }
    }
    for (const b of rung.branches) for (const e of b) {
      if (e.type === 'CMP') { for (const n of [...exprNames(e.left), ...exprNames(e.right)]) operand(n, 'word'); } else if (e.type !== 'RAW') operand(e.address, 'contact');
    }
    for (const o of rung.outputs) {
      switch (o.type) {
        case 'OUT': case 'SET': case 'RST': operand(o.address, 'coil'); break;
        case 'TMR': addUse(o.address, 'timer'); for (const n of exprNames(o.preset)) operand(n, 'word'); if (o.resetAddress) operand(o.resetAddress, 'contact'); break;
        case 'CNT': addUse(o.address, 'counter'); for (const n of exprNames(o.preset)) operand(n, 'word'); if (o.resetAddress) operand(o.resetAddress, 'contact'); break;
        case 'COPY': for (const n of exprNames(o.source)) operand(n, 'word'); operand(o.dest, 'word'); break;
        case 'MATH': for (const n of exprNames(o.expression)) operand(n, 'word'); operand(o.dest, 'word'); break;
      }
    }
  }

  // ── 2. Physical I/O ──
  const io: ImportedIoPoint[] = [];
  const ioIndex = new Map<string, string>(); // base (lower) → @IN:n / @OUT:n
  const naturalAddr = (a: string) => a.replace(/\d+/g, (d) => d.padStart(6, '0'));
  const ioTags = fp.tags.filter((t) => t.io).sort((a, b) => naturalAddr(a.address ?? a.name).localeCompare(naturalAddr(b.address ?? b.name)));
  // An alias and its module point are one I/O point: keep the alias (it has the name the program uses).
  const byAddress = new Map<string, ForeignTag>();
  for (const t of ioTags) {
    const k = (t.address ?? t.name).toLowerCase();
    const prev = byAddress.get(k);
    if (!prev || (prev.name.toLowerCase() === k && t.name.toLowerCase() !== k)) byAddress.set(k, t);
  }
  let nIn = 0, nOut = 0;
  for (const t of byAddress.values()) {
    const ph = t.io === 'input' ? `@IN:${++nIn}` : `@OUT:${++nOut}`;
    io.push({ name: t.name, description: t.comment || pretty(t.name), type: t.io!, original: t.address ?? t.name, analog: Boolean(t.analog), confidence: 'high' });
    ioIndex.set(t.name.toLowerCase(), ph);
    if (t.address) ioIndex.set(t.address.toLowerCase(), ph);
  }
  // No I/O marked in the file at all: BOOLs that are read but never written are probably inputs (to confirm).
  if (!io.length) {
    for (const [base, roles] of uses) {
      if (roles.has('contact') && !roles.has('coil') && ![...roles].some((r) => r.startsWith('member')) && (typeOf(base)?.dataType ?? 'BOOL') === 'BOOL') {
        const ph = `@IN:${++nIn}`;
        io.push({ name: base, description: typeOf(base)?.comment || pretty(base), type: 'input', original: base, analog: false, confidence: 'low' });
        ioIndex.set(base.toLowerCase(), ph);
      }
    }
    if (nIn) notes.push(`The file does not say which tags are wired to the PLC's terminals. ${nIn} bits that are only read were taken as inputs; outputs are still internal bits: check the I/O list.`);
  }

  // ── 3. Neutral addresses for everything else ──
  const next: Record<string, number> = { C: 0, DS: 0, DD: 0, DF: 0, T: 0, CT: 0 };
  // Kept clear of the HMI's register blocks (C1001–C1300, DS1001–DS1200, DF101–DF200): the HMI reads roles from them.
  const HMI_BLOCK: Partial<Record<keyof typeof next, [number, number]>> = { C: [1001, 1300], DS: [1001, 1200], DF: [101, 200] };
  const alloc = (p: keyof typeof next) => {
    let n = ++next[p];
    const skip = HMI_BLOCK[p];
    if (skip && n >= skip[0] && n <= skip[1]) next[p] = n = skip[1] + 1;
    return `${p}${n}`;
  };
  const map = new Map<string, string>(); // base (lower) → neutral base
  const names: Record<string, string> = {};
  const tags: TagDefinition[] = [];
  const kindOf = (base: string, roles: Set<string>): Kind => {
    const sk = structKind(base);
    if (sk || roles.has('timer')) return sk ?? 'timer';
    if (roles.has('counter')) return 'counter';
    const t = typeOf(base);
    switch (t?.dataType) {
      case 'BOOL': return 'bit';
      case 'INT': return 'int';
      case 'DINT': return 'dint';
      case 'REAL': return 'real';
      default: break;
    }
    if ([...roles].some((r) => r.startsWith('member:'))) return 'timer';
    return roles.has('word') || roles.has('wordbit') ? 'int' : 'bit';
  };
  for (const [base, roles] of uses) {
    const lower = base.toLowerCase();
    if (ioIndex.has(lower)) continue;
    if (/^S:FS$/i.test(base) || /^(FirstScan|First_Scan|%?M?\s*FirstScan)$/i.test(base)) { map.set(lower, 'SC2'); continue; }
    // The app's own system bits (a reader already mapped the PLC's: SC1 always on, SC7 1-second clock).
    if (/^SC\d+$/.test(base)) { map.set(lower, base); continue; }
    const kind = kindOf(base, roles);
    const addr = alloc(kind === 'bit' ? 'C' : kind === 'int' ? 'DS' : kind === 'dint' ? 'DD' : kind === 'real' ? 'DF' : kind === 'timer' ? 'T' : 'CT');
    map.set(lower, addr);
    names[addr] = base;
    const t = typeOf(base);
    tags.push({ address: addr, nickname: base, comment: [t?.rawType && t.dataType === 'OTHER' ? t.rawType : '', t?.comment ?? ''].filter(Boolean).join(' — ') });
    if (t?.dataType === 'OTHER' && t.rawType) notes.push(`${base} (${t.rawType}) is used as ${kind === 'bit' ? 'a bit' : kind === 'int' || kind === 'dint' ? 'a number' : kind}; its other members were not imported.`);
  }
  for (const p of io) names[ioIndex.get(p.name.toLowerCase())!] = p.name;

  // Word bits ("Status.3") get their own bit each.
  const wordBits = new Map<string, string>();
  const translate = (op: string): string => {
    const raw = op.trim();
    if (NUM.test(raw)) return raw.replace(/^(\d+)#([0-9A-Fa-f_]+)$/, (_m, r: string, d: string) => String(parseInt(d.replace(/_/g, ''), Number(r))));
    const io1 = ioIndex.get(raw.toLowerCase());
    if (io1) return io1;
    const { base, member } = split(raw, isStruct);
    const io2 = ioIndex.get(base.toLowerCase());
    const b = io2 ?? map.get(base.toLowerCase());
    if (!b) return raw;
    if (!member) return b;
    if (/^\d+$/.test(member)) {
      const k = raw.toLowerCase();
      if (!wordBits.has(k)) {
        const a = alloc('C');
        wordBits.set(k, a);
        names[a] = raw;
        tags.push({ address: a, nickname: raw, comment: `Bit ${member} of ${base}` });
        notes.push(`${raw}: bit ${member} of a word, imported as its own bit ${a} (not linked to the word).`);
      }
      return wordBits.get(k)!;
    }
    const n = b.replace(/^\D+/, '');
    if (b.startsWith('T') && !b.startsWith('TD')) {
      if (TIMER_DONE.test(member)) return `T${n}`;
      if (TIMER_ACC.test(member)) return `TD${n}`;
    }
    if (b.startsWith('CT')) {
      if (COUNTER_DONE.test(member)) return `CT${n}`;
      if (COUNTER_ACC.test(member)) return `CTD${n}`;
    }
    // Members the ladder model has no operand for (timer EN / TT, presets, UDT members).
    const k = raw.toLowerCase();
    if (!wordBits.has(k)) {
      const a = alloc(/^(EN|TT|IN|CU|CD|OV|UN)$/i.test(member) ? 'C' : 'DS');
      wordBits.set(k, a);
      names[a] = raw;
      tags.push({ address: a, nickname: raw, comment: `${member} of ${base} (no direct equivalent; check)` });
      notes.push(`${raw}: ${member} of ${base} has no direct equivalent; imported as ${a}. Check the rungs that use it.`);
    }
    return wordBits.get(k)!;
  };
  const trExpr = (e: string) => (NUM.test(e.trim()) ? translate(e) : e.replace(NAME_RE, (n) => (RESERVED.has(n.toUpperCase()) ? n : translate(n))));

  const trEl = (e: LadderElement): LadderElement => (e.type === 'CMP' ? { ...e, left: trExpr(e.left), right: trExpr(e.right) } : e.type === 'RAW' ? e : { ...e, address: translate(e.address) });
  const trOut = (o: LadderOutput): LadderOutput => {
    switch (o.type) {
      case 'OUT': case 'SET': case 'RST': return { ...o, address: translate(o.address) };
      case 'TMR': return { ...o, address: translate(o.address), preset: trExpr(o.preset), resetAddress: o.resetAddress ? translate(o.resetAddress) : null };
      case 'CNT': return { ...o, address: translate(o.address), preset: trExpr(o.preset), resetAddress: o.resetAddress ? translate(o.resetAddress) : null };
      case 'COPY': return { ...o, source: trExpr(o.source), dest: translate(o.dest) };
      case 'MATH': return { ...o, dest: translate(o.dest), expression: trExpr(o.expression) };
      case 'RAW': return o;
    }
  };

  // ── 4. Blocks (one per routine) and rungs ──
  const blocks: ProgramBlock[] = [];
  const outRungs: Rung[] = [];
  const usedIds = new Set<string>();
  const notConverted: ImportReport['notConverted'] = [];
  const blockOrigin: ImportedProgram['blockOrigin'] = {};
  const rungOrigin: ImportedProgram['rungOrigin'] = {};
  for (const r of fp.routines) {
    for (const u of r.untranslated) notConverted.push({ where: r.name, text: u });
    if (!r.rungs.length) continue;
    let id = `b_${slug(r.name)}`;
    while (blocks.some((b) => b.id === id)) id += '_';
    if (r.origin) blockOrigin[id] = r.origin;
    blocks.push({ id, name: r.name, description: `Imported from ${fp.vendor} ${r.language === 'ladder' ? 'ladder' : r.language.toUpperCase()} routine "${r.name}"` });
    for (const g of r.rungs) {
      const n = r.rungNumbers?.[g.id];
      for (const x of [...g.branches.flat(), ...g.outputs]) if (x.type === 'RAW') notConverted.push({ where: r.name, text: `${n ? `Rung ${n}: ` : ''}${x.text}`, kept: true });
      let rid = `r_${g.id}`;
      while (usedIds.has(rid)) rid += '_';
      usedIds.add(rid);
      if (n !== undefined) rungOrigin[rid] = n;
      outRungs.push({ id: rid, block: id, comment: g.comment, branches: g.branches.map((b) => b.map(trEl)), outputs: g.outputs.map(trOut) });
    }
  }
  linkCounterResets(outRungs, tags, () => alloc('C'), rungOrigin);
  const program: LadderProgram = { rungs: outRungs, blocks, tags };
  const total = outRungs.length + notConverted.filter((n) => !n.kept).length;
  const converted = outRungs.filter((r) => ![...r.branches.flat(), ...r.outputs].some((x) => x.type === 'RAW')).length;
  return {
    source: { format: fp.format, vendor: fp.vendor, controller: fp.controller, projectName: fp.projectName, fileName },
    program, io, names, blockOrigin, rungOrigin,
    report: { rungs: total, converted, notConverted, notes: [...new Set(notes)], outside: fp.outside ?? [] },
  };
}

/** CLICK nickname for an original tag name: letters, digits and _, at most 24 characters (only for a CLICK target). */
export const nickOf = (name: string): string => {
  const s = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (s.length <= 24) return s;
  // Cut at a word ("_") so the nickname doesn't end mid-word, else at 24.
  const cut = s.slice(0, 25).lastIndexOf('_');
  return (cut >= 8 ? s.slice(0, cut) : s.slice(0, 24)).replace(/_+$/, '');
};

/** "Conv1_Start_PB" → "Conv1 Start PB". */
export function pretty(name: string): string {
  return name.replace(/^.*[:.](?=[A-Za-z])/, '').replace(/[_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

/**
 * The imported program for a chosen PLC: I/O points get that PLC's addresses (analog points their
 * analog channel register) and every "@IN:n" / "@OUT:n" in the program is replaced.
 */
/**
 * Signal range of an imported analog point: as its description or tag comment says ("0-10 V", "4…20 mA", "0-20 mA",
 * a thermocouple); an S7-1200 onboard input word (%IW64 / %IW66) is 0–10 V (the CPU's inputs take nothing else).
 * Otherwise 4–20 mA, the usual transmitter signal, `assumed` (asked, and shown "to check" in the I/O list).
 */
export function importedRange(original: string, text = ''): { range: AnalogRange; assumed: boolean } {
  const said: [RegExp, AnalogRange][] = [
    [/\b4\s*(?:-|–|\.\.\.?|…|to)\s*20\s*mA\b/i, '4-20mA'],
    [/\b0\s*(?:-|–|\.\.\.?|…|to)\s*20\s*mA\b/i, '0-20mA'],
    [/(?:^|[^\d.])0\s*(?:-|–|\.\.\.?|…|to)\s*10\s*V(DC)?\b/i, '0-10V'],
    [/(?:^|[^\d.])0\s*(?:-|–|\.\.\.?|…|to)\s*5\s*V(DC)?\b/i, '0-5V'],
    [/thermocouple|\bT\/C\b|\btype [JKTENRSB]\b/i, 'thermocouple'],
  ];
  const hit = said.find(([re]) => re.test(text));
  if (hit) return { range: hit[1], assumed: false };
  if (/^%?IW6[46]$/i.test(original.trim())) return { range: '0-10V', assumed: false };
  return { range: '4-20mA', assumed: true };
}

/** The app's address of an S7 bit or analog word as written in the original (%IX0.2, %I0.2, I0.2 → X003; %IW96 → its channel), or null. */
function s7Terminal(original: string, cpu: CpuModel, modules: ModuleSlot[]): string | null {
  // An analog word (%IW96): the channel at that address, on the CPU or a module.
  const w = /^%?([IQ])W(\d+)$/i.exec(original.trim());
  if (w) {
    const want = `%${w[1].toUpperCase()}W${Number(w[2])}`;
    return siemensAnalogChannels(cpu, modules).find((ch) => siemensAddress(ch.address, cpu, modules)?.address === want)?.address ?? null;
  }
  const m = /^%?([IQ])X?(\d+)\.([0-7])$/i.exec(original.trim());
  if (!m) return null;
  const want = `%${m[1].toUpperCase()}${Number(m[2])}.${m[3]}`;
  const isIn = m[1].toUpperCase() === 'I';
  const slots = [isIn ? cpu.builtInInputs : cpu.builtInOutputs, ...modules.map((x) => (isIn ? x.inputs : x.outputs))];
  for (let slot = 0; slot < slots.length && slot < 10; slot++) {
    for (let n = 1; n <= Math.min(slots[slot], 99); n++) {
      const base = `${isIn ? 'X' : 'Y'}${slot}${String(n).padStart(2, '0')}`;
      if (siemensAddress(base, cpu, modules)?.address === want) return base;
    }
  }
  return null;
}

export function materialize(imp: ImportedProgram, profile: PlcProfile, cpu: CpuModel, modules: ModuleSlot[] = []): { program: LadderProgram; io: IOPoint[]; names: Record<string, string> } {
  let i = 0, o = 0;
  // The imported program scales its own analog values: the app's channel scaling passes the raw counts through
  // (0..full scale → 0..full scale), so nothing is scaled twice.
  const full = /logix|allen-bradley|rockwell/i.test(`${imp.source.vendor} ${imp.source.format}`) || /^l5[xk]$/.test(imp.source.format) ? 32767 : 27648;
  const points: IOPoint[] = imp.io.map((p) => ({
    id: p.type === 'input' ? `I${String(++i).padStart(3, '0')}` : `Q${String(++o).padStart(3, '0')}`,
    description: p.description, type: p.type, category: 'Spare',
    ...(p.analog ? (() => { const r = importedRange(p.original, p.description); return { signal: 'analog' as const, analog: { range: r.range, min: 0, max: full, units: 'raw counts', ...(r.assumed ? { assumed: true } : {}) } }; })() : {}),
    // A CLICK program going back on a CLICK keeps its terminals (X001 stays X001, gaps included); an S7
    // program keeps its %I / %Q bits (%Q0.2 stays %Q0.2).
    ...(profile.id === 'click' && /^[XY]\d{3}$/i.test(p.original) && profile.parseAddress(p.original.toUpperCase()) ? { plcAddress: p.original.toUpperCase() } : {}),
    ...(profile.id === 'siemens-s7' ? (() => { const a = s7Terminal(p.original, cpu, modules); return a ? { plcAddress: a } : {}; })() : {}),
  }));
  const addr = resolveAddresses(profile, cpu, points, modules);
  const ph = new Map<string, string>();
  let a = 0, b = 0;
  for (const p of points) ph.set(p.type === 'input' ? `@IN:${++a}` : `@OUT:${++b}`, addr.get(p.id) ?? '');
  // Internal registers the I/O now uses (analog channels are DF registers) move to the next free number.
  const taken = new Set([...ph.values()].map((x) => x.toUpperCase()));
  const internal = new Set(imp.program.tags.map((t) => t.address.toUpperCase()));
  const moved = new Map<string, string>();
  for (const a0 of internal) {
    if (!taken.has(a0)) continue;
    const [, pre, n] = /^([A-Z]+)(\d+)$/.exec(a0) ?? [];
    if (!pre) continue;
    let k = Number(n);
    let next = `${pre}${++k}`;
    while (taken.has(next) || internal.has(next) || [...moved.values()].includes(next)) next = `${pre}${++k}`;
    moved.set(a0, next);
  }
  const OP = /@(?:IN|OUT):\d+|\b(?:TD|CTD|DS|DD|DF|CT|C|T)\d+\b/g;
  const sub = (s: string) => s.replace(OP, (m) => (m.startsWith('@') ? ph.get(m) || m : moved.get(m.toUpperCase()) ?? m));
  // Operands only: RAW instructions keep their original text and definitions.
  const subObj = <T,>(o: T): T => JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && k !== 'type' ? sub(v) : v));
  const program: LadderProgram = {
    ...imp.program,
    rungs: imp.program.rungs.map((r) => ({
      ...r,
      branches: r.branches.map((b) => b.map((e) => (e.type === 'RAW' ? e : subObj(e)))),
      outputs: r.outputs.map((o) => (o.type === 'RAW' ? o : subObj(o))),
    })),
    tags: imp.program.tags.map((t) => ({ ...t, address: sub(t.address) })),
  };
  const names: Record<string, string> = {};
  for (const [k, v] of Object.entries(imp.names)) names[sub(k)] = v;
  return { program, io: points, names };
}

/**
 * A counter reset in a rung of its own (Logix RES, Mitsubishi RST C0) becomes the counter's reset input,
 * the form the app (and CLICK) uses: one plain contact is used as it is; any other condition drives a reset
 * bit of its own (the conditions of all the reset rungs, OR'ed). Rungs left with no output are dropped.
 */
export function linkCounterResets(rungs: Rung[], tags: TagDefinition[], newBit: () => string, origin: Record<string, string> = {}): void {
  for (const cnt of rungs.flatMap((r) => r.outputs).filter((o): o is Extract<LadderOutput, { type: 'CNT' }> => o.type === 'CNT')) {
    if (cnt.resetAddress) continue;
    const a = cnt.address.toUpperCase();
    const rst = rungs.filter((r) => r.outputs.some((o) => o.type === 'RST' && o.address.toUpperCase() === a));
    if (!rst.length) continue;
    const single = rst.length === 1 && rst[0].branches.length === 1 && rst[0].branches[0].length === 1 && rst[0].branches[0][0].type === 'NO' ? rst[0].branches[0][0].address : null;
    if (single) cnt.resetAddress = single;
    else {
      const bit = newBit();
      const tag = tags.find((t) => t.address.toUpperCase() === a);
      // Named after the counter, or its description when its name is only a device (C0).
      const nick = tag?.nickname && !/^[A-Z]{1,3}\d+$/i.test(tag.nickname) ? tag.nickname : (tag?.comment.match(/[A-Za-z0-9]+/g) ?? []).slice(0, 3).join('_') || 'Counter';
      tags.push({ address: bit, nickname: `${nick}_Reset`, comment: `Reset of ${nick} (from the original reset rung${rst.length > 1 ? 's' : ''})` });
      const always = rst.some((r) => !r.branches.length);
      const at = rungs.indexOf(rst[0]);
      // It stands for the original reset rung (the patch export copies that rung while unchanged).
      const id = `${rst[0].id}_rst`;
      if (origin[rst[0].id] !== undefined) origin[id] = origin[rst[0].id];
      rungs.splice(at, 0, { id, ...(rst[0].block ? { block: rst[0].block } : {}), comment: `Reset ${nick}`, branches: always ? [] : rst.flatMap((r) => r.branches), outputs: [{ type: 'OUT', address: bit }] });
      cnt.resetAddress = bit;
    }
    for (const r of rst) r.outputs = r.outputs.filter((o) => !(o.type === 'RST' && o.address.toUpperCase() === a));
  }
  for (let i = rungs.length - 1; i >= 0; i--) if (!rungs[i].outputs.length) rungs.splice(i, 1);
}
