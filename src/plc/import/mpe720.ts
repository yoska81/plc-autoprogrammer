/**
 * Yaskawa MPE720 Ver.7 project (.YMW7, MP2000 / MP3000 controllers).
 *
 * The file is a short header, then a 7z archive of the project folder (PLC_0001/…):
 *   CMT/C?REG/*.CMT        register comments, one per line: "IB00000 .Reject part"
 *   PRG/TDEF/$PCDEF        the CPU ("NAME=CPU-301(16axes)"); PRG/IOMAP/$SLOTCFG the rack modules;
 *   PRG/IOMAP/$SVPccaa     one file per servo axis (amplifier and motor model);
 *   PRG/DWGA|DWGH|DWGL/$G… the ladder drawings (start-up, high-speed and low-speed scan, sub-drawings
 *                          $GH01_02 = H01.02); Motion/$MPMnnn.txt.tmp motion programs as text.
 * A drawing is a list of records (u16 type … u32 length); type 0x1050 holds the title, 0x1060 the
 * compiled ladder the controller runs, one instruction per step:
 *   [opcode][operand kind][operand]   kind & 0x0F: 1 register (class, type/bit, u16 address),
 *                                      2 INT, 3 DINT, 4 REAL, 0x0A / 0x0B hex 16 / 32, 0 / 5 / 6 none.
 * The ladder's rung shape is in the opcode's low bits (contacts 0x20–0x2F, pulses 0x30–0x3F, timer
 * presets): 0x08 normally closed / off-delay, 0x04 a branch starts here (the value so far is kept as
 * a node), 0x01 this row joins the rows above (OR, back to the node before it), 0x02 another parallel
 * row follows (keep this row, start the next one from the node). A coil without 0x04 ends its row:
 * the logic goes back to the node before it, so the next rung can start from a shared branch point.
 * Checked on a real project against its own cross-reference: every drawing's node stack returns to
 * empty at END, and the registers and opcodes match the cross-reference steps.
 */
import { DamagedData, findSevenZip, readSevenZip, type SevenZipEntry } from './sevenZip';
import { and, el, not, or, toBranches, toRungs, TRUE, type Cond, type Driven } from './cond';
import type { CompareOp, LadderOutput } from '../core/ladder';
import type { ForeignProgram, ForeignRoutine, ForeignTag, ForeignType, NetworkAxisImport } from './types';
import { hmiNotes, type HmiProject } from './emtp';
import { networkNotes, readEthernetConnections, readSvcStations, type EthernetConnection, type MechatrolinkAxis } from './mpe720Network';

export const YASKAWA_VENDOR = 'yaskawa-mp';

/** Start of the box text of an instruction the reader could not read (it does nothing in the program). */
export const UNREAD = 'Unknown instruction';
export const isUnreadBox = (text: string): boolean => text.startsWith(`${UNREAD} (step `);

/** A .YMW7 file: the header is followed by a 7z archive within the first bytes. */
export function isYmw7(name: string, bytes: Uint8Array): boolean {
  return /\.ymw\d?$/i.test(name) || (bytes.length > 64 && bytes[0] === 0x01 && bytes[1] === 0x00 && findSevenZip(bytes, 0, 256) > 0);
}

// ── Comments ──

/** "IB00000 .Reject part" lines → address → comment (empty comments left out). */
export function readComments(text: string, into = new Map<string, string>()): Map<string, string> {
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z]{2}[0-9A-F]{4,7})\s+\.(.*)$/.exec(line);
    if (!m) continue;
    const c = m[2].trim();
    if (c) into.set(m[1], c);
  }
  return into;
}

// ── Instructions ──

export interface Step { op: number; kind: number; data: Uint8Array }

const OPERAND_BYTES: Record<number, number> = { 0: 0, 1: 4, 2: 2, 3: 4, 4: 4, 5: 0, 6: 0, 0xa: 2, 0xb: 4 };

/** The compiled ladder of a drawing → its steps. Throws when an operand kind is not known. */
export function steps(code: Uint8Array): Step[] {
  const out: Step[] = [];
  let p = 0;
  while (p + 2 <= code.length) {
    const op = code[p], kind = code[p + 1];
    // SEE (call a drawing): kind = drawing type, then parent and child number; IF / box end: no operand.
    const n = op === 0x00 ? 2 : op === 0x05 || op === 0x07 ? 0 : OPERAND_BYTES[kind & 0x0f];
    if (n === undefined) throw new Error(`step ${out.length}: operand kind 0x${kind.toString(16)} is not known`);
    out.push({ op, kind, data: code.subarray(p + 2, p + 2 + n) });
    p += 2 + n;
    if (op === 0x07 && kind === 0x00) break;
  }
  return out;
}

const CLASS = ['S', 'I', 'O', 'M', 'C', 'D', 'T'];
const WIDTH: Record<number, string> = { 0x10: 'W', 0x20: 'L', 0x30: 'F' };

/** Register operand → MP address ("MB012340", "IW0010", "ML00500"); local D (and compiler) registers carry the drawing. */
export function register(d: Uint8Array, kind: number, local: string): { name: string; type: ForeignType; local: boolean } {
  const cls = CLASS[d[0]] ?? `?${d[0]}`;
  const sub = d[1];
  const w = d[2] | (d[3] << 8);
  const hex = cls === 'I' || cls === 'O' || cls === 'C';
  const word = hex ? w.toString(16).toUpperCase().padStart(4, '0') : String(w).padStart(5, '0');
  const width = sub < 0x10 ? 'B' : WIDTH[sub & 0xf0] ?? 'W';
  const bit = sub < 0x10 ? sub.toString(16).toUpperCase() : '';
  const index = kind & 0x10 ? 'i' : kind & 0x20 ? 'j' : '';
  const isLocal = cls === 'D' || cls === 'T';
  const base = `${cls}${width}${word}${bit}`;
  return { name: `${isLocal ? `${local}_` : ''}${base}${index}`, type: width === 'B' ? 'BOOL' : width === 'L' ? 'DINT' : width === 'F' ? 'REAL' : 'INT', local: isLocal };
}

function constant(s: Step): string {
  const dv = new DataView(s.data.buffer, s.data.byteOffset, s.data.byteLength);
  switch (s.kind & 0x0f) {
    case 2: return String(dv.getInt16(0, true));
    case 3: return String(dv.getInt32(0, true));
    case 4: return String(Math.round(dv.getFloat32(0, true) * 1e6) / 1e6);
    case 0xa: return String(dv.getUint16(0, true));
    case 0xb: return String(dv.getUint32(0, true));
    default: return '0';
  }
}

const COMPARE: Record<number, CompareOp> = { 0x98: '<', 0x99: '<=', 0x9a: '==', 0x9b: '<>', 0x9c: '>=', 0x9d: '>' };
const MATH: Record<number, string> = { 0x83: '-', 0x84: '+', 0x87: '*', 0x88: '/', 0x90: 'AND' };

export interface DrawingResult {
  routine: ForeignRoutine;
  /** Steps read into the ladder model, and the ones kept as "unknown instruction" boxes. */
  decoded: number;
  unknown: { step: number; op: number }[];
  /** Registers the drawing uses (name → data type). */
  used: Map<string, ForeignType>;
  notes: string[];
}

/**
 * One drawing's steps → rungs with the program's own register names. `id` is the drawing ("H01.02"),
 * `title` its title.
 */
export function decodeDrawing(id: string, title: string, list: Step[]): DrawingResult {
  const local = id.replace(/\./g, '_');
  const used = new Map<string, ForeignType>();
  const notes: string[] = [];
  const unknown: DrawingResult['unknown'] = [];
  const driven: Driven[] = [];
  const temps = new Map<string, Cond>(); // compiler bits written by a compare: read as the compare itself
  let A: Cond = TRUE;
  const nodes: Cond[] = [];
  const ors: Cond[] = [];
  const blocks: ({ k: 'if'; cond: Cond } | { k: 'func' })[] = [];
  let expr = '';
  let helper = 0;

  const reg = (s: Step) => { const r = register(s.data, s.kind, local); used.set(r.name, r.type); return r; };
  const value = (s: Step) => ((s.kind & 0x0f) === 1 ? reg(s).name : constant(s));
  const inIf = () => and(...blocks.flatMap((b) => (b.k === 'if' ? [b.cond] : [])));
  const out = (o: LadderOutput, cond = A) => driven.push({ cond: and(inIf(), cond), out: o });
  const raw = (text: string): LadderOutput => ({ type: 'RAW', vendor: YASKAWA_VENDOR, text });
  /** An instruction the reader does not know: a visible box with its code and operands (the operands that follow it too). */
  const unknownStep = (i: number, s: Step): number => {
    unknown.push({ step: i, op: s.op });
    const args = [s, ...list.slice(i + 1).filter((x, k, xs) => x.op === 0xf0 && xs.slice(0, k).every((y) => y.op === 0xf0))]
      .filter((x) => x.data.length).map((x) => ((x.kind & 0x0f) === 1 ? reg(x).name : `#${constant(x)}`));
    out(raw(`${UNREAD} (step ${i}, code 0x${s.op.toString(16).padStart(2, '0')})${args.length ? ` ${args.join(', ')}` : ''}: not run, rewrite by hand`), TRUE);
    return args.length - (s.data.length ? 1 : 0);
  };
  // The branch bits shared by contacts, pulses and timers.
  const before = (op: number) => { if (op & 0x04) nodes.push(A); };
  const after = (op: number) => {
    if (op & 0x01) { A = or(ors.pop() ?? FALSE_C, A); nodes.pop(); }
    if (op & 0x02) { ors.push(A); A = nodes[nodes.length - 1] ?? TRUE; }
  };
  const endRow = () => { A = nodes.pop() ?? TRUE; };
  // A condition that keeps growing (shared branch points nest it) gets a helper bit, so no rung's logic,
  // nor the work to draw it, can grow without bound on a long or damaged drawing.
  let links = 0;
  const tame = () => {
    if (condSize(A) <= MAX_COND) return;
    const name = `${local}_LNK${++links}`;
    driven.push({ cond: and(inIf(), A), out: { type: 'OUT', address: name } });
    A = el({ type: 'NO', address: name });
  };

  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const op = s.op;
    // Inside a function header the codes carry no operand: the header is read at 0x10.
    if (blocks[blocks.length - 1]?.k === 'func' && op !== 0x07 && (s.kind & 0x0f) === 0) continue;
    if (op >= 0x20 && op <= 0x2f) {
      before(op);
      const r = reg(s);
      const nc = (op & 0x08) !== 0;
      let c: Cond;
      if (r.name === 'SB000004') c = nc ? FALSE_C : TRUE; // always ON
      else if (temps.has(r.name)) c = nc ? not(temps.get(r.name)!) : temps.get(r.name)!;
      else c = el({ type: nc ? 'NC' : 'NO', address: r.name });
      A = and(A, c);
      after(op);
    } else if (op >= 0x30 && op <= 0x3f) {
      // ON / OFF pulse of the logic so far; its operand is the edge memory bit, used as the helper.
      before(op);
      const r = reg(s);
      out({ type: 'OUT', address: r.name });
      A = el({ type: op & 0x08 ? 'FALL' : 'RISE', address: r.name });
      after(op);
    } else if ((op >= 0x40 && op <= 0x4f && op !== 0x4d) || (op >= 0xd0 && op <= 0xdf)) {
      // Timer: the preset, then the count register (f0). 0x40 10 ms base, 0xD0 1 s base; 0x08 off-delay.
      const cnt = list[i + 1];
      if (!cnt || cnt.op !== 0xf0 || (cnt.kind & 0x0f) !== 1) { i += unknownStep(i, s); continue; }
      before(op);
      i++;
      const name = reg(cnt).name;
      used.set(name, 'TIMER');
      const sec = op >= 0xd0;
      const preset = (s.kind & 0x0f) === 1 ? reg(s).name : constant(s);
      const isConst = (s.kind & 0x0f) !== 1;
      if (!isConst) notes.push(`${id}: timer ${name} takes its preset from ${preset} in ${sec ? '1 s' : '10 ms'} units.`);
      out({
        type: 'TMR', address: name, mode: op & 0x08 ? 'OFF_DELAY' : 'ON_DELAY',
        preset: isConst ? (sec ? preset : String(Number(preset) * 10)) : preset, unit: sec ? 'sec' : 'ms', accumulate: false, resetAddress: null,
      });
      A = el({ type: 'NO', address: `${name}.DN` });
      after(op);
    } else if (op >= 0x50 && op <= 0x57 && (s.kind & 0x0f) === 1) {
      const r = reg(s);
      const type = (op & 0x03) === 1 ? 'SET' : (op & 0x03) === 2 ? 'RST' : (op & 0x03) === 0 ? 'OUT' : null;
      if (!type) i += unknownStep(i, s);
      else if (type === 'OUT' && r.name.includes('_TB')) temps.set(r.name, A); // a compare's result
      else { temps.delete(r.name); out({ type, address: r.name }); }
      if (s.kind & 0xc0) notes.push(`${id} step ${i}: coil ${r.name} has option 0x${(s.kind & 0xc0).toString(16)} (check).`);
      if (!(op & 0x04)) endRow();
    } else if (COMPARE[op]) {
      nodes.push(A);
      A = and(A, el({ type: 'CMP', left: expr || '0', op: COMPARE[op], right: value(s) }));
    } else if (op === 0x9e) {
      // Range check: the value between this operand and the next (f0).
      const hi = list[i + 1];
      if (!hi || hi.op !== 0xf0) { i += unknownStep(i, s); continue; }
      i++;
      nodes.push(A);
      A = and(A, el({ type: 'CMP', left: expr || '0', op: '>=', right: value(s) }), el({ type: 'CMP', left: expr || '0', op: '<=', right: value(hi) }));
    } else if (op === 0x80 || op === 0x81) {
      if ((s.kind & 0x0f) !== 5 && (s.kind & 0x0f) !== 6) expr = value(s);
    } else if (MATH[op]) {
      expr = `${/[-+*/]/.test(expr) ? `(${expr})` : expr} ${MATH[op]} ${value(s)}`;
    } else if (op === 0xa2) {
      expr = `ABS(${expr})`;
    } else if (op === 0x82) {
      if ((s.kind & 0x0f) === 1) {
        const dest = reg(s).name;
        out(/^[\w.]+$/.test(expr) ? { type: 'COPY', source: expr, dest } : { type: 'MATH', dest, expression: expr }, TRUE);
      }
    } else if (op === 0x89 && (s.kind & 0x0f) === 1) {
      const dest = reg(s).name;
      out({ type: 'MATH', dest, expression: `${dest} + 1` }, TRUE);
    } else if (op === 0x05) {
      blocks.push({ k: 'if', cond: A });
      A = TRUE;
    } else if (op === 0x07 && s.kind === 0x03) {
      const b = blocks.pop();
      if (b?.k !== 'func') endRow();
    } else if (op === 0x07 && s.kind === 0x00) {
      break;
    } else if (op === 0x00) {
      const t = { 3: 'H', 5: 'L', 1: 'A', 2: 'I' }[s.kind] ?? `?${s.kind}`;
      out(raw(`SEE ${t}${String(s.data[0]).padStart(2, '0')}${s.data[1] ? `.${String(s.data[1]).padStart(2, '0')}` : ''}`), TRUE);
    } else if (op === 0x10) {
      // A function call: header (name code) up to the box end, then its inputs and outputs.
      blocks.push({ k: 'func' });
      const name = list[i + 1]?.op === 0x4d ? `0x${constant(list[i + 1]).replace(/^-/, '')}` : '?';
      out(raw(`FUNC ${name} (user function call: kept as a box; its inputs and outputs follow)`), TRUE);
    } else if (op === 0x4d && list[i - 1]?.op === 0x10) {
      // function name code, read with 0x10
    } else if (op === 0x11) {
      out(raw(`FUNC word input ${value(s)}`), TRUE);
    } else if (op === 0x12) {
      out(raw('FUNC bit input'));
      endRow();
    } else if (op === 0x14) {
      nodes.push(A);
      A = and(A, el({ type: 'RAW', vendor: YASKAWA_VENDOR, text: `FUNC output ${++helper}` }));
    } else if (op === 0xf0) {
      out(raw(`parameter ${value(s)}`), TRUE);
    } else {
      i += unknownStep(i, s);
    }
    tame();
  }

  const rungs = toDrawnRungs(driven, title ? `${id} ${title}` : id, `r_${local}`, notes);
  return {
    routine: { name: title ? `${id} ${title}` : id, language: 'ladder', rungs, untranslated: [], origin: { program: id.split('.')[0], routine: id } },
    decoded: list.length - unknown.length,
    unknown, used, notes,
  };
}

const FALSE_C: Cond = { k: 'false' };

/** Largest condition (elements, counted as drawn) one step may leave before it gets a helper bit. */
const MAX_COND = 400;
const sizes = new WeakMap<Cond, number>();
function condSize(c: Cond): number {
  let n = sizes.get(c);
  if (n === undefined) {
    n = c.k === 'and' || c.k === 'or' ? c.xs.reduce((a, x) => a + condSize(x), 1) : c.k === 'not' ? 1 + condSize(c.x) : 1;
    sizes.set(c, n);
  }
  return n;
}

/**
 * Conditions → rungs. A condition with more parallel paths than a rung holds is split: its largest
 * parallel part gets a helper bit of its own, written by a rung before it.
 */
function toDrawnRungs(driven: Driven[], comment: string, idBase: string, notes: string[]) {
  const out: Driven[] = [];
  let helpers = 0;
  const simplify = (c: Cond): Cond => {
    if (toBranches(c)) return c;
    if (c.k === 'and' || c.k === 'or') {
      const xs = c.xs.map(simplify);
      const c2: Cond = c.k === 'and' ? and(...xs) : or(...xs);
      if (toBranches(c2)) return c2;
      // replace the biggest part by a helper bit
      const sized = (c2.k === 'and' || c2.k === 'or' ? c2.xs : [c2]).map((x, i) => ({ x, i, n: JSON.stringify(x).length })).sort((a, b) => b.n - a.n);
      const big = sized[0];
      if (big && (c2.k === 'and' || c2.k === 'or')) {
        const name = `${idBase.replace(/^r_/, '')}_HLP${++helpers}`;
        out.push({ cond: big.x, out: { type: 'OUT', address: name } });
        const ys = c2.xs.slice();
        ys[big.i] = el({ type: 'NO', address: name });
        return simplify(c2.k === 'and' ? and(...ys) : or(...ys));
      }
    }
    return c;
  };
  for (const d of driven) out.push({ cond: simplify(d.cond), out: d.out });
  const { rungs, failed } = toRungs(out, comment, idBase);
  for (const f of failed) {
    notes.push(`${comment}: an output (${f.out.type}) has a condition that cannot be drawn as a rung; it is kept as a box.`);
    rungs.push({ id: `${idBase}_x${rungs.length}`, comment: '', branches: [], outputs: [{ type: 'RAW', vendor: YASKAWA_VENDOR, text: `${f.out.type} ${'address' in f.out ? f.out.address : ''} (condition not drawn)` }] });
  }
  return rungs;
}

// ── Project ──

interface Records { [type: number]: Uint8Array }

function records(b: Uint8Array): Records {
  const out: Records = {};
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 0x20;
  while (p + 16 <= b.length) {
    const type = dv.getUint16(p, true);
    const len = dv.getUint32(p + 12, true);
    if (len < 16 || p + len > b.length) break;
    out[type] = b.subarray(p + 16, p + len);
    p += len;
  }
  return out;
}

const latin1 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return s; };

/** Printable runs of a binary file ("SLT1003", "SGD7S-…"). */
function asciiRuns(b: Uint8Array, min = 3): string[] {
  const out: string[] = [];
  let cur = '';
  for (const x of b) {
    if (x >= 0x20 && x < 0x7f) cur += String.fromCharCode(x);
    else { if (cur.length >= min) out.push(cur); cur = ''; }
  }
  if (cur.length >= min) out.push(cur);
  return out;
}

/** An axis in plain words: "axis 1 (line 1): SGD7S-… with motor SGM7J-…", "axis 3 (line 1): virtual". */
export const axisText = (a: NetworkAxisImport) => `axis ${a.axis} (line ${a.line}${a.station ? `, station ${a.station}` : ''}): ${a.kind === 'virtual' ? 'virtual' : a.drive ?? 'amplifier ?'}${a.motor ? ` with motor ${a.motor}` : ''}`;

/** "$GH01_02" → "H01.02", "$GL" → "L". */
const drawingId = (file: string) => file.replace(/^\$G/, '').replace(/_/g, '.');

const DRAWING_ORDER: Record<string, number> = { A: 0, I: 1, H: 2, L: 3 };

export interface Ymw7Summary { drawings: number; steps: number; decoded: number; unknownOps: Record<string, number>; axes: string[] }

/** The project, with its touch panel (a Weintek .emtp read by readEmtp) when one came with it. */
export function readYmw7(bytes: Uint8Array, fileName = 'project.YMW7', hmi?: HmiProject): ForeignProgram & { summary: Ymw7Summary } {
  const at = findSevenZip(bytes, 0, 4096);
  if (at < 0) throw new Error('This .YMW7 file does not hold an MPE720 project (no packed project inside). Save the project again in MPE720 and upload it whole.');
  let entries: SevenZipEntry[];
  try { entries = readSevenZip(bytes, at); } catch (e) {
    if (e instanceof DamagedData) throw new Error(`This Yaskawa file looks damaged: ${e.message}. Save the project again in MPE720 and upload the whole .YMW7 file.`, { cause: e });
    throw e;
  }
  const files = new Map<string, SevenZipEntry>();
  for (const e of entries) files.set(e.name.replace(/^[^/]*\//, ''), e); // drop "PLC_0001/"
  const text = (path: string) => { const f = files.get(path); return f ? latin1(f.data) : ''; };

  const comments = new Map<string, string>();
  for (const [path, f] of files) if (/^CMT\/C[IOMS]REG\/.*\.CMT$/i.test(path)) readComments(latin1(f.data), comments);

  const pcdef = text('PRG/TDEF/$PCDEF');
  const cpu = /NAME=([^\r\n\0]+)/.exec(pcdef)?.[1].trim() ?? 'MP2000 / MP3000 CPU';
  const modules: { slot: number; catalog: string }[] = [];
  const slots = asciiRuns(files.get('PRG/IOMAP/$SLOTCFG')?.data ?? new Uint8Array(0));
  for (let i = 0; i < slots.length - 1; i++) {
    const m = /^SLT(\d)(\d)(\d\d)$/.exec(slots[i]);
    const mod = /^([\w()-]+)\$MP\dX$/.exec(slots[i + 1]);
    if (m && mod && !/UNDEFINED/.test(mod[1])) modules.push({ slot: Number(m[3]), catalog: mod[1] });
  }
  const axisList: NetworkAxisImport[] = [];
  for (const [path, f] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const m = /^PRG\/IOMAP\/\$SVP(\d\d)(\d\d)$/.exec(path);
    if (!m) continue;
    const runs = asciiRuns(f.data, 6);
    const drive = runs.find((r) => /^SGD/.test(r));
    const motor = runs.find((r) => /^SGM/.test(r));
    // No drive named: a virtual axis (SVR), unless the file says it is a servo some other way.
    const virtual = !drive && (runs.some((r) => /SVR|VIRTUAL/i.test(r)) || !motor);
    axisList.push({ line: Number(m[1]), axis: Number(m[2]), ...(drive ? { drive } : {}), ...(motor ? { motor } : {}), kind: virtual ? 'virtual' : 'servo' });
  }
  // The SVC / 218IFD set-up, as far as the files say it for certain (src/plc/import/mpe720Network.ts).
  const stations: MechatrolinkAxis[] = [], connections: EthernetConnection[] = [];
  for (const [path, f] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (!/^PRG\/IOMAP\/\$SLT\d+$/.test(path)) continue;
    if (!stations.length) stations.push(...readSvcStations(f.data));
    if (!connections.length) connections.push(...readEthernetConnections(f.data));
  }
  // Each axis on the first circuit gets its station (record n = axis n).
  const circuit = Math.min(...axisList.map((x) => x.line));
  for (const s of stations) {
    const x = axisList.find((a) => a.line === circuit && a.axis === s.axis);
    if (x) { x.station = s.station; x.stationAxis = s.stationAxis; }
  }
  const axes = axisList.map(axisText);

  // Drawings in scan order: A (start-up), I (interrupt), H (high-speed), L (low-speed), parents before their sub-drawings.
  const dwgFiles = [...files.keys()].filter((p) => /^PRG\/DWG[AHIL]\/\$G[AHIL][\d_]*$/.test(p))
    .sort((a, b) => {
      const ia = drawingId(a.split('/').pop()!), ib = drawingId(b.split('/').pop()!);
      return (DRAWING_ORDER[ia[0]] ?? 9) - (DRAWING_ORDER[ib[0]] ?? 9) || ia.localeCompare(ib);
    });
  const routines: ForeignRoutine[] = [];
  const used = new Map<string, ForeignType>();
  const notes: string[] = [];
  const outside: string[] = [];
  const unknownOps: Record<string, number> = {};
  let total = 0, decoded = 0;
  for (const path of dwgFiles) {
    const id = drawingId(path.split('/').pop()!);
    const rec = records(files.get(path)!.data);
    const t = rec[0x1050];
    const title = t && t[0x1f] && t[0x1f] < 0x50 ? latin1(t.subarray(0x20, 0x20 + t[0x1f])).replace(/\0.*$/, '').trim() : '';
    const code = rec[0x1060];
    if (!code) { outside.push(`Drawing ${id}${title ? ` ${title}` : ''}: no compiled ladder found.`); continue; }
    let list: Step[];
    try { list = steps(code); } catch (e) {
      outside.push(`Drawing ${id}${title ? ` ${title}` : ''}: could not be read (${e instanceof Error ? e.message : String(e)}).`);
      continue;
    }
    let r: DrawingResult;
    try { r = decodeDrawing(id, title, list); } catch (e) {
      outside.push(`Drawing ${id}${title ? ` ${title}` : ''}: could not be read (${e instanceof Error ? e.message : String(e)}).`);
      continue;
    }
    routines.push(r.routine);
    for (const [k, v] of r.used) if (!used.has(k) || used.get(k) === 'BOOL') used.set(k, v);
    notes.push(...r.notes);
    total += list.length; decoded += r.decoded;
    for (const u of r.unknown) { const k = `0x${u.op.toString(16).padStart(2, '0')}`; unknownOps[k] = (unknownOps[k] ?? 0) + 1; }
  }

  // Motion programs written as text.
  for (const [path, f] of files) {
    const m = /^Motion\/\$(MPM\d+)\.txt(\.tmp)?$/i.exec(path);
    if (!m) continue;
    const src = latin1(f.data).replace(/\r\n?/g, '\n').trim();
    if (src.split('\n').filter((l) => l.trim() && !/^\s*(MPM\d+\b.*|end;?)\s*$/i.test(l)).length === 0) continue;
    routines.push({ name: `${m[1]} motion program`, language: 'other', rungs: [], untranslated: [src] });
  }

  // Tags: every register the ladder uses and every commented register.
  const tags: ForeignTag[] = [];
  const io = (name: string): Pick<ForeignTag, 'io' | 'analog'> => {
    const m = /^([IO])([BWLF])([0-9A-F]{4})/.exec(name);
    if (!m || parseInt(m[3], 16) >= 0x8000) return {}; // 8000 and up: servo / motion registers
    return { io: m[1] === 'I' ? 'input' : 'output', ...(m[2] !== 'B' ? { analog: true } : {}) };
  };
  const typeOf = (addr: string): ForeignType => { const w = addr[1]; return w === 'B' ? 'BOOL' : w === 'L' ? 'DINT' : w === 'F' ? 'REAL' : 'INT'; };
  const seen = new Set<string>();
  const addTag = (name: string, dataType: ForeignType) => {
    if (seen.has(name)) return;
    seen.add(name);
    const addr = name.replace(/^[AHIL](\d\d)?(_\d\d)?_/, '').replace(/[ij]$/, '');
    tags.push({ name, dataType, address: addr, comment: comments.get(addr) ?? '', ...(dataType === 'TIMER' ? { rawType: 'TON' } : {}), ...io(addr) });
  };
  for (const [name, t] of used) addTag(name, t);
  for (const [addr, c] of comments) if (c && (/^[IO][BW]/.test(addr) && Object.keys(io(addr)).length)) addTag(addr, typeOf(addr));

  const summary: Ymw7Summary = { drawings: routines.filter((r) => r.language === 'ladder').length, steps: total, decoded, unknownOps, axes };
  const calls = spliceCalls(routines);
  routines.splice(0, routines.length, ...calls.routines);
  notes.unshift(
    `MPE720 project: ${summary.drawings} ladder drawings, ${total} steps; ${decoded} read into rungs (${total ? Math.round((decoded / total) * 1000) / 10 : 0} %).${Object.keys(unknownOps).length ? ` Not read (shown as "Unknown instruction" boxes): ${Object.entries(unknownOps).map(([k, n]) => `${k} ×${n}`).join(', ')}.` : ''}`,
    `Drawings call each other with SEE.${calls.spliced ? ` ${calls.spliced} call${calls.spliced === 1 ? '' : 's'} on a rung that always runs: the called drawing is placed at the call (the caller's block continues after it), so the scan order stays.` : ''}${calls.kept ? ` ${calls.kept} conditional or repeated call${calls.kept === 1 ? ' is' : 's are'} kept as boxes (rewrite by hand).` : ''} Every drawing is a block of the program, in scan order. Local registers (D) and the compiler\'s work bits carry their drawing in the name (H01_02_DB000090).`,
    'Function calls (FUNC) and the servo / motion registers (IW/OW 8000 and up) are kept as written; check them against the new PLC.',
    ...(axes.length ? [`Servo axes (MECHATROLINK): ${axes.join('; ')}.`] : []),
    ...networkNotes(stations, connections),
    ...(hmi ? hmiNotes(hmi, (a) => comments.get(a), (a) => used.has(a)) : []),
  );
  return {
    format: 'yaskawa-mpe720', vendor: 'Yaskawa', controller: cpu, modules, ...(axisList.length ? { axes: axisList } : {}), ...(hmi ? { panel: { vendor: 'weintek', software: `EasyBuilder Pro ${hmi.version}`.trim(), screens: hmi.screens } } : {}), projectName: fileName.replace(/\.[^.]+$/, ''),
    tags, routines, notes, outside, summary,
  };
}

const SEE = /^SEE ([AHIL]\d\d(?:\.\d\d)*)$/;
const seeOf = (o: LadderOutput): string | null => (o.type === 'RAW' ? SEE.exec(o.text.trim())?.[1] ?? null : null);

/**
 * SEE calls a drawing at that point of the caller's scan. A call on a rung with no condition, the only call of
 * that drawing, becomes the drawing itself at that point: the caller's block ends before the call, the called
 * drawing's block follows, then the rest of the caller (its own block, "… (after H01.01)"). So the program runs in
 * the same order on any PLC, with no call instruction. A conditional call, or a drawing called from several
 * places, keeps its SEE box.
 */
export function spliceCalls(routines: ForeignRoutine[]): { routines: ForeignRoutine[]; spliced: number; kept: number } {
  const ladder = routines.filter((r) => r.language === 'ladder');
  const idOf = (r: ForeignRoutine) => r.origin?.routine ?? r.name.split(' ')[0];
  const byId = new Map(ladder.map((r) => [idOf(r), r] as const));
  const refs = new Map<string, { always: number; other: number }>();
  for (const r of ladder) for (const g of r.rungs) for (const o of g.outputs) {
    const id = seeOf(o);
    if (!id) continue;
    const n = refs.get(id) ?? { always: 0, other: 0 };
    if (g.branches.length) n.other++; else n.always++;
    refs.set(id, n);
  }
  const inline = new Set([...refs].filter(([id, n]) => n.always === 1 && n.other === 0 && byId.has(id)).map(([id]) => id));
  const out: ForeignRoutine[] = [];
  const placed = new Set<ForeignRoutine>();
  let spliced = 0;
  const emit = (r: ForeignRoutine, stack: Set<ForeignRoutine>) => {
    placed.add(r);
    let part: ForeignRoutine['rungs'] = [];
    let seg = 0, after = '';
    const flush = () => {
      if (part.length) {
        const nums = r.rungNumbers ? Object.fromEntries(part.flatMap((g) => (r.rungNumbers![g.id] !== undefined ? [[g.id, r.rungNumbers![g.id]]] : []))) : undefined;
        out.push({ ...r, name: seg ? `${r.name} (after ${after})` : r.name, rungs: part, untranslated: seg ? [] : r.untranslated, ...(nums ? { rungNumbers: nums } : {}), ...(seg ? { origin: undefined } : {}) });
        seg++;
      }
      part = [];
    };
    for (const g of r.rungs) {
      const child = (o: LadderOutput) => { const id = seeOf(o); const c = id && inline.has(id) ? byId.get(id)! : null; return c && !placed.has(c) && !stack.has(c) ? c : null; };
      if (g.branches.length || !g.outputs.some((o) => child(o))) { part.push(g); continue; }
      // An always-true rung: its outputs in order, the call taking its place between them.
      let outs: LadderOutput[] = [], k = 0;
      const put = () => { if (outs.length) part.push({ ...g, id: k++ ? `${g.id}_${k}` : g.id, outputs: outs }); outs = []; };
      for (const o of g.outputs) {
        const c = child(o);
        if (!c) { outs.push(o); continue; }
        put();
        flush();
        if (!seg) seg = 1; // the caller's next part is a continuation even when nothing came before the call
        emit(c, new Set([...stack, r]));
        spliced++;
        after = idOf(c);
      }
      put();
    }
    flush();
  };
  for (const r of ladder) if (!inline.has(idOf(r)) && !placed.has(r)) emit(r, new Set());
  for (const r of ladder) if (!placed.has(r)) emit(r, new Set());
  const kept = [...refs].reduce((n, [id, x]) => n + (inline.has(id) ? 0 : x.always + x.other), 0);
  return { routines: [...out, ...routines.filter((r) => r.language !== 'ladder')], spliced, kept };
}
